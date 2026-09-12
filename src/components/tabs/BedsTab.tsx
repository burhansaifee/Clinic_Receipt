import React, { useState, useEffect, useMemo } from 'react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import {
  Bed, Plus, Search, Clock,
  CheckCircle, RefreshCw, Activity,
  ArrowRightLeft, LogOut,
  Heart, Sparkles, Building2, User, Check, Stethoscope,
  DollarSign, ChevronDown, X, Trash2, PackageCheck,
  Receipt as ReceiptIcon, Pill, FileText
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import '../../styles/tabs/BedsTab.css';
import { EmarNursingModal } from './inpatient/EmarNursingModal';
import { DischargeSummaryModal } from './inpatient/DischargeSummaryModal';
import {
  storage,
  notifyDataChanged,
  formatAgeGender,
  type Ward,
  type HospitalBed,
  type BedAdmission,
  type AdmissionCharge,
  type IpdDashboardMetrics,
  type Doctor,
  type Service,
  type Receipt
} from '../../lib/storage';

interface BedsTabProps {
  doctors: Doctor[];
  onNavigateToBilling?: (admission: BedAdmission) => void;
  onNavigateToCensus?: () => void;
}

export const BedsTab: React.FC<BedsTabProps> = ({
  doctors,
  onNavigateToBilling,
  onNavigateToCensus
}) => {
  const toast = useToast();
  const confirm = useConfirm();

  // Navigation & View States
  const [activeView, setActiveView] = useState<'floorplan' | 'wards'>('floorplan');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [_isLoading, setIsLoading] = useState(true);

  // Core Data States
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<HospitalBed[]>([]);
  const [admissions, setAdmissions] = useState<BedAdmission[]>([]);
  const [metrics, setMetrics] = useState<IpdDashboardMetrics>({
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    cleaningBeds: 0,
    maintenanceBeds: 0,
    occupancyRate: 0,
    admissionsTodayCount: 0,
    dischargesTodayCount: 0
  });

  // Modal States
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [selectedBedForDetails, setSelectedBedForDetails] = useState<HospitalBed | null>(null);
  const [activeAdmissionRecord, setActiveAdmissionRecord] = useState<BedAdmission | null>(null);
  const [detailsActiveTab, setDetailsActiveTab] = useState<'overview' | 'vitals' | 'transfer' | 'discharge'>('overview');
  const [selectedBedForEmar, setSelectedBedForEmar] = useState<HospitalBed | null>(null);
  const [activeAdmissionForEmar, setActiveAdmissionForEmar] = useState<BedAdmission | null>(null);
  const [admissionForDischargeSummary, setAdmissionForDischargeSummary] = useState<BedAdmission | null>(null);

  // Ward / Bed Config Modal State
  const [showWardModal, setShowWardModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [newWardData, setNewWardData] = useState({
    name: '',
    code: '',
    floor: 'Ground Floor',
    dailyRate: 1000,
    nursingRate: 200,
    description: ''
  });
  const [newBedData, setNewBedData] = useState({
    wardId: '',
    bedNumber: '',
    bedType: 'Standard Fowler',
    dailyRate: 1000,
    notes: ''
  });

  // Admission Form State
  const [admissionForm, setAdmissionForm] = useState({
    patientId: '',
    patientUhid: '',
    patientName: '',
    patientPhone: '',
    patientAge: '35',
    patientGender: 'Male',
    wardId: '',
    bedId: '',
    doctorId: doctors[0]?.id || '',
    admittedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    expectedDischargeAt: '',
    diagnosis: '',
    advancePaid: 0,
    paymentMode: 'CASH' as 'CASH' | 'ONLINE' | 'UPI' | 'CARD',
    notes: '',
    bpSystolic: '120',
    bpDiastolic: '80',
    pulse: '72',
    temp: '98.6',
    spo2: '99',
    respiratoryRate: '18'
  });

  // Patient Search for Admission Autocomplete
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [existingPatientsSuggestions, setExistingPatientsSuggestions] = useState<any[]>([]);


  // Hospital Central Master Tariff Catalog
  const [hospitalServices, setHospitalServices] = useState<Service[]>([]);

  // Ward In-Charge Consumables & Care Billing Form
  const [chargeForm, setChargeForm] = useState<{
    serviceId?: string;
    category: 'Nursing' | 'Consumable' | 'Procedure' | 'Doctor Round' | 'Equipment / Oxygen' | 'Other';
    description: string;
    quantity: number;
    rate: number;
    notes?: string;
    isCustomRate?: boolean;
  }>({
    serviceId: '',
    category: 'Consumable',
    description: '',
    quantity: 1,
    rate: 100,
    notes: '',
    isCustomRate: false
  });

  // Dynamic Quick Add Presets pulled directly from Clinic Services Catalog Database (No Hardcoded Items)
  const quickWardServices = useMemo(() => {
    // Filter out room rent services (room rent is tracked daily on bed stay)
    const nonRoomServices = hospitalServices.filter(s =>
      !(s.category || '').toLowerCase().includes('room rent') &&
      !(s.name || '').toLowerCase().includes('ward bed') &&
      !(s.name || '').toLowerCase().includes('room')
    );

    // Prefer services tagged as FACILITY or with ward/clinical categories or all non-room services
    const facilityOrWard = nonRoomServices.filter(s =>
      s.serviceType === 'FACILITY' ||
      ['nursing', 'consumable', 'procedure', 'doctor', 'round', 'oxygen', 'equipment', 'injection', 'dressing', 'test', 'monitor'].some(k =>
        (s.category || '').toLowerCase().includes(k) || (s.name || '').toLowerCase().includes(k)
      )
    );

    const candidates = facilityOrWard.length > 0 ? facilityOrWard : nonRoomServices;

    return candidates.map(svc => {
      let mappedCat: 'Nursing' | 'Consumable' | 'Procedure' | 'Doctor Round' | 'Equipment / Oxygen' | 'Other' = 'Consumable';
      const cLower = ((svc.category || '') + ' ' + (svc.name || '')).toLowerCase();
      if (cLower.includes('nurs')) mappedCat = 'Nursing';
      else if (cLower.includes('proc') || cLower.includes('ecg') || cLower.includes('tube') || cLower.includes('cannula') || cLower.includes('catheter')) mappedCat = 'Procedure';
      else if (cLower.includes('round') || cLower.includes('doctor') || cLower.includes('visit') || cLower.includes('consult') || cLower.includes('rmo')) mappedCat = 'Doctor Round';
      else if (cLower.includes('oxy') || cLower.includes('equip') || cLower.includes('monitor') || cLower.includes('pump') || cLower.includes('nebuliz')) mappedCat = 'Equipment / Oxygen';
      else if (cLower.includes('consum') || cLower.includes('med') || cLower.includes('saline') || cLower.includes('kit') || cLower.includes('dressing')) mappedCat = 'Consumable';

      return {
        id: svc.id,
        description: svc.name,
        category: mappedCat,
        rate: Number(svc.amount) || 0,
        unit: svc.unit
      };
    });
  }, [hospitalServices]);

  // Handler to pick a service from Hospital Master Tariff Catalog (locking rates)
  const handleSelectMasterService = (serviceId: string) => {
    if (!serviceId) {
      setChargeForm(prev => ({
        ...prev,
        serviceId: '',
        isCustomRate: true
      }));
      return;
    }

    const svc = hospitalServices.find(s => s.id === serviceId);
    if (svc) {
      let mappedCat: 'Nursing' | 'Consumable' | 'Procedure' | 'Doctor Round' | 'Equipment / Oxygen' | 'Other' = 'Consumable';
      const cLower = (svc.category || '').toLowerCase();
      if (cLower.includes('nurs')) mappedCat = 'Nursing';
      else if (cLower.includes('proc')) mappedCat = 'Procedure';
      else if (cLower.includes('round') || cLower.includes('doctor') || cLower.includes('visit')) mappedCat = 'Doctor Round';
      else if (cLower.includes('oxy') || cLower.includes('equip')) mappedCat = 'Equipment / Oxygen';
      else if (cLower.includes('consum') || cLower.includes('med')) mappedCat = 'Consumable';

      setChargeForm(prev => ({
        ...prev,
        serviceId: svc.id,
        category: mappedCat,
        description: svc.name,
        rate: Number(svc.amount) || 0,
        isCustomRate: false
      }));
    }
  };

  // Bed Transfer State
  const [transferDestinationBedId, setTransferDestinationBedId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Discharge State
  const [dischargeSummaryNotes, setDischargeSummaryNotes] = useState('');

  // ── Load All Data ────────────────────────────────────────────────────────────
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [w, b, a, m, s] = await Promise.all([
        storage.getWards(),
        storage.getBeds(),
        storage.getBedAdmissions({ limit: 100 }),
        storage.getIpdDashboardMetrics(),
        storage.getServices()
      ]);
      setWards(w);
      setBeds(b);
      setAdmissions(a);
      setMetrics(m);
      setHospitalServices(s || []);
    } catch (err) {
      console.error('Failed to load IPD ward and bed matrix:', err);
      toast('Failed to load bed occupancy data', { type: 'error' });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Live Inpatient Account Folio Calculation
  const folioData = useMemo(() => {
    if (!activeAdmissionRecord || !selectedBedForDetails) return null;
    const adm = activeAdmissionRecord;
    let stayDays = 1;
    if (adm.admittedAt) {
      try {
        const mins = Math.max(1, differenceInMinutes(new Date(), parseISO(adm.admittedAt)));
        stayDays = Math.max(1, Math.ceil(mins / 1440));
      } catch (_) {}
    }
    const dailyRate = Number(selectedBedForDetails.dailyRate) || 0;
    const roomRentAccrued = stayDays * dailyRate;

    let loggedCharges: AdmissionCharge[] = [];
    try {
      loggedCharges = JSON.parse(adm.wardChargesLog || '[]');
    } catch (_) {}

    const consumablesTotal = loggedCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const grossTotal = roomRentAccrued + consumablesTotal;
    const advancePaid = Number(adm.advancePaid) || 0;
    const balanceDue = Math.max(0, grossTotal - advancePaid);

    return {
      stayDays,
      dailyRate,
      roomRentAccrued,
      loggedCharges,
      consumablesTotal,
      grossTotal,
      advancePaid,
      balanceDue
    };
  }, [activeAdmissionRecord, selectedBedForDetails]);

  useEffect(() => {
    loadData();
    const handleSync = () => {
      loadData();
    };
    window.addEventListener('buvora-data-updated', handleSync);
    const interval = setInterval(loadData, 5000);
    return () => {
      window.removeEventListener('buvora-data-updated', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Update default doctor if doctors list arrives
  useEffect(() => {
    if (doctors.length > 0 && !admissionForm.doctorId) {
      setAdmissionForm(prev => ({ ...prev, doctorId: doctors[0].id }));
    }
  }, [doctors]);

  // Set default ward for bed creation
  useEffect(() => {
    if (wards.length > 0 && !newBedData.wardId) {
      setNewBedData(prev => ({ ...prev, wardId: wards[0].id, dailyRate: wards[0].dailyRate }));
    }
  }, [wards]);

  // Unified Global Patient Autocomplete Search Handler
  useEffect(() => {
    if (!patientSearchQuery.trim() || patientSearchQuery.length < 2) {
      setExistingPatientsSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const suggestions = await storage.searchGlobalPatients(patientSearchQuery);
        setExistingPatientsSuggestions(suggestions);
      } catch (err) {
        console.error('Failed to autocomplete patient:', err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [patientSearchQuery]);

  // Open Bed Details / Chart
  const handleOpenBedDetails = async (bed: HospitalBed) => {
    setSelectedBedForDetails(bed);
    setDetailsActiveTab('overview');
    if (bed.currentAdmissionId) {
      const found = admissions.find(a => a.id === bed.currentAdmissionId);
      if (found) {
        setActiveAdmissionRecord(found);
      } else {
        const fetched = await storage.getBedAdmissions({ status: 'admitted' });
        const match = fetched.find(a => a.id === bed.currentAdmissionId);
        setActiveAdmissionRecord(match || null);
      }
    } else {
      setActiveAdmissionRecord(null);
    }
  };

  // Open Quick Admission for a vacant bed
  const handleQuickAdmitClick = async (bed: HospitalBed) => {
    let nextPid = '';
    try {
      nextPid = await storage.getNextPatientId();
    } catch (_) {
      nextPid = `PID-${Date.now().toString().slice(-4)}`;
    }

    setAdmissionForm({
      patientId: nextPid,
      patientUhid: nextPid,
      patientName: '',
      patientPhone: '',
      patientAge: '35',
      patientGender: 'Male',
      wardId: bed.wardId,
      bedId: bed.id,
      doctorId: doctors[0]?.id || '',
      admittedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      expectedDischargeAt: '',
      diagnosis: '',
      advancePaid: 0,
      paymentMode: 'CASH',
      notes: '',
      bpSystolic: '120',
      bpDiastolic: '80',
      pulse: '72',
      temp: '98.6',
      spo2: '99',
      respiratoryRate: '18'
    });
    setPatientSearchQuery('');
    setExistingPatientsSuggestions([]);
    setShowAdmissionModal(true);
  };

  // Submit Admission
  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionForm.patientName.trim()) {
      toast('Patient name is required', { type: 'error' });
      return;
    }
    if (!admissionForm.wardId || !admissionForm.bedId) {
      toast('Please select an inpatient ward and bed', { type: 'error' });
      return;
    }

    const selectedDoctor = doctors.find(d => d.id === admissionForm.doctorId);
    const selectedWard = wards.find(w => w.id === admissionForm.wardId);
    const selectedBed = beds.find(b => b.id === admissionForm.bedId);

    const initialVitals = {
      bpSystolic: admissionForm.bpSystolic,
      bpDiastolic: admissionForm.bpDiastolic,
      pulse: admissionForm.pulse,
      temp: admissionForm.temp,
      spo2: admissionForm.spo2,
      respiratoryRate: admissionForm.respiratoryRate,
      recordedAt: admissionForm.admittedAt || new Date().toISOString()
    };

    try {
      let advanceReceiptNumber: string | undefined = undefined;
      const advanceVal = Number(admissionForm.advancePaid) || 0;
      if (advanceVal > 0) {
        try {
          const nextRec = await storage.getNextReceiptNumber(false);
          const payMethod: 'CASH' | 'ONLINE' = admissionForm.paymentMode === 'CASH' ? 'CASH' : 'ONLINE';
          const advanceReceipt: Receipt = {
            id: crypto.randomUUID(),
            receiptNumber: nextRec,
            date: admissionForm.admittedAt ? format(new Date(admissionForm.admittedAt), 'yyyy-MM-dd HH:mm') : format(new Date(), 'yyyy-MM-dd HH:mm'),
            patientId: admissionForm.patientId || admissionForm.patientUhid,
            patientName: admissionForm.patientName.trim(),
            patientAge: admissionForm.patientAge,
            patientGender: admissionForm.patientGender,
            patientPhone: admissionForm.patientPhone.trim(),
            doctorId: admissionForm.doctorId,
            doctorName: selectedDoctor ? selectedDoctor.name : 'Attending Physician',
            items: [
              {
                id: crypto.randomUUID(),
                description: `IPD Advance Deposit - Bed ${selectedBed ? selectedBed.bedNumber : ''} (${selectedWard ? selectedWard.name : 'Ward'})`,
                rate: advanceVal,
                quantity: 1,
                amount: advanceVal,
                unit: 'Deposit'
              }
            ],
            total: advanceVal,
            paymentMethod: payMethod,
            billType: 'FACILITY',
            roomNumber: selectedBed ? selectedBed.bedNumber : '',
            admissionDate: admissionForm.admittedAt,
            advancePaid: advanceVal,
            discount: 0
          };
          await storage.saveReceipt(advanceReceipt);
          advanceReceiptNumber = nextRec;
        } catch (recErr) {
          console.error('Failed to create official advance deposit receipt:', recErr);
        }
      }

      const admissionNotes = [
        admissionForm.notes.trim(),
        advanceReceiptNumber ? `[Official Advance Receipt #${advanceReceiptNumber} Generated]` : ''
      ].filter(Boolean).join(' | ');

      const admission = await storage.admitPatientToBed({
        patientId: admissionForm.patientId || admissionForm.patientUhid,
        patientUhid: admissionForm.patientUhid || admissionForm.patientId,
        patientName: admissionForm.patientName.trim(),
        patientPhone: admissionForm.patientPhone.trim(),
        patientAge: admissionForm.patientAge,
        patientGender: admissionForm.patientGender,
        wardId: admissionForm.wardId,
        wardName: selectedWard ? selectedWard.name : '',
        bedId: admissionForm.bedId,
        bedNumber: selectedBed ? selectedBed.bedNumber : '',
        doctorId: admissionForm.doctorId,
        doctorName: selectedDoctor ? selectedDoctor.name : 'Attending Physician',
        admittedAt: admissionForm.admittedAt,
        expectedDischargeAt: admissionForm.expectedDischargeAt,
        diagnosis: admissionForm.diagnosis.trim(),
        advancePaid: advanceVal,
        paymentMode: admissionForm.paymentMode,
        notes: admissionNotes,
        initialVitals,
        vitalsLog: [
          {
            id: `VIT-${Date.now()}`,
            ...initialVitals,
            notes: 'Initial admission vitals'
          }
        ]
      });

      toast(`Patient ${admission.patientName} admitted to Bed ${admission.bedNumber}!${advanceReceiptNumber ? ` (Advance Receipt #${advanceReceiptNumber} issued)` : ''}`, { type: 'success' });
      notifyDataChanged('bed');
      notifyDataChanged('admission');
      setShowAdmissionModal(false);
      await loadData(true);
    } catch (err) {
      console.error('Failed to admit patient:', err);
      toast('Failed to record admission. Bed may already be occupied.', { type: 'error' });
    }
  };

  // Change Bed Status (e.g. from cleaning -> available)
  const handleUpdateBedStatus = async (bedId: string, newStatus: 'available' | 'occupied' | 'cleaning' | 'maintenance') => {
    try {
      await storage.updateBedStatus(bedId, newStatus);
      notifyDataChanged('bed');
      toast(`Bed status updated to ${newStatus}`, { type: 'success' });
      await loadData(true);
      if (selectedBedForDetails && selectedBedForDetails.id === bedId) {
        setSelectedBedForDetails(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error('Failed to update bed status:', err);
      toast('Failed to update bed status', { type: 'error' });
    }
  };


  // Add Billable Ward Consumable / Procedure / Care Charge
  const handleAddCharge = async (chargeData: {
    category: 'Nursing' | 'Consumable' | 'Procedure' | 'Doctor Round' | 'Equipment / Oxygen' | 'Other';
    description: string;
    quantity: number;
    rate: number;
    notes?: string;
  }) => {
    if (!activeAdmissionRecord) return;
    if (!chargeData.description.trim()) {
      toast('Please enter item description', { type: 'error' });
      return;
    }
    const quantity = Number(chargeData.quantity) || 1;
    const rate = Number(chargeData.rate) || 0;
    const amount = quantity * rate;
    try {
      await storage.addAdmissionCharge(activeAdmissionRecord.id, {
        category: chargeData.category,
        description: chargeData.description.trim(),
        quantity,
        rate,
        amount,
        notes: chargeData.notes || ''
      });
      toast(`Logged: ${quantity}x ${chargeData.description}`, { type: 'success' });

      // Reload fresh admissions
      const updatedAdmissions = await storage.getBedAdmissions();
      setAdmissions(updatedAdmissions);
      const fresh = updatedAdmissions.find(a => a.id === activeAdmissionRecord.id);
      if (fresh) setActiveAdmissionRecord(fresh);
      // Reset form
      setChargeForm(prev => ({ ...prev, description: '', notes: '' }));
      await loadData(true);
    } catch (err: any) {
      toast(`Failed to log charge: ${err.message}`, { type: 'error' });
    }
  };

  // Delete Logged Ward Charge
  const handleDeleteCharge = async (chargeId: string, itemName: string) => {
    if (!activeAdmissionRecord) return;
    const confirmed = await confirm(
      `Remove "${itemName}" from this patient's billable log?`,
      {
        title: 'Remove Logged Charge',
        confirmText: 'Remove',
        isDanger: true
      }
    );
    if (!confirmed) return;
    try {
      await storage.deleteAdmissionCharge(activeAdmissionRecord.id, chargeId);
      toast(`Removed ${itemName}`, { type: 'info' });
      const updatedAdmissions = await storage.getBedAdmissions();
      setAdmissions(updatedAdmissions);
      const fresh = updatedAdmissions.find(a => a.id === activeAdmissionRecord.id);
      if (fresh) setActiveAdmissionRecord(fresh);
      await loadData(true);
    } catch (err: any) {
      toast(`Failed to remove: ${err.message}`, { type: 'error' });
    }
  };

  // Execute Bed Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdmissionRecord || !transferDestinationBedId) {
      toast('Please select a target vacant bed', { type: 'error' });
      return;
    }

    const destBed = beds.find(b => b.id === transferDestinationBedId);
    if (!destBed) return;

    if (await confirm(`Transfer patient ${activeAdmissionRecord.patientName} from Bed ${activeAdmissionRecord.bedNumber} to Bed ${destBed.bedNumber} (${destBed.wardName})?`)) {
      try {
        await storage.transferPatientBed(activeAdmissionRecord.id, destBed.id, transferReason);
        toast(`Patient transferred to Bed ${destBed.bedNumber} successfully`, { type: 'success' });
        setSelectedBedForDetails(null);
        setActiveAdmissionRecord(null);
        setTransferDestinationBedId('');
        setTransferReason('');
        await loadData(true);
      } catch (err: any) {
        console.error('Bed transfer failed:', err);
        toast(err.message || 'Bed transfer failed', { type: 'error' });
      }
    }
  };

  // Discharge Patient or Queue to Facility Billing
  const handleDischargePatient = async (proceedToBilling: boolean) => {
    if (!activeAdmissionRecord) return;
    const patientName = activeAdmissionRecord.patientName;
    const bedNo = activeAdmissionRecord.bedNumber;

    if (proceedToBilling) {
      const stayDays = folioData?.stayDays || 1;
      const adv = activeAdmissionRecord.advancePaid || 0;
      const estTotal = folioData?.grossTotal || 0;
      const confirmed = await confirm(
        `Send patient ${patientName} (Bed ${bedNo}) to Facility Billing Queue?\n\n` +
        `• Auto-calculated Stay: ${stayDays} Day${stayDays > 1 ? 's' : ''}\n` +
        `• Advance Deposited: ₹${adv.toLocaleString('en-IN')}\n` +
        `• Estimated Accrued Charges: ₹${estTotal.toLocaleString('en-IN')}\n\n` +
        `This will queue the patient at the Facility Billing desk for the cashier/billing clerk to finalize itemized settlement without switching your screen.`
      );

      if (!confirmed) return;

      try {
        await storage.updateAdmissionBillingStatus(activeAdmissionRecord.id, 'QUEUED', dischargeSummaryNotes);
        toast(`Patient ${patientName} added to Facility Billing Queue. Billing desk can now settle invoice.`, { type: 'success' });
        const admissionForBilling = activeAdmissionRecord;
        setSelectedBedForDetails(null);
        setActiveAdmissionRecord(null);
        setDischargeSummaryNotes('');
        await loadData(true);
        if (onNavigateToBilling) {
          onNavigateToBilling(admissionForBilling);
        }
      } catch (err: any) {
        console.error('Failed to queue admission for billing:', err);
        toast('Failed to add patient to billing queue', { type: 'error' });
      }
      return;
    }

    if (await confirm(`Discharge patient ${patientName} from Bed ${bedNo}? Bed will be marked for sanitization.`)) {
      try {
        await storage.dischargePatientAdmission(activeAdmissionRecord.id, {
          dischargeSummary: dischargeSummaryNotes || 'Discharged in stable condition'
        });
        toast(`Patient ${patientName} discharged. Bed ${bedNo} marked for cleaning.`, { type: 'success' });
        setSelectedBedForDetails(null);
        setActiveAdmissionRecord(null);
        setDischargeSummaryNotes('');
        await loadData(true);
      } catch (err) {
        console.error('Discharge failed:', err);
        toast('Failed to discharge patient', { type: 'error' });
      }
    }
  };

  // Save New Ward
  const handleSaveWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWardData.name.trim() || !newWardData.code.trim()) {
      toast('Ward name and short code are required', { type: 'error' });
      return;
    }
    try {
      const wardId = `WARD-${newWardData.code.toUpperCase().replace(/\s+/g, '-')}`;
      await storage.saveWard({
        id: wardId,
        name: newWardData.name.trim(),
        code: newWardData.code.toUpperCase().trim(),
        floor: newWardData.floor.trim(),
        dailyRate: Number(newWardData.dailyRate) || 0,
        nursingRate: Number(newWardData.nursingRate) || 0,
        description: newWardData.description.trim()
      });
      toast(`Ward ${newWardData.name} created!`, { type: 'success' });
      setShowWardModal(false);
      setNewWardData({
        name: '',
        code: '',
        floor: 'Ground Floor',
        dailyRate: 1000,
        nursingRate: 200,
        description: ''
      });
      await loadData(true);
    } catch (err) {
      console.error('Failed to create ward:', err);
      toast('Failed to create ward', { type: 'error' });
    }
  };

  // Save New Bed
  const handleSaveBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBedData.wardId || !newBedData.bedNumber.trim()) {
      toast('Ward and bed number are required', { type: 'error' });
      return;
    }
    try {
      const bedId = `BED-${newBedData.bedNumber.toUpperCase().replace(/\s+/g, '-')}`;
      await storage.saveBed({
        id: bedId,
        wardId: newBedData.wardId,
        bedNumber: newBedData.bedNumber.toUpperCase().trim(),
        bedType: newBedData.bedType,
        dailyRate: Number(newBedData.dailyRate) || 0,
        status: 'available',
        notes: newBedData.notes.trim()
      });
      toast(`Bed ${newBedData.bedNumber} added successfully!`, { type: 'success' });
      setShowBedModal(false);
      setNewBedData({
        wardId: wards[0]?.id || '',
        bedNumber: '',
        bedType: 'Standard Fowler',
        dailyRate: wards[0]?.dailyRate || 1000,
        notes: ''
      });
      await loadData(true);
    } catch (err) {
      console.error('Failed to add bed:', err);
      toast('Failed to add bed', { type: 'error' });
    }
  };

  // Calculate Length of Stay Helper
  const getStayDurationString = (admittedAtStr?: string) => {
    if (!admittedAtStr) return 'Just admitted';
    try {
      const start = parseISO(admittedAtStr);
      const totalMinutes = differenceInMinutes(new Date(), start);
      if (totalMinutes < 0) return 'Just admitted';
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      if (days === 0 && hours === 0) return '< 1 hour';
      if (days === 0) return `${hours}h stay`;
      return `${days}d ${hours}h stay`;
    } catch (_) {
      return 'Active';
    }
  };

  // Filtered Beds
  const filteredBeds = useMemo(() => {
    return beds.filter(b => {
      // Ward filter
      if (selectedWardFilter !== 'ALL' && b.wardId !== selectedWardFilter) return false;
      // Status filter
      if (selectedStatusFilter !== 'ALL' && b.status !== selectedStatusFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesBed = b.bedNumber.toLowerCase().includes(q) || (b.wardName || '').toLowerCase().includes(q);
        const matchesPatient = (b.patientName || '').toLowerCase().includes(q) ||
                               (b.patientUhid || '').toLowerCase().includes(q) ||
                               (b.patientPhone || '').includes(q) ||
                               (b.doctorName || '').toLowerCase().includes(q);
        if (!matchesBed && !matchesPatient) return false;
      }
      return true;
    });
  }, [beds, selectedWardFilter, selectedStatusFilter, searchQuery]);

  // Group beds by Ward for Floor Plan view
  const bedsByWard = useMemo(() => {
    const map = new Map<string, { ward: Ward; beds: HospitalBed[] }>();
    wards.forEach(w => {
      map.set(w.id, { ward: w, beds: [] });
    });
    filteredBeds.forEach(b => {
      const entry = map.get(b.wardId);
      if (entry) {
        entry.beds.push(b);
      } else {
        const dummyWard: Ward = {
          id: b.wardId,
          name: b.wardName || 'Inpatient Ward',
          code: b.wardCode || 'WARD',
          floor: b.wardFloor || 'General',
          dailyRate: b.dailyRate,
          nursingRate: 0,
          totalBeds: 0
        };
        map.set(b.wardId, { ward: dummyWard, beds: [b] });
      }
    });
    return Array.from(map.values()).filter(group => group.beds.length > 0 || selectedWardFilter === 'ALL');
  }, [wards, filteredBeds, selectedWardFilter]);

  // Vacant beds available for admissions & transfers
  const availableBedsList = useMemo(() => {
    return beds.filter(b => b.status === 'available');
  }, [beds]);

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* ── Top Dashboard KPI Header ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}
      >
        {/* Total Capacity */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Bed size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Bed Capacity
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {metrics.totalBeds} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>Beds</span>
            </div>
          </div>
        </div>

        {/* Occupied & Rate */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <User size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Occupied ({metrics.occupancyRate}%)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b91c1c' }}>
              {metrics.occupiedBeds} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#ef4444' }}>Admitted</span>
            </div>
          </div>
        </div>

        {/* Available Vacant */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Available Vacant
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>
              {metrics.availableBeds} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#10b981' }}>Ready</span>
            </div>
          </div>
        </div>

        {/* Cleaning & Maintenance */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#fffbeb',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Sanitizing / In Care
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309' }}>
              {metrics.cleaningBeds + metrics.maintenanceBeds} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#f59e0b' }}>Beds</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Bar & Controls ───────────────────────────────────────────── */}
      <div
        style={{
          background: 'white',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem'
        }}
      >
        {/* View Switcher Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveView('floorplan')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeView === 'floorplan' ? 'white' : 'transparent',
              color: activeView === 'floorplan' ? 'var(--primary)' : '#64748b',
              boxShadow: activeView === 'floorplan' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Bed size={16} />
            Visual Floor Plan
          </button>

          <button
            onClick={() => setActiveView('wards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeView === 'wards' ? 'white' : 'transparent',
              color: activeView === 'wards' ? 'var(--primary)' : '#64748b',
              boxShadow: activeView === 'wards' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Building2 size={16} />
            Wards &amp; Rates ({wards.length})
          </button>

          {onNavigateToCensus && (
            <button
              onClick={onNavigateToCensus}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'transparent',
                color: '#64748b'
              }}
              title="Open full Inpatient Census Register"
            >
              <FileText size={16} />
              Inpatient Census
            </button>
          )}
        </div>

        {/* Right CTA buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            className="btn-secondary"
            onClick={() => loadData(true)}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh bed occupancy status"
          >
            <RefreshCw size={15} />
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowWardModal(true)}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Building2 size={15} />
            + New Ward
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowBedModal(true)}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Bed size={15} />
            + Add Bed
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              if (availableBedsList.length === 0) {
                toast('All hospital beds are currently occupied or under maintenance!', { type: 'info' });
                return;
              }
              handleQuickAdmitClick(availableBedsList[0]);
            }}
            style={{
              padding: '0.5rem 1.15rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0284c7'
            }}
          >
            <Plus size={16} />
            1-Click Bed Admission
          </button>
        </div>
      </div>

      {/* ── Filters Bar (For Floor Plan & Ledger) ────────────────────────────── */}
      {activeView !== 'wards' && (
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1rem',
            justifyContent: 'space-between'
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search Bed No, Patient Name, UHID, Doctor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                padding: '0 2rem 0 2.4rem',
                fontSize: '0.85rem',
                margin: 0,
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Ward filter selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Ward:</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedWardFilter}
                  onChange={e => setSelectedWardFilter(e.target.value)}
                  style={{
                    width: 'auto',
                    minWidth: '200px',
                    height: '40px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    margin: 0,
                    padding: '0 2.2rem 0 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    color: '#0f172a',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="ALL">All Wards ({wards.length})</option>
                  {wards.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>

            {/* Status filter selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>Status:</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  style={{
                    width: 'auto',
                    minWidth: '170px',
                    height: '40px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    margin: 0,
                    padding: '0 2.2rem 0 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    color: '#0f172a',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="available">🟢 Available (Vacant)</option>
                  <option value="occupied">🔴 Occupied (Admitted)</option>
                  <option value="cleaning">🟡 Cleaning / Sanitizing</option>
                  <option value="maintenance">⚪ Maintenance / Reserved</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View 1: Visual Floor Plan Matrix ────────────────────────────────── */}
      {activeView === 'floorplan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {bedsByWard.length === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                border: '1px dashed var(--border)',
                padding: '3.5rem 1rem',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <Bed size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No Beds Match Filter</h3>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Try clearing filters or search query.</p>
            </div>
          ) : (
            bedsByWard.map(group => {
              const totalInWard = group.beds.length;
              const occupiedInWard = group.beds.filter(b => b.status === 'occupied').length;
              const availableInWard = group.beds.filter(b => b.status === 'available').length;
              const occupancyPct = totalInWard > 0 ? Math.round((occupiedInWard / totalInWard) * 100) : 0;

              return (
                <div
                  key={group.ward.id}
                  style={{
                    background: 'white',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Ward Header */}
                  <div
                    style={{
                      padding: '0.9rem 1.25rem',
                      background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}
                      >
                        {group.ward.code}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {group.ward.name}
                          </h3>
                          <span style={{ fontSize: '0.75rem', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            {group.ward.floor}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Tariff: <strong>₹{group.ward.dailyRate}/day</strong> {group.ward.nursingRate > 0 ? `• Nursing: ₹${group.ward.nursingRate}/day` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Ward Occupancy Progress Indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.825rem', fontWeight: 700, color: occupancyPct > 80 ? '#dc2626' : 'var(--text-main)' }}>
                          {occupiedInWard} of {totalInWard} Occupied ({occupancyPct}%)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                          {availableInWard} Vacant Bed{availableInWard !== 1 ? 's' : ''}
                        </div>
                      </div>

                      <div style={{ width: '100px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${occupancyPct}%`,
                            background: occupancyPct > 85 ? '#ef4444' : occupancyPct > 50 ? '#f59e0b' : '#10b981',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ward Bed Grid */}
                  <div
                    style={{
                      padding: '1.25rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                      gap: '1rem'
                    }}
                  >
                    {group.beds.map(bed => {
                      const isOccupied = bed.status === 'occupied';
                      const isAvailable = bed.status === 'available';
                      const isCleaning = bed.status === 'cleaning';
                      const isMaintenance = bed.status === 'maintenance';

                      return (
                        <div
                          key={bed.id}
                          style={{
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            borderTop: `3px solid ${
                              isOccupied ? '#0284c7' : isAvailable ? '#10b981' : isCleaning ? '#f59e0b' : '#94a3b8'
                            }`,
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Card Header: Bed No & Status Pill */}
                          <div
                            style={{
                              padding: '0.75rem 1rem',
                              background: '#f8fafc',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Bed size={17} color={isOccupied ? '#0284c7' : isAvailable ? '#059669' : isCleaning ? '#d97706' : '#64748b'} />
                              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                                {bed.bedNumber}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {isOccupied && (() => {
                                const adm = admissions.find(a => a.id === bed.currentAdmissionId);
                                if (adm?.billingStatus === 'QUEUED') {
                                  return (
                                    <span
                                      style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        padding: '2px 7px',
                                        borderRadius: '6px',
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        border: '1px solid #fde68a',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                      title="Patient queued at Facility Billing desk"
                                    >
                                      ⚡ Queued
                                    </span>
                                  );
                                }
                                return null;
                              })()}

                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  background: isOccupied ? '#eff6ff' : isAvailable ? '#ecfdf5' : isCleaning ? '#fffbeb' : '#f1f5f9',
                                  color: isOccupied ? '#1d4ed8' : isAvailable ? '#059669' : isCleaning ? '#b45309' : '#475569',
                                  border: `1px solid ${
                                    isOccupied ? '#dbeafe' : isAvailable ? '#a7f3d0' : isCleaning ? '#fde68a' : '#e2e8f0'
                                  }`,
                                  letterSpacing: '0.3px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: isOccupied ? '#2563eb' : isAvailable ? '#10b981' : isCleaning ? '#f59e0b' : '#94a3b8'
                                  }}
                                />
                                {isOccupied ? 'Occupied' : isAvailable ? 'Vacant' : isCleaning ? 'Cleaning' : 'Maintenance'}
                              </span>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div style={{ padding: '0.85rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            {isOccupied ? (
                              <div>
                                {/* Patient particulars */}
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                                    {bed.patientName || 'Admitted Patient'}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                    <span style={{ fontWeight: 700, color: '#0284c7' }}>{bed.patientUhid || bed.patientId || 'UHID'}</span>
                                    <span>•</span>
                                    <span>{formatAgeGender(bed.patientAge, bed.patientGender)}</span>
                                    {bed.patientPhone && (
                                      <>
                                        <span>•</span>
                                        <span>{bed.patientPhone}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Clinical Meta */}
                                <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.5rem', background: '#f8fafc', padding: '6px 9px', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Stethoscope size={13} color="#0284c7" />
                                    <strong style={{ color: '#0f172a' }}>
                                      {bed.doctorName 
                                        ? (/^dr\.?\s*/i.test(bed.doctorName) ? bed.doctorName : ` ${bed.doctorName}`)
                                        : 'Attending Physician'}
                                    </strong>
                                  </div>
                                  {bed.diagnosis && (
                                    <div style={{ color: '#334155', marginTop: '2px', fontWeight: 600 }}>
                                      Dx: {bed.diagnosis}
                                    </div>
                                  )}
                                </div>

                                {/* Stay timer & advance paid pill */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#334155', fontWeight: 600, background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    <Clock size={12} color="#64748b" />
                                    {getStayDurationString(bed.admittedAt)}
                                  </span>
                                  {bed.advancePaid ? (
                                    <span style={{ color: '#047857', fontWeight: 700, background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                                      Adv: ₹{bed.advancePaid.toLocaleString('en-IN')}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ) : isAvailable ? (
                              <div style={{ padding: '0.85rem 0', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700, marginBottom: '3px' }}>
                                  Ready for Admission
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {bed.bedType} • ₹{bed.dailyRate.toLocaleString('en-IN')}/day
                                </div>
                              </div>
                            ) : isCleaning ? (
                              <div style={{ padding: '0.85rem 0', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 700, marginBottom: '3px' }}>
                                  Disinfection &amp; Linen Change
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Post-discharge sanitization in progress
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: '0.85rem 0', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700, marginBottom: '3px' }}>
                                  Under Maintenance
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {bed.notes || 'Temporarily out of service'}
                                </div>
                              </div>
                            )}

                            {/* Card Action Buttons */}
                            <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
                              {isOccupied && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {/* Row 1: Clinical Operations */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    <button
                                      onClick={() => handleOpenBedDetails(bed)}
                                      style={{
                                        padding: '0.45rem 0.5rem',
                                        background: '#0284c7',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '7px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px'
                                      }}
                                      title="Open Clinical Folio & Bed Details"
                                    >
                                      <Activity size={13} />
                                      Chart
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedBedForEmar(bed);
                                        const adm = admissions.find(a => a.id === bed.currentAdmissionId);
                                        setActiveAdmissionForEmar(adm || null);
                                      }}
                                      style={{
                                        padding: '0.45rem 0.5rem',
                                        background: '#f0f9ff',
                                        color: '#0369a1',
                                        border: '1px solid #bae6fd',
                                        borderRadius: '7px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px'
                                      }}
                                      title="Bedside eMAR & Nursing Station"
                                    >
                                      <Pill size={13} />
                                      eMAR
                                    </button>
                                  </div>

                                  {/* Row 2: Documentation & Discharge */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    <button
                                      onClick={() => {
                                        const adm = admissions.find(a => a.id === bed.currentAdmissionId);
                                        if (adm) setAdmissionForDischargeSummary(adm);
                                      }}
                                      style={{
                                        padding: '0.42rem 0.5rem',
                                        background: '#fff7ed',
                                        color: '#c2410c',
                                        border: '1px solid #fed7aa',
                                        borderRadius: '7px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px'
                                      }}
                                      title="Structured Discharge Summary & A4 Print"
                                    >
                                      <FileText size={13} />
                                      Summary
                                    </button>

                                    <button
                                      onClick={() => {
                                        handleOpenBedDetails(bed);
                                        setDetailsActiveTab('discharge');
                                      }}
                                      style={{
                                        padding: '0.42rem 0.5rem',
                                        background: '#f8fafc',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '7px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px'
                                      }}
                                      title="Discharge & Queue for Billing"
                                    >
                                      <LogOut size={13} />
                                      Discharge
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isAvailable && (
                                <button
                                  onClick={() => handleQuickAdmitClick(bed)}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    boxShadow: '0 1px 2px rgba(16,185,129,0.2)'
                                  }}
                                >
                                  <Plus size={15} />
                                  1-Click Admit Patient
                                </button>
                              )}

                              {isCleaning && (
                                <button
                                  onClick={() => handleUpdateBedStatus(bed.id, 'available')}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem',
                                    background: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  <Check size={15} />
                                  Mark Sanitized &amp; Ready
                                </button>
                              )}

                              {isMaintenance && (
                                <button
                                  onClick={() => handleUpdateBedStatus(bed.id, 'available')}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem',
                                    background: '#64748b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  <Check size={15} />
                                  Restore to Available
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── View 2: Wards & Daily Rates Catalog ──────────────────────────────── */}
      {activeView === 'wards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {wards.map(ward => {
              const bedsInWard = beds.filter(b => b.wardId === ward.id);
              const occupiedCount = bedsInWard.filter(b => b.status === 'occupied').length;

              return (
                <div
                  key={ward.id}
                  style={{
                    background: 'white',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    padding: '1.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#e0f2fe', color: '#0284c7', padding: '3px 8px', borderRadius: '6px' }}>
                        CODE: {ward.code}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {ward.floor}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      {ward.name}
                    </h3>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {ward.description || 'Hospital inpatient ward facility'}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Room Tariff</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>₹{ward.dailyRate}<span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/day</span></div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Nursing Care</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>₹{ward.nursingRate || 0}<span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/day</span></div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                      Configured Beds: <strong>{bedsInWard.length} beds</strong> ({occupiedCount} occupied)
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setNewBedData(prev => ({ ...prev, wardId: ward.id, dailyRate: ward.dailyRate }));
                        setShowBedModal(true);
                      }}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      + Add Bed to Ward
                    </button>
                    <span style={{ fontSize: '0.75rem', color: ward.isActive ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                      {ward.isActive ? '● Active Ward' : 'Inactive'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal 1: 1-Click Patient Bed Admission ─────────────────────────── */}
      {showAdmissionModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAdmissionModal(false)}
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
              maxWidth: '660px',
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'white',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              padding: '1.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bed size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Inpatient Bed Admission</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Admit patient into active hospital stay and link room charges
                  </p>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setShowAdmissionModal(false)} style={{ padding: '0.35rem 0.6rem' }}>✕</button>
            </div>

            <form onSubmit={handleAdmitSubmit}>
              {/* Existing Patient Quick-Search */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', display: 'block', marginBottom: '4px' }}>
                  🔍 Autocomplete from Existing Outpatient / Receipt Records:
                </label>
                <input
                  type="text"
                  placeholder="Type patient name, phone, or UHID..."
                  value={patientSearchQuery}
                  onChange={e => setPatientSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ margin: 0, background: 'white' }}
                />
                {existingPatientsSuggestions.length > 0 && (
                  <div style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: '6px', marginTop: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                    {existingPatientsSuggestions.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setAdmissionForm(prev => ({
                            ...prev,
                            patientId: p.patientId || prev.patientId,
                            patientUhid: p.patientId || prev.patientUhid,
                            patientName: p.patientName,
                            patientPhone: p.patientPhone || '',
                            patientAge: p.patientAge || prev.patientAge,
                            patientGender: p.patientGender || prev.patientGender
                          }));
                          setExistingPatientsSuggestions([]);
                          setPatientSearchQuery('');
                          toast(`Filled details for ${p.patientName}`, { type: 'success' });
                        }}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderBottom: '1px solid #f0fdf4', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <strong>{p.patientName} ({p.patientId || 'UHID'})</strong>
                        <span style={{ color: '#64748b' }}>{p.patientPhone} • {formatAgeGender(p.patientAge, p.patientGender)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Particulars */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Patient UHID / PID *</label>
                  <input
                    type="text"
                    required
                    value={admissionForm.patientUhid}
                    onChange={e => setAdmissionForm({ ...admissionForm, patientUhid: e.target.value, patientId: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Kumar"
                    value={admissionForm.patientName}
                    onChange={e => setAdmissionForm({ ...admissionForm, patientName: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={admissionForm.patientPhone}
                    onChange={e => setAdmissionForm({ ...admissionForm, patientPhone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Age</label>
                  <input
                    type="text"
                    placeholder="e.g. 42"
                    value={admissionForm.patientAge}
                    onChange={e => setAdmissionForm({ ...admissionForm, patientAge: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select
                    value={admissionForm.patientGender}
                    onChange={e => setAdmissionForm({ ...admissionForm, patientGender: e.target.value })}
                    className="input-field"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Bed Assignment & Physician */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Hospital Ward *</label>
                  <select
                    value={admissionForm.wardId}
                    onChange={e => {
                      const wId = e.target.value;
                      const bedsInThisWard = beds.filter(b => b.wardId === wId && b.status === 'available');
                      setAdmissionForm(prev => ({
                        ...prev,
                        wardId: wId,
                        bedId: bedsInThisWard[0]?.id || ''
                      }));
                    }}
                    className="input-field"
                  >
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>{w.name} (₹{w.dailyRate}/day)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Assigned Bed *</label>
                  <select
                    value={admissionForm.bedId}
                    onChange={e => setAdmissionForm({ ...admissionForm, bedId: e.target.value })}
                    className="input-field"
                  >
                    {beds.filter(b => b.wardId === admissionForm.wardId).map(b => (
                      <option key={b.id} value={b.id} disabled={b.status !== 'available'}>
                        {b.bedNumber} ({b.bedType}) - {b.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Attending Physician *</label>
                  <select
                    value={admissionForm.doctorId}
                    onChange={e => setAdmissionForm({ ...admissionForm, doctorId: e.target.value })}
                    className="input-field"
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Admission Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    value={admissionForm.admittedAt}
                    onChange={e => setAdmissionForm({ ...admissionForm, admittedAt: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Diagnosis */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Admitting Diagnosis / Primary Complaint</label>
                <input
                  type="text"
                  placeholder="e.g. Acute Appendicitis, Severe Dengue with Thrombocytopenia"
                  value={admissionForm.diagnosis}
                  onChange={e => setAdmissionForm({ ...admissionForm, diagnosis: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Initial Vitals at Admission */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Activity size={14} color="#0284c7" />
                  Initial Nursing Vitals at Admission:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BP (Sys / Dia)</label>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="120"
                        value={admissionForm.bpSystolic}
                        onChange={e => setAdmissionForm({ ...admissionForm, bpSystolic: e.target.value })}
                        className="input-field"
                        style={{ height: '32px', fontSize: '0.8rem', padding: '0.25rem', textAlign: 'center' }}
                      />
                      <span>/</span>
                      <input
                        type="text"
                        placeholder="80"
                        value={admissionForm.bpDiastolic}
                        onChange={e => setAdmissionForm({ ...admissionForm, bpDiastolic: e.target.value })}
                        className="input-field"
                        style={{ height: '32px', fontSize: '0.8rem', padding: '0.25rem', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pulse (bpm)</label>
                    <input
                      type="text"
                      placeholder="72"
                      value={admissionForm.pulse}
                      onChange={e => setAdmissionForm({ ...admissionForm, pulse: e.target.value })}
                      className="input-field"
                      style={{ height: '32px', fontSize: '0.8rem', padding: '0.25rem', textAlign: 'center' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Temp (°F)</label>
                    <input
                      type="text"
                      placeholder="98.6"
                      value={admissionForm.temp}
                      onChange={e => setAdmissionForm({ ...admissionForm, temp: e.target.value })}
                      className="input-field"
                      style={{ height: '32px', fontSize: '0.8rem', padding: '0.25rem', textAlign: 'center' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SpO2 (%)</label>
                    <input
                      type="text"
                      placeholder="99"
                      value={admissionForm.spo2}
                      onChange={e => setAdmissionForm({ ...admissionForm, spo2: e.target.value })}
                      className="input-field"
                      style={{ height: '32px', fontSize: '0.8rem', padding: '0.25rem', textAlign: 'center' }}
                    />
                  </div>
                </div>
              </div>

              {/* Advance Deposit */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ color: '#166534', fontWeight: 700 }}>
                      Advance Deposit Amount (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={admissionForm.advancePaid}
                      onChange={e => setAdmissionForm({ ...admissionForm, advancePaid: Number(e.target.value) })}
                      className="input-field"
                      style={{ background: 'white' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ color: '#166534', fontWeight: 700 }}>
                      Deposit Payment Mode
                    </label>
                    <select
                      value={admissionForm.paymentMode}
                      onChange={e => setAdmissionForm({ ...admissionForm, paymentMode: e.target.value as any })}
                      className="input-field"
                      style={{ background: 'white' }}
                    >
                      <option value="CASH">CASH</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="CARD">CARD</option>
                      <option value="ONLINE">ONLINE TRANSFER</option>
                    </select>
                  </div>
                </div>
                {Number(admissionForm.advancePaid) > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ReceiptIcon size={13} />
                    An official IPD Advance Deposit Receipt will be generated and booked to the hospital revenue accounts.
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAdmissionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} />
                  Confirm Bed Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Bed Stay Chart, Vitals, Transfer & Discharge ──────────── */}
      {selectedBedForDetails && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedBedForDetails(null)}
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
              maxWidth: '1020px',
              width: '95%',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: 'white',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              padding: '1.5rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#eff6ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bed size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    Bed {selectedBedForDetails.bedNumber} — Inpatient Chart
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {selectedBedForDetails.wardName} ({selectedBedForDetails.wardFloor}) • Tariff: ₹{selectedBedForDetails.dailyRate}/day
                  </div>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setSelectedBedForDetails(null)} style={{ padding: '0.35rem 0.6rem' }}>✕</button>
            </div>

            {/* In-Modal Subtabs */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => setDetailsActiveTab('overview')}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: detailsActiveTab === 'overview' ? '#0284c7' : '#f1f5f9',
                  color: detailsActiveTab === 'overview' ? 'white' : '#475569'
                }}
              >
                Patient Stay Overview
              </button>
              <button
                onClick={() => setDetailsActiveTab('vitals')}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: detailsActiveTab === 'vitals' ? '#0284c7' : '#f1f5f9',
                  color: detailsActiveTab === 'vitals' ? 'white' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <PackageCheck size={14} />
                Ward Consumables &amp; Care
              </button>

              <button
                onClick={() => {
                  setSelectedBedForEmar(selectedBedForDetails);
                  setActiveAdmissionForEmar(activeAdmissionRecord);
                }}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #bae6fd',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Pill size={14} />
                eMAR &amp; Nursing Station
              </button>

              <button
                onClick={() => {
                  if (activeAdmissionRecord) setAdmissionForDischargeSummary(activeAdmissionRecord);
                }}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: '#fff7ed',
                  color: '#c2410c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Structured Clinical Discharge Summary & A4 Print Engine"
              >
                <FileText size={14} />
                Discharge Summary
              </button>
              <button
                onClick={() => setDetailsActiveTab('transfer')}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: detailsActiveTab === 'transfer' ? '#0284c7' : '#f1f5f9',
                  color: detailsActiveTab === 'transfer' ? 'white' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowRightLeft size={14} />
                Bed Transfer
              </button>
              <button
                onClick={() => setDetailsActiveTab('discharge')}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: detailsActiveTab === 'discharge' ? '#e11d48' : '#f1f5f9',
                  color: detailsActiveTab === 'discharge' ? 'white' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <LogOut size={14} />
                Discharge &amp; Bill
              </button>
            </div>

            {/* Tab 1: Overview */}
            {detailsActiveTab === 'overview' && (
              <div>
                {/* Patient Profile Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '1.15rem', color: '#0f172a' }}>
                        {selectedBedForDetails.patientName || 'Inpatient'}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        UHID: <strong style={{ color: '#0369a1' }}>{selectedBedForDetails.patientUhid || selectedBedForDetails.patientId}</strong>
                        {selectedBedForDetails.patientPhone && ` • Phone: ${selectedBedForDetails.patientPhone}`}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} color="#64748b" /> {getStayDurationString(selectedBedForDetails.admittedAt)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', fontSize: '0.8rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Age / Gender:</div>
                      <strong>{formatAgeGender(selectedBedForDetails.patientAge, selectedBedForDetails.patientGender)}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Attending Physician:</div>
                      <strong>{selectedBedForDetails.doctorName ? (/^dr\.?\s*/i.test(selectedBedForDetails.doctorName) ? selectedBedForDetails.doctorName : ` ${selectedBedForDetails.doctorName}`) : 'Attending Physician'}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Admitted On:</div>
                      <strong>{selectedBedForDetails.admittedAt ? format(parseISO(selectedBedForDetails.admittedAt), 'dd MMM yyyy, hh:mm a') : 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                {/* Clinical Diagnosis */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Admitting Diagnosis
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                    {selectedBedForDetails.diagnosis || 'Clinical observation & inpatient care'}
                  </div>
                </div>

                {/* Latest Recorded Vitals Card */}
                {(() => {
                  let logArray: any[] = [];
                  try {
                    logArray = JSON.parse(activeAdmissionRecord?.vitalsLog || '[]');
                  } catch (_) {}
                  const latest = logArray[0];
                  if (!latest) return null;
                  return (
                    <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Heart size={14} color="#ef4444" />
                          Latest Recorded Vitals:
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {latest.recordedAt ? format(parseISO(latest.recordedAt), 'dd MMM, hh:mm a') : 'Recent'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDetailsActiveTab('vitals')}
                            style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                          >
                            View All ({logArray.length}) →
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {latest.bpSystolic && latest.bpDiastolic && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', marginRight: '4px' }}>BP:</span>
                            <strong style={{ color: '#0f172a' }}>{latest.bpSystolic}/{latest.bpDiastolic} mmHg</strong>
                          </div>
                        )}
                        {latest.pulse && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', marginRight: '4px' }}>Pulse:</span>
                            <strong style={{ color: '#0f172a' }}>{latest.pulse} bpm</strong>
                          </div>
                        )}
                        {latest.temp && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', marginRight: '4px' }}>Temp:</span>
                            <strong style={{ color: '#0f172a' }}>{latest.temp} °F</strong>
                          </div>
                        )}
                        {latest.spo2 && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', marginRight: '4px' }}>SpO2:</span>
                            <strong style={{ color: Number(latest.spo2) < 95 ? '#dc2626' : '#16a34a' }}>{latest.spo2}%</strong>
                          </div>
                        )}
                        {latest.bloodSugar && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', marginRight: '4px' }}>GRBS:</span>
                            <strong style={{ color: '#0f172a' }}>{latest.bloodSugar} mg/dL</strong>
                          </div>
                        )}
                        {latest.urineOutput && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}>
                            <span style={{ color: '#64748b', marginRight: '4px' }}>Urine:</span>
                            <strong style={{ color: '#0f172a' }}>{latest.urineOutput}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Live Inpatient Account Folio */}
                {folioData && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DollarSign size={18} color="#0284c7" />
                        <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Live Inpatient Account Folio
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: '4px' }}>
                          Stay: {folioData.stayDays} Day{folioData.stayDays > 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: '4px' }}>
                          Tariff: ₹{folioData.dailyRate}/day
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
                      <div style={{ background: 'white', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Accrued Room Rent</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                          ₹{folioData.roomRentAccrued.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                          {folioData.stayDays}d × ₹{folioData.dailyRate}
                        </div>
                      </div>

                      <div style={{ background: 'white', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Consumables &amp; Care</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                          ₹{folioData.consumablesTotal.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                          {folioData.loggedCharges.length} logged item{folioData.loggedCharges.length === 1 ? '' : 's'}
                        </div>
                      </div>

                      <div style={{ background: '#f0fdf4', padding: '0.65rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700 }}>Advance Deposit</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                          ₹{folioData.advancePaid.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#16a34a' }}>
                          Receipt Credited
                        </div>
                      </div>

                      <div style={{
                        background: folioData.balanceDue > 0 ? '#fff7ed' : '#f0fdf4',
                        padding: '0.65rem',
                        borderRadius: '8px',
                        border: `1px solid ${folioData.balanceDue > 0 ? '#fed7aa' : '#bbf7d0'}`
                      }}>
                        <div style={{ fontSize: '0.68rem', color: folioData.balanceDue > 0 ? '#c2410c' : '#166534', fontWeight: 700 }}>
                          Current Net Balance
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: folioData.balanceDue > 0 ? '#ea580c' : '#15803d', marginTop: '2px' }}>
                          ₹{folioData.balanceDue.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: folioData.balanceDue > 0 ? '#9a3412' : '#16a34a' }}>
                          {folioData.balanceDue > 0 ? 'Due at discharge' : 'Clear'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setDetailsActiveTab('transfer')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ArrowRightLeft size={15} />
                    Transfer Bed
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => setDetailsActiveTab('discharge')}
                    style={{ background: '#e11d48', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <LogOut size={15} />
                    Discharge Patient
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Ward Billing Tracker (Consumables & Care) */}
            {detailsActiveTab === 'vitals' && (
              <div>
                {/* ── Ward Care & Consumables Tracker (Auto-Billed at Discharge) ─── */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #0284c7', borderRadius: '12px', padding: '1.2rem', marginBottom: '1rem' }}>
                  {/* Header & Running Total Banner */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                        <PackageCheck size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                          Ward Consumables &amp; Care Tracker (Auto-Billed at Discharge)
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                          Items logged by ward in-charge automatically transfer into Patient's Final IPD Bill
                        </p>
                      </div>
                    </div>

                    {(() => {
                      let chargesList: AdmissionCharge[] = [];
                      try {
                        chargesList = JSON.parse(activeAdmissionRecord?.wardChargesLog || '[]');
                      } catch (_) {}
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Logged Items:</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', border: '1px solid #bae6fd', padding: '3px 10px', borderRadius: '8px' }}>
                            {chargesList.length} {chargesList.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 1-Click Quick Add Presets (Dynamically pulled from Database Services Catalog) */}
                  <div style={{ marginBottom: '1.15rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>⚡ 1-Click Quick Add Presets (Live Database Catalog):</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#64748b', textTransform: 'none' }}>
                        {quickWardServices.length} {quickWardServices.length === 1 ? 'service' : 'services'} available
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {quickWardServices.length > 0 ? (
                        quickWardServices.map((item) => (
                          <button
                            key={item.id || item.description}
                            type="button"
                            onClick={() => handleAddCharge({
                              category: item.category,
                              description: item.description,
                              quantity: 1,
                              rate: item.rate
                            })}
                            style={{
                              background: 'white',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: '#1e293b',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#0284c7';
                              e.currentTarget.style.backgroundColor = '#f0f9ff';
                              e.currentTarget.style.color = '#0284c7';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.color = '#1e293b';
                            }}
                            title={`Quick Add 1x ${item.description}`}
                          >
                            <span style={{ color: '#0284c7', fontWeight: 800 }}>+</span>
                            <span>{item.description}</span>
                          </button>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                          No services found in Clinic Services Catalog. Add services in Management &gt; Clinic Services to show 1-click buttons here.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Master Tariff Charge Entry Form */}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleAddCharge(chargeForm);
                    }}
                    style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1.15rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PackageCheck size={13} color="#0284c7" />
                        Log Care / Consumable / Procedure:
                      </div>
                      <span style={{ fontSize: '0.7rem', color: chargeForm.isCustomRate ? '#b45309' : '#0369a1', background: chargeForm.isCustomRate ? '#fef3c7' : '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        {chargeForm.isCustomRate ? '✏️ Unlisted Item' : '✓ Hospital Catalog Item'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Select from Hospital Catalog
                        </label>
                        <select
                          value={chargeForm.serviceId || (chargeForm.isCustomRate ? 'CUSTOM' : '')}
                          onChange={e => {
                            if (e.target.value === 'CUSTOM') {
                              setChargeForm(prev => ({ ...prev, serviceId: '', isCustomRate: true, description: '', rate: 0 }));
                            } else {
                              handleSelectMasterService(e.target.value);
                            }
                          }}
                          className="input-field"
                          style={{
                            height: '40px',
                            padding: '0 10px',
                            fontSize: '0.85rem',
                            lineHeight: '38px',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            width: '100%',
                            boxSizing: 'border-box',
                            margin: 0
                          }}
                        >
                          <option value="">-- Choose Catalog Service / Procedure --</option>
                          {hospitalServices.map(svc => (
                            <option key={svc.id} value={svc.id}>
                              {svc.name} {svc.category ? `(${svc.category})` : ''}
                            </option>
                          ))}
                          <option value="CUSTOM">✏️ + Custom / Unlisted Consumable or Procedure</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Category
                        </label>
                        <select
                          value={chargeForm.category}
                          onChange={e => setChargeForm({ ...chargeForm, category: e.target.value as any })}
                          className="input-field"
                          style={{
                            height: '40px',
                            padding: '0 10px',
                            fontSize: '0.85rem',
                            lineHeight: '38px',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            width: '100%',
                            boxSizing: 'border-box',
                            margin: 0
                          }}
                        >
                          <option value="Consumable">Consumable</option>
                          <option value="Nursing">Nursing Care</option>
                          <option value="Procedure">Procedure</option>
                          <option value="Doctor Round">Doctor Round</option>
                          <option value="Equipment / Oxygen">Oxygen / Equip</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '12px', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Item Description *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Inj. Pantocid 40mg IV, Dressing, etc."
                          value={chargeForm.description}
                          onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })}
                          className="input-field"
                          style={{
                            height: '40px',
                            padding: '0 12px',
                            fontSize: '0.85rem',
                            lineHeight: '38px',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            width: '100%',
                            boxSizing: 'border-box',
                            margin: 0
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={chargeForm.quantity}
                          onChange={e => setChargeForm({ ...chargeForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="input-field"
                          style={{
                            height: '40px',
                            padding: '0 8px',
                            fontSize: '0.85rem',
                            lineHeight: '38px',
                            textAlign: 'center',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            width: '100%',
                            boxSizing: 'border-box',
                            margin: 0
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-primary"
                        style={{
                          height: '40px',
                          padding: '0 1.25rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          background: '#0284c7',
                          color: '#ffffff',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Plus size={15} /> Add Item
                      </button>
                    </div>
                  </form>

                  {/* Logged Charges List Table */}
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.825rem', fontWeight: 700, color: '#1e293b' }}>
                      Logged Consumables &amp; Care Items for this Admission:
                    </h5>
                    {(() => {
                      let chargesList: AdmissionCharge[] = [];
                      try {
                        chargesList = JSON.parse(activeAdmissionRecord?.wardChargesLog || '[]');
                      } catch (_) {}

                      if (chargesList.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.825rem', background: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                            No consumables or nursing procedures logged yet. Click any 1-Click quick button or enter custom items above.
                          </div>
                        );
                      }

                      return (
                        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflowX: 'auto', background: 'white' }}>
                          <table className="data-table" style={{ width: '100%', minWidth: '720px', margin: 0, fontSize: '0.825rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                                <th style={{ width: '150px', textAlign: 'left' }}>Date &amp; Time</th>
                                <th style={{ textAlign: 'left' }}>Item Description</th>
                                <th style={{ width: '140px', textAlign: 'center' }}>Category</th>
                                <th style={{ width: '70px', textAlign: 'center' }}>Qty</th>
                                <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {chargesList.map((charge, idx) => (
                                <tr key={charge.id || idx}>
                                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                  <td style={{ whiteSpace: 'nowrap', color: '#64748b', textAlign: 'left' }}>
                                    {charge.recordedAt ? format(parseISO(charge.recordedAt), 'dd MMM, hh:mm a') : '—'}
                                  </td>
                                  <td style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{charge.description}</div>
                                    {charge.notes && <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{charge.notes}</div>}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      background: charge.category === 'Procedure' ? '#f3e8ff' :
                                                  charge.category === 'Consumable' ? '#e0f2fe' :
                                                  charge.category === 'Nursing' ? '#ccfbf1' :
                                                  charge.category === 'Doctor Round' ? '#fef3c7' : '#f1f5f9',
                                      color: charge.category === 'Procedure' ? '#7e22ce' :
                                             charge.category === 'Consumable' ? '#0369a1' :
                                             charge.category === 'Nursing' ? '#0f766e' :
                                             charge.category === 'Doctor Round' ? '#b45309' : '#475569'
                                    }}>
                                      {charge.category}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{charge.quantity}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCharge(charge.id, charge.description)}
                                      style={{
                                        background: '#fee2e2',
                                        border: 'none',
                                        color: '#ef4444',
                                        padding: '4px 6px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title="Remove item"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Bed Transfer */}
            {detailsActiveTab === 'transfer' && (
              <form onSubmit={handleTransferSubmit}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#15803d', marginBottom: '4px' }}>
                    Current Location: Bed {selectedBedForDetails.bedNumber} ({selectedBedForDetails.wardName})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#166534' }}>
                    Transferring patient will immediately free up Bed {selectedBedForDetails.bedNumber} (marking it for sanitization) and assign the patient to the target vacant bed.
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Destination Vacant Bed *</label>
                  <select
                    required
                    value={transferDestinationBedId}
                    onChange={e => setTransferDestinationBedId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">-- Choose Vacant Bed Across Hospital --</option>
                    {availableBedsList.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bedNumber} — {b.wardName} ({b.bedType} • ₹{b.dailyRate}/day)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Reason for Transfer / Clinical Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Patient shifted from ICU to General Ward upon stabilization"
                    value={transferReason}
                    onChange={e => setTransferReason(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setDetailsActiveTab('overview')}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!transferDestinationBedId}
                    style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ArrowRightLeft size={16} />
                    Confirm Bed Transfer
                  </button>
                </div>
              </form>
            )}

            {/* Tab 4: Discharge & Facility Billing */}
            {detailsActiveTab === 'discharge' && (
              <div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
                    Patient Discharge &amp; Financial Settlement
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                    Discharging will release Bed {selectedBedForDetails.bedNumber} into sanitization mode. Linking to Facility Billing reconciles all room rent days, logged consumables, and advance deposits into the final official bill.
                  </div>
                </div>

                {/* Pre-Discharge Financial Clearance Summary */}
                {folioData && (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ReceiptIcon size={16} color="#0284c7" />
                        Pre-Discharge Financial Clearance Summary
                      </span>
                      <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>
                        Stay Duration: {folioData.stayDays} Day{folioData.stayDays > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#475569' }}>Room Rent Accrued ({folioData.stayDays} day{folioData.stayDays > 1 ? 's' : ''} @ ₹{folioData.dailyRate}/day):</span>
                        <strong style={{ color: '#0f172a' }}>₹{folioData.roomRentAccrued.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#475569' }}>Ward Consumables &amp; Care ({folioData.loggedCharges.length} logged items):</span>
                        <strong style={{ color: '#0f172a' }}>₹{folioData.consumablesTotal.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>Total Gross Bill Accrued:</span>
                        <strong style={{ fontWeight: 800, color: '#0f172a' }}>₹{folioData.grossTotal.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #bbf7d0', background: '#f0fdf4' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Less: Advance Deposit Credited:</span>
                        <strong style={{ color: '#15803d' }}>-₹{folioData.advancePaid.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: folioData.balanceDue > 0 ? '#fff7ed' : '#f0fdf4' }}>
                        <span style={{ fontWeight: 800, color: folioData.balanceDue > 0 ? '#c2410c' : '#166534', fontSize: '0.9rem' }}>
                          Estimated Balance Payable at Discharge:
                        </span>
                        <strong style={{ fontWeight: 900, color: folioData.balanceDue > 0 ? '#ea580c' : '#15803d', fontSize: '1.05rem' }}>
                          ₹{folioData.balanceDue.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Clinical Discharge Summary / Advice</label>
                  <textarea
                    rows={3}
                    placeholder="Patient hemodynamically stable. Advised oral medications and revisit in 7 days..."
                    value={dischargeSummaryNotes}
                    onChange={e => setDischargeSummaryNotes(e.target.value)}
                    className="input-field"
                  />
                </div>

                {activeAdmissionRecord?.billingStatus === 'QUEUED' && (
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.825rem',
                    fontWeight: 600
                  }}>
                    <Clock size={16} color="#d97706" />
                    <span>Patient is currently in the <strong>Facility Billing Queue</strong> awaiting cashier settlement.</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  {/* Primary Option: Queue to Facility Billing */}
                  <button
                    type="button"
                    onClick={() => handleDischargePatient(true)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(to right, #0284c7, #0d9488)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 6px -1px rgba(2,132,199,0.2)'
                    }}
                  >
                    <DollarSign size={18} />
                    {activeAdmissionRecord?.billingStatus === 'QUEUED'
                      ? 'Re-confirm / Update in Facility Billing Queue'
                      : 'Proceed to Itemized Facility Billing (Send to Billing Queue)'}
                  </button>

                  {/* Secondary Option: Direct Clinical Discharge */}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDischargePatient(false)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#b91c1c',
                      borderColor: '#fca5a5'
                    }}
                  >
                    Direct Clinical Discharge (Mark Bed Clean, Settle Bill Later)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal 3: Add Hospital Ward ───────────────────────────────────────── */}
      {showWardModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowWardModal(false)}
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
              maxWidth: '500px',
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
                <Building2 size={20} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add Inpatient Ward</h3>
              </div>
              <button className="btn-secondary" onClick={() => setShowWardModal(false)} style={{ padding: '0.35rem 0.6rem' }}>✕</button>
            </div>

            <form onSubmit={handleSaveWard}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Ward Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pediatric Ward"
                    value={newWardData.name}
                    onChange={e => setNewWardData({ ...newWardData, name: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PED"
                    value={newWardData.code}
                    onChange={e => setNewWardData({ ...newWardData, code: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Floor Location</label>
                <input
                  type="text"
                  placeholder="e.g. 2nd Floor - Wing C"
                  value={newWardData.floor}
                  onChange={e => setNewWardData({ ...newWardData, floor: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Daily Tariff (₹/day) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newWardData.dailyRate}
                    onChange={e => setNewWardData({ ...newWardData, dailyRate: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Nursing Charge (₹/day)</label>
                  <input
                    type="number"
                    min={0}
                    value={newWardData.nursingRate}
                    onChange={e => setNewWardData({ ...newWardData, nursingRate: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Description / Features</label>
                <input
                  type="text"
                  placeholder="e.g. Air conditioned, attached bathroom, monitor equipped"
                  value={newWardData.description}
                  onChange={e => setNewWardData({ ...newWardData, description: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowWardModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Ward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 4: Add Bed to Ward ─────────────────────────────────────────── */}
      {showBedModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowBedModal(false)}
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
              maxWidth: '500px',
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add Hospital Bed</h3>
              </div>
              <button className="btn-secondary" onClick={() => setShowBedModal(false)} style={{ padding: '0.35rem 0.6rem' }}>✕</button>
            </div>

            <form onSubmit={handleSaveBed}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Assign to Ward *</label>
                <select
                  value={newBedData.wardId}
                  onChange={e => {
                    const w = wards.find(item => item.id === e.target.value);
                    setNewBedData({
                      ...newBedData,
                      wardId: e.target.value,
                      dailyRate: w ? w.dailyRate : newBedData.dailyRate
                    });
                  }}
                  className="input-field"
                >
                  {wards.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Bed Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GW-07 or ICU-05"
                    value={newBedData.bedNumber}
                    onChange={e => setNewBedData({ ...newBedData, bedNumber: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Bed Type</label>
                  <select
                    value={newBedData.bedType}
                    onChange={e => setNewBedData({ ...newBedData, bedType: e.target.value })}
                    className="input-field"
                  >
                    <option value="Standard Fowler">Standard Fowler</option>
                    <option value="Semi-Fowler">Semi-Fowler</option>
                    <option value="ICU Electric Multi-Para">ICU Electric Multi-Para</option>
                    <option value="Motorized Deluxe Suite">Motorized Deluxe Suite</option>
                    <option value="Daycare Recliner Bed">Daycare Recliner Bed</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Daily Tariff (₹/day)</label>
                <input
                  type="number"
                  min={0}
                  value={newBedData.dailyRate}
                  onChange={e => setNewBedData({ ...newBedData, dailyRate: Number(e.target.value) })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowBedModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hospital Inpatient Nursing & eMAR Suite Modal */}
      {selectedBedForEmar && activeAdmissionForEmar && (
        <EmarNursingModal
          bed={selectedBedForEmar}
          admission={activeAdmissionForEmar}
          onClose={() => {
            setSelectedBedForEmar(null);
            setActiveAdmissionForEmar(null);
          }}
          onAdmissionUpdated={async () => {
            await loadData(true);
            if (selectedBedForEmar?.currentAdmissionId) {
              const freshAdms = await storage.getBedAdmissions({ limit: 100 });
              const updated = freshAdms.find(a => a.id === selectedBedForEmar.currentAdmissionId);
              if (updated) {
                setActiveAdmissionForEmar(updated);
                setActiveAdmissionRecord(updated);
              }
            }
          }}
        />
      )}

      {/* Structured Clinical Discharge Summary Modal */}
      {admissionForDischargeSummary && (
        <DischargeSummaryModal
          admission={admissionForDischargeSummary}
          onClose={() => setAdmissionForDischargeSummary(null)}
          onSaved={async () => {
            await loadData(true);
            if (activeAdmissionRecord && activeAdmissionRecord.id === admissionForDischargeSummary.id) {
              const freshAdms = await storage.getBedAdmissions({ limit: 100 });
              const updated = freshAdms.find(a => a.id === admissionForDischargeSummary.id);
              if (updated) setActiveAdmissionRecord(updated);
            }
          }}
        />
      )}
    </div>
  );
};
