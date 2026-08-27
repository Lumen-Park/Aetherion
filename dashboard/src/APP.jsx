import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Agents from './components/Agents';
import Tasks from './components/Tasks';
import Council from './components/Council';
import Override from './components/Override';
import Constitution from './components/Constitution';
import AgentCatalog from './components/AgentCatalog';

function CursorSystem() {
  const dot = useRef(null); const ring = useRef(null); const halo = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;
    const move = event => { if (dot.current) dot.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`; if (ring.current) ring.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`; if (halo.current) halo.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`; };
    const down = () => document.body.classList.add('cursor-pressed'); const up = () => document.body.classList.remove('cursor-pressed');
    const refresh = () => document.querySelectorAll('a,button,input,select,textarea').forEach(element => { element.addEventListener('mouseenter', () => document.body.classList.add('cursor-target')); element.addEventListener('mouseleave', () => document.body.classList.remove('cursor-target')); });
    window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); refresh();
    const observer = new MutationObserver(refresh); observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); observer.disconnect(); document.body.classList.remove('cursor-target', 'cursor-pressed'); };
  }, []);
  return <><span ref={halo} className="aether-cursor-halo" aria-hidden="true" /><span ref={ring} className="aether-cursor-ring" aria-hidden="true" /><span ref={dot} className="aether-cursor-dot" aria-hidden="true" /></>;
}

function BootSequence() { return <div className="boot-sequence" role="status" aria-label="Initializing Aetherion"><div className="boot-sigil"><span /><b>△</b></div><div className="boot-wordmark">AETHERION</div><div className="boot-caption">GUARDIAN OF KNOWLEDGE · ALLY IN EVOLUTION</div><div className="boot-progress"><i /></div><div className="boot-state">ESTABLISHING ORBITAL LINK <span>07</span></div></div>; }

const NAV = [
  ['/', '⌂', 'Command Deck'],
  ['/agents', '◈', 'AI Agents', '67'],
  ['/tasks', '◇', 'Missions'],
  ['/council', '△', 'Supreme Council', '7'],
  ['/override', '⊙', 'Override'],
  ['/constitution/', '▣', 'Constitution'],
  ['/catalog/', '✦', 'Agent Catalog'],
];

function Shell({ children, workspaceId, onLogout }) {
  const { pathname: path } = useLocation();
  const active = (to) => to === '/' ? path === '/' : path.startsWith(to.replace(/\/$/, ''));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStart = useRef(null);
  const handleTouchStart = (event) => { const point = event.touches[0]; if (point.clientX < 44) touchStart.current = point.clientX; };
  const handleTouchEnd = (event) => { if (touchStart.current !== null && event.changedTouches[0].clientX - touchStart.current > 55) setDrawerOpen(true); touchStart.current = null; };
  return (
    <div className="aetherion-app" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <CursorSystem />
      <div className="space-layer space-a" />
      <div className="space-layer space-b" />
      <div className="space-stars" />
      <div className="planet-glow" />

      <button className={`edge-reveal edge-left ${drawerOpen ? 'is-open' : ''}`} onClick={() => setDrawerOpen(value => !value)} aria-label={drawerOpen ? 'Hide navigation' : 'Reveal navigation'}><span />{drawerOpen ? '‹' : '›'}</button>
      <aside className={`aetherion-sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-glyph">△</div>
          <div><div className="brand-name">AETHERION</div><div className="brand-caption">INTELLIGENCE SYSTEM</div></div>
        </div>
        <div className="core-status"><i /> CORE ONLINE</div>

        <nav className="aetherion-nav">
          {NAV.map(([to, icon, label, badge]) => {
            const href = to.endsWith('/') && to !== '/' ? `${to}${workspaceId}` : to;
            const routeHref = `#${href}`;
            return (
              <a key={to} href={routeHref} onClick={() => setDrawerOpen(false)} className={active(to) ? 'active' : ''}>
                <span className="nav-symbol">{icon}</span><span>{label}</span>{badge && <b>{badge}</b>}
              </a>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <span>AETHERION / V7</span>
            <strong>Guardian of knowledge.<br/>Partner in discovery.</strong>
            <small>LOCAL AUTONOMOUS CORE</small>
          </div>
          <button onClick={onLogout} className="logout-btn">Terminate session <span>↗</span></button>
        </div>
      </aside>

      <section className="aetherion-main">
        <header className="aetherion-topbar">
          <div><span className="live-badge"><i/> LIVE</span><span className="route-label">AETHERION / COMMAND DECK</span></div>
          <div className="top-actions">
            <span className="telemetry">SOL 27,946,312.77</span><span className="top-icon">⌕</span><span className="top-icon">◌</span>
            <div className="operator"><span className="operator-orb">✦</span><span><b>SOUL KEEPER</b><small>Administrator</small></span><span>⌄</span></div>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('default');
  const staticDemo = import.meta.env.VITE_STATIC_DEMO === 'true';
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem('aetherion_token'));
    setWorkspaceId(localStorage.getItem('aetherion_workspace') || 'default');
    const timer = window.setTimeout(() => setBooting(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const login = (token) => { localStorage.setItem('aetherion_token', token); setIsAuthenticated(true); };
  const logout = () => { localStorage.removeItem('aetherion_token'); setIsAuthenticated(false); };

  if (booting) return <BootSequence />;
  if (!isAuthenticated && !staticDemo) return <Login onLogin={login} />;

  return (
    <HashRouter>
      <Shell workspaceId={workspaceId} onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/council" element={<Council />} />
          <Route path="/override" element={<Override />} />
          <Route path="/constitution/:workspaceId" element={<Constitution />} />
          <Route path="/catalog/:workspaceId" element={<AgentCatalog />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
