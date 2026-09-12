package com.fundamental.compose

import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.Canvas as AndroidCanvas
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntSize
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import android.provider.Settings
import androidx.compose.ui.graphics.BlendMode
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.marchingCell
import com.fundamental.core.engine.nearestParticle
import com.fundamental.core.engine.splatDensity
import com.fundamental.core.engine.voronoiWalls
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.FieldController
import com.fundamental.core.runtime.RenderMode
import kotlin.math.sqrt
import com.fundamental.core.engine.Box as FieldBox

/**
 * The Compose adapter for the Fundamental engine — the Android counterpart of `@fundamental-engine/react`
 * and the Swift `FieldView`. A thin host over the pure-Kotlin [FieldController]: it drives one frame per
 * display frame via `withFrameNanos` and renders the particle pool onto a Compose `Canvas`.
 *
 * Place reactive content inside [content]; any composable there can call [Modifier.fieldBody] to become
 * a force source whose well tracks its on-screen bounds — "elements bend the field; the field bends them
 * back."
 */

/** Provides the running [FieldController] to descendants so [Modifier.fieldBody] can attach. */
val LocalFieldController = compositionLocalOf<FieldController?> { null }

/**
 * The [FieldView] root's live [LayoutCoordinates], published so [Modifier.fieldBody] can express a body's
 * box in **field space** (relative to the field root's top-left), not relative to a body's immediate
 * parent. This is the Compose analog of `AndroidFieldHost.worldBox` subtracting the host view's screen
 * origin, and of the JS/UIKit contract in `docs/canonical/coordinate-spaces.md` (the adapter converts host
 * → field space at the field boundary). Null until the root is first positioned.
 */
val LocalFieldRootCoordinates = compositionLocalOf<LayoutCoordinates?> { null }

private const val LINK_RADIUS = 38f // px — links connect particles closer than this
private val COOL = Color(0xFFFFE0C8) // resting (warm-default identity), matches the engine palette

// The three modes added in #1158 use the SAME constants as the JS underlay (field.ts §20.6) and the
// Swift CoreGraphicsRenderer, so a field in `metaballs` reads the same on all three planes. The
// geometry itself lives in :fundamental-core (engine/RenderModes.kt) — shared, and unit-tested there.
private const val MB_STEP = 16f      // metaballs: density-grid resolution (px) — JS STEP
private const val MB_RADIUS = 34f    // metaballs: kernel radius (px), fixed, not size-scaled — JS RAD
private const val MB_LEVEL = 0.9f    // metaballs: the iso threshold that becomes the blob skin — JS LEVEL
private const val VOR_STEP = 18f     // voronoi: owner-grid resolution (px) — JS STEP
private const val VOR_SEARCH = VOR_STEP * 3f // voronoi: nearest-site candidate radius — JS SEARCH
private const val SL_GRID = 46f      // streamlines: the probe lattice pitch (px) — JS GRID
private const val SL_RESAMPLE = 3    // streamlines: re-probe the field every Nth frame (JS cadence)

/** Reusable metaballs density grid — allocated per size/mode, not per frame (mirrors the JS scratch). */
private class DensityGrid(val cols: Int, val rows: Int) {
    val values = FloatArray(cols * rows)
}

/** Reusable voronoi owner grid (one stable particle id per node, -1 = unowned). */
private class OwnerGrid(val cols: Int, val rows: Int) {
    val owners = IntArray(cols * rows)
}

/** One streamline probe: the unit direction of the felt force and its magnitude. */
private class Arrow(val x: Float, val y: Float, val ux: Float, val uy: Float, val mag: Float)

/**
 * Cached streamline probes. The arrows trace the body-induced force field, which only changes when
 * bodies move — so the lattice is re-probed on a cadence and DRAWN from cache every frame (the JS
 * treatment). [maxSmoothed] is the EMA-smoothed normalization peak: rise fast, decay slow, so a quiet
 * frame never flashes the whole field.
 */
