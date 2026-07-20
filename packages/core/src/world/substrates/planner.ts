/**
 * Conformance-corpus substrate: a best-first search planner (EXPERIMENTAL, internal).
 *
 * Written from search semantics, with the API a planner library would naturally have — a weighted
 * graph, a frontier, an explored set, one expansion per step, and a plan extracted at the end. It has
 * NO knowledge of `DynamicsContract`; per the corpus protocol it is committed before its adapter exists
 * and may not be edited to make that adapter cleaner.
 *
 * Its role in the corpus is the **falsification candidate**, for two reasons:
 *
 *   1. It is the first corpus substrate that FINISHES. The field simulates indefinitely and the governor
 *      consumes frames indefinitely; neither ever reaches a state where asking for another transition is
 *      meaningless. A search does: the frontier empties, or the goal is found.
 *   2. Its transition law is only PARTIALLY declarable. Expansion order and edge costs are a table; the
 *      `euclidean` heuristic is computed in code and cannot be written down as rules.
 *
 * Determinism is exact: the frontier is ordered by (priority, node id), so ties break by name rather
 * than by insertion accident. No clock, no RNG.
 */

export interface PlannerNode {
  readonly id: string;
  readonly x?: number;
  readonly y?: number;
}

export interface PlannerEdge {
  readonly from: string;
  readonly to: string;
  readonly cost: number;
}

/**
 * A closed union — no callbacks. `zero` and `table` are expressible as data; `euclidean` is computed
 * from coordinates in code and is NOT expressible as a rule table. That asymmetry is deliberate: it is
 * what makes this substrate's law genuinely partial rather than merely large.
 */
export type PlannerHeuristic =
  | { readonly kind: 'zero' }
  | { readonly kind: 'table'; readonly values: Readonly<Record<string, number>> }
  | { readonly kind: 'euclidean' };

export interface PlannerProblem {
  readonly id: string;
  readonly nodes: readonly PlannerNode[];
  readonly edges: readonly PlannerEdge[];
  readonly start: string;
  readonly goal: string;
  readonly heuristic: PlannerHeuristic;
}

export interface FrontierEntry {
  readonly node: string;
  readonly cost: number;
  readonly priority: number;
}

/** `searching` is not a resting state — it means work remains. The other two are terminal. */
export type PlannerStatus = 'searching' | 'goal-reached' | 'exhausted';

export interface PlannerState {
  readonly frontier: readonly FrontierEntry[];
  readonly explored: readonly string[];
  readonly cameFrom: Readonly<Record<string, string>>;
  readonly costSoFar: Readonly<Record<string, number>>;
  readonly status: PlannerStatus;
  readonly expansions: number;
}

export interface PlannerStep {
  readonly state: PlannerState;
  /** The node expanded this step, absent when the search was already finished. */
  readonly expanded?: string;
  readonly status: PlannerStatus;
}

export function isTerminal(status: PlannerStatus): boolean {
  return status === 'goal-reached' || status === 'exhausted';
}

function heuristicFor(problem: PlannerProblem, node: string): number {
  const h = problem.heuristic;
  if (h.kind === 'zero') return 0;
  if (h.kind === 'table') return h.values[node] ?? 0;
  // euclidean: computed, not declarable
  const from = problem.nodes.find((n) => n.id === node);
  const goal = problem.nodes.find((n) => n.id === problem.goal);
  if (!from || !goal || from.x === undefined || from.y === undefined || goal.x === undefined || goal.y === undefined) return 0;
  return Math.hypot(goal.x - from.x, goal.y - from.y);
}

/** Deterministic ordering: cheapest priority first, node id as the tie-break. */
function ordered(entries: readonly FrontierEntry[]): FrontierEntry[] {
  return [...entries].sort((a, b) => (a.priority - b.priority) || a.node.localeCompare(b.node));
}

export function initialPlannerState(problem: PlannerProblem): PlannerState {
  const start = problem.start;
  return {
    frontier: [{ node: start, cost: 0, priority: heuristicFor(problem, start) }],
    explored: [],
    cameFrom: {},
    costSoFar: { [start]: 0 },
    status: problem.start === problem.goal ? 'goal-reached' : 'searching',
    expansions: 0,
  };
}

export function isPlannerState(v: unknown): v is PlannerState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    Array.isArray(s.frontier) &&
    Array.isArray(s.explored) &&
    typeof s.expansions === 'number' &&
    (s.status === 'searching' || s.status === 'goal-reached' || s.status === 'exhausted')
  );
}

/**
 * Expand exactly one node. Asking a finished search to expand is not an error and not progress — the
 * state is returned unchanged with its terminal status, and no node is reported as expanded.
 */
export function expandPlanner(problem: PlannerProblem, state: PlannerState): PlannerStep {
  if (isTerminal(state.status)) {
    return { state, status: state.status };
  }

  const queue = ordered(state.frontier);
  const head = queue[0];
  if (!head) {
    const exhausted: PlannerState = { ...state, status: 'exhausted' };
    return { state: exhausted, status: 'exhausted' };
  }

  const rest = queue.slice(1);
  if (head.node === problem.goal) {
    const reached: PlannerState = { ...state, frontier: rest, status: 'goal-reached', expansions: state.expansions + 1 };
    return { state: reached, expanded: head.node, status: 'goal-reached' };
  }

  const cameFrom: Record<string, string> = { ...state.cameFrom };
  const costSoFar: Record<string, number> = { ...state.costSoFar };
  const frontier: FrontierEntry[] = [...rest];

  for (const edge of problem.edges.filter((e) => e.from === head.node)) {
    const next = head.cost + edge.cost;
    const known = costSoFar[edge.to];
    if (known === undefined || next < known) {
      costSoFar[edge.to] = next;
      cameFrom[edge.to] = head.node;
      frontier.push({ node: edge.to, cost: next, priority: next + heuristicFor(problem, edge.to) });
    }
  }

  const explored = [...state.explored, head.node];
  const status: PlannerStatus = frontier.length === 0 ? 'exhausted' : 'searching';
  return {
    state: { frontier: ordered(frontier), explored, cameFrom, costSoFar, status, expansions: state.expansions + 1 },
    expanded: head.node,
    status,
  };
}

/** The plan, once the goal was reached. `undefined` while searching or when exhausted. */
export function extractPlan(problem: PlannerProblem, state: PlannerState): readonly string[] | undefined {
  if (state.status !== 'goal-reached') return undefined;
  const path: string[] = [problem.goal];
  let cursor = problem.goal;
  while (cursor !== problem.start) {
    const prev = state.cameFrom[cursor];
    if (prev === undefined) return undefined;
    path.unshift(prev);
    cursor = prev;
  }
  return path;
}
