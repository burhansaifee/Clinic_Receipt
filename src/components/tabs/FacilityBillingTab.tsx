import React, { useState, useEffect, useRef } from 'react';
import {
  Bed, Plus, Trash2, Printer, Share2, Save, RotateCcw,
  User, Activity, Sparkles, PlusCircle, X, QrCode
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import type { Doctor, Receipt, ReceiptItem, Service } from '../../lib/storage';
import { storage } from '../../lib/storage';
import { sendReceiptViaWhatsApp } from '../../lib/whatsappReceipt';
import { useToast } from '../ui/Toast';

interface FacilityBillingTabProps {
  doctors: Doctor[];
  onSave?: () => void;
  onPrintRequest: (receipt: Receipt) => void;
}

const CATEGORY_OPTIONS = [
  'Room Rent',
  'Oxygen',
  'Nursing',
  'Doctor Rounds',
  'Equipment',
  'Procedures',
  'Consumables',
  'Other'
];

const UNIT_OPTIONS = [
  'Days',
  'Hours',
  'Cylinders',
  'Visits',
  'Procedures',
  'Sessions',
  'Tests',
  'Units'
];

export const FacilityBillingTab: React.FC<FacilityBillingTabProps> = ({
  doctors,
  onSave,
  onPrintRequest,
}) => {
  const toast = useToast();
  const formRef = useRef<HTMLDivElement>(null);

  // Dynamic Clinic Services loaded from database
  const [facilityServices, setFacilityServices] = useState<Service[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');

  // Modal for Adding a Facility Service in Clinic Services
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceAmount, setNewServiceAmount] = useState<number>(500);
  const [newServiceCategory, setNewServiceCategory] = useState<string>('Room Rent');
  const [newServiceUnit, setNewServiceUnit] = useState<string>('Days');

  // Patient particulars
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [isReturningPatient, setIsReturningPatient] = useState(false);

  // Admission & Facility details
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || '');
  const [roomNumber, setRoomNumber] = useState('');
  const [admissionDate, setAdmissionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [admissionTime, setAdmissionTime] = useState('09:00');
  const [dischargeDate, setDischargeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dischargeTime, setDischargeTime] = useState('18:00');
  const [receiptNumber, setReceiptNumber] = useState('');

  // Line items
  const [items, setItems] = useState<ReceiptItem[]>([]);

  // Financial settlement
  const [discount, setDiscount] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE' | 'FREE'>('CASH');
  const [remarks, setRemarks] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load facility services dynamically from SQLite database
  const loadFacilityServices = async () => {
    try {
      const all = await storage.getServices();
      const facilityOnly = all.filter(s =>
        s.serviceType === 'FACILITY' ||
        ['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment', 'Procedures', 'Consumables'].includes(s.category || '')
      );
      setFacilityServices(facilityOnly);
    } catch (err) {
      console.error('Failed to load clinic facility services', err);
    }
  };

  // Initialize next IDs, doctor defaults, and load dynamic clinic services
  useEffect(() => {
    const init = async () => {
      try {
        const nextPid = await storage.getNextPatientId();
        setPatientId(nextPid);
        const nextRec = await storage.getNextReceiptNumber(false);
        setReceiptNumber(nextRec);
        await loadFacilityServices();
      } catch (err) {
        console.error('Failed to initialize facility bill numbers', err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (doctors.length > 0 && !selectedDoctorId) {
      setSelectedDoctorId(doctors[0].id);
      if (doctors[0].showQrCodeOnReceipt) {
        setShowQrCode(true);
      }
    }
  }, [doctors, selectedDoctorId]);

  // Calculate calculated stay duration
  const stayDurationDays = React.useMemo(() => {
    try {
      const d1 = new Date(admissionDate);
      const d2 = new Date(dischargeDate);
      const diff = differenceInCalendarDays(d2, d1);
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }, [admissionDate, dischargeDate]);

  // Age parsing
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

  // Returning patient lookup by phone
  const handlePhoneChange = async (val: string) => {
    setPatientPhone(val);
    if (val.length === 10) {
      const match = await storage.findPatientByPhoneOrId(val);
      if (match) {
        if (match.patientId) setPatientId(match.patientId);
        setPatientName(match.patientName);
        setPatientAge(match.patientAge);
        setPatientGender(match.patientGender || 'Male');
        if (match.patientAge) {
          const y = match.patientAge.match(/(\d+)\s*Y/i);
          const m = match.patientAge.match(/(\d+)\s*M/i);
          if (y) setAgeYears(y[1]);
          if (m) setAgeMonths(m[1]);
        }
        setIsReturningPatient(true);
        setTimeout(() => setIsReturningPatient(false), 4000);
      }
    }
  };

  // Patient ID change lookup
  const handlePatientIdChange = async (val: string) => {
    setPatientId(val);
    const clean = val.trim();
    if (clean.length >= 3) {
      const match = await storage.findPatientByPhoneOrId(clean);
      if (match && match.patientId && match.patientId.toLowerCase() === clean.toLowerCase()) {
        setPatientName(match.patientName);
        if (match.patientPhone) setPatientPhone(match.patientPhone);
        setPatientAge(match.patientAge);
        setPatientGender(match.patientGender || 'Male');
        setIsReturningPatient(true);
        setTimeout(() => setIsReturningPatient(false), 4000);
      }
    }
  };

  // Add line item from dynamic clinic service
  const addServiceItem = (service: Service) => {
    let defaultQty = 1;
    if (service.unit === 'Days') {
      defaultQty = stayDurationDays;
    }

    const newItem: ReceiptItem = {
      id: crypto.randomUUID(),
      category: service.category || 'General',
      description: service.name,
      rate: service.amount,
      quantity: defaultQty,
      unit: service.unit || 'Units',
      amount: service.amount * defaultQty,
    };

    setItems(prev => [...prev, newItem]);
    toast(`Added ${service.name} (₹${service.amount}/${service.unit || 'Units'})`, { type: 'success' });
  };

  // Open modal to add a new service item
  const openAddServiceModal = () => {
    setNewServiceName('');
    setNewServiceAmount(500);
    setNewServiceCategory('Room Rent');
    setNewServiceUnit('Days');
    setIsItemModalOpen(true);
  };

  // Save new service item to Clinic Services database
  const handleSaveServiceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) {
      toast('Please enter Item Name', { type: 'error' });
      return;
    }

    const service: Service = {
      id: crypto.randomUUID(),
      name: newServiceName.trim(),
      amount: Number(newServiceAmount) || 0,
      category: newServiceCategory,
      unit: newServiceUnit,
      serviceType: 'FACILITY'
    };

    await storage.saveService(service);
    await loadFacilityServices();
    setIsItemModalOpen(false);
    toast('New Facility Item added to Clinic Services!', { type: 'success' });
  };

  // Add custom line item on the fly
  const addCustomItem = () => {
    const newItem: ReceiptItem = {
      id: crypto.randomUUID(),
      category: 'Other',
      description: 'Medical Care / Facility Service',
      rate: 500,
      quantity: 1,
      unit: 'Units',
      amount: 500,
    };
    setItems(prev => [...prev, newItem]);
  };

  // Update item field
  const updateItem = (id: string, field: keyof ReceiptItem, val: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: val };
      if (field === 'rate' || field === 'quantity') {
        const rate = field === 'rate' ? (Number(val) || 0) : (item.rate || 0);
        const qty = field === 'quantity' ? (Number(val) || 0) : (item.quantity || 1);
        updated.amount = rate * qty;
      }
      return updated;
    }));
  };

  // Remove line item
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Totals calculations
  const grossTotal = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const netBalance = React.useMemo(() => {
    const afterDiscount = Math.max(0, grossTotal - (Number(discount) || 0));
    return Math.max(0, afterDiscount - (Number(advancePaid) || 0));
  }, [grossTotal, discount, advancePaid]);

  // Reset form
  const handleReset = async () => {
    setPatientName('');
    setPatientPhone('');
    setPatientAge('');
    setAgeYears('');
    setAgeMonths('');
    setRoomNumber('');
    setItems([]);
    setDiscount(0);
    setAdvancePaid(0);
    setRemarks('');
    const nextPid = await storage.getNextPatientId();
    setPatientId(nextPid);
    const nextRec = await storage.getNextReceiptNumber(false);
    setReceiptNumber(nextRec);
  };

  // Build the receipt payload
  const buildReceiptObject = (): Receipt => {
    const doctor = doctors.find(d => d.id === selectedDoctorId);
    return {
      id: crypto.randomUUID(),
      receiptNumber,
      date: `${dischargeDate} ${dischargeTime}`,
      patientId: patientId.trim() || undefined,
      patientName: patientName.trim() || 'Patient',
      patientAge: patientAge.trim() || '30 Y',
      patientGender,
      patientPhone: patientPhone.trim(),
      doctorId: selectedDoctorId,
      doctorName: doctor?.name || 'Attending Physician',
      items,
      total: netBalance,
      paymentMethod,
      billType: 'FACILITY',
      roomNumber: roomNumber.trim() || undefined,
      admissionDate: `${admissionDate} ${admissionTime}`,
      dischargeDate: `${dischargeDate} ${dischargeTime}`,
      advancePaid: Number(advancePaid) || 0,
      discount: Number(discount) || 0,
      showQrCode,
      qrCodeText: showQrCode ? doctor?.upiId ? `upi://pay?pa=${encodeURIComponent(doctor.upiId)}&pn=${encodeURIComponent(doctor.name)}&am=${netBalance.toFixed(2)}&cu=INR` : undefined : undefined,
    };
  };

  // Save bill
  const handleSaveBill = async (andPrint: boolean = false) => {
    if (!patientName.trim()) {
      toast('Please enter Patient Name.', { type: 'error' });
      return;
    }
    if (items.length === 0) {
      toast('Please add at least one facility billing item (Room, Oxygen, etc.).', { type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const receipt = buildReceiptObject();
      await storage.saveReceipt(receipt);
      toast(`Facility Bill #${receipt.receiptNumber} saved successfully!`, { type: 'success' });

      if (andPrint) {
        onPrintRequest(receipt);
      }
      if (onSave) {
        onSave();
      }
      handleReset();
    } catch (err: any) {
      console.error('Failed to save facility bill', err);
      toast(`Failed to save bill: ${err.message}`, { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Send WhatsApp bill
  const handleWhatsApp = async () => {
    if (!patientPhone.trim()) {
      toast('Please enter a 10-digit mobile number to send WhatsApp bill.', { type: 'error' });
      return;
    }
    if (items.length === 0) {
      toast('Please add items to the bill before dispatching via WhatsApp.', { type: 'error' });
      return;
    }
    try {
      const receipt = buildReceiptObject();
      const res = await sendReceiptViaWhatsApp(receipt);
      toast(res.message || 'WhatsApp bill sent successfully!', { type: 'success' });
    } catch (e: any) {
      toast(e.message || 'Failed to dispatch WhatsApp bill.', { type: 'error' });
    }
  };

  // Category badge color
  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case 'Room Rent': return { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' };
      case 'Oxygen': return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
      case 'Nursing': return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
      case 'Doctor Rounds': return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'Equipment': return { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
      case 'Procedures': return { bg: '#ffe4e6', color: '#be123c', border: '#fecdd3' };
      default: return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  // Filtered facility services
  const displayedServices = facilityServices.filter(s => {
    if (activeCategoryFilter === 'ALL') return true;
    return s.category === activeCategoryFilter;
  });

  return (
    <div className="facility-billing-tab tab-pane no-print" ref={formRef} style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.65rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bed size={24} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Facility & Inpatient Billing
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                Itemized billing for Room Rent, Oxygen Supply, Nursing Care, Equipment & Procedures
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '0.35rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
              Bill #: <strong>#{receiptNumber}</strong>
            </div>
            <button
              className="btn-secondary"
              onClick={handleReset}
              style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
              title="Reset Form"
            >
              <RotateCcw size={14} /> Clear Form
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Left Card: Patient Particulars */}
        <div className="card" style={{ borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
            <User size={18} className="text-primary" /> Patient Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label>Patient Name *</label>
              <input
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                placeholder="Full Name"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Patient ID (UHID)</span>
                {isReturningPatient && <span className="returning-badge">Returning Patient Found!</span>}
              </label>
              <input
                value={patientId}
                onChange={e => handlePatientIdChange(e.target.value)}
                placeholder="e.g. PID-1001"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 600 }}
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                value={patientPhone}
                onChange={e => handlePhoneChange(e.target.value)}
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
              <label>Patient Age</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  value={ageYears}
                  onChange={e => handleYearsChange(e.target.value)}
                  placeholder="Years (e.g. 35)"
                  type="number"
                  min="0"
                />
                <input
                  value={ageMonths}
                  onChange={e => handleMonthsChange(e.target.value)}
                  placeholder="Months (0-11)"
                  type="number"
                  min="0"
                  max="11"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Admission & Facility Setup */}
        <div className="card" style={{ borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
            <Bed size={18} className="text-primary" /> Stay & Ward Particulars
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label>Room / Bed Number *</label>
              <input
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value)}
                placeholder="e.g. Bed 102 / Deluxe A"
                style={{ fontWeight: 600 }}
              />
            </div>

            <div className="form-group">
              <label>Attending Doctor</label>
              <select value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                {doctors.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Admission Date & Time</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.35rem' }}>
                <input
                  type="date"
                  value={admissionDate}
                  onChange={e => setAdmissionDate(e.target.value)}
                />
                <input
                  type="time"
                  value={admissionTime}
                  onChange={e => setAdmissionTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Discharge / Billing Date</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.35rem' }}>
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={e => setDischargeDate(e.target.value)}
                />
                <input
                  type="time"
                  value={dischargeTime}
                  onChange={e => setDischargeTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Calculated In-Patient Stay:</span>
                <span style={{ background: '#16a34a', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem' }}>
                  {stayDurationDays} Day{stayDurationDays > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Clinic Services / Facility Presets Banner */}
      <div className="card" style={{ marginBottom: '1.25rem', borderRadius: '12px', padding: '1.1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#0284c7" />
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#1e293b' }}>
              Clinic Services ({facilityServices.length} Items Available)
            </h4>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Stay multiplier ({stayDurationDays}d) applies to daily services
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={openAddServiceModal}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <PlusCircle size={15} /> Add Item to Services
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
          {['ALL', ...CATEGORY_OPTIONS].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategoryFilter(cat)}
              style={{
                background: activeCategoryFilter === cat ? '#0284c7' : '#f1f5f9',
                color: activeCategoryFilter === cat ? 'white' : '#475569',
                border: 'none',
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat === 'ALL' ? 'All Items' : cat}
            </button>
          ))}
        </div>

        {/* Dynamic Service Buttons Grid */}
        {displayedServices.length === 0 ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border)' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>No services found for this category.</p>
            <button
              type="button"
              onClick={openAddServiceModal}
              style={{ marginTop: '0.5rem', background: 'transparent', border: '1px solid #0284c7', color: '#0284c7', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              + Add First Item to {activeCategoryFilter === 'ALL' ? 'Clinic Services' : activeCategoryFilter}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {displayedServices.map(service => {
              const colors = getCategoryColor(service.category);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => addServiceItem(service)}
                  style={{
                    background: colors.bg,
                    color: colors.color,
                    border: `1px solid ${colors.border}`,
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  title={`Click to add ${service.name} to bill`}
                >
                  <span>+ {service.name}</span>
                  <span style={{ opacity: 0.8, fontSize: '0.72rem' }}>₹{service.amount}/{service.unit || 'Units'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Line Items Billing Table */}
      <div className="card" style={{ marginBottom: '1.25rem', borderRadius: '12px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} className="text-primary" /> Itemized Bill Breakdown ({items.length} Item{items.length !== 1 ? 's' : ''})
          </h3>
          <button
            type="button"
            className="btn-primary"
            onClick={addCustomItem}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Plus size={14} /> Add One-off Custom Item
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border)' }}>
            <Bed size={36} style={{ color: '#94a3b8', margin: '0 auto 0.5rem auto' }} />
            <p style={{ margin: 0, color: '#64748b', fontWeight: 600 }}>No facility items added yet.</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Click any of the Clinic Services buttons above (Room Rent, Oxygen, Nursing) or add new items.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', width: '130px' }}>Category</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Item Description</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', width: '130px' }}>Rate (₹)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>Qty</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', width: '110px' }}>Units</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', width: '130px' }}>Total (₹)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const colors = getCategoryColor(item.category);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span style={{
                          background: colors.bg,
                          color: colors.color,
                          border: `1px solid ${colors.border}`,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          {item.category || 'Other'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <input
                          value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Service name / item"
                          style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={item.rate || 0}
                          onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          min="0"
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                        <input
                          type="number"
                          value={item.quantity || 1}
                          onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          min="0.1"
                          step="any"
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <select
                          value={item.unit || 'Units'}
                          onChange={e => updateItem(item.id, 'unit', e.target.value)}
                          style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.825rem' }}
                        >
                          <option>Days</option>
                          <option>Hours</option>
                          <option>Cylinders</option>
                          <option>Visits</option>
                          <option>Procedures</option>
                          <option>Sessions</option>
                          <option>Units</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ₹{(Number(item.amount) || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => removeItem(item.id)}
                          title="Remove item"
                          style={{ padding: '4px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Financial Settlement & Actions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Remarks & Payment Mode */}
        <div className="card" style={{ borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', color: '#0f172a' }}>
            Payment Method & Discharge Notes
          </h4>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Payment Mode
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              gap: '4px'
            }}>
              {(['CASH', 'ONLINE', 'FREE'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMethod(mode)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '7px',
                    border: 'none',
                    fontWeight: paymentMethod === mode ? 700 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: paymentMethod === mode ? 'white' : 'transparent',
                    color: paymentMethod === mode ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: paymentMethod === mode ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {mode === 'CASH' && 'Cash'}
                  {mode === 'ONLINE' && 'Online / UPI'}
                  {mode === 'FREE' && 'Free / Waived'}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: showQrCode ? 'rgba(2, 132, 199, 0.1)' : '#f1f5f9',
                color: showQrCode ? '#0284c7' : '#64748b',
                padding: '0.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <QrCode size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  Print Dynamic UPI QR Code on Bill
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  Enables patient to scan and pay directly via GPay / PhonePe / Paytm
                </div>
              </div>
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={showQrCode}
                onChange={e => setShowQrCode(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  accentColor: 'var(--primary)',
                  cursor: 'pointer'
                }}
              />
            </label>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Discharge Advice & Remarks
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Discharged in stable condition. Patient advised complete rest for 5 days. Follow up in 7 days."
              style={{
                width: '100%',
                fontSize: '0.85rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Settlement Summary & Actions */}
        <div className="card" style={{ borderRadius: '12px', background: '#f8fafc' }}>
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', color: '#0f172a' }}>
            Bill Settlement Summary
          </h4>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
            <span style={{ color: '#64748b' }}>Gross Total:</span>
            <strong style={{ color: '#0f172a' }}>₹{grossTotal.toFixed(2)}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
            <span style={{ color: '#64748b' }}>Discount (₹):</span>
            <input
              type="number"
              value={discount}
              onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{ width: '120px', textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              min="0"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
            <span style={{ color: '#64748b' }}>Less: Advance Deposit (₹):</span>
            <input
              type="number"
              value={advancePaid}
              onChange={e => setAdvancePaid(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{ width: '120px', textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              min="0"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', marginTop: '0.5rem', background: '#e0f2fe', borderRadius: '8px', paddingInline: '1rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0369a1' }}>Net Payable Amount:</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7' }}>
              ₹{paymentMethod === 'FREE' ? '0.00' : netBalance.toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleSaveBill(true)}
              disabled={isSaving}
              style={{ padding: '0.75rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Printer size={18} /> Save & Print Facility Bill
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleWhatsApp}
                style={{ padding: '0.65rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#16a34a', borderColor: '#bbf7d0' }}
              >
                <Share2 size={16} /> Send WhatsApp
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSaveBill(false)}
                disabled={isSaving}
                style={{ padding: '0.65rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Save size={16} /> Save Only
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add or Edit Item in Clinic Services */}
      {isItemModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  Add Item to Clinic Services
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveServiceItem}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Item / Service Name *
                </label>
                <input
                  value={newServiceName}
                  onChange={e => setNewServiceName(e.target.value)}
                  placeholder="e.g. Oxygen Cylinder Refill or ICU Bed"
                  required
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Category
                  </label>
                  <select
                    value={newServiceCategory}
                    onChange={e => {
                      const cat = e.target.value;
                      setNewServiceCategory(cat);
                      if (cat === 'Room Rent' || cat === 'Nursing') setNewServiceUnit('Days');
                      else if (cat === 'Oxygen') setNewServiceUnit('Hours');
                      else if (cat === 'Doctor Rounds') setNewServiceUnit('Visits');
                      else if (cat === 'Procedures') setNewServiceUnit('Procedures');
                    }}
                    style={{ width: '100%' }}
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Billing Unit
                  </label>
                  <select
                    value={newServiceUnit}
                    onChange={e => setNewServiceUnit(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Default Rate / Amount (₹) *
                </label>
                <input
                  type="number"
                  value={newServiceAmount}
                  onChange={e => setNewServiceAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  required
                  min="0"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsItemModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={16} /> Save to Services
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityBillingTab;