private class StreamlineCache {
    var arrows: List<Arrow> = emptyList()
    var quiescent: List<Offset> = emptyList()
    var maxSmoothed = 0f
    var probed = false
}

@Composable
fun FieldView(
    modifier: Modifier = Modifier,
    accent: Color = Color(0xFF4DA3FF),
    /**
     * Multi-hue palette. Each particle takes a stable colour from this list (by its
     * index in the pool), so the field renders in several hues at once — matching the
     * Swift/JS engines, whose FieldOptions carry a `palette`. Defaults to `[accent]`,
     * i.e. the previous single-hue behaviour, so existing callers are unaffected.
     */
    palette: List<Color> = listOf(accent),
    particleCount: Int = 300,
    /**
     * How the particle pool is drawn — the engine's own [RenderMode]
     * (`com.fundamental.core.runtime.RenderMode`), the same seven-mode vocabulary the JS and Swift
     * planes take. Every mode has a draw path here; [RenderMode.NONE] draws nothing while the
     * simulation and every signal stay live (the signals-only underlay, which is what the core
     * `FieldHandle` itself defaults to).
     *
     * The host default stays [RenderMode.DOTS] — the mode this composable has always drawn — so
     * existing callers keep their field. Pass [RenderMode.NONE] explicitly for the signals-first
     * posture.
     */
    renderMode: RenderMode = RenderMode.DOTS,
    /**
     * Soft glow halo drawn behind each DOTS particle (0 = flat dots, the previous
     * behaviour; ~0.4 = the Swift/JS `particleGlow` look). Mirrors FieldOptions.
     */
    particleGlow: Float = 0f,
    /**
     * Draw faint links between nearby particles in DOTS mode — the constellation
     * lines the Swift/JS engines show. Off by default.
     */
    constellation: Boolean = false,
    content: @Composable () -> Unit = {},
) {
    var controller by remember { mutableStateOf<FieldController?>(null) }
    var frame by remember { mutableIntStateOf(0) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    // The field root's coordinates — bodies express their box relative to THIS, so nested/scrolling
    // layout offsets don't drift the well (see LocalFieldRootCoordinates / fieldBody).
    var rootCoordinates by remember { mutableStateOf<LayoutCoordinates?>(null) }

    // Reduced-motion seam. No FieldHost here (unlike :fundamental-android's AndroidFieldHost), so read
    // the same system signal it does: ANIMATOR_DURATION_SCALE == 0 means the user disabled animations.
    val context = LocalContext.current
    val prefersReducedMotion = Settings.Global.getFloat(
        context.contentResolver,
        Settings.Global.ANIMATOR_DURATION_SCALE,
        1f,
    ) == 0f

    // Presentation-aware auto-pause (#605 mirror) — the Compose analog of the View host's visibility
    // seam. The composition's lifecycle drives the tick loop below: ON_STOP (activity backgrounded /
    // covered) disposes the LaunchedEffect, so frame scheduling actually stops — not merely
    // guard-skipped ticks; ON_START relaunches it with a fresh `lastNanos`, so the first resumed frame
    // integrates at dt = 1 (no time-jump after a long background stretch). For an explicit sticky
    // pause, wrap the controller in a `FieldHandle` and call `pause()` — its lane gates `tick()`
    // directly, host-independent.
    val lifecycleOwner = LocalLifecycleOwner.current
    var lifecycleRunning by remember { mutableStateOf(true) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> lifecycleRunning = true
                Lifecycle.Event.ON_STOP -> lifecycleRunning = false
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Persistent buffer for TRAILS: matter is drawn into it each frame and the frame is faded, not
    // cleared, so trails accumulate. Recreated when the size or mode changes; null for other modes.
    val trail = remember(canvasSize, renderMode) {
        if (renderMode == RenderMode.TRAILS && canvasSize.width > 0 && canvasSize.height > 0) {
            val bmp = Bitmap.createBitmap(canvasSize.width, canvasSize.height, Bitmap.Config.ARGB_8888)
            TrailBuffer(bmp, AndroidCanvas(bmp), Paint().apply { isAntiAlias = true })
        } else {
            null
        }
    }

    // Scratch surfaces for the grid-based modes, sized once per size/mode change rather than per
    // frame — the Compose analog of the JS `mball` / `vor` scratch arrays and `slSamples` cache.
    val mball = remember(canvasSize, renderMode) {
        if (renderMode == RenderMode.METABALLS && canvasSize.width > 0 && canvasSize.height > 0) {
            DensityGrid((canvasSize.width / MB_STEP).toInt() + 2, (canvasSize.height / MB_STEP).toInt() + 2)
        } else {
            null
        }
    }
    val vor = remember(canvasSize, renderMode) {
        if (renderMode == RenderMode.VORONOI && canvasSize.width > 0 && canvasSize.height > 0) {
            OwnerGrid((canvasSize.width / VOR_STEP).toInt() + 1, (canvasSize.height / VOR_STEP).toInt() + 1)
        } else {
            null
        }
    }
    val streamlines = remember(canvasSize, renderMode) {
        if (renderMode == RenderMode.STREAMLINES) StreamlineCache() else null
    }

    Box(
        modifier = modifier
            .onGloballyPositioned { rootCoordinates = it }
            .onSizeChanged { size ->
                if (size.width == 0 || size.height == 0) return@onSizeChanged
                canvasSize = size
                val c = controller
                if (c == null) {
                    controller = FieldController(size.width.toFloat(), size.height.toFloat(), particleCount = particleCount)
                } else {
                    c.resize(size.width.toFloat(), size.height.toFloat())
                }
            },
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures { offset -> controller?.burst(offset.x, offset.y) }
                },
        ) {
            frame // observe the frame tick so the canvas redraws each display frame
            val c = controller ?: return@Canvas
            val particles = c.particles
            // Stable per-particle hue: the pool is updated in place, so a particle keeps
            // its array index across frames — no per-frame colour flicker.
            val hues = palette.ifEmpty { listOf(accent) }
            // An exhaustive `when` EXPRESSION over the engine's RenderMode, deliberately: a mode added
            // to the core enum then fails this host at COMPILE time instead of silently drawing
            // nothing, which is exactly how the four-mode host enum hid three modes until #1158.
            val drawn: Unit = when (renderMode) {
                RenderMode.DOTS -> {
                    // Faint constellation links first, so dots draw over them.
                    if (constellation) {
                        for (p in particles) {
                            val po = Offset(p.position.x, p.position.y)
                            for (q in c.store.neighbors(p, LINK_RADIUS)) {
                                val dx = p.position.x - q.position.x
                                val dy = p.position.y - q.position.y
                                val d = kotlin.math.sqrt(dx * dx + dy * dy)
                                drawLine(hues[0], po, Offset(q.position.x, q.position.y), strokeWidth = 1f, alpha = (1f - d / LINK_RADIUS) * 0.12f)
                            }
                        }
                    }
                    particles.forEachIndexed { i, p ->
                        val heat = p.heat.coerceIn(0f, 1f)
                        // Saturation floor: resting particles still carry ~⅓ of their hue,
                        // instead of washing out to COOL — the flat/pale look otherwise.
                        val col = lerp(COOL, hues[i % hues.size], 0.34f + heat * 0.66f)
                        val r = 1.7f + p.size * 1.7f + heat * 3f
                        if (particleGlow > 0f) {
                            val gr = r * (2f + particleGlow * 4f)
                            drawCircle(
                                brush = Brush.radialGradient(
                                    colors = listOf(col.copy(alpha = particleGlow * (0.35f + heat * 0.45f)), Color.Transparent),
                                    center = Offset(p.position.x, p.position.y),
                                    radius = gr,
                                ),
                                radius = gr,
                                center = Offset(p.position.x, p.position.y),
                            )
                        }
                        drawCircle(col, r, Offset(p.position.x, p.position.y), 0.9f)
                    }
                }

                RenderMode.LINKS -> {
                    for (p in particles) {
                        val po = Offset(p.position.x, p.position.y)
                        for (q in c.store.neighbors(p, LINK_RADIUS)) {
                            val dx = p.position.x - q.position.x
                            val dy = p.position.y - q.position.y
                            val d = kotlin.math.sqrt(dx * dx + dy * dy)
                            // each pair is visited twice (p→q and q→p); half the alpha so it sums right.
                            drawLine(accent, po, Offset(q.position.x, q.position.y), strokeWidth = 1f, alpha = (1f - d / LINK_RADIUS) * 0.25f)
                        }
                    }
                    particles.forEachIndexed { i, p ->
                        val heat = p.heat.coerceIn(0f, 1f)
                        drawCircle(lerp(COOL, hues[i % hues.size], heat), 1.5f + heat * 2f, Offset(p.position.x, p.position.y), 0.9f)
                    }
                }

                RenderMode.TRAILS -> if (trail != null) {
                    // fade the previous frame toward black, then stamp the particles.
                    trail.canvas.drawColor(android.graphics.Color.argb(38, 0, 0, 0), android.graphics.PorterDuff.Mode.SRC_OVER)
                    particles.forEachIndexed { i, p ->
                        val heat = p.heat.coerceIn(0f, 1f)
                        trail.paint.color = lerp(COOL, hues[i % hues.size], heat).toArgb()
                        trail.canvas.drawCircle(p.position.x, p.position.y, 1.5f + p.size * 1.5f + heat * 3f, trail.paint)
                    }
                    drawImage(trail.bitmap.asImageBitmap())
                } else {
                    particles.forEachIndexed { i, p ->
                        drawCircle(lerp(COOL, hues[i % hues.size], p.heat.coerceIn(0f, 1f)), 2f, Offset(p.position.x, p.position.y), 0.85f)
                    }
                }

                // A liquid iso-surface: splat every FREE particle's density kernel onto a coarse grid,
                // then trace one contour of it with marching squares — the swarm reads as one molten
                // skin rather than discrete dots. Captured matter is out of the blob (JS/Swift parity),
                // and the contour REPLACES the matter, so no dots are drawn under it.
                RenderMode.METABALLS -> if (mball != null) {
                    val g = mball.values
                    java.util.Arrays.fill(g, 0f)
                    for (p in particles) {
                        if (p.cap != null) continue
                        splatDensity(g, mball.cols, mball.rows, MB_STEP, p.position.x, p.position.y, MB_RADIUS)
                    }
                    for (gy in 0 until mball.rows - 1) {
                        for (gx in 0 until mball.cols - 1) {
                            val segs = marchingCell(
                                tl = g[gy * mball.cols + gx],
                                tr = g[gy * mball.cols + gx + 1],
                                br = g[(gy + 1) * mball.cols + gx + 1],
                                bl = g[(gy + 1) * mball.cols + gx],
                                level = MB_LEVEL,
                            )
                            for (sg in segs) {
                                drawLine(
                                    accent,
                                    Offset((gx + sg.x1) * MB_STEP, (gy + sg.y1) * MB_STEP),
                                    Offset((gx + sg.x2) * MB_STEP, (gy + sg.y2) * MB_STEP),
                                    strokeWidth = 1.4f,
                                    alpha = 0.5f,
                                    blendMode = BlendMode.Plus, // the JS 'lighter' composite
                                )
                            }
                        }
                    }
                } else Unit

                // Shattered glass: each grid node takes the id of its nearest particle, and a wall is
                // stroked wherever two adjacent nodes disagree. The matter stays visible over the walls
                // (JS keeps the swarm here; Swift draws its dots on top), so the cells read as owned.
                RenderMode.VORONOI -> if (vor != null) {
                    for (gy in 0 until vor.rows) {
                        for (gx in 0 until vor.cols) {
                            val nx = gx * VOR_STEP
                            val ny = gy * VOR_STEP
                            val cands = c.store.near(Vec3(nx, ny, 0f), VOR_SEARCH)
                            val k = nearestParticle(nx, ny, cands)
                            vor.owners[gy * vor.cols + gx] = if (k >= 0) cands[k].id else -1
                        }
                    }
                    for (w in voronoiWalls(vor.owners, vor.cols, vor.rows)) {
                        drawLine(
                            accent,
                            Offset(w.x1 * VOR_STEP, w.y1 * VOR_STEP),
                            Offset(w.x2 * VOR_STEP, w.y2 * VOR_STEP),
                            strokeWidth = 1f,
                            alpha = 0.32f,
                            blendMode = BlendMode.Plus, // the JS 'lighter' composite
                        )
                    }
                    particles.forEachIndexed { i, p ->
                        val heat = p.heat.coerceIn(0f, 1f)
                        drawCircle(lerp(COOL, hues[i % hues.size], heat), 1.5f + heat * 2f, Offset(p.position.x, p.position.y), 0.9f)
                    }
                } else Unit

                // The force field itself, not the matter: short arrows along the net push a still test
                // particle would feel at a probe lattice (§20.6 diagnostic). Lengths and alphas scale
                // with the sqrt-compressed magnitude relative to an EMA-smoothed peak, so a weak dipole
                // reads as clearly as a strong attractor. Draws ALONE — the matter is suppressed.
                RenderMode.STREAMLINES -> if (streamlines != null) {
                    if (!streamlines.probed || frame % SL_RESAMPLE == 0) {
                        val arrows = ArrayList<Arrow>()
                        val quiet = ArrayList<Offset>()
                        var frameMax = 0f
                        var py = SL_GRID / 2f
                        while (py < size.height) {
                            var px = SL_GRID / 2f
                            while (px < size.width) {
                                val f = c.sample(px, py)
                                val mag = sqrt(f.x * f.x + f.y * f.y)
                                if (mag > 1e-9f) {
                                    arrows.add(Arrow(px, py, f.x / mag, f.y / mag, mag))
                                    if (mag > frameMax) frameMax = mag
                                } else {
                                    quiet.add(Offset(px, py)) // a true dead zone — a faint dot, not an arrow
                                }
                                px += SL_GRID
                            }
                            py += SL_GRID
                        }
                        streamlines.maxSmoothed = when {
                            streamlines.maxSmoothed == 0f -> frameMax
                            frameMax > streamlines.maxSmoothed ->
                                streamlines.maxSmoothed * 0.7f + frameMax * 0.3f // track rises promptly
                            else -> streamlines.maxSmoothed * 0.9f + frameMax * 0.1f // decay slowly
                        }
                        streamlines.arrows = arrows
                        streamlines.quiescent = quiet
                        streamlines.probed = true
                    }
                    for (q in streamlines.quiescent) drawCircle(accent, 0.5f, q, 0.05f)
                    val peak = streamlines.maxSmoothed
                    if (peak > 0f) {
                        for (a in streamlines.arrows) {
                            val rel = sqrt(a.mag / peak) // sqrt compresses the range so weak vectors read
                            val len = SL_GRID * 0.46f * (0.28f + 0.72f * rel)
                            val ex = a.x + a.ux * len
                            val ey = a.y + a.uy * len
                            val al = (0.1f + rel * 0.5f).coerceIn(0f, 0.72f)
                            val tip = Offset(ex, ey)
                            drawLine(accent, Offset(a.x, a.y), tip, strokeWidth = 1f, alpha = al)
                            val ah = 3.4f
                            drawLine(accent, tip, Offset(ex - a.ux * ah - a.uy * ah * 0.6f, ey - a.uy * ah + a.ux * ah * 0.6f), strokeWidth = 1f, alpha = al)
                            drawLine(accent, tip, Offset(ex - a.ux * ah + a.uy * ah * 0.6f, ey - a.uy * ah - a.ux * ah * 0.6f), strokeWidth = 1f, alpha = al)
                        }
                    } else Unit
                } else Unit

                // Signals-only: the simulation, the bodies and every feedback channel stay live; the
                // draw stops. This is what the core FieldHandle defaults to, and it is a real mode
                // here rather than an unrepresentable one.
                RenderMode.NONE -> Unit
            }
        }

        val c = controller
        if (c != null) {
            // The loop exists only while the lifecycle is started (#605): flipping `lifecycleRunning`
            // false disposes the effect (scheduling cancelled), true relaunches it (fresh clock).
            if (lifecycleRunning) {
                LaunchedEffect(c, prefersReducedMotion) {
                    // Frame-rate-independent timestep — mirror of FieldEngine.swift (~L258): normalize
                    // the real frame interval to a 60fps baseline, clamp so a stall can't teleport
                    // matter, and zero it under reduced motion (which gates the integrator off). First
                    // frame uses dt=1 — including the first frame after a lifecycle resume.
                    var lastNanos = 0L
                    while (true) {
                        withFrameNanos { now ->
                            val dtRaw = if (lastNanos == 0L) 1f else (now - lastNanos) / 1e9f * 60f
                            lastNanos = now
                            val dt = if (prefersReducedMotion) 0f else dtRaw.coerceIn(0.2f, 2f)
                            c.tick(dt)
                        }
                        frame++
                    }
                }
            }
            CompositionLocalProvider(
                LocalFieldController provides c,
                LocalFieldRootCoordinates provides rootCoordinates,
            ) { content() }
        }
    }
}

