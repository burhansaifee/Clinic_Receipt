import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LayoutDashboard, Users, Receipt, PlusCircle, Settings, ShieldCheck, Copy, Calendar, DownloadCloud, UploadCloud, FileText, Filter, Briefcase, Printer, Trash2, Edit2, FolderOpen, Search, LogOut, KeyRound, Server, AlertCircle, MessageSquare, Bot } from 'lucide-react';

import { storage, formatAgeGender, type Doctor, type Receipt as ReceiptType, type Service } from './lib/storage';
import './index.css';

// Components
import Dashboard from './components/Dashboard';
import DoctorManagement from './components/DoctorManagement';
import ServiceManagement from './components/ServiceManagement';
import ReceiptForm from './components/ReceiptForm';
import ActivationScreen from './components/ActivationScreen';
import UserConnectionScreen from './components/UserConnectionScreen';
import DoctorWorkstation from './components/DoctorWorkstation';
import AppointmentManagement from './components/AppointmentManagement';

type Tab = 'dashboard' | 'doctors' | 'services' | 'new-receipt' | 'history' | 'prescriptions' | 'appointments' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [receipts, setReceipts] = useState<ReceiptType[]>([]);
  const [activationStatus, setActivationStatus] = useState<{status: 'NOT_ACTIVATED' | 'ACTIVATED' | 'EXPIRED' | 'TAMPERED'; expiryDate?: string} | null>(null);
  const [machineId, setMachineId] = useState<string>('');
  
  // User Management State
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('reception');
  const [currentUserDoctorId, setCurrentUserDoctorId] = useState<string | null>(null);
  const [knownUsers, setKnownUsers] = useState<{ id: string, role: string, doctorId?: string }[]>([]);
  const [newUserIdInput, setNewUserIdInput] = useState('');
  const [newUserRole, setNewUserRole] = useState<'reception' | 'doctor'>('reception');
  const [selectedDoctorIdForUser, setSelectedDoctorIdForUser] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [botStatus, setBotStatus] = useState<any>({ status: 'DISCONNECTED', qrCodeDataUrl: null });

  // Workstation Connection State
  const [workstationMode, setWorkstationMode] = useState<'standalone' | 'host' | 'client'>('standalone');
  const [hostIp, setHostIp] = useState('127.0.0.1');
  const [hostPort, setHostPort] = useState(49152);
  const [localIp, setLocalIp] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  // History Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [receiptsToPrint, setReceiptsToPrint] = useState<ReceiptType[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingReceipt, setEditingReceipt] = useState<ReceiptType | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [activePrintPrescription, setActivePrintPrescription] = useState<any | null>(null);
  const [rxSearchQuery, setRxSearchQuery] = useState<string>('');

  const filteredReceipts = receipts.filter(r => {
    const rDate = r.date.split(' ')[0];
    const afterStart = !startDate || rDate >= startDate;
    const beforeEnd = !endDate || rDate <= endDate;
    const matchesSearch = !searchQuery || 
      r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (r.patientPhone && r.patientPhone.includes(searchQuery)) ||
      r.receiptNumber.includes(searchQuery);
    return afterStart && beforeEnd && matchesSearch;
  });

  const refreshData = React.useCallback(async () => {
    const [d, s, r, p] = await Promise.all([
      storage.getDoctors(),
      storage.getServices(),
      storage.getReceipts(),
      storage.getPrescriptions()
    ]);
    setDoctors(d);
    setServices(s);
    setReceipts(r);
    setPrescriptions(p);
  }, []);

  useEffect(() => {
    if (!currentUser || currentUserRole === 'doctor') return;
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [currentUser, currentUserRole, refreshData]);

  useEffect(() => {
    const checkLicense = async () => {
      // @ts-ignore
      const result = await window.licensing.checkActivation();
      setActivationStatus(result);
    };

    const checkActiveUser = async () => {
      try {
        // @ts-ignore
        const user = await window.users.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          // @ts-ignore
          const role = await window.users.getCurrentUserRole();
          setCurrentUserRole(role);
          // @ts-ignore
          const doctorId = await window.users.getCurrentUserDoctorId();
          setCurrentUserDoctorId(doctorId || null);
        }
      } catch (err) {
        console.error('Failed to get active user:', err);
      }
    };

    const loadUsers = async () => {
      try {
        // @ts-ignore
        const users = await window.users.getKnownUsers();
        setKnownUsers(users);
      } catch (err) {
        console.error('Failed to get recognized users:', err);
      }
    };

    const loadConnectionSettings = async () => {
      try {
        // @ts-ignore
        if (window.connection) {
          // @ts-ignore
          const settings = await window.connection.getSettings();
          setWorkstationMode(settings.mode);
          setHostIp(settings.hostIp);
          setHostPort(settings.hostPort);
          setLocalIp(settings.localIp);
        }
      } catch (err) {
        console.error('Failed to load connection settings:', err);
      }
    };

    checkLicense();
    checkActiveUser();
    loadUsers();
    loadConnectionSettings();
  }, []);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      setReceiptsToPrint([]);
      setActivePrintPrescription(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if ((window as any).whatsappBot) {
      (window as any).whatsappBot.getStatus().then((status: any) => {
        setBotStatus(status);
      });
      const unsubscribe = (window as any).whatsappBot.onStatusChange((status: any) => {
        setBotStatus(status);
      });
      return () => {
        unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const loadUserData = async () => {
      // Migrate to SQLite if needed
      await storage.migrateToSQLite();

      const receipts = await storage.getReceipts();
      const doctors = await storage.getDoctors();

      // If database is empty, try loading from Excel
      if (receipts.length === 0 && doctors.length === 0) {
        // @ts-ignore
        const excelData = await window.excelStorage?.loadData();
        if (excelData) {
          await storage.importData(JSON.stringify(excelData));
        }
      }
      refreshData();
    };

    loadUserData();
  }, [currentUser, refreshData]);

  useEffect(() => {
    if (activeTab === 'settings' && !machineId) {
      // @ts-ignore
      window.licensing.getMachineID().then(id => setMachineId(id));
    }
  }, [activeTab]);





  const handleLogout = async () => {
    if (confirm('Are you sure you want to disconnect from this profile? Your local SQLite database will remain secure on this device.')) {
      // @ts-ignore
      await window.users.disconnectUser();
      setCurrentUser(null);
      setCurrentUserRole('reception');
      setCurrentUserDoctorId(null);
      setDoctors([]);
      setServices([]);
      setReceipts([]);
      setActiveTab('dashboard');
    }
  };

  const handleTestConnection = async () => {
    if (!hostIp.trim()) {
      alert('Please enter a Host IP Address');
      return;
    }
    setIsTestingConnection(true);
    try {
      // @ts-ignore
      const result = await window.connection.testConnection(hostIp.trim(), hostPort);
      if (result.success) {
        alert('Connection Successful! The Host server is reachable.');
      } else {
        alert(`Connection Failed: ${result.error || 'Check server status and IP address.'}`);
      }
    } catch (e: any) {
      alert(`Connection Error: ${e.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveConnectionSettings = async () => {
    if (workstationMode === 'client' && !hostIp.trim()) {
      alert('Please enter a Host IP Address');
      return;
    }
    if (confirm('MedFlow Clinic needs to relaunch to apply these network connection settings. Proceed?')) {
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

  const handleAddUser = async () => {
    const userId = newUserIdInput.trim().toLowerCase();
    if (!userId) return;
    
    // @ts-ignore
    const result = await window.users.addKnownUser(userId, newUserRole, newUserRole === 'doctor' ? selectedDoctorIdForUser : undefined);
    if (result.success) {
      setNewUserIdInput('');
      setNewUserRole('reception');
      setSelectedDoctorIdForUser('');
      // @ts-ignore
      const users = await window.users.getKnownUsers();
      setKnownUsers(users);
      alert(`User ID "${userId}" has been successfully registered!`);
    } else {
      alert(result.error || 'Failed to add user.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === 'default') return;
    if (confirm(`Are you sure you want to delete the User ID "${userId}"? This will lock access to this profile's database, though the database files will remain on disk.`)) {
      // @ts-ignore
      const result = await window.users.deleteKnownUser(userId);
      if (result.success) {
        // @ts-ignore
        const users = await window.users.getKnownUsers();
        setKnownUsers(users);
        if (currentUser === userId) {
          setCurrentUser(null);
        }
        alert(`User ID "${userId}" has been removed.`);
      } else {
        alert(result.error || 'Failed to delete user.');
      }
    }
  };

  const handlePrint = (input: ReceiptType | ReceiptType[]) => {
    const receipts = Array.isArray(input) ? input : [input];
    setReceiptsToPrint(receipts);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkPrint = () => {
    const receipts = filteredReceipts.filter(r => selectedIds.has(r.id));
    handlePrint(receipts);
  };

  const handlePrintRx = (rx: any) => {
    setActivePrintPrescription(rx);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDeleteReceipt = (id: string) => {
    if (confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      storage.deleteReceipt(id);
      refreshData();
      if (selectedIds.has(id)) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  const handleEditReceipt = (receipt: ReceiptType) => {
    setEditingReceipt(receipt);
    setActiveTab('new-receipt');
  };

  if (activationStatus === null) {
    return <div className="loading-screen">Loading MedFlow Clinic...</div>;
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
    return <UserConnectionScreen onConnected={(userId, role, doctorId) => {
      setCurrentUser(userId);
      setCurrentUserRole(role);
      setCurrentUserDoctorId(doctorId || null);
      // @ts-ignore
      window.users.getKnownUsers().then((users: { id: string, role: string, doctorId?: string }[]) => setKnownUsers(users));
    }} />;
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

  return (
    <div className="app-container">
      <aside className="sidebar no-print">
        <div className="sidebar-header">
          <div className="logo">
            <svg className="logo-svg" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
              <rect x="32" y="32" width="448" height="448" rx="110" fill="url(#logoGrad)" />
              <path d="M256 128 V384 M128 256 H384" stroke="#ffffff" strokeWidth="64" strokeLinecap="round" />
            </svg>
            <span>MedFlow</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'new-receipt' ? 'active' : ''}`}
            onClick={() => { setEditingReceipt(null); setActiveTab('new-receipt'); }}
          >
            <PlusCircle size={20} />
            <span>New Receipt</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Receipt size={20} />
            <span>History</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'prescriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('prescriptions')}
          >
            <FileText size={20} />
            <span>Prescriptions</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            <Calendar size={20} />
            <span>Appointments</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            <Users size={20} />
            <span>Doctors</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            <Briefcase size={20} />
            <span>Clinic Services</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Control Center</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-container" style={{ flexDirection: 'column', width: '100%', marginBottom: '1rem' }}>
            <div className="user-profile" style={{ width: '100%', justifyContent: 'center' }}>
              <KeyRound size={14} style={{ marginRight: '6px', color: '#0ea5e9' }} />
              <span>Workstation: <strong>{currentUser}</strong></span>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Sign Out Profile" style={{ width: '100%', justifyContent: 'center' }}>
              <LogOut size={15} />
              <span>Disconnect</span>
            </button>
          </div>
          {(currentUser && currentUser !== 'default' && isOnline) ? (
            <div className="status-badge online">
              <div className="dot green"></div>
              Online Mode Active
            </div>
          ) : (currentUser && currentUser !== 'default' && !isOnline) ? (
            <div className="status-badge offline">
              <div className="dot amber"></div>
              Offline (No Network)
            </div>
          ) : (
            <div className="status-badge offline">
              <div className="dot amber"></div>
              Offline Mode Active
            </div>
          )}
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Software Developed by</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>Badshah Computer's</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Email:- burhansaifee2003@gmail.com</div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header no-print">
          <h1>{activeTab.replace('-', ' ').toUpperCase()}</h1>
        </header>

        <div className="content-inner">
          {activeTab === 'dashboard' && <Dashboard doctors={doctors} receipts={receipts} onNewReceipt={() => { setEditingReceipt(null); setActiveTab('new-receipt'); }} />}
          {activeTab === 'doctors' && <DoctorManagement doctors={doctors} onUpdate={refreshData} />}
          {activeTab === 'services' && <ServiceManagement services={services} onUpdate={refreshData} />}
          {activeTab === 'new-receipt' && <ReceiptForm doctors={doctors} initialData={editingReceipt} onSave={() => { refreshData(); setEditingReceipt(null); setActiveTab('history'); }} />}
          {activeTab === 'history' && (
              <div className="history-page">
                <div className="card filter-card no-print">
                  <div className="filter-header">
                    <div className="filter-title">
                      <div className="filter-icon-bg">
                        <Filter size={16} />
                      </div>
                      <h3>Records Explorer</h3>
                    </div>
                    {(startDate || endDate || searchQuery) && (
                      <button className="btn-reset" onClick={() => { setStartDate(''); setEndDate(''); setSearchQuery(''); }}>
                        Show All Records
                      </button>
                    )}
                  </div>
                  <div className="filter-controls">
                    <div className="range-filter-group">
                      <div className="filter-input-wrapper">
                        <Search size={16} className="input-icon" />
                        <input 
                          type="text" 
                          placeholder="Search patient, phone, receipt..." 
                          value={searchQuery} 
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="filter-input-wrapper calendar-picker">
                        <span className="input-label-inline">From</span>
                        <Calendar size={14} className="input-icon shifted" />
                        <input 
                          type="date" 
                          value={startDate} 
                          onChange={e => setStartDate(e.target.value)}
                          className="date-input"
                        />
                      </div>
                      <div className="filter-input-wrapper calendar-picker">
                        <span className="input-label-inline">To</span>
                        <Calendar size={14} className="input-icon shifted" />
                        <input 
                          type="date" 
                          value={endDate} 
                          onChange={e => setEndDate(e.target.value)}
                          className="date-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card financial-summary no-print">
                  <div className="summary-header">
                    <h2>Financial Summary {startDate || endDate ? `Period: ${startDate || 'Start'} to ${endDate || 'Today'}` : 'Overview'}</h2>
                    <button className="btn-secondary" onClick={() => storage.exportToExcel()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} /> Export CSV Report
                    </button>
                  </div>

                  <div className="summary-grid">

                    {Object.entries(
                      filteredReceipts.reduce((acc, r) => {
                          const name = r.doctorName || 'General';
                          const amount = r.paymentMethod === 'FREE' ? 0 : (Number(r.total) || 0);
                          acc[name] = (acc[name] || 0) + amount;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([name, total]) => (
                      <div key={name} className="metric-card doctor-metric">
                        <div className="metric-icon secondary"><Users size={16} /></div>
                        <div className="metric-info">
                          <span className="label">{name}</span>
                          <span className="value small">₹{total.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                    <div className="history-list no-print">
                      {selectedIds.size > 0 && (
                        <div className="bulk-action-bar anim-up">
                          <div className="bulk-info">
                            <span className="bulk-count">{selectedIds.size} records selected</span>
                            <button className="btn-ghost-sm" onClick={clearSelection}>Clear Selection</button>
                          </div>
                          <button className="btn-primary-sm bulk-print-btn" onClick={handleBulkPrint}>
                            <Printer size={16} /> Print Selected
                          </button>
                        </div>
                      )}

                      {filteredReceipts.length === 0 ? (
                        <div className="card empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
                          <p className="text-muted">No receipts found for the selected period.</p>
                        </div>
                      ) : (
                        Object.entries(
                          filteredReceipts.reduce((acc, r) => {
                            const dateOnly = r.date.split(' ')[0];
                            if (!acc[dateOnly]) acc[dateOnly] = [];
                            acc[dateOnly].push(r);
                            return acc;
                          }, {} as Record<string, ReceiptType[]>)
                        )
                        .sort((a,b) => b[0].localeCompare(a[0]))
                        .map(([date, dateReceipts]) => {
                          const dailyDoctorTotals = dateReceipts.reduce((acc, r) => {
                            const name = r.doctorName || 'General';
                            const amount = r.paymentMethod === 'FREE' ? 0 : (Number(r.total) || 0);
                            acc[name] = (acc[name] || 0) + amount;
                            return acc;
                          }, {} as Record<string, number>);

                          return (
                            <div key={date} className="date-group-modern">
                              <div className="date-header">
                                <div className="date-info">
                                  <Calendar size={18} />
                                  <h3>{date}</h3>
                                  <button 
                                    className="btn-ghost-xs"
                                    onClick={() => {
                                      const ids = dateReceipts.map(r => r.id);
                                      setSelectedIds(prev => {
                                        const next = new Set(prev);
                                        const allSelected = ids.every(id => next.has(id));
                                        if (allSelected) ids.forEach(id => next.delete(id));
                                        else ids.forEach(id => next.add(id));
                                        return next;
                                      });
                                    }}
                                  >
                                    {dateReceipts.every(r => selectedIds.has(r.id)) ? 'Deselect All' : 'Select All'}
                                  </button>
                                </div>
                                <div className="date-totals">
                                  {Object.entries(dailyDoctorTotals).map(([name, total]) => (
                                    <div key={name} className="dr-day-total">
                                      {name}: <strong>₹{total.toLocaleString()}</strong>
                                    </div>
                                  ))}
                                  <div className="day-sum">
                                    Day Total: <strong>₹{dateReceipts.reduce((sum, r) => sum + (r.paymentMethod === 'FREE' ? 0 : (Number(r.total) || 0)), 0).toLocaleString()}</strong>
                                  </div>
                                </div>
                              </div>
                              <div className="receipt-items-table-container">
                                <table className="history-table">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '40px' }}></th>
                                      <th>Receipt</th>
                                      <th>Patient</th>
                                      <th>Doctor & Method</th>
                                      <th className="text-right">Amount</th>
                                      <th className="text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dateReceipts.slice().reverse().map(r => (
                                      <tr key={r.id} className={`receipt-table-row ${selectedIds.has(r.id) ? 'selected' : ''}`}>
                                        <td className="center-cell">
                                          <input 
                                            type="checkbox" 
                                            checked={selectedIds.has(r.id)}
                                            onChange={() => toggleSelection(r.id)}
                                            className="row-checkbox"
                                          />
                                        </td>
                                        <td>
                                          <span className="r-num">#{r.receiptNumber}</span>
                                        </td>
                                        <td>
                                          <div className="r-name">{r.patientName}</div>
                                          {r.patientPhone && <div className="r-ph">{r.patientPhone}</div>}
                                        </td>
                                        <td>
                                          <div className="r-dr">by {r.doctorName}</div>
                                          <span className={`payment-badge ${(r.paymentMethod || 'CASH').toLowerCase()}`}>
                                            {r.paymentMethod || 'CASH'}
                                          </span>
                                        </td>
                                        <td className="text-right">
                                          <span className="r-amt">₹{(Number(r.total) || 0).toFixed(2)}</span>
                                        </td>
                                        <td className="text-right">
                                           <div className="action-buttons">
                                              <button 
                                                className="btn-icon-xs print-btn" 
                                                onClick={() => handlePrint(r)}
                                                title="Print Receipt"
                                              >
                                                <Printer size={14} />
                                              </button>
                                              <button 
                                                className="btn-icon-xs edit-btn" 
                                                onClick={() => handleEditReceipt(r)}
                                                title="Edit Receipt"
                                              >
                                                <Edit2 size={14} />
                                              </button>
                                              <button 
                                                className="btn-icon-xs delete-btn" 
                                                onClick={() => handleDeleteReceipt(r.id)}
                                                title="Delete Receipt"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                           </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

          {activeTab === 'prescriptions' && (
            <div className="prescriptions-page tab-pane">
              <div className="card filter-card no-print">
                <div className="filter-header" style={{ marginBottom: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="filter-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="filter-icon-bg" style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: '0', fontSize: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>Prescription Explorer</h3>
                      <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quick access to print prescriptions created by doctors</p>
                    </div>
                  </div>
                  <div className="search-bar" style={{ position: 'relative', width: '320px' }}>
                    <Search size={18} className="search-icon" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      placeholder="Search patient name, phone, doctor..." 
                      value={rxSearchQuery}
                      onChange={e => setRxSearchQuery(e.target.value)}
                      className="sync-input-line"
                      style={{ paddingLeft: '2.5rem', width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="history-list no-print" style={{ marginTop: '1.5rem' }}>
                {prescriptions.filter(p => {
                  const query = rxSearchQuery.toLowerCase();
                  return !query || 
                    p.patientName.toLowerCase().includes(query) ||
                    p.patientPhone.includes(query) ||
                    p.doctorName.toLowerCase().includes(query) ||
                    (p.diagnosis && p.diagnosis.toLowerCase().includes(query));
                }).length === 0 ? (
                  <div className="card empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
                    <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                    <p className="text-muted">No prescriptions written yet or matches found.</p>
                  </div>
                ) : (
                  <div className="history-table-wrapper" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}>Date</th>
                          <th style={{ padding: '1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}>Patient Details</th>
                          <th style={{ padding: '1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}>Age / Gender</th>
                          <th style={{ padding: '1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}>Prescribed By</th>
                          <th style={{ padding: '1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}>Diagnosis</th>
                          <th style={{ padding: '1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}>Medicines</th>
                          <th className="text-center" style={{ padding: '1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', width: '100px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptions
                          .filter(p => {
                            const query = rxSearchQuery.toLowerCase();
                            return !query || 
                              p.patientName.toLowerCase().includes(query) ||
                              p.patientPhone.includes(query) ||
                              p.doctorName.toLowerCase().includes(query) ||
                              (p.diagnosis && p.diagnosis.toLowerCase().includes(query));
                          })
                          .map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{p.date}</td>
                              <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                <strong style={{ color: 'var(--text-main)' }}>{p.patientName}</strong><br/>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.patientPhone || 'No Phone'}</span>
                              </td>
                              <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{formatAgeGender(p.patientAge, p.patientGender)}</td>
                              <td style={{ padding: '1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Dr. {p.doctorName}</td>
                              <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{p.diagnosis || 'N/A'}</td>
                              <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                  {(p.medicines || []).map((m: any, idx: number) => (
                                    <span key={idx} style={{ background: '#f1f5f9', color: '#475569', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}>
                                      {m.name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="text-center" style={{ padding: '1rem' }}>
                                <button 
                                  className="btn-icon-xs print-rx-btn" 
                                  onClick={() => handlePrintRx(p)}
                                  title="Print Prescription (Rx)"
                                  style={{ color: '#0ea5e9', background: '#f0f9ff', borderColor: '#e0f2fe', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Printer size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
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
                });
                setActiveTab('new-receipt');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <div className="control-center">
              <div className="control-header-banner" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white', padding: '1.75rem 2rem', borderRadius: '16px', marginBottom: '2rem', boxShadow: '0 10px 25px -5px rgba(15,23,42,0.15)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(14,165,233,0.15)', color: '#38bdf8', fontSize: '0.725rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '9999px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.65rem', border: '1px solid rgba(56,189,248,0.25)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} /> CONTROL CENTER & CONFIGURATION
                </div>
                <h2 style={{ fontSize: '1.65rem', margin: '0 0 0.4rem 0', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'white' }}>System Control Center</h2>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', maxWidth: '640px', lineHeight: 1.5 }}>
                  Manage your clinic's database backups, system license, automated WhatsApp booking bot, workstation user profiles, and local network sync.
                </p>
              </div>

              <div className="control-grid">
                {/* Data Safety, Backup & Reports */}
                <div className="card control-card" style={{ padding: '1.5rem', gap: '0.85rem' }}>
                  <div className="card-icon-header inline">
                    <div className="header-icon blue" style={{ background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: 'white', boxShadow: '0 4px 10px rgba(14,165,233,0.3)' }}><DownloadCloud size={18} /></div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Data Safety & Reports</h3>
                  </div>
                  <p className="card-description">Export SQLite database backups, import backup files, view raw data folders, or download CSV reports.</p>
                  
                  <div className="card-actions-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-primary-sm" style={{ flex: 1, padding: '0.65rem 0.75rem' }} onClick={() => storage.exportData()}>
                        <DownloadCloud size={15} /> Export DB
                      </button>
                      <button className="btn-secondary-sm" style={{ flex: 1, padding: '0.65rem 0.75rem' }} onClick={() => document.getElementById('import-file')?.click()}>
                        <UploadCloud size={15} /> Import DB
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-ghost-sm" style={{ flex: 1, border: '1px solid var(--border)', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }} onClick={() => storage.exportToExcel()}>
                        <FileText size={15} /> Export CSV
                      </button>
                      <button className="btn-ghost-sm" style={{ flex: 1, border: '1px solid var(--border)', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }} onClick={() => (window as any).database.openFolder()}>
                        <FolderOpen size={15} /> Data Folder
                      </button>
                    </div>
                  </div>
                  <input 
                    type="file" accept=".json" id="import-file" style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        if (await storage.importData(event.target?.result as string)) {
                          alert('Data imported successfully! The app will now reload.');
                          window.location.reload();
                        } else {
                          alert('Error: This file is not a valid MedFlow backup.');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </div>

                {/* WhatsApp Bot Setup */}
                <div className="card control-card" style={{ padding: '1.5rem', gap: '0.85rem' }}>
                  <div className="card-icon-header inline">
                    <div className="header-icon green" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}><MessageSquare size={18} /></div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>WhatsApp Bot Setup</h3>
                  </div>
                  <p className="card-description">Enable automated patient appointment booking and instant WhatsApp notifications for your clinic.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
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
                      <div style={{ textAlign: 'center', background: '#f0f9ff', padding: '1rem', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                        <p style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 600, marginBottom: '0.5rem' }}>
                          📱 Scan with WhatsApp (Settings → Linked Devices)
                        </p>
                        <img src={botStatus.qrCodeDataUrl} alt="WhatsApp QR Code" style={{ width: '170px', height: '170px', margin: '0 auto', display: 'block', borderRadius: '8px', border: '2px solid white' }} />
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

                {/* Workstation Connection Settings */}
                <div className="card control-card" style={{ padding: '1.5rem', gap: '0.85rem' }}>
                  <div className="card-icon-header inline">
                    <div className="header-icon cyan" style={{ background: 'linear-gradient(135deg, #06b6d4, #0d9488)', color: 'white', boxShadow: '0 4px 10px rgba(6,182,212,0.3)' }}><Server size={18} /></div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Workstation Connection</h3>
                  </div>
                  <p className="card-description">Configure network connection mode (Standalone, Central Host Server, or Client workstation).</p>
                  
                  <div className="connection-settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CONNECTION MODE</label>
                      <select 
                        value={workstationMode}
                        onChange={(e) => setWorkstationMode(e.target.value as any)}
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
                              onChange={(e) => setHostIp(e.target.value)}
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
                              onChange={(e) => setHostPort(Number(e.target.value))}
                              placeholder="49152"
                              className="sync-input-line"
                              style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button 
                            type="button" 
                            className="btn-secondary-sm" 
                            style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem' }} 
                            onClick={handleTestConnection}
                            disabled={isTestingConnection}
                          >
                            {isTestingConnection ? 'Testing...' : 'Test Connection'}
                          </button>
                          <button 
                            type="button" 
                            className="btn-primary-sm" 
                            style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem' }} 
                            onClick={handleSaveConnectionSettings}
                          >
                            Save & Relaunch
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
                              onChange={(e) => setHostPort(Number(e.target.value))}
                              placeholder="49152"
                              className="sync-input-line"
                              style={{ margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                            />
                          </div>
                        </div>

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

                        <button 
                          type="button" 
                          className="btn-primary-sm" 
                          style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', marginTop: '4px' }} 
                          onClick={handleSaveConnectionSettings}
                        >
                          Save & Relaunch
                        </button>
                      </>
                    )}

                    {workstationMode === 'standalone' && (
                      <button 
                        type="button" 
                        className="btn-primary-sm" 
                        style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', marginTop: '4px' }} 
                        onClick={handleSaveConnectionSettings}
                      >
                        Save Network Settings
                      </button>
                    )}
                  </div>
                </div>

                {/* Clinic Profiles & Users */}
                <div className="card control-card" style={{ padding: '1.5rem', gap: '0.85rem' }}>
                  <div className="card-icon-header inline">
                    <div className="header-icon red" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', boxShadow: '0 4px 10px rgba(244,63,94,0.3)' }}><KeyRound size={18} /></div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Clinic Profiles & Users</h3>
                  </div>
                  <p className="card-description">Manage User IDs authorized to access workspace profiles on this workstation.</p>
                  
                  {currentUser === 'admin' ? (
                    <div className="user-management-section">
                      <div className="add-user-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
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
                        <span className="label-caps" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>REGISTERED PROFILES</span>
                        <div className="users-list" style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                          {knownUsers.map(user => (
                            <div key={user.id} className="user-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                              <span className="user-list-name" style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                <strong>{user.id}</strong> <span style={{ opacity: 0.65, fontSize: '0.75rem', marginLeft: '4px' }}>({user.role})</span> {user.id === currentUser && <span style={{ color: '#0ea5e9', fontSize: '0.75rem', marginLeft: '6px', fontWeight: 600 }}>(active)</span>}
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
                    <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#b45309', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <AlertCircle size={16} />
                      <span>Only administrator (<strong>admin</strong>) can manage clinic accounts.</span>
                    </div>
                  )}
                </div>

                {/* System License */}
                <div className="card control-card" style={{ gridColumn: 'span 2', justifySelf: 'center', width: '100%', maxWidth: '480px', padding: '1.5rem', gap: '0.85rem' }}>
                  <div className="card-icon-header inline">
                    <div className="header-icon gray" style={{ background: 'linear-gradient(135deg, #475569, #1e293b)', color: 'white', boxShadow: '0 4px 10px rgba(71,85,105,0.3)' }}><ShieldCheck size={18} /></div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>System License</h3>
                  </div>
                  <p className="card-description">View active license duration, device machine ID, or renew your system registration.</p>
                  
                  <div className="license-status-section" style={{ paddingTop: '0.25rem', gap: '0.75rem' }}>
                    <div className="license-row">
                      <span className="label-caps">STATUS</span>
                      <div className={`license-badge-modern ${activationStatus?.status === 'ACTIVATED' ? 'active' : ''}`} style={{ padding: '0.35rem 0.85rem', borderRadius: '10px' }}>
                        <div className="dot"></div>
                        <span>{activationStatus?.status === 'ACTIVATED' ? 'ACTIVATED' : activationStatus?.status}</span>
                        {activationStatus?.expiryDate && <span className="expiry-date">({activationStatus.expiryDate})</span>}
                      </div>
                    </div>

                    <div className="license-row">
                      <span className="label-caps">MACHINE ID</span>
                      <div className="machine-id-display" style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', maxWidth: '170px', background: '#f8fafc' }}>
                        <code style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 600 }}>{machineId}</code>
                        <button className="copy-btn" onClick={() => {
                          navigator.clipboard.writeText(machineId);
                          alert('Machine ID copied!');
                        }}><Copy size={13} /></button>
                      </div>
                    </div>

                    <div className="center-link-container" style={{ paddingTop: '0.25rem' }}>
                      <button 
                        className="btn-link" 
                        onClick={() => {
                          if (confirm('Are you sure you want to remove the current license?')) {
                            // @ts-ignore
                            window.licensing.deactivate();
                            window.location.reload();
                          }
                        }}
                      >
                        Change / Renew License
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Hidden Print Template for History (Supports Multi-Receipts) */}
      {receiptsToPrint.length > 0 && (
        <div id="receipt-print-template" className="print-only">
          {receiptsToPrint.map((r, idx) => {
            const doctorObj = doctors.find(d => d.id === r.doctorId);
            const printHeader = doctorObj ? (doctorObj.printHeader !== false) : true;
            const customTopMargin = doctorObj ? (doctorObj.customTopMargin || 0) : 0;

            return (
              <div 
                key={r.id} 
                className="print-container page-break"
                style={{
                  paddingTop: !printHeader && customTopMargin ? `${customTopMargin}mm` : undefined,
                  borderTop: !printHeader ? 'none' : undefined
                }}
              >
                {printHeader && (
                  <div className="print-header">
                    <div className="print-clinic-branding">
                      <h2>{doctorObj?.name || r.doctorName}</h2>
                      <p className="clinic-tagline" style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                        {doctorObj?.address || ''}
                      </p>
                    </div>
                    <div className="print-clinic-address">
                      <p style={{ fontWeight: 700 }}>{doctorObj?.qualifications || ''}</p>
                      <p>{doctorObj?.specialization || ''}</p>
                      <p>Ph: {doctorObj?.phone || ''}</p>
                    </div>
                  </div>
                )}

                <div className="print-title-bar">
                  <h1>PAYMENT RECEIPT (DUPLICATE)</h1>
                </div>

                <div className="print-info-grid">
                  <div className="info-section">
                    <h3>PATIENT DETAILS</h3>
                    <p><strong>Name:</strong> {r.patientName}</p>
                    <p><strong>Age/Gender:</strong> {formatAgeGender(r.patientAge, r.patientGender)}</p>
                    <p><strong>Phone No.:</strong> {r.patientPhone || 'N/A'}</p>
                  </div>
                  <div className="info-section">
                    <h3>BILL DETAILS</h3>
                    <p><strong>Receipt #:</strong> {r.receiptNumber}</p>
                    <p><strong>Original Date:</strong> {(() => {
                      try {
                        return format(new Date(r.date), 'dd MMM yyyy');
                      } catch (e) {
                        return r.date || 'N/A';
                      }
                    })()}</p>
                    <p><strong>Payment Mode:</strong> {r.paymentMethod || 'CASH'}</p>
                  </div>
                </div>

                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Sr.</th>
                      <th>Description of Services</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{item.description}</td>
                        <td className="text-right">₹{(r.paymentMethod === 'FREE' ? 0 : (Number(item.amount) || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2} className="text-right">Total Payable Amount:</th>
                      <th className="text-right">₹{(Number(r.total) || 0).toFixed(2)}</th>
                    </tr>
                  </tfoot>
                </table>

                <div className="print-amount-words">
                  <p><strong>Total in words:</strong> Rupee {(Number(r.total) || 0).toLocaleString()} Only</p>
                </div>

                <div className="print-footer">
                  <div className="terms">
                    <p>• This is a computer-generated duplicate receipt.</p>
                    <p>• Original date of service: {(() => {
                      try {
                        return format(new Date(r.date), 'dd MMM yyyy');
                      } catch (e) {
                        return r.date || 'N/A';
                      }
                    })()}</p>
                    {receiptsToPrint.length > 1 && (
                      <p className="print-page-info">Receipt {idx + 1} of {receiptsToPrint.length}</p>
                    )}
                  </div>
                  <div className="signature-box">
                    <div className="signature-line"></div>
                    <p>Authorized Signatory</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activePrintPrescription && (
        <div id="prescription-print-template" className="print-only">
          <div 
            className="print-container"
            style={{
              paddingTop: (doctors.find(d => d.id === activePrintPrescription.doctorId)?.printHeader === false) && doctors.find(d => d.id === activePrintPrescription.doctorId)?.customTopMargin
                ? `${doctors.find(d => d.id === activePrintPrescription.doctorId)?.customTopMargin}mm`
                : undefined,
              borderTop: (doctors.find(d => d.id === activePrintPrescription.doctorId)?.printHeader === false) ? 'none' : undefined
            }}
          >
            {/* Header / Clinic Doctor Info */}
            {(doctors.find(d => d.id === activePrintPrescription.doctorId)?.printHeader !== false) && (
              <div className="print-header">
                <div className="print-clinic-branding">
                  <h2>Dr. {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}</h2>
                  <p className="qualifications">{doctors.find(d => d.id === activePrintPrescription.doctorId)?.qualifications || ''}</p>
                  <p className="specialization">{doctors.find(d => d.id === activePrintPrescription.doctorId)?.specialization || 'Consulting Physician'}</p>
                </div>
                <div className="print-clinic-address">
                  <p className="address-text">{doctors.find(d => d.id === activePrintPrescription.doctorId)?.address || ''}</p>
                  {doctors.find(d => d.id === activePrintPrescription.doctorId)?.phone && (
                    <p className="phone-text"><strong>Ph:</strong> {doctors.find(d => d.id === activePrintPrescription.doctorId)?.phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Patient Info */}
            <div className="print-patient-meta-grid">
              <div>
                <span className="meta-label">Patient Name</span>
                <strong className="meta-value">{activePrintPrescription.patientName}</strong>
              </div>
              <div>
                <span className="meta-label">Age / Gender</span>
                <strong className="meta-value">{formatAgeGender(activePrintPrescription.patientAge, activePrintPrescription.patientGender)}</strong>
              </div>
              <div>
                <span className="meta-label">Date</span>
                <strong className="meta-value">{(() => {
                  try {
                    return format(new Date(activePrintPrescription.date.split(' ')[0]), 'dd MMM yyyy');
                  } catch (e) {
                    return activePrintPrescription.date;
                  }
                })()}</strong>
              </div>
              <div>
                <span className="meta-label">Phone No</span>
                <strong className="meta-value">{activePrintPrescription.patientPhone || 'N/A'}</strong>
              </div>
            </div>

            {/* Symptoms & Diagnosis */}
            {(activePrintPrescription.symptoms || activePrintPrescription.diagnosis) && (
              <div className="print-clinical-grid">
                {activePrintPrescription.symptoms && (
                  <div className="clinical-card">
                    <span className="clinical-label">Chief Complaints / Symptoms</span>
                    <p className="clinical-text">{activePrintPrescription.symptoms}</p>
                  </div>
                )}
                {activePrintPrescription.diagnosis && (
                  <div className="clinical-card">
                    <span className="clinical-label">Diagnosis</span>
                    <p className="clinical-text">{activePrintPrescription.diagnosis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Rx Symbol & Medicines */}
            <div className="print-rx-section">
              <div className="rx-symbol">Rₓ</div>
              
              <table className="print-meds-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Sr.</th>
                    <th>Medicine Description</th>
                    <th style={{ width: '120px' }}>Dosage</th>
                    <th style={{ width: '100px' }}>Duration</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {(activePrintPrescription.medicines || []).map((m: any, idx: number) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{m.name}</strong></td>
                      <td>{m.dosage}</td>
                      <td>{m.duration}</td>
                      <td>{m.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activePrintPrescription.notes && (
              <div className="print-notes-section">
                <span className="notes-label">Advice / Notes</span>
                <p className="notes-text" style={{ whiteSpace: 'pre-wrap' }}>{activePrintPrescription.notes}</p>
              </div>
            )}

            {/* Signature Box */}
            <div className="print-footer">
              <div className="signature-box" style={{ marginLeft: 'auto', textAlign: 'center' }}>
                <div className="signature-line"></div>
                <p style={{ margin: '0 0 2px 0', fontWeight: '700' }}>Dr. {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}</p>
                <p className="subtitle">Authorized Signature</p>
              </div>
            </div>
          </div>

          <style>{`
            #prescription-print-template {
              font-family: 'Outfit', 'Inter', sans-serif;
              color: #1e293b;
            }
            #prescription-print-template .print-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 2.5rem;
              background: white;
              border-top: 6px solid #0284c7;
            }
            #prescription-print-template .print-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 1.5rem;
              padding-bottom: 1rem;
              border-bottom: 1px solid #e2e8f0;
            }
            #prescription-print-template .print-clinic-branding {
              max-width: 60%;
            }
            #prescription-print-template .print-clinic-branding h2 {
              font-size: 1.6rem;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 0.35rem 0;
              font-family: 'Outfit', sans-serif;
              letter-spacing: -0.02em;
            }
            #prescription-print-template .qualifications {
              font-size: 0.8rem;
              font-weight: 700;
              color: #475569;
              margin: 0 0 0.2rem 0;
              letter-spacing: 0.05em;
              text-transform: uppercase;
            }
            #prescription-print-template .specialization {
              font-size: 0.85rem;
              color: #0284c7;
              font-weight: 600;
              margin: 0;
              letter-spacing: 0.05em;
              text-transform: uppercase;
            }
            #prescription-print-template .print-clinic-address {
              text-align: right;
              max-width: 38%;
              font-size: 0.8rem;
              color: #475569;
              line-height: 1.4;
            }
            #prescription-print-template .print-clinic-address p {
              margin: 0 0 0.2rem 0;
            }
            #prescription-print-template .print-clinic-address .address-text {
              white-space: pre-wrap;
            }
            #prescription-print-template .print-divider {
              display: none;
            }
            #prescription-print-template .print-patient-meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 1rem;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 1.5rem;
            }
            #prescription-print-template .meta-label {
              display: block;
              font-size: 0.7rem;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              margin-bottom: 2px;
              letter-spacing: 0.05em;
            }
            #prescription-print-template .meta-value {
              display: block;
              font-size: 0.9rem;
              color: #0f172a;
              font-weight: 600;
            }
            #prescription-print-template .print-clinical-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1.5rem;
              margin-bottom: 1.5rem;
              border-bottom: 1px dashed #e2e8f0;
              padding-bottom: 1.5rem;
            }
            #prescription-print-template .clinical-card {
              background: #ffffff;
            }
            #prescription-print-template .clinical-label {
              display: block;
              font-size: 0.75rem;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              margin-bottom: 4px;
              letter-spacing: 0.05em;
            }
            #prescription-print-template .clinical-text {
              font-size: 0.95rem;
              color: #1e293b;
              margin: 0;
              line-height: 1.4;
            }
            #prescription-print-template .print-rx-section {
              margin-bottom: 2rem;
            }
            #prescription-print-template .rx-symbol {
              font-size: 2.5rem;
              font-family: 'Times New Roman', Georgia, serif;
              font-style: italic;
              font-weight: bold;
              color: #0284c7;
              margin-bottom: 0.5rem;
              line-height: 1;
            }
            #prescription-print-template .print-meds-table {
              width: 100%;
              border-collapse: collapse;
            }
            #prescription-print-template .print-meds-table th {
              background: #f8fafc;
              color: #475569;
              font-size: 0.75rem;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.05em;
              padding: 0.6rem 0.75rem;
              border-bottom: 2px solid #e2e8f0;
              text-align: left;
            }
            #prescription-print-template .print-meds-table td {
              padding: 0.75rem;
              border-bottom: 1px solid #f1f5f9;
              font-size: 0.9rem;
              color: #334155;
              vertical-align: middle;
            }
            #prescription-print-template .print-notes-section {
              font-size: 0.85rem;
              margin-bottom: 3rem;
              background: #f0f9ff;
              padding: 1rem;
              border-radius: 8px;
              border-left: 4px solid #0284c7;
            }
            #prescription-print-template .notes-label {
              font-size: 0.75rem;
              text-transform: uppercase;
              color: #0369a1;
              font-weight: 700;
              letter-spacing: 0.05em;
              margin-bottom: 0.25rem;
              display: block;
            }
            #prescription-print-template .notes-text {
              color: #0c4a6e;
              font-size: 0.9rem;
              line-height: 1.4;
            }
            #prescription-print-template .signature-line {
              width: 180px;
              height: 1px;
              background: #cbd5e1;
              margin-bottom: 0.5rem;
              margin-top: 2rem;
            }
            #prescription-print-template .print-footer .subtitle {
              font-size: 0.75rem;
              color: #64748b;
              margin: 0;
            }
          `}</style>
        </div>
      )}



      <style>{`
        .loading-screen {
          height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #f8fafc; color: var(--primary); font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 600;
        }

        
        .sync-input-modern {
          padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem;
          font-family: monospace; font-size: 0.9rem; background: #f8fafc;
        }

        .license-status-badge {
          display: inline-flex; align-items: center; gap: 0.5rem; background: #ecfdf5; color: #059669;
          padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
        }



        .app-container { display: flex; min-height: 100vh; }

        .sidebar {
          width: 260px; background: white; border-right: 1px solid var(--border);
          display: flex; flex-direction: column; padding: 1.5rem; position: sticky; top: 0; height: 100vh;
        }

        .logo {
          display: flex; align-items: center; gap: 0.75rem; font-family: 'Outfit', sans-serif;
          font-weight: 700; font-size: 1.5rem; color: var(--primary);
        }

        .logo-img, .logo-svg {
          width: 32px; height: 32px; border-radius: 8px; object-fit: contain; flex-shrink: 0;
        }

        .action-buttons {
          display: flex; gap: 0.5rem; justify-content: flex-end;
        }

        .btn-icon-xs.delete-btn:hover {
          color: #ef4444; border-color: #fee2e2; background: #fef2f2;
        }
        
        .btn-icon-xs.edit-btn:hover {
          color: var(--primary); border-color: #e0f2fe; background: #f0f9ff;
        }

        .nav-menu { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }

        .nav-item {
          display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem;
          color: var(--text-muted); background: transparent; font-weight: 500; text-align: left; width: 100%; border-radius: 8px;
        }

        .nav-item:hover { background: #f1f5f9; color: var(--text-main); }
        .nav-item.active { background: #f0f9ff; color: var(--primary); }

        .status-badge {
          display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;
          color: var(--secondary); background: #f0fdfa; padding: 0.5rem 0.75rem; border-radius: 20px;
          justify-content: center; width: 100%;
        }
        .status-badge.online {
          color: #0f766e; background: #f0fdfa; border: 1px solid #ccfbf1;
        }
        .status-badge.offline {
          color: #b45309; background: #fffbeb; border: 1px solid #fef3c7;
        }

        .dot { width: 8px; height: 8px; background: var(--secondary); border-radius: 50%; animation: pulse 2s infinite; }
        .dot.green { background: #14b8a6; }
        .dot.amber { background: #f59e0b; }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }

        .main-content { flex: 1; display: flex; flex-direction: column; }

        .content-header {
          background: white; padding: 1rem 2rem; border-bottom: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
        }

        .content-header h1 { font-size: 1.25rem; color: var(--text-muted); letter-spacing: 0.05em; }

        .content-inner { padding: 2rem; flex: 1; overflow-y: auto; }

        .date-group-modern { margin-bottom: 2rem; }

        .date-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 1rem; padding: 0.75rem 0; border-bottom: 2px solid #f1f5f9;
        }

        .date-info { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); }
        .dr-day-total { font-size: 0.75rem; color: var(--text-muted); }
        .day-sum { font-size: 0.85rem; color: var(--text-main); font-weight: 700; }
        
        .btn-ghost-xs {
          font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; color: var(--primary);
          background: #f0f9ff; border: 1px solid #e0f2fe; margin-left: 0.75rem;
        }

        .btn-icon-xs:hover { color: var(--primary); border-color: var(--primary); background: #f0f9ff; }

        .bulk-action-bar {
          position: sticky; top: 0; z-index: 50; display: flex; justify-content: space-between;
          align-items: center; background: #0ea5e9; color: white; padding: 0.5rem 1.5rem; border-radius: 0 0 12px 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          margin-bottom: 1.5rem; animation: slideDown 0.2s ease;
        }

        @keyframes slideDown { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: translateY(0); } }

        .bulk-info { display: flex; align-items: center; gap: 1rem; }
        .bulk-count { font-weight: 600; font-size: 0.85rem; }
        .btn-ghost-sm { font-size: 0.8rem; color: rgba(255,255,255,0.8); }
        .btn-ghost-sm:hover { color: white; }
        .btn-primary-sm { background: white; color: #0ea5e9; padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; }

        .r-num { color: var(--text-muted); font-size: 0.75rem; font-family: monospace; }
        .r-name { font-weight: 600; color: var(--text-main); font-size: 0.95rem; }
        .r-dr { font-size: 0.85rem; color: var(--text-muted); }
        .r-amt { font-weight: 700; color: var(--text-main); font-size: 1rem; }

        .btn-icon-xs {
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          border-radius: 6px; border: 1px solid #e2e8f0; color: #64748b; background: white; transition: all 0.2s;
        }

        .receipt-items-table-container {
          background: white;
          border-radius: 8px;
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .history-table th {
          background: #f8fafc;
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          border-bottom: 2px solid var(--border);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .history-table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }

        .receipt-table-row {
          transition: background 0.2s;
        }

        .receipt-table-row:last-child td {
          border-bottom: none;
        }

        .receipt-table-row:hover {
          background: #f8fafc;
        }

        .receipt-table-row.selected {
          background: #f0f9ff;
        }

        .history-table .center-cell {
          text-align: center;
        }

        .history-table .r-ph {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.15rem;
        }
        
        .row-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .filter-card {
          margin-bottom: 2rem; padding: 1.5rem; background: white; border-radius: 12px;
          border: 1px solid var(--border); position: relative;
        }
        .filter-card::after { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--primary); }
        .filter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .filter-title { display: flex; align-items: center; gap: 0.75rem; }
        .filter-icon-bg { background: #e0f2fe; color: var(--primary); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
        .btn-reset { background: #fee2e2; color: #ef4444; font-size: 0.75rem; font-weight: 600; padding: 0.4rem 0.8rem; border-radius: 6px; }
        .filter-input-wrapper { position: relative; display: flex; align-items: center; flex: 1; min-width: 140px; }
        .filter-input-wrapper .input-icon { position: absolute; left: 1rem; color: var(--text-muted); pointer-events: none; z-index: 1; transition: all 0.2s; }
        .filter-input-wrapper .input-icon.shifted { left: 4.5rem; }
        
        .input-label-inline {
          position: absolute; left: 1rem; font-size: 0.75rem; font-weight: 700; color: var(--primary);
          text-transform: uppercase; letter-spacing: 0.05em; z-index: 1; pointer-events: none;
        }

        .filter-input-wrapper select, 
        .filter-input-wrapper input, 
        .filter-input-wrapper .date-input {
          padding-left: 2.75rem; width: 100%; border: 1px solid var(--border); border-radius: 8px; height: 44px;
          font-family: 'Outfit', sans-serif; font-size: 0.95rem; color: var(--text-main);
          background: white; transition: all 0.2s; cursor: pointer;
        }
        
        .calendar-picker .date-input { padding-left: 6.25rem; }
        
        .filter-input-wrapper .date-input:hover { border-color: var(--primary); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .filter-input-wrapper .date-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
        
        .range-filter-group { display: flex; gap: 1rem; width: 100%; }

        .btn-reset { 
          background: #f1f5f9; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; 
          padding: 0.5rem 1rem; border-radius: 8px; transition: all 0.2s; border: 1px solid var(--border);
        }
        .btn-reset:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
        .summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
        .metric-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f8fafc; border-radius: 12px; border: 1px solid var(--border); }
        .metric-card.main { background: var(--primary); color: white; border: none; }
        .metric-icon { width: 36px; height: 36px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .metric-icon.secondary { background: #e0f2fe; color: var(--primary); }
        .metric-info { display: flex; flex-direction: column; }
        .metric-info .label { font-size: 0.7rem; opacity: 0.8; }
        .metric-info .value { font-size: 1.1rem; font-weight: 700; }

        .r-services { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .service-tag {
          font-size: 0.7rem; color: #64748b; background: #f1f5f9; padding: 0.1rem 0.4rem;
          border-radius: 4px; font-weight: 500;
        }

        .control-grid { 
          display: grid; 
          grid-template-columns: repeat(2, 1fr); 
          gap: 2rem; 
          max-width: 1000px;
          margin: 0 auto;
          align-items: start;
        }
        .control-card { 
          padding: 2.5rem; background: white; border-radius: 16px; border: 1px solid var(--border); 
          display: flex; flex-direction: column; gap: 1rem;
          transition: all 0.3s ease; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }
        .control-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .card-icon-header.inline { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .card-description { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin: 0; }
        
        .header-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; }
        .header-icon.blue { background: #e0f2fe; color: #0284c7; }
        .header-icon.purple { background: #f3e8ff; color: #9333ea; }
        .header-icon.green { background: #dcfce7; color: #16a34a; }
        .header-icon.gray { background: #f1f5f9; color: #475569; }
        .header-icon.red { background: #fee2e2; color: #ef4444; }

        .user-profile-container { display: flex; align-items: center; gap: 0.75rem; }
        .user-profile {
          display: inline-flex; align-items: center; background: #f1f5f9; color: #475569;
          font-size: 0.85rem; font-weight: 500; padding: 0.4rem 0.875rem; border-radius: 9999px;
          border: 1px solid var(--border);
        }
        .btn-logout {
          display: inline-flex; align-items: center; gap: 0.375rem; background: #ffffff;
          border: 1px solid var(--border); color: #64748b; font-size: 0.85rem; font-weight: 600;
          padding: 0.4rem 0.875rem; border-radius: 9999px; cursor: pointer; transition: all 0.2s;
        }
        .btn-logout:hover {
          background: #fef2f2; border-color: #fee2e2; color: #ef4444;
        }

        .center-header { text-align: center; margin-bottom: 2rem; }
        .center-header h2 { font-size: 1.75rem; color: #1e293b; margin-bottom: 0.5rem; }

        .card-actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: auto; padding-top: 1.5rem; }
        .btn-primary-sm { 
          background: #0ea5e9; color: white; padding: 0.75rem; border-radius: 8px; 
          font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
        }
        .btn-secondary-sm { 
          background: #f8fafc; color: var(--text-main); padding: 0.75rem; border-radius: 8px; 
          border: 1px solid var(--border); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
        }
        
        .card-actions-vertical { margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-top: 1.5rem; }
        .sync-input-line {
          width: 100%; padding: 0.85rem 1rem; border: 1px solid var(--border); border-radius: 8px;
          background: #f8fafc; font-size: 0.9rem; margin-bottom: 0.5rem; font-family: inherit;
        }
        .sync-input-line:focus { outline: none; border-color: var(--primary); background: white; }

        .card-actions { margin-top: auto; padding-top: 1.5rem; display: flex; flex-direction: column; }
        .btn-ghost-bottom {
          background: transparent; color: #475569; padding: 0.85rem; border-radius: 8px; 
          border: 1px solid transparent; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: all 0.2s;
        }
        .btn-ghost-bottom:hover { background: #f1f5f9; color: #1e293b; }

        .license-status-section { display: flex; flex-direction: column; gap: 1rem; margin-top: auto; padding-top: 1.5rem; }
        .license-row { display: flex; justify-content: space-between; align-items: center; }
        .label-caps { font-size: 0.7rem; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em; }
        
        .license-badge-modern { 
          display: flex; align-items: center; gap: 0.75rem; background: #f1f5f9; 
          padding: 0.5rem 1rem; border-radius: 12px; font-weight: 600; font-size: 0.85rem;
        }
        .license-badge-modern.active { background: #ecfdf5; color: #059669; }
        .license-badge-modern .dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
        .license-badge-modern.active .dot { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .expiry-date { color: #64748b; font-weight: 500; margin-left: 0.25rem; }

        .machine-id-display { 
          display: flex; align-items: center; gap: 0.5rem; background: #f8fafc; 
          padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid var(--border);
          width: 100%; max-width: 200px;
        }
        .machine-id-display code { 
          font-family: monospace; font-size: 0.75rem; color: #475569; 
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
        }
        .copy-btn { background: transparent; color: #64748b; padding: 2px; border-radius: 4px; }
        .copy-btn:hover { color: var(--primary); background: #f0f9ff; }

        .center-link-container { text-align: center; width: 100%; padding-top: 0.5rem; }
        .btn-link { 
          background: transparent; color: var(--text-muted); font-size: 0.75rem; text-align: center; 
          padding: 0; text-decoration: underline; font-weight: 500;
        }
        .btn-link:hover { color: #ef4444; }

        .payment-badge {
          font-size: 0.65rem;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: 0.5rem;
        }
        .payment-badge.cash { background: #fef3c7; color: #92400e; }
        .payment-badge.online { background: #dcfce7; color: #166534; }
        .payment-badge.free { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }

        .method-breakdown {
          display: flex;
          gap: 0.75rem;
          font-size: 0.65rem;
          margin-top: 4px;
          opacity: 0.9;
          font-weight: 500;
        }
        .method-breakdown span {
          background: rgba(255,255,255,0.15);
          padding: 1px 5px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default App;
