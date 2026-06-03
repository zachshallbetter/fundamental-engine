/* ============================================================
   CAPS — the practice matrix focus interaction.
   Click a skill: it stays exactly where it is and lights up as the
   selected force; the seven surrounding tiles each repopulate with two of
   its fourteen facets, cascading out from the clicked tile. Nothing moves
   or resizes — only the surrounding content changes. Click the selected
   tile, a facet tile, outside the grid, or press Esc to return.
   The field-force behaviour (hover → the skill's force acts) is untouched.
   ============================================================ */
(function () {
  'use strict';
  const grid = document.getElementById('capsGrid');
  if (!grid) return;
  const caps = [...grid.querySelectorAll('.cap')];

  // fourteen facets behind each discipline (two per surrounding tile)
  const RELATED = {
    'Product strategy':     ['Product vision', 'Roadmap development', 'Business model design', 'Market positioning', 'Customer value', 'R&D strategy', 'Innovation pipeline', 'Lifecycle management', 'KPI definition', 'Prioritization', 'Go-to-market', 'Cross-functional direction', 'Stakeholder alignment', 'Product operations'],
    'AI systems':           ['AI experience architecture', 'LLM integration', 'Conversational UX', 'Semantic search', 'Recommendation systems', 'Personalization', 'Human-in-the-loop', 'AI-assisted commerce', 'Adaptive interfaces', 'Prompt systems', 'Context modeling', 'Data enrichment', 'Trust & safety', 'AI prototyping'],
    'Software architecture': ['Platform architecture', 'Full-stack design', 'Frontend systems', 'Backend integration', 'API design', 'Data modeling', 'Authentication', 'Payment infrastructure', 'State management', 'Performance', 'DevOps & deploy', 'Observability', 'Technical docs', 'Scalability'],
    'Experience design':    ['Interaction design', 'UX strategy', 'Interface design', 'Information architecture', 'User flows', 'Customer journeys', 'Wireframing', 'Prototyping', 'Design systems', 'Accessibility', 'Usability testing', 'Research synthesis', 'Behavioral design', 'Content design'],
    'Motion':               ['Motion design', 'Interface animation', 'Microinteractions', 'Transition systems', 'UI choreography', 'Behavior design', 'Visual feedback', 'State-based motion', 'GSAP animation', 'Easing & timing', 'Scroll choreography', 'Gesture motion', 'Loading & progress', 'Animation prototyping'],
    'Commerce':             ['Commerce strategy', 'Marketplace design', 'Seller tools', 'Buyer flows', 'Checkout systems', 'Payment flows', 'Catalog architecture', 'Merchandising', 'Customer accounts', 'Order management', 'Fulfillment logic', 'Trust & verification', 'Conversion UX', 'Commerce ops'],
    'Physical production':  ['Product R&D', 'Concept development', 'Rapid prototyping', 'Materials research', 'Manufacturing workflow', 'Production planning', 'Packaging systems', 'Quality control', 'Vendor coordination', 'Inventory logic', 'Just-in-time production', 'Fulfillment systems', 'Operational automation', 'Digital-to-physical'],
    'Creative technology':  ['Prototype engineering', 'Generative UI', 'Interactive storytelling', 'Data visualization', '3D interface concepts', 'Spatial concepts', 'Web animation', 'Experimental interfaces', 'WebGL & shaders', 'Three.js', 'Creative coding', 'Emerging interaction', 'Realtime graphics', 'Physical computing'],
  };

  // cache each tile's name so we can look up its facets
  caps.forEach((c) => { const n = c.querySelector('.cap-name'); c._name = n ? n.textContent.trim() : ''; });
  let selected = null;

  function clearFacets() { grid.querySelectorAll('.facet').forEach((f) => f.remove()); }

  function enter(cap) {
    if (selected === cap) { exit(); return; }
    clearFacets();
    selected = cap;
    grid.classList.add('focused');
    const color = cap.dataset.color || '#4da3ff';
    const rel = (RELATED[cap._name] || []).slice(0, 14);
    const si = caps.indexOf(cap);
    const col = (si % 4) + 1;            // keep the tile in its own column
    const band = si < 4 ? 1 : 3;         // and its own row-band (top vs bottom)
    caps.forEach((c) => {
      c.classList.toggle('selected', c === cap);
      c.classList.toggle('cap-hidden', c !== cap);
      c.setAttribute('aria-expanded', String(c === cap));
    });
    cap.style.setProperty('--cat', color);
    cap.style.gridColumn = String(col);
    cap.style.gridRow = band + ' / span 2';
    // 14 facets, each its own half-height container, flowing around the tile
    rel.forEach((name, i) => {
      const f = document.createElement('div');
      f.className = 'facet';
      f.style.setProperty('--cat', color);
      f.style.setProperty('--cascade-delay', (i * 32) + 'ms');
      f.innerHTML = '<span class="facet-no">' + String(i + 1).padStart(2, '0') + '</span>'
        + '<span class="facet-name">' + name + '</span>';
      f.addEventListener('click', exit);
      grid.appendChild(f);
    });
  }

  function exit() {
    if (!selected) return;
    grid.classList.remove('focused');
    clearFacets();
    caps.forEach((c) => {
      c.classList.remove('selected', 'cap-hidden');
      c.style.removeProperty('grid-column');
      c.style.removeProperty('grid-row');
      c.style.setProperty('--cat', c.dataset.color || '');
      c.setAttribute('aria-expanded', 'false');
    });
    selected = null;
  }

  caps.forEach((cap) => {
    cap.addEventListener('click', () => enter(cap));
    cap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(cap); }
    });
  });
  document.addEventListener('click', (e) => { if (selected && e.target instanceof Element && !e.target.closest('#capsGrid')) exit(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') exit(); });
})();
