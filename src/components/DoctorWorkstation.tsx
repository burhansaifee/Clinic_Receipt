import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays } from 'date-fns';
import { ClipboardList, FileText, Search, Plus, Trash2, Printer, PlusCircle, AlertCircle, LogOut, CheckCircle, Save, History, KeyRound, Calendar, MessageCircle, FlaskConical, X, Volume2, Bell, Pill, Activity, Stethoscope } from 'lucide-react';
import { useToast } from './ui/Toast';
import { storage, formatAgeGender, notifyDataChanged, broadcastDoctorCallNext, type Doctor, type Receipt, type Prescription, type PrescribedMedicine, type PrescriptionPaperType, type Medicine, type LabTest, type DoctorNextCallEvent } from '../lib/storage';
import { MedicinesDropdown } from './ui/MedicinesDropdown';
import { LabOrdersDropdown } from './ui/LabOrdersDropdown';
import { DiagnosisDropdown } from './ui/DiagnosisDropdown';
import { PatientEhrModal, isSamePatientRecord, type PatientSummary } from './ui/PatientEhrModal';
import '../styles/components/DoctorWorkstation.css';

interface MedicineAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  pharmacyMedicines: Medicine[];
  placeholder?: string;
  required?: boolean;
}

const MedicineAutocompleteInput: React.FC<MedicineAutocompleteProps> = ({
  value,
  onChange,
  suggestions,
  pharmacyMedicines,
  placeholder,
  required
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean; maxHeight: number } | null>(null);

  const updateCoords = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 280);
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 240 && rect.top > 240;
    const maxHeight = placeAbove ? Math.min(240, rect.top - 16) : Math.min(240, spaceBelow - 16);
    
    // Ensure left doesn't push dropdown outside the viewport
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(8, window.innerWidth - dropdownWidth - 12);
    }

    setCoords({
      top: placeAbove ? rect.top - 4 : rect.bottom + 4,
      left,
      width: dropdownWidth,
      placeAbove,
      maxHeight: Math.max(120, maxHeight)
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScroll = () => updateCoords();
      const handleResize = () => updateCoords();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent | MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const valClean = (value || '').toLowerCase().trim();
  const filtered = suggestions
    .filter(name => {
      if (!valClean) return true;
      if (name.toLowerCase().includes(valClean)) return true;
      const pm = pharmacyMedicines.find(m => m.name.toLowerCase() === name.toLowerCase());
      if (pm?.genericName?.toLowerCase().includes(valClean)) return true;
      return false;
    })
    .slice(0, 40);

  const matched = pharmacyMedicines.find(pm => pm.name.toLowerCase() === (value || '').trim().toLowerCase());
  const stock = matched?.currentStock || 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || 'Paracetamol 650mg'}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
          updateCoords();
        }}
        onFocus={() => {
          setIsOpen(true);
          updateCoords();
        }}
        onClick={() => {
          setIsOpen(true);
          updateCoords();
        }}
        required={required}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.88rem', padding: '0.5rem 0.65rem' }}
        autoComplete="off"
      />
      {matched && (
        <div style={{ fontSize: '0.7rem', fontWeight: 600, marginTop: '3px', color: stock > 0 ? '#15803d' : '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>{stock > 0 ? `🟢 ${stock} in pharmacy` : '🔴 Out of stock'}</span>
          {matched.genericName && <span style={{ color: '#64748b' }}>({matched.genericName})</span>}
        </div>
      )}

      {isOpen && filtered.length > 0 && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.placeAbove 
              ? { bottom: `${window.innerHeight - coords.top}px` } 
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 999999,
            padding: '4px 0'
          }}
        >
          {filtered.map((item, idx) => {
            const pm = pharmacyMedicines.find(m => m.name.toLowerCase() === item.toLowerCase());
            const itemStock = pm?.currentStock ?? null;
            return (
              <div
                key={idx}
                onPointerDown={e => {
                  e.preventDefault();
                }}
                onClick={() => {
                  onChange(item);
                  setIsOpen(false);
                }}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.84rem',
                  touchAction: 'manipulation',
                  backgroundColor: value === item ? '#eff6ff' : 'transparent'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = value === item ? '#eff6ff' : 'transparent')}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{item}</div>
                  {pm?.genericName && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>{pm.genericName}</div>
                  )}
                </div>
                {itemStock !== null && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: itemStock > 0 ? '#dcfce7' : '#fee2e2',
                      color: itemStock > 0 ? '#15803d' : '#b91c1c',
                      whiteSpace: 'nowrap',
                      marginLeft: '8px'
                    }}
                  >
                    {itemStock > 0 ? `${itemStock} in stock` : 'Out of stock'}
                  </span>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

interface QuickSuggestProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
}

