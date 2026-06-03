# Layout alignment

_Started 2026-06-03 01:47 UTC_

---

## User

Lets get the these two on the same line. I want to make it interface with the field and existing particles.

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now I understand the system. Let me make the two changes — put the title on one line and wire it into the field like the live words elsewhere.Now update the CSS so the accent word responds to the field's feedback density (`--d`) — glow and weight that intensify as particles gather:

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: done]_

The wiring is already in place — `ds-app.jsx` rescans bodies on view mount, and the field's two-way feedback writes `--d` back to elements. Let me verify it renders cleanly.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: eval_js_user_view]_

_[tool: eval_js_user_view]_

Title is now a single line. Let me confirm the live word is registered as a field body and receiving feedback.

_[tool: eval_js_user_view]_

Both done:

1. **One line** — removed the forced break; "A system you can feel." now sets on a single line (with `text-wrap: balance` so it wraps gracefully on narrow viewports instead of breaking awkwardly).
2. **Field-reactive** — the headline is now a body in the field: the whole title gently attracts particles, and **feel.** is a live word with two-way feedback. As particles gather it glows brighter and its weight inflates (confirmed live: `--d` → 1.0, weight → 800) — same vocabulary as the live words elsewhere in the site.

It picks up automatically on view mount via the existing rescan, and responds whenever the Reciprocal Field is live.

## User

When changing between pages or clicking a link the entire page flashes.

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: list_files]_

The flash is the classic multi-page reload problem: these are separate HTML documents (index → design-system → manual), and on each navigation the browser paints its default **white** before your dark CSS loads, then re-boots the field canvas and reflows fonts. Let me confirm the exact page background and which pages share it.

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

The picture is complete. Two things cause the flash on every navigation:

1. **White first-paint** — `#04050a` is set on `body`, but the root `<html>` has no background, so the browser flashes its default white before your CSS applies.
2. **Hard cut** — separate documents swap instantly with no transition.

Let me see which stylesheets each page loads so I fix it everywhere, then apply both fixes (dark root + cross-document view transitions).

_[tool: read_file]_

Both `--bg` and `--bg-page` are `#04050a`. Now I'll apply both fixes to the two shared stylesheets. This covers all pages (`app.css` → index/manual/field, `ds-tokens.css` → design-system).

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

Now the strongest part of the fix — an inline dark background on the `<html>` tag itself, so the very first paint is dark even before the external stylesheet loads. Plus a `theme-color` meta for mobile browser chrome. Applying to all four navigable pages:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

All four pages are fixed. Let me verify the design-system page still loads cleanly.

_[tool: done]_

Fixed. The flash came from two things, both now addressed across all four pages (index, design-system, manual, field):

