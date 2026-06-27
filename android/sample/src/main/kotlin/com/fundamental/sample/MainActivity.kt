package com.fundamental.sample

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.fundamental.compose.FieldView
import com.fundamental.compose.fieldBody

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { Demo() }
    }
}

@Composable
private fun Demo() {
    Box(Modifier.fillMaxSize().background(Color(0xFF0A0A12))) {
        // A live field. Tap anywhere to burst matter.
        FieldView(modifier = Modifier.fillMaxSize(), particleCount = 600) {
            // A centered attractor: this box IS a body — its well gathers the field, and the field's
            // gathered density bends back. Mirrors `.fieldBody(...)` on Swift / React.
            Box(
                Modifier
                    .align(Alignment.Center)
                    .size(140.dp)
                    .fieldBody(tokens = listOf("attract", "swirl"), strength = 2.6f, range = 560f, spin = 1.3f),
            )
        }
    }
}
