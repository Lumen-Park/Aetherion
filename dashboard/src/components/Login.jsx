import React, { useEffect, useState } from 'react';
import { authAPI } from '../api/client';

const capabilities = [
  ['70+', 'Specialist agents'], ['7', 'Council judges'], ['24/7', 'Policy enforcement'],
];

export default function Login({ onLogin }) {
  const [providers, setProviders] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [workspace, setWorkspace] = useState(localStorage.getItem('aetherion_workspace') || 'default');
  const [remember, setRemember] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState('');
  const [error, setError] = useState('');
  const [providerState, setProviderState] = useState('loading');

  const loadProviders = () => {
    setProviderState('loading');
    authAPI.providers().then((response) => {
      setProviders(response.data.providers || []);
      setProviderState('ready');
    }).catch(() => setProviderState('offline'));
  };

  useEffect(loadProviders, []);

  const handleApiKeyLogin = async (event) => {
    event.preventDefault();
    if (!apiKey.trim() || !workspace.trim()) {
      setError('Enter both a workspace and an API key to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login({ api_key: apiKey.trim() });
      onLogin({ token: response.data.access_token, workspace: workspace.trim(), remember });
    } catch (requestError) {
      const unavailable = !requestError.response;
      setError(unavailable ? 'The identity service is unavailable. Confirm the API is running and retry.' : 'We could not verify this API key. Check your credentials and permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setProviderLoading(provider);
    setError('');
    try {
      const response = await authAPI.oauthLoginUrl(provider);
      window.location.assign(response.data.url);
    } catch {
      setError(`Could not connect to ${provider}. Please retry or use an API key.`);
      setProviderLoading('');
    }
  };

  return <main className="login-shell">
    <section className="login-story" aria-label="Aetherion platform overview">
      <div className="brand-lockup"><span className="brand-mark">A</span><span><b>AETHERION</b><small>Enterprise Command</small></span></div>
      <div className="story-copy">
        <span className="status-pill"><i /> Systems operational</span>
        <p className="eyebrow">Governed intelligence infrastructure</p>
        <h1>Every decision.<br /><em>Accountable.</em></h1>
        <p>Orchestrate autonomous research with constitutional controls, observable reasoning, and human authority at every critical boundary.</p>
        <div className="capability-grid">{capabilities.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      </div>
      <div className="trust-row"><span>◆ SOC 2 controls</span><span>⌁ End-to-end audit</span><span>◉ Local-first</span></div>
    </section>

    <section className="login-access">
      <div className="access-card">
        <div className="access-heading"><p className="eyebrow">Secure access</p><h2>Welcome back</h2><p>Authenticate to enter your governed workspace.</p></div>
        <form onSubmit={handleApiKeyLogin} noValidate>
          <label htmlFor="workspace">Workspace</label>
          <div className="field-wrap"><span>⌂</span><input id="workspace" value={workspace} onChange={(event) => setWorkspace(event.target.value)} autoComplete="organization" placeholder="Workspace ID" /></div>
          <div className="label-row"><label htmlFor="api-key">API key</label><button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? 'Hide key' : 'Show key'}</button></div>
          <div className="field-wrap"><span>⌘</span><input id="api-key" type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="current-password" placeholder="ak_live_••••••••••••" autoFocus /></div>
          <label className="remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Keep me signed in on this device</span></label>
          {error && <div className="login-error" role="alert"><b>!</b><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          <button type="submit" className="login-submit" disabled={loading}>{loading ? <><span className="button-spinner" />Verifying identity…</> : <>Enter command center <span>→</span></>}</button>
        </form>
        <div className="auth-divider"><span>Enterprise identity</span></div>
        <div className="provider-list">
          {providerState === 'loading' && <div className="provider-skeleton"><span /><span /></div>}
          {providerState === 'offline' && <button className="provider-offline" type="button" onClick={loadProviders}>Identity providers unavailable <b>Retry</b></button>}
          {providers.map((provider) => <button type="button" className="provider-button" key={provider} disabled={!!providerLoading} onClick={() => handleOAuthLogin(provider)}><span className="provider-icon">{provider[0].toUpperCase()}</span>Continue with {provider}<b>{providerLoading === provider ? '···' : '→'}</b></button>)}
        </div>
        <p className="access-help">Need access? <a href="mailto:admin@aetherion.ai">Contact your workspace administrator</a></p>
      </div>
      <footer><span>Protected by Aetherion Zero Trust</span><span>Privacy · Security · Status</span></footer>
    </section>
  </main>;
}
