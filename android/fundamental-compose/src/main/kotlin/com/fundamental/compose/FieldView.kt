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
import com.fundamental.core.engine.Body
import com.fundamental.core.runtime.FieldController
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

/** How the particle pool is drawn (the matter render modes — mirror of the JS/Swift modes). */
enum class RenderMode {
    /** Soft round particles (the default). */
    DOTS,

    /** Motion trails — the frame fades instead of clearing, so matter leaves comet tails. */
    TRAILS,

    /** Proximity links — line segments between nearby particles (constellation / network look). */
    LINKS,

    /** Soft additive glow — radial-gradient blobs, brightest where matter is hot. */
    GLOW,
}

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
    renderMode: RenderMode = RenderMode.DOTS,
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
            when (renderMode) {
                RenderMode.DOTS -> particles.forEachIndexed { i, p ->
                    val heat = p.heat.coerceIn(0f, 1f)
                    drawCircle(lerp(COOL, hues[i % hues.size], heat), 1.5f + p.size * 1.5f + heat * 3f, Offset(p.position.x, p.position.y), 0.85f)
                }

                RenderMode.GLOW -> particles.forEachIndexed { i, p ->
                    val heat = p.heat.coerceIn(0f, 1f)
                    val c0 = lerp(COOL, hues[i % hues.size], heat)
                    val glowR = 5f + p.size * 2f + heat * 16f
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(c0.copy(alpha = 0.45f + heat * 0.4f), Color.Transparent),
                            center = Offset(p.position.x, p.position.y),
                            radius = glowR,
                        ),
                        radius = glowR,
                        center = Offset(p.position.x, p.position.y),
                    )
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
