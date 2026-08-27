import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Agents from './components/Agents';
import Tasks from './components/Tasks';
import Council from './components/Council';
import Override from './components/Override';
import Constitution from './components/Constitution';
import AgentCatalog from './components/AgentCatalog';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('default');

  useEffect(() => {
    const token = localStorage.getItem('aetherion_token');
    const ws = localStorage.getItem('aetherion_workspace') || 'default';
    setIsAuthenticated(!!token);
    setWorkspaceId(ws);
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('aetherion_token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('aetherion_token');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-indigo-800 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">⚡ Aetherion Dashboard</h1>
            <div className="space-x-4">
              <Link to="/" className="hover:text-indigo-200">Dashboard</Link>
              <Link to="/agents" className="hover:text-indigo-200">Agents</Link>
              <Link to="/tasks" className="hover:text-indigo-200">Tasks</Link>
              <Link to="/council" className="hover:text-indigo-200">Council</Link>
              <Link to="/override" className="hover:text-indigo-200">Override</Link>
              <Link to={`/constitution/${workspaceId}`} className="hover:text-indigo-200">Constitution</Link>
              <Link to={`/catalog/${workspaceId}`} className="hover:text-indigo-200">Catalog</Link>
              <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-700">
                Logout
              </button>
            </div>
          </div>
        </nav>
        <main className="container mx-auto p-6">
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
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
