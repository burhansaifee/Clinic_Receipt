import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Scissors, Activity, Calendar, Clock, CheckCircle,
  Plus, Search, RefreshCw, Stethoscope, ShieldCheck,
  FileText, Check, X, Building2, Sparkles, Printer
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import '../../styles/tabs/OtManagementTab.css';
import {
  storage,
  formatAgeGender,
  notifyDataChanged,
  type OperationTheatre,
  type SurgicalCase,
  type SurgicalUrgency,
  type SurgicalCaseStatus,
  type PreAnesthesiaCheckup,
  type WhoSafetyChecklist,
  type IntraOpRecord,
  type PacuRecord,
  type OtDashboardMetrics,
  type Doctor,
  type HospitalBed,
  type GlobalPatientProfile
} from '../../lib/storage';

interface OtManagementTabProps {
  doctors: Doctor[];
  onNavigateToBed?: (bedId: string) => void;
  onNavigateToBilling?: (admissionId: string) => void;
}

export const OtManagementTab: React.FC<OtManagementTabProps> = ({
  doctors,
  onNavigateToBed: _onNavigateToBed,
  onNavigateToBilling: _onNavigateToBilling
}) => {
  const toast = useToast();

  // Core Data States
  const [theatres, setTheatres] = useState<OperationTheatre[]>([]);
  const [cases, setCases] = useState<SurgicalCase[]>([]);
  const [metrics, setMetrics] = useState<OtDashboardMetrics>({
    totalTheatres: 0,
    todayCases: 0,
    inSurgery: 0,
    inPacu: 0,
    completedSurgeries: 0
  });
  const [activeBeds, setActiveBeds] = useState<HospitalBed[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheatreFilter, setSelectedTheatreFilter] = useState('ALL');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTheatresModal, setShowTheatresModal] = useState(false);
  const [activeCaseForPac, setActiveCaseForPac] = useState<SurgicalCase | null>(null);
  const [activeCaseForWho, setActiveCaseForWho] = useState<SurgicalCase | null>(null);
  const [activeCaseForIntraOp, setActiveCaseForIntraOp] = useState<SurgicalCase | null>(null);
  const [activeCaseForPacu, setActiveCaseForPacu] = useState<SurgicalCase | null>(null);

  // Form State: Schedule Case
  const [caseForm, setCaseForm] = useState<{
    id?: string;
    patientSource: 'INPATIENT' | 'MANUAL';
    admissionId?: string;
    patientId?: string;
    patientUhid?: string;
    patientName: string;
    patientPhone?: string;
    patientAge?: string;
    patientGender?: string;
    theatreId: string;
    surgeryName: string;
    surgeryCategory: string;
    urgency: SurgicalUrgency;
    primarySurgeonId: string;
    assistantSurgeonName: string;
    anesthetistName: string;
    scrubNurseName: string;
    circulatingNurseName: string;
    scheduledDate: string;
    startTime: string;
    notes: string;
  }>({
    patientSource: 'INPATIENT',
    patientName: '',
    theatreId: '',
    surgeryName: '',
    surgeryCategory: 'GENERAL',
    urgency: 'ELECTIVE',
    primarySurgeonId: '',
    assistantSurgeonName: '',
    anesthetistName: '',
    scrubNurseName: '',
    circulatingNurseName: '',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    notes: ''
  });

  // Patient Autocomplete State
  const [patientSearchResults, setPatientSearchResults] = useState<GlobalPatientProfile[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const handlePatientNameChange = async (val: string) => {
    setCaseForm(prev => ({ ...prev, patientName: val }));
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
    setCaseForm(prev => ({
      ...prev,
      patientName: p.patientName,
      patientUhid: p.patientUhid || p.patientId || prev.patientUhid,
      patientPhone: p.patientPhone || prev.patientPhone,
      patientAge: p.patientAge ? String(p.patientAge) : prev.patientAge,
      patientGender: p.patientGender || prev.patientGender,
      primarySurgeonId: (p.lastDoctorId && doctors.some(d => d.id === p.lastDoctorId)) ? p.lastDoctorId : prev.primarySurgeonId
    }));
    setShowPatientDropdown(false);
    toast.show(`Auto-filled patient details for ${p.patientName}`, 'info');
  };

  // Load Data
  const loadOtData = async () => {
    try {
      setLoading(true);
      const [tList, cList, mData, bList] = await Promise.all([
        storage.getOperationTheatres(),
        storage.getSurgicalCases({ date: selectedDate }),
        storage.getOtDashboardMetrics(),
        storage.getBeds()
      ]);
      setTheatres(tList);
      setCases(cList);
      setMetrics(mData);
      setActiveBeds(bList.filter(b => b.status === 'occupied' && b.currentAdmissionId));
      if (tList.length > 0 && !caseForm.theatreId) {
        setCaseForm(prev => ({ ...prev, theatreId: tList[0].id }));
      }
      if (doctors.length > 0 && !caseForm.primarySurgeonId) {
        setCaseForm(prev => ({ ...prev, primarySurgeonId: doctors[0].id }));
      }
    } catch (e) {
      console.error('Failed to load OT data:', e);
      toast.show('Failed to load Operation Theatre data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOtData();
    const interval = setInterval(loadOtData, 5000); // 5s auto-refresh for LAN sync
    const handleLiveSync = (e: CustomEvent) => {
      if (!e.detail?.dataType || e.detail.dataType === 'ot' || e.detail.dataType === 'beds') {
        loadOtData();
      }
    };
    window.addEventListener('buvora-data-updated', handleLiveSync as EventListener);
    return () => {
      clearInterval(interval);
      window.removeEventListener('buvora-data-updated', handleLiveSync as EventListener);
    };
  }, [selectedDate]);

  // Filtered Cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (selectedTheatreFilter !== 'ALL' && c.theatreId !== selectedTheatreFilter) return false;
      if (selectedUrgencyFilter !== 'ALL' && c.urgency !== selectedUrgencyFilter) return false;
      if (selectedStatusFilter !== 'ALL' && c.status !== selectedStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.patientName?.toLowerCase().includes(q);
        const matchUhid = c.patientUhid?.toLowerCase().includes(q);
        const matchSurgery = c.surgeryName?.toLowerCase().includes(q);
        const matchSurgeon = c.primarySurgeonName?.toLowerCase().includes(q);
        const matchNumber = c.caseNumber?.toLowerCase().includes(q);
        if (!matchName && !matchUhid && !matchSurgery && !matchSurgeon && !matchNumber) return false;
      }
      return true;
    });
  }, [cases, selectedTheatreFilter, selectedUrgencyFilter, selectedStatusFilter, searchQuery]);

  // Handle Schedule Case Submit
  const handleScheduleCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseForm.patientName.trim()) {
      toast.show('Please enter patient name', 'warning');
      return;
    }
    if (!caseForm.surgeryName.trim()) {
      toast.show('Please enter surgery procedure name', 'warning');
      return;
    }
    const theatre = theatres.find(t => t.id === caseForm.theatreId);
    if (!theatre) {
      toast.show('Please select an operating theatre', 'warning');
      return;
    }
    const surgeon = doctors.find(d => d.id === caseForm.primarySurgeonId);

    try {
      const newCase: Partial<SurgicalCase> = {
        id: caseForm.id || 'SC-' + Date.now(),
        patientId: caseForm.patientId,
        patientUhid: caseForm.patientUhid,
        patientName: caseForm.patientName.trim(),
        patientPhone: caseForm.patientPhone,
        patientAge: caseForm.patientAge,
        patientGender: caseForm.patientGender,
        admissionId: caseForm.admissionId,
        theatreId: theatre.id,
        theatreName: theatre.name,
        surgeryName: caseForm.surgeryName.trim(),
        surgeryCategory: caseForm.surgeryCategory,
        urgency: caseForm.urgency,
        primarySurgeonId: surgeon?.id || 'DR-SURGEON',
        primarySurgeonName: surgeon?.name || 'Operating Surgeon',
        assistantSurgeonName: caseForm.assistantSurgeonName.trim() || undefined,
        anesthetistName: caseForm.anesthetistName.trim() || undefined,
        scrubNurseName: caseForm.scrubNurseName.trim() || undefined,
        circulatingNurseName: caseForm.circulatingNurseName.trim() || undefined,
        scheduledDate: caseForm.scheduledDate,
        startTime: caseForm.startTime,
        status: 'SCHEDULED',
        notes: caseForm.notes.trim() || undefined
      };

      await storage.saveSurgicalCase(newCase);
      toast.show(`Surgical case booked for ${newCase.patientName} in ${theatre.name}`, 'success');
      setShowScheduleModal(false);
      loadOtData();
    } catch (err) {
      console.error('Failed to schedule surgical case:', err);
      toast.show('Failed to book surgical case', 'error');
    }
  };

  // Handle Status Transition
  const handleStatusChange = async (c: SurgicalCase, newStatus: SurgicalCaseStatus) => {
    try {
      await storage.updateSurgicalCaseStatus(c.id, newStatus);
      toast.show(`Case ${c.caseNumber} updated to ${newStatus.replace('_', ' ')}`, 'success');
      
      // If moving to IN_THEATRE, update theatre status to IN_SURGERY
      if (newStatus === 'IN_THEATRE') {
        const theatre = theatres.find(t => t.id === c.theatreId);
        if (theatre) {
          await storage.saveOperationTheatre({ ...theatre, status: 'IN_SURGERY' });
        }
      } else if (newStatus === 'COMPLETED' || newStatus === 'RECOVERY_PACU') {
        const theatre = theatres.find(t => t.id === c.theatreId);
        if (theatre && theatre.status === 'IN_SURGERY') {
          await storage.saveOperationTheatre({ ...theatre, status: 'CLEANING' });
        }
      }
      loadOtData();
    } catch (err) {
      console.error('Failed to update case status:', err);
      toast.show('Status update failed', 'error');
    }
  };

  // Quick Inpatient Picker
  const handleSelectInpatient = (bedId: string) => {
    const bed = activeBeds.find(b => b.id === bedId);
    if (!bed) return;
    setCaseForm(prev => ({
      ...prev,
      admissionId: bed.currentAdmissionId,
      patientId: bed.patientId,
      patientUhid: bed.patientUhid || bed.patientId,
      patientName: bed.patientName || '',
      patientPhone: bed.patientPhone || '',
      patientAge: bed.patientAge,
      patientGender: bed.patientGender,
      primarySurgeonId: bed.doctorId || prev.primarySurgeonId
    }));
  };

  return (
    <div className="ot-tab-container">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scissors size={26} color="#0284c7" />
            Operation Theatre (OT) & Surgical Suites
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Surgical scheduling, Pre-Anesthesia Checkup (PAC), WHO Surgical Safety Checklist, and PACU recovery tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowTheatresModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Building2 size={15} />
            Theatres Master
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Print Surgical Day Schedule"
          >
            <Printer size={15} />
            Print Schedule
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCaseForm({
                patientSource: 'INPATIENT',
                patientName: '',
                theatreId: theatres[0]?.id || '',
                surgeryName: '',
                surgeryCategory: 'GENERAL',
                urgency: 'ELECTIVE',
                primarySurgeonId: doctors[0]?.id || '',
                assistantSurgeonName: '',
                anesthetistName: '',
                scrubNurseName: '',
                circulatingNurseName: '',
                scheduledDate: selectedDate,
                startTime: '09:00',
                notes: ''
              });
              setShowScheduleModal(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            Schedule Surgery
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ───────────────────────────────────────────────── */}
      <div className="ot-metrics-grid">
        <div className="ot-metric-card">
          <div className="ot-metric-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Active Theatres</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{theatres.length}</div>
          </div>
        </div>

        <div className="ot-metric-card">
          <div className="ot-metric-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Today's Scheduled</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{metrics.todayCases}</div>
          </div>
        </div>

        <div className="ot-metric-card">
          <div className="ot-metric-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
            <Scissors size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>In Surgery (Active)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#9333ea' }}>{metrics.inSurgery}</div>
          </div>
        </div>

        <div className="ot-metric-card">
          <div className="ot-metric-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>PACU Recovery</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>{metrics.inPacu}</div>
          </div>
        </div>

        <div className="ot-metric-card">
          <div className="ot-metric-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Completed Today</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{metrics.completedSurgeries}</div>
          </div>
        </div>
      </div>

      {/* ── Operating Theatres Status Board ──────────────────────────────────── */}
      <div>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Building2 size={16} color="#0284c7" />
          Theatres Live Status & Turnaround
        </h4>
        <div className="ot-theatres-grid">
          {theatres.map(ot => {
            const activeCase = cases.find(c => c.theatreId === ot.id && c.status === 'IN_THEATRE');
            const statusClass = `status-${ot.status.toLowerCase()}`;
            return (
              <div key={ot.id} className={`ot-room-card ${statusClass}`}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{ot.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ot.code} • {ot.floor || 'Floor 1'}</div>
                    </div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: ot.status === 'AVAILABLE' ? '#dcfce7' : ot.status === 'IN_SURGERY' ? '#f3e8ff' : ot.status === 'CLEANING' ? '#fef9c3' : '#f1f5f9',
                      color: ot.status === 'AVAILABLE' ? '#15803d' : ot.status === 'IN_SURGERY' ? '#7e22ce' : ot.status === 'CLEANING' ? '#a16207' : '#475569'
                    }}>
                      {ot.status.replace('_', ' ')}
                    </span>
                  </div>

                  {activeCase ? (
                    <div style={{ marginTop: '0.75rem', padding: '6px 8px', background: 'rgba(255,255,255,0.85)', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Active Procedure:</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{activeCase.surgeryName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#475569' }}>Pt: {activeCase.patientName} • Dr: {activeCase.primarySurgeonName}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                      Daily Tariff: ₹{Number(ot.dailyRate || 0).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Turnaround:</span>
                  <select
                    value={ot.status}
                    onChange={async (e) => {
                      const updated = { ...ot, status: e.target.value as any };
                      await storage.saveOperationTheatre(updated);
                      loadOtData();
                      toast.show(`${ot.name} marked as ${e.target.value.replace('_', ' ')}`, 'info');
                    }}
                    style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="IN_SURGERY">In Surgery</option>
                    <option value="CLEANING">Cleaning / Turnaround</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filter & Search Controls ────────────────────────────────────────── */}
      <div className="ot-filter-bar">
        <div className="ot-filter-left">
          <div className="ot-search-box">
            <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search surgery, patient, doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ot-filter-input"
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

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="ot-filter-input"
            title="Filter by Surgical Date"
          />

          <select
            value={selectedTheatreFilter}
            onChange={(e) => setSelectedTheatreFilter(e.target.value)}
            className="ot-filter-select"
            title="Filter by Operating Theatre"
          >
            <option value="ALL">All Theatres</option>
            {theatres.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select
            value={selectedUrgencyFilter}
            onChange={(e) => setSelectedUrgencyFilter(e.target.value)}
            className="ot-filter-select"
            title="Filter by Surgical Urgency"
          >
            <option value="ALL">All Urgencies</option>
            <option value="ELECTIVE">Elective</option>
            <option value="URGENT">Urgent</option>
            <option value="EMERGENCY">Emergency</option>
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="ot-filter-select"
            title="Filter by Case Status"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PREOP_PAC">Pre-Op / PAC</option>
            <option value="IN_THEATRE">In Theatre</option>
            <option value="RECOVERY_PACU">In PACU Recovery</option>
            <option value="COMPLETED">Completed</option>
          </select>

          {(searchQuery || selectedTheatreFilter !== 'ALL' || selectedUrgencyFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
            <button
              type="button"
              className="ot-filter-btn"
              onClick={() => {
                setSearchQuery('');
                setSelectedTheatreFilter('ALL');
                setSelectedUrgencyFilter('ALL');
                setSelectedStatusFilter('ALL');
              }}
              title="Reset all filters"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="ot-filter-badge">
            {filteredCases.length} {filteredCases.length === 1 ? 'Case' : 'Cases'}
          </span>
          <button
            type="button"
            className="ot-filter-btn"
            onClick={loadOtData}
            title="Refresh Surgical Cases"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Surgical Cases Roster Table ─────────────────────────────────────── */}
      <div className="ot-cases-table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', margin: 0, fontSize: '0.825rem' }}>
            <thead>
              <tr>
                <th style={{ width: '110px', textAlign: 'left' }}>Case #</th>
                <th style={{ minWidth: '180px', textAlign: 'left' }}>Patient Particulars</th>
                <th style={{ minWidth: '170px', textAlign: 'left' }}>Procedure / Surgery</th>
                <th style={{ width: '130px', textAlign: 'left' }}>Theatre & Time</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>Surgical Team</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Clinical Checks</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                <th className="no-print" style={{ width: '170px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && cases.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#0284c7' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#475569' }}>
                        Loading surgical cases &amp; theatres...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Scissors size={32} color="#94a3b8" />
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        No surgical cases scheduled for {format(parseISO(selectedDate), 'dd MMMM yyyy')}.
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setShowScheduleModal(true)}
                        style={{ marginTop: '0.5rem' }}
                      >
                        + Book Surgical Case
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCases.map(c => {
                  const urgencyClass = `ot-urgency-${c.urgency.toLowerCase()}`;
                  return (
                    <tr key={c.id}>
                      <td style={{ textAlign: 'left' }}>
                        <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{c.caseNumber}</strong>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.scheduledDate}</div>
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.patientName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          UHID: {c.patientUhid || '—'} • {formatAgeGender(c.patientAge, c.patientGender)}
                        </div>
                        {c.admissionId && (
                          <span style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            Admitted Inpatient
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.surgeryName}</div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                          <span className={`ot-urgency-badge ${urgencyClass}`}>{c.urgency}</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.surgeryCategory}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.theatreName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={12} />
                          {c.startTime}
                        </div>
                      </td>

                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}> {c.primarySurgeonName}</div>
                        {c.anesthetistName && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Anesth: {c.anesthetistName}</div>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <span
                            title={c.pacData ? `PAC Cleared: ${c.pacData.clearanceStatus} (ASA ${c.pacData.asaGrade})` : 'PAC Pending'}
                            style={{
                              padding: '2px 5px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: c.pacData?.clearanceStatus === 'FIT_FOR_SURGERY' ? '#dcfce7' : c.pacData ? '#fef3c7' : '#f1f5f9',
                              color: c.pacData?.clearanceStatus === 'FIT_FOR_SURGERY' ? '#15803d' : c.pacData ? '#b45309' : '#94a3b8'
                            }}
                          >
                            PAC
                          </span>

                          <span
                            title={c.whoChecklistData?.signOutDone ? 'WHO Checklist 100% Complete' : 'WHO Checklist Pending'}
                            style={{
                              padding: '2px 5px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: c.whoChecklistData?.signOutDone ? '#dcfce7' : '#f1f5f9',
                              color: c.whoChecklistData?.signOutDone ? '#15803d' : '#94a3b8'
                            }}
                          >
                            WHO
                          </span>

                          {c.pacuData && (
                            <span
                              title={`Aldrete Score: ${c.pacuData.aldreteScore}/10`}
                              style={{
                                padding: '2px 5px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: c.pacuData.aldreteScore >= 9 ? '#dcfce7' : '#fef3c7',
                                color: c.pacuData.aldreteScore >= 9 ? '#15803d' : '#b45309'
                              }}
                            >
                              PACU
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <select
                          value={c.status}
                          onChange={(e) => handleStatusChange(c, e.target.value as any)}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 6px',
                            borderRadius: '6px',
                            background: c.status === 'IN_THEATRE' ? '#faf5ff' : c.status === 'COMPLETED' ? '#f0fdf4' : '#f8fafc',
                            color: c.status === 'IN_THEATRE' ? '#7e22ce' : c.status === 'COMPLETED' ? '#15803d' : '#334155',
                            border: '1px solid #cbd5e1'
                          }}
                        >
                          <option value="SCHEDULED">Scheduled</option>
                          <option value="PREOP_PAC">Pre-Op / PAC</option>
                          <option value="IN_THEATRE">In Theatre</option>
                          <option value="RECOVERY_PACU">In PACU</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>

                      <td className="no-print" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div className="ot-action-btn-group">
                          {/* PAC Button */}
                          <button
                            type="button"
                            className="ot-action-icon-btn"
                            onClick={() => setActiveCaseForPac(c)}
                            title="Pre-Anesthesia Checkup (PAC) & ASA Clearance"
                            style={{ color: '#0284c7', background: '#f0f9ff', borderColor: '#bae6fd' }}
                          >
                            <Stethoscope size={14} />
                          </button>

                          {/* WHO Checklist Button */}
                          <button
                            type="button"
                            className="ot-action-icon-btn"
                            onClick={() => setActiveCaseForWho(c)}
                            title="WHO Surgical Safety Checklist (Sign In / Time Out / Sign Out)"
                            style={{ color: '#16a34a', background: '#f0fdf4', borderColor: '#bbf7d0' }}
                          >
                            <ShieldCheck size={14} />
                          </button>

                          {/* Intra-Op Notes & Implants */}
                          <button
                            type="button"
                            className="ot-action-icon-btn"
                            onClick={() => setActiveCaseForIntraOp(c)}
                            title="Intra-Op Surgery Notes & Implant Charges"
                            style={{ color: '#9333ea', background: '#faf5ff', borderColor: '#e9d5ff' }}
                          >
                            <FileText size={14} />
                          </button>

                          {/* PACU Recovery */}
                          <button
                            type="button"
                            className="ot-action-icon-btn"
                            onClick={() => setActiveCaseForPacu(c)}
                            title="PACU Aldrete Recovery Scoring & Transfer"
                            style={{ color: '#d97706', background: '#fffbeb', borderColor: '#fde68a' }}
                          >
                            <Activity size={14} />
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

      {/* ── Modal 1: Schedule Surgical Case ─────────────────────────────────── */}
      {showScheduleModal && (
        <div className="modal-backdrop" onClick={() => setShowScheduleModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scissors size={20} color="#0284c7" />
                Book Surgical Procedure
              </h3>
              <button type="button" onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleScheduleCase}>
              {/* Patient Source Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Patient Source</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="source"
                      checked={caseForm.patientSource === 'INPATIENT'}
                      onChange={() => setCaseForm(prev => ({ ...prev, patientSource: 'INPATIENT' }))}
                    />
                    Link Admitted Inpatient (IPD Bed)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="source"
                      checked={caseForm.patientSource === 'MANUAL'}
                      onChange={() => setCaseForm(prev => ({ ...prev, patientSource: 'MANUAL', admissionId: undefined }))}
                    />
                    Daycare / OPD Patient
                  </label>
                </div>
              </div>

              {caseForm.patientSource === 'INPATIENT' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Select Inpatient Bed</label>
                  <select
                    onChange={(e) => handleSelectInpatient(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Choose Admitted Patient --</option>
                    {activeBeds.map(b => (
                      <option key={b.id} value={b.id}>
                        Bed {b.bedNumber} ({b.wardName}) — {b.patientName} (UHID: {b.patientUhid || b.patientId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Patient Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Patient Name *</label>
                    {isSearchingPatient && <span style={{ fontSize: '0.7rem', color: '#0284c7' }}>Searching...</span>}
                  </div>
                  <input
                    type="text"
                    required
                    value={caseForm.patientName}
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
                    value={caseForm.patientAge || ''}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, patientAge: e.target.value }))}
                    placeholder="e.g. 45"
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Gender</label>
                  <select
                    value={caseForm.patientGender || 'Male'}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, patientGender: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Surgery Name & Urgency */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Surgery Procedure Name *</label>
                  <input
                    type="text"
                    required
                    value={caseForm.surgeryName}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, surgeryName: e.target.value }))}
                    placeholder="e.g. Laparoscopic Appendectomy"
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Urgency Level</label>
                  <select
                    value={caseForm.urgency}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, urgency: e.target.value as any }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    <option value="ELECTIVE">Elective</option>
                    <option value="URGENT">Urgent</option>
                    <option value="EMERGENCY">Emergency (STAT)</option>
                  </select>
                </div>
              </div>

              {/* Theatre & Slot */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Operating Theatre Room *</label>
                  <select
                    value={caseForm.theatreId}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, theatreId: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  >
                    {theatres.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Date</label>
                  <input
                    type="date"
                    value={caseForm.scheduledDate}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Start Time</label>
                  <input
                    type="time"
                    value={caseForm.startTime}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, startTime: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Surgical Team */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Primary Operating Surgeon *</label>
                  <select
                    value={caseForm.primarySurgeonId}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, primarySurgeonId: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.specialization || 'Surgeon'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Anesthesiologist</label>
                  <input
                    type="text"
                    value={caseForm.anesthetistName}
                    onChange={(e) => setCaseForm(prev => ({ ...prev, anesthetistName: e.target.value }))}
                    placeholder="Dr. Name (Anesthesia)"
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} />
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Pre-Anesthesia Checkup (PAC) ─────────────────────────────── */}
      {activeCaseForPac && (
        <PacModal
          surgicalCase={activeCaseForPac}
          onClose={() => setActiveCaseForPac(null)}
          onSave={async (pacData) => {
            const updated = { ...activeCaseForPac, pacData, status: pacData.clearanceStatus === 'FIT_FOR_SURGERY' ? 'PREOP_PAC' : activeCaseForPac.status };
            await storage.saveSurgicalCase(updated as any);
            notifyDataChanged('ot');
            toast.show(`PAC record saved for ${activeCaseForPac.patientName}`, 'success');
            setActiveCaseForPac(null);
            loadOtData();
          }}
        />
      )}

      {/* ── Modal 3: WHO Surgical Safety Checklist ───────────────────────────── */}
      {activeCaseForWho && (
        <WhoChecklistModal
          surgicalCase={activeCaseForWho}
          onClose={() => setActiveCaseForWho(null)}
          onSave={async (whoChecklistData) => {
            const updated = { ...activeCaseForWho, whoChecklistData };
            await storage.saveSurgicalCase(updated as any);
            notifyDataChanged('ot');
            toast.show(`WHO Surgical Safety Checklist recorded`, 'success');
            setActiveCaseForWho(null);
            loadOtData();
          }}
        />
      )}

      {/* ── Modal 4: Intra-Operative Notes & Implant Charges ─────────────────── */}
      {activeCaseForIntraOp && (
        <IntraOpModal
          surgicalCase={activeCaseForIntraOp}
          onClose={() => setActiveCaseForIntraOp(null)}
          onSave={async (intraOpNotes, charges) => {
            const updated = { ...activeCaseForIntraOp, intraOpNotes, chargesLogged: charges };
            await storage.saveSurgicalCase(updated as any);
            
            // Auto-bill charges into linked Inpatient folio if admissionId exists
            if (activeCaseForIntraOp.admissionId && charges && charges.length > 0) {
              for (const ch of charges) {
                await storage.addAdmissionCharge(activeCaseForIntraOp.admissionId, {
                  name: `[OT ${activeCaseForIntraOp.surgeryName}] ${ch.name}`,
                  category: 'SURGERY',
                  rate: ch.rate,
                  quantity: ch.quantity,
                  amount: ch.amount,
                  notes: `Logged from OT Case ${activeCaseForIntraOp.caseNumber}`
                });
              }
              toast.show(`Intra-op notes saved and ${charges.length} charges posted to Inpatient folio`, 'success');
            } else {
              toast.show('Intra-operative notes saved successfully', 'success');
            }
            notifyDataChanged('ot');
            notifyDataChanged('admission');
            setActiveCaseForIntraOp(null);
            loadOtData();
          }}
        />
      )}

      {/* ── Modal 5: PACU Recovery & Aldrete Score ────────────────────────────── */}
      {activeCaseForPacu && (
        <PacuModal
          surgicalCase={activeCaseForPacu}
          onClose={() => setActiveCaseForPacu(null)}
          onSave={async (pacuData) => {
            const newStatus = pacuData.dischargeReady ? 'COMPLETED' : 'RECOVERY_PACU';
            const updated = { ...activeCaseForPacu, pacuData, status: newStatus as any };
            await storage.saveSurgicalCase(updated as any);
            notifyDataChanged('ot');
            toast.show(`PACU recovery score saved (${pacuData.aldreteScore}/10)`, 'success');
            setActiveCaseForPacu(null);
            loadOtData();
          }}
        />
      )}

      {/* ── Modal 6: Operating Theatres Master ───────────────────────────────── */}
      {showTheatresModal && (
        <TheatresMasterModal
          theatres={theatres}
          onClose={() => setShowTheatresModal(false)}
          onRefresh={loadOtData}
        />
      )}
    </div>
  );
};

// ── Sub-Modal Component: Pre-Anesthesia Checkup (PAC) ─────────────────────────
interface PacModalProps {
  surgicalCase: SurgicalCase;
  onClose: () => void;
  onSave: (pacData: PreAnesthesiaCheckup) => Promise<void>;
}

const PacModal: React.FC<PacModalProps> = ({ surgicalCase, onClose, onSave }) => {
  const existing = surgicalCase.pacData;
  const [asaGrade, setAsaGrade] = useState<any>(existing?.asaGrade || 'ASA_I');
  const [mallampatiClass, setMallampatiClass] = useState<any>(existing?.mallampatiClass || 'CLASS_I');
  const [npoHours, setNpoHours] = useState(existing?.npoHours || 8);
  const [preOpDiagnosis, setPreOpDiagnosis] = useState(existing?.preOpDiagnosis || surgicalCase.surgeryName);
  const [airwayNotes, setAirwayNotes] = useState(existing?.airwayNotes || '');
  const [comorbidities, setComorbidities] = useState(existing?.comorbidities || '');
  const [preMedications, setPreMedications] = useState(existing?.preMedications || '');
  const [clearanceStatus, setClearanceStatus] = useState<any>(existing?.clearanceStatus || 'FIT_FOR_SURGERY');
  const [pacNotes, setPacNotes] = useState(existing?.pacNotes || '');
  const [clearedBy, setClearedBy] = useState(existing?.clearedBy || surgicalCase.anesthetistName || 'Dr. Anesthesiologist');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      asaGrade,
      mallampatiClass,
      npoHours: Number(npoHours),
      preOpDiagnosis,
      airwayNotes,
      comorbidities,
      preMedications,
      clearanceStatus,
      pacNotes,
      clearedAt: new Date().toISOString(),
      clearedBy
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Stethoscope size={20} color="#0284c7" />
              Pre-Anesthesia Checkup (PAC)
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Patient: <strong>{surgicalCase.patientName}</strong> • Case: {surgicalCase.caseNumber}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>ASA Physical Status Score *</label>
              <select value={asaGrade} onChange={(e) => setAsaGrade(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}>
                <option value="ASA_I">ASA I: Normal Healthy Patient</option>
                <option value="ASA_II">ASA II: Mild Systemic Disease</option>
                <option value="ASA_III">ASA III: Severe Systemic Disease</option>
                <option value="ASA_IV">ASA IV: Severe Disease (Threat to Life)</option>
                <option value="ASA_V">ASA V: Moribund Patient</option>
                <option value="ASA_E">ASA E: Emergency Case</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Mallampati Airway Class *</label>
              <select value={mallampatiClass} onChange={(e) => setMallampatiClass(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}>
                <option value="CLASS_I">Class I: Soft palate, uvula, pillars visible</option>
                <option value="CLASS_II">Class II: Soft palate, portion of uvula visible</option>
                <option value="CLASS_III">Class III: Soft palate, base of uvula visible</option>
                <option value="CLASS_IV">Class IV: Only hard palate visible (Difficult)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Pre-Operative Diagnosis</label>
              <input type="text" value={preOpDiagnosis} onChange={(e) => setPreOpDiagnosis(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>NPO Fasting (Hours)</label>
              <input type="number" min="0" max="24" value={npoHours} onChange={(e) => setNpoHours(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Co-Morbidities & Allergies</label>
            <input type="text" value={comorbidities} onChange={(e) => setComorbidities(e.target.value)} placeholder="e.g. Hypertension, Type 2 Diabetes, NKDA" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Airway Assessment & Dentition</label>
            <input type="text" value={airwayNotes} onChange={(e) => setAirwayNotes(e.target.value)} placeholder="Neck mobility, loose teeth, jaw opening..." style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Pre-Medications & Fasting Orders</label>
            <input type="text" value={preMedications} onChange={(e) => setPreMedications(e.target.value)} placeholder="e.g. Tab. Alprazolam 0.25mg HS, Inj. Ondansetron 4mg IV" style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>PAC Clinical Notes / Special Instructions</label>
            <textarea rows={2} value={pacNotes} onChange={(e) => setPacNotes(e.target.value)} placeholder="Difficult airway precautions, blood arrangement, cardiac risk notes..." style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Anesthesia Clearance Decision *</label>
              <select value={clearanceStatus} onChange={(e) => setClearanceStatus(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem', fontWeight: 700 }}>
                <option value="FIT_FOR_SURGERY">FIT FOR SURGERY (Cleared)</option>
                <option value="HIGH_RISK">HIGH RISK CLEARANCE (Consent Needed)</option>
                <option value="TEMPORARILY_UNFIT">TEMPORARILY UNFIT (Optimize Patient)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Examining Anesthesiologist</label>
              <input type="text" value={clearedBy} onChange={(e) => setClearedBy(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} />
              Save PAC Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Sub-Modal Component: WHO Surgical Safety Checklist ────────────────────────
interface WhoChecklistModalProps {
  surgicalCase: SurgicalCase;
  onClose: () => void;
  onSave: (whoData: WhoSafetyChecklist) => Promise<void>;
}

const WhoChecklistModal: React.FC<WhoChecklistModalProps> = ({ surgicalCase, onClose, onSave }) => {
  const existing = surgicalCase.whoChecklistData;
  const [activeStage, setActiveStage] = useState<'SIGN_IN' | 'TIME_OUT' | 'SIGN_OUT'>('SIGN_IN');

  // Sign In State (Before Induction)
  const [signIn, setSignIn] = useState({
    confirmedIdentity: existing?.signIn?.confirmedIdentity || false,
    siteMarked: existing?.signIn?.siteMarked || false,
    anesthesiaSafetyCheck: existing?.signIn?.anesthesiaSafetyCheck || false,
    pulseOximeter: existing?.signIn?.pulseOximeter || false,
    allergyRisk: existing?.signIn?.allergyRisk || false,
    difficultAirwayRisk: existing?.signIn?.difficultAirwayRisk || false,
    bloodLossRisk: existing?.signIn?.bloodLossRisk || false
  });

  // Time Out State (Before Incision)
  const [timeOut, setTimeOut] = useState({
    teamIntroduced: existing?.timeOut?.teamIntroduced || false,
    patientNameProcedureConfirmed: existing?.timeOut?.patientNameProcedureConfirmed || false,
    criticalStepsReviewed: existing?.timeOut?.criticalStepsReviewed || false,
    antibioticProphylaxisGiven: existing?.timeOut?.antibioticProphylaxisGiven || false,
    imagingDisplayed: existing?.timeOut?.imagingDisplayed || false
  });

  // Sign Out State (Before Leaving OT)
  const [signOut, setSignOut] = useState({
    procedureNameRecorded: existing?.signOut?.procedureNameRecorded || false,
    countCorrect: existing?.signOut?.countCorrect || false,
    specimenLabeled: existing?.signOut?.specimenLabeled || false,
    equipmentIssues: existing?.signOut?.equipmentIssues || false,
    recoveryConcerns: existing?.signOut?.recoveryConcerns || false
  });

  const handleSave = () => {
    const isSignInDone = signIn.confirmedIdentity && signIn.anesthesiaSafetyCheck && signIn.pulseOximeter;
    const isTimeOutDone = timeOut.patientNameProcedureConfirmed && timeOut.criticalStepsReviewed;
    const isSignOutDone = signOut.procedureNameRecorded && signOut.countCorrect;

    onSave({
      signInDone: isSignInDone,
      signIn,
      timeOutDone: isTimeOutDone,
      timeOut,
      signOutDone: isSignOutDone,
      signOut,
      verifiedBy: 'Surgical Team Sign-off',
      completedAt: new Date().toISOString()
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#16a34a" />
              WHO Surgical Safety Checklist
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {surgicalCase.patientName} • {surgicalCase.surgeryName}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Phase Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setActiveStage('SIGN_IN')}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: activeStage === 'SIGN_IN' ? '#0284c7' : '#f8fafc',
              color: activeStage === 'SIGN_IN' ? 'white' : '#334155',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            1. SIGN IN (Pre-Induction)
          </button>
          <button
            type="button"
            onClick={() => setActiveStage('TIME_OUT')}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: activeStage === 'TIME_OUT' ? '#0284c7' : '#f8fafc',
              color: activeStage === 'TIME_OUT' ? 'white' : '#334155',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            2. TIME OUT (Pre-Incision)
          </button>
          <button
            type="button"
            onClick={() => setActiveStage('SIGN_OUT')}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: activeStage === 'SIGN_OUT' ? '#0284c7' : '#f8fafc',
              color: activeStage === 'SIGN_OUT' ? 'white' : '#334155',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            3. SIGN OUT (Pre-Exit)
          </button>
        </div>

        {/* Tab 1: Sign In */}
        {activeStage === 'SIGN_IN' && (
          <div>
            <div style={{ fontSize: '0.82rem', color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: '8px', marginBottom: '1rem', fontWeight: 600 }}>
              Phase 1: Before induction of anesthesia with nurse and anesthetist.
            </div>

            <label className={`ot-checklist-item ${signIn.confirmedIdentity ? 'checked' : ''}`}>
              <input type="checkbox" checked={signIn.confirmedIdentity} onChange={(e) => setSignIn(prev => ({ ...prev, confirmedIdentity: e.target.checked }))} />
              <div>
                <strong>Patient Identity & Consent Confirmed</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Patient has verbally confirmed identity, surgical site, procedure, and signed consent.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${signIn.siteMarked ? 'checked' : ''}`}>
              <input type="checkbox" checked={signIn.siteMarked} onChange={(e) => setSignIn(prev => ({ ...prev, siteMarked: e.target.checked }))} />
              <div>
                <strong>Surgical Site Marked by Surgeon</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Surgical mark visible and verified against operative consent (or not applicable for midline).</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${signIn.anesthesiaSafetyCheck ? 'checked' : ''}`}>
              <input type="checkbox" checked={signIn.anesthesiaSafetyCheck} onChange={(e) => setSignIn(prev => ({ ...prev, anesthesiaSafetyCheck: e.target.checked }))} />
              <div>
                <strong>Anesthesia Machine & Medication Check Complete</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Vaporizers, suction, oxygen source, and emergency emergency resuscitation drugs checked.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${signIn.pulseOximeter ? 'checked' : ''}`}>
              <input type="checkbox" checked={signIn.pulseOximeter} onChange={(e) => setSignIn(prev => ({ ...prev, pulseOximeter: e.target.checked }))} />
              <div>
                <strong>Pulse Oximeter Connected & Functioning</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Active audible plethysmograph and reliable SpO2 reading on patient.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${signIn.difficultAirwayRisk ? 'checked' : ''}`}>
              <input type="checkbox" checked={signIn.difficultAirwayRisk} onChange={(e) => setSignIn(prev => ({ ...prev, difficultAirwayRisk: e.target.checked }))} />
              <div>
                <strong>Difficult Airway / Aspiration Risk Assessed</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Equipment (video laryngoscope, bougie, LMA) and skilled assistance readily available.</div>
              </div>
            </label>
          </div>
        )}

        {/* Tab 2: Time Out */}
        {activeStage === 'TIME_OUT' && (
          <div>
            <div style={{ fontSize: '0.82rem', color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: '8px', marginBottom: '1rem', fontWeight: 600 }}>
              Phase 2: Before skin incision with full team (Surgeon, Anesthetist, Scrub Nurse).
            </div>

            <label className={`ot-checklist-item ${timeOut.teamIntroduced ? 'checked' : ''}`}>
              <input type="checkbox" checked={timeOut.teamIntroduced} onChange={(e) => setTimeOut(prev => ({ ...prev, teamIntroduced: e.target.checked }))} />
              <div>
                <strong>Team Introductions</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>All team members introduced themselves by name and role.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${timeOut.patientNameProcedureConfirmed ? 'checked' : ''}`}>
              <input type="checkbox" checked={timeOut.patientNameProcedureConfirmed} onChange={(e) => setTimeOut(prev => ({ ...prev, patientNameProcedureConfirmed: e.target.checked }))} />
              <div>
                <strong>Verbal Confirmation of Patient, Procedure, and Incision Site</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Surgeon, Anesthetist, and Nurse verbally agree on procedure and incision location.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${timeOut.criticalStepsReviewed ? 'checked' : ''}`}>
              <input type="checkbox" checked={timeOut.criticalStepsReviewed} onChange={(e) => setTimeOut(prev => ({ ...prev, criticalStepsReviewed: e.target.checked }))} />
              <div>
                <strong>Anticipated Critical Events Reviewed</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Operative duration, anticipated blood loss, and anesthesia concerns verbalized.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${timeOut.antibioticProphylaxisGiven ? 'checked' : ''}`}>
              <input type="checkbox" checked={timeOut.antibioticProphylaxisGiven} onChange={(e) => setTimeOut(prev => ({ ...prev, antibioticProphylaxisGiven: e.target.checked }))} />
              <div>
                <strong>Antibiotic Prophylaxis Administered Within Last 60 Minutes</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Prophylactic IV antibiotic completed or not indicated.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${timeOut.imagingDisplayed ? 'checked' : ''}`}>
              <input type="checkbox" checked={timeOut.imagingDisplayed} onChange={(e) => setTimeOut(prev => ({ ...prev, imagingDisplayed: e.target.checked }))} />
              <div>
                <strong>Essential Diagnostic Imaging Displayed</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>X-Ray, CT, or MRI displayed on theatre viewing box or digital screen.</div>
              </div>
            </label>
          </div>
        )}

        {/* Tab 3: Sign Out */}
        {activeStage === 'SIGN_OUT' && (
          <div>
            <div style={{ fontSize: '0.82rem', color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: '8px', marginBottom: '1rem', fontWeight: 600 }}>
              Phase 3: Before patient leaves operating room.
            </div>

            <label className={`ot-checklist-item ${signOut.procedureNameRecorded ? 'checked' : ''}`}>
              <input type="checkbox" checked={signOut.procedureNameRecorded} onChange={(e) => setSignOut(prev => ({ ...prev, procedureNameRecorded: e.target.checked }))} />
              <div>
                <strong>Exact Name of Procedure Recorded</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Nurse verbally confirms operative procedure name matches surgical log.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${signOut.countCorrect ? 'checked' : ''}`}>
              <input type="checkbox" checked={signOut.countCorrect} onChange={(e) => setSignOut(prev => ({ ...prev, countCorrect: e.target.checked }))} />
              <div>
                <strong>Instrument, Sponge, and Needle Counts are Correct</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Dual scrub nurse count verified 100% correct with no missing swabs or sharps.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${signOut.specimenLabeled ? 'checked' : ''}`}>
              <input type="checkbox" checked={signOut.specimenLabeled} onChange={(e) => setSignOut(prev => ({ ...prev, specimenLabeled: e.target.checked }))} />
              <div>
                <strong>Specimens Correctly Labeled (Including Patient Name & UHID)</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Histopathology biopsy jar verified and labeled at bedside.</div>
              </div>
            </label>

            <label className={`ot-checklist-item ${signOut.recoveryConcerns ? 'checked' : ''}`}>
              <input type="checkbox" checked={signOut.recoveryConcerns} onChange={(e) => setSignOut(prev => ({ ...prev, recoveryConcerns: e.target.checked }))} />
              <div>
                <strong>Post-Op PACU Recovery & Pain Management Plan Verbalized</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Analgesia, post-op vitals frequency, and destination (ICU vs Ward) confirmed.</div>
              </div>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} />
            Save Checklist Sign-off
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Sub-Modal Component: Intra-Operative Notes & Implants Logger ───────────────
interface IntraOpModalProps {
  surgicalCase: SurgicalCase;
  onClose: () => void;
  onSave: (notes: IntraOpRecord, charges: any[]) => Promise<void>;
}

const IntraOpModal: React.FC<IntraOpModalProps> = ({ surgicalCase, onClose, onSave }) => {
  const existing = surgicalCase.intraOpNotes;
  const [anesthesiaType, setAnesthesiaType] = useState<any>(existing?.anesthesiaType || 'GENERAL');
  const [surgicalTechnique, setSurgicalTechnique] = useState(existing?.surgicalTechnique || '');
  const [findings, setFindings] = useState(existing?.findings || '');
  const [bloodLossMl, setBloodLossMl] = useState(existing?.bloodLossMl || 50);
  const [fluidsInfusedMl, setFluidsInfusedMl] = useState(existing?.fluidsInfusedMl || 1000);
  const [urineOutputMl, setUrineOutputMl] = useState(existing?.urineOutputMl || 250);
  const [surgeonNotes, setSurgeonNotes] = useState(existing?.surgeonNotes || '');
  const [implants, setImplants] = useState<Array<{ name: string; serialNumber?: string; cost?: number }>>(
    existing?.implantsUsed || []
  );

  // New implant adder
  const [newImplantName, setNewImplantName] = useState('');
  const [newImplantSerial, setNewImplantSerial] = useState('');
  const [newImplantCost, setNewImplantCost] = useState('');

  const handleAddImplant = () => {
    if (!newImplantName.trim()) return;
    setImplants(prev => [
      ...prev,
      {
        name: newImplantName.trim(),
        serialNumber: newImplantSerial.trim() || undefined,
        cost: Number(newImplantCost) || 0
      }
    ]);
    setNewImplantName('');
    setNewImplantSerial('');
    setNewImplantCost('');
  };

  const handleSave = () => {
    const notes: IntraOpRecord = {
      anesthesiaType,
      surgicalTechnique,
      findings,
      implantsUsed: implants,
      bloodLossMl: Number(bloodLossMl),
      fluidsInfusedMl: Number(fluidsInfusedMl),
      urineOutputMl: Number(urineOutputMl),
      surgeonNotes
    };

    // Auto-prepare charges list
    const charges: any[] = [];
    implants.forEach((imp, i) => {
      if (imp.cost && imp.cost > 0) {
        charges.push({
          id: `IMP-${Date.now()}-${i}`,
          name: `Surgical Implant: ${imp.name}${imp.serialNumber ? ` (#${imp.serialNumber})` : ''}`,
          rate: imp.cost,
          quantity: 1,
          amount: imp.cost
        });
      }
    });

    onSave(notes, charges);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#9333ea" />
              Intra-Operative Notes & Implants
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {surgicalCase.patientName} • {surgicalCase.surgeryName}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Anesthesia Technique</label>
              <select value={anesthesiaType} onChange={(e) => setAnesthesiaType(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}>
                <option value="GENERAL">General Anesthesia (GA)</option>
                <option value="SPINAL">Spinal Anesthesia (SAB)</option>
                <option value="EPIDURAL">Epidural Anesthesia</option>
                <option value="REGIONAL_BLOCK">Regional Nerve Block</option>
                <option value="MAC_SEDATION">Monitored Anesthesia Care (MAC)</option>
                <option value="LOCAL">Local Infiltration</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Urine Output (mL)</label>
              <input type="number" value={urineOutputMl} onChange={(e) => setUrineOutputMl(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Blood Loss (mL)</label>
              <input type="number" value={bloodLossMl} onChange={(e) => setBloodLossMl(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Fluids Infused (mL)</label>
              <input type="number" value={fluidsInfusedMl} onChange={(e) => setFluidsInfusedMl(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Operative Technique & Procedure Steps</label>
            <textarea
              rows={3}
              value={surgicalTechnique}
              onChange={(e) => setSurgicalTechnique(e.target.value)}
              placeholder="Incision details, anatomical approach, closure..."
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Surgical Findings</label>
            <textarea
              rows={2}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Pathology observed, tissue condition, histology specimen taken..."
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Surgeon Notes &amp; Post-Op Instructions</label>
            <textarea
              rows={2}
              value={surgeonNotes}
              onChange={(e) => setSurgeonNotes(e.target.value)}
              placeholder="Post-operative orders, drain care, wound dressing, recovery instructions..."
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* Implants Tracker */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#0284c7" />
              Surgical Implants & Prosthetics (Auto-Billed to Inpatient Bill)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto', gap: '6px', marginBottom: '0.5rem' }}>
              <input
                type="text"
                placeholder="Implant Name (e.g. Mesh 15x15)"
                value={newImplantName}
                onChange={(e) => setNewImplantName(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              />
              <input
                type="text"
                placeholder="Serial / Lot #"
                value={newImplantSerial}
                onChange={(e) => setNewImplantSerial(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              />
              <input
                type="number"
                placeholder="Cost (₹)"
                value={newImplantCost}
                onChange={(e) => setNewImplantCost(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              />
              <button type="button" onClick={handleAddImplant} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                Add
              </button>
            </div>

            {implants.length > 0 && (
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                {implants.map((imp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '3px 0' }}>
                    <span><strong>{imp.name}</strong> {imp.serialNumber && `(Lot: ${imp.serialNumber})`}</span>
                    <span>₹{Number(imp.cost || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} />
              Save Intra-Op Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-Modal Component: PACU Recovery (Modified Aldrete Score) ────────────────
interface PacuModalProps {
  surgicalCase: SurgicalCase;
  onClose: () => void;
  onSave: (pacuData: PacuRecord) => Promise<void>;
}

const PacuModal: React.FC<PacuModalProps> = ({ surgicalCase, onClose, onSave }) => {
  const existing = surgicalCase.pacuData;
  const [activity, setActivity] = useState(existing?.activity ?? 2);
  const [respiration, setRespiration] = useState(existing?.respiration ?? 2);
  const [circulation, setCirculation] = useState(existing?.circulation ?? 2);
  const [consciousness, setConsciousness] = useState(existing?.consciousness ?? 2);
  const [o2Sat, setO2Sat] = useState(existing?.o2Saturation ?? 2);
  const [transferredTo, setTransferredTo] = useState<any>(existing?.transferredTo || 'WARD');
  const [pacuNotes, setPacuNotes] = useState(existing?.pacuNurseNotes || '');

  const totalScore = activity + respiration + circulation + consciousness + o2Sat;
  const isReady = totalScore >= 9;

  const handleSave = () => {
    onSave({
      aldreteScore: totalScore,
      activity,
      respiration,
      circulation,
      consciousness,
      o2Saturation: o2Sat,
      transferredTo,
      dischargeReady: isReady,
      pacuNurseNotes: pacuNotes,
      dischargedFromPacuAt: isReady ? new Date().toISOString() : undefined
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#d97706" />
              Post-Anesthesia Care Unit (PACU) Recovery
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Modified Aldrete Score: <strong>{totalScore} / 10</strong> ({isReady ? '✅ Safe to Discharge to Ward/ICU' : '⚠️ Continue Recovery Monitoring'})
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div>
          {/* Aldrete Criteria */}
          <div className="ot-aldrete-row">
            <strong>1. Muscle Activity</strong>
            <div className="ot-aldrete-options">
              <button type="button" className={`ot-aldrete-btn ${activity === 2 ? 'selected' : ''}`} onClick={() => setActivity(2)}>Moves 4 limbs (2)</button>
              <button type="button" className={`ot-aldrete-btn ${activity === 1 ? 'selected' : ''}`} onClick={() => setActivity(1)}>Moves 2 limbs (1)</button>
              <button type="button" className={`ot-aldrete-btn ${activity === 0 ? 'selected' : ''}`} onClick={() => setActivity(0)}>Unable (0)</button>
            </div>
          </div>

          <div className="ot-aldrete-row">
            <strong>2. Respiration</strong>
            <div className="ot-aldrete-options">
              <button type="button" className={`ot-aldrete-btn ${respiration === 2 ? 'selected' : ''}`} onClick={() => setRespiration(2)}>Breathes deep & coughs (2)</button>
              <button type="button" className={`ot-aldrete-btn ${respiration === 1 ? 'selected' : ''}`} onClick={() => setRespiration(1)}>Dyspneic / shallow (1)</button>
              <button type="button" className={`ot-aldrete-btn ${respiration === 0 ? 'selected' : ''}`} onClick={() => setRespiration(0)}>Apneic (0)</button>
            </div>
          </div>

          <div className="ot-aldrete-row">
            <strong>3. Circulation</strong>
            <div className="ot-aldrete-options">
              <button type="button" className={`ot-aldrete-btn ${circulation === 2 ? 'selected' : ''}`} onClick={() => setCirculation(2)}>BP ±20% pre-op (2)</button>
              <button type="button" className={`ot-aldrete-btn ${circulation === 1 ? 'selected' : ''}`} onClick={() => setCirculation(1)}>BP ±20-50% (1)</button>
              <button type="button" className={`ot-aldrete-btn ${circulation === 0 ? 'selected' : ''}`} onClick={() => setCirculation(0)}>BP ±50% (0)</button>
            </div>
          </div>

          <div className="ot-aldrete-row">
            <strong>4. Consciousness</strong>
            <div className="ot-aldrete-options">
              <button type="button" className={`ot-aldrete-btn ${consciousness === 2 ? 'selected' : ''}`} onClick={() => setConsciousness(2)}>Fully awake (2)</button>
              <button type="button" className={`ot-aldrete-btn ${consciousness === 1 ? 'selected' : ''}`} onClick={() => setConsciousness(1)}>Arousable on calling (1)</button>
              <button type="button" className={`ot-aldrete-btn ${consciousness === 0 ? 'selected' : ''}`} onClick={() => setConsciousness(0)}>Not responding (0)</button>
            </div>
          </div>

          <div className="ot-aldrete-row">
            <strong>5. O2 Saturation</strong>
            <div className="ot-aldrete-options">
              <button type="button" className={`ot-aldrete-btn ${o2Sat === 2 ? 'selected' : ''}`} onClick={() => setO2Sat(2)}>SpO2 &gt;92% room air (2)</button>
              <button type="button" className={`ot-aldrete-btn ${o2Sat === 1 ? 'selected' : ''}`} onClick={() => setO2Sat(1)}>Needs O2 to maintain &gt;90% (1)</button>
              <button type="button" className={`ot-aldrete-btn ${o2Sat === 0 ? 'selected' : ''}`} onClick={() => setO2Sat(0)}>SpO2 &lt;90% with O2 (0)</button>
            </div>
          </div>

          {/* Disposition */}
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Transfer Destination</label>
              <select value={transferredTo} onChange={(e) => setTransferredTo(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}>
                <option value="WARD">Inpatient Ward</option>
                <option value="ICU">Intensive Care Unit (ICU)</option>
                <option value="DAYCARE_DISCHARGE">Daycare Discharge (Home)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>PACU Nurse Observations</label>
              <input type="text" value={pacuNotes} onChange={(e) => setPacuNotes(e.target.value)} placeholder="Pain score, antiemetic given, vitals stable..." style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} />
              Save Recovery Score
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-Modal Component: Operating Theatres Master ────────────────────────────
interface TheatresMasterModalProps {
  theatres: OperationTheatre[];
  onClose: () => void;
  onRefresh: () => void;
}

const TheatresMasterModal: React.FC<TheatresMasterModalProps> = ({ theatres, onClose, onRefresh }) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [floor, setFloor] = useState('1st Floor');
  const [theatreType, setTheatreType] = useState<any>('MAJOR');
  const [dailyRate, setDailyRate] = useState(5000);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await storage.saveOperationTheatre({
        name: name.trim(),
        code: code.trim() || 'OT-' + (theatres.length + 1),
        floor,
        theatreType,
        dailyRate: Number(dailyRate) || 0,
        status: 'AVAILABLE'
      });
      toast.show('Operating Theatre added', 'success');
      setName('');
      setCode('');
      onRefresh();
    } catch (err) {
      toast.show('Failed to save theatre', 'error');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10500, padding: '1rem' }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={20} color="#0284c7" />
            Operating Theatres Directory
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Existing Theatres */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Configured Theatres</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {theatres.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <strong>{t.name}</strong> ({t.code})
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.floor} • Rate: ₹{t.dailyRate || 0}</div>
                </div>
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Add New Theatre */}
        <form onSubmit={handleCreate} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>+ Add New Theatre Room</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input type="text" placeholder="Theatre Name (e.g. OT 3 - ENT Suite)" required value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.4rem' }} />
            <input type="text" placeholder="Code (e.g. OT-3)" value={code} onChange={(e) => setCode(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.4rem' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
            <input type="text" placeholder="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.4rem' }} />
            <select value={theatreType} onChange={(e) => setTheatreType(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.4rem' }}>
              <option value="MAJOR">Major OT</option>
              <option value="MINOR">Minor OT</option>
              <option value="MODULAR">Modular OT</option>
              <option value="CATH_LAB">Cath Lab</option>
              <option value="DAYCARE">Daycare</option>
            </select>
            <input type="number" placeholder="Daily Tariff ₹" value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} style={{ fontSize: '0.85rem', padding: '0.4rem' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary">Add Theatre</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OtManagementTab;
