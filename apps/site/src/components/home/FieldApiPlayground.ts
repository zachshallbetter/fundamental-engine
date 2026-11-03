import type { BodyHandle, EdgeHandle, FieldChannelHandle, FieldHandle, FieldSnapshot } from "@fundamental-engine/core";

type FieldElement = HTMLElement & {
  handle?: FieldHandle;
  setFormation?: (name: string) => void;
  setRender?: (mode: string) => void;
  setOverlay?: (mode: string | string[]) => void;
  setAccent?: (color: string) => void;
  setPalette?: (palette: string) => void;
  setHeatmap?: (on: boolean) => void;
  setBackground?: (mode: "opaque" | "transparent") => void;
  setAttention?: (on: boolean) => void;
  setCausality?: (on: boolean) => void;
  setDprCap?: (cap: number) => void;
  setVisible?: (on: boolean) => void;
  setWaveStyle?: (style: "linear" | "circular") => void;
  setWaveCenter?: (center: { x: number; y: number } | null) => void;
  setSeparation?: (strength: number) => void;
  flowTo?: (x: number, y: number, options?: { strength?: number; radius?: number }) => void;
  clearFlow?: () => void;
  burst?: (x: number, y: number, color?: string) => void;
  rescan?: () => void;
};

const CONFIG_ATTRS = ["render", "overlay", "accent", "palette", "formation", "heatmap", "background", "attention", "causality", "dpr-cap", "wave-style", "wave-center", "separation"] as const;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const json = (value: unknown, cap = 8500) => {
  const text = JSON.stringify(value ?? null, null, 2);
  return text.length > cap ? `${text.slice(0, cap)}\n… output shortened` : text;
};

