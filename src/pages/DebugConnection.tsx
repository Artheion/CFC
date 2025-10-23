import { useState, useEffect } from 'react';

/**
 * Debug Connection Page
 * Tests backend connectivity, WebSocket, and displays environment configuration
 */
export default function DebugConnection() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [apiError, setApiError] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [wsError, setWsError] = useState<string>('');
  
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'Not set';
  const bnbNetwork = import.meta.env.VITE_BNB_NETWORK || 'Not set';
  const rpcEndpoint = import.meta.env.VITE_RPC_ENDPOINT || 'Not set';
  const escrowContract = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || 'Not set';
  const cfcToken = import.meta.env.VITE_CFC_TOKEN_ADDRESS || 'Not set';

  // Test REST API
  useEffect(() => {
    const testApi = async () => {
      if (apiBaseUrl === 'Not set') {
        setApiStatus('error');
        setApiError('VITE_API_BASE_URL environment variable is not set');
        return;
      }

      try {
        console.log('[Debug] Testing REST API:', `${apiBaseUrl}/health`);
        const response = await fetch(`${apiBaseUrl}/health`, {
          method: 'GET',
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Debug] REST API response:', data);
          setApiStatus('success');
        } else {
          setApiStatus('error');
          setApiError(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err: any) {
        console.error('[Debug] REST API error:', err);
        setApiStatus('error');
        setApiError(err.message || 'Network error');
      }
    };

    testApi();
  }, [apiBaseUrl]);

  // Test WebSocket
  useEffect(() => {
    if (apiBaseUrl === 'Not set') {
      setWsStatus('error');
      setWsError('VITE_API_BASE_URL environment variable is not set');
      return;
    }

    const testWebSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        const wsBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
        console.log('[Debug] Testing WebSocket:', `${wsBaseUrl}/fights`);

        const socket = io(`${wsBaseUrl}/fights`, {
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnection: false,
        });

        socket.on('connect', () => {
          console.log('[Debug] WebSocket connected!');
          setWsStatus('success');
          socket.disconnect();
        });

        socket.on('connect_error', (err) => {
          console.error('[Debug] WebSocket error:', err);
          setWsStatus('error');
          setWsError(err.message || 'Connection failed');
          socket.disconnect();
        });
      } catch (err: any) {
        console.error('[Debug] WebSocket setup error:', err);
        setWsStatus('error');
        setWsError(err.message || 'Setup failed');
      }
    };

    testWebSocket();
  }, [apiBaseUrl]);

  const StatusBadge = ({ status }: { status: 'checking' | 'success' | 'error' }) => {
    const colors = {
      checking: 'bg-yellow-500/20 text-yellow-400',
      success: 'bg-green-500/20 text-green-400',
      error: 'bg-red-500/20 text-red-400',
    };
    const labels = {
      checking: '⏳ Testing...',
      success: '✅ Connected',
      error: '❌ Failed',
    };
    return (
      <span className={`px-3 py-1 rounded text-sm font-medium ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">🔍 Connection Debug</h1>

        {/* Environment Variables */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-4">Environment Variables</h2>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">VITE_API_BASE_URL:</span>
              <span className={apiBaseUrl === 'Not set' ? 'text-red-400' : 'text-green-400'}>
                {apiBaseUrl}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">VITE_BNB_NETWORK:</span>
              <span className="text-blue-400">{bnbNetwork}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">VITE_RPC_ENDPOINT:</span>
              <span className="text-blue-400 truncate max-w-md">{rpcEndpoint}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">VITE_ESCROW_CONTRACT_ADDRESS:</span>
              <span className="text-purple-400 truncate">{escrowContract}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">VITE_CFC_TOKEN_ADDRESS:</span>
              <span className="text-purple-400 truncate">{cfcToken}</span>
            </div>
          </div>
        </div>

        {/* REST API Test */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">REST API</h2>
            <StatusBadge status={apiStatus} />
          </div>
          {apiError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
              <p className="text-red-400 text-sm font-mono">{apiError}</p>
            </div>
          )}
          {apiStatus === 'success' && (
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <p className="text-green-400 text-sm">Backend REST API is accessible!</p>
            </div>
          )}
        </div>

        {/* WebSocket Test */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">WebSocket</h2>
            <StatusBadge status={wsStatus} />
          </div>
          {wsError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
              <p className="text-red-400 text-sm font-mono">{wsError}</p>
            </div>
          )}
          {wsStatus === 'success' && (
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <p className="text-green-400 text-sm">WebSocket connection successful!</p>
            </div>
          )}
        </div>

        {/* Troubleshooting */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">💡 Troubleshooting</h2>
          <ul className="space-y-2 text-yellow-200 text-sm">
            <li>• Check that backend is deployed and running on Render</li>
            <li>• Verify <code className="bg-black/30 px-1 rounded">VITE_API_BASE_URL</code> is set in Render frontend environment</li>
            <li>• Backend URL should be like: <code className="bg-black/30 px-1 rounded">https://cfc-backend.onrender.com/api</code></li>
            <li>• WebSocket URL will auto-strip <code className="bg-black/30 px-1 rounded">/api</code> (e.g., <code className="bg-black/30 px-1 rounded">wss://cfc-backend.onrender.com/fights</code>)</li>
            <li>• Make sure CORS_ORIGIN is set in backend to allow your frontend URL</li>
            <li>• Check backend logs for connection errors</li>
          </ul>
        </div>

        {/* Console Logs */}
        <div className="mt-6 bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-2">📋 Console Output</h2>
          <p className="text-gray-400 text-sm">Check browser console (F12) for detailed logs</p>
        </div>
      </div>
    </div>
  );
}

