import Foundation

// MARK: - Canonical force colors (forces.config.ts FORCES catalog)
//
// The nine designed forces each carry a canon color — the identity the JS config
// assigns them (chips, spark tints, lab swatches). Ported verbatim; the natural and
// extended sets have no canon colors (presentation layers choose their own).

public let CANONICAL_FORCE_COLORS: [String: String] = [
    "attract":   "#4da3ff",
    "jet":       "#a78bfa",
    "tether":    "#86e57f",
    "wall":      "#c4b5fd",
    "stream":    "#7dd3fc",
    "repel":     "#ff9d5c",
    "viscosity": "#8da2c0",
    "swirl":     "#2dd4bf",
    "sink":      "#ff6e9c",
]

/// The canon color for a force token, or nil for tokens outside the canonical nine.
public func canonicalForceColor(_ token: String) -> String? {
    CANONICAL_FORCE_COLORS[token]
}
