import React, { useState, useEffect } from 'react';
import { Lock, Smartphone, ShieldCheck, Copy, Check, AlertCircle } from 'lucide-react';

interface ActivationScreenProps {
  onActivated: () => void;
  status: 'NOT_ACTIVATED' | 'EXPIRED' | 'TAMPERED';
  expiryDate?: string;
}

const ActivationScreen: React.FC<ActivationScreenProps> = ({ onActivated, status, expiryDate }) => {
  const [machineId, setMachineId] = useState<string>('Loading...');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    // @ts-ignore
    window.licensing.getMachineID().then((id: string) => {
      setMachineId(id);
    });
  }, []);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    
    setIsActivating(true);
    setError(null);
    
    try {
      // @ts-ignore
      const result = await window.licensing.activateLicense(licenseKey);
      if (result.success) {
        onActivated();
      } else {
        setError(result.message || 'Invalid activation key. Please check and try again.');
      }
    } catch (err) {
      setError('Activation failed. Please contact support.');
    } finally {
      setIsActivating(false);
    }
  };

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTitle = () => {
    if (status === 'EXPIRED') return 'License Expired';
    if (status === 'TAMPERED') return 'Security Alert';
    return 'Activation Required';
  };

  const getMessage = () => {
    if (status === 'EXPIRED') return `Your license expired on ${expiryDate}. Please renew to continue.`;
    if (status === 'TAMPERED') return 'Date manipulation detected. Please correct your system clock.';
    return 'Please activate your copy of MedFlow Clinic to continue.';
  };

  return (
    <div className="activation-overlay">
      <div className="activation-card">
        <div className="activation-header">
          <div className={`icon-badge ${status !== 'NOT_ACTIVATED' ? 'warning' : ''}`}>
            {status === 'TAMPERED' ? <AlertCircle size={32} /> : <Lock size={32} />}
          </div>
          <h1>{getTitle()}</h1>
          <p>{getMessage()}</p>
        </div>

        <div className="activation-body">
          <div className="info-box">
            <div className="info-label">
              <span>Your Unique Machine ID</span>
              <button className="copy-btn" onClick={copyMachineId} title="Copy ID">
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="machine-id-display">
              <code>{machineId}</code>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="license-key">{status === 'EXPIRED' ? 'Enter Renewal Key' : 'Enter License Key'}</label>
            <div className="input-with-icon">
              <ShieldCheck className="input-icon" size={20} />
              <input 
                id="license-key"
                type="text" 
                placeholder="YYYYMMDD-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleActivate()}
              />
            </div>
            {error && (
              <div className="error-message">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button 
            className="btn-activate" 
            onClick={handleActivate}
            disabled={isActivating || !licenseKey.trim()}
          >
            {isActivating ? 'Verifying...' : (status === 'EXPIRED' ? 'Renew License' : 'Activate Now')}
          </button>


          <div className="activation-footer">
            <p>Need a key? Contact: <strong>support@medflow.com</strong></p>
            <div className="security-note">
              <Smartphone size={14} />
              <span>Offline activation - No internet required</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .activation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: 'Inter', sans-serif;
        }

        .activation-card {
          width: 100%;
          max-width: 480px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          padding: 2.5rem;
          border: 1px solid #e2e8f0;
        }

        .activation-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .icon-badge {
          width: 64px;
          height: 64px;
          background: #f0f9ff;
          color: #0284c7;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }

        .activation-header h1 {
          font-size: 1.875rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 0.5rem;
        }

        .activation-header p {
          color: #64748b;
          font-size: 1rem;
        }

        .info-box {
          background: #f1f5f9;
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .info-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #475569;
        }

        .copy-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          background: white;
          border: 1px solid #cbd5e1;
          padding: 0.25rem 0.625rem;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .machine-id-display {
          background: white;
          border: 1px solid #e2e8f0;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 0.75rem;
        }

        .machine-id-display code {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          color: #0f172a;
          word-break: break-all;
          font-size: 0.9375rem;
        }

        .instruction-text {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
        }

        .input-group {
          margin-bottom: 2rem;
        }

        .input-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.5rem;
        }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .input-with-icon input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 3rem;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .input-with-icon input:focus {
          outline: none;
          border-color: #0284c7;
          box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.1);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #ef4444;
          font-size: 0.8125rem;
          margin-top: 0.5rem;
        }

        .btn-activate {
          width: 100%;
          background: #0284c7;
          color: white;
          border: none;
          padding: 1rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 1.5rem;
        }

        .btn-activate:hover:not(:disabled) {
          background: #0369a1;
          transform: translateY(-1px);
        }

        .btn-activate:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-activate:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .activation-footer {
          text-align: center;
          border-top: 1px solid #f1f5f9;
          padding-top: 1.5rem;
        }

        .activation-footer p {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 1rem;
        }

        .security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: #10b981;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .text-success {
          color: #10b981;
        }
      `}</style>
    </div>
  );
};

export default ActivationScreen;
