import React, { useState, useEffect, useRef } from 'react';
import { storage, cleanAgeString, notifyDataChanged, type Doctor, type Receipt, type ReceiptItem, type Service, type GlobalPatientProfile } from '../lib/storage';
import { Plus, Trash2, Save, User, CreditCard, AlertCircle, QrCode, MessageSquare, Printer, Send } from 'lucide-react';
import { format } from 'date-fns';
import QRCodeImage from './ui/QRCodeImage';
import { useToast } from './ui/Toast';
import { sendReceiptViaWhatsApp } from '../lib/whatsappReceipt';
import '../styles/components/ReceiptForm.css';

interface ReceiptFormProps {
  doctors: Doctor[];
  onSave: () => void;
  onPrintRequest: (receipt: Receipt) => void;
  initialData?: Receipt | null;
}

const parseAge = (ageStr: string) => {
  if (!ageStr) return { years: '', months: '' };
  const cleaned = cleanAgeString(ageStr);
  const yearsMatch = cleaned.match(/(\d+)\s*(?:y|years|yr|yrs)\b/i);
  const monthsMatch = cleaned.match(/(\d+)\s*(?:m|months|mth|mths)\b/i);
  
  const years = yearsMatch ? yearsMatch[1] : '';
  const months = monthsMatch ? monthsMatch[1] : '';
  
  if (!years && !months && /^\d+$/.test(cleaned)) {
    return { years: cleaned, months: '' };
  }
  
  return { years, months };
};

