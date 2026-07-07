//! Canonical force colours — mirrors the `FORCES` catalog in `packages/core/src/config/forces.config.ts`
//! (and the Swift `CANONICAL_FORCE_COLORS`).
//!
//! The nine designed forces each carry a canon colour — the identity the config assigns them (chips,
//! spark tints, lab swatches). Ported verbatim; the natural and extended sets have no canon colours
//! (presentation layers choose their own).

/// `(token, "#rrggbb")` for each of the canonical nine, in spec order.
pub const CANONICAL_FORCE_COLORS: &[(&str, &str)] = &[
    ("attract", "#4da3ff"),
    ("jet", "#a78bfa"),
    ("tether", "#86e57f"),
    ("wall", "#c4b5fd"),
    ("stream", "#7dd3fc"),
    ("repel", "#ff9d5c"),
    ("viscosity", "#8da2c0"),
    ("swirl", "#2dd4bf"),
    ("sink", "#ff6e9c"),
];

/// The canon colour for a force token, or `None` for tokens outside the canonical nine.
pub fn canonical_force_color(token: &str) -> Option<&'static str> {
    CANONICAL_FORCE_COLORS
        .iter()
        .find(|(t, _)| *t == token)
        .map(|(_, c)| *c)
}