1. **White first-paint** — the page background lived only on `<body>`, so during each navigation the browser painted its default white before your CSS applied. Now `<html>` itself is `#04050a` (inline, so it's dark on the *very first* paint before any stylesheet loads), backed up in `app.css`/`ds-tokens.css` with `color-scheme: dark` and a `theme-color` meta for mobile chrome.

2. **Hard cut between pages** — added `@view-transition { navigation: auto; }`, so supporting browsers now crossfade between documents instead of snapping. It respects `prefers-reduced-motion`, and browsers without support simply get the instant (now flash-free) navigation.

Net effect: navigating between pages and clicking links stays on a continuous dark surface with a soft fade, no white blink.

## User

Lets put together more content for the main page.

## User

The v6 main page

## User

The v6 main page

## Assistant

_[tool: read_file]_

_[tool: read_file]_

Let me look at the v6 styling so I understand the visual vocabulary before proposing additions.

_[tool: questions_v2]_

This v6 page has a rich, fully-realized "forces/field" system. One thing jumped out: your CSS already defines a **live thread diagram** section (`.field-graph` / `.gnode` / `.graph-edge` — "THE FIELD: live thread diagram") with full styling, but it's not actually in the page yet. That's a ready-made section waiting to be built.

Before I start adding, let me get clear on what "more content" means to you so I build the right things in your existing vocabulary.

## User

Questions answered:
- sections: Expand Selected Work (more projects + detail), Testimonials / quotes from collaborators, By-the-numbers / stats band, Client & company logos, About / bio — who you are, how you work, The Field — live thread diagram (already styled in your CSS, just not built)
- content_source: Draft realistic placeholder copy I can edit
- about_detail: Zach Shallbetter
Founder Bio — Investor Ready
Founder Profile
Zach Shallbetter is a designer and illustrator who became an engineer and then a founder, and who
settled on the work he loves most: making products real — digital and physical — and building the
systems that produce them. Across two decades, the throughline is consistent: build the machine that
builds the thing, then engineer it to run without standing over it. He has done this in both software and
physical manufacturing, a rare pairing and the core of what he is building now.
His range spans front-end and backend architecture, commerce and payments infrastructure, applied AI,
design systems, and end-to-end production operations — from prototype to real users. He can define a
product thesis, decompose a system into clean service boundaries, design the interaction model, reason
through data flows and build-versus-buy decisions, and carry the result through to launch, fulfillment,
and iteration. He understands the difference between a demo, a product, a platform, and a business —
and has shipped all four.
His experience includes both software and physical production, giving him practical command of
inventory, fulfillment, COGS, quality control, automation, margin structure, and vendor constraints
alongside systems architecture and applied AI. That makes him effective where a company needs more
than an idea — where it needs a product architecture, a technical narrative, a commercial path, and a
system that can survive real users.
Short Bio
Zach Shallbetter is a designer turned engineer turned founder who builds products and the systems that
produce them — in software and in physical manufacturing. At Cursed Crypt, the hardware company he
founded, a Kickstarter funded at ~330% of goal grew through a ~$500K seed into an end-to-end just-in-
time factory that ran largely on its own. He has shipped for enterprise brands (GE, GM, Adobe, Gilead,
Amazon) and architected an AI-assisted commerce platform at SWAIA. He is now co-founder and Chief
Product Architect of S2Forge.
Investor Signal
• Two-time founder who ships: a hardware company taken from Kickstarter (~330% of goal) through a
~$500K seed to a self-running just-in-time manufacturing facility he engineered end to end.
• Genuinely cross-layer — software architecture and physical production, including custom-built
equipment, re-engineered machines, and invented coatings and processes. Has carried unit
economics, COGS, inventory, fulfillment, and margin in the real world.
• Deep, hands-on technical range: contract-driven microservice architecture, commerce and payments
infrastructure, and applied AI (retrieval, recommendation, conversational) built directly, since the
early days of the field.
• Enterprise-grade delivery record across brands and agencies (GE, GM, Adobe, Gilead, Amazon,
Celebrity Cruises), with measurable outcomes — a 320% lead lift, a Gold Award, and 20% program-
enrollment growth.
• Now co-founder and Chief Product Architect of S2Forge, a contract-driven platform applying
manufacturing-grade systems discipline to software execution.
S2Forge — Role Definition
Zach Shallbetter · Co-Founder & Chief Product Architect
Role Summary
Zach Shallbetter is Co-Founder and Chief Product Architect at S2Forge, where he leads product vision,
technical architecture, interaction design, and execution strategy. He owns the bridge from concept to
implementation: how the product works, how users experience it, how the system is structured, and how
the technology is demonstrated through prototypes, demos, and documentation. He partners with
Dustin, S2Forge's Co-Founder & CEO, who leads company and commercial direction — a clean split
between build and business.
His background across software engineering, commerce platforms, interface systems, applied AI, and
physical product development gives S2Forge a founder who can operate across invention, design,
engineering, and execution without losing the user experience.
Core Ownership
• Product vision, roadmap definition, experience strategy, and platform positioning.
• Technical architecture, implementation planning, prototype direction, and systems design.
• Proof-of-concept platforms, product narratives, and technical storytelling for partners and investors.
• Design systems, interaction models, user flows, interface behavior, and product documentation.
• Applied-AI workflows, automation, and productized internal tooling.
• Cross-functional alignment across engineering, design, production workflows, and market execution.
Pitch-Deck Version
Co-Founder & Chief Product Architect of S2Forge. Leads product vision, technical architecture, UX
strategy, and execution. Brings two decades across software, interaction design, AI tooling, e-
commerce, physical product development, education, and startup leadership — including a hardware
company taken from Kickstarter to a self-running manufacturing facility. Translates S2Forge's vision into
working product systems and market-ready experiences.
Zach Shallbetter
Co-Founder & Chief Product Architect, S2Forge
Spokane, WA · zachshallbetter@gmail.com · (509) 201-7432 · zachshallbetter.com · linkedin.com/in/zachshallbetter
Summary
A designer and illustrator who became an engineer and then a founder, and who settled on the work he
loves most: making products real — digital and physical — and building the systems that produce them.
Two decades across creative, software, and manufacturing, with a consistent instinct: build the machine
that builds the thing, then engineer it to run without standing over it.
Experience
Co-Founder & Chief Product Architect · S2Forge 2026 – Present
• Building a contract-driven software platform on the same discipline that ran a physical production
line: single-responsibility services under explicit contracts, no duplicated logic, idempotent state, fail-
closed boundaries, and automation that lets a small team operate a large system.
• Architected the platform end to end — identity/auth, commerce and payments, document/retrieval,
and orchestration — with strict credential and trust boundaries. Partners with the CEO on a clean
build/business split.
Director of Innovation · Colormatics 2025 – 2026
• Created and led an innovation division building AI-powered tools for video production, post-
production, and creative workflow automation.
• Built a portfolio of custom video-focused AI tools — live rotoscoping, active object callouts, and in-
camera image masking — and defined the product strategy, architecture, and prototype direction
behind them.
Principal Architect & Designer · SWAIA — Indigenous Collections 2023 – 2024
• Principal architect and designer of an Indigenous-art commerce platform on Next.js, Supabase, and
Stripe Connect, with seller verification, customizable storefronts, product customization, and
advanced search.
• Early to applied AI: built the recommendation, search, and conversational-assist features directly,
integrating language-model capabilities into the shopping experience.
Assistant Professor, Web & UX · North Idaho College 2022 – 2023
• Built and taught an interdisciplinary web-development and UX/UI curriculum that lifted program
enrollment ~20%; created a student-led consultancy and established industry internship and
placement pipelines.
Founder & Chief Product Officer · Cursed Crypt, Inc. 2018 – 2022
• Founded and ran a tabletop-gaming hardware company for four years; Kickstarter cleared its $30K
goal at ~330% (~$100K on-platform plus ~$75K in direct presales), followed by ~$500K raised in
seed capital.
• Designed and stood up an end-to-end, just-in-time manufacturing facility — site, commerce,
inventory ingest, production, and fulfillment — that ran largely autonomously with a lean on-hand
team.
• Achieved that autonomy by re-engineering machines in hardware and software, commissioning
custom equipment built around the workflows, and inventing proprietary coatings and processes
(including a nano-ceramic-coated magnetic game board).
Co-Founder & Creative Developer · Uxiliary 2014 – 2020
• Co-founded and led a digital product and design studio, directing a team of ten-plus across design
and engineering for clients from startups to Fortune 500 (Amazon, MassMutual, Novo Nordisk);
owned proposals, scope, daily delivery cadence, and junior-developer mentorship.
Leadership & Earlier Experience
Interactive Chair · AAF Spokane (501c4) President & Co-Founder · Inland Northwest Technologists (501c3) Current
2015 – 2020
• Led a regional tech nonprofit: 50+ volunteers, 200+ community events, a municipal-broadband
initiative carried to a unanimous council vote, and a merger that expanded reach. Mayoral Award for
community leadership.
Earlier · 14Four · OpenEye 2007 – 2013
• Front-end and web roles building national-brand campaigns (GE, GM, Adobe, Celebrity Cruises,
Gilead) through agencies including AKQA and Mekanism, and leading a CMS rebuild that drove a
320% increase in leads.
Product & Design
Product & strategy: Product thesis and roadmap definition, market and user discovery, requirements
modeling, build-vs-buy and service-boundary decisions, release sequencing, unit economics, and go-to-
market — carried from prototype to real users.
Design & UX: Designer and illustrator foundation; UX research, journey mapping, information
architecture, interaction and interface design, prototyping (Figma, Adobe, Storybook), and design-to-
code execution.
Design systems & interaction: Component libraries, design tokens, and accessible, responsive
interface systems; motion and interaction design that hold consistency from brand through to production
code.
Discovery & validation: Customer and stakeholder interviews, journey and service mapping, rapid
prototyping, and market validation — turning ambiguous problems into testable product decisions before
code is written.
Technical & Systems
Systems architecture: Contract-driven microservice fleets in Rust (Axum); single-responsibility
services, no duplicated logic, fail-closed boundaries. Boundary-native credential isolation, idempotent
state machines, append-only event ledgers, durable workflow orchestration.
Integration & trust: Webhook-verified, signature-validated provider integration with hash-anchored
payloads and strict idempotency; WebAuthn/passkey obligation-first auth; PII-minimizing data
boundaries and audit-bearing provenance.
Applied AI: Multi-turn RAG with grounded retrieval (pgvector, citation search, token-budgeted context),
epistemic routing, recommendation and semantic-search systems, computer-vision pipelines for video,
local and gateway model inference.
Commerce, frontend & infra: Stripe / Stripe Connect, payments and fulfillment; React, Next.js,
TypeScript, design systems; Node.js, PostgreSQL; Vercel, Supabase, GCP, CI/CD and deployment
automation.
Physical production: JIT manufacturing systems, custom equipment design, machine re-engineering
(hardware + software), materials and coating development, inventory and fulfillment automation.
Recognition
• Gold Award, AMCP (Gilead annual report) · Ad Club of Spokane / AAF design & innovation awards ·
Mayoral Award for community leadership · SBA Emerging Leaders.
- length: Substantially longer, comprehensive
- tone: Match the forces/field framing throughout

## Assistant

_[tool: read_file]_

Excellent — that's a lot to work with. Let me understand the existing JS wiring so new sections interface with the field correctly (especially the thread-diagram, which may need JS to position nodes and draw edges).

_[tool: read_file]_

The thread-diagram JS is already wired (`#fieldGraph`, `#graphSvg`, `.gnode[data-node]`) — I just need to build the HTML for it. Let me check `interact.js` and `caps.js` to see exactly what `data-hot`/`data-feedback` do here, so new elements interface with the field without breaking layout.

_[tool: grep]_

_[tool: grep]_

The JS is all there — `data-hot` here is hover-only (no drag), and the thread-diagram + counters just need markup. Let me confirm the shared layout helpers (`.wrap`, `.section-head`) before I write.I have everything I need. Let me set up a task list and build. I'll write the new sections into the HTML, then append the CSS, then add the counter JS.

_[tool: update_todos]_

Let me update the nav first, then insert the ABOUT section after the hero.

_[tool: str_replace_edit]_

Now insert the ABOUT section between the hero and the practice section:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me insert the ABOUT section before the PRACTICE comment.

_[tool: update_todos]_

Now insert THE FIELD thread-diagram after the practice section (before WORK). Let me find the exact close of the practice section:

_[tool: str_replace_edit]_

_[tool: update_todos]_

Now expand WORK — replace the 4 placeholder rows with 6 real projects, each with tags and richer deks. Let me replace the whole `.accretion` block:

_[tool: str_replace_edit]_

_[tool: update_todos]_

Now insert STATS, LOGOS, and TESTIMONIALS between WORK and WRITING. Let me add all three at once before the WRITING section:

_[tool: str_replace_edit]_

_[tool: update_todos]_

Now append the CSS for the new sections to v6.css:

_[tool: str_replace_edit]_

Now add the counter JS to v6.js. Let me insert a counters IIFE before the closing of the main IIFE:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me add formation mappings for the new sections so the field reconfigures as you scroll through them, then verify.

_[tool: update_todos]_

Now let me verify it loads cleanly and capture the new sections.

_[tool: show_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

Clean. Let me screenshot the new sections to check they render correctly. Let me capture the field diagram and stats area by scrolling.

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

I should use `scrollTo` rather than `scrollIntoView`. Let me capture the key new sections properly.

_[tool: view_image]_

_[tool: view_image]_

_[tool: save_screenshot]_

The smooth-scroll is preventing the capture from landing. Let me disable it and use a larger settle time.

_[tool: view_image]_

_[tool: save_screenshot]_

Let me check whether scroll is even taking effect — scroll a fixed large amount and read back the position.

_[tool: eval_js]_

_[tool: eval_js]_

Scroll works via `eval_js` (y=2400 holds) — the screenshot tool is resetting it. Let me scroll with eval, then capture without re-scrolling.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: eval_js]_

The screenshot tool reloads to top, so I'll verify the new sections structurally via `eval_js` instead — confirming the thread-diagram edges drew, nodes positioned, and counters wired.Everything is wired correctly: 10 edges + 10 traveling pulses drawn between the 9 diagram nodes, sections in the right order, 6 stat counters, 6 work rows, 3 quotes, 8 logos. Let me do a final visual check of the diagram and stats by rendering them via the verifier, which has its own iframe. First, let me register the asset and hand off through `done`.

_[tool: eval_js]_

Nodes spread well across the graph (x 13→704, y range healthy), goal node present. The layout is sound. Let me surface the page to the user and check for console errors.

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

I've built out the v6 main page substantially. Here's what's new, all in your existing forces/field vocabulary:

**About — "Build the machine that builds the thing"** — a three-phase throughline chain (Designer → Engineer → Founder, each a field body that glows), plus a two-column bio and a quick-facts panel (S2Forge role, Spokane, two-time founder, applied AI).

**The Field — live thread diagram** — built the HTML for the section that was already styled-but-empty in your CSS. Nine concept nodes (Research → Strategy → Interface → Architecture → AI, with Commerce/Production/Motion all pulling toward **Coherence**) connected by glowing edges with traveling pulses. Hovering a node lights its threads.

**Work — expanded to 6 real projects** with stack tags: S2Forge, AI video tooling, SWAIA, Cursed Crypt (the self-running factory), Uxiliary, and the enterprise/agency era.

**Stats band** — six count-up figures (330% Kickstarter, $500K seed, 320% lead lift, 20% enrollment, 20 yrs, 4/4 shipped) that animate when scrolled into view and glow with field density.

**Logos** — client wordmarks (GE, GM, Adobe, Gilead, Amazon, Celebrity Cruises, MassMutual, Novo Nordisk) as type, not recreated trademarks.

**Testimonials** — three placeholder quote cards (one attributed to your S2Forge CEO, two role-based) for you to edit.

Nav gained an **About** link, and the field reconfigures its formation as you scroll each new section. All copy is editable placeholder drafted from your bio.

A verifier is doing a visual pass on the new sections in the background. Two things to flag for you: the **testimonial quotes are invented placeholders** — especially review the one attributed to "Dustin —" before this goes anywhere real; and I kept logos as text wordmarks rather than brand logos (correct for trademark reasons, but let me know if you'd prefer a different treatment).

## User

Verifier agent check completed

## Assistant

The verifier confirmed the new sections render cleanly. The v6 page is ready for your review — scroll through About, The Field diagram, the expanded Work, Stats, Logos, and Testimonials. Edit any of the drafted copy directly, and remember to revisit that one named testimonial before it goes live.

## User

Good. Lets add more. Also, the slider doesn't work great and I really don't like the concept as well.

## Assistant

_[tool: grep]_

Before I dive in, let me locate the slider you mean — a couple of things in the project could be "the slider."

_[tool: grep]_

_[tool: grep]_

"Add more" and "the slider" could each point at a couple of different things, and I don't want to rebuild the wrong one. Let me quickly check the design-system views for any slider before asking.

_[tool: questions_v2]_

No range slider lives in the design-system views — so "the slider" is most likely one of two things, and "add more" could target either file we've been in. Rather than guess wrong and rebuild the wrong thing, let me pin it down quickly.

## User

Questions timed out; go with defaults

## User

Verifier agent check completed

## User

Verifier agent check completed

## Assistant

_[tool: show_html]_

The verifier errored out (server issue, not a real verdict), so let me do the visual check myself. Let me capture the new section.

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

The screenshot and verifier tooling are hitting infra errors right now (the verifier's "internal server error" and the "No preview pane available" responses are environment issues, not problems with the page). I've confirmed what matters directly:

- **index-v6.html** loads with **no console errors**; the new `#beyond` section renders with its 3 leadership cards and 4-row recognition panel in a proper two-column grid, sequenced correctly between Testimonials and Writing.
- **design-system.html** loads clean; the resize slider, bottom bar, and preset buttons are all gone (verified: 0 of each), with content still rendering at full width.

Both deliverables are in place and functioning. When the preview/verifier infra recovers, scroll to the **Leadership & recognition** section on the v6 page and glance at the design system's bottom edge to confirm the slider is gone — but structurally and on console, both are solid. Let me know if you'd like any visual tweaks to the new section.

## User

I want to add a section called "Design Systems". It will include all of the interesting systems I've made. I also want a "projects and experiements" section.

## Assistant

_[tool: copy_starter_component]_

Two new sections — I'll build both into the v6 page in your forces/field vocabulary, anchored by your real work and drafted as editable placeholders (matching how we did About/Work). For **Projects & Experiments** I'll use drag-and-drop image slots so you can drop in real screenshots later. Let me grab that component first.

_[tool: str_replace_edit]_

Now I'll insert both sections after Work (forming a "things made" cluster before Stats). Let me add them:Now add the nav link, the image-slot script, and the formation mappings:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now append the CSS for both new sections to v6.css:

_[tool: str_replace_edit]_

_[tool: show_html]_

Let me verify the page loads cleanly and the new sections + image slots render.

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: eval_js]_

Everything renders correctly — 4 system cards (1 feature), 6 experiment cards, 5 image slots upgraded, nav link added, no console errors, correct order. Let me try a visual capture now that infra may have recovered.

_[tool: save_screenshot]_

Infra recovered. Let me look at both new sections.

_[tool: view_image]_

The Design Systems section looks great — clean header, and the Forces feature card with its "Open the system →" affordance. Let me check the experiments grid with the image slots.

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: done]_

Both sections look polished and on-system — the experiments grid reads cleanly with image slots ready for screenshots, tags, and deks. Let me finalize the handoff.Both sections are in and verified. Here's what landed on the v6 page, between **Work** and **Stats**:

**Design Systems** ("Systems that build the thing") — a feature card for the real **Forces / Reciprocal Field** system that links straight to your `design-system.html`, plus three cards: Executable DS, SWAIA Storefront System, and an Interaction & Motion Library. Each is field-reactive with token/trait chips.

**Projects & Experiments** ("The lab bench") — a 6-card grid with **drag-and-drop image slots** you fill with real screenshots: Live Rotoscoping, Active Object Callouts, In-Camera Masking, Semantic Search & Assist, the Reciprocal Field (links to your `field.html` sandbox), and a dashed "more in the lab" card. Drop an image on any slot and it persists.

I also added a **Systems** link to the nav and wired both sections into the field's formation changes.

Two things to edit when you have specifics:
- The **design-system entries** beyond Forces are drafted from your bio (Executable DS, SWAIA, Motion Library) — swap in real names/links, or tell me the actual systems and I'll replace them.
- The **experiment cards** are your real Colormatics/SWAIA work as placeholders — drop screenshots into the slots and adjust titles as needed.

Want me to add links/case-study pages for any of these, or adjust how many cards each grid shows?

