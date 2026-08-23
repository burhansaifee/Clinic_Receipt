import React, { useState, useEffect, useRef } from 'react';
import { storage, cleanAgeString, type Doctor, type Receipt, type ReceiptItem, type Service } from '../lib/storage';
import { Plus, Trash2, Save, User, CreditCard, AlertCircle, QrCode, MessageSquare, Printer, Send } from 'lucide-react';
import { format } from 'date-fns';
import QRCodeImage from './ui/QRCodeImage';
import { useToast } from './ui/Toast';
import { sendReceiptViaWhatsApp } from '../lib/whatsappReceipt';

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
      } else {
        setReceiptNumber(initialData.receiptNumber);
      }
      setAvailableServices(await storage.getServices());
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
      const allReceipts = await storage.getReceipts();
      // Find the most recent receipt with this phone number
      const match = allReceipts.slice().reverse().find(r => r.patientPhone === value);
      
      if (match) {
        setPatientName(match.patientName);
        setPatientAge(match.patientAge);
        const { years, months } = parseAge(match.patientAge);
        setAgeYears(years);
        setAgeMonths(months);
        setPatientGender(match.patientGender);
        setIsReturningPatient(true);
        // Reset the indicator after a few seconds
        setTimeout(() => setIsReturningPatient(false), 3000);
      } else {
        setIsReturningPatient(false);
      }
    } else {
      setIsReturningPatient(false);
    }
  };

  const updateItem = (id: string, field: keyof ReceiptItem, value: string | number) => {
    const finalValue = value;
    let autoAmount: number | null = null;

    if (field === 'description' && typeof value === 'string') {
      const matched = availableServices.find(s => s.name.toLowerCase() === value.toLowerCase());
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
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      doctorId: selectedDoctorId,
      doctorName: doctor?.name || 'Unknown',
      items,
      total,
      paymentMethod,
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
              <div className="form-group">
                <label>Patient Name</label>
                <input value={patientName} onChange={e => setPatientName(e.target.value)} required placeholder="Full Name" />
              </div>
              <div className="form-group">
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
              <div className="form-group">
                <label>Gender</label>
                <select value={patientGender} onChange={e => setPatientGender(e.target.value)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="flex-label">
                  Phone Number
                  {isReturningPatient && <span className="returning-badge">Returning Patient Found!</span>}
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

      <style>{`
        .receipt-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1rem;
        }

        .form-group label {
          display: block;
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 0.35rem;
        }

        .flex-label {
          display: flex !important;
          justify-content: space-between;
          align-items: center;
        }

        .returning-badge {
          font-size: 0.65rem;
          background: #dcfce7;
          color: #166534;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fake-input {
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: #f1f5f9;
          color: var(--text-muted);
        }

        .items-card {
          padding: 2rem;
        }

        .items-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .items-row {
          display: grid;
          grid-template-columns: 3fr 1fr 50px;
          gap: 1rem;
          align-items: center;
        }

        .items-row.header {
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--text-muted);
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border);
        }

        .btn-secondary {
          background: #f1f5f9;
          color: var(--text-main);
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          border: 1px solid var(--border);
        }

        .add-item-btn {
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.25rem;
          color: var(--primary);
          background: #f0f9ff;
          border: 1px dashed var(--primary);
        }

        .add-item-btn:hover {
          background: #e0f2fe;
          border-style: solid;
        }

        .description-selector {
          position: relative;
        }

        .custom-services-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 220px;
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          padding: 4px 0;
        }

        .custom-services-dropdown::-webkit-scrollbar {
          width: 6px;
        }
        .custom-services-dropdown::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-services-dropdown::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-services-dropdown::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .dropdown-service-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6rem 0.85rem;
          cursor: pointer;
          font-size: 0.875rem;
          transition: background 0.15s ease;
        }

        .dropdown-service-item:hover {
          background: #f0f9ff;
          color: var(--primary);
        }

        .dropdown-service-item .service-name {
          font-weight: 500;
          color: var(--text-main);
        }

        .dropdown-service-item:hover .service-name {
          color: var(--primary);
        }

        .dropdown-service-item .service-amount {
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.8rem;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .items-footer {
          display: flex;
          justify-content: flex-start;
          margin-top: 0.5rem;
        }

        .total-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 2px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          width: 250px;
          color: var(--text-muted);
        }

        .grand-total {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-main);
          margin-top: 0.5rem;
        }

        .form-submit-actions {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin: 3rem 0;
        }

        .payment-method-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .payment-method-toggle button {
          padding: 0.6rem;
          border-radius: 6px;
          border: none;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: var(--text-muted);
        }

        .payment-method-toggle button.active {
          background: white;
          color: var(--primary);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .btn-primary-lg, .btn-secondary-lg, .btn-whatsapp-lg, .btn-combo-lg {
          padding: 0.85rem 1.6rem;
          font-size: 0.95rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
        }

        .btn-primary-lg {
          background: var(--primary);
          color: white;
          box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.4);
        }

        .btn-whatsapp-lg {
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: white;
          box-shadow: 0 10px 15px -3px rgba(22, 163, 74, 0.35);
        }

        .btn-combo-lg {
          background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
          color: white;
          box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.35);
        }

        .btn-secondary-lg {
          background: white;
          color: var(--text-main);
          border: 1px solid var(--border);
        }

        .btn-primary-lg:hover, .btn-secondary-lg:hover, .btn-whatsapp-lg:hover, .btn-combo-lg:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 20px -4px rgba(0, 0, 0, 0.15);
        }

        .btn-whatsapp-lg:hover {
          background: linear-gradient(135deg, #15803d 0%, #166534 100%);
          box-shadow: 0 15px 20px -4px rgba(22, 163, 74, 0.45);
        }

        .btn-combo-lg:hover {
          background: linear-gradient(135deg, #4338ca 0%, #312e81 100%);
          box-shadow: 0 15px 20px -4px rgba(79, 70, 229, 0.45);
        }

        .btn-secondary-lg:hover {
          background: #f8fafc;
          border-color: var(--primary);
          color: var(--primary);
        }

      `}</style>

    </div>
  );
};

export default ReceiptForm;
