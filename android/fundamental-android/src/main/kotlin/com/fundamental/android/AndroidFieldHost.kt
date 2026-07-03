package com.fundamental.android

import android.provider.Settings
import android.view.Choreographer
import android.view.View
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldHost
import com.fundamental.core.engine.FieldProjection
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.engine.FlatProjection
import com.fundamental.core.math.Vec3

/**
 * The [FieldHost] implementation for plain Android `View`s — the Kotlin mirror of Swift's
 * `UIKitFieldHost`. Maps an [android.view.View]'s geometry, system signals, frame sync, and input
 * events to the platform-agnostic [FieldHost] contract.
 *
 * Differences from UIKit, intentional and noted inline:
 *  - frame sync is [Choreographer] rather than `CADisplayLink`;
 *  - world geometry uses `getLocationOnScreen` rather than `convert(_:to:)`;
 *  - there is no declarative `[data-body]` scan ([scanBodies] returns empty) — Android callers add
 *    bodies imperatively via the controller / [FieldHandle].
 *
 * `depth` follows the Swift host: 0 = the flat field (byte-identical to the JS 2D math), > 0 opens a
 * shallow z volume. Android currently ships flat ([FlatProjection]); the [projection] hook is kept so a
 * perspective projection can be slotted in later exactly as on iOS.
 */
