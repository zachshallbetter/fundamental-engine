import Foundation

// MARK: - FieldBudgets (substrate — JS #892)

/// Consumable field-resource budgets — upper bounds a host/session/user/app sets on what the field is
/// PERMITTED to spend, distinct from what doctrine *allows* (that is governance — static lint). Each is
/// optional (`nil` = unbounded / engine default). Values are normalized `0..1` unless the one-line note
/// says otherwise. Carried on ``FieldPolicy/budgets``. Mirrors the JS `FieldBudgets`.
///
/// WIRED today: `motion` (folds into the effective motion allowance alongside reduced-motion). `privacy`
/// is WIRED in JS to gate body `data` in snapshots — inert here until the Swift snapshot surface lands
/// (`policyPermitsBodyData` is exposed so it activates the moment snapshots exist). The rest are
/// DECLARED-not-yet-enforced — accepted and carried on the policy for host/tooling introspection.
public struct FieldBudgets: Sendable, Equatable {
    /// WIRED. `0..1` cap on how much motion the field may express; `0` behaves as reduced-motion (frozen).
    public var motion: Float?
    /// DECLARED. `0..1` cap on applied force magnitude — the share of the impulse budget matter may absorb.
    public var force: Float?
    /// DECLARED. `0..1` cap on conserved-attention spend (§2.4) — the finite focus budget.
    public var attention: Float?
    /// DECLARED. `0..1` cap on thermal/heat accumulation the field may carry.
    public var thermal: Float?
    /// DECLARED. `0..1` cap on render cost the field may spend (draw layers / fill).
    public var render: Float?
    /// WIRED (JS) / DECLARED here until snapshots land. `0..1` privacy budget; below the
    /// `privacyDataThreshold` (0.5) snapshots withhold body `data`.
    public var privacy: Float?
    /// DECLARED. `0..1` accessibility floor — the minimum non-motion legibility the field must preserve.
    public var accessibility: Float?
    /// DECLARED. `0..1` cap on how much field state agent readers may consume.
    public var agentRead: Float?

    public init(motion: Float? = nil, force: Float? = nil, attention: Float? = nil,
                thermal: Float? = nil, render: Float? = nil, privacy: Float? = nil,
                accessibility: Float? = nil, agentRead: Float? = nil) {
        self.motion = motion
        self.force = force
        self.attention = attention
        self.thermal = thermal
        self.render = render
        self.privacy = privacy
        self.accessibility = accessibility
        self.agentRead = agentRead
    }
}

// MARK: - FieldPolicy (substrate — JS #892)

/// Runtime FIELD POLICY — what THIS host / session / user / app PERMITS, evaluated live. Distinct lane
/// from GOVERNANCE (what doctrine allows — static lint): policy can only tighten, never loosen, the
/// accessibility floor. Reduced-motion always wins; a policy can lower motion but never raise it above
/// what the host/user reduced-motion state allows. Set at creation via ``FieldOptions/policy`` and live
/// via `FieldHandle.setPolicy`; read via `FieldHandle.policy`. Purely additive — a field with no policy
/// behaves exactly as before. Mirrors the JS `FieldPolicy`.
public struct FieldPolicy: Sendable, Equatable {
    /// Permit body `data` to appear in snapshots (default: fall through to the snapshot call's request).
    public var allowBodyDataInSnapshots: Bool?
    /// Permit motion-expressing projections/animation at all; `false` pins the effective motion budget to 0.
    public var allowMotionProjection: Bool?
    /// `0..1` host/session cap on motion; folded (via `min`) with reduced-motion into the effective
    /// motion allowance the integrator/easing path reads. Reduced-motion can only lower it.
    public var maxMotionBudget: Float?
    /// Consumable-resource budgets (see ``FieldBudgets``).
    public var budgets: FieldBudgets?

    public init(allowBodyDataInSnapshots: Bool? = nil, allowMotionProjection: Bool? = nil,
                maxMotionBudget: Float? = nil, budgets: FieldBudgets? = nil) {
        self.allowBodyDataInSnapshots = allowBodyDataInSnapshots
        self.allowMotionProjection = allowMotionProjection
        self.maxMotionBudget = maxMotionBudget
        self.budgets = budgets
    }
}
