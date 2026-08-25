import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Menu } from 'lucide-react';

import { storage, type Doctor, type Receipt as ReceiptType, type Service, type Prescription, type ReceiptPaperType, type PrescriptionPaperType } from './lib/storage';
import './index.css';
import './App.css';

// Layout
import Sidebar from './components/layout/Sidebar';
import PrintTemplates from './components/layout/PrintTemplates';

// Screens
import Dashboard from './components/Dashboard';
import ActivationScreen from './components/ActivationScreen';
import UserConnectionScreen from './components/UserConnectionScreen';
import DoctorWorkstation from './components/DoctorWorkstation';

// Feature components
import DoctorManagement from './components/DoctorManagement';
import ServiceManagement from './components/ServiceManagement';
import ReceiptForm from './components/ReceiptForm';
import AppointmentManagement from './components/AppointmentManagement';
import { ConfirmProvider, useConfirm } from './components/ui/ConfirmDialog';
import { ToastProvider, useToast } from './components/ui/Toast';

// Tabs
import HistoryTab from './components/tabs/HistoryTab';
import PrescriptionsTab from './components/tabs/PrescriptionsTab';
import SettingsTab from './components/tabs/SettingsTab';
import { FollowUpsTab } from './components/tabs/FollowUpsTab';

import type { Tab } from './components/layout/Sidebar';
import type { FollowUp } from './lib/storage';

