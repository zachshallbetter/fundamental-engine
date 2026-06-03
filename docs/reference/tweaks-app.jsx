/* Tweaks app — drives the living field (window.__field) + UI accent. */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#4da3ff", "#2dd4bf", "#a78bfa"],
  "amplitude": 1,
  "waveSpeed": 1,
  "density": 1,
  "bloom": 1,
  "bodies": true,
  "feedback": true,
  "showWaves": true,
  "darkness": 0.97
}/*EDITMODE-END*/;

function clearColor(darkness) {
  const g = Math.round((1 - darkness) * 20);
  return `rgb(${5 + g},${6 + g},${11 + g})`;
}

function ZTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const cfg = window.__field;
    const accent = (t.palette && t.palette[0]) || '#4da3ff';
    if (cfg) {
      const colorsChanged = JSON.stringify(cfg.waveColors) !== JSON.stringify(t.palette);
      const densityChanged = cfg.density !== t.density;
      cfg.waveColors = t.palette;
      cfg.accent = accent;
      cfg.amplitude = t.amplitude;
      cfg.waveSpeed = t.waveSpeed;
      cfg.density = t.density;
      cfg.bloom = t.bloom;
      cfg.bodies = t.bodies;
      cfg.feedback = t.feedback;
      cfg.showWaves = t.showWaves;
      cfg.darkness = t.darkness;
      if (window.__fieldSync) {
        if (colorsChanged) window.__fieldSync('colors');
        if (densityChanged) window.__fieldSync('density');
      }
    }
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--bg', clearColor(t.darkness));
  }, [t]);

  return (
    <TweaksPanel>
      <TweakSection label="Field" />
      <TweakColor
        label="Palette"
        value={t.palette}
        options={[
          ['#4da3ff', '#2dd4bf', '#a78bfa'],
          ['#ff6384', '#36a2eb', '#9b7dff'],
          ['#2dd4bf', '#38bdf8', '#818cf8'],
          ['#f59e0b', '#ef5da8', '#a78bfa'],
          ['#7dd3fc', '#a5b4fc', '#f0abfc'],
        ]}
        onChange={(v) => setTweak('palette', v)}
      />
      <TweakSlider label="Wave amplitude" value={t.amplitude} min={0.3} max={2} step={0.1}
        onChange={(v) => setTweak('amplitude', v)} />
      <TweakSlider label="Wave speed" value={t.waveSpeed} min={0} max={2.5} step={0.1}
        onChange={(v) => setTweak('waveSpeed', v)} />
      <TweakSlider label="Particle density" value={t.density} min={0.4} max={2} step={0.1}
        onChange={(v) => setTweak('density', v)} />
      <TweakSlider label="Bloom" value={t.bloom} min={0} max={2} step={0.1}
        onChange={(v) => setTweak('bloom', v)} />
      <TweakSlider label="Background darkness" value={t.darkness} min={0.82} max={1} step={0.01}
        onChange={(v) => setTweak('darkness', v)} />
      <TweakSection label="Reciprocity" />
      <TweakToggle label="Show waves" value={t.showWaves}
        onChange={(v) => setTweak('showWaves', v)} />
      <TweakToggle label="Elements bend the field" value={t.bodies}
        onChange={(v) => setTweak('bodies', v)} />
      <TweakToggle label="Field bends elements back" value={t.feedback}
        onChange={(v) => setTweak('feedback', v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<ZTweaks />);
