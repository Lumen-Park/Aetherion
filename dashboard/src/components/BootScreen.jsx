import React, { useEffect, useState } from 'react';

const stages = ['Establishing secure channel', 'Loading governance policy', 'Preparing workspace'];

export default function BootScreen() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStage((value) => Math.min(value + 1, stages.length - 1)), 360);
    return () => window.clearInterval(timer);
  }, []);

  return <main className="boot-screen" aria-live="polite" aria-label="Loading Aetherion Command Center">
    <div className="boot-orbit" aria-hidden="true"><span /><span /><span /><b>A</b></div>
    <p className="eyebrow">Aetherion enterprise</p>
    <h1>Initializing command center</h1>
    <p className="boot-stage">{stages[stage]}<span className="loading-dots" aria-hidden="true">•••</span></p>
    <div className="boot-progress" aria-hidden="true"><span style={{ width: `${((stage + 1) / stages.length) * 100}%` }} /></div>
    <div className="boot-checks">
      {stages.map((label, index) => <span className={index <= stage ? 'is-ready' : ''} key={label}><i>{index < stage ? '✓' : index + 1}</i>{label}</span>)}
    </div>
  </main>;
}
