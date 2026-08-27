import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
    const move = event => {
      const x = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      if (dot.current) dot.current.style.transform = x;
      if (ring.current) ring.current.style.transform = x;
      if (halo.current) halo.current.style.transform = x;
    };
    const down = () => document.body.classList.add('cursor-pressed'); const up = () => document.body.classList.remove('cursor-pressed');
    const refresh = () => document.querySelectorAll('a,button,input,select,textarea').forEach(element => {
      element.addEventListener('mouseenter', () => document.body.classList.add('cursor-target'));
      element.addEventListener('mouseleave', () => document.body.classList.remove('cursor-target'));
    });
    window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); refresh();
    const observer = new MutationObserver(refresh); observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); observer.disconnect(); document.body.classList.remove('cursor-target', 'cursor-pressed'); };
  }, []);
  return <><span ref={halo} className="aether-cursor-halo" aria-hidden="true" /><span ref={ring} className="aether-cursor-ring" aria-hidden="true" /><span ref={dot} className="aether-cursor-dot" aria-hidden="true" /></>;
}

function BootSequence() {
  return <div className="boot-sequence" role="status" aria-label="Initializing Aetherion"><div className="boot-sigil"><span />△</div><div className="boot-wordmark">AETHERION</div><div className="boot-caption">GUARDIAN OF KNOWLEDGE · ALLY IN EVOLUTION</div><div className="boot-progress"><i /></div><div className="boot-state">ESTABLISHING ORBITAL LINK <span>07</span></div></div>;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false); const [workspaceId, setWorkspaceId] = useState('default'); const [booting, setBooting] = useState(true); const staticDemo = import.meta.env.VITE_STATIC_DEMO === 'true';
  useEffect(() => { setIsAuthenticated(!!localStorage.getItem('aetherion_token')); setWorkspaceId(localStorage.getItem('aetherion_workspace') || 'default'); const timer = window.setTimeout(() => setBooting(false), 1000); return () => window.clearTimeout(timer); }, []);
  const login = token => { localStorage.setItem('aetherion_token', token); setIsAuthenticated(true); }; const logout = () => { localStorage.removeItem('aetherion_token'); localStorage.removeItem('aetherion_refresh_token'); setIsAuthenticated(false); };
  if (booting) return <BootSequence />;
  if (!isAuthenticated && !staticDemo) return <><CursorSystem /><Login onLogin={login} /></>;
  return <><CursorSystem /><HashRouter><Routes><Route path="/" element={<Dashboard onLogout={logout} workspaceId={workspaceId} />} /><Route path="/legacy/agents" element={<Agents />} /><Route path="/legacy/tasks" element={<Tasks />} /><Route path="/legacy/council" element={<Council />} /><Route path="/legacy/override" element={<Override />} /><Route path="/legacy/constitution/:workspaceId" element={<Constitution />} /><Route path="/legacy/catalog/:workspaceId" element={<AgentCatalog />} /><Route path="*" element={<Navigate to="/" />} /></Routes></HashRouter></>;
}
