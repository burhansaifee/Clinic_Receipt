import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { ClipboardList, FileText, Search, Plus, Trash2, Printer, PlusCircle, AlertCircle, LogOut, CheckCircle, Save, History, KeyRound, Calendar, MessageCircle, FlaskConical, X } from 'lucide-react';
import { useToast } from './ui/Toast';
import { storage, formatAgeGender, type Doctor, type Receipt, type Prescription, type PrescribedMedicine, type PrescriptionPaperType, type Medicine, type LabTest } from '../lib/storage';
import { MedicinesDropdown } from './ui/MedicinesDropdown';
import '../styles/components/DoctorWorkstation.css';

interface DoctorWorkstationProps {
  currentUser: string;
  currentUserDoctorId: string | null;
  onLogout: () => void;
}

const DoctorWorkstation: React.FC<DoctorWorkstationProps> = ({ currentUser, currentUserDoctorId, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'my-prescriptions'>('queue');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [pharmacyMedicines, setPharmacyMedicines] = useState<Medicine[]>([]);
  const [availableLabTests, setAvailableLabTests] = useState<LabTest[]>([]);
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<string[]>([]);
  const [labOrderSent, setLabOrderSent] = useState(false);
  const [labSearchQuery, setLabSearchQuery] = useState('');
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newLabTestName, setNewLabTestName] = useState('');
  
  const toast = useToast();
  const [prescriptionPaperType, setPrescriptionPaperType] = useState<PrescriptionPaperType>('A4');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<'WAITING' | 'PRESCRIBED' | 'ALL'>('WAITING');
  
  // Prescription Writer State
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [medicines, setMedicines] = useState<PrescribedMedicine[]>([
    { name: '', dosage: '', duration: '', instructions: '' }
  ]);
  
  // Printing State
  const [activePrintPrescription, setActivePrintPrescription] = useState<Prescription | null>(null);
  const [shouldPrintOnSubmit, setShouldPrintOnSubmit] = useState(false);

  // Load Data - Initial Full Load
  const refreshData = React.useCallback(async () => {
    try {
      const [allDoctors, allReceipts, allPrescriptions, paperSettings, allMeds, allTests] = await Promise.all([
        storage.getDoctors(),
        storage.getReceipts(),
        storage.getPrescriptions(),
        storage.getPrintPaperSettings(),
        storage.getMedicines().catch(() => []),
        storage.getLabTests().catch(() => [])
      ]);
      setDoctors(allDoctors);
      setReceipts(allReceipts);
      setPrescriptions(allPrescriptions);
      setPrescriptionPaperType(paperSettings.prescriptionPaper);
      setPharmacyMedicines(allMeds || []);
      setAvailableLabTests(allTests || []);
    } catch (e) {
      console.error('Failed to load doctor data:', e);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Poll ONLY today's queue every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayReceipts = await storage.getReceipts({ startDate: todayStr, endDate: todayStr });
        setReceipts(prev => {
          const prevWithoutToday = prev.filter(r => !r.date.startsWith(todayStr));
          return [...prevWithoutToday, ...todayReceipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
      } catch (e) {
        console.error('Failed to poll queue:', e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const isReceiptPrescribed = (r: Receipt) => {
    return prescriptions.some(p => 
      p.receiptId === r.id || 
      (Boolean(p.patientId && r.patientId) && p.patientId === r.patientId && (p.date || '').startsWith(todayStr))
    );
  };

  const waitingReceipts = todayReceipts.filter(r => !isReceiptPrescribed(r));
  const prescribedReceipts = todayReceipts.filter(r => isReceiptPrescribed(r));

  // Queue to display based on active filter
  const baseQueueList = queueFilter === 'WAITING'
    ? waitingReceipts
    : queueFilter === 'PRESCRIBED'
    ? prescribedReceipts
    : todayReceipts;

  // Filtered queue with live search
  const filteredQueue = baseQueueList.filter(r => {
    if (!queueSearchQuery.trim()) return true;
    const q = queueSearchQuery.toLowerCase().trim();
    return (
      (r.patientName || '').toLowerCase().includes(q) ||
      (r.patientPhone || '').includes(q) ||
      (r.patientId || '').toLowerCase().includes(q) ||
      (r.receiptNumber || '').toLowerCase().includes(q) ||
      (r.items || []).some(item => (item.description || '').toLowerCase().includes(q))
    );
  });

  // Prescription History filtered
  const filteredPrescriptions = prescriptions.filter(p => {
    const matchesSearch = !searchQuery ||
      (p.patientId && p.patientId.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
      ...pharmacyMedicines.map(m => m.name),
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
    setLabSearchQuery('');
    setShowAddTestModal(false);
    setNewLabTestName('');
    
    if (existing) {
      setSymptoms(existing.symptoms);
      setDiagnosis(existing.diagnosis);
      setNotes(existing.notes);
      setFollowUpDate(existing.followUpDate || '');
      setFollowUpNotes(existing.followUpNotes || '');
      setMedicines(existing.medicines.length > 0 ? existing.medicines : [
        { name: '', dosage: '', duration: '', instructions: '' }
      ]);
      if (existing.labInvestigations && existing.labInvestigations.length > 0) {
        const testIds: string[] = [];
        existing.labInvestigations.forEach(nameOrId => {
          const matched = availableLabTests.find(t => t.name.toLowerCase() === nameOrId.toLowerCase() || t.id === nameOrId);
          if (matched) {
            testIds.push(matched.id);
          } else {
            testIds.push(nameOrId);
          }
        });
        setSelectedLabTestIds(testIds);
      } else {
        setSelectedLabTestIds([]);
      }
    } else {
      setSymptoms('');
      setDiagnosis('');
      setNotes('');
      setFollowUpDate('');
      setFollowUpNotes('');
      setMedicines([{ name: '', dosage: '', duration: '', instructions: '' }]);
      setSelectedLabTestIds([]);
    }
    setLabOrderSent(false);
  };

  const handleAddNewLabTest = async (customName?: string) => {
    const rawName = customName !== undefined ? customName : (newLabTestName || labSearchQuery);
    const testName = rawName.trim();
    if (!testName) {
      toast('Please enter the investigation name', { type: 'error' });
      return;
    }

    // Check if test already exists in library
    const existing = availableLabTests.find(t => t.name.toLowerCase() === testName.toLowerCase());
    if (existing) {
      if (!selectedLabTestIds.includes(existing.id)) {
        setSelectedLabTestIds(prev => [...prev, existing.id]);
        toast(`Selected "${existing.name}" from library`, { type: 'info' });
      } else {
        toast(`"${existing.name}" is already selected`, { type: 'info' });
      }
      setLabSearchQuery('');
      setNewLabTestName('');
      setShowAddTestModal(false);
      return;
    }

    try {
      const res = await storage.saveLabTest({
        name: testName,
        category: 'General',
        sampleType: 'Blood / Routine',
        rate: 0,
        turnaroundTime: 'Same Day',
        isActive: 1
      });

      const newId = (res && res.id) || `TEST-${Date.now()}`;
      const newTestItem: LabTest = {
        id: newId,
        name: testName,
        code: newId,
        category: 'General',
        rate: 0,
        sampleType: 'Blood / Routine',
        turnaroundTime: 'Same Day',
        parameters: [],
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setAvailableLabTests(prev => [...prev, newTestItem]);
      setSelectedLabTestIds(prev => [...prev, newId]);
      setLabSearchQuery('');
      setNewLabTestName('');
      setShowAddTestModal(false);
      toast(`Investigation "${testName}" added to library & selected!`, { type: 'success' });
    } catch (err) {
      console.error('Failed to add new lab test:', err);
      toast('Failed to save investigation to library', { type: 'error' });
    }
  };

  const handleSendToLabQueue = async () => {
    if (!selectedReceipt || selectedLabTestIds.length === 0) return;
    try {
      const selectedTests = selectedLabTestIds.map(testId => {
        const t = availableLabTests.find(item => item.id === testId || item.name === testId);
        return {
          testId: t ? t.id : testId,
          testName: t ? t.name : testId,
          category: t?.category || 'General',
          sampleType: t?.sampleType || 'Blood (EDTA)',
          rate: t?.rate || 0,
          status: 'PENDING' as const,
          results: (t?.parameters || []).map(p => ({
            parameterId: p.id,
            parameterName: p.name,
            value: '',
            unit: p.unit,
            referenceRange: p.defaultRange,
            isAbnormal: false,
            flag: 'NORMAL'
          }))
        };
      });

      const total = selectedTests.reduce((sum, t) => sum + t.rate, 0);

      await storage.saveLabOrder({
        patientId: selectedReceipt.patientId,
        patientName: selectedReceipt.patientName,
        patientPhone: selectedReceipt.patientPhone || '',
        patientAge: selectedReceipt.patientAge || '',
        patientGender: selectedReceipt.patientGender || 'Male',
        doctorId: selectedReceipt.doctorId,
        doctorName: selectedReceipt.doctorName,
        tests: selectedTests,
        totalAmount: total,
        paidAmount: 0,
        paymentMode: 'CASH',
        status: 'ORDERED',
        orderDate: new Date().toISOString().split('T')[0]
      });

      setLabOrderSent(true);
      toast(`Ordered ${selectedTests.length} tests in Laboratory Desk!`, { type: 'success' });
    } catch (err) {
      console.error('Failed to send tests to lab queue:', err);
      toast('Failed to send to lab queue', { type: 'error' });
    }
  };

  const handleAddMedicineRow = () => {
    setMedicines(prev => [...prev, { name: '', dosage: '', duration: '', instructions: '' }]);
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
    setFollowUpDate(pastRx.followUpDate || '');
    setFollowUpNotes(pastRx.followUpNotes || '');
    if (pastRx.medicines && pastRx.medicines.length > 0) {
      setMedicines(pastRx.medicines.map(m => ({ ...m })));
    } else {
      setMedicines([{ name: '', dosage: '', duration: '', instructions: '' }]);
    }
    if (pastRx.labInvestigations && pastRx.labInvestigations.length > 0) {
      const testIds: string[] = [];
      pastRx.labInvestigations.forEach(nameOrId => {
        const matched = availableLabTests.find(t => t.name.toLowerCase() === nameOrId.toLowerCase() || t.id === nameOrId);
        if (matched) {
          testIds.push(matched.id);
        } else {
          testIds.push(nameOrId);
        }
      });
      setSelectedLabTestIds(testIds);
    }
  };

  const handleSaveAndPrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;

    const currentTime = new Date();
    const existingId = prescriptions.find(p => p.receiptId === selectedReceipt.id)?.id;
    const rxId = existingId || `rx_${currentTime.getTime()}`;
    const filteredMedicines = medicines.filter(m => m.name.trim() !== '');

    const selectedLabTestNames = selectedLabTestIds.map(idOrName => {
      const found = availableLabTests.find(t => t.id === idOrName || t.name === idOrName);
      return found ? found.name : idOrName;
    }).filter(Boolean);

    const prescription: Prescription = {
      id: rxId,
      receiptId: selectedReceipt.id,
      patientId: selectedReceipt.patientId,
      receiptNumber: selectedReceipt.receiptNumber,
      pid: selectedReceipt.patientId || selectedReceipt.receiptNumber,
      date: format(currentTime, 'yyyy-MM-dd HH:mm'),
      patientName: selectedReceipt.patientName,
      patientAge: selectedReceipt.patientAge,
      patientGender: selectedReceipt.patientGender,
      patientPhone: selectedReceipt.patientPhone,
      doctorId: selectedReceipt.doctorId,
      doctorName: selectedReceipt.doctorName,
      symptoms,
      diagnosis,
      medicines: filteredMedicines,
      labInvestigations: selectedLabTestNames,
      notes,
      followUpDate: followUpDate || undefined,
      followUpNotes: followUpNotes || undefined
    };

    await storage.savePrescription(prescription);

    // Save corresponding follow-up tracking record if scheduled
    if (followUpDate) {
      await storage.saveFollowUp({
        id: `fu_${rxId}`,
        prescriptionId: rxId,
        receiptId: selectedReceipt.id,
        patientId: selectedReceipt.patientId,
        patientName: selectedReceipt.patientName,
        patientPhone: selectedReceipt.patientPhone,
        patientAge: selectedReceipt.patientAge,
        patientGender: selectedReceipt.patientGender,
        doctorId: selectedReceipt.doctorId,
        doctorName: selectedReceipt.doctorName,
        scheduledDate: followUpDate,
        notes: followUpNotes || (diagnosis ? `Follow-up for ${diagnosis}` : 'Doctor Consultation Follow-Up'),
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });
    }

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

  const handleShareWhatsapp = async (prescription: Prescription) => {
    if (!prescription.patientPhone) {
      alert(`No phone number recorded for ${prescription.patientName}. Please edit the patient record first.`);
      return;
    }
    const confirmed = window.confirm(`Send prescription PDF to ${prescription.patientName} at ${prescription.patientPhone} via WhatsApp?`);
    if (!confirmed) return;
    
    try {
      toast('Generating and sending PDF...', { type: 'info' });
      
      const docObj = doctors.find(d => d.id === prescription.doctorId);
      const receiptObj = receipts.find(r => r.id === prescription.receiptId);
      const pid = prescription.patientId || prescription.pid || prescription.receiptNumber || receiptObj?.patientId || receiptObj?.receiptNumber || '';
      const enrichedPrescription = {
        ...prescription,
        patientId: pid,
        receiptNumber: pid,
        pid: pid,
        doctorSpecialization: docObj?.specialization || '',
        doctorQualifications: docObj?.qualifications || ''
      };
      
      const res = await window.whatsappBot.sharePrescriptionPdf(enrichedPrescription.patientPhone, enrichedPrescription);
      if (res && res.success) {
        toast('Prescription sent via WhatsApp!', { type: 'success' });
      } else {
        toast((res && res.error) || 'Failed to send prescription', { type: 'error' });
      }
    } catch (e: any) {
      toast(e.message || 'Error sending PDF', { type: 'error' });
    }
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
            <h2>Buvora Doctor Console</h2>
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
            {waitingReceipts.length > 0 && (
              <span className="queue-count">{waitingReceipts.length}</span>
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
            </div>
          </div>
        </aside>

        {/* Tab Contents */}
        <main className="doctor-workspace-panel">
          {activeTab === 'queue' && (
            <div className="tab-pane">
              <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0 }}>Today's Patient Queue</h3>
                  <span className="date-badge">{format(new Date(), 'dd MMMM yyyy')}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Search Bar for Queue */}
                  <div className="search-bar" style={{ width: '280px', position: 'relative' }}>
                    <Search size={16} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Search queue (Name, Phone, PID)..." 
                      value={queueSearchQuery}
                      onChange={e => setQueueSearchQuery(e.target.value)}
                    />
                    {queueSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setQueueSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '2px'
                        }}
                        title="Clear Search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter Pills: Waiting Only vs Prescribed vs All */}
                  <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => setQueueFilter('WAITING')}
                      style={{
                        background: queueFilter === 'WAITING' ? '#0284c7' : 'transparent',
                        color: queueFilter === 'WAITING' ? 'white' : '#64748b',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>Waiting Only</span>
                      <span style={{
                        background: queueFilter === 'WAITING' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: queueFilter === 'WAITING' ? 'white' : '#475569',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        fontSize: '0.7rem'
                      }}>
                        {waitingReceipts.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQueueFilter('PRESCRIBED')}
                      style={{
                        background: queueFilter === 'PRESCRIBED' ? '#16a34a' : 'transparent',
                        color: queueFilter === 'PRESCRIBED' ? 'white' : '#64748b',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>Prescribed</span>
                      <span style={{
                        background: queueFilter === 'PRESCRIBED' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: queueFilter === 'PRESCRIBED' ? 'white' : '#475569',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        fontSize: '0.7rem'
                      }}>
                        {prescribedReceipts.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQueueFilter('ALL')}
                      style={{
                        background: queueFilter === 'ALL' ? '#475569' : 'transparent',
                        color: queueFilter === 'ALL' ? 'white' : '#64748b',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>All</span>
                      <span style={{
                        background: queueFilter === 'ALL' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                        color: queueFilter === 'ALL' ? 'white' : '#475569',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        fontSize: '0.7rem'
                      }}>
                        {todayReceipts.length}
                      </span>
                    </button>
                  </div>
                </div>
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
              ) : queueFilter === 'WAITING' && waitingReceipts.length === 0 ? (
                <div className="empty-slate">
                  <CheckCircle size={48} className="text-success animate-pulse" />
                  <h4>All Waiting Patients Prescribed!</h4>
                  <p className="text-muted">
                    All {prescribedReceipts.length} registered patient(s) for today have been attended to and prescribed.
                  </p>
                  {prescribedReceipts.length > 0 && (
                    <button 
                      className="btn-secondary" 
                      onClick={() => setQueueFilter('PRESCRIBED')} 
                      style={{ marginTop: '1rem' }}
                    >
                      View Prescribed Patients ({prescribedReceipts.length})
                    </button>
                  )}
                </div>
              ) : filteredQueue.length === 0 ? (
                <div className="empty-slate">
                  <Search size={44} className="text-muted" />
                  <h4>No matching patients</h4>
                  <p className="text-muted">No patients found matching "{queueSearchQuery}".</p>
                  <button 
                    className="btn-secondary" 
                    onClick={() => setQueueSearchQuery('')} 
                    style={{ marginTop: '0.75rem' }}
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div className="queue-grid">
                  {filteredQueue.map(r => {
                    const isPrescribed = isReceiptPrescribed(r);
                    return (
                      <div key={r.id} className={`queue-card ${isPrescribed ? 'prescribed' : ''}`}>
                        <div className="card-top">
                          <div className="patient-meta">
                            {r.patientId && <span className="patient-id-badge" style={{ marginBottom: '2px' }}>{r.patientId}</span>}
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
                          {r.patientId && <p><strong>Patient ID:</strong> {r.patientId}</p>}
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
                <div className="history-table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Date</th>
                        <th style={{ textAlign: 'left' }}>Patient Name</th>
                        <th className="text-center" style={{ textAlign: 'center' }}>Age/Gender</th>
                        <th style={{ textAlign: 'left' }}>Prescribing Doctor</th>
                        <th style={{ textAlign: 'left' }}>Diagnosis</th>
                        <th style={{ textAlign: 'left' }}>Medicines</th>
                        <th className="text-center" style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrescriptions.map(p => (
                        <tr key={p.id}>
                          <td style={{ textAlign: 'left' }}>{p.date}</td>
                          <td style={{ textAlign: 'left' }}>
                            {p.patientId && <div style={{ marginBottom: '2px' }}><span className="patient-id-badge">{p.patientId}</span></div>}
                            <strong>{p.patientName}</strong><br/><span className="sub-text">{p.patientPhone}</span>
                          </td>
                          <td className="text-center" style={{ textAlign: 'center' }}>{formatAgeGender(p.patientAge, p.patientGender)}</td>
                          <td style={{ textAlign: 'left' }}>{p.doctorName}</td>
                          <td style={{ textAlign: 'left' }}>{p.diagnosis || 'N/A'}</td>
                          <td style={{ textAlign: 'left' }}>
                            <MedicinesDropdown medicines={p.medicines || []} />
                            {p.labInvestigations && p.labInvestigations.length > 0 && (
                              <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {p.labInvestigations.map((test, idx) => (
                                  <span key={idx} style={{ fontSize: '0.7rem', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                    🧪 {test}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="text-center" style={{ textAlign: 'center' }}>
                            <div className="table-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                              <button 
                                className="btn-icon" 
                                onClick={() => handlePrintRx(p)}
                                title="Print Prescription"
                              >
                                <Printer size={16} />
                              </button>
                              <button 
                                className="btn-icon text-success" 
                                style={{ color: '#10b981' }}
                                onClick={() => handleShareWhatsapp(p)}
                                title="Share via WhatsApp"
                              >
                                <MessageCircle size={16} />
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
                <p>
                  {selectedReceipt.patientId && <span className="patient-id-badge" style={{ marginRight: '6px' }}>{selectedReceipt.patientId}</span>}
                  Patient: <strong>{selectedReceipt.patientName}</strong> ({formatAgeGender(selectedReceipt.patientAge, selectedReceipt.patientGender)})
                </p>
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
                    </div>

                    <div className="medicines-table-wrapper">
                      <table className="medicines-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40%' }}>Medicine Name</th>
                            <th style={{ width: '20%' }}>Dosage (e.g. 1-0-1)</th>
                            <th style={{ width: '15%' }}>Duration</th>
                            <th style={{ width: '20%' }}>Instructions</th>
                            <th style={{ width: '5%', textAlign: 'center' }}></th>
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
                                {(() => {
                                  if (!m.name.trim()) return null;
                                  const matched = pharmacyMedicines.find(pm => pm.name.toLowerCase() === m.name.trim().toLowerCase());
                                  if (!matched) return null;
                                  const stock = matched.currentStock || 0;
                                  return (
                                    <div style={{ fontSize: '0.68rem', fontWeight: 600, marginTop: '3px', color: stock > 0 ? '#15803d' : '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span>{stock > 0 ? `🟢 ${stock} in pharmacy` : '🔴 Out of stock'}</span>
                                      {matched.genericName && <span style={{ color: '#64748b' }}>({matched.genericName})</span>}
                                    </div>
                                  );
                                })()}
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
                              <td style={{ textAlign: 'center' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button 
                        type="button" 
                        className="btn-secondary-sm"
                        onClick={handleAddMedicineRow}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Plus size={14} /> Add Medicine
                      </button>
                    </div>
                  </div>

                  {/* Diagnostic Laboratory Investigations */}
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)', marginTop: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FlaskConical size={16} style={{ color: '#4f46e5' }} /> Diagnostic Laboratory Investigations ({selectedLabTestIds.length} Selected)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setShowAddTestModal(true)}
                          style={{
                            background: '#f1f5f9',
                            color: '#4338ca',
                            border: '1px solid #c7d2fe',
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={13} /> Add Test to Library
                        </button>
                        {selectedLabTestIds.length > 0 && !labOrderSent && (
                          <button
                            type="button"
                            onClick={handleSendToLabQueue}
                            style={{
                              background: '#4f46e5',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <FlaskConical size={13} /> Send to Laboratory Desk
                          </button>
                        )}
                        {labOrderSent && (
                          <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={14} /> Ordered in Lab Queue
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Form for Adding New Test */}
                    {showAddTestModal && (
                      <div style={{
                        background: '#ffffff',
                        border: '1.5px solid #6366f1',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4338ca' }}>
                            Add New Investigation to Library & Prescription
                          </span>
                          <button
                            type="button"
                            onClick={() => { setShowAddTestModal(false); setNewLabTestName(''); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="e.g. Thyroid Profile, Vitamin D3, Serum Uric Acid..."
                            value={newLabTestName}
                            onChange={e => setNewLabTestName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddNewLabTest(newLabTestName);
                              }
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '0.4rem 0.6rem',
                              fontSize: '0.82rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddNewLabTest(newLabTestName)}
                            style={{
                              background: '#4f46e5',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Save & Select
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowAddTestModal(false); setNewLabTestName(''); }}
                            style={{
                              background: '#f1f5f9',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '0.4rem 0.65rem',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Selected Badges */}
                    {selectedLabTestIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.65rem', padding: '0.5rem', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4338ca', alignSelf: 'center', marginRight: '4px' }}>Prescribed:</span>
                        {selectedLabTestIds.map(idOrName => {
                          const t = availableLabTests.find(item => item.id === idOrName || item.name === idOrName);
                          const displayName = t ? t.name : idOrName;
                          return (
                            <span key={idOrName} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#4f46e5', color: 'white', padding: '2px 9px', borderRadius: '14px', fontSize: '0.76rem', fontWeight: 600 }}>
                              {displayName}
                              <button
                                type="button"
                                onClick={() => setSelectedLabTestIds(prev => prev.filter(item => item !== idOrName))}
                                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '0.85rem', lineHeight: 1, opacity: 0.85 }}
                                title="Remove test"
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Search & Quick Add */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '0.6rem', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="text"
                          placeholder="Search tests in library or type new to add..."
                          value={labSearchQuery}
                          onChange={e => setLabSearchQuery(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const query = labSearchQuery.trim();
                              if (!query) return;
                              const matched = availableLabTests.find(t => t.name.toLowerCase() === query.toLowerCase());
                              if (matched) {
                                if (!selectedLabTestIds.includes(matched.id)) {
                                  setSelectedLabTestIds(prev => [...prev, matched.id]);
                                }
                                setLabSearchQuery('');
                              } else {
                                handleAddNewLabTest(query);
                              }
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.65rem',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: 'white'
                          }}
                        />
                      </div>
                      {labSearchQuery.trim() && !availableLabTests.some(t => t.name.toLowerCase() === labSearchQuery.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => handleAddNewLabTest(labSearchQuery.trim())}
                          style={{
                            background: '#059669',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={13} /> Add &ldquo;{labSearchQuery.trim()}&rdquo; to Library
                        </button>
                      )}
                    </div>

                    {/* Test Pills Catalog (WITHOUT MRP) */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto', padding: '4px' }}>
                      {availableLabTests
                        .filter(test => !labSearchQuery.trim() || test.name.toLowerCase().includes(labSearchQuery.trim().toLowerCase()))
                        .map(test => {
                          const isSelected = selectedLabTestIds.includes(test.id);
                          return (
                            <button
                              key={test.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedLabTestIds(prev => prev.filter(id => id !== test.id));
                                } else {
                                  setSelectedLabTestIds(prev => [...prev, test.id]);
                                }
                              }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '20px',
                                border: isSelected ? '1.5px solid #4f46e5' : '1px solid var(--border)',
                                background: isSelected ? '#eef2ff' : 'white',
                                color: isSelected ? '#4338ca' : 'var(--text-main)',
                                fontWeight: isSelected ? 700 : 500,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span>{test.name}</span>
                            </button>
                          );
                        })}
                      {availableLabTests.filter(test => !labSearchQuery.trim() || test.name.toLowerCase().includes(labSearchQuery.trim().toLowerCase())).length === 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.3rem 0' }}>
                          No test in library matching &ldquo;{labSearchQuery}&rdquo;. Click &ldquo;Add to Library&rdquo; to add it.
                        </div>
                      )}
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

                  {/* Follow-Up / Revisit Schedule Section */}
                  <div className="followup-form-section" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <label style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={16} style={{ color: '#0284c7' }} /> Next Visit / Patient Follow-Up
                      </label>
                      {followUpDate && (
                        <button
                          type="button"
                          onClick={() => { setFollowUpDate(''); setFollowUpNotes(''); }}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Clear Follow-Up
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {[
                        { label: '+3 Days', days: 3 },
                        { label: '+5 Days', days: 5 },
                        { label: '+1 Week', days: 7 },
                        { label: '+10 Days', days: 10 },
                        { label: '+2 Weeks', days: 14 },
                        { label: '+1 Month', days: 30 },
                      ].map(preset => {
                        const targetDate = format(addDays(new Date(), preset.days), 'yyyy-MM-dd');
                        const isSelected = followUpDate === targetDate;
                        return (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => setFollowUpDate(targetDate)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '20px',
                              border: isSelected ? '1.5px solid #0284c7' : '1px solid var(--border)',
                              background: isSelected ? '#e0f2fe' : 'white',
                              color: isSelected ? '#0369a1' : 'var(--text-main)',
                              fontWeight: isSelected ? 700 : 500,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.75rem' }}>
                      <div>
                        <input
                          type="date"
                          value={followUpDate}
                          min={format(new Date(), 'yyyy-MM-dd')}
                          onChange={e => setFollowUpDate(e.target.value)}
                          className="sync-input-line"
                          style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Follow-up advice / reason (e.g. Check BP & Fever, Suture removal, Review reports)"
                          value={followUpNotes}
                          onChange={e => setFollowUpNotes(e.target.value)}
                          className="sync-input-line"
                          style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
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
                        const pidMatch = selectedReceipt.patientId && p.patientId && p.patientId.toLowerCase() === selectedReceipt.patientId.toLowerCase();
                        const nameMatch = p.patientName.toLowerCase() === selectedReceipt.patientName.toLowerCase();
                        const phoneMatch = selectedReceipt.patientPhone && p.patientPhone === selectedReceipt.patientPhone;
                        const isCurrent = p.receiptId === selectedReceipt.id;
                        return (pidMatch || nameMatch || phoneMatch) && !isCurrent;
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

                            {rx.labInvestigations && rx.labInvestigations.length > 0 && (
                              <div className="history-card-section">
                                <strong>Investigations:</strong>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                  {rx.labInvestigations.map((test, idx) => (
                                    <span key={idx} style={{ fontSize: '0.72rem', background: '#eef2ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                      🧪 {test}
                                    </span>
                                  ))}
                                </div>
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
        const customBottomMargin = doctorObj ? (doctorObj.customBottomMargin || 0) : 0;
        const pageCss = prescriptionPaperType === 'A5' ? '@page { size: A5 portrait; margin: 0.6cm; }'
          : prescriptionPaperType === 'Letter' ? '@page { size: letter portrait; margin: 0.8cm; }'
          : prescriptionPaperType === 'A6' ? '@page { size: A6 portrait; margin: 0.4cm; }'
          : '@page { size: A4 portrait; margin: 0.8cm; }';

        return (
          <>
            <style dangerouslySetInnerHTML={{ __html: `@media print { ${pageCss} }` }} />
            <div id="prescription-print-template" className={`print-only paper-${prescriptionPaperType.toLowerCase()}`}>
              <div 
                className="print-container"
                style={{
                  paddingTop: !printHeader && customTopMargin ? `${customTopMargin}mm` : undefined,
                  paddingBottom: !printHeader && customBottomMargin ? `${customBottomMargin}mm` : undefined,
                  borderTop: !printHeader ? 'none' : undefined,
                }}
              >
              {/* Header / Clinic Doctor Info */}
              {printHeader && (
                <div className="print-header">
                  <div className="print-clinic-branding">
                    <h2> {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}</h2>
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
                {activePrintPrescription.patientId && (
                  <div>
                    <span className="meta-label">Patient ID</span>
                    <strong className="meta-value">{activePrintPrescription.patientId}</strong>
                  </div>
                )}
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

            {/* Symptoms & Diagnosis (Side by Side) */}
            {(activePrintPrescription.symptoms || activePrintPrescription.diagnosis) && (
              <div className="print-clinical-grid" style={{ display: 'flex', flexDirection: 'row', gap: '1rem', marginBottom: '0.6rem', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.6rem' }}>
                {activePrintPrescription.symptoms && (
                  <div className="clinical-card" style={{ flex: 1, minWidth: 0 }}>
                    <span className="clinical-label">Chief Complaints / Symptoms</span>
                    <p className="clinical-text">{activePrintPrescription.symptoms}</p>
                  </div>
                )}
                {activePrintPrescription.diagnosis && (
                  <div className="clinical-card" style={{ flex: 1, minWidth: 0 }}>
                    <span className="clinical-label">Diagnosis</span>
                    <p className="clinical-text">{activePrintPrescription.diagnosis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Medicines List (Compact Table without bulky Rx logo) */}
            <div className="print-rx-section" style={{ marginBottom: '0.6rem' }}>
              <table className="print-meds-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>Sr.</th>
                    <th style={{ textAlign: 'left' }}>Medicine Description</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Dosage</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Duration</th>
                    <th style={{ textAlign: 'left' }}>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintPrescription.medicines.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ textAlign: 'left' }}><strong>{m.name}</strong></td>
                      <td style={{ textAlign: 'center' }}>{m.dosage}</td>
                      <td style={{ textAlign: 'center' }}>{m.duration}</td>
                      <td style={{ textAlign: 'left' }}>{m.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activePrintPrescription.labInvestigations && activePrintPrescription.labInvestigations.length > 0 && (
              <div className="print-investigations-section" style={{ marginBottom: '0.6rem', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Diagnostic Laboratory Investigations Advised:
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activePrintPrescription.labInvestigations.map((testName, idx) => (
                    <span key={idx} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      background: 'white',
                      border: '1px solid #94a3b8',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#0f172a'
                    }}>
                      {idx + 1}. {testName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activePrintPrescription.notes && (
              <div className="print-notes-section" style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem' }}>
                <span className="notes-label">Advice / Notes</span>
                <p className="notes-text" style={{ whiteSpace: 'pre-wrap' }}>{activePrintPrescription.notes}</p>
              </div>
            )}

            {activePrintPrescription.followUpDate && (
              <div className="print-followup-box" style={{ marginTop: '0.5rem', marginBottom: '0.5rem', padding: '0.4rem 0.75rem', border: '1.5px dashed #0284c7', borderRadius: '6px', background: '#f0f9ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>NEXT VISIT / PATIENT FOLLOW-UP</span>
                    <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                      {(() => {
                        try {
                          return format(new Date(activePrintPrescription.followUpDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy');
                        } catch {
                          return activePrintPrescription.followUpDate;
                        }
                      })()}
                    </strong>
                  </div>
                  {activePrintPrescription.followUpNotes && (
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#334155' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block' }}>REASON / ADVICE</span>
                      <strong>{activePrintPrescription.followUpNotes}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Signature Box */}
            <div className="print-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <div className="signature-box" style={{ textAlign: 'center' }}>
                <div className="signature-line" style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}></div>
                <p style={{ margin: '0 0 2px 0', fontWeight: '700', fontSize: '0.85rem' }}>{activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}</p>
                <p className="subtitle">Authorized Signature</p>
              </div>
            </div>
          </div>
        </div>
      </>
        );
      })()}
    </div>
  );
};

export default DoctorWorkstation;