export function initFieldApiPlayground(): () => void {
  const root = document.querySelector<HTMLElement>("[data-api-playground]");
  const field = document.querySelector<FieldElement>("field-root");
  if (!root || !field) return () => {};

  const ac = new AbortController();
  const signal = ac.signal;
  const out = root.querySelector<HTMLElement>("[data-api-output]");
  const motionStatus = root.querySelector<HTMLElement>("[data-api-motion-status]");
  const hostStatus = root.querySelector<HTMLElement>("[data-api-host-status]");
  const edgeStatus = root.querySelector<HTMLElement>("[data-api-edge-status]");
  const body = root.querySelector<HTMLElement>("[data-api-shape-body]");
  const bodyState = root.querySelector<HTMLElement>("[data-api-body-state]");
  const objectA = root.querySelector<HTMLElement>('[data-api-object="source"]');
  const objectB = root.querySelector<HTMLElement>('[data-api-object="target"]');
  let active = false;
  let flowing = false;
  let waveCentered = false;
  let terrainEnabled = false;
  let threadEnabled = false;
  let activePinned = false;
  let configBefore: Map<string, string | null> | undefined;
  let snapshotA: FieldSnapshot | undefined;
  let terrain: FieldChannelHandle | undefined;
  let hostA: BodyHandle | undefined;
  let hostB: BodyHandle | undefined;
  let edge: EdgeHandle | undefined;
  let lastPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  const say = (target: HTMLElement | null, message: string) => { if (target) target.textContent = message; };
  const write = (value: unknown) => { if (out) out.textContent = json(value); };
  const captureConfig = () => new Map(CONFIG_ATTRS.map((name) => [name, field.getAttribute(name)]));
  const restoreConfig = () => {
    if (!configBefore) return;
    for (const [name, value] of configBefore) {
      if (value == null) field.removeAttribute(name);
      else field.setAttribute(name, value);
    }
    // The browser host's QualityGovernor owns setQualityTier() and exposes no read-back value;
    // this lesson leaves that write-only policy to the automatic governor.
    field.setVisible?.(true);
    configBefore = undefined;
  };
  const syncControls = () => {
    root.querySelector<HTMLSelectElement>("[data-api-render]")!.value = field.getAttribute("render") || "dots";
    const overlays = new Set((field.getAttribute("overlay") || "").split(/\s+/).filter(Boolean));
    root.querySelectorAll<HTMLInputElement>("[data-api-overlay]").forEach((input) => { input.checked = overlays.has(input.value); });
    root.querySelector<HTMLInputElement>("[data-api-accent]")!.value = field.getAttribute("accent") || "#4da3ff";
    root.querySelector<HTMLSelectElement>("[data-api-palette]")!.value = field.getAttribute("palette") || "ours";
    root.querySelector<HTMLInputElement>("[data-api-heatmap]")!.checked = field.hasAttribute("heatmap") && field.getAttribute("heatmap") !== "false";
    root.querySelector<HTMLInputElement>("[data-api-transparent]")!.checked = field.getAttribute("background") === "transparent";
    root.querySelector<HTMLInputElement>("[data-api-attention]")!.checked = field.hasAttribute("attention") && field.getAttribute("attention") !== "false";
    root.querySelector<HTMLInputElement>("[data-api-causality]")!.checked = field.hasAttribute("causality") && field.getAttribute("causality") !== "false";
    root.querySelector<HTMLSelectElement>("[data-api-formation]")!.value = field.getAttribute("formation") || "ambient";
    root.querySelector<HTMLSelectElement>("[data-api-wave-style]")!.value = field.getAttribute("wave-style") || "linear";
    root.querySelector<HTMLInputElement>("[data-api-separation]")!.value = field.getAttribute("separation") || "0";
    root.querySelector<HTMLOutputElement>("[data-api-separation-value]")!.value = field.getAttribute("separation") || "0";
    root.querySelector<HTMLSelectElement>("[data-api-dpr]")!.value = field.getAttribute("dpr-cap") || "2";
  };
  const setMode = (mode: string) => {
    field.setRender?.(mode);
    root.dataset.apiCurrentRender = mode;
  };
  const setOverlays = () => {
    const selected = [...root.querySelectorAll<HTMLInputElement>("[data-api-overlay]:checked")].map((input) => input.value);
    field.setOverlay?.(selected.length ? selected : "off");
  };
  const atPointer = (event: MouseEvent | PointerEvent) => {
    if (event.detail === 0 && event.target instanceof Element) {
      const rect = event.target.getBoundingClientRect();
      lastPoint = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    } else {
      lastPoint = { x: event.clientX, y: event.clientY };
    }
    return lastPoint;
  };
  const onPointerMove = (event: PointerEvent) => {
    lastPoint = { x: event.clientX, y: event.clientY };
    if (flowing) field.flowTo?.(event.clientX, event.clientY, { strength: 1.1, radius: 420 });
  };

  const applyBody = () => {
    if (!body) return;
    const force = root.querySelector<HTMLSelectElement>("[data-api-body-force]")?.value || "swirl";
    const strength = Number(root.querySelector<HTMLInputElement>("[data-api-strength]")?.value || 0.8);
    const color = root.querySelector<HTMLInputElement>("[data-api-body-color]")?.value || "#2dd4bf";
    const when = root.querySelector<HTMLSelectElement>("[data-api-when]")?.value || "";
    const potential = root.querySelector<HTMLSelectElement>("[data-api-potential]")?.value || "height";
    const height = Number(root.querySelector<HTMLInputElement>("[data-api-body-height]")?.value || 88);
    const tokens = force === "relief" ? "relief pigment" : `${force} pigment`;
    const needsScan = body.getAttribute("data-body") !== tokens || body.getAttribute("data-when") !== when || body.getAttribute("data-potential") !== potential;
    body.setAttribute("data-body", tokens);
    body.setAttribute("data-strength", String(strength));
    body.setAttribute("data-range", force === "relief" ? "0" : "360");
    body.setAttribute("data-color", color);
    body.setAttribute("data-potential", potential);
    if (when) body.setAttribute("data-when", when);
    else body.removeAttribute("data-when");
    if (activePinned || body.matches(":focus-within")) body.setAttribute("data-active", "1");
    else body.removeAttribute("data-active");
    root.style.setProperty("--api-body-color", color);
    body.style.setProperty("--api-body-height", `${height}px`);
    if (bodyState) bodyState.textContent = `${force}${when ? ` ?${when}` : ""} · strength ${strength.toFixed(1)} · ${color}`;
    if (needsScan) field.rescan?.();
  };

  const addHostBodies = () => {
    const handle = field.handle;
    if (!handle || !objectA || !objectB || hostA || hostB) return;
    const rect = (element: HTMLElement) => () => {
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    hostA = handle.addBody({
      identity: { id: "homepage-study-plan", namespace: "homepage-api-demo", kind: "record", host: "DOM projection" },
      tokens: "attract swirl pigment", strength: 0.38, range: 220, spin: 1.1, color: "#52d8ff",
      rect: rect(objectA), data: { id: "study-plan", label: "Study plan" },
    });
    hostB = handle.addBody({
      identity: { id: "homepage-practice-session", namespace: "homepage-api-demo", kind: "record", host: "DOM projection" },
      tokens: "attract swirl pigment", strength: 0.34, range: 220, spin: 1.1, color: "#bd8cff",
      rect: rect(objectB), data: { id: "practice-session", label: "Practice session" },
    });
    edge = handle.addEdge(hostA, hostB, { type: "supports", strength: 0.62, direction: "bidirectional" });
    say(edgeStatus, "Two anchored host bodies and one bidirectional supports edge are live in the shared field.");
  };
  const removeHostBodies = () => {
    edge?.remove(); edge = undefined;
    hostA?.remove(); hostA = undefined;
    hostB?.remove(); hostB = undefined;
  };

  root.addEventListener("pointermove", onPointerMove, { passive: true, signal });
  root.querySelector<HTMLButtonElement>("[data-api-flow]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    flowing = !flowing;
    button.setAttribute("aria-pressed", String(flowing));
    button.textContent = flowing ? "Stop pointer flow" : "Follow pointer";
    if (flowing) field.flowTo?.(lastPoint.x, lastPoint.y, { strength: 1.1, radius: 420 });
    else field.clearFlow?.();
    say(motionStatus, flowing ? "flowTo() is moving with your pointer; the existing particles are responding." : "Pointer flow cleared; the field is responding to its declared bodies again.");
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-burst]")?.addEventListener("click", (event) => {
    const point = atPointer(event as MouseEvent);
    field.burst?.(point.x, point.y, "#52d8ff");
    say(motionStatus, "burst() applied a one-shot shove and heat near this button to existing particles.");
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-wave]")?.addEventListener("click", (event) => {
    const point = atPointer(event as MouseEvent);
    field.setWaveCenter?.(point);
    waveCentered = true;
    say(motionStatus, "The wave center is now host-set to this button’s viewport point.");
  }, { signal });
  root.querySelector<HTMLSelectElement>("[data-api-formation]")?.addEventListener("change", (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    field.setFormation?.(value);
    say(motionStatus, `setFormation('${value}') changed the global organization of existing matter.`);
  }, { signal });
  root.querySelector<HTMLInputElement>("[data-api-separation]")?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    field.setSeparation?.(Number(input.value));
    const value = root.querySelector<HTMLOutputElement>("[data-api-separation-value]");
    if (value) value.value = input.value;
    say(motionStatus, `setSeparation(${input.value}) changed particle-to-particle spacing.`);
  }, { signal });
  root.querySelector<HTMLSelectElement>("[data-api-wave-style]")?.addEventListener("change", (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value as "linear" | "circular";
    field.setWaveStyle?.(value);
    say(motionStatus, `setWaveStyle('${value}') changed the wave layout.`);
  }, { signal });

  const activeButton = root.querySelector<HTMLButtonElement>("[data-api-active]");
  const setActive = (on: boolean) => {
    activePinned = on;
    activeButton?.setAttribute("aria-pressed", String(on));
    if (activeButton) activeButton.textContent = on ? "Deactivate body condition" : "Activate body condition";
    applyBody();
    say(motionStatus, on ? "data-active is authored on the shaped body; an active gate can now apply." : "The manual active state is cleared; keyboard focus can still satisfy the active gate.");
  };
  activeButton?.addEventListener("click", () => setActive(!activePinned), { signal });
  body?.addEventListener("focusin", () => applyBody(), { signal });
  body?.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && body.contains(event.relatedTarget)) return;
    window.setTimeout(() => { if (body.isConnected) applyBody(); }, 0);
  }, { signal });

  root.querySelector<HTMLSelectElement>("[data-api-render]")?.addEventListener("change", (event) => setMode((event.currentTarget as HTMLSelectElement).value), { signal });
  root.querySelectorAll<HTMLInputElement>("[data-api-overlay]").forEach((input) => input.addEventListener("change", setOverlays, { signal }));
  root.querySelector<HTMLInputElement>("[data-api-accent]")?.addEventListener("input", (event) => field.setAccent?.((event.currentTarget as HTMLInputElement).value), { signal });
  root.querySelector<HTMLSelectElement>("[data-api-palette]")?.addEventListener("change", (event) => field.setPalette?.((event.currentTarget as HTMLSelectElement).value), { signal });
  root.querySelector<HTMLInputElement>("[data-api-heatmap]")?.addEventListener("change", (event) => field.setHeatmap?.((event.currentTarget as HTMLInputElement).checked), { signal });
  root.querySelector<HTMLInputElement>("[data-api-transparent]")?.addEventListener("change", (event) => field.setBackground?.((event.currentTarget as HTMLInputElement).checked ? "transparent" : "opaque"), { signal });
  root.querySelector<HTMLInputElement>("[data-api-attention]")?.addEventListener("change", (event) => field.setAttention?.((event.currentTarget as HTMLInputElement).checked), { signal });
  root.querySelector<HTMLInputElement>("[data-api-causality]")?.addEventListener("change", (event) => field.setCausality?.((event.currentTarget as HTMLInputElement).checked), { signal });
  root.querySelector<HTMLSelectElement>("[data-api-dpr]")?.addEventListener("change", (event) => field.setDprCap?.(Number((event.currentTarget as HTMLSelectElement).value)), { signal });
  root.querySelector<HTMLInputElement>("[data-api-visible]")?.addEventListener("change", (event) => field.setVisible?.(!(event.currentTarget as HTMLInputElement).checked), { signal });

  ["[data-api-body-force]", "[data-api-strength]", "[data-api-body-color]", "[data-api-when]", "[data-api-potential]"].forEach((selector) => {
    const control = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    control?.addEventListener(control instanceof HTMLSelectElement ? "change" : "input", applyBody, { signal });
  });
  root.querySelector<HTMLSelectElement>("[data-api-when]")?.addEventListener("change", (event) => {
    const condition = (event.currentTarget as HTMLSelectElement).value;
    const state = root.querySelector<HTMLElement>("[data-api-scroll-state]");
    if (condition === "scrolling") {
      say(state, `The scrolling gate reads scrollV() = ${(field.handle?.scrollV() ?? 0).toFixed(3)}; it becomes eligible while the host reports active scroll.`);
    } else if (condition === "active") {
      say(state, "Use the activation control or focus the shaped body to set its active state.");
    } else {
      say(state, condition ? `The ${condition} gate is evaluated against each particle’s live state.` : "No condition gate; the declared force is always eligible.");
    }
  }, { signal });
  root.querySelector<HTMLInputElement>("[data-api-strength]")?.addEventListener("input", (event) => {
    const value = root.querySelector<HTMLOutputElement>("[data-api-strength-value]");
    if (value) value.value = Number((event.currentTarget as HTMLInputElement).value).toFixed(1);
  }, { signal });
  root.querySelector<HTMLInputElement>("[data-api-body-height]")?.addEventListener("input", (event) => {
    const height = Number((event.currentTarget as HTMLInputElement).value);
    const value = root.querySelector<HTMLOutputElement>("[data-api-body-height-value]");
    if (value) value.value = `${height} px`;
    applyBody();
    say(motionStatus, `The shaped body now spans ${height} px; its whole measured bounds influence the existing particle field.`);
  }, { signal });

  root.querySelector<HTMLButtonElement>("[data-api-query]")?.addEventListener("click", () => {
    const reading = field.handle?.query({ at: lastPoint, radius: 240, include: ["bodies", "metrics", "relationships", "influences"] });
    write(reading ? { frame: reading.frame, region: reading.region, bodies: reading.bodies, metrics: reading.metrics, relationships: reading.relationships, influences: reading.influences.slice(0, 12), projections: reading.projections } : { error: "Field handle is not ready." });
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-particles]")?.addEventListener("click", () => {
    const handle = field.handle;
    if (!handle) return write({ error: "Field handle is not ready." });
    const cap = Math.min(handle.particleCount(), 16);
    const states = new Float32Array(cap * 5);
    const ids = new Uint32Array(cap);
    const channels = ["vx", "vy", "age", "charge"];
    const values = channels.map(() => new Float32Array(cap));
    const n = handle.readParticles(states);
    handle.readParticleIds(ids);
    handle.readParticleChannels(channels, values);
    write({ note: "Read-only sample of the existing pool; records remain host-owned.", poolSize: handle.particleCount(), shown: Math.min(n, cap), stride: ["x", "y", "z", "heat", "size"], particles: Array.from({ length: Math.min(n, cap) }, (_, i) => ({ id: ids[i], x: states[i * 5], y: states[i * 5 + 1], z: states[i * 5 + 2], heat: states[i * 5 + 3], size: states[i * 5 + 4], vx: values[0]?.[i], vy: values[1]?.[i], age: values[2]?.[i], charge: values[3]?.[i] })) });
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-sample]")?.addEventListener("click", (event) => {
    const point = atPointer(event as MouseEvent);
    const handle = field.handle;
    if (!handle) return write({ error: "Field handle is not ready." });
    const vector = handle.sample(point.x, point.y);
    const scalar = handle.sampleScalar(point.x, point.y);
    const gradient = handle.sampleGradient(point.x, point.y);
    const heatmapEnabled = root.querySelector<HTMLInputElement>("[data-api-heatmap]")?.checked ?? false;
    write({ point, forceVector: vector, densityScalar: scalar, densityGradient: gradient, heatmapEnabled, note: "sampleScalar() and sampleGradient() read the density heatmap; when it is disabled they return zero. Seeded record inspection is reserved for the Data lesson." });
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-energy]")?.addEventListener("click", () => write({ ...field.handle?.energy(), units: "relative simulation values; not joules", interpretation: "Compare readings from this field under the same host and settings." }), { signal });
  root.querySelector<HTMLButtonElement>("[data-api-agent]")?.addEventListener("click", () => {
    const view = field.handle?.forAgent({ capabilities: ["read:metrics"] });
    if (!view) return write({ error: "Field handle is not ready." });
    const reading = view.query();
    write({ capabilities: view.capabilities, bodyCount: reading.bodies.length, metricKeys: Object.keys(reading.metrics), relationshipsVisible: reading.relationships.length, influencesVisible: reading.influences.length, mutationSurface: "none" });
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-snapshot]")?.addEventListener("click", (event) => {
    snapshotA = field.handle?.snapshot({ includeInfluences: true, profile: "bug-report" });
    const button = event.currentTarget as HTMLButtonElement;
    if (button) button.textContent = snapshotA ? `Snapshot A · frame ${snapshotA.frame}` : "Capture snapshot A";
    const compare = root.querySelector<HTMLButtonElement>("[data-api-compare]");
    if (compare) compare.disabled = !snapshotA;
    write(snapshotA ? { id: snapshotA.id, version: snapshotA.version, frame: snapshotA.frame, formations: snapshotA.formations, bodies: snapshotA.bodies.length, relationships: snapshotA.relationships.length, note: "Public profile; body data and particle diagnostics omitted." } : { error: "Field handle is not ready." });
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-compare]")?.addEventListener("click", () => {
    const handle = field.handle;
    if (!handle || !snapshotA) return;
    const snapshotB = handle.snapshot({ includeInfluences: true, profile: "bug-report" });
    const diff = handle.diff(snapshotA, snapshotB);
    const replay = handle.replay(snapshotA, snapshotB);
    write({ from: diff.from, to: diff.to, diff: { bodyChanges: diff.bodyChanges, relationshipChanges: diff.relationshipChanges, metricChanges: diff.metricChanges, formationChanges: diff.formationChanges }, replay: { steps: replay.steps.slice(0, 24), totalSteps: replay.steps.length }, note: "Replay is a structured comparison of two captures, not a continuous timeline." });
  }, { signal });

  const registerTerrain = () => {
    if (!field.handle || terrain) return;
    const sampler = (x: number, y: number) => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const nx = (x / w) * 2 - 1;
      const ny = y / h;
      return clamp(0.5 + 0.28 * Math.sin(nx * Math.PI * 1.4) + 0.22 * ny, 0, 1);
    };
    terrain = field.handle.addField("tutorial-terrain", sampler);
    const target = body;
    if (target && root.querySelector<HTMLSelectElement>("[data-api-body-force]")?.value === "relief") {
      target.setAttribute("data-potential", "tutorial-terrain");
      field.rescan?.();
    }
    say(hostStatus, "tutorial-terrain is registered. It supplies a scalar potential only; relief uses its gradient when the body declares data-potential.");
  };
  root.querySelector<HTMLButtonElement>("[data-api-terrain]")?.addEventListener("click", (event) => {
    terrainEnabled = !terrainEnabled;
    const button = event.currentTarget as HTMLButtonElement;
    button.setAttribute("aria-pressed", String(terrainEnabled));
    button.textContent = terrainEnabled ? "Remove host terrain" : "Activate host terrain";
    if (terrainEnabled) {
      registerTerrain();
      if (body && root.querySelector<HTMLSelectElement>("[data-api-body-force]")?.value === "relief") {
        body.setAttribute("data-potential", "tutorial-terrain");
        field.rescan?.();
      }
    } else {
      terrain?.remove(); terrain = undefined;
      field.handle?.grid("homepage-tutorial").clear();
      if (body && body.getAttribute("data-potential") === "tutorial-terrain") body.setAttribute("data-potential", "height");
      field.rescan?.();
      say(hostStatus, "The host channel is removed; sampleField() returns zero and relief no longer has that potential.");
    }
  }, { signal });

  root.querySelector<HTMLButtonElement>("[data-api-deposit]")?.addEventListener("click", (event) => {
    const point = atPointer(event as MouseEvent);
    const liveGrid = field.handle?.grid("homepage-tutorial");
    liveGrid?.deposit(point.x, point.y, 0.7);
    const terrainValue = field.handle?.sampleField("tutorial-terrain", point.x, point.y) ?? 0;
    say(hostStatus, `Deposited 0.7 into the host grid at (${Math.round(point.x)}, ${Math.round(point.y)}); tutorial-terrain sample: ${terrainValue.toFixed(3)}.`);
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-grid-read]")?.addEventListener("click", (event) => {
    const point = atPointer(event as MouseEvent);
    const liveGrid = field.handle?.grid("homepage-tutorial");
    write({ point, grid: "homepage-tutorial", value: liveGrid?.sample(point.x, point.y) ?? 0, gradient: liveGrid?.gradient(point.x, point.y) ?? { x: 0, y: 0 }, note: "The grid stores host data; it affects forces only when a force is explicitly coupled to it." });
  }, { signal });

  window.addEventListener("scroll", () => {
    if (!active) return;
    const velocity = field.handle?.scrollV() ?? 0;
    const condition = root.querySelector<HTMLSelectElement>("[data-api-when]")?.value;
    const state = root.querySelector<HTMLElement>("[data-api-scroll-state]");
    if (condition === "scrolling") say(state, `The scrolling gate reads scrollV() = ${velocity.toFixed(3)}; it becomes eligible while the host reports active scroll.`);
  }, { passive: true, signal });

  root.querySelector<HTMLButtonElement>("[data-api-edge]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    if (edge) {
      removeHostBodies();
      button.setAttribute("aria-pressed", "false");
      button.textContent = "Add relationship";
      say(edgeStatus, "The demo edge and its two programmatic bodies have been removed.");
    } else {
      addHostBodies();
      button.setAttribute("aria-pressed", String(Boolean(edge)));
      button.textContent = edge ? "Remove relationship" : "Add relationship";
    }
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-edges]")?.addEventListener("click", () => {
    write({ programmaticEdges: field.handle?.readEdges() ?? [], note: "readEdges() reports programmatic addEdge relationships; DOM and pattern relationships are a separate surface." });
  }, { signal });
  root.querySelector<HTMLButtonElement>("[data-api-thread]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    threadEnabled = !threadEnabled;
    button.setAttribute("aria-pressed", String(threadEnabled));
    button.textContent = threadEnabled ? "Clear DOM thread" : "Draw DOM thread";
    field.handle?.threads(threadEnabled && objectA && objectB ? [{ a: objectA, b: objectB, color: "#52d8ff" }] : null);
  }, { signal });

  const observer = new IntersectionObserver((entries) => {
    const isActive = entries.some((entry) => entry.isIntersecting);
    if (isActive === active) return;
    active = isActive;
    if (active) {
      configBefore = captureConfig();
      syncControls();
      applyBody();
      if (terrainEnabled) registerTerrain();
      if (edge) addHostBodies();
    } else {
      flowing = false;
      root.querySelector<HTMLButtonElement>("[data-api-flow]")?.setAttribute("aria-pressed", "false");
      field.clearFlow?.();
      if (waveCentered) field.setWaveCenter?.(null);
      waveCentered = false;
      field.handle?.threads(null);
      threadEnabled = false;
      root.querySelector<HTMLButtonElement>("[data-api-thread]")?.setAttribute("aria-pressed", "false");
      removeHostBodies();
      terrain?.remove(); terrain = undefined;
      terrainEnabled = false;
      root.querySelector<HTMLButtonElement>("[data-api-terrain]")?.setAttribute("aria-pressed", "false");
      root.querySelector<HTMLButtonElement>("[data-api-terrain]")!.textContent = "Activate host terrain";
      root.querySelector<HTMLInputElement>("[data-api-visible]")!.checked = false;
      root.querySelector<HTMLButtonElement>("[data-api-edge]")!.setAttribute("aria-pressed", "false");
      root.querySelector<HTMLButtonElement>("[data-api-edge]")!.textContent = "Add relationship";
      root.querySelectorAll<HTMLInputElement>("[data-api-overlay]").forEach((input) => { input.checked = false; });
      root.querySelectorAll<HTMLInputElement>("[data-api-heatmap], [data-api-transparent], [data-api-attention], [data-api-causality]").forEach((input) => { input.checked = false; });
      root.querySelector<HTMLSelectElement>("[data-api-render]")!.value = "dots";
      root.querySelector<HTMLSelectElement>("[data-api-formation]")!.value = "ambient";
      root.querySelector<HTMLSelectElement>("[data-api-wave-style]")!.value = "linear";
      root.querySelector<HTMLSelectElement>("[data-api-palette]")!.value = "ours";
      root.querySelector<HTMLInputElement>("[data-api-accent]")!.value = "#4da3ff";
      root.querySelector<HTMLInputElement>("[data-api-separation]")!.value = "0";
      root.querySelector<HTMLOutputElement>("[data-api-separation-value]")!.value = "0";
      root.querySelector<HTMLSelectElement>("[data-api-dpr]")!.value = "2";
      root.querySelector<HTMLSelectElement>("[data-api-body-force]")!.value = "swirl";
      root.querySelector<HTMLInputElement>("[data-api-strength]")!.value = "0.8";
      root.querySelector<HTMLOutputElement>("[data-api-strength-value]")!.value = "0.8";
      root.querySelector<HTMLInputElement>("[data-api-body-height]")!.value = "88";
      root.querySelector<HTMLOutputElement>("[data-api-body-height-value]")!.value = "88 px";
      root.querySelector<HTMLInputElement>("[data-api-body-color]")!.value = "#2dd4bf";
      root.querySelector<HTMLSelectElement>("[data-api-when]")!.value = "";
      root.querySelector<HTMLSelectElement>("[data-api-potential]")!.value = "height";
      activePinned = false;
      activeButton?.setAttribute("aria-pressed", "false");
      if (activeButton) activeButton.textContent = "Activate body condition";
      root.querySelector<HTMLButtonElement>("[data-api-thread]")!.textContent = "Draw DOM thread";
      root.querySelector<HTMLButtonElement>("[data-api-flow]")!.textContent = "Follow pointer";
      root.querySelector<HTMLButtonElement>("[data-api-snapshot]")!.textContent = "Capture snapshot A";
      restoreConfig();
      field.rescan?.();
      if (body) {
        body.setAttribute("data-body", "swirl pigment");
        body.setAttribute("data-strength", "0.8");
        body.setAttribute("data-range", "360");
        body.setAttribute("data-color", "#2dd4bf");
        body.setAttribute("data-potential", "height");
        body.removeAttribute("data-when");
        body.removeAttribute("data-active");
        body.style.removeProperty("--api-body-height");
        field.rescan?.();
      }
      snapshotA = undefined;
      root.querySelector<HTMLButtonElement>("[data-api-compare]")!.disabled = true;
    }
  }, { threshold: 0.08 });
  observer.observe(root);

  // The content cards model no-DOM host records. Capture their original look before engine feedback
  // styles arrive so the same projection reads clearly when the two bodies are removed.
  return () => {
    ac.abort();
    observer.disconnect();
    field.clearFlow?.();
    field.setWaveCenter?.(null);
    field.handle?.threads(null);
    removeHostBodies();
    terrain?.remove();
    field.handle?.grid("homepage-tutorial").clear();
    restoreConfig();
    if (body) {
      body.setAttribute("data-body", "swirl pigment");
      body.setAttribute("data-strength", "0.8");
      body.setAttribute("data-range", "360");
      body.setAttribute("data-color", "#2dd4bf");
      body.setAttribute("data-potential", "height");
      body.removeAttribute("data-when");
      field.rescan?.();
    }
  };
}
