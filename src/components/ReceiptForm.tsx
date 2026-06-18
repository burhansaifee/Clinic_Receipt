import React, { useState, useEffect } from 'react';
import { storage, type Doctor, type Receipt, type ReceiptItem, type Service } from '../lib/storage';
import { Plus, Trash2, Save, User, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

interface ReceiptFormProps {
  doctors: Doctor[];
  onSave: () => void;
  initialData?: Receipt | null;
}

const parseAge = (ageStr: string) => {
  const yearsMatch = ageStr.match(/(\d+)\s*y/i);
  const monthsMatch = ageStr.match(/(\d+)\s*m/i);
  
  const years = yearsMatch ? yearsMatch[1] : '';
  const months = monthsMatch ? monthsMatch[1] : '';
  
  if (!years && !months && /^\d+$/.test(ageStr.trim())) {
    return { years: ageStr.trim(), months: '' };
  }
  
  return { years, months };
};

const ReceiptForm: React.FC<ReceiptFormProps> = ({ doctors, onSave, initialData }) => {
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
    initialData?.items || [{ id: '1', description: 'Consultation Fee', amount: 500 }]
  );
  const [receiptNumber, setReceiptNumber] = useState(initialData?.receiptNumber || '');
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [isReturningPatient, setIsReturningPatient] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE' | 'FREE'>(initialData?.paymentMethod || 'CASH');
  const [appointmentDate, setAppointmentDate] = useState(initialData?.date || format(new Date(), 'yyyy-MM-dd'));

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
      if (!initialData) {
        setReceiptNumber(await storage.getNextReceiptNumber(paymentMethod === 'FREE'));
        if (doctors.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(doctors[0].id);
        }
      }
      setAvailableServices(await storage.getServices());
    };
    init();
  }, [doctors, initialData, paymentMethod]);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', amount: 0 }]);
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
    let finalValue = value;
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

  const handleSave = async (e: React.FormEvent, shouldPrint: boolean = true) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      alert('Please select a doctor');
      return;
    }

    const doctor = doctors.find(d => d.id === selectedDoctorId);
    
    const receipt: Receipt = {
      id: initialData?.id || Date.now().toString(),
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
      paymentMethod
    };

    if (initialData) {
      await storage.updateReceipt(receipt);
    } else {
      await storage.saveReceipt(receipt);
    }
    if (shouldPrint) {
      triggerPrint(receipt);
    }
    onSave();
  };

  const triggerPrint = (_receipt: Receipt) => {
    window.print();
  };

  return (
    <div className="receipt-form-container">
      <form onSubmit={(e) => e.preventDefault()} className="receipt-form no-print">
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
            {items.map(item => (
              <div key={item.id} className="items-row">
                <div className="description-selector">
                  <input 
                    value={item.description} 
                    onChange={e => updateItem(item.id, 'description', e.target.value)} 
                    placeholder="e.g. Blood Test"
                    required
                    list={`services-list-${item.id}`}
                  />
                  <datalist id={`services-list-${item.id}`}>
                    {availableServices.map(s => (
                      <option key={s.id} value={s.name}>{s.amount}</option>
                    ))}
                  </datalist>
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
            ))}
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

        <div className="form-submit-actions no-print">
          <button type="button" className="btn-secondary-lg" onClick={(e) => handleSave(e, false)}>
            <Save size={20} />
            Save Receipt Only
          </button>
          <button type="button" className="btn-primary-lg" onClick={(e) => handleSave(e, true)}>
            <Save size={20} />
            Save & Print Receipt
          </button>
        </div>
      </form>

      {/* Hidden Print Template */}
      <div id="receipt-print-template" className="print-only">
        <div className="print-container">
          <div className="print-header">
            <div className="print-clinic-branding">
              <h2>{doctors.find(d => d.id === selectedDoctorId)?.name || 'DOCTOR NAME'}</h2>
              <p className="clinic-tagline" style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                {doctors.find(d => d.id === selectedDoctorId)?.address || 'Doctor Address goes here'}
              </p>
            </div>
            <div className="print-clinic-address">
              <p style={{ fontWeight: 700 }}>{doctors.find(d => d.id === selectedDoctorId)?.qualifications || 'Qualifications'}</p>
              <p>{doctors.find(d => d.id === selectedDoctorId)?.specialization}</p>
              <p>Ph: {doctors.find(d => d.id === selectedDoctorId)?.phone}</p>
            </div>
          </div>

          <div className="print-title-bar">
            <h1>PAYMENT RECEIPT</h1>
          </div>

          <div className="print-info-grid">
            <div className="info-section">
              <h3>PATIENT DETAILS</h3>
              <p><strong>Name:</strong> {patientName}</p>
              <p><strong>Age/Gender:</strong> {patientAge.includes('Y') || patientAge.includes('M') ? patientAge : `${patientAge}Y`} / {patientGender}</p>
              <p><strong>Phone No.:</strong> {patientPhone || 'N/A'}</p>
            </div>
            <div className="info-section">
              <h3>BILL DETAILS</h3>
              <p><strong>Receipt #:</strong> {receiptNumber}</p>
              <p><strong>Date:</strong> {(() => {
                try {
                  return format(new Date(appointmentDate), 'dd MMM yyyy');
                } catch (e) {
                  return appointmentDate || 'N/A';
                }
              })()}</p>
              <p><strong>Payment Mode:</strong> {paymentMethod}</p>
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
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.description}</td>
                  <td className="text-right">₹{(paymentMethod === 'FREE' ? 0 : item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2} className="text-right">Total Payable Amount:</th>
                <th className="text-right">₹{total.toFixed(2)}</th>
              </tr>
            </tfoot>
          </table>

          <div className="print-amount-words">
            <p><strong>Total in words:</strong> Rupee {total.toLocaleString()} Only</p>
          </div>

          <div className="print-footer">
            <div className="terms">
              <p>• This is a computer-generated receipt.</p>
              <p>• Fees once paid are non-refundable.</p>
            </div>
            <div className="signature-box">
              <div className="signature-line"></div>
              <p>Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>

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

        .btn-primary-lg, .btn-secondary-lg {
          padding: 1rem 2.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          transition: all 0.2s;
        }

        .btn-primary-lg {
          background: var(--primary);
          color: white;
          box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.4);
        }

        .btn-secondary-lg {
          background: white;
          color: var(--text-main);
          border: 1px solid var(--border);
        }

        .btn-primary-lg:hover, .btn-secondary-lg:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .btn-secondary-lg:hover {
          background: #f8fafc;
          border-color: var(--primary);
          color: var(--primary);
        }

        /* Print Specific CSS for A5 */
        @media print {
          @page {
            size: A5 portrait;
            margin: 0.8cm;
          }

          body {
            background: white !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
            width: 100%;
          }

          .print-container {
            font-family: 'Inter', sans-serif;
            color: black;
            font-size: 11pt;
            line-height: 1.4;
          }

          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid black;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }

          .print-clinic-branding h2 {
            margin: 0;
            color: black;
            font-size: 18pt;
            font-weight: 800;
          }

          .clinic-tagline {
            font-size: 9pt;
            color: black;
            margin: 0;
          }

          .print-clinic-address {
            text-align: right;
            font-size: 9pt;
            color: black;
          }

          .print-clinic-address p { margin: 0; }

          .print-title-bar {
            text-align: center;
            background: none;
            padding: 5px;
            margin-bottom: 15px;
            border: 1px solid black;
          }

          .print-title-bar h1 {
            margin: 0;
            font-size: 12pt;
            letter-spacing: 2px;
            font-weight: 700;
            color: black;
          }

          .print-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }

          .info-section h3 {
            font-size: 9pt;
            color: black;
            border-bottom: 1px solid black;
            margin-bottom: 5px;
            padding-bottom: 2px;
            font-weight: 700;
          }

          .info-section p {
            margin: 2px 0;
            font-size: 10pt;
            color: black;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }

          .print-table th {
            background: none;
            border: 1px solid black;
            padding: 6px;
            text-align: left;
            font-size: 10pt;
            color: black;
          }

          .print-table td {
            border: 1px solid black;
            padding: 6px;
            font-size: 10pt;
            color: black;
          }

          .print-table tfoot th {
            background: none;
            border: 1px solid black;
            padding: 8px;
            font-size: 11pt;
            color: black;
          }

          .text-right { text-align: right !important; }

          .print-amount-words {
            font-style: italic;
            font-size: 9pt;
            margin-bottom: 30px;
            color: black;
          }

          .print-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: auto;
          }

          .terms p {
            margin: 0;
            font-size: 8pt;
            color: black;
          }

          .signature-box {
            text-align: center;
          }

          .signature-line {
            border-top: 1px solid black;
            width: 150px;
            margin-bottom: 5px;
          }

          .signature-box p {
            margin: 0;
            font-size: 9pt;
            font-weight: 600;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptForm;
