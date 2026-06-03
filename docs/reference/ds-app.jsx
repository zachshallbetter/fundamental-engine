/* ──────────────────────────────────
   FORCES DS — APP ENTRY
   Routes the grouped IA (Foundations · The Field · Interface),
   owns the Reciprocal Field live state, and re-binds interactions
   + rescans the field whenever the view changes.
────────────────────────────────── */
const { useState, useEffect } = React;

function App() {
  const [view, setView] = useState('brand');
  const [live, setLiveState] = useState(() => (window.DSInteractions ? window.DSInteractions.isLive() : false));

  const sectionLinks = window.DS_SECTIONS || {};

  const setLive = (v) => {
    if (window.DSInteractions) window.DSInteractions.setLive(v);
    setLiveState(v);
  };

  // keep React in sync if the flag is flipped elsewhere
  useEffect(() => {
    if (!window.DSInteractions || !window.DSInteractions.onChange) return;
    return window.DSInteractions.onChange((v) => setLiveState(v));
  }, []);

  // on view change: show field stronger on the physics views, rescan bodies, rebind interactions
  useEffect(() => {
    const fieldViews = ['substrate', 'forces', 'formations', 'lab'];
    document.body.classList.toggle('ds-show-field', fieldViews.includes(view));
    window.scrollTo(0, 0);
    const t = setTimeout(() => {
      if (window.DSInteractions) window.DSInteractions.rescan();
      const f = window.__field; if (f && f.rescan) f.rescan();
    }, 80);
    return () => clearTimeout(t);
  }, [view]);

  return (
    <>
      <TopBar view={view} setView={setView} sectionLinks={sectionLinks} live={live} setLive={setLive} />
      <PageCorners />
      <ViewportShell>
        {view === 'brand' && <BrandView />}
        {view === 'style' && <StyleView />}
        {view === 'type' && <TypeView />}
        {view === 'substrate' && <SubstrateView />}
        {view === 'forces' && <ForcesView live={live} setLive={setLive} />}
        {view === 'formations' && <FormationsView />}
        {view === 'lab' && <LabView live={live} setLive={setLive} />}
        {view === 'components' && <ComponentsView />}
        {view === 'patterns' && <PatternsView />}
        {view === 'library' && <LibraryView />}
        {view === 'screens' && <ScreensView />}
      </ViewportShell>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
