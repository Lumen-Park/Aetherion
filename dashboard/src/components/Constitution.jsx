import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client';

function Constitution() {
  const { workspaceId } = useParams();
  const [constitution, setConstitution] = useState({ judges: {}, thresholds: {} });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState({ output: '', goal: '' });
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    fetchConstitution();
    fetchAuditLog();
  }, [workspaceId]);

  const fetchConstitution = async () => {
    const res = await apiClient.get(`/constitution/${workspaceId}`);
    setConstitution(res.data.constitution);
  };

  const fetchAuditLog = async () => {
    const res = await apiClient.get(`/constitution/${workspaceId}/audit?limit=20`);
    setAuditLog(res.data.audit);
  };

  const updateJudge = (name, field, value) => {
    setConstitution(prev => ({
      ...prev,
      judges: {
        ...prev.judges,
        [name]: { ...prev.judges[name], [field]: value }
      }
    }));
  };

  const updateThreshold = (name, value) => {
    setConstitution(prev => ({
      ...prev,
      thresholds: { ...prev.thresholds, [name]: parseFloat(value) }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiClient.put(`/constitution/${workspaceId}`, constitution);
      setSaved(true);
      fetchAuditLog();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save constitution');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await apiClient.post('/constitution/preview', {
        output: preview.output,
        goal: preview.goal,
        constitution: constitution,
      });
      setPreviewResult(res.data);
    } catch (err) {
      alert('Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetToDefault = async () => {
    const defaultRes = await apiClient.get('/constitution/default');
    setConstitution(defaultRes.data.constitution);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Constitution Editor – {workspaceId}</h2>
      <p className="text-gray-600 mb-6">Customize judge prompts, voting thresholds, and test changes live.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Editor */}
        <div>
          {/* Thresholds */}
          <div className="panel p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Voting Thresholds</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block mb-2">Approved Threshold</label>
                <input
                  type="range"
                  min="5.0"
                  max="9.0"
                  step="0.1"
                  value={constitution.thresholds.approved || 7.0}
                  onChange={(e) => updateThreshold('approved', e.target.value)}
                  className="w-full"
                />
                <span className="text-lg font-bold ml-2">{constitution.thresholds.approved || 7.0}</span>
              </div>
              <div>
                <label className="block mb-2">Revision Required Threshold</label>
                <input
                  type="range"
                  min="3.0"
                  max="7.0"
                  step="0.1"
                  value={constitution.thresholds.revision || 5.0}
                  onChange={(e) => updateThreshold('revision', e.target.value)}
                  className="w-full"
                />
                <span className="text-lg font-bold ml-2">{constitution.thresholds.revision || 5.0}</span>
              </div>
            </div>
          </div>

          {/* Judges */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {Object.entries(constitution.judges).map(([name, config]) => (
              <div key={name} className="panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">{name}</h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.enabled !== false}
                      onChange={(e) => updateJudge(name, 'enabled', e.target.checked)}
                      className="mr-2"
                    />
                    Enabled
                  </label>
                </div>
                <textarea
                  value={config.prompt || ''}
                  onChange={(e) => updateJudge(name, 'prompt', e.target.value)}
                  rows="4"
                  className="field font-mono text-sm"
                  disabled={!config.enabled}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={resetToDefault}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Reset to Default
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Saving...' : 'Save Constitution'}
            </button>
          </div>
          {saved && <p className="text-green-600 mt-2">✓ Saved</p>}

          {/* Audit Log Toggle */}
          <div className="mt-6">
            <button
              onClick={() => setShowAudit(!showAudit)}
              className="text-indigo-600 underline"
            >
              {showAudit ? 'Hide' : 'Show'} Audit History ({auditLog.length} changes)
            </button>
            {showAudit && (
              <div className="mt-4 bg-slate-950/30 border border-white/10 p-4 rounded-xl text-slate-200 max-h-64 overflow-y-auto text-sm">
                {auditLog.map((entry, i) => (
                  <div key={i} className="border-b py-2">
                    <p className="font-semibold">{new Date(entry.timestamp * 1000).toLocaleString()}</p>
                    <p>Operator: {entry.operator}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Live Preview */}
        <div>
          <div className="panel p-6">
            <h3 className="text-xl font-semibold mb-4">Live Preview</h3>
            <label className="block mb-2">Sample Output</label>
            <textarea
              value={preview.output}
              onChange={(e) => setPreview({ ...preview, output: e.target.value })}
              rows="4"
              className="field mb-4"
              placeholder="Paste an example AI output..."
            />
            <label className="block mb-2">Original Goal</label>
            <input
              type="text"
              value={preview.goal}
              onChange={(e) => setPreview({ ...preview, goal: e.target.value })}
              className="field mb-4"
              placeholder="e.g., Write a secure login function"
            />
            <button
              onClick={handlePreview}
              disabled={previewLoading || !preview.output || !preview.goal}
              className="btn-primary w-full"
            >
              {previewLoading ? 'Running...' : 'Run Preview'}
            </button>

            {previewResult && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-lg mb-2">Result</h4>
                <p className="mb-2">
                  Verdict: 
                  <span className={`font-bold ml-2 ${
                    previewResult.verdict === 'APPROVED' ? 'text-green-600' :
                    previewResult.verdict === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {previewResult.verdict}
                  </span>
                </p>
                <p className="mb-2">Score: <span className="font-bold">{previewResult.score?.toFixed(2)}</span></p>
                <p className="mb-2">Thresholds Used: Approved ≥ {previewResult.thresholds_used.approved}, Revision ≥ {previewResult.thresholds_used.revision}</p>
                <p className="mb-2">Enabled Judges: {previewResult.judges_enabled.join(', ')}</p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-indigo-600">View Votes</summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(previewResult.votes, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Constitution;
