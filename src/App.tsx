import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LayoutDashboard, Users, Receipt, PlusCircle, Settings, ShieldCheck, Copy, Calendar, TrendingUp, DownloadCloud, UploadCloud, FileText, Activity, Filter, Briefcase, Printer, Trash2, Edit2, FolderOpen, Search } from 'lucide-react';

import { storage, type Doctor, type Receipt as ReceiptType, type Service } from './lib/storage';
import './index.css';

// Components
import Dashboard from './components/Dashboard';
import DoctorManagement from './components/DoctorManagement';
import ServiceManagement from './components/ServiceManagement';
import ReceiptForm from './components/ReceiptForm';
import ActivationScreen from './components/ActivationScreen';

type Tab = 'dashboard' | 'doctors' | 'services' | 'new-receipt' | 'history' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [receipts, setReceipts] = useState<ReceiptType[]>([]);
  const [activationStatus, setActivationStatus] = useState<{status: 'NOT_ACTIVATED' | 'ACTIVATED' | 'EXPIRED' | 'TAMPERED'; expiryDate?: string} | null>(null);
  const [machineId, setMachineId] = useState<string>('');
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    if (window.location.hostname === 'localhost') return true;
    return localStorage.getItem('medflow_dev_mode') === 'true';
  });
  const [logoClicks, setLogoClicks] = useState(0);
  const [syncKeyInput, setSyncKeyInput] = useState('');
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [devPinInput, setDevPinInput] = useState('');
  
  // History Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [receiptsToPrint, setReceiptsToPrint] = useState<ReceiptType[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingReceipt, setEditingReceipt] = useState<ReceiptType | null>(null);

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

  useEffect(() => {
    const checkLicense = async () => {
      // @ts-ignore
      const result = await window.licensing.checkActivation();
      setActivationStatus(result);
    };

    const loadInitialData = async () => {
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

    checkLicense();
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'settings' && !machineId) {
      // @ts-ignore
      window.licensing.getMachineID().then(id => setMachineId(id));
    }
  }, [activeTab]);

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    if (newClicks >= 5) {
      setShowDevLogin(true);
      setLogoClicks(0);
    } else {
      setLogoClicks(newClicks);
      setTimeout(() => setLogoClicks(0), 3000);
    }
  };

  const handleDevLogin = () => {
    if (devPinInput === 'Burhan2003') {
      setIsDevMode(true);
      localStorage.setItem('medflow_dev_mode', 'true');
      setShowDevLogin(false);
      setDevPinInput('');
      alert('Developer Mode Unlocked!');
    } else {
      alert('Incorrect Password');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        if (isDevMode) {
          setIsDevMode(false);
          localStorage.removeItem('medflow_dev_mode');
          alert('Developer Tools Locked');
        } else {
          setShowDevLogin(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevMode]);

  const handleSyncDoctors = async () => {
    if (!syncKeyInput.trim()) return alert('Please enter a Setup Key');
    if (await storage.batchImportDoctors(syncKeyInput.trim())) {
      alert('Doctors synchronized successfully!');
      setSyncKeyInput('');
      refreshData();
    } else {
      alert('Invalid Setup Key. Please contact the developer.');
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

  const refreshData = async () => {
    const [d, s, r] = await Promise.all([
      storage.getDoctors(),
      storage.getServices(),
      storage.getReceipts()
    ]);
    setDoctors(d);
    setServices(s);
    setReceipts(r);
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

  return (
    <div className="app-container">
      <aside className="sidebar no-print">
        <div className="sidebar-header" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <div className="logo">
            <img src="/icon.png" alt="Logo" className="logo-img" />
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
          {isDevMode ? (
            <button className="status-badge dev-active" onClick={() => {
              setIsDevMode(false);
              localStorage.removeItem('medflow_dev_mode');
              alert('Developer Tools Locked');
            }}>
              <ShieldCheck size={14} />
              Exit Developer Mode
            </button>
          ) : (
            <div className="status-badge">
              <div className="dot"></div>
              Offline Mode Active
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header no-print">
          <h1>{activeTab.replace('-', ' ').toUpperCase()}</h1>
          <div className="user-profile">
            <span>Admin</span>
          </div>
        </header>

        <div className="content-inner">
          {activeTab === 'dashboard' && <Dashboard doctors={doctors} receipts={receipts} onNewReceipt={() => { setEditingReceipt(null); setActiveTab('new-receipt'); }} />}
          {activeTab === 'doctors' && <DoctorManagement doctors={doctors} onUpdate={refreshData} isDevMode={isDevMode} />}
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
                    <div className="metric-card main">
                      <div className="metric-icon"><TrendingUp size={20} /></div>
                      <div className="metric-info">
                        <span className="label">Period Collection</span>
                        <span className="value">₹{filteredReceipts.reduce((sum, r) => sum + (r.paymentMethod === 'FREE' ? 0 : (Number(r.total) || 0)), 0).toLocaleString()}</span>
                        <div className="method-breakdown">
                          <span>Cash: ₹{filteredReceipts.filter(r => (r.paymentMethod || 'CASH') === 'CASH').reduce((sum, r) => sum + (Number(r.total) || 0), 0).toLocaleString()}</span>
                          <span>Online: ₹{filteredReceipts.filter(r => r.paymentMethod === 'ONLINE').reduce((sum, r) => sum + (Number(r.total) || 0), 0).toLocaleString()}</span>
                          <span>Free: {filteredReceipts.filter(r => r.paymentMethod === 'FREE').length} Visits</span>
                        </div>
                      </div>
                    </div>
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

          {activeTab === 'settings' && (
            <div className="control-center">
              <div className="control-header center-header">
                <h2>Control Center</h2>
                <p className="text-muted">Manage your clinic's database, medical setup, and system license.</p>
              </div>

              <div className="control-grid">
                {/* Data Safety & Backup */}
                <div className="card control-card">
                  <div className="card-icon-header inline">
                    <div className="header-icon blue"><DownloadCloud size={18} /></div>
                    <h3>Data Safety & Backup</h3>
                  </div>
                  <p className="card-description">Create manual backups of your patient data and doctor configurations for safety or migration.</p>
                  <div className="card-actions-row">
                    <button className="btn-primary-sm" onClick={() => storage.exportData()}>
                      <DownloadCloud size={16} /> Export Backup (.json)
                    </button>
                    <button className="btn-secondary-sm" onClick={() => document.getElementById('import-file')?.click()}>
                      <UploadCloud size={16} /> Import Backup (.json)
                    </button>
                    <button className="btn-ghost-sm" onClick={() => (window as any).database.openFolder()}>
                      <FolderOpen size={16} /> Show Data Folder
                    </button>
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

                {/* Professional Setup */}
                <div className="card control-card">
                  <div className="card-icon-header inline">
                    <div className="header-icon purple"><Users size={18} /></div>
                    <h3>Professional Setup</h3>
                  </div>
                  <p className="card-description">Synchronize your clinic's doctor information using a secure Setup Key provided by the developer.</p>
                  <div className="card-actions-vertical">
                    <input 
                      type="text"
                      placeholder="Paste Setup Key here..." 
                      value={syncKeyInput}
                      onChange={(e) => setSyncKeyInput(e.target.value)}
                      className="sync-input-line"
                    />
                    <button className="btn-primary w-full" onClick={handleSyncDoctors} disabled={!syncKeyInput.trim()}>
                      <Activity size={16} /> Sync Doctors Now
                    </button>
                  </div>
                </div>

                {/* Reports & Intelligence */}
                <div className="card control-card">
                  <div className="card-icon-header inline">
                    <div className="header-icon green"><FileText size={18} /></div>
                    <h3>Reports & Intelligence</h3>
                  </div>
                  <p className="card-description">Generate comprehensive financial reports compatible with Excel for accounting and auditing.</p>
                  <div className="card-actions">
                    <button className="btn-ghost-bottom w-full" onClick={() => storage.exportToExcel()}>
                      <FileText size={16} /> Download CSV Report
                    </button>
                  </div>
                </div>

                {/* System License */}
                <div className="card control-card">
                  <div className="card-icon-header inline">
                    <div className="header-icon gray"><ShieldCheck size={18} /></div>
                    <h3>System License</h3>
                  </div>
                  <p className="card-description">View your system's activation status and copy your machine ID if you require a new license key.</p>
                  
                  <div className="license-status-section">
                    <div className="license-row">
                      <span className="label-caps">LICENSE STATUS</span>
                      <div className={`license-badge-modern ${activationStatus?.status === 'ACTIVATED' ? 'active' : ''}`}>
                        <div className="dot"></div>
                        <span>{activationStatus?.status === 'ACTIVATED' ? 'ACTIVATED' : activationStatus?.status}</span>
                        {activationStatus?.expiryDate && <span className="expiry-date">{activationStatus.expiryDate}</span>}
                      </div>
                    </div>

                    <div className="license-row">
                      <span className="label-caps">MACHINE ID</span>
                      <div className="machine-id-display">
                        <code>{machineId}</code>
                        <button className="copy-btn" onClick={() => {
                          navigator.clipboard.writeText(machineId);
                          alert('Machine ID copied!');
                        }}><Copy size={14} /></button>
                      </div>
                    </div>

                    <div className="center-link-container">
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
          {receiptsToPrint.map((r, idx) => (
            <div key={r.id} className="print-container page-break">
              <div className="print-header">
                <div className="print-clinic-branding">
                  <h2>{doctors.find(d => d.id === r.doctorId)?.name || r.doctorName}</h2>
                  <p className="clinic-tagline" style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                    {doctors.find(d => d.id === r.doctorId)?.address || ''}
                  </p>
                </div>
                <div className="print-clinic-address">
                  <p style={{ fontWeight: 700 }}>{doctors.find(d => d.id === r.doctorId)?.qualifications || ''}</p>
                  <p>{doctors.find(d => d.id === r.doctorId)?.specialization || ''}</p>
                  <p>Ph: {doctors.find(d => d.id === r.doctorId)?.phone || ''}</p>
                </div>
              </div>

              <div className="print-title-bar">
                <h1>PAYMENT RECEIPT (DUPLICATE)</h1>
              </div>

              <div className="print-info-grid">
                <div className="info-section">
                  <h3>PATIENT DETAILS</h3>
                  <p><strong>Name:</strong> {r.patientName}</p>
                  <p><strong>Age/Gender:</strong> {r.patientAge.includes('Y') || r.patientAge.includes('M') ? r.patientAge : `${r.patientAge}Y`} / {r.patientGender}</p>
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
          ))}
        </div>
      )}

      {showDevLogin && (
        <div className="dev-overlay">
          <div className="dev-modal">
            <h3>Developer Access</h3>
            <p>Enter password to unlock manage doctors tab.</p>
            <input 
              type="password" 
              placeholder="••••••••"
              value={devPinInput}
              onChange={(e) => setDevPinInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleDevLogin()}
              autoFocus
            />
            <div className="dev-modal-actions">
              <button className="btn-ghost" onClick={() => {
                setShowDevLogin(false);
                setDevPinInput('');
              }}>Cancel</button>
              <button className="btn-primary" onClick={handleDevLogin}>Unlock</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .loading-screen {
          height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #f8fafc; color: var(--primary); font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 600;
        }
        .dev-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }
        .dev-modal {
          background: white; border-radius: 1rem; padding: 2rem;
          width: 320px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .dev-modal h3 { margin: 0 0 0.5rem; color: var(--primary); }
        .dev-modal p { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.5rem; }
        .dev-modal input {
          width: 100%; padding: 0.75rem; border: 1px solid var(--border);
          border-radius: 0.5rem; margin-bottom: 1.5rem; font-size: 1rem;
        }
        .dev-modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
        
        .sync-input-modern {
          padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem;
          font-family: monospace; font-size: 0.9rem; background: #f8fafc;
        }

        .license-status-badge {
          display: inline-flex; align-items: center; gap: 0.5rem; background: #ecfdf5; color: #059669;
          padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
        }

        .status-badge.dev-active {
          background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; cursor: pointer;
          width: 100%; justify-content: center; transition: all 0.2s;
        }
        
        .status-badge.dev-active:hover { background: #fee2e2; transform: translateY(-1px); }

        .app-container { display: flex; min-height: 100vh; }

        .sidebar {
          width: 260px; background: white; border-right: 1px solid var(--border);
          display: flex; flex-direction: column; padding: 1.5rem; position: sticky; top: 0; height: 100vh;
        }

        .logo {
          display: flex; align-items: center; gap: 0.75rem; font-family: 'Outfit', sans-serif;
          font-weight: 700; font-size: 1.5rem; color: var(--primary);
        }

        .logo-img {
          width: 32px; height: 32px; border-radius: 8px; object-fit: contain;
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
          color: var(--secondary); background: #f0fdfa; padding: 0.5rem; border-radius: 20px;
        }

        .dot { width: 8px; height: 8px; background: var(--secondary); border-radius: 50%; animation: pulse 2s infinite; }
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
          grid-auto-rows: 1fr;
          gap: 2rem; 
          max-width: 1000px;
          margin: 0 auto;
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
