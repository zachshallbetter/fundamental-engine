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

    override val isHidden: Boolean
        get() = view.visibility != View.VISIBLE || view.windowVisibility != View.VISIBLE

    // ── FieldHost — loop ────────────────────────────────────────────────────────────────────────

    override fun scheduleFrame(callback: (Double) -> Unit): Any {
        // Choreographer is the Android display-sync seam (CADisplayLink equivalent). frameTimeNanos is
        // converted to milliseconds-as-Double to match the contract's timestamp units.
        val frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
            callback(frameTimeNanos / 1_000_000.0)
        }
        choreographer.postFrameCallback(frameCallback)
        return frameCallback
    }

    override fun cancelFrame(token: Any) {
        (token as? Choreographer.FrameCallback)?.let { choreographer.removeFrameCallback(it) }
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
        // Window attach/detach is the closest analog to UIKit's app active/background notifications:
        // it is the moment the field should re-evaluate whether it is on screen.
        val listener = object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) = callback()
            override fun onViewDetachedFromWindow(v: View) = callback()
        }
        view.addOnAttachStateChangeListener(listener)
        return { view.removeOnAttachStateChangeListener(listener) }
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