const MainApp: React.FC = () => {
  const confirm = useConfirm();
  const toast = useToast();

  // ── Core state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState({ totalReceipts: 0, totalRevenue: 0, avgPerReceipt: 0 });
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [pendingAppointmentsCount, setPendingAppointmentsCount] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [activationStatus, setActivationStatus] = useState<{
    status: 'NOT_ACTIVATED' | 'ACTIVATED' | 'EXPIRED' | 'TAMPERED' | 'INVALID';
    daysLeft?: number;
    expiryDate?: string;
    message?: string;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState('reception');
  const [currentUserDoctorId, setCurrentUserDoctorId] = useState<string | null>(null);
  const [knownUsers, setKnownUsers] = useState<{ id: string; role: string; doctorId?: string }[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Edit / Print state ────────────────────────────────────────────────────
  const [editingReceipt, setEditingReceipt] = useState<ReceiptType | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<ReceiptType[]>([]);
  const [activePrintPrescription, setActivePrintPrescription] = useState<Prescription | null>(null);
  const [receiptPaperType, setReceiptPaperType] = useState<ReceiptPaperType>('A5');
  const [prescriptionPaperType, setPrescriptionPaperType] = useState<PrescriptionPaperType>('A4');

  // ── Settings state ────────────────────────────────────────────────────────
  const [machineId, setMachineId] = useState('');
  const [networkSecret, setNetworkSecret] = useState('');
  const [botStatus, setBotStatus] = useState<any>({ status: 'DISCONNECTED', qrCodeDataUrl: null });
  const [workstationMode, setWorkstationMode] = useState<'standalone' | 'host' | 'client'>('standalone');
  const [hostIp, setHostIp] = useState('127.0.0.1');
  const [hostPort, setHostPort] = useState(49152);
  const [localIp, setLocalIp] = useState('');

  // ── Data refresh ──────────────────────────────────────────────────────────
  const refreshData = React.useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [d, s, metrics, p, apts, fus, paperSettings] = await Promise.all([
        storage.getDoctors(),
        storage.getServices(),
        storage.getDashboardMetrics(),
        storage.getPrescriptions(),
        storage.getAppointments(),
        storage.getFollowUps(),
        storage.getPrintPaperSettings()
      ]);
      setDoctors(d);
      setServices(s);
      setDashboardMetrics(metrics);
      setPrescriptions(p);
      setPendingAppointmentsCount(apts.filter((a: any) => a.status === 'PENDING').length);
      setFollowUps(fus);
      setReceiptPaperType(paperSettings.receiptPaper);
      setPrescriptionPaperType(paperSettings.prescriptionPaper);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const dueFollowUpsCount = React.useMemo(() => {
    return followUps.filter(f => f.status === 'PENDING' && f.scheduledDate === todayDateStr).length;
  }, [followUps, todayDateStr]);

  // ── Bootstrap effects ─────────────────────────────────────────────────────
  useEffect(() => {
    window.licensing.checkActivation().then(setActivationStatus);

    (async () => {
      try {
            const user = await window.users.getCurrentUser();
        if (user) {
          setCurrentUser(user);
                const role = await window.users.getCurrentUserRole();
          setCurrentUserRole(role);
                const doctorId = await window.users.getCurrentUserDoctorId();
          setCurrentUserDoctorId(doctorId || null);
        }
      } catch (err) {
        console.error('Failed to get active user:', err);
      }
    })();

    window.users.getKnownUsers().then(setKnownUsers).catch(console.error);

    if (window.connection) {
        window.connection.getSettings().then((s: any) => {
        setWorkstationMode(s.mode);
        setHostIp(s.hostIp);
        setHostPort(s.hostPort);
        setLocalIp(s.localIp);
        setNetworkSecret(s.networkSecret || '');
      }).catch(console.error);
    }
  }, []);

  // Network online/offline
  useEffect(() => {
    const toggle = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', toggle);
    window.addEventListener('offline', toggle);
    return () => { window.removeEventListener('online', toggle); window.removeEventListener('offline', toggle); };
  }, []);

  // Clear print state after print dialog closes
  useEffect(() => {
    const clear = () => { setReceiptsToPrint([]); setActivePrintPrescription(null); };
    window.addEventListener('afterprint', clear);
    return () => window.removeEventListener('afterprint', clear);
  }, []);

  // WhatsApp bot status
  useEffect(() => {
    const bot = (window as any).whatsappBot;
    if (!bot) return;
    bot.getStatus().then((s: any) => setBotStatus(s));
    const unsub = bot.onStatusChange((s: any) => setBotStatus(s));
    return () => unsub();
  }, []);

  // Live Appointment Refresh Listener from WhatsApp / DB
  useEffect(() => {
    if (window.ipcRenderer?.on) {
      const listener = () => {
        refreshData();
      };
        window.ipcRenderer.on('appointment-updated', listener);
      return () => {
            if (window.ipcRenderer?.off) window.ipcRenderer.off('appointment-updated', listener);
      };
    }
  }, [refreshData]);

  // Load data once user is known
  useEffect(() => {
    if (!currentUser) return;

    (async () => {
      await storage.migrateToSQLite();
      const [metrics, d] = await Promise.all([storage.getDashboardMetrics(), storage.getDoctors()]);
      // If we literally have 0 metrics and 0 doctors, try loading excel dump as fallback
      if (metrics.totalReceipts === 0 && d.length === 0) {
        const excelData = await window.excelStorage?.loadData();
        if (excelData) await storage.importData(JSON.stringify(excelData));
      }
      refreshData();
    })();

    const interval = setInterval(async () => {
      try {
        const apts = await storage.getAppointments();
        setPendingAppointmentsCount(apts.filter((a: any) => a.status === 'PENDING').length);
      } catch { /* ignored */ }
    }, 10_000);

    return () => clearInterval(interval);
  }, [currentUser, refreshData]);

  // Lazy-load machine ID when settings tab is opened
  useEffect(() => {
    if (activeTab === 'settings' && !machineId) {
        window.licensing.getMachineID().then(setMachineId);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (await confirm('Are you sure you want to disconnect from this profile? Your local SQLite database will remain secure on this device.')) {
      await window.users.disconnectUser();
      setCurrentUser(null);
      setCurrentUserRole('reception');
      setCurrentUserDoctorId(null);
      setDoctors([]); setServices([]); setDashboardMetrics({ totalReceipts: 0, totalRevenue: 0, avgPerReceipt: 0 });
      setActiveTab('dashboard');
    }
  };

  const handlePrint = (input: ReceiptType | ReceiptType[]) => {
    setReceiptsToPrint(Array.isArray(input) ? input : [input]);
    setTimeout(() => window.print(), 150);
  };

  const handlePrintRx = (rx: Prescription) => {
    setActivePrintPrescription(rx);
    setTimeout(() => window.print(), 150);
  };

  const handleEditReceipt = (receipt: ReceiptType) => {
    setEditingReceipt(receipt);
    setActiveTab('new-receipt');
  };

  const handleSaveConnectionSettings = async (
    mode: 'standalone' | 'host' | 'client',
    ip: string,
    port: number,
    secret?: string
  ) => {
    if (await confirm('Buvora needs to relaunch to apply these network connection settings. Proceed?')) {
      window.connection.saveSettings({ mode, hostIp: ip, hostPort: port, networkSecret: secret }).catch((err: any) => {
        toast(`Failed to save settings: ${err.message}`, { type: 'error' });
      });
    }
  };

  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = async event => {
      if (await storage.importData(event.target?.result as string)) {
        toast('Data imported successfully! The app will now reload.', { type: 'success' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast('Error: This file is not a valid Buvora backup.', { type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleDeactivateLicense = async () => {
    if (await confirm('Are you sure you want to remove the current license?', { isDanger: true })) {
      window.licensing.deactivate();
      window.location.reload();
    }
  };

  // ── Render gates ──────────────────────────────────────────────────────────
  if (activationStatus === null) {
    return <div className="loading-screen">Loading Buvora...</div>;
  }

  if (activationStatus.status !== 'ACTIVATED') {
    return (
      <ActivationScreen
        status={activationStatus.status}
        expiryDate={activationStatus.expiryDate}
        onActivated={() => window.location.reload()}
      />
    );
  }

  if (currentUser === null) {
    return (
      <UserConnectionScreen
        onConnected={(userId, role, doctorId) => {
          setCurrentUser(userId);
          setCurrentUserRole(role);
          setCurrentUserDoctorId(doctorId || null);
                window.users.getKnownUsers().then(setKnownUsers);
        }}
      />
    );
  }

  if (currentUserRole === 'doctor') {
    return (
      <DoctorWorkstation
        currentUser={currentUser}
        currentUserDoctorId={currentUserDoctorId}
        onLogout={handleLogout}
      />
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      {isLoadingData && (
        <div className="loading-screen" style={{ position: 'absolute', zIndex: 9999, background: 'rgba(255, 255, 255, 0.8)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#0284c7' }}>
          Loading data...
        </div>
      )}
      <div className="mobile-header no-print">
        <div className="logo" style={{ color: 'white' }}>
          <svg className="logo-svg" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="32" y="32" width="448" height="448" rx="110" fill="white" />
            <path d="M256 128 V384 M128 256 H384" stroke="#0ea5e9" strokeWidth="64" strokeLinecap="round" />
          </svg>
          <span>Buvora</span>
        </div>
        <button className="btn-mobile-menu" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
      </div>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
        currentUser={currentUser}
        isOnline={isOnline}
        pendingAppointmentsCount={pendingAppointmentsCount}
        dueFollowUpsCount={dueFollowUpsCount}
        onLogout={handleLogout}
        onNewReceipt={() => { setEditingReceipt(null); setActiveTab('new-receipt'); setIsMobileMenuOpen(false); }}
        isMobileMenuOpen={isMobileMenuOpen}
        closeMenu={() => setIsMobileMenuOpen(false)}
      />

      <main className="main-content">
        <header className="content-header no-print">
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {activeTab === 'dashboard' && 'Executive Dashboard'}
              {activeTab === 'new-receipt' && 'Create Patient Receipt'}
              {activeTab === 'history' && 'Invoices & Billing History'}
              {activeTab === 'prescriptions' && 'Prescriptions (Rx) Registry'}
              {activeTab === 'appointments' && 'Appointment Booking Desk'}
              {activeTab === 'follow-ups' && 'Patient Follow-Up Tracker'}
              {activeTab === 'doctors' && 'Doctors Registry'}
              {activeTab === 'services' && 'Clinic Services Catalog'}
              {activeTab === 'settings' && 'System Control Center'}
            </h1>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {activeTab === 'dashboard' && 'Overview of clinic operations, revenue, and live queue'}
              {activeTab === 'new-receipt' && 'Generate and print patient consultation invoices'}
              {activeTab === 'history' && 'Search, filter, reprint, and export financial records'}
              {activeTab === 'prescriptions' && 'Patient consultation records, diagnoses & medication charts'}
              {activeTab === 'appointments' && 'Manage WhatsApp & reception patient appointment requests'}
              {activeTab === 'follow-ups' && 'Track patient revisit schedules, overdue reviews & WhatsApp reminders'}
              {activeTab === 'doctors' && 'Manage consulting physicians, qualifications & UPI QR setups'}
              {activeTab === 'services' && 'Standard consultation and treatment fee pricing'}
              {activeTab === 'settings' && 'Backups, printer paper presets, network sync & licensing'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid var(--border)', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
              <span>🖨️ {receiptPaperType === 'Thermal80' ? 'Thermal 80mm' : receiptPaperType === 'Thermal58' ? 'Thermal 58mm' : receiptPaperType}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>Rx: {prescriptionPaperType}</span>
            </div>

            {activeTab !== 'new-receipt' && (
              <button
                className="btn-primary"
                onClick={() => { setEditingReceipt(null); setActiveTab('new-receipt'); }}
                style={{ padding: '0.45rem 1rem', fontSize: '0.825rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                + New Receipt
              </button>
            )}
          </div>
        </header>

        <div className="content-inner">
          {/* Pending appointments alert banner */}
          {pendingAppointmentsCount > 0 && activeTab !== 'appointments' && (
            <div
              className="no-print"
              style={{
                background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
                padding: '0.75rem 1.25rem', borderRadius: '12px', marginBottom: '1.25rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 6px -1px rgba(220,38,38,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#991b1b' }}>
                    {pendingAppointmentsCount} New Appointment Request{pendingAppointmentsCount > 1 ? 's' : ''} Awaiting Review!
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#b91c1c' }}>
                    Action required: Review incoming WhatsApp booking requests to Approve or Reject.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('appointments')}
                style={{ background: '#dc2626', color: 'white', padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Review ({pendingAppointmentsCount})
              </button>
            </div>
          )}

          {/* Tab content */}
          {activeTab === 'dashboard' && (
            <Dashboard
              doctors={doctors}
              dashboardMetrics={dashboardMetrics}
              prescriptions={prescriptions}
              pendingAppointmentsCount={pendingAppointmentsCount}
              followUps={followUps}
              dueFollowUpsCount={dueFollowUpsCount}
              receiptPaperType={receiptPaperType}
              prescriptionPaperType={prescriptionPaperType}
              botStatus={botStatus}
              workstationMode={workstationMode}
              currentUser={currentUser}
              currentUserRole={currentUserRole}
              onNavigate={(tab) => setActiveTab(tab)}
              onNewReceipt={() => setActiveTab('new-receipt')}
            />
          )}
          {activeTab === 'doctors' && <DoctorManagement doctors={doctors} onUpdate={refreshData} />}
          {activeTab === 'services' && <ServiceManagement services={services} onUpdate={refreshData} />}
          {activeTab === 'new-receipt' && (
            <ReceiptForm
              doctors={doctors}
              initialData={editingReceipt}
              onSave={() => { refreshData(); setEditingReceipt(null); setActiveTab('history'); }}
              onPrintRequest={(receipt) => {
                setReceiptsToPrint([receipt]);
                setTimeout(() => window.print(), 150);
              }}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              onPrint={handlePrint}
              onEdit={handleEditReceipt}
              onDelete={async (id) => {
                if (await confirm('Are you sure you want to delete this receipt?', { isDanger: true })) {
                  await storage.deleteReceipt(id);
                  refreshData();
                  toast('Receipt deleted', { type: 'success' });
                }
              }}
              onExportCsv={() => storage.exportToExcel()}
            />
          )}
          {activeTab === 'prescriptions' && (
            <PrescriptionsTab prescriptions={prescriptions} onPrintRx={handlePrintRx} />
          )}
          {activeTab === 'appointments' && (
            <AppointmentManagement
              doctors={doctors}
              onConvertToReceipt={(apt) => {
                setEditingReceipt({
                  id: '',
                  receiptNumber: '',
                  date: apt.appointmentDate || (apt as any).date || format(new Date(), 'yyyy-MM-dd'),
                  patientName: apt.patientName,
                  patientAge: apt.patientAge || '30',
                  patientGender: apt.patientGender || 'Male',
                  patientPhone: apt.patientPhone || '',
                  doctorId: apt.doctorId,
                  doctorName: apt.doctorName,
                  items: [],
                  total: 0,
                  paymentMethod: 'CASH',
                  appointmentId: apt.id,
                });
                setActiveTab('new-receipt');
              }}
            />
          )}
          {activeTab === 'follow-ups' && (
            <FollowUpsTab
              doctors={doctors}
              followUps={followUps}
              onRefresh={refreshData}
              onConvertToReceipt={(fu) => {
                setEditingReceipt({
                  id: '',
                  receiptNumber: '',
                  date: format(new Date(), 'yyyy-MM-dd'),
                  patientName: fu.patientName,
                  patientAge: fu.patientAge || '30',
                  patientGender: fu.patientGender || 'Male',
                  patientPhone: fu.patientPhone || '',
                  doctorId: fu.doctorId,
                  doctorName: fu.doctorName,
                  items: [],
                  total: 0,
                  paymentMethod: 'CASH',
                });
                setActiveTab('new-receipt');
              }}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              activationStatus={activationStatus}
              machineId={machineId}
              networkSecret={networkSecret}
              workstationMode={workstationMode}
              setWorkstationMode={setWorkstationMode}
              hostIp={hostIp}
              setHostIp={setHostIp}
              hostPort={hostPort}
              setHostPort={setHostPort}
              localIp={localIp}
              botStatus={botStatus}
              setBotStatus={setBotStatus}
              currentUser={currentUser}
              knownUsers={knownUsers}
              setKnownUsers={setKnownUsers}
              doctors={doctors}
              receiptPaperType={receiptPaperType}
              setReceiptPaperType={setReceiptPaperType}
              prescriptionPaperType={prescriptionPaperType}
              setPrescriptionPaperType={setPrescriptionPaperType}
              onExportData={() => storage.exportData()}
              onImportData={handleImportData}
              onExportCsv={() => storage.exportToExcel()}
              onSaveConnectionSettings={handleSaveConnectionSettings}
              onDeactivateLicense={handleDeactivateLicense}
            />
          )}
        </div>
      </main>

      <PrintTemplates
        receiptsToPrint={receiptsToPrint}
        activePrintPrescription={activePrintPrescription}
        doctors={doctors}
        receiptPaperType={receiptPaperType}
        prescriptionPaperType={prescriptionPaperType}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ConfirmProvider>
  );
};

export default App;
