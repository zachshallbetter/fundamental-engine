// remark plugin: turn ```mermaid fenced code into a raw <pre class="mermaid"> block,
// BEFORE syntax highlighting touches it, so the client-side mermaid renderer gets the
// untouched diagram source (its textContent un-escapes back to the original). Runs at the
// mdast level (no unist-util-visit dependency — mermaid blocks are top-level).
const escapeHtml = (s) =>
  s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export default function remarkMermaid() {
  return (tree) => {
    const walk = (node) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        if (child.type === 'code' && child.lang === 'mermaid') {
          return { type: 'html', value: `<pre class="mermaid">${escapeHtml(child.value)}</pre>` };
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
