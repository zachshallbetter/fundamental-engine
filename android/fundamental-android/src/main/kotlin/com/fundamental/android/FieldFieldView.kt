package com.fundamental.android

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import com.fundamental.core.runtime.BodyHandle
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldController
import com.fundamental.core.runtime.FieldEvent
import com.fundamental.core.runtime.FieldHandle
import com.fundamental.core.runtime.PARTICLE_STRIDE
import kotlin.math.max

/**
 * The non-Compose Fundamental field surface — a custom [View] that owns a [FieldController], lets the
 * engine drive it one frame per display tick through [AndroidFieldHost] (the `Choreographer` under the
 * hood), and renders the particle pool in [onDraw]. The Kotlin mirror of Swift's imperative
 * `FieldField` (the `FieldView`-less host), for apps not on Jetpack Compose.
 *
 * Lifecycle (#605 mirror): the controller is created lazily in [onSizeChanged] once the view has real
 * pixel dimensions (then resized on subsequent layout changes) and attached to [host] — from there the
 * engine owns the loop. Presentation changes auto-pause it: attach/detach, window shown/hidden
 * (activity stop/start), and view shown/hidden all flow through [AndroidFieldHost.fireVisibility], so
 * the Choreographer callback is cancelled outright while the field is off screen (no leak past detach,
 * no invisible ticking). `handle?.pause()` / `resume()` layer the sticky explicit lane on top;
 * `host.isPaused` is the host-level SPI for presentations Android does not report (dialogs, covering
 * fragments).
 *
 * Imperative API: [burst] / tap shoves matter; [addBody] registers a force source; [handle] exposes the
 * full [FieldHandle] facade for callers that want flow, seeding, edges, pause/resume, etc.
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
    private var fieldHandle: FieldHandle? = null

    /** The host seam (geometry, signals, frame sync, input) — kept for parity with UIKitFieldHost. */
    val host: AndroidFieldHost = AndroidFieldHost(this)

    /**
     * The full imperative field API once the controller exists (null before first layout). ONE
     * persistent facade per view — pause state, event subscriptions, and the after-tick hook live on
     * it for the view's whole life.
     */
    val handle: FieldHandle?
        get() = fieldHandle

    /** Direct controller access for hosts that want the lower-level API. Null before first layout. */
    val fieldController: FieldController?
        get() = controller

    // Reused per-frame: the particle read-out buffer (stride 5) and the draw paint, so onDraw allocates
    // nothing in the hot path. The buffer is (re)sized when the controller / particleCount changes.
    private var pool: FloatArray = FloatArray(0)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        // Transparent background so the field composites over whatever is behind it.
        setBackgroundColor(Color.TRANSPARENT)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w == 0 || h == 0) return
        val c = controller
        if (c == null) {
            val created = FieldController(w.toFloat(), h.toFloat(), particleCount = particleCount)
            controller = created
            // Buffer sized to the actual pool count (PARTICLE_STRIDE floats each).
            pool = FloatArray(particleCount * PARTICLE_STRIDE)
            val handle = FieldHandle(created)
            fieldHandle = handle
            handle.on(FieldEvent.TICK) { invalidate() }
            // Hand the loop to the engine (#605): it schedules through host.scheduleFrame, computes
            // the frame-rate-independent dt (reduced motion folded in), and the visibility seam +
            // pause()/resume() cancel/reschedule the Choreographer callback through syncLoop().
            handle.attach(host)
        } else {
            c.resize(w.toFloat(), h.toFloat())
        }
    }

    // ── the visibility seam (#605) ──────────────────────────────────────────────────────────────
    // Window and view visibility changes reach a View only through these protected callbacks, so the
    // view forwards them to the host, which fans out to the engine's auto-pause. Window visibility is
    // how activity stop/start arrives (the window of a stopped activity reads GONE); attach/detach is
    // covered by the host's own attach-state listener.

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        // Forward the DELIVERED value — during the detach dispatch a live getWindowVisibility() read
        // is stale (still visible), so the host caches what View actually reported. The base View
        // constructor can deliver an early visibility callback before this class's initializers ran
        // (Kotlin field-init order) — `host` reads null then despite its non-null type; skip,
        // attach() reconciles the loop later anyway.
        @Suppress("UNNECESSARY_SAFE_CALL")
        host?.windowVisibilityChanged(visibility)
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        @Suppress("UNNECESSARY_SAFE_CALL")
        host?.fireVisibility()
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
