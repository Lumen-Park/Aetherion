import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Agents from './components/Agents';
import Tasks from './components/Tasks';
import Council from './components/Council';
import Override from './components/Override';
import Constitution from './components/Constitution';
import AgentCatalog from './components/AgentCatalog';
import BootScreen from './components/BootScreen';

const navigation = [
  ['/', 'Overview', '⌘'], ['/agents', 'Agents', '◌'], ['/tasks', 'Launch task', '↗'],
  ['/council', 'Council', '◇'], ['/override', 'Override', '!'],
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [workspaceId, setWorkspaceId] = useState('default');
  const [menuOpen, setMenuOpen] = useState(false);
  const [cursor, setCursor] = useState({ x: -100, y: -100 });
  useEffect(() => {
    const startedAt = Date.now();
    const restoreSession = () => {
      setIsAuthenticated(!!(localStorage.getItem('aetherion_token') || sessionStorage.getItem('aetherion_token')));
      setWorkspaceId(localStorage.getItem('aetherion_workspace') || 'default');
    };
    const timer = window.setTimeout(restoreSession, Math.max(0, 1100 - (Date.now() - startedAt)));
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const move = (event) => setCursor({ x: event.clientX, y: event.clientY });
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);
  const logout = () => {
    localStorage.removeItem('aetherion_token');
    sessionStorage.removeItem('aetherion_token');
    setIsAuthenticated(false);
  };
  if (isAuthenticated === null) return <BootScreen />;
  if (!isAuthenticated) return <Login onLogin={({ token, workspace, remember }) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('aetherion_token', token);
    localStorage.setItem('aetherion_workspace', workspace);
    setWorkspaceId(workspace);
    setIsAuthenticated(true);
  }} />;

  return <BrowserRouter basename={import.meta.env.BASE_URL}><div className="app-shell relative"><span className="cursor-orb" style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }} aria-hidden="true" />
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/25 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
        <NavLink to="/" className="flex items-center gap-3 text-white"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-lg font-black text-slate-950 shadow-lg shadow-indigo-500/20">A</span><span><b className="block text-sm tracking-wide">AETHERION</b><small className="text-[10px] font-bold tracking-[.2em] text-cyan-200/70">COMMAND CENTER</small></span></NavLink>
        <button onClick={() => setMenuOpen(!menuOpen)} className="btn-secondary px-3 py-2 lg:hidden" aria-label="Toggle navigation">☰</button>
        <nav className={`${menuOpen ? 'absolute left-5 right-5 top-[68px] flex' : 'hidden'} glass flex-col gap-1 rounded-xl p-2 lg:static lg:flex lg:flex-row lg:items-center lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
          {navigation.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)} className={({isActive}) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><span className="mr-2 text-indigo-200">{icon}</span>{label}</NavLink>)}
          <NavLink to={`/constitution/${workspaceId}`} className="nav-link">Constitution</NavLink><NavLink to={`/catalog/${workspaceId}`} className="nav-link">Catalog</NavLink>
          <button onClick={logout} className="btn-danger ml-1 px-3 py-2">Sign out</button>
        </nav>
      </div>
    </header>
    <main className="relative mx-auto max-w-7xl px-5 py-10 lg:px-8"><Routes><Route path="/" element={<Dashboard />} /><Route path="/agents" element={<Agents />} /><Route path="/tasks" element={<Tasks />} /><Route path="/council" element={<Council />} /><Route path="/override" element={<Override />} /><Route path="/constitution/:workspaceId" element={<Constitution />} /><Route path="/catalog/:workspaceId" element={<AgentCatalog />} /><Route path="*" element={<Navigate to="/" />} /></Routes></main>
  </div></BrowserRouter>;
}
export default App;
