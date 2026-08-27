import React, { useState, useEffect } from 'react';
import { authAPI } from '../api/client';

function Login({ onLogin }) {
  const [providers, setProviders] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authAPI.providers().then(res => setProviders(res.data.providers));
  }, []);

  const handleApiKeyLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.login({ api_key: apiKey });
      onLogin(res.data.access_token);
    } catch (err) {
      alert('Invalid API key');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    const res = await authAPI.oauthLoginUrl(provider);
    window.location.href = res.data.url;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6 text-indigo-800">Aetherion Login</h2>
        
        <form onSubmit={handleApiKeyLogin} className="mb-6">
          <label className="block mb-2 font-medium">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4"
            placeholder="Enter your API key"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login with API Key'}
          </button>
        </form>

        {providers.length > 0 && (
          <div>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
            <div className="space-y-2">
              {providers.map(p => (
                <button
                  key={p}
                  onClick={() => handleOAuthLogin(p)}
                  className="w-full border border-gray-300 p-3 rounded-lg hover:bg-gray-50 capitalize"
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
