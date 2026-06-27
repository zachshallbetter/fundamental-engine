package com.fundamental.compose

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInParent
import com.fundamental.core.engine.Body
import com.fundamental.core.math.Vec3
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

/** Provides the running [FieldController] to descendants so [Modifier.fieldBody] can attach. */
val LocalFieldController = compositionLocalOf<FieldController?> { null }

@Composable
fun FieldView(
    modifier: Modifier = Modifier,
    accent: Color = Color(0xFF4DA3FF),
    particleCount: Int = 300,
    content: @Composable () -> Unit = {},
) {
    var controller by remember { mutableStateOf<FieldController?>(null) }
    var frame by remember { mutableIntStateOf(0) }
    val cool = Color(0xFFFFE0C8) // resting (warm-default identity), matches the engine palette

    Box(
        modifier = modifier.onSizeChanged { size ->
            if (size.width == 0 || size.height == 0) return@onSizeChanged
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
            for (p in c.particles) {
                val heat = p.heat.coerceIn(0f, 1f)
                val r = 1.5f + p.size * 1.5f + heat * 3f
                drawCircle(
                    color = lerp(cool, accent, heat),
                    radius = r,
                    center = Offset(p.position.x, p.position.y),
                    alpha = 0.85f,
                )
            }
        }

        val c = controller
        if (c != null) {
            LaunchedEffect(c) {
                while (true) {
                    withFrameNanos { c.tick() }
                    frame++
                }
            }
            CompositionLocalProvider(LocalFieldController provides c) { content() }
        }
    }
}

/**
 * Make this composable a force source in the surrounding [FieldView]. The body's well tracks the
 * element's on-screen bounds each layout. Mirrors SwiftUI `.fieldBody(...)` / React `useFieldBody`.
 * A no-op when not inside a [FieldView].
 */
@Composable
fun Modifier.fieldBody(
    tokens: List<String>,
    strength: Float = 1f,
    range: Float = 150f,
    spin: Float = 1f,
): Modifier {
    val controller = LocalFieldController.current ?: return this
    val body = remember { Body(tokens = tokens, strength = strength, range = range, spin = spin) }
    DisposableEffect(controller) {
        controller.addBody(body)
        onDispose { controller.removeBody(body) }
    }
    return this.onGloballyPositioned { coords ->
        val pos = coords.positionInParent()
        val w = coords.size.width.toFloat()
        val h = coords.size.height.toFloat()
        body.box = FieldBox(
            center = Vec3(pos.x + w / 2f, pos.y + h / 2f, 0f),
            halfExtents = Vec3(w / 2f, h / 2f, 0f),
        )
    }
}
