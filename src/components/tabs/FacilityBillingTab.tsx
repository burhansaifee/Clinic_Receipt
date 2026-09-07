import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bed, Plus, Trash2, Printer, Share2, Save, RotateCcw,
  User, Activity, Sparkles, PlusCircle, X, QrCode,
  Clock, FileText, CheckCircle, AlertCircle, Search
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import type { Doctor, Receipt, ReceiptItem, Service, ClinicProfile, BedAdmission } from '../../lib/storage';
import { storage } from '../../lib/storage';
import { sendReceiptViaWhatsApp } from '../../lib/whatsappReceipt';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import '../../styles/tabs/FacilityBillingTab.css';

interface FacilityBillingTabProps {
  doctors: Doctor[];
  onSave?: () => void;
  onPrintRequest: (receipt: Receipt) => void;
  initialAdmission?: BedAdmission | null;
  onClearInitialAdmission?: () => void;
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
  initialAdmission,
  onClearInitialAdmission,
}) => {
  const toast = useToast();
  const confirm = useConfirm();
  const formRef = useRef<HTMLDivElement>(null);

  // Inpatient Bed Admission linkage & Billing Queue
  const [activeLinkedAdmission, setActiveLinkedAdmission] = useState<BedAdmission | null>(null);
  const [showInpatientSelector, setShowInpatientSelector] = useState(false);
  const [activeInpatientsList, setActiveInpatientsList] = useState<BedAdmission[]>([]);
  const [queuedInpatients, setQueuedInpatients] = useState<BedAdmission[]>([]);
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  const filteredQueuedInpatients = useMemo(() => {
    if (!queueSearchQuery.trim()) return queuedInpatients;
    const q = queueSearchQuery.toLowerCase().trim();
    return queuedInpatients.filter(adm =>
      (adm.patientName && adm.patientName.toLowerCase().includes(q)) ||
      (adm.patientUhid && adm.patientUhid.toLowerCase().includes(q)) ||
      (adm.patientId && adm.patientId.toLowerCase().includes(q)) ||
      (adm.patientPhone && adm.patientPhone.includes(q)) ||
      (adm.bedNumber && adm.bedNumber.toLowerCase().includes(q)) ||
      (adm.wardName && adm.wardName.toLowerCase().includes(q)) ||
      (adm.doctorName && adm.doctorName.toLowerCase().includes(q))
    );
  }, [queuedInpatients, queueSearchQuery]);

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

  // Hospital / Clinic Identity & UPI for facility billing
  const [clinicProfile, setClinicProfile] = useState<ClinicProfile>({
    clinicName: 'Buvora Clinic',
    clinicUpiId: '',
    showFacilityQr: true
  });
  const [customHospitalUpi, setCustomHospitalUpi] = useState('');

  // Load facility services dynamically from SQLite database
  const loadFacilityServices = async () => {
    try {
      const facilityOnly = await storage.getServices('FACILITY');
      setFacilityServices(facilityOnly);
    } catch (err) {
      console.error('Failed to load clinic facility services', err);
    }
  };

  // Load queued inpatients awaiting discharge billing settlement
  const loadQueuedInpatients = async () => {
    setIsLoadingQueue(true);
    try {
      const list = await storage.getBedAdmissions();
      const queued = list.filter((a: BedAdmission) => a.billingStatus === 'QUEUED');
      setQueuedInpatients(queued);
    } catch (err) {
      console.error('Failed to load queued inpatients:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Initialize next IDs, doctor defaults, dynamic clinic services, and pending IPD queue
  useEffect(() => {
    const init = async () => {
      try {
        const nextPid = await storage.getNextPatientId();
        setPatientId(nextPid);
        const nextRec = await storage.getNextReceiptNumber(false);
        setReceiptNumber(nextRec);
        await loadFacilityServices();
        await loadQueuedInpatients();

        // Load Clinic / Hospital profile & payment UPI QR
        const profile = await storage.getClinicProfile();
        setClinicProfile(profile);
        if (profile.clinicUpiId) {
          setCustomHospitalUpi(profile.clinicUpiId);
        }
        if (profile.showFacilityQr !== undefined) {
          setShowQrCode(profile.showFacilityQr);
        } else {
          setShowQrCode(Boolean(profile.clinicUpiId || profile.clinicQrText));
        }
      } catch (err) {
        console.error('Failed to initialize facility bill numbers', err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (doctors.length > 0 && !selectedDoctorId) {
      setSelectedDoctorId(doctors[0].id);
    }
  }, [doctors, selectedDoctorId]);

  // Load Inpatient Bed Admission into Facility Billing
  const loadAdmissionData = async (adm: BedAdmission) => {
    setActiveLinkedAdmission(adm);
    if (adm.patientUhid || adm.patientId) setPatientId(adm.patientUhid || adm.patientId || '');
    setPatientName(adm.patientName);
    if (adm.patientPhone) setPatientPhone(adm.patientPhone);
    if (adm.patientAge) {
      setPatientAge(adm.patientAge);
      const y = adm.patientAge.match(/(\d+)\s*Y/i);
      const m = adm.patientAge.match(/(\d+)\s*M/i);
      if (y) setAgeYears(y[1]);
      if (m) setAgeMonths(m[1]);
      else if (!y && !m && /^\d+$/.test(adm.patientAge)) setAgeYears(adm.patientAge);
    }
    if (adm.patientGender) setPatientGender(adm.patientGender);
    if (adm.doctorId) setSelectedDoctorId(adm.doctorId);
    setRoomNumber(`${adm.wardName} - Bed ${adm.bedNumber}`);

    const admDate = adm.admittedAt ? adm.admittedAt.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
    const admTime = adm.admittedAt && adm.admittedAt.includes('T') ? adm.admittedAt.split('T')[1].slice(0, 5) : '09:00';
    setAdmissionDate(admDate);
    setAdmissionTime(admTime);
    setDischargeDate(format(new Date(), 'yyyy-MM-dd'));
    setDischargeTime(format(new Date(), 'HH:mm'));

    if (adm.advancePaid) {
      setAdvancePaid(adm.advancePaid);
    }

    let days = 1;
    try {
      const d1 = new Date(admDate);
      const d2 = new Date();
      const diff = differenceInCalendarDays(d2, d1);
      days = diff > 0 ? diff : 1;
    } catch (_) {}

    let dailyRate = 1000;
    try {
      const wardsList = await storage.getWards();
      const matchedWard = wardsList.find(w => w.id === adm.wardId);
      if (matchedWard) dailyRate = matchedWard.dailyRate;
    } catch (_) {}

    const roomRentItem: ReceiptItem = {
      id: crypto.randomUUID(),
      description: `Room Rent: ${adm.wardName} (Bed ${adm.bedNumber}) [${days} Day${days > 1 ? 's' : ''} @ ₹${dailyRate}/day]`,
      amount: days * dailyRate,
      rate: dailyRate,
      quantity: days,
      unit: 'Days'
    };

    const billedItems: ReceiptItem[] = [roomRentItem];

    // Auto-load Ward Consumables, Procedures, and Care items logged by Ward In-Charge
    try {
      const wardCharges: any[] = JSON.parse(adm.wardChargesLog || '[]');
      if (Array.isArray(wardCharges) && wardCharges.length > 0) {
        wardCharges.forEach((c: any) => {
          billedItems.push({
            id: crypto.randomUUID(),
            description: `${c.description}${c.category ? ` (${c.category})` : ''}`,
            amount: Number(c.amount) || ((Number(c.quantity) || 1) * (Number(c.rate) || 0)),
            rate: Number(c.rate) || 0,
            quantity: Number(c.quantity) || 1,
            unit: c.unit || 'Nos'
          });
        });
      }
    } catch (_) {}

    setItems(billedItems);
    toast(`Loaded stay for ${adm.patientName} with ${billedItems.length} bill item${billedItems.length > 1 ? 's' : ''}`, { type: 'success' });
  };

  useEffect(() => {
    if (initialAdmission) {
      loadAdmissionData(initialAdmission);
    }
  }, [initialAdmission]);

  const handleLoadQueuedPatient = (admission: BedAdmission) => {
    loadAdmissionData(admission);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDismissFromQueue = async (admission: BedAdmission) => {
    if (await confirm(`Remove patient ${admission.patientName} (Bed ${admission.bedNumber}) from Facility Billing Queue?`)) {
      try {
        await storage.updateAdmissionBillingStatus(admission.id, 'NONE');
        toast(`Removed ${admission.patientName} from billing queue`, { type: 'info' });
        await loadQueuedInpatients();
      } catch (err) {
        console.error('Failed to dismiss admission from queue', err);
      }
    }
  };

  const openInpatientPicker = async () => {
    try {
      const list = await storage.getBedAdmissions({ status: 'admitted' });
      setActiveInpatientsList(list);
      setShowInpatientSelector(true);
    } catch (e) {
      console.error('Failed to load inpatients:', e);
    }
  };

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
    setActiveLinkedAdmission(null);
    if (onClearInitialAdmission) onClearInitialAdmission();
    const nextPid = await storage.getNextPatientId();
    setPatientId(nextPid);
    const nextRec = await storage.getNextReceiptNumber(false);
    setReceiptNumber(nextRec);
    await loadQueuedInpatients();
  };

  // Build receipt payload
  const buildReceiptData = (): Receipt => {
    const doctor = doctors.find(d => d.id === selectedDoctorId);
    const effectiveHospitalUpi = customHospitalUpi.trim() || clinicProfile.clinicUpiId?.trim() || '';
    const effectiveHospitalName = clinicProfile.clinicName || 'Hospital';

    let generatedQr: string | undefined = undefined;
    if (showQrCode) {
      if (effectiveHospitalUpi) {
        generatedQr = `upi://pay?pa=${encodeURIComponent(effectiveHospitalUpi)}&pn=${encodeURIComponent(effectiveHospitalName)}&am=${netBalance.toFixed(2)}&cu=INR`;
      } else if (clinicProfile.clinicQrText) {
        generatedQr = clinicProfile.clinicQrText;
      }
    }

    return {
      id: crypto.randomUUID(),
      receiptNumber,
      date: `${admissionDate} ${admissionTime}`,
      patientId: patientId.trim() || undefined,
      patientName: patientName.trim(),
      patientAge: patientAge.trim(),
      patientGender: patientGender || '',
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
      qrCodeText: generatedQr,
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
      const receipt = buildReceiptData();
      await storage.saveReceipt(receipt);

      // If this bill settles an active inpatient admission stay, link receipt and discharge patient
      if (activeLinkedAdmission) {
        try {
          await storage.dischargePatientAdmission(activeLinkedAdmission.id, {
            receiptId: receipt.id,
            dischargeSummary: remarks || `Facility billing invoice #${receipt.receiptNumber} settled`,
            billingStatus: 'BILLED'
          });
          await storage.updateAdmissionBillingStatus(activeLinkedAdmission.id, 'BILLED');
        } catch (admErr) {
          console.warn('Could not auto-close bed admission:', admErr);
        }
        await loadQueuedInpatients();
      }

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
      const receipt = buildReceiptData();
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
              onClick={openInpatientPicker}
              style={{ background: 'rgba(255, 255, 255, 0.25)', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.85rem', fontSize: '0.825rem', fontWeight: 700 }}
              title="Import Active Inpatient Stay"
            >
              <Bed size={15} /> Import Inpatient Stay
            </button>
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

      {/* ── Pending IPD Billing Queue Section ─────────────────────────────── */}
      <div
        style={{
          background: queuedInpatients.length > 0
            ? 'linear-gradient(135deg, #f0fdfa 0%, #eff6ff 100%)'
            : '#f8fafc',
          border: queuedInpatients.length > 0
            ? '1.5px solid #0284c7'
            : '1px solid var(--border)',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          boxShadow: queuedInpatients.length > 0
            ? '0 4px 12px rgba(2, 132, 199, 0.08)'
            : 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: queuedInpatients.length > 0 ? '#0284c7' : '#94a3b8',
              color: 'white',
              borderRadius: '8px',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                  IPD Discharge Billing Queue
                </strong>
                {queuedInpatients.length > 0 ? (
                  <span style={{
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '20px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    letterSpacing: '0.3px'
                  }}>
                    ⚡ {queueSearchQuery ? `${filteredQueuedInpatients.length} of ${queuedInpatients.length}` : queuedInpatients.length} Awaiting Settlement
                  </span>
                ) : (
                  <span style={{
                    background: '#e2e8f0',
                    color: '#64748b',
                    borderRadius: '20px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    Queue Empty
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1px' }}>
                {queuedInpatients.length > 0
                  ? 'Patients queued from Inpatient Census / Beds. Click "Load & Settle Bill" to populate folio.'
                  : 'No pending discharge settlements from the ward.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {queuedInpatients.length > 0 && (
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search queue (Name, UHID, Bed)..."
                  value={queueSearchQuery}
                  onChange={e => setQueueSearchQuery(e.target.value)}
                  className="input-field"
                  style={{
                    height: '30px',
                    paddingLeft: '26px',
                    paddingRight: queueSearchQuery ? '24px' : '8px',
                    fontSize: '0.75rem',
                    margin: 0,
                    borderRadius: '6px',
                    background: 'white',
                    border: '1px solid #bae6fd'
                  }}
                />
                {queueSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setQueueSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: '2px',
                      display: 'flex'
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={loadQueuedInpatients}
              disabled={isLoadingQueue}
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '30px'
              }}
              title="Check for new admissions sent from ward"
            >
              <RotateCcw size={13} className={isLoadingQueue ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {queuedInpatients.length > 0 && (
          <>
            {filteredQueuedInpatients.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '0.85rem',
                fontSize: '0.78rem',
                color: '#64748b',
                marginTop: '0.65rem',
                borderTop: '1px solid rgba(2, 132, 199, 0.15)'
              }}>
                No queued discharges match "<strong>{queueSearchQuery}</strong>".
                <button
                  type="button"
                  onClick={() => setQueueSearchQuery('')}
                  style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '0.55rem',
                marginTop: '0.65rem',
                paddingTop: '0.65rem',
                borderTop: '1px solid rgba(2, 132, 199, 0.15)',
                maxHeight: '270px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}>
                {filteredQueuedInpatients.map(adm => {
                  const isCurrentlyActive = activeLinkedAdmission?.id === adm.id;
                  let days = 1;
                  try {
                    const d1 = new Date(adm.admittedAt ? adm.admittedAt.split('T')[0] : '');
                    const d2 = new Date();
                    const diff = differenceInCalendarDays(d2, d1);
                    days = diff > 0 ? diff : 1;
                  } catch (_) {}

                  let consumablesCount = 0;
                  try {
                    const wardCharges = JSON.parse(adm.wardChargesLog || '[]');
                    if (Array.isArray(wardCharges)) consumablesCount = wardCharges.length;
                  } catch (_) {}

                  return (
                    <div
                      key={adm.id}
                      style={{
                        background: isCurrentlyActive ? '#f0fdf4' : 'white',
                        border: isCurrentlyActive ? '1.5px solid #22c55e' : '1px solid #bae6fd',
                        borderRadius: '8px',
                        padding: '0.55rem 0.75rem',
                        boxShadow: isCurrentlyActive ? '0 2px 6px rgba(34, 197, 94, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.45rem'
                      }}
                    >
                      <div>
                        {/* Top: Name + Ward Bed */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                              {adm.patientName}
                            </strong>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '6px' }}>
                              {adm.patientUhid || adm.patientId || ''}
                            </span>
                          </div>
                          <span style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {adm.wardName} - Bed {adm.bedNumber}
                          </span>
                        </div>

                        {/* Mid: Compact Inline Details */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexWrap: 'wrap',
                          fontSize: '0.7rem',
                          color: '#475569',
                          marginTop: '4px',
                          background: '#f8fafc',
                          padding: '3px 6px',
                          borderRadius: '4px'
                        }}>
                          <span><strong>{days}d</strong> stay</span>
                          <span>•</span>
                          <span style={{ color: Number(adm.advancePaid) > 0 ? '#15803d' : '#64748b', fontWeight: Number(adm.advancePaid) > 0 ? 700 : 500 }}>
                            Adv: ₹{(Number(adm.advancePaid) || 0).toLocaleString('en-IN')}
                          </span>
                          <span>•</span>
                          <span><strong>{consumablesCount}</strong> items</span>
                          {adm.doctorName && (
                            <>
                              <span>•</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={adm.doctorName}>
                                {adm.doctorName}
                              </span>
                            </>
                          )}
                        </div>

                        {adm.dischargeSummary && (
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={adm.dischargeSummary}>
                            Advice: "{adm.dischargeSummary}"
                          </div>
                        )}
                      </div>

                      {/* Bottom Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
                        <button
                          type="button"
                          onClick={() => handleLoadQueuedPatient(adm)}
                          style={{
                            flex: 1,
                            padding: '0.35rem 0.6rem',
                            background: isCurrentlyActive ? '#15803d' : '#0284c7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            height: '28px'
                          }}
                        >
                          {isCurrentlyActive ? (
                            <>
                              <CheckCircle size={12} /> Loaded
                            </>
                          ) : (
                            <>
                              <FileText size={12} /> Load &amp; Settle
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismissFromQueue(adm)}
                          title="Dismiss from queue"
                          style={{
                            padding: '0.35rem 0.5rem',
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            height: '28px'
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Linked Inpatient Stay Banner */}
      {activeLinkedAdmission && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(30,64,175,0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.25rem' }}>🛏️</span>
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Active Inpatient Stay Linked:</strong> {activeLinkedAdmission.patientName} ({activeLinkedAdmission.patientUhid || activeLinkedAdmission.patientId}) • Bed {activeLinkedAdmission.bedNumber} ({activeLinkedAdmission.wardName})
              <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '2px' }}>
                Admission Number: {activeLinkedAdmission.admissionNumber} • Advance Paid: ₹{activeLinkedAdmission.advancePaid || 0} (Settlement will close admission stay)
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveLinkedAdmission(null);
              if (onClearInitialAdmission) onClearInitialAdmission();
            }}
            style={{ background: '#dbeafe', border: 'none', color: '#1e40af', padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
          >
            ✕ Unlink
          </button>
        </div>
      )}

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

          {/* Hospital UPI QR Code toggle */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: showQrCode ? '1px solid #7dd3fc' : '1px solid var(--border)',
            padding: '0.85rem 1.15rem',
            marginBottom: '1.25rem',
            boxShadow: showQrCode ? '0 2px 8px rgba(2, 132, 199, 0.08)' : 'none'
          }}>
            <div style={{
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
                    Print Hospital / Clinic UPI QR Code on Bill
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    {(customHospitalUpi.trim() || clinicProfile.clinicUpiId) ? (
                      <>
                        Hospital UPI: <strong style={{ color: '#0284c7' }}>{customHospitalUpi.trim() || clinicProfile.clinicUpiId}</strong> ({clinicProfile.clinicName || 'Clinic'})
                      </>
                    ) : (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>
                        ⚠️ No Hospital UPI configured. Enter below to print Hospital QR.
                      </span>
                    )}
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

            {/* Quick Hospital UPI override field */}
            {showQrCode && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                  Hospital VPA:
                </span>
                <input
                  type="text"
                  value={customHospitalUpi}
                  onChange={e => setCustomHospitalUpi(e.target.value)}
                  placeholder="e.g. clinicpay@upi or 9876543210@paytm"
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc'
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary-sm"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={async () => {
                    if (!customHospitalUpi.trim()) {
                      toast('Please enter a valid Hospital UPI VPA', { type: 'error' });
                      return;
                    }
                    await storage.saveClinicProfile({ clinicUpiId: customHospitalUpi.trim() });
                    setClinicProfile(prev => ({ ...prev, clinicUpiId: customHospitalUpi.trim() }));
                    toast('Hospital UPI saved as clinic default!', { type: 'success' });
                  }}
                  title="Save this UPI ID as clinic default for future bills"
                >
                  Save as Default
                </button>
              </div>
            )}
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

      {/* Modal for Picking Active Inpatient Stay */}
      {showInpatientSelector && (
        <div
          className="modal-backdrop"
          onClick={() => setShowInpatientSelector(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '650px',
              width: '95%',
              background: 'white',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              padding: '1.5rem',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bed size={20} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Import Active Inpatient Stay</h3>
              </div>
              <button className="btn-secondary" onClick={() => setShowInpatientSelector(false)} style={{ padding: '0.35rem 0.6rem' }}>✕</button>
            </div>

            {activeInpatientsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                No patients currently admitted in inpatient beds.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
                {activeInpatientsList.map(adm => (
                  <div
                    key={adm.id}
                    onClick={() => {
                      loadAdmissionData(adm);
                      setShowInpatientSelector(false);
                    }}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: '#f8fafc'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{adm.patientName}</strong>
                        <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          Bed {adm.bedNumber}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({adm.wardName})</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        UHID: {adm.patientUhid || adm.patientId} • {adm.doctorName ? (/^dr\.?\s*/i.test(adm.doctorName) ? adm.doctorName : `Dr. ${adm.doctorName}`) : 'Attending Physician'} • Admitted: {adm.admittedAt ? format(new Date(adm.admittedAt), 'dd MMM yyyy') : 'Recently'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>
                        Adv: ₹{adm.advancePaid || 0}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700 }}>
                        Select &amp; Load →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityBillingTab;
