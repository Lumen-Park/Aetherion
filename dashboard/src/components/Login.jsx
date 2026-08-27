import React, { useEffect, useState } from 'react';
import { authAPI } from '../api/client';
import UniverseCanvas from './UniverseCanvas';

function Login({ onLogin }) {
  const [providers, setProviders] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { authAPI.providers().then(res => setProviders(res.data.providers || [])).catch(() => setProviders([])); }, []);

  const handleApiKeyLogin = async (event) => {
    event.preventDefault();
    if (!apiKey.trim()) return setError('Enter an API key to continue.');
    setLoading(true); setError('');
    try {
      const res = await authAPI.login({ api_key: apiKey.trim() });
      onLogin(res.data.access_token);
      if (res.data.refresh_token) localStorage.setItem('aetherion_refresh_token', res.data.refresh_token);
    } catch { setError('That API key could not be verified. Check it and try again.'); }
    finally { setLoading(false); }
  };

  const handleOAuthLogin = async (provider) => {
    setError('');
    try { const res = await authAPI.oauthLoginUrl(provider); window.location.href = res.data.url; }
    catch { setError(`Unable to start ${provider} sign-in right now.`); }
  };

  return (
    <div className="auth-page">
      <UniverseCanvas />
      <div className="universe-vignette" aria-hidden="true" />
      <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
      <div className="auth-layout">
        <section className="auth-story"><div className="brand-lockup auth-brand"><div className="brand-mark">A</div><div><div className="brand-name">Aetherion</div><div className="brand-subtitle">Research intelligence</div></div></div><div className="story-copy"><span className="story-kicker">Autonomous research, considered</span><h1>Turn complex questions into <em>clear discoveries.</em></h1><p>Coordinate a network of specialist agents, challenge every conclusion, and keep your research grounded in evidence.</p></div><div className="story-proof"><span className="proof-line" /><span>Built for ambitious teams</span></div></section>
        <section className="auth-card"><div className="auth-card-heading"><span className="secure-label"><span className="secure-dot" /> Secure workspace access</span><h2>Welcome back</h2><p>Sign in to continue your research workspace.</p></div><form onSubmit={handleApiKeyLogin}><label htmlFor="api-key">API key</label><div className="auth-input-wrap"><span className="key-symbol">⌘</span><input id="api-key" type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Paste your API key" autoComplete="current-password" /></div>{error && <div className="auth-error" role="alert">{error}</div>}<button type="submit" className="auth-submit" disabled={loading}>{loading ? <><span className="spinner" /> Verifying access...</> : <>Continue securely <span>→</span></>}</button></form>{providers.length > 0 && <><div className="auth-divider"><span>or continue with</span></div><div className="provider-grid">{providers.map(provider => <button key={provider} onClick={() => handleOAuthLogin(provider)} className="provider-button"><span className="provider-icon">{provider === 'google' ? 'G' : '◈'}</span><span className="capitalize">{provider}</span></button>)}</div></>}<p className="auth-footnote">By continuing, you agree to your workspace security policy.</p></section>
      </div>
    </div>
  );
}

export default Login;
