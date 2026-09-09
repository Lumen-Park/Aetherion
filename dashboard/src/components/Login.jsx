import React, { useState, useEffect } from 'react';
import { authAPI } from '../api/client';

function Login({ onLogin }) {
  const [providers, setProviders] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authAPI.providers().then(res => setProviders(res.data.providers)).catch(() => setProviders([]));
  }, []);

  const handleApiKeyLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await authAPI.login({ api_key: apiKey });
      onLogin(res.data.access_token);
    } catch (err) {
      setError('We couldn’t verify that API key. Check it and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    const res = await authAPI.oauthLoginUrl(provider);
    window.location.href = res.data.url;
  };

  return (
    <div className="app-shell min-h-screen flex items-center justify-center p-5">
      <div className="panel w-full max-w-md p-7 md:p-9">
        <div className="mb-8 text-center"><span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-xl font-black text-slate-950">A</span><p className="eyebrow">Command center</p><h2 className="mt-2 text-3xl font-extrabold text-white">Welcome back.</h2><p className="mt-2 text-sm text-slate-300">Sign in to your governed workspace.</p></div>
        
        <form onSubmit={handleApiKeyLogin} className="mb-6">
          <label className="block mb-2 text-sm font-bold text-slate-200">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="field mb-4"
            placeholder="Enter your API key"
          />
          {error && <p className="mb-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100" role="alert">{error}</p>}<button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Logging in...' : 'Login with API Key'}
          </button>
        </form>

        {providers.length > 0 && (
          <div>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-[#111a30] text-slate-400">Or continue with</span>
              </div>
            </div>
            <div className="space-y-2">
              {providers.map(p => (
                <button
                  key={p}
                  onClick={() => handleOAuthLogin(p)}
                  className="btn-secondary w-full capitalize"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
