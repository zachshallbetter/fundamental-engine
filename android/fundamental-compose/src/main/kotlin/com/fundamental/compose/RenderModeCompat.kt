package com.fundamental.compose

// Migration shim for #1158 — the Compose host used to declare its OWN four-case `RenderMode`
// (DOTS, TRAILS, LINKS, GLOW), a second type of the same name as the engine's seven-case
// `com.fundamental.core.runtime.RenderMode`. Two same-named enums in one artifact set meant
// `RenderMode.DOTS` resolved to different types depending on the import, and three engine modes
// (METABALLS, VORONOI, STREAMLINES) could not be expressed from a Compose app at all.
//
// `FieldView` now takes the engine's enum, and this alias keeps existing source compiling:
// `com.fundamental.compose.RenderMode.DOTS` / `.TRAILS` / `.LINKS` still resolve — to the engine's
// members, the same treatments they always named.
//
// GLOW is the one member that does NOT carry over: it existed on no other plane, had no entry in the
// cross-plane render vocabulary and no conformance coverage, so it cannot be a member of the engine
// enum. Its treatment is not lost — it is the soft additive bloom `particleGlow` already applies to
// the DOTS mode. See the deprecation message for the migration, and the CHANGELOG for why promoting
// `glow` to the shared vocabulary is a maintainer decision (a three-plane change), not a host one.

@Deprecated(
    message =
        "The Compose host no longer declares its own RenderMode; FieldView takes the engine's " +
            "com.fundamental.core.runtime.RenderMode (DOTS, TRAILS, LINKS, METABALLS, VORONOI, " +
            "STREAMLINES, NONE). DOTS/TRAILS/LINKS carry over unchanged. GLOW has no cross-plane " +
            "definition and is gone: use RenderMode.DOTS with particleGlow = 1f for the same soft " +
            "additive bloom. (#1158)",
    replaceWith = ReplaceWith("RenderMode", "com.fundamental.core.runtime.RenderMode"),
    level = DeprecationLevel.WARNING,
)
typealias RenderMode = com.fundamental.core.runtime.RenderMode