const QuickSuggestInput: React.FC<QuickSuggestProps> = ({
  value,
  onChange,
  suggestions,
  placeholder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean; maxHeight: number } | null>(null);

  const updateCoords = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 160);
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 200 && rect.top > 200;
    const maxHeight = placeAbove ? Math.min(200, rect.top - 16) : Math.min(200, spaceBelow - 16);
    
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(8, window.innerWidth - dropdownWidth - 12);
    }

    setCoords({
      top: placeAbove ? rect.top - 4 : rect.bottom + 4,
      left,
      width: dropdownWidth,
      placeAbove,
      maxHeight: Math.max(100, maxHeight)
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScroll = () => updateCoords();
      const handleResize = () => updateCoords();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent | MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const valClean = (value || '').toLowerCase().trim();
  const filtered = suggestions
    .filter(s => !valClean || s.toLowerCase().includes(valClean))
    .slice(0, 20);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
          updateCoords();
        }}
        onFocus={() => {
          setIsOpen(true);
          updateCoords();
        }}
        onClick={() => {
          setIsOpen(true);
          updateCoords();
        }}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.88rem', padding: '0.5rem 0.65rem' }}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.placeAbove 
              ? { bottom: `${window.innerHeight - coords.top}px` } 
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 999999,
            padding: '4px 0'
          }}
        >
          {filtered.map((item, idx) => (
            <div
              key={idx}
              onPointerDown={e => {
                e.preventDefault();
              }}
              onClick={() => {
                onChange(item);
                setIsOpen(false);
              }}
              style={{
                padding: '9px 12px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#1e293b',
                touchAction: 'manipulation',
                borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                backgroundColor: value === item ? '#eff6ff' : 'transparent'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = value === item ? '#eff6ff' : 'transparent')}
            >
              {item}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

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
  const [rxHistoryScope, setRxHistoryScope] = useState<'ALL' | 'MY'>('ALL');
  const [patientForHistoryModal, setPatientForHistoryModal] = useState<PatientSummary | null>(null);
  
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

  // Live real-time broadcast sync across tabs & screens
  useEffect(() => {
    const handleSync = (e: any) => {
      const dt = e?.detail?.dataType;
      if (!dt || dt === 'receipts' || dt === 'prescriptions' || dt === 'lab' || dt === 'medicines' || dt === 'queue' || dt === 'all') {
        refreshData();
      }
    };
    window.addEventListener('buvora-data-updated', handleSync);
    return () => window.removeEventListener('buvora-data-updated', handleSync);
  }, [refreshData]);

  // Poll today's queue every 5 seconds as network backup
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayReceipts = await storage.getReceipts({ startDate: todayStr, endDate: todayStr });
        setReceipts(prev => {
          const prevWithoutToday = prev.filter(r => !r.date.startsWith(todayStr));
          const updated = [...prevWithoutToday, ...todayReceipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
          return updated;
        });
      } catch (e) {
        console.error('Failed to poll queue:', e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Safely clear print state after print dialog closes (debounced to avoid unmounting before Electron finishes spooling)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleAfterPrint = () => {
      timer = setTimeout(() => {
        setActivePrintPrescription(null);
      }, 3000);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timer);
    };
  }, []);

  // Filter today's patients (patient queue) sorted in increasing order (FIFO)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayReceipts = receipts
    .filter(r => {
      const isToday = r.date.startsWith(todayStr);
      const matchesDoctor = currentUserDoctorId ? r.doctorId === currentUserDoctorId : false;
      return isToday && matchesDoctor;
    })
    .sort((a, b) => {
      const tokenA = String((a as any).tokenNumber || a.receiptNumber || '');
      const tokenB = String((b as any).tokenNumber || b.receiptNumber || '');
      const matchA = tokenA.match(/\d+/g);
      const matchB = tokenB.match(/\d+/g);
      const numA = matchA ? parseInt(matchA[matchA.length - 1], 10) : null;
      const numB = matchB ? parseInt(matchB[matchB.length - 1], 10) : null;
      if (numA !== null && numB !== null && numA !== numB) return numA - numB;
      const timeA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
      const timeB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
      if (timeA && timeB && timeA !== timeB) return timeA - timeB;
      return tokenA.localeCompare(tokenB, undefined, { numeric: true });
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

  // Prescription History filtered with cross-doctor scope
  const filteredPrescriptions = prescriptions.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      (p.patientId && p.patientId.toLowerCase().includes(q)) ||
      (p.patientName && p.patientName.toLowerCase().includes(q)) ||
      (p.patientPhone && p.patientPhone.includes(q)) ||
      (p.doctorName && p.doctorName.toLowerCase().includes(q)) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(q)) ||
      (p.medicines && p.medicines.some(m => m.name.toLowerCase().includes(q)));
    
    if (rxHistoryScope === 'MY') {
      const matchesDoctor = currentUserDoctorId ? p.doctorId === currentUserDoctorId : false;
      return matchesSearch && matchesDoctor;
    }
    return matchesSearch;
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

      notifyDataChanged('lab');
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
    toast('Prescription details copied from past visit!', { type: 'success' });
  };

  const handleCopyMedsOnly = (pastMeds: PrescribedMedicine[]) => {
    setMedicines(prev => {
      const existingClean = prev.filter(m => m.name.trim() !== '');
      const newItems = pastMeds.map(m => ({ ...m }));
      return existingClean.length > 0 ? [...existingClean, ...newItems] : newItems;
    });
    toast(`Added ${pastMeds.length} medication(s) to current prescription`, { type: 'success' });
  };

  const handleCopyDiagnosisOnly = (pastDx: string) => {
    if (!pastDx.trim()) return;
    setDiagnosis(prev => {
      if (!prev.trim()) return pastDx.trim();
      if (prev.toLowerCase().includes(pastDx.toLowerCase().trim())) return prev;
      return `${prev}, ${pastDx.trim()}`;
    });
    toast('Diagnosis copied to current prescription', { type: 'success' });
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

    // Update chamber queue state in storage and localStorage: clear active token if it matches
    const docId = selectedReceipt.doctorId;
    try {
      const saved = localStorage.getItem(`clinic_qds_${docId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const receiptToken = String((selectedReceipt as any).tokenNumber || selectedReceipt.receiptNumber || '01');
        if (parsed.currentToken === receiptToken) {
          parsed.currentToken = null;
          parsed.currentPatientName = null;
          parsed.completedCount = (parsed.completedCount || 0) + 1;
          localStorage.setItem(`clinic_qds_${docId}`, JSON.stringify(parsed));
          await storage.setMetadata(`clinic_qds_${docId}`, JSON.stringify(parsed));
        }
      }
    } catch (_) {}

    notifyDataChanged('queue');

    // Automatically create & dispatch lab order to Laboratory & Diagnostics Desk if investigations were selected
    if (selectedLabTestIds.length > 0 && !labOrderSent) {
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
          prescriptionId: rxId,
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

        notifyDataChanged('lab');
      } catch (labErr) {
        console.error('Failed to auto-dispatch lab order:', labErr);
      }
    }

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
    }, 350);
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

  // Call Specific Patient into Doctor's Chamber & Notify Reception
  const handleDoctorCallSpecificPatient = async (receipt: Receipt) => {
    const doc = doctors.find(d => d.id === (currentUserDoctorId || receipt.doctorId));
    const doctorName = doc?.name || receipt.doctorName || 'Doctor';
    const chamberName = doc?.chamber?.trim() || 'Consultant Chamber';
    const token = String((receipt as any).tokenNumber || receipt.receiptNumber || '01');
    const patientName = receipt.patientName;

    const callData: DoctorNextCallEvent = {
      callId: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      doctorId: doc?.id || receipt.doctorId,
      doctorName,
      chamberName,
      token,
      patientName,
      timestamp: Date.now()
    };

    // 1. Broadcast event to Reception and TV queue screens
    broadcastDoctorCallNext(callData);

    // 2. Announce audio locally via Web Speech
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Token Number ${token}, ${patientName}, please proceed to ${chamberName}`);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }

    // 3. Save chamber queue state to localStorage so QueueDisplayTab reflects the active token
    const docId = doc?.id || receipt.doctorId;
    const remaining = waitingReceipts.filter(r => r.id !== receipt.id).map(r => ({
      token: String((r as any).tokenNumber || r.receiptNumber || '01'),
      patientName: r.patientName,
      time: (r as any).createdAt ? format(new Date((r as any).createdAt), 'hh:mm a') : (r.date || 'Now')
    }));

    const chamberState = {
      chamberId: `CH-${docId}`,
      chamberName,
      doctorId: docId,
      doctorName,
      doctorSpecialty: doc?.specialization || 'Consultant',
      currentToken: token,
      currentPatientName: patientName,
      waitingQueue: remaining,
      completedCount: 0
    };
    localStorage.setItem(`clinic_qds_${docId}`, JSON.stringify(chamberState));

    try {
      await storage.setMetadata(`clinic_qds_${docId}`, JSON.stringify(chamberState));
      await storage.setMetadata('latest_queue_call', JSON.stringify(callData));
    } catch (_) {}

    notifyDataChanged('queue');
    toast(`Calling Token #${token} (${patientName}) to ${chamberName}. Reception alerted!`, { type: 'success' });
  };

  // Call Next Waiting Patient from Today's Receipts
  const handleDoctorCallNext = async () => {
    if (waitingReceipts.length === 0) {
      toast('No waiting patients in queue', { type: 'info' });
      return;
    }
    await handleDoctorCallSpecificPatient(waitingReceipts[0]);
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Today's Patient Queue</h3>
                  <span className="date-badge">{format(new Date(), 'dd MMMM yyyy')}</span>

                  <button
                    type="button"
                    onClick={handleDoctorCallNext}
                    disabled={waitingReceipts.length === 0}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      background: waitingReceipts.length > 0 ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      padding: '7px 15px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: waitingReceipts.length > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: waitingReceipts.length > 0 ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={waitingReceipts.length > 0 ? 'Call next waiting patient into your chamber and notify reception' : 'Queue is empty'}
                  >
                    <Volume2 size={16} />
                    <span>Call Next Patient {waitingReceipts[0] ? `(#${(waitingReceipts[0] as any).tokenNumber || waitingReceipts[0].receiptNumber})` : ''}</span>
                  </button>
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
                    const pastRxList = prescriptions.filter(p => isSamePatientRecord(p, r) && p.receiptId !== r.id);
                    const otherDoctorVisits = pastRxList.filter(p => currentUserDoctorId ? p.doctorId !== currentUserDoctorId : false);

                    return (
                      <div key={r.id} className={`queue-card ${isPrescribed ? 'prescribed' : ''}`}>
                        <div className="card-top">
                          <div className="patient-meta">
                            {r.patientId && <span className="patient-id-badge" style={{ marginBottom: '2px' }}>{r.patientId}</span>}
                            <h4>{r.patientName}</h4>
                            <span className="patient-specs">
                              {formatAgeGender(r.patientAge, r.patientGender)}
                            </span>
                            {pastRxList.length > 0 && (
                              <div 
                                className="queue-history-pill" 
                                onClick={() => setPatientForHistoryModal(r)}
                                title="Click to view full cross-doctor clinical history & EHR dossier"
                                style={{
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: otherDoctorVisits.length > 0 ? '#eef2ff' : '#f0fdf4',
                                  color: otherDoctorVisits.length > 0 ? '#4338ca' : '#15803d',
                                  border: `1px solid ${otherDoctorVisits.length > 0 ? '#c7d2fe' : '#bbf7d0'}`,
                                  marginTop: '6px'
                                }}
                              >
                                <History size={12} />
                                <span>
                                  {otherDoctorVisits.length > 0 
                                    ? `${pastRxList.length} past visit(s) • Last: Dr. ${otherDoctorVisits[0].doctorName.replace(/^Dr\.?\s+/i, '')}` 
                                    : `${pastRxList.length} past visit(s) in clinic`}
                                </span>
                                <span style={{ fontSize: '0.66rem', textDecoration: 'underline' }}>View EHR</span>
                              </div>
                            )}
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
                            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                              <button 
                                className="btn-secondary"
                                style={{ flex: 1 }}
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
                                title="Print Prescription"
                              >
                                <Printer size={16} />
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setPatientForHistoryModal(r)}
                                title="View Cross-Doctor Clinical Timeline"
                                style={{ padding: '0.45rem 0.65rem', color: '#0284c7' }}
                              >
                                <History size={16} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                <button 
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => handleDoctorCallSpecificPatient(r)}
                                  title="Call this patient into chamber and alert reception"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, padding: '0.45rem 0.75rem', background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }}
                                >
                                  <Volume2 size={15} /> Call In
                                </button>
                                <button 
                                  className="btn-primary"
                                  style={{ flex: 1 }}
                                  onClick={() => handleOpenWriter(r)}
                                >
                                  <PlusCircle size={16} />
                                  Write Prescription
                                </button>
                              </div>
                              {pastRxList.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPatientForHistoryModal(r)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 600,
                                    color: '#4338ca',
                                    background: '#eef2ff',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    cursor: 'pointer'
                                  }}
                                  title="Review clinical records, past diagnoses & medications from other doctors"
                                >
                                  <History size={13} />
                                  <span>Review Cross-Doctor History ({pastRxList.length} visit{pastRxList.length > 1 ? 's' : ''})</span>
                                </button>
                              )}
                            </div>
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
              <div className="panel-header search-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Prescription Records</h3>
                  <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => setRxHistoryScope('ALL')}
                      style={{
                        background: rxHistoryScope === 'ALL' ? '#0ea5e9' : 'transparent',
                        color: rxHistoryScope === 'ALL' ? '#ffffff' : '#64748b',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Stethoscope size={13} />
                      <span>All Hospital Doctors (Cross-Doctor EHR)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRxHistoryScope('MY')}
                      style={{
                        background: rxHistoryScope === 'MY' ? '#0ea5e9' : 'transparent',
                        color: rxHistoryScope === 'MY' ? '#ffffff' : '#64748b',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>My Prescriptions Only</span>
                    </button>
                  </div>
                </div>
                <div className="search-bar" style={{ minWidth: '320px' }}>
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search patient, phone, UHID, doctor, diagnosis..." 
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
                          <td style={{ textAlign: 'left' }}>
                            {(() => {
                              const doc = doctors.find(d => d.id === p.doctorId || d.name.toLowerCase() === p.doctorName.toLowerCase());
                              const isOtherDoctor = currentUserDoctorId ? p.doctorId !== currentUserDoctorId : false;
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <strong>{p.doctorName}</strong>
                                    {isOtherDoctor && (
                                      <span style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                        Cross-Doctor
                                      </span>
                                    )}
                                  </div>
                                  {doc?.specialization && (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.specialization}</span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'left' }}>
                            <DiagnosisDropdown
                              diagnosis={p.diagnosis}
                              symptoms={p.symptoms}
                              notes={p.notes}
                              followUpDate={p.followUpDate}
                              followUpNotes={p.followUpNotes}
                              doctorName={p.doctorName}
                            />
                          </td>
                          <td style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <MedicinesDropdown medicines={p.medicines || []} />
                              {p.labInvestigations && p.labInvestigations.length > 0 && (
                                <LabOrdersDropdown tests={p.labInvestigations} />
                              )}
                            </div>
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
                                className="btn-icon text-primary" 
                                style={{ color: '#0ea5e9' }}
                                onClick={() => setPatientForHistoryModal({
                                  patientId: p.patientId,
                                  patientName: p.patientName,
                                  patientPhone: p.patientPhone,
                                  patientAge: p.patientAge,
                                  patientGender: p.patientGender
                                })}
                                title="View Patient Full Cross-Doctor Clinical Timeline (EHR)"
                              >
                                <History size={16} />
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
                {/* 1. Left Column: Clinical Evaluation & Follow-Up */}
                <div className="writer-left-column">
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <Activity size={15} style={{ color: '#0ea5e9' }} /> Symptoms / Chief Complaints
                    </label>
                    <textarea 
                      placeholder="Describe symptoms, complaints, duration..." 
                      value={symptoms}
                      onChange={e => setSymptoms(e.target.value)}
                      rows={3}
                      style={{ resize: 'vertical', minHeight: '65px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <Stethoscope size={15} style={{ color: '#6366f1' }} /> Diagnosis / Clinical Impression
                    </label>
                    <textarea 
                      placeholder="Enter diagnosis or findings..." 
                      value={diagnosis}
                      onChange={e => setDiagnosis(e.target.value)}
                      rows={3}
                      style={{ resize: 'vertical', minHeight: '65px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <FileText size={15} style={{ color: '#10b981' }} /> Advice / Additional Notes
                    </label>
                    <textarea 
                      placeholder="Drink plenty of water, avoid cold items..." 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      style={{ resize: 'vertical', minHeight: '65px' }}
                    />
                  </div>

                  {/* Next Visit / Patient Follow-Up */}
                  <div className="followup-form-section" style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ margin: 0, fontWeight: 700, fontSize: '0.825rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={15} style={{ color: '#0284c7' }} /> Next Visit / Patient Follow-Up
                      </label>
                      {followUpDate && (
                        <button
                          type="button"
                          onClick={() => { setFollowUpDate(''); setFollowUpNotes(''); }}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
                      {[
                        { label: '+3 Days', days: 3 },
                        { label: '+5 Days', days: 5 },
                        { label: '+1 Wk', days: 7 },
                        { label: '+10 Days', days: 10 },
                        { label: '+2 Wks', days: 14 },
                        { label: '+1 Mo', days: 30 },
                      ].map(preset => {
                        const targetDate = format(addDays(new Date(), preset.days), 'yyyy-MM-dd');
                        const isSelected = followUpDate === targetDate;
                        return (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => setFollowUpDate(targetDate)}
                            style={{
                              padding: '0.25rem 0.55rem',
                              borderRadius: '16px',
                              border: isSelected ? '1.5px solid #0284c7' : '1px solid var(--border)',
                              background: isSelected ? '#e0f2fe' : 'white',
                              color: isSelected ? '#0369a1' : 'var(--text-main)',
                              fontWeight: isSelected ? 700 : 500,
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Follow-Up Date</span>
                        <input
                          type="date"
                          value={followUpDate}
                          min={format(new Date(), 'yyyy-MM-dd')}
                          onChange={e => setFollowUpDate(e.target.value)}
                          className="sync-input-line"
                          style={{ width: '100%', padding: '0.4rem 0.55rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Reason / Notes</span>
                        <input
                          type="text"
                          placeholder="e.g. Check BP & Fever, Review reports"
                          value={followUpNotes}
                          onChange={e => setFollowUpNotes(e.target.value)}
                          className="sync-input-line"
                          style={{ width: '100%', padding: '0.4rem 0.55rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Center Column: Medicines & Rx Dosage & Diagnostic Laboratory Investigations */}
                <div className="writer-center-column">
                  {/* Medicines Management */}
                  <div className="medicines-section">
                    <div className="section-title-row">
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                        <Pill size={16} style={{ color: '#4f46e5' }} /> Medicines &amp; Rx Dosage
                      </h4>
                      <button 
                        type="button" 
                        className="btn-secondary-sm"
                        onClick={handleAddMedicineRow}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Plus size={14} /> Add Medicine
                      </button>
                    </div>

                    <div className="medicines-table-wrapper">
                      <table className="medicines-table">
                        <thead>
                          <tr>
                            <th style={{ width: '38%' }}>Medicine Name</th>
                            <th style={{ width: '22%' }}>Dosage</th>
                            <th style={{ width: '18%' }}>Duration</th>
                            <th style={{ width: '18%' }}>Instructions</th>
                            <th style={{ width: '4%', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {medicines.map((m, index) => (
                            <tr key={index}>
                              <td>
                                <MedicineAutocompleteInput
                                  placeholder="Paracetamol 650mg"
                                  value={m.name}
                                  onChange={val => handleMedicineChange(index, 'name', val)}
                                  suggestions={uniqueMedicineSuggestions}
                                  pharmacyMedicines={pharmacyMedicines}
                                  required
                                />
                              </td>
                              <td>
                                <QuickSuggestInput
                                  placeholder="1-0-1"
                                  value={m.dosage}
                                  onChange={val => handleMedicineChange(index, 'dosage', val)}
                                  suggestions={uniqueDosageSuggestions}
                                />
                              </td>
                              <td>
                                <QuickSuggestInput
                                  placeholder="5 days"
                                  value={m.duration}
                                  onChange={val => handleMedicineChange(index, 'duration', val)}
                                  suggestions={uniqueDurationSuggestions}
                                />
                              </td>
                              <td>
                                <QuickSuggestInput
                                  placeholder="After food"
                                  value={m.instructions}
                                  onChange={val => handleMedicineChange(index, 'instructions', val)}
                                  suggestions={uniqueInstructionsSuggestions}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  type="button" 
                                  className="btn-remove-med"
                                  onClick={() => handleRemoveMedicineRow(index)}
                                  disabled={medicines.length === 1}
                                  title="Remove medicine"
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

                  {/* Diagnostic Laboratory Investigations */}
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
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
                            Add New Investigation to Library &amp; Prescription
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
                            Save &amp; Select
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
                </div>

                {/* 3. Right Column: Patient Clinical History */}
                <div className="writer-history-column">
                  <div className="history-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <History size={16} className="text-primary" />
                      <span>Patient Clinical History</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPatientForHistoryModal(selectedReceipt)}
                      style={{
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0369a1',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                      title="Open full expanded EHR hospital dossier"
                    >
                      <span>Full Dossier ↗</span>
                    </button>
                  </div>

                  {(() => {
                    const history = prescriptions
                      .filter(p => isSamePatientRecord(p, selectedReceipt) && p.receiptId !== selectedReceipt.id)
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
                        {history.map(rx => {
                          const doc = doctors.find(d => d.id === rx.doctorId || d.name.toLowerCase() === rx.doctorName.toLowerCase());
                          const isOtherDoctor = currentUserDoctorId ? rx.doctorId !== currentUserDoctorId : false;
                          const rawMeds = rx.medicines;
                          const medsList: PrescribedMedicine[] = Array.isArray(rawMeds) ? rawMeds : typeof rawMeds === 'string' ? JSON.parse(rawMeds || '[]') : [];

                          return (
                            <div 
                              className="history-card" 
                              key={rx.id}
                              style={{
                                borderLeft: isOtherDoctor ? '3px solid #6366f1' : '3px solid #0ea5e9',
                                background: isOtherDoctor ? '#f8faff' : '#f8fafc'
                              }}
                            >
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', textAlign: 'right' }}>
                                  <span style={{ fontWeight: 600, color: isOtherDoctor ? '#4338ca' : '#0369a1' }}>
                                    By {rx.doctorName}
                                  </span>
                                  {isOtherDoctor && (
                                    <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#3730a3', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                      Cross-Doctor
                                    </span>
                                  )}
                                </div>
                              </div>
                              {doc?.specialization && (
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '-2px', fontStyle: 'italic' }}>
                                  Specialty: {doc.specialization}
                                </div>
                              )}
                              
                              {rx.diagnosis && (
                                <div className="history-card-section" style={{ background: '#f0f9ff', padding: '5px 8px', borderRadius: '6px', border: '1px solid #e0f2fe' }}>
                                  <strong style={{ color: '#0369a1' }}>Diagnosis:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{rx.diagnosis}</span>
                                </div>
                              )}

                              {rx.symptoms && (
                                <div className="history-card-section">
                                  <strong>Complaints:</strong> {rx.symptoms}
                                </div>
                              )}
                              
                              {medsList.length > 0 && (
                                <div className="history-card-section">
                                  <strong>Rx Medicines:</strong>
                                  <ul className="history-med-list">
                                    {medsList.map((m, idx) => (
                                      <li key={idx}>
                                        <span style={{ fontWeight: 600 }}>{m.name}</span> - {m.dosage} ({m.duration}){m.instructions ? ` [${m.instructions}]` : ''}
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
                                  <strong>Advice / Notes:</strong> {rx.notes}
                                </div>
                              )}
                              
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '6px', marginTop: '0.5rem' }}>
                                <button
                                  type="button"
                                  className="btn-secondary-sm btn-copy-rx"
                                  onClick={() => handleCopyFromPast(rx)}
                                  title="Copy entire prescription (symptoms, diagnosis, medicines, labs, advice)"
                                  style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                                >
                                  <Plus size={12} />
                                  Copy All
                                </button>
                                {medsList.length > 0 && (
                                  <button
                                    type="button"
                                    className="btn-secondary-sm"
                                    onClick={() => handleCopyMedsOnly(medsList)}
                                    title="Add these medicines to today's prescription"
                                    style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a', borderColor: '#bbf7d0' }}
                                  >
                                    <Pill size={12} />
                                    + Meds
                                  </button>
                                )}
                                {rx.diagnosis && (
                                  <button
                                    type="button"
                                    className="btn-secondary-sm"
                                    onClick={() => handleCopyDiagnosisOnly(rx.diagnosis)}
                                    title="Copy or append this diagnosis"
                                    style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0284c7', borderColor: '#bae6fd' }}
                                  >
                                    <Activity size={12} />
                                    + Dx
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bottom Actions Footer */}
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
                  Save &amp; Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Cross-Doctor Clinical History & EHR Timeline Modal */}
      {patientForHistoryModal && (
        <PatientEhrModal
          patient={patientForHistoryModal}
          prescriptions={prescriptions}
          receipts={receipts}
          doctors={doctors}
          currentUserDoctorId={currentUserDoctorId}
          onClose={() => setPatientForHistoryModal(null)}
          onPrintRx={handlePrintRx}
          onShareWhatsapp={handleShareWhatsapp}
          onPrescribeWithPastRx={pastRx => {
            const matchedReceipt = todayReceipts.find(r => isSamePatientRecord(r, patientForHistoryModal));
            if (matchedReceipt) {
              handleOpenWriter(matchedReceipt);
              handleCopyFromPast(pastRx);
              setPatientForHistoryModal(null);
            } else {
              toast(`Patient "${patientForHistoryModal.patientName}" does not have an active queue ticket in your chamber today.`, { type: 'info' });
            }
          }}
          hasActiveTodayQueueTicket={todayReceipts.some(r => isSamePatientRecord(r, patientForHistoryModal))}
        />
      )}

      {/* Hidden Print Template for Prescription (Rx) */}
      {activePrintPrescription && (() => {
        const doctorObj = doctors.find(d => String(d.id) === String(activePrintPrescription.doctorId));
        const printHeader = doctorObj ? (doctorObj.printHeader !== false) : true;
        const customTopMargin = doctorObj ? (doctorObj.customTopMargin || 0) : 0;
        const customBottomMargin = doctorObj ? (doctorObj.customBottomMargin || 0) : 0;
        const pageCss = prescriptionPaperType === 'A5' ? '@page { size: A5 portrait; margin: 0.6cm; }'
          : prescriptionPaperType === 'Letter' ? '@page { size: letter portrait; margin: 0.8cm; }'
          : prescriptionPaperType === 'A6' ? '@page { size: A6 portrait; margin: 0.4cm; }'
          : '@page { size: A4 portrait; margin: 0.8cm; }';

        const rawMeds = activePrintPrescription.medicines;
        const medsList: PrescribedMedicine[] = Array.isArray(rawMeds) ? rawMeds : typeof rawMeds === 'string' ? JSON.parse(rawMeds || '[]') : [];

        const rawLabs = activePrintPrescription.labInvestigations;
        const labsList: string[] = Array.isArray(rawLabs) ? rawLabs : typeof rawLabs === 'string' ? JSON.parse(rawLabs || '[]') : [];

        return (
          <>
            <style dangerouslySetInnerHTML={{ __html: pageCss }} />
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
                  {medsList.map((m, idx) => (
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

            {labsList.length > 0 && (
              <div className="print-investigations-section" style={{ marginBottom: '0.6rem', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Diagnostic Laboratory Investigations Advised:
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {labsList.map((testName, idx) => (
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