class AndroidFieldHost(
    private val view: View,
    private val depth: Float = 0f,
) : FieldHost {

    private val choreographer: Choreographer = Choreographer.getInstance()

    // ── FieldHost — geometry ────────────────────────────────────────────────────────────────────

    override val volume: FieldVolume
        get() {
            // The mount IS the field: its own pixel bounds, not the screen. Matches UIKit using
            // rootView.bounds. `scale` is the DPR equivalent (displayScale → displayMetrics.density).
            val density = view.resources.displayMetrics.density
            return FieldVolume(
                width = view.width.toFloat(),
                height = view.height.toFloat(),
                depth = if (depth > 0f) depth else 0f,
                scale = if (density > 0f) density else 1f,
            )
        }

    // Android views are not implicitly inside a scroll container the way a UIScrollView ancestor is
    // discoverable, and the contract allows 0 when not applicable. A host embedded in a scroller can
    // forward offsets via onScroll; the absolute scroll position stays 0 here (parity intent: the JS
    // `scrolling` condition simply stays inactive).
    override val scrollY: Float get() = 0f
    override val scrollHeight: Float get() = 0f

    // ── FieldHost — system signals ──────────────────────────────────────────────────────────────

    override val prefersReducedMotion: Boolean
        get() = Settings.Global.getFloat(
            view.context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f

    /**
     * Explicit host-level pause SPI (#605 — the `UIKitFieldHost.isPaused` mirror), folded into
     * [isHidden] so flipping it drives the engine's auto-pause through the same visibility seam the
     * view-lifecycle events use. Android cannot observe every presentation from outside the view — a
     * dialog or covering fragment leaves the window `VISIBLE`, ticking invisibly — so a presenter
     * sets this instead. Callers holding a `FieldHandle` should prefer `pause()` / `resume()` on it.
     */
    var isPaused: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            fireVisibility()
        }

    override val isHidden: Boolean
        get() = isPaused || detachedFromWindow ||
            view.visibility != View.VISIBLE || windowVisibility != View.VISIBLE

    // The window visibility as last DELIVERED to the owning view (see [windowVisibilityChanged]), or a
    // live read when nothing forwards. The cache matters on the detach path: View synthesizes
    // `onWindowVisibilityChanged(GONE)` and dispatches the attach-state listeners BEFORE nulling
    // `mAttachInfo`, so `getWindowVisibility()` still reads the OLD (visible) value inside those
    // callbacks — a live re-read there would miss the hide entirely.
    private var deliveredWindowVisibility: Int? = null
    private val windowVisibility: Int
        get() = deliveredWindowVisibility ?: view.windowVisibility

    // Set by the shared attach listener BEFORE observers are notified — same detach-dispatch staleness
    // as above, for hosts wrapping arbitrary views where nothing forwards the protected callbacks.
    private var detachedFromWindow = false

    /**
     * The owning view's `onWindowVisibilityChanged` forwarder (FieldFieldView calls this): caches the
     * DELIVERED visibility — authoritative even inside the detach dispatch, where a live
     * `getWindowVisibility()` read is stale — then fires the seam. View re-delivers the real window
     * visibility on every attach and window change, so the cache tracks truth from then on.
     */
    fun windowVisibilityChanged(visibility: Int) {
        deliveredWindowVisibility = visibility
        fireVisibility()
    }

    // ── FieldHost — loop ────────────────────────────────────────────────────────────────────────

    /**
     * A repeating display-sync loop — the contract mirrors the Swift hosts' `CADisplayLink` (fires
     * every frame until cancelled), but Choreographer callbacks are one-shot, so the token re-posts
     * itself after each fire. Cancellation flips the flag AND removes any pending post, so a cancelled
     * loop can neither fire nor linger on the Choreographer.
     */
    private class FrameLoop(
        private val choreographer: Choreographer,
        private val callback: (Double) -> Unit,
    ) : Choreographer.FrameCallback {
        var cancelled = false
        override fun doFrame(frameTimeNanos: Long) {
            if (cancelled) return
            // frameTimeNanos → milliseconds-as-Double, the contract's timestamp units.
            callback(frameTimeNanos / 1_000_000.0)
            if (!cancelled) choreographer.postFrameCallback(this)
        }
    }

    override fun scheduleFrame(callback: (Double) -> Unit): Any {
        // Choreographer is the Android display-sync seam (CADisplayLink equivalent).
        val loop = FrameLoop(choreographer, callback)
        choreographer.postFrameCallback(loop)
        return loop
    }

    override fun cancelFrame(token: Any) {
        (token as? FrameLoop)?.let {
            it.cancelled = true
            choreographer.removeFrameCallback(it)
        }
    }

    // ── FieldHost — events (each returns an unsubscribe closure) ─────────────────────────────────

    override fun onResize(callback: () -> Unit): () -> Unit {
        val listener = View.OnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
            if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) callback()
        }
        view.addOnLayoutChangeListener(listener)
        return { view.removeOnLayoutChangeListener(listener) }
    }

    override fun onScroll(callback: () -> Unit): () -> Unit {
        // View.setOnScrollChangeListener is API 23; minSdk is 24 so it is always available. It reports
        // this view's own scroll; for a host inside a scroller the parent can also forward.
        val listener = View.OnScrollChangeListener { _, _, _, _, _ -> callback() }
        view.setOnScrollChangeListener(listener)
        return {
            // Clearing requires passing null; the platform tolerates it.
            view.setOnScrollChangeListener(null)
        }
    }

    override fun onVisibility(callback: () -> Unit): () -> Unit {
        // Attach/detach is observable from outside the view; window/view visibility changes are NOT
        // (View exposes them only as protected callbacks) — the owning view forwards those through
        // fireVisibility() (FieldFieldView overrides onWindowVisibilityChanged / onVisibilityChanged,
        // which is how activity stop/start reaches the engine), and [isPaused] covers presentations
        // no callback reports. One shared attach listener fans out to every subscriber.
        visibilityObservers.add(callback)
        if (!attachListenerInstalled) {
            view.addOnAttachStateChangeListener(attachListener)
            attachListenerInstalled = true
            // Re-sync the detach flag (accurate outside the dispatch window) — it may be stale if the
            // view attached/detached while no listener was installed.
            detachedFromWindow = !view.isAttachedToWindow
        }
        return {
            visibilityObservers.remove(callback)
            if (visibilityObservers.isEmpty() && attachListenerInstalled) {
                view.removeOnAttachStateChangeListener(attachListener)
                attachListenerInstalled = false
            }
        }
    }

    /**
     * Deliver a visibility change to every subscriber — the seam the engine's auto-pause listens on
     * (#605). Called by the shared attach listener, by [isPaused], and by the owning view's protected
     * visibility overrides (window shown/hidden on activity stop/start, view shown/hidden), which
     * only the view itself can observe. The engine re-reads [isHidden] and reconciles its loop.
     */
    fun fireVisibility() {
        // snapshot — a subscriber may unsubscribe re-entrantly
        visibilityObservers.toList().forEach { it() }
    }

    private val visibilityObservers: MutableList<() -> Unit> = ArrayList()
    private var attachListenerInstalled = false
    private val attachListener = object : View.OnAttachStateChangeListener {
        override fun onViewAttachedToWindow(v: View) {
            detachedFromWindow = false
            fireVisibility()
        }

        override fun onViewDetachedFromWindow(v: View) {
            // Mark BEFORE notifying: inside this callback `getWindowVisibility()` still reads the old
            // (visible) value, so subscribers re-reading isHidden need the explicit flag to see hidden.
            detachedFromWindow = true
            fireVisibility()
        }
    }

    override fun onInput(callback: () -> Unit): () -> Unit {
        // Fan-out touch listener. Returns false so the host View still receives the event for its own
        // burst handling — this is a passive observer, mirroring UIKit's input observer list.
        val existing = inputObservers
        existing.add(callback)
        if (!touchListenerInstalled) {
            view.setOnTouchListener { _, _ ->
                inputObservers.forEach { it() }
                false
            }
            touchListenerInstalled = true
        }
        return {
            existing.remove(callback)
            if (existing.isEmpty() && touchListenerInstalled) {
                view.setOnTouchListener(null)
                touchListenerInstalled = false
            }
        }
    }

    private val inputObservers: MutableList<() -> Unit> = ArrayList()
    private var touchListenerInstalled = false

    // ── FieldHost — projection ──────────────────────────────────────────────────────────────────

    // Flat field on Android today. The depth-driven PerspectiveProjection branch present in
    // UIKitFieldHost can be added here unchanged once a volume host ships.
    override val projection: FieldProjection get() = FlatProjection()

    // ── FieldHost — body scanning ───────────────────────────────────────────────────────────────

    // No declarative `[data-body]` view scan on Android yet (UIKit walks FieldBodyProvider subviews).
    // Callers register bodies imperatively through the FieldController / FieldHandle.
    override fun scanBodies(): List<Body> = emptyList()

    override fun worldBox(view: Any): Box? {
        // The `view` handle is a body's `Body.view` (Types.kt) — the opaque platform reference the
        // registry reads and passes here (MeasurementRegistry). For AndroidFieldHost that must be an
        // Android `View`; anything else (incl. a view-less body) can't be boxed, so return null.
        if (view !is View) return null
        val target = view
        // getLocationOnScreen is the Android equivalent of UIKit convert(bounds, to: root): take both
        // the target's and the host's screen origins and express the target's box in host-local px.
        val targetLoc = IntArray(2)
        val hostLoc = IntArray(2)
        target.getLocationOnScreen(targetLoc)
        this.view.getLocationOnScreen(hostLoc)
        val left = (targetLoc[0] - hostLoc[0]).toFloat()
        val top = (targetLoc[1] - hostLoc[1]).toFloat()
        val w = target.width.toFloat()
        val h = target.height.toFloat()
        val cx = left + w / 2f
        val cy = top + h / 2f
        return Box(
            center = Vec3(cx, cy, 0f),
            halfExtents = Vec3(w / 2f, h / 2f, 0f),
        )
    }
}
