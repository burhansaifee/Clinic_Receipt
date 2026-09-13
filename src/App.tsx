import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Menu } from 'lucide-react';

import { storage, playReceptionChime, type Doctor, type Receipt as ReceiptType, type Service, type Prescription, type ReceiptPaperType, type PrescriptionPaperType, type DoctorNextCallEvent } from './lib/storage';
import './index.css';
import './App.css';

// Layout
import Sidebar from './components/layout/Sidebar';
import PrintTemplates from './components/layout/PrintTemplates';

// Core Shell Screens (Instant load)
import Dashboard from './components/Dashboard';
import ActivationScreen from './components/ActivationScreen';
import UserConnectionScreen from './components/UserConnectionScreen';

// Feature components & Tabs (Code-Split on demand via React.lazy)
const DoctorWorkstation = React.lazy(() => import('./components/DoctorWorkstation'));
const DoctorManagement = React.lazy(() => import('./components/DoctorManagement'));
const ServiceManagement = React.lazy(() => import('./components/ServiceManagement'));
const ReceiptForm = React.lazy(() => import('./components/ReceiptForm'));
const AppointmentManagement = React.lazy(() => import('./components/AppointmentManagement'));
const HistoryTab = React.lazy(() => import('./components/tabs/HistoryTab'));
const PrescriptionsTab = React.lazy(() => import('./components/tabs/PrescriptionsTab'));
const SettingsTab = React.lazy(() => import('./components/tabs/SettingsTab'));
const FollowUpsTab = React.lazy(() => import('./components/tabs/FollowUpsTab').then(m => ({ default: m.FollowUpsTab })));
const ExpensesTab = React.lazy(() => import('./components/tabs/ExpensesTab'));
const UsersTab = React.lazy(() => import('./components/tabs/UsersTab').then(m => ({ default: m.UsersTab })));
const FacilityBillingTab = React.lazy(() => import('./components/tabs/FacilityBillingTab'));
const PharmacyTab = React.lazy(() => import('./components/tabs/PharmacyTab').then(m => ({ default: m.PharmacyTab })));
const BedsTab = React.lazy(() => import('./components/tabs/BedsTab').then(m => ({ default: m.BedsTab })));
const InpatientCensusTab = React.lazy(() => import('./components/tabs/InpatientCensusTab').then(m => ({ default: m.InpatientCensusTab })));
const NursingStationTab = React.lazy(() => import('./components/tabs/NursingStationTab').then(m => ({ default: m.NursingStationTab })));
const LaboratoryTab = React.lazy(() => import('./components/tabs/LaboratoryTab').then(m => ({ default: m.LaboratoryTab })));
const InsuranceTab = React.lazy(() => import('./components/tabs/InsuranceTab').then(m => ({ default: m.InsuranceTab })));
const OtManagementTab = React.lazy(() => import('./components/tabs/OtManagementTab'));
const EmergencyTab = React.lazy(() => import('./components/tabs/EmergencyTab'));
const DoctorPayoutsTab = React.lazy(() => import('./components/tabs/DoctorPayoutsTab').then(m => ({ default: m.DoctorPayoutsTab })));
const QueueDisplayTab = React.lazy(() => import('./components/tabs/QueueDisplayTab').then(m => ({ default: m.QueueDisplayTab })));
const StockIndentingTab = React.lazy(() => import('./components/tabs/StockIndentingTab').then(m => ({ default: m.StockIndentingTab })));

import { ConfirmProvider, useConfirm } from './components/ui/ConfirmDialog';
import { ToastProvider, useToast } from './components/ui/Toast';

import type { Tab } from './components/layout/Sidebar';
import type { FollowUp, BedAdmission } from './lib/storage';

const TabFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '380px',
    gap: '0.85rem',
    color: 'var(--text-muted, #64748b)'
  }}>
    <div style={{
      width: '36px',
      height: '36px',
      border: '3px solid #e2e8f0',
      borderTopColor: 'var(--primary, #0284c7)',
      borderRadius: '50%',
      animation: 'buvoraSpin 0.75s linear infinite'
    }} />
    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Loading workstation module...</span>
  </div>
);

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
  const [doctorCallNotification, setDoctorCallNotification] = useState<DoctorNextCallEvent | null>(null);
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
  const [currentUserTabs, setCurrentUserTabs] = useState<string[] | null>(null);
  const [knownUsers, setKnownUsers] = useState<{ id: string; role: string; doctorId?: string; allowedTabs?: string[] }[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Edit / Print state ────────────────────────────────────────────────────
  const [editingReceipt, setEditingReceipt] = useState<ReceiptType | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<ReceiptType[]>([]);
  const [activePrintPrescription, setActivePrintPrescription] = useState<Prescription | null>(null);
  const [billingInitialAdmission, setBillingInitialAdmission] = useState<BedAdmission | null>(null);
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
  const refreshData = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoadingData(true);
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

      setDoctors(prev => {
        if (
          prev.length === d.length &&
          prev.every((item, idx) =>
            item.id === d[idx]?.id &&
            item.name === d[idx]?.name &&
            item.specialization === d[idx]?.specialization &&
            item.phone === d[idx]?.phone &&
            item.chamber === d[idx]?.chamber &&
            item.showQrCodeOnReceipt === d[idx]?.showQrCodeOnReceipt
          )
        ) {
          return prev;
        }
        return d;
      });

      setServices(prev => {
        if (
          prev.length === s.length &&
          prev.every((item, idx) =>
            item.id === s[idx]?.id &&
            item.name === s[idx]?.name &&
            item.amount === s[idx]?.amount &&
            item.category === s[idx]?.category &&
            item.serviceType === s[idx]?.serviceType &&
            item.unit === s[idx]?.unit
          )
        ) {
          return prev;
        }
        return s;
      });

      setDashboardMetrics(prev => {
        if (
          prev.totalReceipts === metrics.totalReceipts &&
          prev.totalRevenue === metrics.totalRevenue &&
          prev.avgPerReceipt === metrics.avgPerReceipt
        ) {
          return prev;
        }
        return metrics;
      });

      setPrescriptions(prev => {
        if (
          prev.length === p.length &&
          (prev.length === 0 || prev[0]?.id === p[0]?.id)
        ) {
          return prev;
        }
        return p;
      });

      const pendingCount = apts.filter((a: any) => a.status === 'PENDING').length;
      setPendingAppointmentsCount(prev => prev === pendingCount ? prev : pendingCount);

      setFollowUps(prev => {
        if (
          prev.length === fus.length &&
          prev.every((item, idx) => item.id === fus[idx]?.id && item.status === fus[idx]?.status)
        ) {
          return prev;
        }
        return fus;
      });

      setReceiptPaperType(prev => prev === paperSettings.receiptPaper ? prev : paperSettings.receiptPaper);
      setPrescriptionPaperType(prev => prev === paperSettings.prescriptionPaper ? prev : paperSettings.prescriptionPaper);
    } finally {
      if (!silent) setIsLoadingData(false);
    }
  }, []);

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const dueFollowUpsCount = React.useMemo(() => {
    return followUps.filter(f => f.status === 'PENDING' && f.scheduledDate === todayDateStr).length;
  }, [followUps, todayDateStr]);

  const ALL_SYSTEM_TABS: Tab[] = [
    'dashboard',
    'appointments',
    'prescriptions',
    'follow-ups',
    'new-receipt',
    'facility-billing',
    'insurance',
    'history',
    'nursing-station',
    'inpatient-census',
    'beds',
    'emergency',
    'ot-management',
    'pharmacy',
    'lab',
    'doctors',
    'services',
    'expenses',
    'doctor-payouts',
    'queue-display',
    'stock-indenting',
    'users',
    'settings'
  ];

  const allowedTabs = React.useMemo(() => {
    if (!currentUser) return ALL_SYSTEM_TABS;
    const isUserAdmin = currentUser.toLowerCase() === 'admin';
    if (isUserAdmin) {
      return ALL_SYSTEM_TABS;
    }
    if (currentUserTabs !== null && Array.isArray(currentUserTabs)) {
      return currentUserTabs;
    }
    if (currentUserRole === 'nurse') {
      return ['nursing-station', 'inpatient-census', 'beds', 'emergency', 'ot-management', 'stock-indenting'];
    }
    if (currentUserRole === 'management') {
      return ['dashboard', 'doctors', 'services', 'expenses', 'pharmacy', 'insurance', 'nursing-station', 'beds', 'inpatient-census', 'emergency', 'ot-management', 'lab', 'doctor-payouts', 'queue-display', 'stock-indenting', 'users', 'settings'];
    }
    if (currentUserRole === 'reception') {
      return ['dashboard', 'new-receipt', 'facility-billing', 'insurance', 'nursing-station', 'beds', 'inpatient-census', 'emergency', 'ot-management', 'history', 'prescriptions', 'pharmacy', 'lab', 'appointments', 'follow-ups', 'queue-display', 'stock-indenting'];
    }
    return ALL_SYSTEM_TABS;
  }, [currentUser, currentUserRole, currentUserTabs]);

  useEffect(() => {
    if (currentUser && allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] as Tab);
    }
  }, [activeTab, allowedTabs, currentUser]);

  // ── Bootstrap effects ─────────────────────────────────────────────────────
  useEffect(() => {
    window.licensing.checkActivation().then(setActivationStatus);

    (async () => {
      try {
        const user = await window.users.getCurrentUser();
        if (user) {
          const [role, doctorId, tabs] = await Promise.all([
            window.users.getCurrentUserRole(),
            window.users.getCurrentUserDoctorId(),
            window.users.getCurrentUserTabs()
          ]);
          setCurrentUser(user);
          setCurrentUserRole(role || 'reception');
          setCurrentUserDoctorId(doctorId || null);
          setCurrentUserTabs(tabs || null);
          
          if (user.toLowerCase() === 'admin') {
            setActiveTab('dashboard');
          } else if (role === 'management') {
            setActiveTab('doctors');
          } else {
            setActiveTab('dashboard');
          }
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

  // Clear print state safely after print dialog closes (debounced to avoid unmounting before spooling)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const clear = () => {
      timer = setTimeout(() => {
        setReceiptsToPrint([]);
        setActivePrintPrescription(null);
      }, 3000);
    };
    window.addEventListener('afterprint', clear);
    return () => {
      window.removeEventListener('afterprint', clear);
      clearTimeout(timer);
    };
  }, []);

  // WhatsApp bot status
  useEffect(() => {
    const bot = (window as any).whatsappBot;
    if (!bot) return;
    bot.getStatus().then((s: any) => setBotStatus(s));
    const unsub = bot.onStatusChange((s: any) => setBotStatus(s));
    return () => unsub();
  }, []);

  // Live Appointment & System Refresh Listener from WhatsApp / DB / Broadcast Bus
  useEffect(() => {
    const handleSync = () => {
      refreshData(true);
    };
    window.addEventListener('buvora-data-updated', handleSync);

    if (window.ipcRenderer?.on) {
      window.ipcRenderer.on('appointment-updated', handleSync);
    }
    return () => {
      window.removeEventListener('buvora-data-updated', handleSync);
      if (window.ipcRenderer?.off) window.ipcRenderer.off('appointment-updated', handleSync);
    };
  }, [refreshData]);

  // Listen for doctor calling next patient from consultation room
  useEffect(() => {
    const handleDoctorCall = (e: any) => {
      const data: DoctorNextCallEvent = e.detail;
      if (data && data.token) {
        setDoctorCallNotification(data);
        playReceptionChime();
        toast.show(`🔔 Dr. ${data.doctorName} called Token #${data.token} (${data.patientName}) to ${data.chamberName}!`, 'info');
      }
    };
    window.addEventListener('buvora-doctor-called-next', handleDoctorCall as EventListener);
    return () => window.removeEventListener('buvora-doctor-called-next', handleDoctorCall as EventListener);
  }, [toast]);

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

    const interval = setInterval(() => {
      refreshData(true);
    }, 5000);

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
      setCurrentUserTabs(null);
      setDoctors([]); setServices([]); setDashboardMetrics({ totalReceipts: 0, totalRevenue: 0, avgPerReceipt: 0 });
      setActiveTab('dashboard');
    }
  };

  const handlePrint = (input: ReceiptType | ReceiptType[]) => {
    setActivePrintPrescription(null);
    setReceiptsToPrint(Array.isArray(input) ? input : [input]);
    setTimeout(() => window.print(), 350);
  };

  const handlePrintRx = (rx: Prescription) => {
    setReceiptsToPrint([]);
    setActivePrintPrescription(rx);
    setTimeout(() => window.print(), 350);
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

  // Dedicated Standalone TV Display Window (launched for TV / secondary monitor)
  if (typeof window !== 'undefined' && window.location.search.includes('mode=tv-display')) {
    return (
      <React.Suspense fallback={<TabFallback />}>
        <QueueDisplayTab doctors={doctors} isDirectTvMode={true} />
      </React.Suspense>
    );
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
        onConnected={async (userId, role, doctorId) => {
          setCurrentUser(userId);
          setCurrentUserRole(role);
          setCurrentUserDoctorId(doctorId || null);
          const tabs = await window.users.getCurrentUserTabs();
          setCurrentUserTabs(tabs || null);
          window.users.getKnownUsers().then(setKnownUsers);
          if (userId.toLowerCase() === 'admin') {
            setActiveTab('dashboard');
          } else if (role === 'management') {
            setActiveTab('doctors');
          } else if (role === 'nurse') {
            setActiveTab('nursing-station');
          } else {
            setActiveTab('dashboard');
          }
        }}
      />
    );
  }

  if (currentUserRole === 'doctor') {
    return (
      <React.Suspense fallback={<TabFallback />}>
        <DoctorWorkstation
          currentUser={currentUser}
          currentUserDoctorId={currentUserDoctorId}
          onLogout={handleLogout}
        />
      </React.Suspense>
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
        currentUserRole={currentUserRole}
        isOnline={isOnline}
        pendingAppointmentsCount={pendingAppointmentsCount}
        dueFollowUpsCount={dueFollowUpsCount}
        onLogout={handleLogout}
        onNewReceipt={() => { setEditingReceipt(null); setActiveTab('new-receipt'); setIsMobileMenuOpen(false); }}
        isMobileMenuOpen={isMobileMenuOpen}
        closeMenu={() => setIsMobileMenuOpen(false)}
        allowedTabs={allowedTabs as Tab[]}
      />

      <main className={`main-content ${receiptsToPrint.length > 0 || activePrintPrescription ? 'no-print' : ''}`}>
        <header className="content-header no-print">
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {activeTab === 'dashboard' && 'Executive Dashboard'}
              {activeTab === 'new-receipt' && 'Create Patient Receipt'}
              {activeTab === 'nursing-station' && 'Nursing & eMAR Station'}
              {activeTab === 'emergency' && 'Emergency Department & Casualty Triage (ER)'}
              {activeTab === 'ot-management' && 'Operation Theatre (OT) Management Suite'}
              {activeTab === 'beds' && 'Inpatient Bed & Ward Occupancy Matrix (IPD)'}
              {activeTab === 'inpatient-census' && 'Inpatient Census & Clinical Registry'}
              {activeTab === 'facility-billing' && 'Inpatient & Facility Billing'}
              {activeTab === 'history' && 'Invoices & Billing History'}
              {activeTab === 'prescriptions' && 'Prescriptions (Rx) Registry'}
              {activeTab === 'pharmacy' && 'Hospital Pharmacy & Dispensary'}
              {activeTab === 'appointments' && 'Appointment Booking Desk'}
              {activeTab === 'follow-ups' && 'Patient Follow-Up Tracker'}
              {activeTab === 'doctors' && 'Doctors Registry'}
              {activeTab === 'services' && 'Clinic Services Catalog'}
              {activeTab === 'expenses' && 'Clinic Expenses'}
              {activeTab === 'doctor-payouts' && 'Doctor Revenue Share & Disbursements Engine'}
              {activeTab === 'queue-display' && 'OPD Waiting Area Token Caller & Queue Display (QDS)'}
              {activeTab === 'stock-indenting' && 'Hospital Ward & OT Stock Requisition Indents'}
              {activeTab === 'users' && 'Clinic Profiles & Users'}
              {activeTab === 'settings' && 'System Control Center'}
            </h1>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {activeTab === 'dashboard' && 'Overview of clinic operations, revenue, and live queue'}
              {activeTab === 'new-receipt' && 'Generate and print patient consultation invoices'}
              {activeTab === 'nursing-station' && 'Bedside clinical surveillance, medication administration, vitals flowsheet & shift handover (iPad/Mobile)'}
              {activeTab === 'emergency' && 'ESI Triage (Levels 1-5), acute resuscitation, Medico-Legal Cases (MLC) & fast-track IPD admissions'}
              {activeTab === 'ot-management' && 'Live OT schedule, WHO surgical safety checklist, intra-operative records & PACU recovery'}
              {activeTab === 'beds' && 'Visual floor plan, 1-click admissions, vitals surveillance, bed transfers & facility billing integration'}
              {activeTab === 'inpatient-census' && 'Live roster of active inpatients, stay duration, clinical vitals surveillance & financial folios'}
              {activeTab === 'facility-billing' && 'Itemized billing for room rent, oxygen supply, nursing care & procedures'}
              {activeTab === 'history' && 'Search, filter, reprint, and export financial records'}
              {activeTab === 'prescriptions' && 'Patient consultation records, diagnoses & medication charts'}
              {activeTab === 'pharmacy' && 'Dispensary POS, 1-click prescription fulfillment, batches, expiry radar & stock management'}
              {activeTab === 'appointments' && 'Manage WhatsApp & reception patient appointment requests'}
              {activeTab === 'follow-ups' && 'Track patient revisit schedules, overdue reviews & WhatsApp reminders'}
              {activeTab === 'doctors' && 'Manage consulting physicians, qualifications & UPI QR setups'}
              {activeTab === 'services' && 'Standard consultation and treatment fee pricing'}
              {activeTab === 'expenses' && 'Track operational expenses, utility bills, clinic supplies & cashflow'}
              {activeTab === 'doctor-payouts' && 'Custom commissions (OPD %, IPD visit fee, OT surgery cut, Lab cut), TDS deduction & disbursement vouchers'}
              {activeTab === 'queue-display' && 'Multi-chamber live queue status, Web Speech API voice token caller & high-visibility 1080p TV projection'}
              {activeTab === 'stock-indenting' && 'Departmental pharmacy requisitions, STAT/urgent priority tracking & atomic batch fulfillment'}
              {activeTab === 'users' && 'Manage authorized staff accounts, doctor linking & modular screen permissions'}
              {activeTab === 'settings' && 'Backups, printer paper presets, network sync & licensing'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid var(--border)', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
              <span>🖨️ {receiptPaperType === 'Thermal80' ? 'Thermal 80mm' : receiptPaperType === 'Thermal58' ? 'Thermal 58mm' : receiptPaperType}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>Rx: {prescriptionPaperType}</span>
            </div>

            {activeTab !== 'new-receipt' && allowedTabs.includes('new-receipt') && (
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
          {/* Doctor Called Next Patient alert banner for Reception */}
          {doctorCallNotification && (
            <div
              className="no-print"
              style={{
                background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
                color: 'white',
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 6px 16px rgba(2, 132, 199, 0.3)',
                gap: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ fontSize: '1.4rem', background: 'rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: '10px' }}>🔔</span>
                <div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '0.2px' }}>
                    Doctor Calling Next: Send Token #{doctorCallNotification.token} — {doctorCallNotification.patientName}
                  </div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.95, marginTop: '2px' }}>
                    Please direct patient to: <strong style={{ color: '#fef08a' }}>{doctorCallNotification.chamberName}</strong> ({doctorCallNotification.doctorName})
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setDoctorCallNotification(null)}
                  style={{
                    background: '#22c55e',
                    color: 'white',
                    padding: '0.5rem 1.1rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(34, 197, 94, 0.4)'
                  }}
                >
                  ✓ Patient Sent In
                </button>
                <button
                  onClick={() => setDoctorCallNotification(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    border: '1px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Pending appointments alert banner */}
          {pendingAppointmentsCount > 0 && activeTab !== 'appointments' && allowedTabs.includes('appointments') && (
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
              allowedTabs={allowedTabs as Tab[]}
              onNavigate={(tab) => setActiveTab(tab)}
              onNewReceipt={() => setActiveTab('new-receipt')}
            />
          )}
          <React.Suspense fallback={<TabFallback />}>
            {activeTab === 'doctors' && <DoctorManagement doctors={doctors} onUpdate={refreshData} />}
            {activeTab === 'services' && <ServiceManagement services={services} onUpdate={refreshData} />}
            {activeTab === 'expenses' && <ExpensesTab />}
            {activeTab === 'new-receipt' && (
              <ReceiptForm
                doctors={doctors}
                initialData={editingReceipt}
                onSave={() => { refreshData(); setEditingReceipt(null); }}
                onPrintRequest={(receipt) => {
                  setReceiptsToPrint([receipt]);
                  setTimeout(() => window.print(), 150);
                }}
              />
            )}
            {activeTab === 'beds' && (
              <BedsTab
                doctors={doctors}
                onNavigateToBilling={(admission) => {
                  setBillingInitialAdmission(admission);
                  setActiveTab('facility-billing');
                }}
                onNavigateToCensus={() => setActiveTab('inpatient-census')}
              />
            )}
            {activeTab === 'nursing-station' && (
              <NursingStationTab
                currentUser={currentUser || 'Duty Nurse'}
              />
            )}
            {activeTab === 'inpatient-census' && (
              <InpatientCensusTab
                doctors={doctors}
                onNavigateToBilling={(admission) => {
                  setBillingInitialAdmission(admission);
                  setActiveTab('facility-billing');
                }}
                onNavigateToBeds={() => setActiveTab('beds')}
              />
            )}
            {activeTab === 'facility-billing' && (
              <FacilityBillingTab
                doctors={doctors}
                initialAdmission={billingInitialAdmission}
                onClearInitialAdmission={() => setBillingInitialAdmission(null)}
                onSave={() => { refreshData(); }}
                onPrintRequest={(receipt) => {
                  setReceiptsToPrint([receipt]);
                  setTimeout(() => window.print(), 150);
                }}
              />
            )}
            {activeTab === 'insurance' && (
              <InsuranceTab />
            )}
            {activeTab === 'emergency' && (
              <EmergencyTab
                doctors={doctors}
                onNavigateToBed={() => setActiveTab('beds')}
                onNavigateToBilling={() => setActiveTab('facility-billing')}
              />
            )}
            {activeTab === 'ot-management' && (
              <OtManagementTab
                doctors={doctors}
                onNavigateToBed={() => setActiveTab('beds')}
                onNavigateToBilling={() => setActiveTab('facility-billing')}
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
            {activeTab === 'pharmacy' && (
              <PharmacyTab onRefresh={refreshData} />
            )}
            {activeTab === 'lab' && (
              <LaboratoryTab onRefresh={refreshData} />
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
            {activeTab === 'doctor-payouts' && (
              <DoctorPayoutsTab doctors={doctors} />
            )}
            {activeTab === 'queue-display' && (
              <QueueDisplayTab doctors={doctors} />
            )}
            {activeTab === 'stock-indenting' && (
              <StockIndentingTab />
            )}
            {activeTab === 'users' && (
              <UsersTab
                currentUser={currentUser}
                knownUsers={knownUsers}
                setKnownUsers={setKnownUsers}
                doctors={doctors}
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
          </React.Suspense>
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
