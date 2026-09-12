import React, { useState, useEffect, useMemo } from 'react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import {
  AlertOctagon, Activity, Clock, ShieldAlert, CheckCircle,
  Plus, Search, RefreshCw, Printer, X, Check, Bed, AlertTriangle
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import '../../styles/tabs/EmergencyTab.css';
import {
  storage,
  formatAgeGender,
  notifyDataChanged,
  type EmergencyVisit,
  type TriageLevel,
  type TriageCategory,
  type EmergencyDisposition,
  type MlcRecord,
  type EmergencyDashboardMetrics,
  type Doctor,
  type HospitalBed,
  type GlobalPatientProfile
} from '../../lib/storage';

interface EmergencyTabProps {
  doctors: Doctor[];
  onNavigateToBed?: (bedId: string) => void;
  onNavigateToBilling?: (admissionId: string) => void;
}

export const EmergencyTab: React.FC<EmergencyTabProps> = ({
  doctors,
  onNavigateToBed: _onNavigateToBed,
  onNavigateToBilling: _onNavigateToBilling
}) => {
  const toast = useToast();

  // Core Data States
  const [visits, setVisits] = useState<EmergencyVisit[]>([]);
  const [mlcRecords, setMlcRecords] = useState<MlcRecord[]>([]);
  const [metrics, setMetrics] = useState<EmergencyDashboardMetrics>({
    activeVisits: 0,
    redResuscitation: 0,
    orangeEmergent: 0,
    yellowUrgent: 0,
    greenNonUrgent: 0,
    totalMlcCases: 0
  });
  const [availableBeds, setAvailableBeds] = useState<HospitalBed[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTriageFilter, setSelectedTriageFilter] = useState('ALL');
  const [selectedDispositionFilter, setSelectedDispositionFilter] = useState('UNDER_TREATMENT');
  const [selectedMlcFilter, setSelectedMlcFilter] = useState('ALL');

  // Modals
  const [showNewVisitModal, setShowNewVisitModal] = useState(false);
  const [activeVisitForMlc, setActiveVisitForMlc] = useState<EmergencyVisit | null>(null);
  const [activeVisitForAdmit, setActiveVisitForAdmit] = useState<EmergencyVisit | null>(null);
  const [selectedMlcToPrint, setSelectedMlcToPrint] = useState<MlcRecord | null>(null);

  // Form State: New Emergency Visit
  const [visitForm, setVisitForm] = useState<{
    patientName: string;
    patientUhid: string;
    patientPhone: string;
    patientAge: string;
    patientGender: string;
    triageLevel: TriageLevel;
    chiefComplaint: string;
    bpSystolic: string;
    bpDiastolic: string;
    heartRate: string;
    respRate: string;
    spo2: string;
    temperature: string;
    gcsTotal: string;
    triageNurseName: string;
    attendingDoctorId: string;
    isMlc: boolean;
    notes: string;
  }>({
    patientName: '',
    patientUhid: '',
    patientPhone: '',
    patientAge: '',
    patientGender: 'Male',
    triageLevel: 3,
    chiefComplaint: '',
    bpSystolic: '120',
    bpDiastolic: '80',
    heartRate: '80',
    respRate: '18',
    spo2: '98',
    temperature: '98.6',
    gcsTotal: '15',
    triageNurseName: 'Triage Nurse',
    attendingDoctorId: doctors[0]?.id || '',
    isMlc: false,
    notes: ''
  });

  // Patient Autocomplete State
  const [patientSearchResults, setPatientSearchResults] = useState<GlobalPatientProfile[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const handlePatientNameChange = async (val: string) => {
    setVisitForm(prev => ({ ...prev, patientName: val }));
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
    setVisitForm(prev => ({
      ...prev,
      patientName: p.patientName,
      patientUhid: p.patientUhid || p.patientId || prev.patientUhid,
      patientPhone: p.patientPhone || prev.patientPhone,
      patientAge: p.patientAge ? String(p.patientAge) : prev.patientAge,
      patientGender: p.patientGender || prev.patientGender,
      chiefComplaint: prev.chiefComplaint || p.recentDiagnosis || '',
      attendingDoctorId: (p.lastDoctorId && doctors.some(d => d.id === p.lastDoctorId)) ? p.lastDoctorId : prev.attendingDoctorId
    }));
    setShowPatientDropdown(false);
    toast.show(`Auto-filled details for ${p.patientName}`, 'info');
  };

  const loadEmergencyData = async () => {
    try {
      setLoading(true);
      const [vList, mList, mData, bList] = await Promise.all([
        storage.getEmergencyVisits(),
        storage.getMlcRecords(),
        storage.getEmergencyDashboardMetrics(),
        storage.getBeds()
      ]);
      setVisits(vList);
      setMlcRecords(mList);
      setMetrics(mData);
      setAvailableBeds(bList.filter(b => b.status === 'available'));
    } catch (e) {
      console.error('Failed to load emergency data:', e);
      toast.show('Failed to load emergency registry', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmergencyData();
    const interval = setInterval(loadEmergencyData, 5000); // 5s auto-refresh for LAN sync
    const handleLiveSync = (e: CustomEvent) => {
      if (!e.detail?.dataType || e.detail.dataType === 'emergency' || e.detail.dataType === 'beds' || e.detail.dataType === 'mlc') {
        loadEmergencyData();
      }
    };
    window.addEventListener('buvora-data-updated', handleLiveSync as EventListener);
    return () => {
      clearInterval(interval);
      window.removeEventListener('buvora-data-updated', handleLiveSync as EventListener);
    };
  }, []);

  // Filtered Visits
  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (selectedTriageFilter !== 'ALL' && String(v.triageLevel) !== selectedTriageFilter) return false;
      if (selectedDispositionFilter !== 'ALL' && v.disposition !== selectedDispositionFilter) return false;
      if (selectedMlcFilter === 'MLC_ONLY' && !v.isMlc) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = v.patientName?.toLowerCase().includes(q);
        const matchUhid = v.patientUhid?.toLowerCase().includes(q);
        const matchComplaint = v.chiefComplaint?.toLowerCase().includes(q);
        const matchNum = v.emergencyNumber?.toLowerCase().includes(q);
        const matchMlc = v.mlcNumber?.toLowerCase().includes(q);
        if (!matchName && !matchUhid && !matchComplaint && !matchNum && !matchMlc) return false;
      }
      return true;
    });
  }, [visits, selectedTriageFilter, selectedDispositionFilter, selectedMlcFilter, searchQuery]);

  // Calculate Shock Index
  const calculateShockIndex = (hr?: number, sbp?: number): { value: number; isElevated: boolean } | null => {
    if (!hr || !sbp || sbp === 0) return null;
    const si = Number((hr / sbp).toFixed(2));
    return { value: si, isElevated: si >= 0.9 };
  };

  // Map Triage Level to Category Color
  const getTriageCategory = (level: TriageLevel): TriageCategory => {
    switch (level) {
      case 1: return 'RED';
      case 2: return 'ORANGE';
      case 3: return 'YELLOW';
      case 4: return 'GREEN';
      case 5: return 'BLUE';
    }
  };

  // Submit New Visit
  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitForm.patientName.trim()) {
      toast.show('Please enter patient name', 'warning');
      return;
    }
    if (!visitForm.chiefComplaint.trim()) {
      toast.show('Please enter chief complaint', 'warning');
      return;
    }

    try {
      const hr = Number(visitForm.heartRate) || undefined;
      const sbp = Number(visitForm.bpSystolic) || undefined;
      const si = calculateShockIndex(hr, sbp);
      const doctor = doctors.find(d => d.id === visitForm.attendingDoctorId);

      const newVisit: Partial<EmergencyVisit> = {
        id: 'ER-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        patientName: visitForm.patientName.trim(),
        patientUhid: visitForm.patientUhid.trim() || undefined,
        patientPhone: visitForm.patientPhone.trim() || undefined,
        patientAge: visitForm.patientAge.trim() || undefined,
        patientGender: visitForm.patientGender,
        triageLevel: visitForm.triageLevel,
        triageCategory: getTriageCategory(visitForm.triageLevel),
        chiefComplaint: visitForm.chiefComplaint.trim(),
        triageVitals: {
          bpSystolic: sbp,
          bpDiastolic: Number(visitForm.bpDiastolic) || undefined,
          heartRate: hr,
          respRate: Number(visitForm.respRate) || undefined,
          spo2: Number(visitForm.spo2) || undefined,
          temperature: Number(visitForm.temperature) || undefined,
          gcsTotal: Number(visitForm.gcsTotal) || 15,
          shockIndex: si?.value
        },
        triageNurseName: visitForm.triageNurseName.trim() || 'Triage Nurse',
        attendingDoctorId: doctor?.id,
        attendingDoctorName: doctor?.name || 'Casualty Medical Officer',
        arrivedAt: new Date().toISOString(),
        disposition: 'UNDER_TREATMENT',
        isMlc: visitForm.isMlc,
        notes: visitForm.notes.trim() || undefined
      };

      const res = await storage.saveEmergencyVisit(newVisit);
      notifyDataChanged('emergency');
      toast.show(`Emergency ticket created: ${res.emergencyNumber} (ESI ${visitForm.triageLevel})`, 'success');
      setShowNewVisitModal(false);
      loadEmergencyData();

      // If MLC is checked, prompt MLC details immediately
      if (visitForm.isMlc) {
        setActiveVisitForMlc({ ...newVisit, id: res.id, emergencyNumber: res.emergencyNumber } as any);
      }
    } catch (err) {
      console.error('Failed to create emergency visit:', err);
      toast.show('Failed to register emergency visit', 'error');
    }
  };

  // Change Disposition
  const handleDispositionChange = async (v: EmergencyVisit, disp: EmergencyDisposition) => {
    try {
      setVisits(prev => prev.map(item => item.id === v.id ? { ...item, disposition: disp, updatedAt: new Date().toISOString() } : item));
      await storage.updateEmergencyDisposition(v.id, disp);
      notifyDataChanged('emergency');
      toast.show(
        selectedDispositionFilter === 'UNDER_TREATMENT' && disp !== 'UNDER_TREATMENT'
          ? `Visit ${v.emergencyNumber} moved to ${disp.replace('_', ' ')}. Switch filter to view.`
          : `Visit ${v.emergencyNumber} updated to ${disp.replace('_', ' ')}`,
        'success'
      );
      loadEmergencyData();
    } catch (err) {
      toast.show('Failed to update disposition', 'error');
      loadEmergencyData();
    }
  };

  // Fast-Track Admit to Inpatient Bed
  const handleFastTrackAdmit = async (v: EmergencyVisit, bed: HospitalBed) => {
    try {
      const doctor = doctors.find(d => d.id === v.attendingDoctorId) || doctors[0];
      const admissionData = {
        patientName: v.patientName,
        patientPhone: v.patientPhone || '',
        patientGender: v.patientGender || 'Male',
        patientAge: v.patientAge || '',
        patientUhid: v.patientUhid || v.patientId,
        wardId: bed.wardId,
        wardName: bed.wardName || 'General Ward',
        bedId: bed.id,
        bedNumber: bed.bedNumber,
        doctorId: doctor?.id || 'DR-CASUALTY',
        doctorName: doctor?.name || 'Attending Physician',
        admittedAt: new Date().toISOString(),
        diagnosis: `[EMERGENCY ADMISSION] ${v.chiefComplaint}`,
        initialVitals: JSON.stringify(v.triageVitals || {}),
        advancePaid: 0,
        paymentMode: 'CASH',
        notes: `Fast-track admitted from Casualty (ER #${v.emergencyNumber}, ESI ${v.triageLevel})`
      };

      const adm = await storage.admitPatientToBed(admissionData);
      await storage.updateEmergencyDisposition(v.id, 'ADMITTED_IPD', {
        admittedBedId: bed.id,
        admittedAdmissionId: adm.id,
        notes: `Admitted to Bed ${bed.bedNumber} (${bed.wardName})`
      });

      setVisits(prev => prev.map(item => item.id === v.id ? { ...item, disposition: 'ADMITTED_IPD', admittedBedId: bed.id, admittedAdmissionId: adm.id } : item));
      notifyDataChanged('emergency');
      notifyDataChanged('beds');
      toast.show(`Patient ${v.patientName} fast-tracked to Bed ${bed.bedNumber}!`, 'success');
      setActiveVisitForAdmit(null);
      loadEmergencyData();
    } catch (err) {
      console.error('Fast track admission failed:', err);
      toast.show('Admission failed', 'error');
      loadEmergencyData();
    }
  };

  return (
    <div className="er-tab-container">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={26} color="#dc2626" />
            Emergency Department & Casualty Triage
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            ESI 1–5 triage queue, rapid resuscitation alerts, Medico-Legal Case (MLC) police intimation, and 1-click fast-track admission.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setSelectedDispositionFilter('ALL');
              setSelectedMlcFilter('MLC_ONLY');
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldAlert size={15} color="#7e22ce" />
            MLC Register ({metrics.totalMlcCases})
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setVisitForm({
                patientName: '',
                patientUhid: '',
                patientPhone: '',
                patientAge: '',
                patientGender: 'Male',
                triageLevel: 3,
                chiefComplaint: '',
                bpSystolic: '120',
                bpDiastolic: '80',
                heartRate: '80',
                respRate: '18',
                spo2: '98',
                temperature: '98.6',
                gcsTotal: '15',
                triageNurseName: 'Triage Nurse',
                attendingDoctorId: doctors[0]?.id || '',
                isMlc: false,
                notes: ''
              });
              setShowNewVisitModal(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dc2626' }}
          >
            <Plus size={16} />
            New ER Arrival
          </button>
        </div>
      </div>

      {/* ── Triage Summary Bar (Color Coded ESI) ─────────────────────────────── */}
      <div className="er-triage-summary-bar">
        <div className="er-triage-card level-1" onClick={() => { setSelectedTriageFilter('1'); setSelectedDispositionFilter('UNDER_TREATMENT'); }} style={{ cursor: 'pointer' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertOctagon size={24} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Level 1: Resuscitation</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{metrics.redResuscitation} STAT</div>
          </div>
        </div>

        <div className="er-triage-card level-2" onClick={() => { setSelectedTriageFilter('2'); setSelectedDispositionFilter('UNDER_TREATMENT'); }} style={{ cursor: 'pointer' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={24} color="#ea580c" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Level 2: Emergent</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{metrics.orangeEmergent}</div>
          </div>
        </div>

        <div className="er-triage-card level-3" onClick={() => { setSelectedTriageFilter('3'); setSelectedDispositionFilter('UNDER_TREATMENT'); }} style={{ cursor: 'pointer' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} color="#ca8a04" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Level 3: Urgent</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{metrics.yellowUrgent}</div>
          </div>
        </div>

        <div className="er-triage-card level-4" onClick={() => { setSelectedTriageFilter('4'); setSelectedDispositionFilter('UNDER_TREATMENT'); }} style={{ cursor: 'pointer' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={24} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Level 4/5: Less Urgent</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{metrics.greenNonUrgent}</div>
          </div>
        </div>

        <div className="er-triage-card mlc-card" onClick={() => { setSelectedMlcFilter('MLC_ONLY'); setSelectedDispositionFilter('ALL'); }} style={{ cursor: 'pointer' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={24} color="#9333ea" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Medico-Legal (MLC)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{metrics.totalMlcCases} Cases</div>
          </div>
        </div>
      </div>

      {/* ── Quick Disposition Navigation Tabs ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => { setSelectedDispositionFilter('UNDER_TREATMENT'); setSelectedMlcFilter('ALL'); }}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: selectedDispositionFilter === 'UNDER_TREATMENT' && selectedMlcFilter === 'ALL' ? '2px solid #dc2626' : '1px solid #cbd5e1',
            background: selectedDispositionFilter === 'UNDER_TREATMENT' && selectedMlcFilter === 'ALL' ? '#fef2f2' : '#ffffff',
            color: selectedDispositionFilter === 'UNDER_TREATMENT' && selectedMlcFilter === 'ALL' ? '#b91c1c' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Activity size={14} />
          Active Under Treatment
          <span style={{ padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', background: selectedDispositionFilter === 'UNDER_TREATMENT' && selectedMlcFilter === 'ALL' ? '#dc2626' : '#e2e8f0', color: selectedDispositionFilter === 'UNDER_TREATMENT' && selectedMlcFilter === 'ALL' ? '#ffffff' : '#334155' }}>
            {visits.filter(v => v.disposition === 'UNDER_TREATMENT').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setSelectedDispositionFilter('ADMITTED_IPD'); setSelectedMlcFilter('ALL'); }}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: selectedDispositionFilter === 'ADMITTED_IPD' ? '2px solid #0284c7' : '1px solid #cbd5e1',
            background: selectedDispositionFilter === 'ADMITTED_IPD' ? '#f0f9ff' : '#ffffff',
            color: selectedDispositionFilter === 'ADMITTED_IPD' ? '#0369a1' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Bed size={14} />
          Admitted to IPD
          <span style={{ padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', background: selectedDispositionFilter === 'ADMITTED_IPD' ? '#0284c7' : '#e2e8f0', color: selectedDispositionFilter === 'ADMITTED_IPD' ? '#ffffff' : '#334155' }}>
            {visits.filter(v => v.disposition === 'ADMITTED_IPD').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setSelectedDispositionFilter('DISCHARGED'); setSelectedMlcFilter('ALL'); }}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: selectedDispositionFilter === 'DISCHARGED' ? '2px solid #16a34a' : '1px solid #cbd5e1',
            background: selectedDispositionFilter === 'DISCHARGED' ? '#f0fdf4' : '#ffffff',
            color: selectedDispositionFilter === 'DISCHARGED' ? '#15803d' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <CheckCircle size={14} />
          Discharged
          <span style={{ padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', background: selectedDispositionFilter === 'DISCHARGED' ? '#16a34a' : '#e2e8f0', color: selectedDispositionFilter === 'DISCHARGED' ? '#ffffff' : '#334155' }}>
            {visits.filter(v => v.disposition === 'DISCHARGED' || v.disposition === 'LAMA').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setSelectedDispositionFilter('ALL'); setSelectedMlcFilter('ALL'); }}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: selectedDispositionFilter === 'ALL' && selectedMlcFilter === 'ALL' ? '2px solid #475569' : '1px solid #cbd5e1',
            background: selectedDispositionFilter === 'ALL' && selectedMlcFilter === 'ALL' ? '#f1f5f9' : '#ffffff',
            color: selectedDispositionFilter === 'ALL' && selectedMlcFilter === 'ALL' ? '#0f172a' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          All ER Records
          <span style={{ padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', background: selectedDispositionFilter === 'ALL' && selectedMlcFilter === 'ALL' ? '#475569' : '#e2e8f0', color: selectedDispositionFilter === 'ALL' && selectedMlcFilter === 'ALL' ? '#ffffff' : '#334155' }}>
            {visits.length}
          </span>
        </button>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="er-filter-bar">
        <div className="er-filter-left">
          <div className="er-search-box">
            <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search ER patient, complaint, MLC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="er-filter-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            value={selectedTriageFilter}
            onChange={(e) => setSelectedTriageFilter(e.target.value)}
            className="er-filter-select"
            title="Filter by Triage Level"
          >
            <option value="ALL">All Triage Levels</option>
            <option value="1">Level 1: Resuscitation (Red)</option>
            <option value="2">Level 2: Emergent (Orange)</option>
            <option value="3">Level 3: Urgent (Yellow)</option>
            <option value="4">Level 4: Less Urgent (Green)</option>
            <option value="5">Level 5: Non-Urgent (Blue)</option>
          </select>

          <select
            value={selectedDispositionFilter}
            onChange={(e) => setSelectedDispositionFilter(e.target.value)}
            className="er-filter-select"
            style={{ fontWeight: 600 }}
            title="Filter by Disposition Status"
          >
            <option value="UNDER_TREATMENT">Under Treatment (Active Queue)</option>
            <option value="ADMITTED_IPD">Admitted to IPD</option>
            <option value="TRANSFERRED_OT">Transferred to OT</option>
            <option value="DISCHARGED">Discharged Home</option>
            <option value="LAMA">LAMA / Absconded</option>
            <option value="ALL">All Dispositions</option>
          </select>

          <select
            value={selectedMlcFilter}
            onChange={(e) => setSelectedMlcFilter(e.target.value)}
            className="er-filter-select"
            title="Filter by Medico-Legal Flag"
          >
            <option value="ALL">All Patients</option>
            <option value="MLC_ONLY">MLC Cases Only</option>
          </select>

          {(searchQuery || selectedTriageFilter !== 'ALL' || selectedDispositionFilter !== 'UNDER_TREATMENT' || selectedMlcFilter !== 'ALL') && (
            <button
              type="button"
              className="er-filter-btn"
              onClick={() => {
                setSearchQuery('');
                setSelectedTriageFilter('ALL');
                setSelectedDispositionFilter('UNDER_TREATMENT');
                setSelectedMlcFilter('ALL');
              }}
              title="Reset all filters"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="er-filter-badge">
            {filteredVisits.length} {filteredVisits.length === 1 ? 'Patient' : 'Patients'}
          </span>
          <button
            type="button"
            className="er-filter-btn"
            onClick={loadEmergencyData}
            title="Refresh Emergency Patients"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Active ER Patient Queue Table ───────────────────────────────────── */}
      <div className="er-table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', margin: 0, fontSize: '0.825rem' }}>
            <thead>
              <tr>
                <th style={{ width: '110px', textAlign: 'left' }}>ER Ticket</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Triage Priority</th>
                <th style={{ minWidth: '180px', textAlign: 'left' }}>Patient Particulars</th>
                <th style={{ minWidth: '180px', textAlign: 'left' }}>Chief Complaint</th>
                <th style={{ minWidth: '160px', textAlign: 'left' }}>Triage Vitals & Shock Index</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Wait Time</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Disposition</th>
                <th className="no-print" style={{ width: '160px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && visits.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#dc2626' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#475569' }}>
                        Loading emergency admissions...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={32} color="#16a34a" />
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        No patients currently matching this view.
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '420px', textAlign: 'center' }}>
                        {selectedDispositionFilter === 'UNDER_TREATMENT' && visits.length > 0 ? (
                          <span>All patients have been admitted or discharged. Click below to view all records.</span>
                        ) : (
                          <span>No emergency records recorded in this filter.</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {selectedDispositionFilter !== 'ALL' && visits.length > 0 && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => { setSelectedDispositionFilter('ALL'); setSelectedMlcFilter('ALL'); }}
                            style={{ fontSize: '0.8rem' }}
                          >
                            View All {visits.length} ER Records
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setShowNewVisitModal(true)}
                          style={{ background: '#dc2626', fontSize: '0.8rem' }}
                        >
                          + Register Emergency Arrival
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVisits.map(v => {
                  const triageClass = `triage-badge-${v.triageCategory.toLowerCase()}`;
                  const waitMinutes = v.arrivedAt ? differenceInMinutes(new Date(), parseISO(v.arrivedAt)) : 0;
                  const shockIndex = v.triageVitals?.shockIndex;
                  return (
                    <tr key={v.id} style={{ background: v.triageLevel === 1 ? '#fff5f5' : undefined }}>
                      <td style={{ textAlign: 'left' }}>
                        <strong style={{ color: '#dc2626', fontFamily: 'monospace' }}>{v.emergencyNumber}</strong>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {v.arrivedAt ? format(parseISO(v.arrivedAt), 'hh:mm a') : '—'}
                        </div>
                        {v.isMlc && (
                          <div className="mlc-badge" style={{ marginTop: '3px' }}>
                            ⚖️ {v.mlcNumber || 'MLC'}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`triage-badge ${triageClass}`}>
                          Level {v.triageLevel}: {v.triageCategory}
                        </span>
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{v.patientName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {formatAgeGender(v.patientAge, v.patientGender)}
                          {v.patientPhone && ` • ${v.patientPhone}`}
                        </div>
                        {v.patientUhid && (
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontFamily: 'monospace' }}>
                            UHID: {v.patientUhid}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{v.chiefComplaint}</div>
                        {v.attendingDoctorName && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Dr: {v.attendingDoctorName}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        {v.triageVitals ? (
                          <div style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                            <div>
                              BP: <strong>{v.triageVitals.bpSystolic || '—'}/{v.triageVitals.bpDiastolic || '—'}</strong> • HR: <strong>{v.triageVitals.heartRate || '—'}</strong>
                            </div>
                            <div style={{ color: '#64748b' }}>
                              SpO2: <strong style={{ color: (v.triageVitals.spo2 || 100) < 94 ? '#dc2626' : '#15803d' }}>{v.triageVitals.spo2 || '—'}%</strong> • GCS: {v.triageVitals.gcsTotal || 15}/15
                            </div>
                            {shockIndex !== undefined && (
                              <div style={{ marginTop: '2px' }}>
                                <span className={`shock-index-badge ${shockIndex >= 0.9 ? 'shock-index-warning' : 'shock-index-normal'}`}>
                                  Shock Index: {shockIndex} {shockIndex >= 0.9 ? '⚠️ High' : 'OK'}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No vitals recorded</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: waitMinutes > 60 ? '#fee2e2' : waitMinutes > 30 ? '#fef3c7' : '#f1f5f9',
                          color: waitMinutes > 60 ? '#b91c1c' : waitMinutes > 30 ? '#b45309' : '#334155'
                        }}>
                          ⏱️ {waitMinutes}m
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <select
                          value={v.disposition}
                          onChange={(e) => handleDispositionChange(v, e.target.value as any)}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 6px',
                            borderRadius: '6px',
                            background: v.disposition === 'UNDER_TREATMENT' ? '#fef2f2' : '#f0fdf4',
                            color: v.disposition === 'UNDER_TREATMENT' ? '#b91c1c' : '#15803d',
                            border: '1px solid #cbd5e1'
                          }}
                        >
                          <option value="UNDER_TREATMENT">Under Treatment</option>
                          <option value="ADMITTED_IPD">Admitted to IPD</option>
                          <option value="TRANSFERRED_OT">Transferred to OT</option>
                          <option value="DISCHARGED">Discharged</option>
                          <option value="LAMA">LAMA / Absconded</option>
                          <option value="REFERRED">Referred Out</option>
                        </select>
                      </td>

                      <td className="no-print" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div className="er-action-btn-group">
                          {/* Fast Track Admit Button */}
                          <button
                            type="button"
                            className="er-action-icon-btn"
                            onClick={() => setActiveVisitForAdmit(v)}
                            title="1-Click Fast-Track Inpatient Admission"
                            style={{ color: '#0284c7', background: '#f0f9ff', borderColor: '#bae6fd' }}
                          >
                            <Bed size={14} />
                          </button>

                          {/* Medico-Legal Case Button */}
                          <button
                            type="button"
                            className="er-action-icon-btn"
                            onClick={() => setActiveVisitForMlc(v)}
                            title={v.isMlc ? `View/Edit MLC Record (${v.mlcNumber})` : 'Register as Medico-Legal Case (MLC)'}
                            style={{ color: '#7e22ce', background: '#faf5ff', borderColor: '#e9d5ff' }}
                          >
                            <ShieldAlert size={14} />
                          </button>

                          {/* Discharge / Complete */}
                          <button
                            type="button"
                            className="er-action-icon-btn"
                            onClick={() => handleDispositionChange(v, 'DISCHARGED')}
                            title="Discharge Patient"
                            style={{ color: '#16a34a', background: '#f0fdf4', borderColor: '#bbf7d0' }}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal 1: Register Emergency Arrival ──────────────────────────────── */}
      {showNewVisitModal && (
        <div className="modal-backdrop" onClick={() => setShowNewVisitModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertOctagon size={22} color="#dc2626" />
                Emergency Casualty Registration
              </h3>
              <button type="button" onClick={() => setShowNewVisitModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateVisit}>
              {/* Triage Priority Selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '6px' }}>Emergency Severity Index (ESI Triage) *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {[
                    { level: 1, label: 'Level 1: Red (STAT)', bg: '#fee2e2', color: '#b91c1c' },
                    { level: 2, label: 'Level 2: Orange', bg: '#ffedd5', color: '#c2410c' },
                    { level: 3, label: 'Level 3: Yellow', bg: '#fef9c3', color: '#a16207' },
                    { level: 4, label: 'Level 4: Green', bg: '#dcfce7', color: '#15803d' },
                    { level: 5, label: 'Level 5: Blue', bg: '#e0f2fe', color: '#0369a1' }
                  ].map(item => (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => setVisitForm(prev => ({ ...prev, triageLevel: item.level as any }))}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: visitForm.triageLevel === item.level ? `2px solid ${item.color}` : '1px solid #e2e8f0',
                        background: visitForm.triageLevel === item.level ? item.bg : '#ffffff',
                        color: item.color,
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Demographics */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Patient Full Name *</label>
                    {isSearchingPatient && <span style={{ fontSize: '0.7rem', color: '#0284c7' }}>Searching...</span>}
                  </div>
                  <input
                    type="text"
                    required
                    value={visitForm.patientName}
                    onChange={(e) => handlePatientNameChange(e.target.value)}
                    onFocus={() => {
                      if (patientSearchResults.length > 0) setShowPatientDropdown(true);
                    }}
                    placeholder="Type name (auto-fills if returning)"
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
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
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        zIndex: 10600,
                        maxHeight: '220px',
                        overflowY: 'auto',
                        marginTop: '4px'
                      }}
                    >
                      <div style={{ padding: '6px 10px', fontSize: '0.72rem', background: '#f1f5f9', fontWeight: 700, color: '#475569' }}>
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
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.patientName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
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
                            {p.patientUhid && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>{p.patientUhid}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Age</label>
                  <input
                    type="text"
                    value={visitForm.patientAge}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, patientAge: e.target.value }))}
                    placeholder="e.g. 32"
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Gender</label>
                  <select
                    value={visitForm.patientGender}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, patientGender: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Phone Number</label>
                  <input
                    type="tel"
                    value={visitForm.patientPhone}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, patientPhone: e.target.value }))}
                    placeholder="10-digit mobile"
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Existing UHID (Optional)</label>
                  <input
                    type="text"
                    value={visitForm.patientUhid}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, patientUhid: e.target.value }))}
                    placeholder="UHID if known"
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Chief Complaint */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Chief Complaint & Presenting Symptoms *</label>
                <input
                  type="text"
                  required
                  value={visitForm.chiefComplaint}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                  placeholder="e.g. Severe chest pain radiating to left arm, shortness of breath"
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                />
              </div>

              {/* Triage Vitals */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={14} color="#0284c7" />
                  Initial Triage Vitals & GCS
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#64748b' }}>BP Systolic</label>
                    <input type="number" value={visitForm.bpSystolic} onChange={(e) => setVisitForm(prev => ({ ...prev, bpSystolic: e.target.value }))} style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#64748b' }}>BP Diastolic</label>
                    <input type="number" value={visitForm.bpDiastolic} onChange={(e) => setVisitForm(prev => ({ ...prev, bpDiastolic: e.target.value }))} style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Heart Rate (bpm)</label>
                    <input type="number" value={visitForm.heartRate} onChange={(e) => setVisitForm(prev => ({ ...prev, heartRate: e.target.value }))} style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#64748b' }}>SpO2 (%)</label>
                    <input type="number" value={visitForm.spo2} onChange={(e) => setVisitForm(prev => ({ ...prev, spo2: e.target.value }))} style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Temp (°F)</label>
                    <input type="text" value={visitForm.temperature} onChange={(e) => setVisitForm(prev => ({ ...prev, temperature: e.target.value }))} style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Glasgow Coma Scale (3-15)</label>
                    <input type="number" min="3" max="15" value={visitForm.gcsTotal} onChange={(e) => setVisitForm(prev => ({ ...prev, gcsTotal: e.target.value }))} style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} />
                  </div>
                </div>
              </div>

              {/* Attending & MLC Flag */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Attending Casualty Doctor</label>
                  <select
                    value={visitForm.attendingDoctorId}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, attendingDoctorId: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.specialization || 'Doctor'})</option>
                    ))}
                  </select>
                </div>

                <div style={{ paddingTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#7e22ce' }}>
                    <input
                      type="checkbox"
                      checked={visitForm.isMlc}
                      onChange={(e) => setVisitForm(prev => ({ ...prev, isMlc: e.target.checked }))}
                    />
                    ⚖️ Flag as MLC Case
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowNewVisitModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dc2626' }}>
                  <AlertOctagon size={16} />
                  Admit to ER Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Medico-Legal Case (MLC) Police Intimation & Details ──────── */}
      {activeVisitForMlc && (
        <MlcFormModal
          emergencyVisit={activeVisitForMlc}
          initialRecord={mlcRecords.find(m => m.emergencyVisitId === activeVisitForMlc.id)}
          onClose={() => setActiveVisitForMlc(null)}
          onSave={async (mlcRecord) => {
            const saved = await storage.saveMlcRecord(mlcRecord);
            notifyDataChanged('emergency');
            toast.show(`MLC Record ${saved?.mlcNumber || mlcRecord.mlcNumber || ''} registered`, 'success');
            setActiveVisitForMlc(null);
            loadEmergencyData();
          }}
          onPrint={(mlc) => setSelectedMlcToPrint(mlc)}
        />
      )}

      {/* ── Modal 3: Fast-Track Inpatient Bed Admission ───────────────────────── */}
      {activeVisitForAdmit && (
        <div className="modal-backdrop" onClick={() => setActiveVisitForAdmit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bed size={20} color="#0284c7" />
                  Fast-Track Inpatient Bed Admission
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Patient: <strong>{activeVisitForAdmit.patientName}</strong> (ER #{activeVisitForAdmit.emergencyNumber})
                </div>
              </div>
              <button type="button" onClick={() => setActiveVisitForAdmit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '1rem' }}>
                Select an available hospital bed to immediately admit this emergency patient without re-entering demographics or vitals.
              </p>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                {availableBeds.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No beds currently available. Please clean vacated beds in Beds / Census screen.
                  </div>
                ) : (
                  availableBeds.map(bed => (
                    <div
                      key={bed.id}
                      onClick={() => handleFastTrackAdmit(activeVisitForAdmit, bed)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                    >
                      <div>
                        <strong style={{ color: '#0284c7' }}>Bed {bed.bedNumber}</strong> ({bed.wardName})
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{bed.bedType} • ₹{bed.dailyRate}/day</div>
                      </div>
                      <button type="button" className="btn-primary" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                        Admit Here ➔
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setActiveVisitForAdmit(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Printable MLC Police Intimation Slip Preview ─────────────────────── */}
      {selectedMlcToPrint && (
        <div className="modal-backdrop" onClick={() => setSelectedMlcToPrint(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10600, padding: '1rem' }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '92vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>POLICE INTIMATION SLIP</h2>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Casualty & Emergency Medico-Legal Intimation</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#b91c1c' }}>{selectedMlcToPrint.mlcNumber}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Date: {selectedMlcToPrint.incidentDate}</div>
              </div>
            </div>

            <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#1e293b' }}>
              <p><strong>To:</strong> The Station House Officer (SHO), <strong>{selectedMlcToPrint.policeStation}</strong></p>
              <p>
                Sir/Madam,<br />
                Please take notice that a medico-legal patient particulars specified below has been admitted/examined in the Casualty Emergency Department:
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1rem 0', fontSize: '0.85rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px', fontWeight: 700, width: '180px' }}>Patient Name:</td><td style={{ padding: '6px' }}>{selectedMlcToPrint.patientName}</td></tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px', fontWeight: 700 }}>Age / Gender:</td><td style={{ padding: '6px' }}>{formatAgeGender(selectedMlcToPrint.patientAge, selectedMlcToPrint.patientGender)}</td></tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px', fontWeight: 700 }}>Nature of Incident:</td><td style={{ padding: '6px' }}>{selectedMlcToPrint.incidentType}</td></tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px', fontWeight: 700 }}>Brought By:</td><td style={{ padding: '6px' }}>{selectedMlcToPrint.broughtByName} {selectedMlcToPrint.broughtByPhone && `(Ph: ${selectedMlcToPrint.broughtByPhone})`}</td></tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px', fontWeight: 700 }}>Injury Details:</td><td style={{ padding: '6px' }}>{selectedMlcToPrint.injuryDescription} ({selectedMlcToPrint.injuryType} Injury)</td></tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px', fontWeight: 700 }}>Alcohol Smell Detected:</td><td style={{ padding: '6px' }}>{selectedMlcToPrint.alcoholSmellDetected ? 'YES' : 'NO'}</td></tr>
                </tbody>
              </table>

              <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', paddingTop: '1.5rem', borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Police Receiving Officer Sign / Stamp:</div>
                  <div style={{ height: '40px' }}></div>
                  <div>Name: ____________________</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Examining Casualty Medical Officer (CMO):</div>
                  <div style={{ height: '40px' }}></div>
                  <strong> {selectedMlcToPrint.doctorSignatureName}</strong>
                </div>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedMlcToPrint(null)}>Close</button>
              <button type="button" className="btn-primary" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={15} />
                Print A4 Police Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-Modal Component: Medico-Legal Case (MLC) Form ─────────────────────────
interface MlcFormModalProps {
  emergencyVisit: EmergencyVisit;
  initialRecord?: MlcRecord;
  onClose: () => void;
  onSave: (mlcRecord: Partial<MlcRecord>) => Promise<void>;
  onPrint?: (mlcRecord: MlcRecord) => void;
}

const MlcFormModal: React.FC<MlcFormModalProps> = ({ emergencyVisit, initialRecord, onClose, onSave, onPrint }) => {
  const [policeStation, setPoliceStation] = useState(initialRecord?.policeStation || 'Central Police Station');
  const [policeOfficerName, setPoliceOfficerName] = useState(initialRecord?.policeOfficerName || '');
  const [policeBadgeNumber, setPoliceBadgeNumber] = useState(initialRecord?.policeBadgeNumber || '');
  const [incidentDate, setIncidentDate] = useState(initialRecord?.incidentDate || format(new Date(), 'yyyy-MM-dd HH:mm'));
  const [incidentPlace, setIncidentPlace] = useState(initialRecord?.incidentPlace || '');
  const [incidentType, setIncidentType] = useState<any>(initialRecord?.incidentType || 'RTA');
  const [broughtByName, setBroughtByName] = useState(initialRecord?.broughtByName || 'Police Escort / Relative');
  const [broughtByPhone, setBroughtByPhone] = useState(initialRecord?.broughtByPhone || emergencyVisit.patientPhone || '');
  const [injuryDescription, setInjuryDescription] = useState(initialRecord?.injuryDescription || emergencyVisit.chiefComplaint || 'Multiple abrasions and lacerations');
  const [injuryType, setInjuryType] = useState<any>(initialRecord?.injuryType || 'SIMPLE');
  const [weaponType, setWeaponType] = useState(initialRecord?.weaponType || '');
  const [alcoholSmellDetected, setAlcoholSmellDetected] = useState(initialRecord?.alcoholSmellDetected || false);
  const [dyingDeclarationRequired, setDyingDeclarationRequired] = useState(initialRecord?.dyingDeclarationRequired || false);
  const [doctorSignatureName, setDoctorSignatureName] = useState(initialRecord?.doctorSignatureName || emergencyVisit.attendingDoctorName || 'Casualty Medical Officer');

  const buildRecord = (): Partial<MlcRecord> => ({
    id: initialRecord?.id,
    emergencyVisitId: emergencyVisit.id,
    patientId: emergencyVisit.patientId,
    patientName: emergencyVisit.patientName,
    patientAge: emergencyVisit.patientAge,
    patientGender: emergencyVisit.patientGender,
    policeStation,
    policeOfficerName: policeOfficerName.trim() || undefined,
    policeBadgeNumber: policeBadgeNumber.trim() || undefined,
    incidentDate,
    incidentPlace: incidentPlace.trim() || undefined,
    incidentType,
    broughtByName,
    broughtByPhone: broughtByPhone.trim() || undefined,
    injuryDescription,
    injuryType,
    weaponType: weaponType.trim() || undefined,
    alcoholSmellDetected,
    dyingDeclarationRequired,
    doctorSignatureName,
    intimationSentAt: initialRecord?.intimationSentAt || new Date().toISOString()
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(buildRecord());
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#7e22ce', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="#9333ea" />
              Medico-Legal Case (MLC) Registry Form
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Patient: <strong>{emergencyVisit.patientName}</strong> • ER #{emergencyVisit.emergencyNumber}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Police Station Jurisdiction *</label>
              <input type="text" required value={policeStation} onChange={(e) => setPoliceStation(e.target.value)} placeholder="e.g. City Police Station" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Incident Type *</label>
              <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}>
                <option value="RTA">Road Traffic Accident (RTA)</option>
                <option value="ASSAULT">Physical Assault</option>
                <option value="BURN">Burns / Scalds</option>
                <option value="POISONING">Poisoning / Substance</option>
                <option value="FALL">Fall from Height</option>
                <option value="INDUSTRIAL">Industrial / Workplace</option>
                <option value="OTHER">Other Trauma</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Date &amp; Time of Incident *</label>
              <input type="text" required value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} placeholder="YYYY-MM-DD HH:mm" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Place of Incident</label>
              <input type="text" value={incidentPlace} onChange={(e) => setIncidentPlace(e.target.value)} placeholder="e.g. NH-48 Highway crossroad" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Investigating Officer Name</label>
              <input type="text" value={policeOfficerName} onChange={(e) => setPoliceOfficerName(e.target.value)} placeholder="IO Name (if present)" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Officer Badge / Belt #</label>
              <input type="text" value={policeBadgeNumber} onChange={(e) => setPoliceBadgeNumber(e.target.value)} placeholder="e.g. B-4029" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Brought By (Name & Relation) *</label>
              <input type="text" required value={broughtByName} onChange={(e) => setBroughtByName(e.target.value)} placeholder="Name of Relative / Officer" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Brought By Phone</label>
              <input type="tel" value={broughtByPhone} onChange={(e) => setBroughtByPhone(e.target.value)} placeholder="Contact Phone" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Wound & Injury Clinical Description *</label>
            <textarea
              rows={3}
              required
              value={injuryDescription}
              onChange={(e) => setInjuryDescription(e.target.value)}
              placeholder="Dimensions, anatomical location, margins (clean/lacerated), depth..."
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Nature of Injury</label>
              <select value={injuryType} onChange={(e) => setInjuryType(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}>
                <option value="SIMPLE">Simple Injury</option>
                <option value="GRIEVOUS">Grievous (Fracture / Disfigurement)</option>
                <option value="DANGEROUS">Dangerous to Life (Critical)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Weapon / Object Used</label>
              <input type="text" value={weaponType} onChange={(e) => setWeaponType(e.target.value)} placeholder="Blunt weapon, sharp object, vehicular..." style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Attending Doctor / CMO Signature Name *</label>
            <input type="text" required value={doctorSignatureName} onChange={(e) => setDoctorSignatureName(e.target.value)} placeholder="e.g. Dr. A. K. Sharma (Casualty Medical Officer)" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', background: '#faf5ff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={alcoholSmellDetected} onChange={(e) => setAlcoholSmellDetected(e.target.checked)} />
              Alcohol Smell Detected
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={dyingDeclarationRequired} onChange={(e) => setDyingDeclarationRequired(e.target.checked)} />
              Dying Declaration Warranted (Magistrate)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            {onPrint && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onPrint(buildRecord() as MlcRecord)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} />
                Print Intimation
              </button>
            )}
            <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#7e22ce' }}>
              <Check size={16} />
              Save MLC Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmergencyTab;
