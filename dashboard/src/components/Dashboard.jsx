import React, { useEffect, useState } from 'react';
import { councilAPI, tasksAPI } from '../api/client';

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, approval_rate: 0, avg_score: 0 });
  const [recentTasks, setRecentTasks] = useState([]);

  useEffect(() => {
    councilAPI.stats().then(res => setStats(res.data));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">Total Tasks</h3>
          <p className="text-4xl font-bold text-indigo-800">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">Approval Rate</h3>
          <p className="text-4xl font-bold text-indigo-800">{(stats.approval_rate * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">Average Score</h3>
          <p className="text-4xl font-bold text-indigo-800">{stats.avg_score.toFixed(2)}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
        <div className="space-x-4">
          <button className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700">
            New Pipeline Task
          </button>
          <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
            New Experiment
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
