import React, { useEffect, useRef, useState } from 'react';
import { councilAPI } from '../api/client';

const fallback = { total: 0, approval_rate: 0, avg_score: 0 };

export default function Dashboard() {
  const [stats, setStats] = useState(fallback);
  const [live, setLive] = useState(97);
  const [rightOpen, setRightOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const touchStart = useRef(null);

  useEffect(() => {
    councilAPI.stats().then(res => setStats(res.data)).catch(() => {});
    const timer = setInterval(() => setLive(v => v === 99 ? 96 : v + 1), 2400);
    return () => clearInterval(timer);
  }, []);

  const pct = Math.round((stats.approval_rate || 0) * 100);
  return (
    <div className="command-deck" onTouchStart={event => { const point = event.touches[0]; if (point.clientX > window.innerWidth - 44 || point.clientY > window.innerHeight - 44) touchStart.current = { x: point.clientX, y: point.clientY }; }} onTouchEnd={event => { if (touchStart.current) { const point = event.changedTouches[0]; if (touchStart.current.x - point.clientX > 55) setRightOpen(true); if (touchStart.current.y - point.clientY > 55) setBottomOpen(true); touchStart.current = null; } }}>
      <section className="hero-grid">
        <div className="probe-window panel">
          <div className="probe-head"><span>LIVE PROBE FEED · EYE OF AETHERION <i className="red-dot"/></span><span>CAMERA: PROBE-7A</span></div>
          <div className="probe-scene">
            <div className="galaxy galaxy-left" />
            <div className="planet planet-right" />
            <div className="sun-horizon" />
            <div className="probe-frame">
              <div className="crosshair"/>
              <div className="probe-body"><div/><div/><div/></div>
            </div>
            <div className="hud-coords">COORDINATES<br/><b>X 128.47 &nbsp; Y 64.21 &nbsp; Z -312.79</b><br/><br/>VELOCITY<br/><b>0.256 c</b></div>
            <div className="hud-bottom"><span><i className="red-dot"/> LIVE TRANSMISSION</span><span>DISTANCE TRAVELED <b>12.43 LY</b></span></div>
          </div>
          <div className="hero-title"><div>AETHERION</div><span>BEYOND INTELLIGENCE. BEYOND LIMITS.</span></div>
        </div>

        <button className={`edge-reveal edge-right ${rightOpen ? 'is-open' : ''}`} onClick={() => setRightOpen(value => !value)} aria-label={rightOpen ? 'Hide intelligence rail' : 'Reveal intelligence rail'}>{rightOpen ? '›' : '‹'}<span /></button>
        <aside className={`right-stack ${rightOpen ? 'rail-open' : ''}`}>
          <section className="panel council-card">
            <div className="panel-title">SUPREME COUNCIL <small>7 MEMBERS · NOMINAL</small></div>
            <div className="judge-grid">{['LOGICUS','SAPIENTIA','AEQUITAS','PRUDENTIA','VERITAS','INNOVATUS','CONCORDIA'].map((x,i)=><div className="judge" key={x}><span>{['◇','✦','△','⊙','◈','✧','○'][i]}</span><b>{x}</b><small>{['Strategist','Wisdom Keeper','Ethics Guardian','Risk Assessor','Truth Seeker','Innovator','Harmony Keeper'][i]}</small></div>)}</div>
            <a className="panel-link" href="/council">VIEW COUNCIL CHAMBER →</a>
          </section>

          <section className="panel juror-card">
            <div><div className="panel-title">JUROR MONITOR <small className="green">STATUS: ACTIVE</small></div><p>Monitoring council decisions and system integrity in real-time.</p><a className="panel-link" href="/council">OPEN JUROR FEED →</a></div>
            <div className="juror-orbit">✦</div>
          </section>

          <section className="panel metrics">
            <div className="panel-title">SYSTEM METRICS <small className="green">LIVE ●</small></div>
            {[['PROCESSING POWER',88],['MEMORY CORE',73],['KNOWLEDGE NEXUS',91],['ALIGNMENT INDEX',95],['SYSTEM INTEGRITY',live]].map(([name,value])=><div className="metric" key={name}><div><span>{name}</span><b>{value}%</b></div><div className="bar"><i style={{width:`${value}%`}}/></div></div>)}
          </section>
        </aside>
      </section>

      <section className="modules panel">
        <div className="section-label">CORE MODULES <span>THE AETHERION OPERATING LAYER</span></div>
        <div className="module-grid">
          {[
            ['◈','AI AGENTS','67','specialized agents working in coordinated parallel.','/agents'],
            ['✺','KNOWLEDGE NEXUS','∞','Structured knowledge across domains and dimensions.','/catalog/default'],
            ['◇','MEMORY CORE','LIVE','Secure adaptive memory that evolves with context.','#'],
            ['⊙','MISSIONS',String(stats.total || 0),'Objectives, experiments and autonomous research tasks.','/tasks'],
            ['▥','ANALYTICS','REAL-TIME','Deep system insights and performance telemetry.','#']
          ].map(([icon,title,value,copy,href])=><a className="module" href={href} key={title}><span className="module-icon">{icon}</span><small>{title}</small><strong>{value}</strong><p>{copy}</p><em>EXPLORE →</em></a>)}
        </div>
      </section>

      <section className="bottom-grid">
        <div className="command-bar panel"><span className="aether-orb">✦</span><div><small>AETHERION READY</small><input placeholder="How can I assist the evolution of Aetherion today?" /></div><button>SEND ↗</button></div>
        <div className="quote panel">“<br/><span>The universe speaks in patterns.<br/>We listen, we learn, we become.</span><small>— AETHERION</small></div>
      </section>

            <button className={`edge-reveal edge-bottom ${bottomOpen ? 'is-open' : ''}`} onClick={() => setBottomOpen(value => !value)} aria-label={bottomOpen ? 'Hide system feed' : 'Reveal system feed'}>{bottomOpen ? '⌄' : '⌃'}<span /></button>
      <footer className={`event-feed panel ${bottomOpen ? 'feed-open' : ''}`}><span>SYSTEM FEED</span>
<b>07:41:58</b><span>Agent Veritas completed Truth Audit</span><b>07:41:42</b><span>Knowledge Nexus updated: Quantum Gravity Archive</span><b>07:41:31</b><span>Mission Horizon-7A: Data packet received</span><a href="/tasks">VIEW ALL LOGS →</a></footer>
    </div>
  );
}
