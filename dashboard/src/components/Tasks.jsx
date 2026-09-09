import React, { useState } from 'react';
import { tasksAPI, apiClient } from '../api/client';

function Tasks() {
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState('pipeline');
  const [taskId, setTaskId] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);

  const generateIdempotencyKey = () => `${Date.now()}-${Math.random().toString(36)}`;

  const submitTask = async () => {
    setLoading(true);
    const key = generateIdempotencyKey();
    try {
      const res = await tasksAPI.runPipeline(goal, mode, key);
      setTaskId(res.data.task_id);
      setProgress(null);
      pollStatus(res.data.task_id);
    } catch (err) {
      alert('Failed to submit task');
      setLoading(false);
    }
  };

  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const [statusRes, progressRes] = await Promise.all([
          tasksAPI.getPipelineStatus(id),
          apiClient.get(`/tasks/pipeline/${id}/progress`).catch(() => null)
        ]);
        setStatus(statusRes.data);
        if (progressRes) setProgress(progressRes.data);
        if (statusRes.data.status === 'completed' || statusRes.data.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (err) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 2000);
  };

  return (
    <div>
      <p className="eyebrow">Execution studio</p><h1 className="page-title">Launch a deliberate task.</h1><p className="page-subtitle mb-8">Choose a workflow, describe the outcome, and follow its governed progress in real time.</p>
      <div className="panel p-6 md:p-8 mb-6">
        <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-400/15 text-indigo-200">↗</span><div><h2 className="font-bold text-white">New request</h2><p className="text-xs text-slate-400">A unique run is created when you launch.</p></div></div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Enter your task goal..."
          className="field mb-4 min-h-28 resize-y"
          rows="3"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="field mb-4 w-full md:mr-3 md:w-48"
        >
          <option value="pipeline">Pipeline</option>
          <option value="lab">Experiment</option>
          <option value="invent">Invention</option>
        </select>
        <button
          onClick={submitTask}
          disabled={loading || !goal}
          className="btn-primary mb-4"
        >
          {loading ? 'Processing...' : 'Run Task'}
        </button>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="panel p-6 mb-6">
          <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-semibold text-white">Task progress</h3><span className="rounded-full bg-indigo-400/15 px-3 py-1 text-xs font-bold text-indigo-200">{progress.state}</span></div>
          <div className="w-full bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-cyan-300 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.progress_percent}%` }}
            ></div>
          </div>
          <p className="text-sm text-slate-300">
            Estimated remaining: {Math.round(progress.estimated_remaining)} seconds
          </p>
        </div>
      )}

      {status && (
        <div className="panel p-6">
          <h3 className="text-xl font-semibold mb-4 text-white">Task status <span className="ml-2 text-sm font-medium text-indigo-200">{status.status}</span></h3>
          {status.council_verdict && (
            <div className="mb-4">
              <p className="font-semibold">
                Council Verdict:
                <span className={`ml-2 ${
                  status.council_verdict.verdict === 'APPROVED' ? 'text-green-600' :
                  status.council_verdict.verdict === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {status.council_verdict.verdict} (Score: {status.council_verdict.score?.toFixed(2)})
                </span>
              </p>
            </div>
          )}
          {status.result && (
            <pre className="bg-slate-950/40 border border-white/5 text-slate-200 p-4 rounded-xl overflow-auto max-h-96 text-xs">
              {status.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default Tasks;
