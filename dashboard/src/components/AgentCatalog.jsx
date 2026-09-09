import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client';

function AgentCatalog() {
  const { workspaceId } = useParams();
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('All');

  useEffect(() => {
    apiClient.get(`/agent-catalog/${workspaceId}`).then(res => setAgents(res.data.agents));
  }, [workspaceId]);

  const toggleAgent = async (name, enabled) => {
    // Build updated list atomically to avoid race condition
    const updated = agents.map(a => a.name === name ? { ...a, enabled } : a);
    setAgents(updated);
    const payload = Object.fromEntries(updated.map(a => [a.name, a.enabled]));
    await apiClient.put(`/agent-catalog/${workspaceId}`, { agents: updated });
  };

  const colleges = ['All', ...new Set(agents.map(a => a.college))];

  const filtered = agents.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
                          a.expertise.toLowerCase().includes(search.toLowerCase());
    const matchesCollege = collegeFilter === 'All' || a.college === collegeFilter;
    return matchesSearch && matchesCollege;
  });

  return (
    <div>
      <h2 className="page-title mb-6">Agent Catalog – {workspaceId}</h2>
      <p className="text-gray-600 mb-6">Enable or disable domain experts for this workspace.</p>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 field"
        />
        <select
          value={collegeFilter}
          onChange={(e) => setCollegeFilter(e.target.value)}
          className="field"
        >
          {colleges.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map(agent => (
          <div key={agent.name} className="panel p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold">{agent.name}</h3>
              <p className="text-sm text-gray-600">{agent.college} – {agent.expertise}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={agent.enabled}
                onChange={(e) => toggleAgent(agent.name, e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentCatalog;
