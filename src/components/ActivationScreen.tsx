import React, { useState, useEffect } from 'react';
import { Lock, Smartphone, ShieldCheck, Copy, Check, AlertCircle } from 'lucide-react';
import '../styles/components/ActivationScreen.css';

interface ActivationScreenProps {
  onActivated: () => void;
  status: 'NOT_ACTIVATED' | 'EXPIRED' | 'TAMPERED' | 'INVALID';
  expiryDate?: string;
}

const ActivationScreen: React.FC<ActivationScreenProps> = ({ onActivated, status, expiryDate }) => {
  const [machineId, setMachineId] = useState<string>('Loading...');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    window.licensing.getMachineID().then((id: string) => {
      setMachineId(id);
    });
  }, []);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    
    setIsActivating(true);
    setError(null);
    
    try {
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
    if (status === 'INVALID') return 'Invalid License';
    return 'Activation Required';
  };

  const getMessage = () => {
    if (status === 'EXPIRED') return `Your license expired on ${expiryDate}. Please renew to continue.`;
    if (status === 'TAMPERED') return 'Date manipulation detected. Please correct your system clock.';
    if (status === 'INVALID') return 'The provided license key is invalid or corrupted.';
    return 'Please activate your copy of Buvora to continue.';
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
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
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
            <div className="provider-box">
              <p className="provider-name">Service Provider: <strong>Badshah Computers</strong></p>
              <p className="provider-sub">Software Support & Key Activation:</p>
              <p className="contact-line">📧 Email: <strong>burhansaifee2003@gmail.com</strong></p>
              <p className="contact-line">📞 Phone / WhatsApp: <strong>+91 9981188253, +91 9039010987</strong></p>
            </div>
            <div className="security-note">
              <Smartphone size={14} />
              <span>Offline activation - No internet required</span>
            </div>
            <p className="copyright-tag">© 2026 Buvora • Developed by Badshah Computers</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivationScreen;
