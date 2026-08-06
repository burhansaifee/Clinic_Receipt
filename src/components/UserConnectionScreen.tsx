import React, { useState, useEffect } from 'react';
import { User, AlertCircle, RefreshCw, KeyRound, Server, Settings } from 'lucide-react';

interface UserConnectionScreenProps {
  onConnected: (userId: string, role: string, doctorId?: string) => void;
}

const UserConnectionScreen: React.FC<UserConnectionScreenProps> = ({ onConnected }) => {
  const [userIdInput, setUserIdInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'none' | 'input' | 'setup'>('none');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');


  // Network Connection Settings
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [workstationMode, setWorkstationMode] = useState<'standalone' | 'host' | 'client'>('standalone');
  const [hostIp, setHostIp] = useState('127.0.0.1');
  const [hostPort, setHostPort] = useState(49152);
  const [localIp, setLocalIp] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {

    // Load connection settings
    // @ts-ignore
    if (window.connection) {
      // @ts-ignore
      window.connection.getSettings().then(settings => {
        setWorkstationMode(settings.mode);
        setHostIp(settings.hostIp);
        setHostPort(settings.hostPort);
        setLocalIp(settings.localIp);
      });
    }
  }, []);

  const handleTestConnection = async () => {
    if (!hostIp.trim()) {
      alert('Please enter a Host IP Address');
      return;
    }
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      // @ts-ignore
      const result = await window.connection.testConnection(hostIp.trim(), hostPort);
      if (result.success) {
        setTestResult({ success: true, message: 'Connection Successful! Host is reachable.' });
      } else {
        setTestResult({ success: false, message: `Connection Failed: ${result.error || 'Server unreachable.'}` });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: `Error: ${e.message}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveConnectionSettings = async () => {
    if (workstationMode === 'client' && !hostIp.trim()) {
      alert('Please enter a Host IP Address');
      return;
    }
    if (confirm('MedFlow Clinic needs to relaunch to apply these connection settings. Proceed?')) {
      try {
        // @ts-ignore
        await window.connection.saveSettings({
          mode: workstationMode,
          hostIp: hostIp.trim(),
          hostPort: hostPort
        });
      } catch (err: any) {
        alert(`Failed to save settings: ${err.message}`);
      }
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdInput.trim()) return;

    setIsConnecting(true);
    setError(null);

    try {
      if (passwordMode === 'none') {
        // @ts-ignore
        const result = await window.users.connectUser(userIdInput.trim());
        if (result.success) {
          if (result.requirePasswordSetup) {
            setPasswordMode('setup');
          } else {
            onConnected(userIdInput.trim().toLowerCase(), result.role, result.doctorId);
          }
        } else {
          if (result.requirePasswordInput) {
            setPasswordMode('input');
          } else {
            setError(result.error || 'Access Denied: User ID is not recognized.');
          }
        }
      } else if (passwordMode === 'input') {
        // @ts-ignore
        const result = await window.users.connectUser(userIdInput.trim(), password);
        if (result.success) {
          onConnected(userIdInput.trim().toLowerCase(), result.role, result.doctorId);
        } else {
          setError(result.error || 'Incorrect password.');
        }
      } else if (passwordMode === 'setup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsConnecting(false);
          return;
        }
        if (password.length < 4) {
          setError('Password must be at least 4 characters.');
          setIsConnecting(false);
          return;
        }

        // @ts-ignore
        const setupResult = await window.users.setUserPassword(userIdInput.trim(), password);
        if (setupResult.success) {
          // @ts-ignore
          const connectResult = await window.users.connectUser(userIdInput.trim(), password);
          if (connectResult.success) {
            onConnected(userIdInput.trim().toLowerCase(), connectResult.role, connectResult.doctorId);
          } else {
            setError(connectResult.error || 'Failed to connect after setting password.');
          }
        } else {
          setError(setupResult.error || 'Failed to set password.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Please check backend connection.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="connection-overlay">
      <div className="glow-container">
        <div className="glow-sphere sphere-1"></div>
        <div className="glow-sphere sphere-2"></div>
      </div>

      <div className="connection-card">
        {!showNetworkSettings && (
          <button 
            type="button" 
            className="network-settings-btn"
            onClick={() => setShowNetworkSettings(true)}
            title="Configure Workstation Connection"
            style={{
              position: 'absolute',
              top: '1.25rem',
              right: '1.25rem',
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '50%',
              transition: 'all 0.2s',
              zIndex: 15
            }}
          >
            <Settings size={18} />
          </button>
        )}

        {showNetworkSettings ? (
          <>
            <div className="connection-header">
              <div className="logo-badge">
                <Server size={28} className="logo-icon animate-pulse-slow" />
              </div>
              <h1>Network Settings</h1>
              <p className="subtitle">
                Configure this workstation's role in the clinic network
              </p>
            </div>

            <div className="connection-form">
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workstation Mode</label>
                <select 
                  value={workstationMode}
                  onChange={(e) => setWorkstationMode(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '0.975rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="standalone" style={{ background: '#1e293b' }}>Standalone (Local DB)</option>
                  <option value="host" style={{ background: '#1e293b' }}>Host / Server (Expose DB)</option>
                  <option value="client" style={{ background: '#1e293b' }}>Client (Connect to Host)</option>
                </select>
              </div>

              {workstationMode === 'client' && (
                <>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Host IP Address</label>
                      <input 
                        type="text"
                        value={hostIp}
                        onChange={(e) => setHostIp(e.target.value)}
                        placeholder="e.g. 192.168.1.50"
                        style={{
                          padding: '0.875rem 1rem',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          color: 'white',
                          fontSize: '0.975rem',
                          width: '100%',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Port</label>
                      <input 
                        type="number"
                        value={hostPort}
                        onChange={(e) => setHostPort(Number(e.target.value))}
                        placeholder="49152"
                        style={{
                          padding: '0.875rem 1rem',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          color: 'white',
                          fontSize: '0.975rem',
                          width: '100%',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {testResult && (
                    <div style={{ 
                      background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                      border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, 
                      borderRadius: '8px', 
                      padding: '0.625rem 0.875rem', 
                      marginBottom: '1.25rem',
                      fontSize: '0.825rem', 
                      color: testResult.success ? '#a7f3d0' : '#fca5a5'
                    }}>
                      {testResult.message}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button 
                      type="button" 
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      style={{ 
                        flex: 1, 
                        padding: '0.875rem', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        fontWeight: 600, 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        color: '#cbd5e1', 
                        cursor: 'pointer' 
                      }}
                      className="network-sub-btn"
                    >
                      {isTestingConnection ? 'Testing...' : 'Test'}
                    </button>
                    <button 
                      type="button" 
                      className="btn-connect" 
                      onClick={handleSaveConnectionSettings}
                      style={{ flex: 1.5, margin: 0 }}
                    >
                      Save & Relaunch
                    </button>
                  </div>
                </>
              )}

              {workstationMode === 'host' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Port</label>
                    <input 
                      type="number"
                      value={hostPort}
                      onChange={(e) => setHostPort(Number(e.target.value))}
                      placeholder="49152"
                      style={{
                        padding: '0.875rem 1rem',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '0.975rem',
                        width: '100%',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {localIp && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#a7f3d0', lineHeight: '1.4', marginBottom: '1.25rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>Server running locally!</div>
                      <div>IP Address: <strong style={{ fontFamily: 'monospace' }}>{localIp}</strong></div>
                      <div>Port: <strong style={{ fontFamily: 'monospace' }}>{hostPort}</strong></div>
                    </div>
                  )}

                  <button 
                    type="button" 
                    className="btn-connect" 
                    onClick={handleSaveConnectionSettings}
                    style={{ width: '100%', marginTop: '1.5rem' }}
                  >
                    Save & Relaunch
                  </button>
                </>
              )}

              {workstationMode === 'standalone' && (
                <button 
                  type="button" 
                  className="btn-connect" 
                  onClick={handleSaveConnectionSettings}
                  style={{ width: '100%', marginTop: '1.5rem' }}
                >
                  Save & Relaunch
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowNetworkSettings(false);
                  setTestResult(null);
                }}
                style={{ 
                  width: '100%', 
                  padding: '0.875rem', 
                  borderRadius: '12px', 
                  border: 'none', 
                  fontWeight: 600, 
                  background: 'transparent', 
                  color: '#64748b', 
                  cursor: 'pointer', 
                  marginTop: '0.5rem' 
                }}
                className="network-cancel-btn"
              >
                Back to Login
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="connection-header">
              <div className="logo-badge">
                <Server size={28} className="logo-icon animate-pulse-slow" />
              </div>
              <h1>
                {passwordMode === 'none' && 'MedFlow Portal'}
                {passwordMode === 'input' && 'Password Protected'}
                {passwordMode === 'setup' && 'First-Time Setup'}
              </h1>
              <p className="subtitle">
                {passwordMode === 'none' && 'Enter your clinical User ID to mount your workspace'}
                {passwordMode === 'input' && `Enter the access password to connect to doctor profile "${userIdInput}"`}
                {passwordMode === 'setup' && `Create a personal access password for doctor profile "${userIdInput}"`}
              </p>
            </div>

        <form onSubmit={handleConnect} className="connection-form">
          {passwordMode === 'none' && (
            <div className="form-group">
              <label htmlFor="portal-user-id">User ID / Profile Code</label>
              <div className="input-container">
                <User className="input-icon" size={18} />
                <input
                  id="portal-user-id"
                  type="text"
                  placeholder="Enter User ID (e.g. doctor1)"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  autoComplete="off"
                  disabled={isConnecting}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <div className="error-alert">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {passwordMode === 'input' && (
            <div className="form-group">
              <label htmlFor="portal-password">Access Password</label>
              <div className="input-container">
                <KeyRound className="input-icon" size={18} />
                <input
                  id="portal-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isConnecting}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <div className="error-alert">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {passwordMode === 'setup' && (
            <>
              <div className="form-group">
                <label htmlFor="portal-new-password">Create Password</label>
                <div className="input-container">
                  <KeyRound className="input-icon" size={18} />
                  <input
                    id="portal-new-password"
                    type="password"
                    placeholder="Min 4 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isConnecting}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="portal-confirm-password">Confirm Password</label>
                <div className="input-container">
                  <KeyRound className="input-icon" size={18} />
                  <input
                    id="portal-confirm-password"
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isConnecting}
                    required
                  />
                </div>
                {error && (
                  <div className="error-alert">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {passwordMode === 'none' ? (
            <button
              type="submit"
              className={`btn-connect ${isConnecting ? 'loading' : ''}`}
              disabled={isConnecting || !userIdInput.trim()}
            >
              {isConnecting ? (
                <>
                  <RefreshCw size={18} className="spin-icon" />
                  Mounting Database...
                </>
              ) : (
                <>
                  <KeyRound size={18} />
                  Connect Workspace
                </>
              )}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setPasswordMode('none');
                  setPassword('');
                  setConfirmPassword('');
                  setError(null);
                }}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 600, background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                disabled={isConnecting}
              >
                Back
              </button>
              <button
                type="submit"
                className={`btn-connect ${isConnecting ? 'loading' : ''}`}
                style={{ flex: 2, margin: 0 }}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <RefreshCw size={18} className="spin-icon" />
                ) : passwordMode === 'setup' ? 'Set & Connect' : 'Unlock'}
              </button>
            </div>
          )}
        </form>



        <div className="connection-footer">
          <div className="status-indicator">
            <div className="status-dot green animate-ping-slow"></div>
            <span>Workstation Offline-Ready (SQLite Local Data)</span>
          </div>
        </div>
      </>
    )}
  </div>

      <style>{`
        .connection-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: 'Inter', system-ui, sans-serif;
          overflow: hidden;
        }

        .glow-container {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 1;
        }

        .glow-sphere {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.15;
          mix-blend-mode: screen;
        }

        .sphere-1 {
          top: -10%;
          left: 10%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, #0ea5e9 0%, transparent 70%);
          animation: float-slow 15s infinite alternate;
        }

        .sphere-2 {
          bottom: -10%;
          right: 10%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, #14b8a6 0%, transparent 70%);
          animation: float-slow 20s infinite alternate-reverse;
        }

        .connection-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          color: #f8fafc;
          animation: slide-up 0.5s ease-out;
        }

        .connection-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .logo-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
          border-radius: 18px;
          box-shadow: 0 8px 16px -4px rgba(14, 165, 233, 0.3);
          margin-bottom: 1.25rem;
        }

        .logo-icon {
          color: white;
        }

        .connection-header h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.875rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          margin-bottom: 0.5rem;
          background: linear-gradient(to right, #ffffff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          font-size: 0.925rem;
          color: #94a3b8;
          line-height: 1.4;
        }

        .connection-form {
          margin-bottom: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          font-size: 0.825rem;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-container {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          transition: color 0.2s;
        }

        .input-container input {
          width: 100%;
          padding: 0.875rem 1rem 0.875rem 2.75rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-size: 0.975rem;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .input-container input:focus {
          outline: none;
          border-color: #0ea5e9;
          background: rgba(15, 23, 42, 0.8);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
        }

        .input-container input:focus + .input-icon {
          color: #0ea5e9;
        }

        .error-alert {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          padding: 0.625rem 0.875rem;
          margin-top: 0.75rem;
          color: #fca5a5;
          font-size: 0.825rem;
        }

        .btn-connect {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white;
          border: none;
          padding: 0.875rem;
          border-radius: 12px;
          font-size: 0.975rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
        }

        .btn-connect:hover:not(:disabled) {
          background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(14, 165, 233, 0.3);
        }

        .btn-connect:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-connect:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }



        .connection-footer {
          margin-top: 2rem;
          text-align: center;
        }

        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #64748b;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-dot.green {
          background-color: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        /* Animations */
        @keyframes float-slow {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-20px) scale(1.05); }
        }

        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-ping-slow {
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }

        .network-settings-btn:hover {
          color: white !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .network-sub-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        .network-cancel-btn:hover {
          color: #94a3b8 !important;
        }
      `}</style>
    </div>
  );
};

export default UserConnectionScreen;