const ReceiptForm: React.FC<ReceiptFormProps> = ({ doctors, onSave, onPrintRequest, initialData }) => {
  const toast = useToast();
  const [patientId, setPatientId] = useState(initialData?.patientId || '');
  const [patientName, setPatientName] = useState(initialData?.patientName || '');
  const [ageYears, setAgeYears] = useState(() => {
    if (initialData?.patientAge) {
      return parseAge(initialData.patientAge).years;
    }
    return '';
  });
  const [ageMonths, setAgeMonths] = useState(() => {
    if (initialData?.patientAge) {
      return parseAge(initialData.patientAge).months;
    }
    return '';
  });
  const [patientAge, setPatientAge] = useState(initialData?.patientAge || '');
  const [patientGender, setPatientGender] = useState(initialData?.patientGender || 'Male');
  const [patientPhone, setPatientPhone] = useState(initialData?.patientPhone || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialData?.doctorId || '');
  const [items, setItems] = useState<ReceiptItem[]>(
    initialData?.items || []
  );
  const [receiptNumber, setReceiptNumber] = useState(initialData?.receiptNumber || '');
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [isReturningPatient, setIsReturningPatient] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE' | 'FREE'>(initialData?.paymentMethod || 'CASH');
  const [appointmentDate, setAppointmentDate] = useState(initialData?.date || format(new Date(), 'yyyy-MM-dd'));
  const [saveError, setSaveError] = useState<string | null>(null);

  // Global Patient Autocomplete State
  const [patientSearchResults, setPatientSearchResults] = useState<GlobalPatientProfile[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const handlePatientNameChange = async (val: string) => {
    setPatientName(val);
    if (val.trim().length >= 2) {
      setIsSearchingPatient(true);
      try {
        const results = await storage.searchGlobalPatients(val.trim());
        setPatientSearchResults(results || []);
        setShowPatientDropdown((results || []).length > 0);
      } catch (_) {}
      finally {
        setIsSearchingPatient(false);
      }
    } else {
      setPatientSearchResults([]);
      setShowPatientDropdown(false);
    }
  };

  const handleSelectPatientProfile = (p: GlobalPatientProfile) => {
    setPatientName(p.patientName);
    if (p.patientId || p.patientUhid) setPatientId(p.patientUhid || p.patientId || '');
    if (p.patientPhone) setPatientPhone(p.patientPhone);
    if (p.patientAge) {
      setPatientAge(String(p.patientAge));
      const { years, months } = parseAge(String(p.patientAge));
      setAgeYears(years);
      setAgeMonths(months);
    }
    if (p.patientGender) setPatientGender(p.patientGender);
    if (p.lastDoctorId && doctors.some(d => d.id === p.lastDoctorId)) {
      setSelectedDoctorId(p.lastDoctorId);
    }
    setIsReturningPatient(true);
    setTimeout(() => setIsReturningPatient(false), 4000);
    setShowPatientDropdown(false);
  };
  
  // QR Code states
  const [showQrCode, setShowQrCode] = useState<boolean>(initialData?.showQrCode ?? false);
  const [qrMode, setQrMode] = useState<'UPI' | 'CUSTOM'>('UPI');
  const [customQrInput, setCustomQrInput] = useState<string>(initialData?.qrCodeText || '');

  const shouldFocusLastItem = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleYearsChange = (val: string) => {
    setAgeYears(val);
    const yStr = val ? `${val} Y` : '';
    const mStr = ageMonths ? `${ageMonths} M` : '';
    setPatientAge([yStr, mStr].filter(Boolean).join(' '));
  };

  const handleMonthsChange = (val: string) => {
    setAgeMonths(val);
    const yStr = ageYears ? `${ageYears} Y` : '';
    const mStr = val ? `${val} M` : '';
    setPatientAge([yStr, mStr].filter(Boolean).join(' '));
  };

  useEffect(() => {
    const init = async () => {
      if (initialData?.date) {
        setAppointmentDate(initialData.date.split(' ')[0]);
      }
      if (!initialData || !initialData.id || !initialData.receiptNumber) {
        if (doctors.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(doctors[0].id);
          if (doctors[0].showQrCodeOnReceipt !== undefined) {
            setShowQrCode(doctors[0].showQrCodeOnReceipt);
          }
        }
        if (!initialData?.patientId) {
          const nextPid = await storage.getNextPatientId();
          setPatientId(nextPid);
        }
      } else {
        setReceiptNumber(initialData.receiptNumber);
        if (initialData.patientId) {
          setPatientId(initialData.patientId);
        }
      }
      setAvailableServices(await storage.getServices('OPD'));
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  useEffect(() => {
    if (selectedDoctorId && (!initialData || !initialData.id)) {
      const doc = doctors.find(d => d.id === selectedDoctorId);
      if (doc && doc.showQrCodeOnReceipt !== undefined) {
        setShowQrCode(doc.showQrCodeOnReceipt);
      }
    }
  }, [selectedDoctorId, doctors, initialData]);

  useEffect(() => {
    const updateReceiptNum = async () => {
      if (!initialData || !initialData.id || !initialData.receiptNumber) {
        setReceiptNumber(await storage.getNextReceiptNumber(paymentMethod === 'FREE'));
      }
    };
    updateReceiptNum();
  }, [paymentMethod, initialData]);

  useEffect(() => {
    if (shouldFocusLastItem.current && formRef.current) {
      const inputs = formRef.current.querySelectorAll('.description-selector input');
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
        lastInput.focus();
      }
      shouldFocusLastItem.current = false;
    }
  }, [items]);

  const addItem = () => {
    shouldFocusLastItem.current = true;
    setItems([...items, { id: crypto.randomUUID(), description: '', amount: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handlePhoneChange = async (value: string) => {
    setPatientPhone(value);
    
    // Auto-fill logic when phone is 10 digits
    if (value.length === 10) {
      const match = await storage.findPatientByPhoneOrId(value);
      if (match) {
        if (match.patientId) {
          setPatientId(match.patientId);
        }
        setPatientName(match.patientName);
        setPatientAge(match.patientAge);
        const { years, months } = parseAge(match.patientAge);
        setAgeYears(years);
        setAgeMonths(months);
        setPatientGender(match.patientGender);
        setIsReturningPatient(true);
        setTimeout(() => setIsReturningPatient(false), 4000);
      } else {
        setIsReturningPatient(false);
      }
    } else {
      setIsReturningPatient(false);
    }
  };

  const handlePatientIdChange = async (value: string) => {
    setPatientId(value);
    const clean = value.trim();
    if (clean.length >= 3) {
      const match = await storage.findPatientByPhoneOrId(clean);
      if (match && match.patientId && match.patientId.toLowerCase() === clean.toLowerCase()) {
        setPatientName(match.patientName);
        if (match.patientPhone) setPatientPhone(match.patientPhone);
        setPatientAge(match.patientAge);
        const { years, months } = parseAge(match.patientAge);
        setAgeYears(years);
        setAgeMonths(months);
        setPatientGender(match.patientGender);
        setIsReturningPatient(true);
        setTimeout(() => setIsReturningPatient(false), 4000);
      }
    }
  };

  const updateItem = (id: string, field: keyof ReceiptItem, value: string | number) => {
    const finalValue = value;
    let autoAmount: number | null = null;

    if (field === 'description' && typeof value === 'string') {
      const matched = availableServices.find(s =>
        s.serviceType !== 'FACILITY' &&
        !s.id?.startsWith('fac_') &&
        s.name.toLowerCase() === value.toLowerCase()
      );
      if (matched) {
        autoAmount = matched.amount;
      }
    }

    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: finalValue };
        if (autoAmount !== null) {
          updated.amount = autoAmount;
        }
        return updated;
      }
      return item;
    }));
  };

  const total = paymentMethod === 'FREE' ? 0 : items.reduce((sum, item) => sum + Number(item.amount), 0);

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  const getEffectiveQrText = () => {
    if (qrMode === 'UPI') {
      const upi = selectedDoctor?.upiId || customQrInput;
      if (upi) {
        const doctorName = selectedDoctor?.name || 'Clinic';
        return `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(doctorName)}&am=${total.toFixed(2)}&cu=INR`;
      }
    }
    return customQrInput || selectedDoctor?.qrCodeText || selectedDoctor?.upiId || '';
  };

  const effectiveQrText = getEffectiveQrText();

  const handleSave = async (e: React.FormEvent, shouldPrint: boolean = false, shouldSendWhatsApp: boolean = false) => {
    e.preventDefault();
    
    if (formRef.current && !formRef.current.reportValidity()) {
      return;
    }

    if (!selectedDoctorId) {
      alert('Please select a doctor');
      return;
    }

    if (shouldSendWhatsApp && !patientPhone.trim()) {
      toast('Please enter a patient phone number to send via WhatsApp.', { type: 'error' });
      return;
    }

    const doctor = doctors.find(d => d.id === selectedDoctorId);
    const isNew = !initialData || !initialData.id;
    
    const receipt: Receipt = {
      id: isNew ? crypto.randomUUID() : initialData.id,
      receiptNumber,
      date: appointmentDate,
      patientId: patientId.trim() || undefined,
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      doctorId: selectedDoctorId,
      doctorName: doctor?.name || 'Unknown',
      items,
      total,
      paymentMethod,
      billType: 'OPD',
      appointmentId: initialData?.appointmentId,
      showQrCode,
      qrCodeText: showQrCode ? effectiveQrText : undefined,
    };

    try {
      if (isNew) {
        await storage.saveReceipt(receipt);
        if (initialData?.appointmentId) {
          await storage.updateAppointmentStatus(initialData.appointmentId, 'COMPLETED');
        }
      } else {
        await storage.updateReceipt(receipt);
      }

      notifyDataChanged('receipts');
      notifyDataChanged('queue');
      setSaveError(null);

      if (shouldSendWhatsApp) {
        try {
          const res = await sendReceiptViaWhatsApp(receipt);
          toast(res.message || 'Receipt sent via WhatsApp successfully!', { type: 'success' });
        } catch (waErr: any) {
          toast(waErr.message || 'Failed to send WhatsApp message', { type: 'error' });
        }
      }

      if (shouldPrint) {
        onPrintRequest(receipt);
      }
      onSave();
    } catch (err: any) {
      console.error('Failed to save receipt:', err);
      setSaveError(err.message || 'An error occurred while saving the receipt.');
    }
  };


  return (
    <div className="receipt-form-container">
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="receipt-form no-print">
        <div className="form-grid">
          <div className="card">
            <h3><User size={18} /> Patient Information</h3>
            <div className="field-grid">
              <div className="form-group" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Patient Name</label>
                  {isSearchingPatient && <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Searching...</span>}
                </div>
                <input 
                  value={patientName} 
                  onChange={e => handlePatientNameChange(e.target.value)} 
                  onFocus={() => {
                    if (patientSearchResults.length > 0) setShowPatientDropdown(true);
                  }}
                  required 
                  placeholder="Full Name (auto-fills if returning)" 
                  autoComplete="off"
                />
                {showPatientDropdown && patientSearchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      maxHeight: '220px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}
                  >
                    <div style={{ padding: '6px 10px', fontSize: '0.72rem', background: '#f8fafc', fontWeight: 700, color: 'var(--text-muted)' }}>
                      MATCHING PATIENTS (CLICK TO AUTO-FILL)
                    </div>
                    {patientSearchResults.map((p, idx) => (
                      <div
                        key={`${p.patientId || p.patientName}-${idx}`}
                        onClick={() => handleSelectPatientProfile(p)}
                        style={{
                          padding: '8px 10px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.patientName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {p.patientAge ? `${p.patientAge} Y` : ''} {p.patientGender || ''} {p.patientPhone ? `• 📞 ${p.patientPhone}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            background: p.source === 'IPD' ? '#e0f2fe' : p.source === 'EMERGENCY' ? '#fee2e2' : '#f0fdf4',
                            color: p.source === 'IPD' ? '#0369a1' : p.source === 'EMERGENCY' ? '#b91c1c' : '#15803d'
                          }}>
                            {p.source}
                          </span>
                          {p.patientUhid && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{p.patientUhid}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="flex-label">
                  <span>Patient ID (UHID)</span>
                  {isReturningPatient && <span className="returning-badge">Returning Patient Found!</span>}
                </label>
                <input 
                  value={patientId} 
                  onChange={e => handlePatientIdChange(e.target.value)} 
                  placeholder="e.g. PID-1001" 
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 600 }}
                  title="Unique Patient ID (auto-generated or enter existing)"
                />
              </div>
              <div className="form-group">
                <label className="flex-label">
                  Phone Number
                </label>
                <input 
                  value={patientPhone} 
                  onChange={e => handlePhoneChange(e.target.value)} 
                  required 
                  placeholder="10-digit Mobile" 
                  type="tel"
                  maxLength={10}
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={patientGender} onChange={e => setPatientGender(e.target.value)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Age</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <input 
                    value={ageYears} 
                    onChange={e => handleYearsChange(e.target.value)} 
                    required={!ageMonths} 
                    placeholder="Years" 
                    type="number" 
                    min="0"
                  />
                  <input 
                    value={ageMonths} 
                    onChange={e => handleMonthsChange(e.target.value)} 
                    placeholder="Months" 
                    type="number" 
                    min="0"
                    max="11"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3><CreditCard size={18} /> Appointment Details</h3>
            <div className="field-grid">
              <div className="form-group">
                <label>Consulting Doctor</label>
                <select value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)} required>
                  <option value="">Select Doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Receipt #</label>
                <input value={receiptNumber} readOnly disabled />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input 
                  type="date" 
                  value={appointmentDate} 
                  onChange={e => setAppointmentDate(e.target.value)} 
                />
              </div>
              <div className="form-group full-width" style={{ gridColumn: 'span 2' }}>
                <label>Payment Mode</label>
                <div className="payment-method-toggle">
                  <button 
                    type="button" 
                    className={paymentMethod === 'CASH' ? 'active' : ''} 
                    onClick={() => setPaymentMethod('CASH')}
                  >
                    CASH
                  </button>
                  <button 
                    type="button" 
                    className={paymentMethod === 'ONLINE' ? 'active' : ''} 
                    onClick={() => setPaymentMethod('ONLINE')}
                  >
                    ONLINE
                  </button>
                  <button 
                    type="button" 
                    className={paymentMethod === 'FREE' ? 'active' : ''} 
                    onClick={() => setPaymentMethod('FREE')}
                  >
                    FREE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Options & Preview Card */}
        <div className="card qr-code-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showQrCode ? '0.85rem' : 0 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>
              <QrCode size={18} color="var(--primary)" /> Receipt QR Code
            </h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
              <input 
                type="checkbox" 
                checked={showQrCode} 
                onChange={e => setShowQrCode(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              Show QR Code on Receipt
            </label>
          </div>

          {showQrCode && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className={`btn-subtle ${qrMode === 'UPI' ? 'active' : ''}`}
                    onClick={() => setQrMode('UPI')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: qrMode === 'UPI' ? 'var(--primary)' : '#cbd5e1',
                      background: qrMode === 'UPI' ? 'var(--primary)' : '#ffffff',
                      color: qrMode === 'UPI' ? '#ffffff' : '#334155',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Dynamic UPI Payment
                  </button>
                  <button 
                    type="button" 
                    className={`btn-subtle ${qrMode === 'CUSTOM' ? 'active' : ''}`}
                    onClick={() => setQrMode('CUSTOM')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: qrMode === 'CUSTOM' ? 'var(--primary)' : '#cbd5e1',
                      background: qrMode === 'CUSTOM' ? 'var(--primary)' : '#ffffff',
                      color: qrMode === 'CUSTOM' ? '#ffffff' : '#334155',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Custom Text / Link
                  </button>
                </div>

                {qrMode === 'UPI' ? (
                  <div>
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 0.35rem 0' }}>
                      {selectedDoctor?.upiId ? (
                        <>Doctor UPI: <strong>{selectedDoctor.upiId}</strong> (Bill Total: ₹{total.toFixed(2)})</>
                      ) : (
                        <span style={{ color: '#d97706', fontWeight: 500 }}>No UPI ID set for {selectedDoctor?.name || 'doctor'}. Enter VPA below or configure in Doctor Management.</span>
                      )}
                    </p>
                    {(!selectedDoctor?.upiId || customQrInput) && (
                      <input 
                        type="text" 
                        placeholder="Enter UPI VPA (e.g. 9876543210@upi)" 
                        value={customQrInput} 
                        onChange={e => setCustomQrInput(e.target.value)} 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    )}
                  </div>
                ) : (
                  <input 
                    type="text" 
                    placeholder="Enter URL or payload for QR Code (e.g. https://clinic.com)" 
                    value={customQrInput} 
                    onChange={e => setCustomQrInput(e.target.value)} 
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  />
                )}
              </div>

              <div style={{ textAlign: 'center', background: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {effectiveQrText ? (
                  <>
                    <QRCodeImage text={effectiveQrText} size={75} />
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>Live QR Preview</span>
                  </>
                ) : (
                  <div style={{ width: '75px', height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.7rem', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                    Enter UPI or QR Text
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card items-card">
          <div className="items-header">
            <h3>Services & Billing</h3>
          </div>

          <div className="items-list">
            <div className="items-row header">
              <span>Description</span>
              <span>Amount</span>
              <span>Action</span>
            </div>
            {items.map(item => {
              const filteredServices = availableServices.filter(s =>
                s.serviceType !== 'FACILITY' &&
                !['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment'].includes(s.category || '') &&
                !s.id?.startsWith('fac_') &&
                s.name.toLowerCase().includes((item.description || '').toLowerCase())
              );

              return (
                <div key={item.id} className="items-row">
                  <div className="description-selector">
                    <input 
                      value={item.description} 
                      onChange={e => {
                        updateItem(item.id, 'description', e.target.value);
                        setActiveDropdownId(item.id);
                      }} 
                      onFocus={() => setActiveDropdownId(item.id)}
                      onBlur={() => setTimeout(() => setActiveDropdownId(null), 200)}
                      placeholder="e.g. Blood Test"
                      required
                      autoComplete="off"
                    />
                    {activeDropdownId === item.id && filteredServices.length > 0 && (
                      <div className="custom-services-dropdown">
                        {filteredServices.map(s => (
                          <div 
                            key={s.id} 
                            className="dropdown-service-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              updateItem(item.id, 'description', s.name);
                              setActiveDropdownId(null);
                            }}
                          >
                            <span className="service-name">{s.name}</span>
                            <span className="service-amount">₹{s.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input 
                    type="number" 
                    value={item.amount} 
                    onChange={e => updateItem(item.id, 'amount', Number(e.target.value))} 
                    placeholder="0.00"
                    required
                  />
                  <button type="button" onClick={() => removeItem(item.id)} className="btn-icon text-danger">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            <div className="items-footer no-print">
              <button type="button" className="btn-secondary add-item-btn" onClick={addItem}>
                <Plus size={16} /> Add Another Service
              </button>
            </div>
          </div>

          <div className="total-section">
            <div className="total-row">
              <span>Subtotal</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
              <span>Total Amount</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {saveError && (
          <div className="error-message" style={{ color: 'red', marginTop: '1rem', padding: '0.5rem', background: '#ffebee', borderRadius: '4px', border: '1px solid #ffcdd2' }}>
            <AlertCircle size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
            {saveError}
          </div>
        )}

        <div className="form-submit-actions no-print">
          <button type="button" className="btn-secondary-lg" onClick={(e) => handleSave(e, false, false)}>
            <Save size={18} />
            Save Only
          </button>
          <button type="button" className="btn-whatsapp-lg" onClick={(e) => handleSave(e, false, true)} title="Save receipt and send to patient on WhatsApp">
            <MessageSquare size={18} />
            Save &amp; Send WhatsApp
          </button>
          <button type="button" className="btn-primary-lg" onClick={(e) => handleSave(e, true, false)} title="Save receipt and print physical copy">
            <Printer size={18} />
            Save &amp; Print
          </button>
          <button type="button" className="btn-combo-lg" onClick={(e) => handleSave(e, true, true)} title="Save, Print Receipt &amp; Send via WhatsApp">
            <Send size={18} />
            Save, Print &amp; WhatsApp
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReceiptForm;
