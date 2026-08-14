import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ClipboardList, FileText, Search, Plus, Trash2, Printer, PlusCircle, AlertCircle, LogOut, CheckCircle, Save, History, KeyRound } from 'lucide-react';
import { storage, formatAgeGender, type Doctor, type Receipt, type Prescription, type PrescribedMedicine } from '../lib/storage';

interface DoctorWorkstationProps {
  currentUser: string;
  currentUserDoctorId: string | null;
  onLogout: () => void;
}

const DoctorWorkstation: React.FC<DoctorWorkstationProps> = ({ currentUser, currentUserDoctorId, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  
  // Prescription Writer State
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [medicines, setMedicines] = useState<PrescribedMedicine[]>([
    { name: '', dosage: '1-0-1', duration: '5 days', instructions: 'After food' }
  ]);
  
  // Printing State
  const [activePrintPrescription, setActivePrintPrescription] = useState<Prescription | null>(null);
  const [shouldPrintOnSubmit, setShouldPrintOnSubmit] = useState(false);

  // Load Data
  const refreshData = React.useCallback(async () => {
    try {
      const [allDoctors, allReceipts, allPrescriptions] = await Promise.all([
        storage.getDoctors(),
        storage.getReceipts(),
        storage.getPrescriptions()
      ]);
      setDoctors(allDoctors);
      setReceipts(allReceipts);
      setPrescriptions(allPrescriptions);
    } catch (e) {
      console.error('Failed to load doctor data:', e);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setActivePrintPrescription(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Filter today's patients (patient queue)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayReceipts = receipts.filter(r => {
    const isToday = r.date.startsWith(todayStr);
    const matchesDoctor = currentUserDoctorId ? r.doctorId === currentUserDoctorId : false;
    return isToday && matchesDoctor;
  });

  // Prescription History filtered
  const filteredPrescriptions = prescriptions.filter(p => {
    const matchesSearch = !searchQuery ||
      p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientPhone.includes(searchQuery) ||
      p.doctorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDoctor = currentUserDoctorId ? p.doctorId === currentUserDoctorId : false;
    return matchesSearch && matchesDoctor;
  });

  // Autocomplete Suggestions logic
  const defaultMeds = ['Paracetamol 650mg', 'Amoxicillin 500mg', 'Pantoprazole 40mg', 'Cetirizine 10mg', 'Ibuprofen 400mg'];
  const uniqueMedicineSuggestions = Array.from(
    new Set([
      ...defaultMeds,
      ...prescriptions.flatMap(p => (p.medicines || []).map(m => m.name.trim()))
    ])
  ).filter(name => name.length > 0);

  const defaultDosages = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', '1-1-1-1', 'SOS'];
  const uniqueDosageSuggestions = Array.from(
    new Set([
      ...defaultDosages,
      ...prescriptions.flatMap(p => (p.medicines || []).map(m => (m.dosage || '').trim()))
    ])
  ).filter(d => d.length > 0);

  const defaultDurations = ['3 days', '5 days', '7 days', '10 days', '15 days', '1 month'];
  const uniqueDurationSuggestions = Array.from(
    new Set([
      ...defaultDurations,
      ...prescriptions.flatMap(p => (p.medicines || []).map(m => (m.duration || '').trim()))
    ])
  ).filter(d => d.length > 0);

  const defaultInstructions = ['After food', 'Before food', 'On empty stomach', 'At bedtime', 'As directed'];
  const uniqueInstructionsSuggestions = Array.from(
    new Set([
      ...defaultInstructions,
      ...prescriptions.flatMap(p => (p.medicines || []).map(m => (m.instructions || '').trim()))
    ])
  ).filter(i => i.length > 0);

  // Prescription Writing handlers
  const handleOpenWriter = (receipt: Receipt) => {
    // Check if prescription already exists to prefill
    const existing = prescriptions.find(p => p.receiptId === receipt.id);
    setSelectedReceipt(receipt);
    
    if (existing) {
      setSymptoms(existing.symptoms);
      setDiagnosis(existing.diagnosis);
      setNotes(existing.notes);
      setMedicines(existing.medicines.length > 0 ? existing.medicines : [
        { name: '', dosage: '1-0-1', duration: '5 days', instructions: 'After food' }
      ]);
    } else {
      setSymptoms('');
      setDiagnosis('');
      setNotes('');
      setMedicines([{ name: '', dosage: '1-0-1', duration: '5 days', instructions: 'After food' }]);
    }
  };

  const handleAddMedicineRow = () => {
    setMedicines(prev => [...prev, { name: '', dosage: '1-0-1', duration: '5 days', instructions: 'After food' }]);
  };

  const handleRemoveMedicineRow = (index: number) => {
    if (medicines.length === 1) return;
    setMedicines(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleMedicineChange = (index: number, field: keyof PrescribedMedicine, value: string) => {
    setMedicines(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCopyFromPast = (pastRx: Prescription) => {
    setSymptoms(pastRx.symptoms || '');
    setDiagnosis(pastRx.diagnosis || '');
    setNotes(pastRx.notes || '');
    if (pastRx.medicines && pastRx.medicines.length > 0) {
      setMedicines(pastRx.medicines.map(m => ({ ...m })));
    } else {
      setMedicines([{ name: '', dosage: '1-0-1', duration: '5 days', instructions: 'After food' }]);
    }
  };

  const handleSaveAndPrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;

    const filteredMedicines = medicines.filter(m => m.name.trim() !== '');

    const prescription: Prescription = {
      id: prescriptions.find(p => p.receiptId === selectedReceipt.id)?.id || Date.now().toString(),
      receiptId: selectedReceipt.id,
      date: format(new Date(), 'yyyy-MM-dd HH:mm'),
      patientName: selectedReceipt.patientName,
      patientAge: selectedReceipt.patientAge,
      patientGender: selectedReceipt.patientGender,
      patientPhone: selectedReceipt.patientPhone,
      doctorId: selectedReceipt.doctorId,
      doctorName: selectedReceipt.doctorName,
      symptoms,
      diagnosis,
      medicines: filteredMedicines,
      notes
    };

    await storage.savePrescription(prescription);
    await refreshData();
    setSelectedReceipt(null);

    // Trigger Print
    if (shouldPrintOnSubmit) {
      handlePrintRx(prescription);
    }
  };

  const handlePrintRx = (prescription: Prescription) => {
    setActivePrintPrescription(prescription);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDeletePrescription = async (id: string) => {
    if (confirm('Are you sure you want to delete this prescription from database?')) {
      await storage.deletePrescription(id);
      refreshData();
    }
  };

  return (
    <div className="doctor-container">
      {/* Header Panel */}
      <header className="doctor-header no-print">
        <div className="header-left">
          <div className="logo-badge">
            <ClipboardList size={22} className="text-white" />
          </div>
          <div className="title-group">
            <h2>MedFlow Doctor Console</h2>
          </div>
        </div>

        <div className="header-right">
          <div className="profile-selector">
            <span>Doctor Console: <strong>{doctors.find(d => d.id === currentUserDoctorId)?.name || 'Unlinked Doctor Profile'}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <div className="doctor-layout no-print">
        {/* Navigation Tabs Sidebar */}
        <aside className="doctor-tabs">
          <button 
            className={`tab-item ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <ClipboardList size={20} />
            <span>Patient Queue</span>
            {todayReceipts.length > 0 && (
              <span className="queue-count">{todayReceipts.length}</span>
            )}
          </button>

          <button 
            className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FileText size={20} />
            <span>Prescription Records</span>
          </button>

          <div className="user-profile-container" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', color: '#475569', fontSize: '0.85rem', fontWeight: 500, padding: '0.5rem 1rem', borderRadius: '9999px', border: '1px solid #e2e8f0', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
              <KeyRound size={14} style={{ marginRight: '6px', color: '#0ea5e9', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Workstation: <strong>{currentUser}</strong></span>
            </div>
            <button className="btn-signout" onClick={onLogout} title="Sign Out Profile" style={{ width: '100%', justifyContent: 'center' }}>
              <LogOut size={15} />
              <span>Disconnect</span>
            </button>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', width: '100%' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Software Developed by</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Badshah Computer's</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Email:- burhansaifee2003@gmail.com</div>
            </div>
          </div>
        </aside>

        {/* Tab Contents */}
        <main className="doctor-workspace-panel">
          {activeTab === 'queue' && (
            <div className="tab-pane">
              <div className="panel-header">
                <h3>Today's Patient Queue</h3>
                <span className="date-badge">{format(new Date(), 'dd MMMM yyyy')}</span>
              </div>

              {!currentUserDoctorId ? (
                <div className="empty-slate" style={{ border: '1px solid #fee2e2', background: '#fef2f2', color: '#991b1b' }}>
                  <AlertCircle size={48} style={{ color: '#ef4444' }} className="animate-bounce" />
                  <h4 style={{ color: '#991b1b', marginTop: '1rem', marginBottom: '0.25rem' }}>Doctor Profile Not Linked</h4>
                  <p className="text-muted" style={{ maxWidth: '420px', margin: '0' }}>
                    This workstation profile is not linked to any doctor registry profile. Please ask the receptionist to delete and re-register this User ID with a linked doctor in Settings.
                  </p>
                </div>
              ) : todayReceipts.length === 0 ? (
                <div className="empty-slate">
                  <CheckCircle size={48} className="text-success animate-pulse" />
                  <h4>Queue Cleared!</h4>
                  <p className="text-muted">No patient visits registered for this profile today.</p>
                </div>
              ) : (
                <div className="queue-grid">
                  {todayReceipts.map(r => {
                    const isPrescribed = prescriptions.some(p => p.receiptId === r.id);
                    return (
                      <div key={r.id} className={`queue-card ${isPrescribed ? 'prescribed' : ''}`}>
                        <div className="card-top">
                          <div className="patient-meta">
                            <h4>{r.patientName}</h4>
                            <span className="patient-specs">
                              {formatAgeGender(r.patientAge, r.patientGender)}
                            </span>
                          </div>
                          <span className={`status-tag ${isPrescribed ? 'success' : 'pending'}`}>
                            {isPrescribed ? 'Prescribed' : 'Waiting'}
                          </span>
                        </div>

                        <div className="card-middle">
                          <p><strong>Receipt No:</strong> #{r.receiptNumber}</p>
                          <p><strong>Phone:</strong> {r.patientPhone || 'N/A'}</p>
                          <p><strong>Doctor:</strong> {r.doctorName}</p>
                          <p><strong>Services:</strong> {r.items.map(i => i.description).join(', ')}</p>
                        </div>

                        <div className="card-actions">
                          {isPrescribed ? (
                            <>
                              <button 
                                className="btn-secondary w-full"
                                onClick={() => handleOpenWriter(r)}
                              >
                                Edit Rx
                              </button>
                              <button 
                                className="btn-primary"
                                onClick={() => {
                                  const rx = prescriptions.find(p => p.receiptId === r.id);
                                  if (rx) handlePrintRx(rx);
                                }}
                              >
                                <Printer size={16} />
                              </button>
                            </>
                          ) : (
                            <button 
                              className="btn-primary w-full"
                              onClick={() => handleOpenWriter(r)}
                            >
                              <PlusCircle size={16} />
                              Write Prescription
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="tab-pane">
              <div className="panel-header search-header">
                <h3>Prescription Records</h3>
                <div className="search-bar">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by patient name or phone..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {filteredPrescriptions.length === 0 ? (
                <div className="empty-slate">
                  <Search size={48} className="text-muted" />
                  <h4>No records found</h4>
                  <p className="text-muted">Try adjusting your search criteria or register a prescription.</p>
                </div>
              ) : (
                <div className="history-table-wrapper">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Patient Name</th>
                        <th>Age/Gender</th>
                        <th>Prescribing Doctor</th>
                        <th>Diagnosis</th>
                        <th>Medicines</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrescriptions.map(p => (
                        <tr key={p.id}>
                          <td>{p.date}</td>
                          <td><strong>{p.patientName}</strong><br/><span className="sub-text">{p.patientPhone}</span></td>
                          <td>{formatAgeGender(p.patientAge, p.patientGender)}</td>
                          <td>{p.doctorName}</td>
                          <td>{p.diagnosis || 'N/A'}</td>
                          <td>
                            <div className="meds-tags">
                              {p.medicines.map((m, idx) => (
                                <span key={idx} className="med-tag">{m.name}</span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button 
                                className="btn-icon" 
                                onClick={() => handlePrintRx(p)}
                                title="Print Prescription"
                              >
                                <Printer size={16} />
                              </button>
                              <button 
                                className="btn-icon text-danger" 
                                onClick={() => handleDeletePrescription(p.id)}
                                title="Delete Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Prescription Writer Modal Overlay */}
      {selectedReceipt && (
        <div className="writer-overlay no-print">
          <div className="writer-modal">
            <div className="writer-header">
              <div>
                <h3>Write Medical Prescription (Rx)</h3>
                <p>Patient: <strong>{selectedReceipt.patientName}</strong> ({formatAgeGender(selectedReceipt.patientAge, selectedReceipt.patientGender)})</p>
              </div>
              <button className="btn-close" onClick={() => setSelectedReceipt(null)}>×</button>
            </div>

            <form onSubmit={handleSaveAndPrint} className="writer-form">
              <div className="writer-modal-content">
                <div className="writer-form-column">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Symptoms / Chief Complaints</label>
                      <textarea 
                        placeholder="Describe symptoms, complaints, duration..." 
                        value={symptoms}
                        onChange={e => setSymptoms(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="form-group">
                      <label>Diagnosis / Clinical Impression</label>
                      <textarea 
                        placeholder="Enter diagnosis or findings..." 
                        value={diagnosis}
                        onChange={e => setDiagnosis(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Medicines Management */}
                  <div className="medicines-section">
                    <div className="section-title-row">
                      <h4>Medicines & Rx Dosage</h4>
                      <button 
                        type="button" 
                        className="btn-secondary-sm"
                        onClick={handleAddMedicineRow}
                      >
                        <Plus size={14} /> Add Medicine
                      </button>
                    </div>

                    <div className="medicines-table-wrapper">
                      <table className="medicines-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40%' }}>Medicine Name</th>
                            <th style={{ width: '20%' }}>Dosage (e.g. 1-0-1)</th>
                            <th style={{ width: '15%' }}>Duration</th>
                            <th style={{ width: '20%' }}>Instructions</th>
                            <th style={{ width: '5%' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {medicines.map((m, index) => (
                            <tr key={index}>
                              <td>
                                <input 
                                  type="text"
                                  placeholder="Paracetamol 650mg"
                                  value={m.name}
                                  onChange={e => handleMedicineChange(index, 'name', e.target.value)}
                                  list="medicine-names"
                                  required
                                />
                              </td>
                              <td>
                                <input 
                                  type="text"
                                  placeholder="1-0-1"
                                  value={m.dosage}
                                  onChange={e => handleMedicineChange(index, 'dosage', e.target.value)}
                                  list="dosage-options"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text"
                                  placeholder="5 days"
                                  value={m.duration}
                                  onChange={e => handleMedicineChange(index, 'duration', e.target.value)}
                                  list="duration-options"
                                />
                              </td>
                              <td>
                                <input 
                                  type="text"
                                  placeholder="After food"
                                  value={m.instructions}
                                  onChange={e => handleMedicineChange(index, 'instructions', e.target.value)}
                                  list="instruction-options"
                                />
                              </td>
                              <td>
                                <button 
                                  type="button" 
                                  className="btn-remove-med"
                                  onClick={() => handleRemoveMedicineRow(index)}
                                  disabled={medicines.length === 1}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Advice / Additional Notes</label>
                    <textarea 
                      placeholder="Drink plenty of water, avoid cold items..." 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Autocomplete Recommendation Datalists */}
                  <datalist id="medicine-names">
                    {uniqueMedicineSuggestions.map((med, idx) => (
                      <option key={idx} value={med} />
                    ))}
                  </datalist>

                  <datalist id="dosage-options">
                    {uniqueDosageSuggestions.map((dos, idx) => (
                      <option key={idx} value={dos} />
                    ))}
                  </datalist>

                  <datalist id="duration-options">
                    {uniqueDurationSuggestions.map((dur, idx) => (
                      <option key={idx} value={dur} />
                    ))}
                  </datalist>

                  <datalist id="instruction-options">
                    {uniqueInstructionsSuggestions.map((inst, idx) => (
                      <option key={idx} value={inst} />
                    ))}
                  </datalist>

                  <div className="writer-actions">
                    <button type="button" className="btn-ghost" onClick={() => setSelectedReceipt(null)}>Cancel</button>
                    <button 
                      type="submit" 
                      className="btn-secondary btn-save-rx" 
                      onClick={() => setShouldPrintOnSubmit(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Save size={16} />
                      Save Prescription
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary btn-save-rx" 
                      onClick={() => setShouldPrintOnSubmit(true)}
                    >
                      <Printer size={16} />
                      Save & Print
                    </button>
                  </div>
                </div>

                {/* Right Column: History */}
                <div className="writer-history-column">
                  <div className="history-title-row">
                    <History size={16} className="text-primary" />
                    <span>Patient Clinical History</span>
                  </div>

                  {(() => {
                    const history = prescriptions
                      .filter(p => {
                        const nameMatch = p.patientName.toLowerCase() === selectedReceipt.patientName.toLowerCase();
                        const phoneMatch = selectedReceipt.patientPhone && p.patientPhone === selectedReceipt.patientPhone;
                        const isCurrent = p.receiptId === selectedReceipt.id;
                        return (nameMatch || phoneMatch) && !isCurrent;
                      })
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (history.length === 0) {
                      return (
                        <div className="no-history-placeholder">
                          <FileText size={24} style={{ opacity: 0.5 }} />
                          <p>No previous clinical records found for this patient.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="history-cards-list">
                        {history.map(rx => (
                          <div className="history-card" key={rx.id}>
                            <div className="history-card-header">
                              <span className="history-card-date">
                                {(() => {
                                  try {
                                    return format(new Date(rx.date.split(' ')[0]), 'dd MMM yyyy');
                                  } catch (e) {
                                    return rx.date;
                                  }
                                })()}
                              </span>
                              <span className="history-card-doctor">
                                By {rx.doctorName}
                              </span>
                            </div>
                            
                            {rx.symptoms && (
                              <div className="history-card-section">
                                <strong>Symptoms:</strong> {rx.symptoms}
                              </div>
                            )}
                            
                            {rx.diagnosis && (
                              <div className="history-card-section">
                                <strong>Diagnosis:</strong> {rx.diagnosis}
                              </div>
                            )}
                            
                            {rx.medicines && rx.medicines.length > 0 && (
                              <div className="history-card-section">
                                <strong>Rx Medicines:</strong>
                                <ul className="history-med-list">
                                  {rx.medicines.map((m, idx) => (
                                    <li key={idx}>
                                      {m.name} - {m.dosage} ({m.duration}){m.instructions ? ` [${m.instructions}]` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {rx.notes && (
                              <div className="history-card-section">
                                <strong>Notes:</strong> {rx.notes}
                              </div>
                            )}
                            
                            <button
                              type="button"
                              className="btn-secondary-sm btn-copy-rx"
                              onClick={() => handleCopyFromPast(rx)}
                              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Plus size={12} />
                              Copy to Current Rx
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Print Template for Prescription (Rx) */}
      {activePrintPrescription && (() => {
        const doctorObj = doctors.find(d => d.id === activePrintPrescription.doctorId);
        const printHeader = doctorObj ? (doctorObj.printHeader !== false) : true;
        const customTopMargin = doctorObj ? (doctorObj.customTopMargin || 0) : 0;

        return (
          <div id="prescription-print-template" className="print-only">
            <div 
              className="print-container"
              style={{
                paddingTop: !printHeader && customTopMargin ? `${customTopMargin}mm` : undefined,
                borderTop: !printHeader ? 'none' : undefined
              }}
            >
              {/* Header / Clinic Doctor Info */}
              {printHeader && (
                <div className="print-header">
                  <div className="print-clinic-branding">
                    <h2>Dr. {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}</h2>
                    <p className="qualifications">{doctorObj?.qualifications || ''}</p>
                    <p className="specialization">{doctorObj?.specialization || 'Consulting Physician'}</p>
                  </div>
                  <div className="print-clinic-address">
                    <p className="address-text">{doctorObj?.address || ''}</p>
                    {doctorObj?.phone && (
                      <p className="phone-text"><strong>Ph:</strong> {doctorObj?.phone}</p>
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
                  {activePrintPrescription.medicines.map((m, idx) => (
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
        </div>
      )})()}

      {/* Styled Workstation Component */}
      <style>{`
        .doctor-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
        }

        .doctor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 1rem 2rem;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-left .logo-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
          border-radius: 10px;
        }

        .title-group h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .title-group p {
          font-size: 0.8rem;
          color: #64748b;
          margin: 0;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .profile-selector {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #475569;
        }

        .select-profile-dropdown {
          padding: 0.5rem 1rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: white;
          font-size: 0.875rem;
          color: #0f172a;
          outline: none;
          cursor: pointer;
        }

        .btn-signout {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          background: white;
          border: 1px solid #cbd5e1;
          color: #ef4444;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-signout:hover {
          background: #fef2f2;
          border-color: #fee2e2;
        }

        .doctor-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .doctor-tabs {
          width: 240px;
          background: white;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          gap: 0.5rem;
        }

        .tab-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 500;
          font-size: 0.9rem;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .tab-item:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .tab-item.active {
          background: #e0f2fe;
          color: #0369a1;
          font-weight: 600;
        }

        .queue-count {
          margin-left: auto;
          background: #ef4444;
          color: white;
          padding: 0.15rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: 999px;
        }

        .doctor-workspace-panel {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        .tab-pane {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 0.75rem;
        }

        .panel-header h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.5rem;
          color: #0f172a;
          margin: 0;
        }

        .date-badge {
          background: #e2e8f0;
          color: #475569;
          padding: 0.25rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 9999px;
        }

        .warning-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #78350f;
          padding: 0.75rem 1.25rem;
          border-radius: 10px;
          font-size: 0.875rem;
        }

        .empty-slate {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          background: white;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .empty-slate h4 {
          font-size: 1.15rem;
          margin: 1rem 0 0.25rem;
          color: #0f172a;
        }

        .empty-slate p {
          font-size: 0.9rem;
          margin: 0;
        }

        .queue-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .queue-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          transition: all 0.2s;
        }

        .queue-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.04);
        }

        .queue-card.prescribed {
          border-left: 4px solid #10b981;
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .patient-meta h4 {
          font-size: 1.05rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }

        .patient-specs {
          font-size: 0.8rem;
          color: #64748b;
        }

        .status-tag {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
        }

        .status-tag.pending {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-tag.success {
          background: #d1fae5;
          color: #065f46;
        }

        .card-middle p {
          font-size: 0.85rem;
          color: #475569;
          margin: 0 0 0.35rem;
        }

        .card-middle p strong {
          color: #0f172a;
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: auto;
        }

        .btn-primary {
          background: #0ea5e9;
          color: white;
          padding: 0.6rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .btn-primary:hover {
          background: #0284c7;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
          padding: 0.6rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          border-radius: 8px;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }

        .search-header {
          flex-direction: row;
        }

        .search-bar {
          position: relative;
          width: 320px;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-bar input {
          padding-left: 2.5rem;
        }

        .history-table-wrapper {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .history-table th, .history-table td {
          padding: 1rem;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.875rem;
        }

        .history-table th {
          background: #f8fafc;
          font-weight: 600;
          color: #475569;
        }

        .sub-text {
          font-size: 0.8rem;
          color: #64748b;
        }

        .meds-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .med-tag {
          background: #f1f5f9;
          color: #475569;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .table-actions {
          display: flex;
          gap: 0.35rem;
          justify-content: center;
        }

        .btn-icon {
          background: transparent;
          border: none;
          color: #64748b;
          padding: 0.35rem;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-icon:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .btn-icon.text-danger:hover {
          color: #ef4444;
          background: #fef2f2;
        }

        /* Modal Overlay Writer */
        .writer-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 2rem;
        }

        .writer-modal {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 1150px;
          height: 85vh;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .writer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #cbd5e1;
        }

        .writer-header h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.25rem;
          margin: 0 0 0.25rem;
          color: #0f172a;
        }

        .writer-header p {
          font-size: 0.85rem;
          color: #64748b;
          margin: 0;
        }

        .btn-close {
          background: transparent;
          border: none;
          font-size: 1.75rem;
          color: #94a3b8;
          cursor: pointer;
        }

        .writer-form {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .medicines-section {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 1.25rem;
        }

        .section-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .section-title-row h4 {
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          color: #0f172a;
          margin: 0;
        }

        .btn-secondary-sm {
          background: white;
          border: 1px solid #cbd5e1;
          padding: 0.35rem 0.75rem;
          font-size: 0.8rem;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
        }

        .medicines-table {
          width: 100%;
          border-collapse: collapse;
        }

        .medicines-table th, .medicines-table td {
          padding: 0.5rem;
          text-align: left;
        }

        .medicines-table th {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .medicines-table input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .btn-remove-med {
          background: transparent;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 0.25rem;
        }

        .btn-remove-med:hover {
          background: #fee2e2;
          border-radius: 4px;
        }

        .writer-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          border-top: 1px solid #e2e8f0;
          padding-top: 1.5rem;
        }

        .btn-ghost {
          background: transparent;
          color: #64748b;
          padding: 0.6rem 1.25rem;
          font-weight: 600;
        }

        .writer-modal-content {
          display: flex;
          gap: 2rem;
          padding: 1.5rem 2rem;
          max-height: calc(85vh - 80px);
          overflow: hidden;
          flex: 1;
        }

        .writer-form-column {
          flex: 1.4;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .writer-history-column {
          flex: 1;
          border-left: 1px solid #cbd5e1;
          padding-left: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .history-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #1e293b;
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          position: sticky;
          top: 0;
          background: white;
          padding: 0.25rem 0;
          z-index: 10;
        }

        .history-cards-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .history-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .history-card:hover {
          border-color: #cbd5e1;
          background: #f1f5f9;
        }

        .history-card-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 0.375rem;
        }

        .history-card-date {
          color: #0ea5e9;
        }

        .history-card-section {
          font-size: 0.8rem;
          color: #334155;
          line-height: 1.4;
        }

        .history-card-section strong {
          color: #475569;
        }

        .history-med-list {
          margin: 0.25rem 0 0 1rem;
          padding: 0;
          list-style-type: disc;
          color: #475569;
        }

        .history-med-list li {
          font-size: 0.75rem;
          margin-bottom: 0.125rem;
        }

        .no-history-placeholder {
          text-align: center;
          padding: 3rem 1rem;
          color: #94a3b8;
          font-size: 0.85rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        /* Prescription Print Styleheet styling */
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
  );
};

export default DoctorWorkstation;
