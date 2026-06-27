package com.fundamental.android

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.Choreographer
import android.view.MotionEvent
import android.view.View
import com.fundamental.core.runtime.BodyHandle
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldController
import com.fundamental.core.runtime.FieldHandle
import com.fundamental.core.runtime.PARTICLE_STRIDE
import kotlin.math.max

/**
 * The non-Compose Fundamental field surface — a custom [View] that owns a [FieldController], drives it
 * one frame per [Choreographer] tick, and renders the particle pool in [onDraw]. The Kotlin mirror of
 * Swift's imperative `FieldField` (the `FieldView`-less host), for apps not on Jetpack Compose.
 *
 * Lifecycle: the frame loop starts in [onAttachedToWindow] and stops in [onDetachedFromWindow], so no
 * Choreographer callback leaks past detach. The controller is created lazily in [onSizeChanged] once
 * the view has real pixel dimensions, then resized on subsequent layout changes.
 *
 * Imperative API: [burst] / tap shoves matter; [addBody] registers a force source; [handle] exposes the
 * full [FieldHandle] facade for callers that want flow, seeding, edges, etc.
 */
class FieldFieldView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

    /** Particle pool size. Set before the view is first laid out to take effect. */
    var particleCount: Int = 300

    /** Accent color for hot matter; cool (resting) matter eases toward [coolColor]. */
    var accentColor: Int = Color.rgb(0x4D, 0xA3, 0xFF)

    /** Resting (warm-default identity) color — matches the engine palette, like the Compose host's COOL. */
    var coolColor: Int = Color.rgb(0xFF, 0xE0, 0xC8)

    private var controller: FieldController? = null

    /** The host seam (geometry, signals, frame sync, input) — kept for parity with UIKitFieldHost. */
    val host: AndroidFieldHost = AndroidFieldHost(this)

    /** The full imperative field API once the controller exists (null before first layout). */
    val handle: FieldHandle?
        get() = controller?.let { FieldHandle(it) }

    /** Direct controller access for hosts that want the lower-level API. Null before first layout. */
    val fieldController: FieldController?
        get() = controller

    // Reused per-frame: the particle read-out buffer (stride 5) and the draw paint, so onDraw allocates
    // nothing in the hot path. The buffer is (re)sized when the controller / particleCount changes.
    private var pool: FloatArray = FloatArray(0)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    private var running = false
    // Previous frame's nanos, for the frame-rate-independent timestep. 0 == no prior frame yet.
    private var lastFrameNanos: Long = 0L
    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            // Frame-rate-independent timestep — mirror of FieldEngine.swift (~L258): normalize the real
            // frame interval to a 60fps baseline (≈1 at 60fps, ≈0.5 at 120fps), clamp so a stall can't
            // teleport matter, and zero it under reduced motion (which gates the integrator off).
            val last = lastFrameNanos
            val dtRaw = if (last == 0L) 1f else (frameTimeNanos - last) / 1e9f * 60f
            lastFrameNanos = frameTimeNanos
            val reduced = host.prefersReducedMotion
            val dt = if (reduced) 0f else dtRaw.coerceIn(0.2f, 2f)
            // Hidden guard (mirror `guard !host.isHidden`): skip integration while off-screen, but keep
            // the loop alive so it resumes cleanly when shown again.
            if (!host.isHidden) {
                controller?.tick(dt)
                invalidate()
            }
            // Re-post while attached; onDetachedFromWindow flips `running` and removes the callback.
            if (running) Choreographer.getInstance().postFrameCallback(this)
        }
    }

    init {
        // Transparent background so the field composites over whatever is behind it.
        setBackgroundColor(Color.TRANSPARENT)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w == 0 || h == 0) return
        val c = controller
        if (c == null) {
            controller = FieldController(w.toFloat(), h.toFloat(), particleCount = particleCount)
            // Buffer sized to the actual pool count (PARTICLE_STRIDE floats each).
            pool = FloatArray(particleCount * PARTICLE_STRIDE)
        } else {
            c.resize(w.toFloat(), h.toFloat())
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        startLoop()
    }

    override fun onDetachedFromWindow() {
        stopLoop()
        super.onDetachedFromWindow()
    }

    private fun startLoop() {
        if (running) return
        running = true
        // Reset so the first frame after (re)attach uses dt=1 rather than a stale-interval blowup.
        lastFrameNanos = 0L
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    private fun stopLoop() {
        running = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val c = controller ?: return
        // Ensure the buffer can hold the live count (e.g. if seeded particles changed the size basis).
        val needed = c.particleCount * PARTICLE_STRIDE
        if (pool.size < needed) pool = FloatArray(needed)

        val n = c.readParticles(pool)
        // Stride layout: [x, y, z, heat, size]. Mirror the Compose DOTS render — radius grows with size
        // and heat; color lerps cool→accent by heat.
        for (k in 0 until n) {
            val base = k * PARTICLE_STRIDE
            val x = pool[base]
            val y = pool[base + 1]
            // pool[base + 2] is z — ignored on the flat field.
            val heat = pool[base + 3].coerceIn(0f, 1f)
            val size = pool[base + 4]
            paint.color = lerpColor(coolColor, accentColor, heat)
            paint.alpha = (0.85f * 255f).toInt()
            val radius = 1.5f + size * 1.5f + heat * 3f
            canvas.drawCircle(x, y, max(0.5f, radius), paint)
        }
    }

    // ── imperative API ──────────────────────────────────────────────────────────────────────────

    /** Shove + heat matter near a point (the §11 burst interaction). No-op before first layout. */
    fun burst(x: Float, y: Float, power: Float = 1f) {
        controller?.burst(x, y, power)
    }

    /** Register a programmatic force-source body; returns its live handle, or null before layout. */
    fun addBody(spec: BodySpec): BodyHandle? = handle?.addBody(spec)

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_DOWN) {
            burst(event.x, event.y)
            return true
        }
        return super.onTouchEvent(event)
    }

    // ── helpers ───────────────────────────────────────────────────────────────────────────────

    /** Linear interpolate two ARGB colors by `t` ∈ [0,1] (the Android counterpart of Compose `lerp`). */
    private fun lerpColor(from: Int, to: Int, t: Float): Int {
        val u = t.coerceIn(0f, 1f)
        val r = (Color.red(from) + (Color.red(to) - Color.red(from)) * u).toInt()
        val g = (Color.green(from) + (Color.green(to) - Color.green(from)) * u).toInt()
        val b = (Color.blue(from) + (Color.blue(to) - Color.blue(from)) * u).toInt()
        return Color.rgb(r, g, b)
    }
}