/** Holds the persistent trail surface + a reusable paint (so TRAILS doesn't reallocate per frame). */
private class TrailBuffer(val bitmap: Bitmap, val canvas: AndroidCanvas, val paint: Paint)

/**
 * Make this composable a force source in the surrounding [FieldView]. The body's well tracks the
 * element's bounds **in field space** — its offset relative to the [FieldView] root, not its immediate
 * parent — each layout. Mirrors SwiftUI `.fieldBody(...)` / React `useFieldBody`, and the JS/UIKit
 * coordinate contract (`docs/canonical/coordinate-spaces.md`): the field adapter positions bodies in the
 * field's own space, so nested layout containers and scroll offsets between the body and the field root
 * do not drift the well.
 *
 * A no-op when not inside a [FieldView]. If the field root is not yet positioned (first frame), the body
 * falls back to root-space so it still attaches at a sensible position until the root reports in.
 */
@Composable
fun Modifier.fieldBody(
    tokens: List<String>,
    strength: Float = 1f,
    range: Float = 150f,
    spin: Float = 1f,
): Modifier {
    val controller = LocalFieldController.current ?: return this
    val rootCoordinates = LocalFieldRootCoordinates.current
    val body = remember { Body(tokens = tokens, strength = strength, range = range, spin = spin) }
    DisposableEffect(controller) {
        controller.addBody(body)
        onDispose { controller.removeBody(body) }
    }
    return this.onGloballyPositioned { coords ->
        // Field-space origin: this body's top-left expressed in the field root's local coordinates. When
        // the root is attached, `localPositionOf` walks the layout tree so intervening containers/scroll
        // offsets cancel out. Before the root reports in, `positionInRoot()` is the closest fallback.
        val root = rootCoordinates
        val topLeft = if (root != null && root.isAttached && coords.isAttached) {
            root.localPositionOf(coords, Offset.Zero)
        } else {
            coords.positionInRoot()
        }
        body.box = FieldBox.fromFieldTopLeft(
            x = topLeft.x,
            y = topLeft.y,
            width = coords.size.width.toFloat(),
            height = coords.size.height.toFloat(),
        )
    }
}
