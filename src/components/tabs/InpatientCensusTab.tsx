import React, { useState, useEffect, useMemo } from 'react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import {
  Users, Bed, BedDouble, Search, RefreshCw, Printer, Activity,
  Clock, ArrowRightLeft, LogOut, CheckCircle,
  DollarSign, Heart, Plus, Trash2, Receipt as ReceiptIcon,
  Stethoscope, ArrowUpDown, X, PackageCheck,
  Sparkles, Check, Pill, FileText
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import '../../styles/tabs/InpatientCensusTab.css';
import { EmarNursingModal } from './inpatient/EmarNursingModal';
import { DischargeSummaryModal } from './inpatient/DischargeSummaryModal';
import {
  storage,
  formatAgeGender,
  type Ward,
  type HospitalBed,
  type BedAdmission,
  type AdmissionCharge,
  type IpdDashboardMetrics,
  type Doctor,
  type Service
} from '../../lib/storage';

interface InpatientCensusTabProps {
  doctors: Doctor[];
  onNavigateToBilling?: (admission: BedAdmission) => void;
  onNavigateToBeds?: () => void;
}

export const InpatientCensusTab: React.FC<InpatientCensusTabProps> = ({
  doctors,
  onNavigateToBilling: _onNavigateToBilling,
  onNavigateToBeds
}) => {
  const toast = useToast();
  const confirm = useConfirm();

  // Core Data States
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<HospitalBed[]>([]);
  const [admissions, setAdmissions] = useState<BedAdmission[]>([]);
  const [hospitalServices, setHospitalServices] = useState<Service[]>([]);
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
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWardFilter, setSelectedWardFilter] = useState('ALL');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'stay-desc' | 'stay-asc' | 'bed' | 'name' | 'admission-desc'>('stay-desc');

  // Chart Modal States
  const [selectedBedForDetails, setSelectedBedForDetails] = useState<HospitalBed | null>(null);
  const [activeAdmissionRecord, setActiveAdmissionRecord] = useState<BedAdmission | null>(null);
  const [detailsActiveTab, setDetailsActiveTab] = useState<'overview' | 'vitals' | 'transfer' | 'discharge'>('overview');
  const [selectedBedForEmar, setSelectedBedForEmar] = useState<HospitalBed | null>(null);
  const [activeAdmissionForEmar, setActiveAdmissionForEmar] = useState<BedAdmission | null>(null);
  const [admissionForDischargeSummary, setAdmissionForDischargeSummary] = useState<BedAdmission | null>(null);

  // Vitals Form State
  const [vitalForm, setVitalForm] = useState({
    bpSystolic: '120',
    bpDiastolic: '80',
    pulse: '75',
    temp: '98.6',
    spo2: '99',
    respiratoryRate: '18',
    bloodSugar: '',
    urineOutput: '',
    notes: ''
  });

  // Ward Charges Form State (Master Tariff Enforced)
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

  // Bed Transfer State
  const [transferDestinationBedId, setTransferDestinationBedId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Discharge State
  const [dischargeSummaryNotes, setDischargeSummaryNotes] = useState('');

  // ── Dynamic Quick Add Presets (Pulled from Services Catalog Database) ─────────
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

  // ── Load All Data ────────────────────────────────────────────────────────────
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [w, b, a, m, s] = await Promise.all([
        storage.getWards(),
        storage.getBeds(),
        storage.getBedAdmissions({ limit: 200 }),
        storage.getIpdDashboardMetrics(),
        storage.getServices()
      ]);
      setWards(w);
      setBeds(b);
      setAdmissions(a);
      setMetrics(m);
      setHospitalServices(s || []);
    } catch (err) {
      console.error('Failed to load Inpatient Census data:', err);
      toast('Failed to load census data', { type: 'error' });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => {
      loadData(true);
    };
    window.addEventListener('buvora-data-updated', handleSync);
    const interval = setInterval(() => loadData(true), 5000);
    return () => {
      window.removeEventListener('buvora-data-updated', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Helper for stay duration text
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

  // Helper for stay minutes
  const getStayMinutes = (admittedAtStr?: string) => {
    if (!admittedAtStr) return 0;
    try {
      return Math.max(0, differenceInMinutes(new Date(), parseISO(admittedAtStr)));
    } catch (_) {
      return 0;
    }
  };

  // Filtered & Sorted Inpatients
  const filteredInpatients = useMemo(() => {
    // Only beds with active admitted patients
    let list = beds.filter(b => b.status === 'occupied' && b.patientName);

    // Filter by Ward
    if (selectedWardFilter !== 'ALL') {
      list = list.filter(b => b.wardId === selectedWardFilter);
    }

    // Filter by Doctor
    if (selectedDoctorFilter !== 'ALL') {
      list = list.filter(b => b.doctorId === selectedDoctorFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(b =>
        (b.patientName && b.patientName.toLowerCase().includes(q)) ||
        (b.patientUhid && b.patientUhid.toLowerCase().includes(q)) ||
        (b.patientId && b.patientId.toLowerCase().includes(q)) ||
        (b.patientPhone && b.patientPhone.includes(q)) ||
        (b.bedNumber && b.bedNumber.toLowerCase().includes(q)) ||
        (b.wardName && b.wardName.toLowerCase().includes(q)) ||
        (b.doctorName && b.doctorName.toLowerCase().includes(q)) ||
        (b.diagnosis && b.diagnosis.toLowerCase().includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'stay-desc') {
        return getStayMinutes(b.admittedAt) - getStayMinutes(a.admittedAt);
      }
      if (sortBy === 'stay-asc') {
        return getStayMinutes(a.admittedAt) - getStayMinutes(b.admittedAt);
      }
      if (sortBy === 'bed') {
        return (a.bedNumber || '').localeCompare(b.bedNumber || '', undefined, { numeric: true });
      }
      if (sortBy === 'name') {
        return (a.patientName || '').localeCompare(b.patientName || '');
      }
      if (sortBy === 'admission-desc') {
        const timeA = a.admittedAt ? new Date(a.admittedAt).getTime() : 0;
        const timeB = b.admittedAt ? new Date(b.admittedAt).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });

    return list;
  }, [beds, selectedWardFilter, selectedDoctorFilter, searchQuery, sortBy]);

  // Aggregate stats for the filtered list
  const totalAdvanceDeposits = useMemo(() => {
    return filteredInpatients.reduce((sum, b) => sum + (Number(b.advancePaid) || 0), 0);
  }, [filteredInpatients]);

  const availableBedsList = useMemo(() => {
    return beds.filter(b => b.status === 'available');
  }, [beds]);

  const allCleaningBeds = useMemo(() => {
    return beds.filter(b => b.status === 'cleaning');
  }, [beds]);

  const filteredCleaningBeds = useMemo(() => {
    // If filtering by a specific doctor, cleaning beds don't have doctors
    if (selectedDoctorFilter !== 'ALL') return [];

    let list = beds.filter(b => b.status === 'cleaning');

    // Filter by Ward
    if (selectedWardFilter !== 'ALL') {
      list = list.filter(b => b.wardId === selectedWardFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(b =>
        (b.bedNumber && b.bedNumber.toLowerCase().includes(q)) ||
        (b.wardName && b.wardName.toLowerCase().includes(q)) ||
        (b.bedType && b.bedType.toLowerCase().includes(q))
      );
    }

    return list;
  }, [beds, selectedWardFilter, selectedDoctorFilter, searchQuery]);

  // Open Bed Details Chart Modal
  const handleOpenBedDetails = async (bed: HospitalBed, defaultTab: 'overview' | 'vitals' | 'transfer' | 'discharge' = 'overview') => {
    setSelectedBedForDetails(bed);
    setDetailsActiveTab(defaultTab);
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

  // Live Inpatient Account Folio Calculation for Selected Chart
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

  // Master Tariff Selection Handler
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

  // Record Vital
  const handleRecordVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdmissionRecord) return;
    try {
      await storage.addAdmissionVital(activeAdmissionRecord.id, {
        bpSystolic: vitalForm.bpSystolic,
        bpDiastolic: vitalForm.bpDiastolic,
        pulse: vitalForm.pulse,
        temp: vitalForm.temp,
        spo2: vitalForm.spo2,
        respiratoryRate: vitalForm.respiratoryRate,
        bloodSugar: vitalForm.bloodSugar ? Number(vitalForm.bloodSugar) : undefined,
        urineOutput: vitalForm.urineOutput || undefined,
        notes: vitalForm.notes
      });
      toast('Vitals recorded successfully', { type: 'success' });
      const updatedAdmissions = await storage.getBedAdmissions();
      setAdmissions(updatedAdmissions);
      const fresh = updatedAdmissions.find(a => a.id === activeAdmissionRecord.id);
      if (fresh) setActiveAdmissionRecord(fresh);
      setVitalForm(prev => ({ ...prev, bloodSugar: '', urineOutput: '', notes: '' }));
      await loadData(true);
    } catch (err) {
      console.error('Failed to record vitals:', err);
      toast('Failed to record vitals', { type: 'error' });
    }
  };

  // Add Billable Charge
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
      const updatedAdmissions = await storage.getBedAdmissions();
      setAdmissions(updatedAdmissions);
      const fresh = updatedAdmissions.find(a => a.id === activeAdmissionRecord.id);
      if (fresh) setActiveAdmissionRecord(fresh);
      setChargeForm(prev => ({ ...prev, description: '', notes: '' }));
      await loadData(true);
    } catch (err: any) {
      toast(`Failed to log charge: ${err.message}`, { type: 'error' });
    }
  };

  // Delete Logged Charge
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
        setSelectedBedForDetails(null);
        setActiveAdmissionRecord(null);
        setDischargeSummaryNotes('');
        await loadData(true);
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

  // Mark Bed Sanitized & Ready (Ward Manager signoff)
  const handleMarkBedSanitized = async (bedId: string, bedNumber: string) => {
    try {
      await storage.updateBedStatus(bedId, 'available');
      toast(`Bed ${bedNumber} marked sanitized & ready for admission`, { type: 'success' });
      await loadData(true);
    } catch (err: any) {
      console.error('Failed to mark bed sanitized:', err);
      toast(`Failed to update bed status: ${err?.message || 'Error'}`, { type: 'error' });
    }
  };

  // Batch Mark All Filtered Beds Sanitized & Ready
  const handleMarkAllSanitized = async () => {
    if (filteredCleaningBeds.length === 0) return;
    const selectedWardObj = wards.find(w => w.id === selectedWardFilter);
    const scopeName = selectedWardObj ? `in ${selectedWardObj.name}` : 'across all wards';
    const confirmed = await confirm(
      `Mark all ${filteredCleaningBeds.length} cleaning bed(s) ${scopeName} as Sanitized & Ready for admission?`,
      {
        title: 'Batch Bed Sanitization Sign-off',
        confirmText: 'Mark All Ready',
        isDanger: false
      }
    );
    if (!confirmed) return;

    try {
      await Promise.all(filteredCleaningBeds.map(b => storage.updateBedStatus(b.id, 'available')));
      toast(`All ${filteredCleaningBeds.length} bed(s) marked sanitized & ready`, { type: 'success' });
      await loadData(true);
    } catch (err: any) {
      console.error('Failed to batch mark beds sanitized:', err);
      toast('Failed to update all bed statuses', { type: 'error' });
    }
  };

  // Print Inpatient Census Sheet
  const handlePrintCensus = () => {
    window.print();
  };

  return (
    <div className="inpatient-census-tab" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* ── Screen Header ──────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #0284c7, #0d9488)', color: 'white', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Users size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                Inpatient Census &amp; Clinical Registry
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Live active inpatient roster, stay durations, vital alerts, and financial folio tracking
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onNavigateToBeds && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onNavigateToBeds}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem' }}
            >
              <BedDouble size={16} color="#0284c7" />
              Bed Floorplan Grid
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={handlePrintCensus}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem' }}
          >
            <Printer size={16} />
            Print Census Sheet
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadData(false)}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem' }}
            title="Refresh active admissions"
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Active Inpatients</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>{metrics.occupiedBeds}</div>
            <div style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 600 }}>Currently admitted in wards</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bed size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Available Beds</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803d' }}>{metrics.availableBeds}</div>
            <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>Ready for immediate admission</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Advance Deposits Held</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0369a1' }}>₹{totalAdvanceDeposits.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600 }}>Credited via official receipts</div>
          </div>
        </div>

        <div style={{
          background: 'white',
          border: (selectedWardFilter !== 'ALL' ? filteredCleaningBeds.length : metrics.cleaningBeds) > 0 ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: (selectedWardFilter !== 'ALL' ? filteredCleaningBeds.length : metrics.cleaningBeds) > 0 ? '0 2px 8px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Under Sanitization {selectedWardFilter !== 'ALL' ? '(Ward)' : ''}
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: (selectedWardFilter !== 'ALL' ? filteredCleaningBeds.length : metrics.cleaningBeds) > 0 ? '#b45309' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {selectedWardFilter !== 'ALL' ? filteredCleaningBeds.length : metrics.cleaningBeds}
              {(selectedWardFilter !== 'ALL' ? filteredCleaningBeds.length : metrics.cleaningBeds) > 0 && (
                <span style={{ fontSize: '0.65rem', padding: '1px 6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '8px', fontWeight: 700 }}>
                  Needs signoff
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: (selectedWardFilter !== 'ALL' ? filteredCleaningBeds.length : metrics.cleaningBeds) > 0 ? '#b45309' : '#64748b', fontWeight: 600 }}>
              {(selectedWardFilter !== 'ALL' ? filteredCleaningBeds.length : metrics.cleaningBeds) > 0 ? 'Housekeeping clearance required' : 'All vacant beds sanitized'}
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Occupancy Rate</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#b45309' }}>{metrics.occupancyRate}%</div>
            <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>{metrics.occupiedBeds} of {metrics.totalBeds} total beds</div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Control Bar ───────────────────────────────────────── */}
      <div className="no-print" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.85rem 1.15rem', marginBottom: '1.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by Patient Name, UHID, Phone, Bed #, Doctor, Diagnosis..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '32px', height: '36px', fontSize: '0.825rem', margin: 0 }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Ward Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700 }}>Ward:</span>
              <select
                value={selectedWardFilter}
                onChange={e => setSelectedWardFilter(e.target.value)}
                className="input-field"
                style={{ height: '36px', fontSize: '0.8rem', fontWeight: 600, margin: 0, paddingRight: '1.8rem', width: 'auto' }}
              >
                <option value="ALL">
                  All Wards ({beds.filter(b => b.status === 'occupied').length} Inpatients{allCleaningBeds.length > 0 ? `, ${allCleaningBeds.length} Cleaning` : ''})
                </option>
                {wards.map(w => {
                  const occCount = beds.filter(b => b.wardId === w.id && b.status === 'occupied').length;
                  const clnCount = beds.filter(b => b.wardId === w.id && b.status === 'cleaning').length;
                  return (
                    <option key={w.id} value={w.id}>
                      {w.name} ({occCount} Inpatient{occCount === 1 ? '' : 's'}{clnCount > 0 ? `, ${clnCount} Cleaning` : ''})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Doctor Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700 }}>Doctor:</span>
              <select
                value={selectedDoctorFilter}
                onChange={e => setSelectedDoctorFilter(e.target.value)}
                className="input-field"
                style={{ height: '36px', fontSize: '0.8rem', fontWeight: 600, margin: 0, paddingRight: '1.8rem', width: 'auto' }}
              >
                <option value="ALL">All Attending Doctors</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={14} color="#64748b" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="input-field"
                style={{ height: '36px', fontSize: '0.8rem', fontWeight: 600, margin: 0, paddingRight: '1.8rem', width: 'auto' }}
              >
                <option value="stay-desc">Longest Stay First</option>
                <option value="stay-asc">Shortest Stay First</option>
                <option value="admission-desc">Newest Admission First</option>
                <option value="bed">Bed Number</option>
                <option value="name">Patient Name (A-Z)</option>
              </select>
            </div>

            {(selectedWardFilter !== 'ALL' || selectedDoctorFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSelectedWardFilter('ALL');
                  setSelectedDoctorFilter('ALL');
                  setSearchQuery('');
                }}
                style={{ height: '36px', fontSize: '0.75rem', padding: '0 0.65rem' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Housekeeping & Bed Sanitization Queue (Ward Manager Action - Filtered by Ward) ────── */}
      {filteredCleaningBeds.length > 0 && (
        <div
          className="no-print"
          style={{
            marginBottom: '1.25rem',
            background: 'linear-gradient(135deg, #fffdf7 0%, #fffbeb 100%)',
            border: '1.5px solid #fde68a',
            borderRadius: '14px',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 2px 10px rgba(245, 158, 11, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#f59e0b', color: 'white', padding: '8px', borderRadius: '10px', display: 'flex', flexShrink: 0 }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  Housekeeping &amp; Bed Sanitization Queue
                  {selectedWardFilter !== 'ALL' && (
                    <span style={{ color: '#b45309', fontWeight: 700 }}>
                      — {wards.find(w => w.id === selectedWardFilter)?.name || 'Filtered Ward'}
                    </span>
                  )}
                  <span style={{ fontSize: '0.78rem', color: '#78350f', fontWeight: 600 }}>
                    ({filteredCleaningBeds.length} Bed{filteredCleaningBeds.length > 1 ? 's' : ''} Awaiting Clearance)
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#fef3c7', border: '1px solid #fcd34d', color: '#b45309', borderRadius: '999px', fontWeight: 700 }}>
                    Ward Manager Action
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#b45309', marginTop: '2px' }}>
                  {selectedWardFilter !== 'ALL'
                    ? `Showing vacated beds in ${wards.find(w => w.id === selectedWardFilter)?.name || 'this ward'} awaiting sanitization before next admission.`
                    : 'These beds were vacated post-discharge. Once housekeeping sanitization is complete, mark them ready for new patient admissions.'}
                </div>
              </div>
            </div>

            {filteredCleaningBeds.length > 1 && (
              <button
                type="button"
                onClick={handleMarkAllSanitized}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.95rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                  transition: 'background 0.15s ease'
                }}
              >
                <CheckCircle size={15} />
                Mark All ({filteredCleaningBeds.length}) Sanitized &amp; Ready
              </button>
            )}
          </div>

          {/* Grid of Beds in Cleaning */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 320px))', gap: '0.65rem' }}>
            {filteredCleaningBeds.map(bed => (
              <div
                key={bed.id}
                style={{
                  background: 'white',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '0.55rem 0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <Bed size={16} color="#d97706" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      Bed {bed.bedNumber}
                    </span>
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bed.bedType || 'Standard'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bed.wardName || 'General Ward'} • ₹{Number(bed.dailyRate || 0).toLocaleString('en-IN')}/day
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleMarkBedSanitized(bed.id, bed.bedNumber)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px rgba(245, 158, 11, 0.2)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Confirm bed has been cleaned, disinfected, and is ready for next patient"
                >
                  <Check size={13} />
                  <span>Ready</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Printable Header (Only visible on print) ─────────────────────────── */}
      <div className="print-only" style={{ display: 'none', marginBottom: '1.5rem' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>HOSPITAL INPATIENT CENSUS REPORT</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
            Clinical Ward Handover &amp; Daily Inpatient Census • Printed on {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>Total Admitted: {filteredInpatients.length}</span>
            <span>Total Occupancy: {metrics.occupancyRate}%</span>
            <span>Advance Deposits: ₹{totalAdvanceDeposits.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* ── Inpatient Census Table ────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div className="no-print" style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              Active Inpatients Roster ({filteredInpatients.length} Patient{filteredInpatients.length === 1 ? '' : 's'})
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Real-time length of stay, clinical diagnosis, latest vitals, and folio balances
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1080px', margin: 0, fontSize: '0.825rem' }}>
            <thead>
              <tr>
                <th style={{ width: '90px', textAlign: 'left' }}>Bed</th>
                <th style={{ minWidth: '180px', textAlign: 'left' }}>Patient Details</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Age / Gender</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>Attending Doctor</th>
                <th style={{ width: '130px', textAlign: 'left' }}>Admitted At</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Length of Stay</th>
                <th style={{ minWidth: '160px', textAlign: 'left' }}>Diagnosis</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Advance Paid</th>
                <th className="no-print" style={{ width: '180px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInpatients.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Users size={32} color="#94a3b8" />
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                        {searchQuery.trim() || selectedWardFilter !== 'ALL' || selectedDoctorFilter !== 'ALL'
                          ? 'No active inpatients matching the selected filters.'
                          : 'No active inpatients currently admitted. All beds are available.'}
                      </div>
                      {(searchQuery.trim() || selectedWardFilter !== 'ALL' || selectedDoctorFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWardFilter('ALL');
                            setSelectedDoctorFilter('ALL');
                            setSearchQuery('');
                          }}
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInpatients.map(bed => {
                  return (
                    <tr key={bed.id} style={{ transition: 'background 0.15s' }}>
                      <td style={{ textAlign: 'left' }}>
                        <div 
                          style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.9rem' }}
                          title={bed.wardName ? `${bed.wardName}${bed.bedType ? ` (${bed.bedType})` : ''}` : undefined}
                        >
                          Bed {bed.bedNumber}
                        </div>
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                            {bed.patientName}
                          </span>
                          {(() => {
                            const adm = admissions.find(a => a.id === bed.currentAdmissionId);
                            if (adm?.billingStatus === 'QUEUED') {
                              return (
                                <span
                                  style={{
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    border: '1px solid #fde68a',
                                    borderRadius: '4px',
                                    padding: '1px 6px',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="Patient queued at Facility Billing desk for discharge settlement"
                                >
                                  ⚡ Billing Queued
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 600, marginTop: '2px' }}>
                          UHID: {bed.patientUhid || bed.patientId || '—'}
                          {bed.patientPhone && ` • ${bed.patientPhone}`}
                        </div>
                      </td>

                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem', color: '#334155', textAlign: 'center' }}>
                        {formatAgeGender(bed.patientAge, bed.patientGender)}
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Stethoscope size={13} color="#0284c7" />
                          {bed.doctorName || 'Attending Physician'}
                        </div>
                      </td>

                      <td style={{ whiteSpace: 'nowrap', textAlign: 'left' }}>
                        <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>
                          {bed.admittedAt ? format(parseISO(bed.admittedAt), 'dd MMM yyyy') : '—'}
                        </div>
                        {bed.admittedAt && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {format(parseISO(bed.admittedAt), 'hh:mm a')}
                          </div>
                        )}
                      </td>

                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          color: '#334155',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem'
                        }}>
                          <Clock size={12} color="#64748b" />
                          {getStayDurationString(bed.admittedAt)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#334155',
                          background: '#f8fafc',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-block',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          border: '1px solid #e2e8f0'
                        }}>
                          {bed.diagnosis || 'Clinical Observation'}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: '#15803d',
                          background: '#dcfce7',
                          border: '1px solid #bbf7d0',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-block'
                        }}>
                          ₹{Number(bed.advancePaid || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="no-print" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div className="census-actions">
                          <button
                            type="button"
                            className="census-btn-chart"
                            onClick={() => handleOpenBedDetails(bed, 'overview')}
                            title="Open Inpatient Chart & Vitals"
                          >
                            <Activity size={13} />
                            Chart
                          </button>

                          <button
                            type="button"
                            className="census-btn-icon census-btn-emar"
                            onClick={() => {
                              setSelectedBedForEmar(bed);
                              const adm = admissions.find(a => a.id === bed.currentAdmissionId);
                              setActiveAdmissionForEmar(adm || null);
                            }}
                            title="Bedside eMAR & Nursing Station"
                          >
                            <Pill size={14} />
                          </button>

                          <button
                            type="button"
                            className="census-btn-icon census-btn-summary"
                            onClick={() => {
                              const adm = admissions.find(a => a.id === bed.currentAdmissionId);
                              if (adm) setAdmissionForDischargeSummary(adm);
                            }}
                            title="Structured Discharge Summary & A4 Print"
                          >
                            <FileText size={14} />
                          </button>

                          <button
                            type="button"
                            className="census-btn-icon census-btn-discharge"
                            onClick={() => handleOpenBedDetails(bed, 'discharge')}
                            title="Discharge & Queue for Facility Billing"
                          >
                            <LogOut size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredInpatients.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan={7} style={{ textAlign: 'right', padding: '10px 12px' }}>
                    Total Inpatients: {filteredInpatients.length} | Total Advance Held:
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: '#15803d', fontSize: '0.95rem' }}>
                    ₹{totalAdvanceDeposits.toLocaleString('en-IN')}
                  </td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modal: Inpatient Chart, Vitals, Consumables & Discharge ──────────── */}
      {selectedBedForDetails && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedBedForDetails(null)}
          style={{
            position: 'fixed',
            inset: 0,
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
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                title="Open Bedside eMAR & Nursing Suite"
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
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                      ⏱️ {getStayDurationString(selectedBedForDetails.admittedAt)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', fontSize: '0.8rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Age / Gender:</div>
                      <strong>{formatAgeGender(selectedBedForDetails.patientAge, selectedBedForDetails.patientGender)}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Attending Physician:</div>
                      <strong>{selectedBedForDetails.doctorName || 'Dr.'}</strong>
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

            {/* Tab 2: Ward Billing Tracker (Consumables & Care) & Bedside Vitals */}
            {detailsActiveTab === 'vitals' && (
              <div>
                {/* Bedside Vitals Entry Card */}
                <div style={{ background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '12px', padding: '1.2rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                        <Heart size={20} color="#ef4444" />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                          Bedside Vitals Entry (Clinical Rounds)
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                          Real-time clinical vitals logged to patient admission history
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleRecordVital}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>BP Systolic (mmHg)</label>
                        <input type="text" required value={vitalForm.bpSystolic} onChange={e => setVitalForm({ ...vitalForm, bpSystolic: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>BP Diastolic</label>
                        <input type="text" required value={vitalForm.bpDiastolic} onChange={e => setVitalForm({ ...vitalForm, bpDiastolic: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Pulse (bpm)</label>
                        <input type="text" required value={vitalForm.pulse} onChange={e => setVitalForm({ ...vitalForm, pulse: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Temp (°F)</label>
                        <input type="text" required value={vitalForm.temp} onChange={e => setVitalForm({ ...vitalForm, temp: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>SpO2 (%)</label>
                        <input type="text" required value={vitalForm.spo2} onChange={e => setVitalForm({ ...vitalForm, spo2: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Resp Rate (/min)</label>
                        <input type="text" required value={vitalForm.respiratoryRate} onChange={e => setVitalForm({ ...vitalForm, respiratoryRate: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>GRBS (mg/dL)</label>
                        <input type="number" placeholder="Optional" value={vitalForm.bloodSugar} onChange={e => setVitalForm({ ...vitalForm, bloodSugar: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Urine Output</label>
                        <input type="text" placeholder="Optional" value={vitalForm.urineOutput} onChange={e => setVitalForm({ ...vitalForm, urineOutput: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Clinical notes or symptoms during rounds (e.g. resting comfortably, mild cough)..."
                        value={vitalForm.notes}
                        onChange={e => setVitalForm({ ...vitalForm, notes: e.target.value })}
                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ background: '#0284c7', padding: '6px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        <Plus size={15} /> Save Vitals Log
                      </button>
                    </div>
                  </form>
                </div>

                {/* Master Tariff Consumables & Care Tracker */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #0284c7', borderRadius: '12px', padding: '1.2rem', marginBottom: '1rem' }}>
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
                          Items logged here automatically transfer into the Patient's Final IPD Bill
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
