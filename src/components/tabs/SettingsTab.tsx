import React, { useState } from 'react';
import {
  DownloadCloud, UploadCloud, FileText, MessageSquare, Bot,
  Server, KeyRound, ShieldCheck, FolderOpen, AlertCircle, Copy, Trash2, CheckCircle, Printer
} from 'lucide-react';
import { storage, type Doctor, type ReceiptPaperType, type PrescriptionPaperType } from '../../lib/storage';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

interface ActivationStatus {
  status: 'NOT_ACTIVATED' | 'ACTIVATED' | 'EXPIRED' | 'TAMPERED' | 'INVALID';
  daysLeft?: number;
  expiryDate?: string;
  message?: string;
}

interface SettingsTabProps {
  activationStatus: ActivationStatus | null;
  machineId: string;
  networkSecret: string;           // host's token (shown on Host); saved token (shown on Client)
  workstationMode: 'standalone' | 'host' | 'client';
  setWorkstationMode: (mode: 'standalone' | 'host' | 'client') => void;
  hostIp: string;
  setHostIp: (ip: string) => void;
  hostPort: number;
  setHostPort: (port: number) => void;
  localIp: string;
  botStatus: any;
  setBotStatus: (status: any) => void;
  currentUser: string | null;
  knownUsers: { id: string; role: string; doctorId?: string }[];
  setKnownUsers: (users: { id: string; role: string; doctorId?: string }[]) => void;
  doctors: Doctor[];
  receiptPaperType: ReceiptPaperType;
  setReceiptPaperType: (type: ReceiptPaperType) => void;
  prescriptionPaperType: PrescriptionPaperType;
  setPrescriptionPaperType: (type: PrescriptionPaperType) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  onExportCsv: () => void;
  onSaveConnectionSettings: (mode: 'standalone' | 'host' | 'client', ip: string, port: number) => void;
  onDeactivateLicense: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  activationStatus,
  machineId,
  networkSecret,
  workstationMode,
  setWorkstationMode,
  hostIp,
  setHostIp,
  hostPort,
  setHostPort,
  localIp,
  botStatus,
  setBotStatus,
  currentUser,
  knownUsers,
  setKnownUsers,
  doctors,
  receiptPaperType,
  setReceiptPaperType,
  prescriptionPaperType,
  setPrescriptionPaperType,
  onExportData,
  onImportData,
  onExportCsv,
  onSaveConnectionSettings,
  onDeactivateLicense,
}) => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [newUserIdInput, setNewUserIdInput] = useState('');
  const [newUserRole, setNewUserRole] = useState<'reception' | 'doctor'>('reception');
  const [selectedDoctorIdForUser, setSelectedDoctorIdForUser] = useState('');
  // Client-side: the host token the user pastes in
  const [clientSecretInput, setClientSecretInput] = useState(networkSecret || '');
  const [secretSaved, setSecretSaved] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const handleTestConnection = async () => {
    if (!hostIp.trim()) {
      toast('Please enter a Host IP Address', { type: 'error' });
      return;
    }
    setIsTestingConnection(true);
    try {
        const result = await window.connection.testConnection(hostIp.trim(), hostPort);
      if (result.success) {
        toast('Connection Successful! The Host server is reachable.', { type: 'success' });
      } else {
        toast(`Connection Failed: ${result.error || 'Check server status and IP address.'}`, { type: 'error' });
      }
    } catch (e: any) {
      toast(`Connection Error: ${e.message}`, { type: 'error' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveConnectionSettings = () => {
    if (workstationMode === 'client' && !hostIp.trim()) {
      toast('Please enter a Host IP Address', { type: 'error' });
      return;
    }
    onSaveConnectionSettings(workstationMode, hostIp, hostPort);
  };

  const handleAddUser = async () => {
    const userId = newUserIdInput.trim().toLowerCase();
    if (!userId) return;
    const result = await window.users.addKnownUser(userId, newUserRole, newUserRole === 'doctor' ? selectedDoctorIdForUser : undefined);
    if (result.success) {
      setNewUserIdInput('');
      setNewUserRole('reception');
      setSelectedDoctorIdForUser('');
        const users = await window.users.getKnownUsers();
      setKnownUsers(users);
      alert(`User ID "${userId}" has been successfully registered!`);
      toast(`User ID "${userId}" has been successfully registered!`, { type: 'success' });
    } else {
      toast(result.error || 'Failed to add user.', { type: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === 'default') return;
    if (await confirm(`Are you sure you want to delete the User ID "${userId}"? This will lock access to this profile's database, though the database files will remain on disk.`, { isDanger: true })) {
      const result = await window.users.deleteKnownUser(userId);
      if (result.success) {
        const users = await window.users.getKnownUsers();
        setKnownUsers(users);
        toast(`User ID "${userId}" has been removed.`, { type: 'success' });
      } else {
        toast(result.error || 'Failed to delete user.', { type: 'error' });
      }
    }
  };

  const handleDeactivate = async () => {
    if (await confirm('Are you sure you want to deactivate this license? The app will return to the unactivated state.', { isDanger: true })) {
      onDeactivateLicense();
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(networkSecret);
    toast('Network Secret Copied!', { type: 'success' });
  };

  const handleReceiptPaperChange = async (type: ReceiptPaperType) => {
    setReceiptPaperType(type);
    await storage.savePrintPaperSettings({ receiptPaper: type });
    toast(`Receipt print paper format updated to ${type}`, { type: 'success' });
  };

  const handlePrescriptionPaperChange = async (type: PrescriptionPaperType) => {
    setPrescriptionPaperType(type);
    await storage.savePrintPaperSettings({ prescriptionPaper: type });
    toast(`Prescription (Rx) paper format updated to ${type}`, { type: 'success' });
  };

  return (
    <div className="control-center">
      {/* Banner */}
      <div
        className="control-header-banner"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: 'white',
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          marginBottom: '2rem',
          boxShadow: '0 10px 25px -5px rgba(15,23,42,0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(14,165,233,0.15)', color: '#38bdf8', fontSize: '0.725rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '9999px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.65rem', border: '1px solid rgba(56,189,248,0.25)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} /> CONTROL CENTER &amp; CONFIGURATION
        </div>
        <h2 style={{ fontSize: '1.65rem', margin: '0 0 0.4rem 0', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'white' }}>System Control Center</h2>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', maxWidth: '640px', lineHeight: 1.5 }}>
          Manage your clinic's database backups, printer formats, system license, automated WhatsApp booking bot, workstation user profiles, and local network sync.
        </p>
      </div>

      <div className="control-grid">
        {/* ROW 1 — CARD 1: Printer & Paper Setup */}
        <div className="card control-card" style={{ padding: '1.6rem', gap: '0.85rem', height: '100%' }}>
          <div className="card-icon-header inline">
            <div className="header-icon purple" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', boxShadow: '0 4px 10px rgba(139,92,246,0.3)' }}>
              <Printer size={18} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Printer &amp; Paper Setup</h3>
          </div>
          <p className="card-description">Select the default print paper format and page layout for patient receipts and doctor prescriptions.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
            {/* Receipt Paper Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  RECEIPT PAPER FORMAT
                </label>
                <span style={{ fontSize: '0.7rem', color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  {receiptPaperType === 'Thermal80' ? '80mm Roll' : receiptPaperType === 'Thermal58' ? '58mm Roll' : receiptPaperType}
                </span>
              </div>
              <select
                value={receiptPaperType}
                onChange={e => handleReceiptPaperChange(e.target.value as ReceiptPaperType)}
                className="select-profile-dropdown"
                style={{ padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
              >
                <option value="A5">A5 (148 × 210 mm) • Standard Half Sheet (Default)</option>
                <option value="A4">A4 (210 × 297 mm) • Full Sheet Invoice</option>
                <option value="A6">A6 (105 × 148 mm) • Compact Slip</option>
                <option value="Letter">US Letter (8.5 × 11 in)</option>
                <option value="Thermal80">Thermal 80mm (3-inch POS Roll)</option>
                <option value="Thermal58">Thermal 58mm (2-inch POS Roll)</option>
              </select>
            </div>

            {/* Prescription Paper Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  PRESCRIPTION (Rx) PAPER FORMAT
                </label>
                <span style={{ fontSize: '0.7rem', color: '#0ea5e9', background: '#f0f9ff', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  {prescriptionPaperType}
                </span>
              </div>
              <select
                value={prescriptionPaperType}
                onChange={e => handlePrescriptionPaperChange(e.target.value as PrescriptionPaperType)}
                className="select-profile-dropdown"
                style={{ padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
              >
                <option value="A4">A4 (210 × 297 mm) • Standard Full Sheet Rx (Default)</option>
                <option value="A5">A5 (148 × 210 mm) • Doctor Memo / Half Sheet</option>
                <option value="Letter">US Letter (8.5 × 11 in)</option>
                <option value="A6">A6 (105 × 148 mm) • Pocket Rx Pad</option>
              </select>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
              <span>Print formats apply automatically across all workstations.</span>
            </div>
          </div>
        </div>

        {/* ROW 1 — CARD 2: Data Safety & Reports */}
        <div className="card control-card" style={{ padding: '1.6rem', gap: '0.85rem', height: '100%' }}>
          <div className="card-icon-header inline">
            <div className="header-icon blue" style={{ background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: 'white', boxShadow: '0 4px 10px rgba(14,165,233,0.3)' }}>
              <DownloadCloud size={18} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Data Safety &amp; Reports</h3>
          </div>
          <p className="card-description">Export SQLite database backups, import backup files, view raw data folders, or download CSV reports.</p>

          <div className="card-actions-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn-primary-sm" style={{ flex: 1, padding: '0.65rem 0.75rem' }} onClick={onExportData}>
                <DownloadCloud size={15} /> Export DB
              </button>
              <button className="btn-secondary-sm" style={{ flex: 1, padding: '0.65rem 0.75rem' }} onClick={() => document.getElementById('import-file')?.click()}>
                <UploadCloud size={15} /> Import DB
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                className="btn-ghost-sm"
                style={{ flex: 1, border: '1px solid var(--border)', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}
                onClick={onExportCsv}
              >
                <FileText size={15} /> Export CSV
              </button>
              <button
                className="btn-ghost-sm"
                style={{ flex: 1, border: '1px solid var(--border)', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}
                onClick={() => (window as any).database.openFolder()}
              >
                <FolderOpen size={15} /> Data Folder
              </button>
            </div>
          </div>

          <input
            type="file"
            accept=".json"
            id="import-file"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onImportData(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* ROW 2 — CARD 3: Workstation Connection */}
        <div className="card control-card" style={{ padding: '1.6rem', gap: '0.85rem', height: '100%' }}>
          <div className="card-icon-header inline">
            <div className="header-icon cyan" style={{ background: 'linear-gradient(135deg, #06b6d4, #0d9488)', color: 'white', boxShadow: '0 4px 10px rgba(6,182,212,0.3)' }}>
              <Server size={18} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Workstation &amp; Network Sync</h3>
          </div>
          <p className="card-description">Configure network connection mode (Standalone, Central Host Server, or Client workstation).</p>

          <div className="connection-settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CONNECTION MODE</label>
              <select
                value={workstationMode}
                onChange={e => setWorkstationMode(e.target.value as any)}
                className="select-profile-dropdown"
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              >
                <option value="standalone">Standalone (Local DB)</option>
                <option value="host">Host / Server (Expose DB)</option>
                <option value="client">Client (Connect to Host)</option>
              </select>
            </div>

            {workstationMode === 'client' && (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>HOST IP ADDRESS</label>
                    <input
                      type="text"
                      value={hostIp}
                      onChange={e => setHostIp(e.target.value)}
                      placeholder="e.g. 192.168.1.50"
                      className="sync-input-line"
                      style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PORT</label>
                    <input
                      type="number"
                      value={hostPort}
                      onChange={e => setHostPort(Number(e.target.value))}
                      placeholder="49152"
                      className="sync-input-line"
                      style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>NETWORK TOKEN (from Host)</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={clientSecretInput}
                      onChange={e => { setClientSecretInput(e.target.value); setSecretSaved(false); }}
                      placeholder="Paste the token shown on the Host machine"
                      className="sync-input-line"
                      style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      className="btn-primary-sm"
                      style={{ whiteSpace: 'nowrap', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', background: secretSaved ? '#059669' : undefined }}
                      disabled={!clientSecretInput.trim()}
                      onClick={async () => {
                        const res = await window.connection.saveClientSecret(clientSecretInput.trim());
                        if (res.success) {
                          setSecretSaved(true);
                        } else {
                          toast(res.error || 'Failed to save token.', { type: 'error' });
                        }
                      }}
                    >
                      {secretSaved ? <><CheckCircle size={14} /> Saved</> : 'Save Token'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button type="button" className="btn-secondary-sm" style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem' }} onClick={handleTestConnection} disabled={isTestingConnection}>
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button type="button" className="btn-primary-sm" style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem' }} onClick={handleSaveConnectionSettings}>
                    Save &amp; Relaunch
                  </button>
                </div>
              </>
            )}

            {workstationMode === 'host' && (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PORT</label>
                    <input
                      type="number"
                      value={hostPort}
                      onChange={e => setHostPort(Number(e.target.value))}
                      placeholder="49152"
                      className="sync-input-line"
                      style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {networkSecret && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.65rem', fontSize: '0.8rem', color: '#1e40af', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Network Token — share with Client machines</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <code style={{ flex: 1, fontSize: '0.7rem', wordBreak: 'break-all', background: '#dbeafe', padding: '0.3rem 0.5rem', borderRadius: '4px', color: '#1e3a8a', letterSpacing: '0.03em' }}>
                        {networkSecret}
                      </code>
                      <button
                        type="button"
                        title="Copy token"
                        style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 600 }}
                        onClick={handleCopySecret}
                      >
                        <Copy size={13} /> Copy
                      </button>
                    </div>
                  </div>
                )}

                {localIp && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.65rem', fontSize: '0.8rem', color: '#166534', lineHeight: '1.4' }}>
                    <div style={{ fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                      Server Active
                    </div>
                    <div>Workstation IP: <strong style={{ fontFamily: 'monospace' }}>{localIp}</strong></div>
                    <div>Port: <strong style={{ fontFamily: 'monospace' }}>{hostPort}</strong></div>
                  </div>
                )}
                <button type="button" className="btn-primary-sm" style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', marginTop: '4px' }} onClick={handleSaveConnectionSettings}>
                  Save &amp; Relaunch
                </button>
              </>
            )}

            {workstationMode === 'standalone' && (
              <button type="button" className="btn-primary-sm" style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', marginTop: '4px' }} onClick={handleSaveConnectionSettings}>
                Save Network Settings
              </button>
            )}
          </div>
        </div>

        {/* ROW 2 — CARD 4: WhatsApp Bot */}
        <div className="card control-card" style={{ padding: '1.6rem', gap: '0.85rem', height: '100%' }}>
          <div className="card-icon-header inline">
            <div className="header-icon green" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}>
              <MessageSquare size={18} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>WhatsApp Bot Setup</h3>
          </div>
          <p className="card-description">Enable automated patient appointment booking and instant WhatsApp notifications for your clinic.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span className="label-caps" style={{ color: '#64748b' }}>STATUS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.825rem' }}>
                <div className={`dot ${botStatus?.status === 'CONNECTED' ? 'green' : botStatus?.status === 'QR_READY' ? 'amber' : ''}`} />
                <span style={{ color: botStatus?.status === 'CONNECTED' ? '#047857' : botStatus?.status === 'QR_READY' ? '#b45309' : '#64748b' }}>
                  {botStatus?.status || 'DISCONNECTED'}
                </span>
              </div>
            </div>

            {botStatus?.status === 'QR_READY' && botStatus?.qrCodeDataUrl && (
              <div style={{ textAlign: 'center', background: '#f0f9ff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                <p style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 600, marginBottom: '0.4rem' }}>
                  📱 Scan with WhatsApp (Settings → Linked Devices)
                </p>
                <img src={botStatus.qrCodeDataUrl} alt="WhatsApp QR Code" style={{ width: '150px', height: '150px', margin: '0 auto', display: 'block', borderRadius: '8px', border: '2px solid white' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {botStatus?.status !== 'CONNECTED' ? (
                <button
                  className="btn-primary-sm"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '0.65rem 0.75rem', borderRadius: '8px', fontWeight: 700 }}
                  onClick={async () => {
                    if ((window as any).whatsappBot) {
                      const res = await (window as any).whatsappBot.start();
                      setBotStatus(res);
                    }
                  }}
                >
                  <Bot size={16} /> Connect WhatsApp
                </button>
              ) : (
                <button
                  className="btn-secondary-sm"
                  style={{ flex: 1, color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2', padding: '0.65rem 0.75rem', fontWeight: 700 }}
                  onClick={async () => {
                    if ((window as any).whatsappBot) {
                      const res = await (window as any).whatsappBot.stop();
                      setBotStatus(res);
                    }
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3 — CARD 5: Clinic Profiles & Users */}
        <div className="card control-card" style={{ padding: '1.6rem', gap: '0.85rem', height: '100%' }}>
          <div className="card-icon-header inline">
            <div className="header-icon red" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', boxShadow: '0 4px 10px rgba(244,63,94,0.3)' }}>
              <KeyRound size={18} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Clinic Profiles &amp; Users</h3>
          </div>
          <p className="card-description">Manage User IDs authorized to access workspace profiles on this workstation.</p>

          {currentUser === 'admin' ? (
            <div className="user-management-section" style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
              <div className="add-user-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Register User ID..."
                    value={newUserIdInput}
                    onChange={e => setNewUserIdInput(e.target.value)}
                    className="sync-input-line"
                    style={{ flex: 2, minWidth: 0, margin: 0, padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
                  />
                  <select
                    value={newUserRole}
                    onChange={e => {
                      setNewUserRole(e.target.value as 'reception' | 'doctor');
                      if (e.target.value === 'doctor' && doctors.length > 0) {
                        setSelectedDoctorIdForUser(doctors[0].id);
                      }
                    }}
                    className="select-profile-dropdown"
                    style={{ flex: 1.2, padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    <option value="reception">Reception</option>
                    <option value="doctor">Doctor</option>
                  </select>
                </div>

                {newUserRole === 'doctor' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Link Doctor Profile:</label>
                    <select
                      value={selectedDoctorIdForUser}
                      onChange={e => setSelectedDoctorIdForUser(e.target.value)}
                      className="select-profile-dropdown"
                      style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Choose Doctor Registry --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={handleAddUser}
                  disabled={!newUserIdInput.trim() || (newUserRole === 'doctor' && !selectedDoctorIdForUser)}
                  style={{ padding: '0.55rem 1rem', width: '100%', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  Add Clinic User ID
                </button>
              </div>

              <div className="users-list-container">
                <span className="label-caps" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>REGISTERED PROFILES</span>
                <div className="users-list" style={{ maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  {knownUsers.map(user => (
                    <div key={user.id} className="user-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <span className="user-list-name" style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <strong>{user.id}</strong>{' '}
                        <span style={{ opacity: 0.65, fontSize: '0.75rem', marginLeft: '4px' }}>({user.role})</span>
                        {user.id === currentUser && <span style={{ color: '#0ea5e9', fontSize: '0.75rem', marginLeft: '6px', fontWeight: 600 }}>(active)</span>}
                      </span>
                      {user.id !== 'default' && (
                        <button
                          className="btn-delete-user"
                          onClick={() => handleDeleteUser(user.id)}
                          title="Remove User ID"
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#b45309', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto' }}>
              <AlertCircle size={16} />
              <span>Only administrator (<strong>admin</strong>) can manage clinic accounts.</span>
            </div>
          )}
        </div>

        {/* ROW 3 — CARD 6: System License & Support */}
        <div className="card control-card" style={{ padding: '1.6rem', gap: '0.85rem', height: '100%' }}>
          <div className="card-icon-header inline">
            <div className="header-icon gray" style={{ background: 'linear-gradient(135deg, #475569, #1e293b)', color: 'white', boxShadow: '0 4px 10px rgba(71,85,105,0.3)' }}>
              <ShieldCheck size={18} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>System License &amp; Support</h3>
          </div>
          <p className="card-description">View active license duration, device machine ID, or renew your system registration.</p>

          <div className="license-status-section" style={{ paddingTop: '0.25rem', gap: '0.75rem', marginTop: 'auto' }}>
            <div className="license-row">
              <span className="label-caps">STATUS</span>
              <div
                className={`license-badge-modern ${activationStatus?.status === 'ACTIVATED' ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.85rem', borderRadius: '10px' }}
              >
                <div className="dot"></div>
                <span>{activationStatus?.status === 'ACTIVATED' ? 'ACTIVATED' : activationStatus?.status}</span>
                {activationStatus?.expiryDate && (
                  <span className="expiry-date">({activationStatus.expiryDate})</span>
                )}
              </div>
            </div>

            <div className="license-row">
              <span className="label-caps">MACHINE ID</span>
              <div className="machine-id-display" style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', maxWidth: '170px', background: '#f8fafc' }}>
                <code style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 600 }}>{machineId}</code>
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(machineId);
                    toast('Machine ID copied!', { type: 'success' });
                  }}
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>

            <div className="license-footer">
              <button className="btn-link" onClick={handleDeactivate}>
                Deactivate License on this Device
              </button>
            </div>

            <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' }}>Service Provider: Badshah Computers</div>
              <div>Support: <a href="mailto:burhansaifee2003@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>burhansaifee2003@gmail.com</a></div>
              <div>Phone / WhatsApp: <span style={{ fontWeight: 600 }}>+91 9981188253, +91 9039010987</span></div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem', textAlign: 'center' }}>
                © 2026 Buvora • Developed by Badshah Computers
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
