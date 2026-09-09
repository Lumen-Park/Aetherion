import React, { useEffect, useState, useRef } from 'react';
import { councilAPI, connectDeliberationSocket } from '../api/client';

function Council() {
  const [stats, setStats] = useState({ total: 0, approval_rate: 0, avg_score: 0 });
  const [judges, setJudges] = useState([]);
  const [liveVotes, setLiveVotes] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    councilAPI.stats().then(res => setStats(res.data));
    councilAPI.judges().then(res => setJudges(res.data.judges));

    wsRef.current = connectDeliberationSocket((data) => {
      if (data.type === 'vote') {
        setLiveVotes(prev => [data, ...prev].slice(0, 10));
      }
    });

    return () => wsRef.current?.close();
  }, []);

  return (
    <div>
      <h2 className="page-title mb-6">Council Monitor</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="panel p-6">
          <h3 className="text-lg font-semibold text-gray-600">Total Verdicts</h3>
          <p className="text-4xl font-bold text-indigo-800">{stats.total}</p>
        </div>
        <div className="panel p-6">
          <h3 className="text-lg font-semibold text-gray-600">Approval Rate</h3>
          <p className="text-4xl font-bold text-indigo-800">{(stats.approval_rate * 100).toFixed(1)}%</p>
        </div>
        <div className="panel p-6">
          <h3 className="text-lg font-semibold text-gray-600">Average Score</h3>
          <p className="text-4xl font-bold text-indigo-800">{stats.avg_score.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-6">
          <h3 className="text-xl font-semibold mb-4">Judges</h3>
          <ul className="divide-y">
            {judges.map(judge => (
              <li key={judge} className="py-3 flex items-center">
                <span className="w-3 h-3 bg-indigo-600 rounded-full mr-3"></span>
                {judge}
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold mb-4">Live Deliberation</h3>
          {liveVotes.length === 0 ? (
            <p className="text-gray-500">Waiting for council activity...</p>
          ) : (
            <ul className="divide-y">
              {liveVotes.map((vote, i) => (
                <li key={i} className="py-3">
                  <span className="font-semibold">{vote.judge}</span>: {vote.verdict} (Score: {vote.score})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Council;
