package com.fundamental.core.engine

// Runtime FIELD POLICY + budgets — the Kotlin mirror of JS #892. What THIS host/session/user/app
// PERMITS, evaluated live — a distinct lane from GOVERNANCE (what doctrine allows, a static lint).
// Policy can only TIGHTEN, never loosen: reduced-motion always wins and clamps motion to 0; a policy can
// lower the motion budget but never raise it above what reduced-motion allows. Purely additive — a field
// with no policy behaves exactly as before.

/**
 * Consumable field-resource budgets — upper bounds on what the field is PERMITTED to spend. Each is
 * optional (null ⇒ unbounded / engine default). Values are normalized `0..1`.
 *
 * WIRED today: [motion] (folds into the effective motion allowance alongside reduced-motion) and
 * [privacy] (gates body data exposure). The rest are DECLARED-not-yet-enforced — carried on the policy
 * for host/tooling introspection, wired as their consumers land.
 */
data class FieldBudgets(
    /** WIRED. `0..1` cap on how much motion the field may express; `0` behaves as reduced-motion (frozen). */
    val motion: Float? = null,
    /** DECLARED. `0..1` cap on applied force magnitude. */
    val force: Float? = null,
    /** DECLARED. `0..1` cap on conserved-attention spend (§2.4). */
    val attention: Float? = null,
    /** DECLARED. `0..1` cap on thermal/heat accumulation. */
    val thermal: Float? = null,
    /** DECLARED. `0..1` cap on render cost. */
    val render: Float? = null,
    /** WIRED. `0..1` privacy budget; below [PRIVACY_DATA_THRESHOLD] body data is withheld. */
    val privacy: Float? = null,
    /** DECLARED. `0..1` accessibility floor — minimum non-motion legibility. */
    val accessibility: Float? = null,
    /** DECLARED. `0..1` cap on how much field state agent readers may consume. */
    val agentRead: Float? = null,
) {
    companion object {
        /** Privacy budget floor: below this, body data is withheld even when a caller opts in. */
        const val PRIVACY_DATA_THRESHOLD: Float = 0.5f
    }
}

/**
 * Runtime FIELD POLICY (JS #892). Set at creation and live via [com.fundamental.core.runtime.FieldController.setPolicy];
 * read via `policy`. Can only tighten the accessibility floor (reduced-motion always wins; a policy can
 * lower motion but never raise it above what reduced-motion allows). Purely additive.
 */
data class FieldPolicy(
    /** permit body data to be exposed in read-outs (default: allowed unless a privacy budget tightens it). */
    val allowBodyDataInSnapshots: Boolean? = null,
    /** permit motion-expressing projections/animation at all; `false` pins the effective motion budget to 0. */
    val allowMotionProjection: Boolean? = null,
    /** `0..1` host/session cap on motion; folded (via `min`) with reduced-motion into the effective
     *  motion allowance. Reduced-motion can only lower it. */
    val maxMotionBudget: Float? = null,
    /** consumable-resource budgets (see [FieldBudgets]). */
    val budgets: FieldBudgets? = null,
) {
    companion object {
        /** The unbounded default — byte-identical to the pre-policy engine. */
        val UNBOUNDED = FieldPolicy()
    }
}

/**
 * The effective motion allowance `0..1` (JS #892 `effectiveMotion`). Unifies reduced-motion + policy.
 * Reduced-motion ALWAYS wins — accessibility can only lower motion, never raise it: when [reducedMotion]
 * is true this is 0. `allowMotionProjection == false` also pins it to 0. Otherwise the smallest of
 * [FieldPolicy.maxMotionBudget] and [FieldBudgets.motion] applies, clamped to `0..1`.
 */
fun effectiveMotion(policy: FieldPolicy, reducedMotion: Boolean): Float {
    if (reducedMotion) return 0f // accessibility clamp — beats any policy
    if (policy.allowMotionProjection == false) return 0f // policy pins motion off
    var m = 1f
    policy.maxMotionBudget?.let { m = minOf(m, it) }
    policy.budgets?.motion?.let { m = minOf(m, it) }
    return m.coerceIn(0f, 1f)
}

/**
 * Whether the policy permits body data to be exposed (JS #892 `policyPermitsBodyData`). Policy TIGHTENS:
 * an explicit `allowBodyDataInSnapshots == false` deny wins, and a privacy budget below
 * [FieldBudgets.PRIVACY_DATA_THRESHOLD] withholds data even when a caller opts in. Default: permit
 * (the call site decides).
 */
fun policyPermitsBodyData(policy: FieldPolicy): Boolean {
    if (policy.allowBodyDataInSnapshots == false) return false // explicit deny wins
    val pv = policy.budgets?.privacy
    if (pv != null && pv < FieldBudgets.PRIVACY_DATA_THRESHOLD) return false // low privacy budget → withhold
    return true
}
