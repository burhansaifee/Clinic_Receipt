import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Pill, Activity, Droplets, ClipboardList,
  Plus, Check, X, Clock, AlertTriangle, AlertCircle,
  CheckCircle2, ShieldAlert, Trash2, Heart,
  TrendingUp, FileText, Sparkles, Send
} from 'lucide-react';
import { useToast } from '../../ui/Toast';
import { useConfirm } from '../../ui/ConfirmDialog';
import '../../../styles/tabs/EmarNursing.css';
import {
  storage,
  calculateNews2,
  type BedAdmission,
  type EmarMedicationOrder,
  type EmarAdministrationRecord,
  type AdmissionVital,
  type FluidIoRecord,
  type NursingShiftNote,
  type HospitalBed
} from '../../../lib/storage';

interface EmarNursingModalProps {
  bed: HospitalBed;
  admission: BedAdmission;
  currentUser?: string;
  onClose: () => void;
  onAdmissionUpdated: () => void;
}

export const EmarNursingModal: React.FC<EmarNursingModalProps> = ({
  bed,
  admission,
  currentUser = 'Duty Nurse',
  onClose,
  onAdmissionUpdated
}) => {
  const toast = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<'emar' | 'vitals' | 'fluid' | 'sbar'>('emar');

  // Sub-modal states
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showAdministerModal, setShowAdministerModal] = useState(false);
  const [selectedOrderForAdmin, setSelectedOrderForAdmin] = useState<EmarMedicationOrder | null>(null);
  const [selectedTimeSlotForAdmin, setSelectedTimeSlotForAdmin] = useState<string>('');

  const [showAddVitalModal, setShowAddVitalModal] = useState(false);
  const [showAddFluidModal, setShowAddFluidModal] = useState(false);
  const [showAddSbarModal, setShowAddSbarModal] = useState(false);

  // Parsed logs from admission record
  const emarOrders: EmarMedicationOrder[] = useMemo(() => {
    try {
      return JSON.parse(admission.emarOrdersLog || '[]');
    } catch {
      return [];
    }
  }, [admission.emarOrdersLog]);

  const emarAdminLogs: EmarAdministrationRecord[] = useMemo(() => {
    try {
      return JSON.parse(admission.emarAdminLog || '[]');
    } catch {
      return [];
    }
  }, [admission.emarAdminLog]);

  const vitalsLog: AdmissionVital[] = useMemo(() => {
    try {
      return JSON.parse(admission.vitalsLog || '[]');
    } catch {
      return [];
    }
  }, [admission.vitalsLog]);

  const fluidIoLog: FluidIoRecord[] = useMemo(() => {
    try {
      return JSON.parse(admission.fluidIoLog || '[]');
    } catch {
      return [];
    }
  }, [admission.fluidIoLog]);

  const nursingNotes: NursingShiftNote[] = useMemo(() => {
    try {
      return JSON.parse(admission.nursingNotesLog || '[]');
    } catch {
      return [];
    }
  }, [admission.nursingNotesLog]);

  // Latest Vital & NEWS2 Assessment
  const latestVital: AdmissionVital | null = vitalsLog[0] || null;
  const latestNews2 = useMemo(() => {
    if (!latestVital) return null;
    return calculateNews2(latestVital);
  }, [latestVital]);

  // 24h Fluid Balance Calculation
  const fluidStats = useMemo(() => {
    let totalIntake = 0;
    let totalOutput = 0;
    fluidIoLog.forEach(f => {
      if (f.type === 'INTAKE') totalIntake += Number(f.volumeMl) || 0;
      if (f.type === 'OUTPUT') totalOutput += Number(f.volumeMl) || 0;
    });
    const balance = totalIntake - totalOutput;
    return { totalIntake, totalOutput, balance };
  }, [fluidIoLog]);

  // ── eMAR Order Form State ──────────────────────────────────────────────────
  const [orderForm, setOrderForm] = useState({
    drugName: '',
    dosage: '1 Tab',
    route: 'Oral' as EmarMedicationOrder['route'],
    frequency: 'BD' as EmarMedicationOrder['frequency'],
    scheduleTimesText: '08:00, 20:00',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    isHighAlert: false,
    isLasa: false,
    specialInstructions: ''
  });

  const handleFrequencyChange = (freq: EmarMedicationOrder['frequency']) => {
    let defaultTimes = '08:00';
    if (freq === 'BD') defaultTimes = '08:00, 20:00';
    else if (freq === 'TDS') defaultTimes = '08:00, 14:00, 20:00';
    else if (freq === 'QID') defaultTimes = '06:00, 12:00, 18:00, 22:00';
    else if (freq === 'STAT') defaultTimes = format(new Date(), 'HH:mm');
    else if (freq === 'PRN') defaultTimes = 'PRN / As Needed';
    else if (freq === 'Q4H') defaultTimes = '00:00, 04:00, 08:00, 12:00, 16:00, 20:00';
    else if (freq === 'Q6H') defaultTimes = '06:00, 12:00, 18:00, 00:00';
    else if (freq === 'Q8H') defaultTimes = '06:00, 14:00, 22:00';
    else if (freq === 'Q12H') defaultTimes = '08:00, 20:00';

    setOrderForm(prev => ({
      ...prev,
      frequency: freq,
      scheduleTimesText: defaultTimes
    }));
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.drugName.trim()) {
      toast('Please enter drug name', { type: 'error' });
      return;
    }

    const times = orderForm.scheduleTimesText
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    try {
      await storage.addEmarOrder(admission.id, {
        drugName: orderForm.drugName.trim(),
        dosage: orderForm.dosage,
        route: orderForm.route,
        frequency: orderForm.frequency,
        scheduleTimes: times.length > 0 ? times : ['08:00'],
        startDate: orderForm.startDate,
        prescribedBy: admission.doctorName,
        isHighAlert: orderForm.isHighAlert,
        isLasa: orderForm.isLasa,
        specialInstructions: orderForm.specialInstructions
      });
      toast('Medication order scheduled successfully', { type: 'success' });
      setShowAddOrderModal(false);
      setOrderForm({
        drugName: '',
        dosage: '1 Tab',
        route: 'Oral',
        frequency: 'BD',
        scheduleTimesText: '08:00, 20:00',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        isHighAlert: false,
        isLasa: false,
        specialInstructions: ''
      });
      onAdmissionUpdated();
    } catch (err) {
      console.error(err);
      toast('Failed to schedule medication order', { type: 'error' });
    }
  };

  // ── eMAR Administer Dose Form State ────────────────────────────────────────
  const [adminForm, setAdminForm] = useState({
    status: 'GIVEN' as 'GIVEN' | 'HELD' | 'REFUSED' | 'MISSED',
    administeredBy: currentUser,
    dualSignOffBy: '',
    preBp: '120/80',
    prePulse: '75',
    preSugar: '',
    reasonOrNotes: ''
  });

  const handleOpenAdministerModal = (order: EmarMedicationOrder, timeSlot: string) => {
    setSelectedOrderForAdmin(order);
    setSelectedTimeSlotForAdmin(timeSlot);
    setAdminForm({
      status: 'GIVEN',
      administeredBy: currentUser,
      dualSignOffBy: '',
      preBp: latestVital ? `${latestVital.bpSystolic || 120}/${latestVital.bpDiastolic || 80}` : '120/80',
      prePulse: latestVital ? `${latestVital.pulse || 72}` : '72',
      preSugar: latestVital?.bloodSugar ? `${latestVital.bloodSugar}` : '',
      reasonOrNotes: ''
    });
    setShowAdministerModal(true);
  };

  const handleSaveAdministration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForAdmin) return;

    if (selectedOrderForAdmin.isHighAlert && adminForm.status === 'GIVEN' && !adminForm.dualSignOffBy.trim()) {
      toast('High-Alert medication requires secondary nurse dual sign-off', { type: 'error' });
      return;
    }

    try {
      await storage.recordEmarAdministration(admission.id, {
        orderId: selectedOrderForAdmin.id,
        drugName: selectedOrderForAdmin.drugName,
        dosageGiven: selectedOrderForAdmin.dosage,
        routeGiven: selectedOrderForAdmin.route,
        scheduledTime: selectedTimeSlotForAdmin,
        status: adminForm.status,
        administeredBy: adminForm.administeredBy,
        dualSignOffBy: adminForm.dualSignOffBy,
        preVitalCheck: {
          bp: adminForm.preBp,
          pulse: adminForm.prePulse,
          sugar: adminForm.preSugar
        },
        reasonOrNotes: adminForm.reasonOrNotes
      });
      toast(`Dose recorded as ${adminForm.status}`, { type: 'success' });
      setShowAdministerModal(false);
      onAdmissionUpdated();
    } catch (err) {
      console.error(err);
      toast('Failed to record dose administration', { type: 'error' });
    }
  };

  // ── Vitals & NEWS2 Form State ──────────────────────────────────────────────
  const [vitalForm, setVitalForm] = useState({
    bpSystolic: '120',
    bpDiastolic: '80',
    pulse: '76',
    temp: '98.6',
    spo2: '99',
    onOxygen: false,
    oxygenFlowRate: '2',
    respiratoryRate: '16',
    avpu: 'Alert' as 'Alert' | 'Voice' | 'Pain' | 'Unresponsive',
    painScale: 0,
    bloodSugar: '',
    notes: '',
    recordedBy: currentUser
  });

  const previewNews2 = useMemo(() => {
    return calculateNews2({
      bpSystolic: vitalForm.bpSystolic,
      pulse: vitalForm.pulse,
      temp: vitalForm.temp,
      spo2: vitalForm.spo2,
      onOxygen: vitalForm.onOxygen,
      respiratoryRate: vitalForm.respiratoryRate,
      avpu: vitalForm.avpu
    });
  }, [vitalForm]);

  const handleSaveVital = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const calc = calculateNews2(vitalForm);
      await storage.addAdmissionVital(admission.id, {
        ...vitalForm,
        news2Score: calc.score,
        news2Risk: calc.risk
      });
      toast('Vitals and NEWS2 score recorded', { type: 'success' });
      setShowAddVitalModal(false);
      onAdmissionUpdated();
    } catch (err) {
      console.error(err);
      toast('Failed to save vitals', { type: 'error' });
    }
  };

  // ── Fluid I/O Form State ───────────────────────────────────────────────────
  const [fluidForm, setFluidForm] = useState({
    type: 'INTAKE' as 'INTAKE' | 'OUTPUT',
    category: 'IV_CRYSTALLOID' as FluidIoRecord['category'],
    label: '0.9% Normal Saline 500mL IV',
    volumeMl: 500,
    recordedBy: currentUser,
    notes: ''
  });

  const handleFluidPreset = (label: string, volume: number, type: 'INTAKE' | 'OUTPUT', category: FluidIoRecord['category']) => {
    setFluidForm({
      type,
      category,
      label,
      volumeMl: volume,
      recordedBy: currentUser,
      notes: ''
    });
  };

  const handleSaveFluid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fluidForm.label.trim() || Number(fluidForm.volumeMl) <= 0) {
      toast('Please enter valid fluid description and volume', { type: 'error' });
      return;
    }

    try {
      await storage.addFluidIoEntry(admission.id, {
        type: fluidForm.type,
        category: fluidForm.category,
        label: fluidForm.label.trim(),
        volumeMl: Number(fluidForm.volumeMl),
        recordedBy: fluidForm.recordedBy,
        notes: fluidForm.notes
      });
      toast('Fluid entry added successfully', { type: 'success' });
      setShowAddFluidModal(false);
      onAdmissionUpdated();
    } catch (err) {
      console.error(err);
      toast('Failed to save fluid entry', { type: 'error' });
    }
  };

  const handleDeleteFluid = async (id: string) => {
    const ok = await confirm(
      'Are you sure you want to remove this fluid intake/output log?',
      {
        title: 'Delete Fluid Entry',
        confirmText: 'Delete',
        isDanger: true
      }
    );
    if (!ok) return;

    try {
      await storage.deleteFluidIoEntry(admission.id, id);
      toast('Fluid entry removed', { type: 'success' });
      onAdmissionUpdated();
    } catch (err) {
      console.error(err);
      toast('Failed to delete fluid entry', { type: 'error' });
    }
  };

  // ── SBAR Handover Form State ───────────────────────────────────────────────
  const [sbarForm, setSbarForm] = useState({
    shift: 'MORNING' as 'MORNING' | 'EVENING' | 'NIGHT',
    situation: `Patient ${admission.patientName} admitted under Dr. ${admission.doctorName} for ${admission.diagnosis || 'Observation'}.`,
    background: `Admitted on ${format(parseISO(admission.admittedAt), 'dd MMM yyyy')}. Vitals stable, active IV lines in situ.`,
    assessment: `NEWS2 Score: ${latestNews2?.score ?? 0} (${latestNews2?.risk ?? 'LOW'} Risk). Current fluid balance: ${fluidStats.balance >= 0 ? '+' : ''}${fluidStats.balance} mL.`,
    recommendation: 'Continue scheduled IV fluids & antibiotics. Repeat vitals in next shift.',
    nurseName: currentUser
  });

  const handleSaveSbar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await storage.addNursingShiftNote(admission.id, sbarForm);
      toast('SBAR shift handover note saved', { type: 'success' });
      setShowAddSbarModal(false);
      onAdmissionUpdated();
    } catch (err) {
      console.error(err);
      toast('Failed to save handover note', { type: 'error' });
    }
  };

  return (
    <div className="emar-modal-overlay">
      <div className="emar-modal-container">
        {/* Header */}
        <div className="emar-header">
          <div className="emar-patient-badge">
            <div className="emar-bed-tag">
              <Sparkles size={16} />
              {bed.wardName} - Bed {bed.bedNumber}
            </div>
            <div className="emar-patient-meta">
              <div className="emar-patient-name">
                {admission.patientName}
                <span style={{ fontSize: '0.875rem', fontWeight: 500, opacity: 0.8 }}>
                  ({admission.patientGender}, {admission.patientAge}y)
                </span>
                {latestNews2 && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      backgroundColor: latestNews2.risk === 'HIGH' ? '#ef4444' : latestNews2.risk === 'MEDIUM' ? '#f59e0b' : '#10b981',
                      color: '#ffffff'
                    }}
                  >
                    NEWS2: {latestNews2.score} ({latestNews2.risk})
                  </span>
                )}
              </div>
              <div className="emar-patient-sub">
                <span><strong>IPD No:</strong> {admission.admissionNumber}</span>
                <span>•</span>
                <span><strong>Consultant:</strong>  {admission.doctorName}</span>
                <span>•</span>
                <span><strong>Diagnosis:</strong> {admission.diagnosis || 'Not specified'}</span>
              </div>
            </div>
          </div>

          <div className="emar-header-actions">
            <button className="emar-close-btn" onClick={onClose} title="Close Workspace">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="emar-nav-bar">
          <div className="emar-tabs">
            <button
              className={`emar-tab-btn ${activeTab === 'emar' ? 'active' : ''}`}
              onClick={() => setActiveTab('emar')}
            >
              <Pill size={18} />
              eMAR Medication Chart
              <span className="emar-tab-badge">{emarOrders.filter(o => o.status === 'ACTIVE').length}</span>
            </button>
            <button
              className={`emar-tab-btn ${activeTab === 'vitals' ? 'active' : ''}`}
              onClick={() => setActiveTab('vitals')}
            >
              <Activity size={18} />
              Vitals & NEWS2 Flowsheet
              <span className="emar-tab-badge">{vitalsLog.length}</span>
            </button>
            <button
              className={`emar-tab-btn ${activeTab === 'fluid' ? 'active' : ''}`}
              onClick={() => setActiveTab('fluid')}
            >
              <Droplets size={18} />
              24h Fluid I/O Balance
              <span className="emar-tab-badge">{fluidStats.balance >= 0 ? `+${fluidStats.balance}` : fluidStats.balance} mL</span>
            </button>
            <button
              className={`emar-tab-btn ${activeTab === 'sbar' ? 'active' : ''}`}
              onClick={() => setActiveTab('sbar')}
            >
              <ClipboardList size={18} />
              SBAR Shift Handover
              <span className="emar-tab-badge">{nursingNotes.length}</span>
            </button>
          </div>

          <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
            Station: <strong>{currentUser}</strong>
          </div>
        </div>

        {/* Content Body */}
        <div className="emar-content-area">
          {/* TAB 1: eMAR MEDICATION CHART */}
          {activeTab === 'emar' && (
            <div>
              <div className="emar-section-header">
                <div className="emar-section-title">
                  <Pill size={20} color="#0284c7" />
                  Scheduled & PRN Medication Orders
                </div>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={() => setShowAddOrderModal(true)}
                >
                  <Plus size={16} /> Add Medication Order
                </button>
              </div>

              {emarOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
                  <Pill size={48} color="#94a3b8" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>No Active Medication Orders</h3>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>Add doctor prescribed medications to establish the nursing administration schedule.</p>
                  <button className="btn btn-primary" onClick={() => setShowAddOrderModal(true)}>
                    <Plus size={16} style={{ marginRight: '0.4rem' }} /> Schedule First Medication
                  </button>
                </div>
              ) : (
                <div className="emar-med-grid">
                  {emarOrders.map(order => {
                    return (
                      <div key={order.id} className="emar-card">
                        <div className="emar-card-top">
                          <div>
                            <div className="emar-drug-title">
                              <span className="emar-drug-name">{order.drugName}</span>
                              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#475569' }}>
                                {order.dosage}
                              </span>
                              <span className="emar-route-badge">{order.route}</span>
                              <span className="emar-freq-badge">{order.frequency}</span>
                              {order.isHighAlert && (
                                <span className="emar-alert-badge">
                                  <ShieldAlert size={12} /> HIGH ALERT
                                </span>
                              )}
                              {order.isLasa && (
                                <span className="emar-lasa-badge">
                                  <AlertCircle size={12} /> LASA DRUG
                                </span>
                              )}
                            </div>
                            {order.specialInstructions && (
                              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.35rem' }}>
                                💡 <em>{order.specialInstructions}</em>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              Started: {order.startDate}
                            </span>
                          </div>
                        </div>

                        {/* Dose Slot Administer Matrix */}
                        <div className="emar-time-slots">
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', alignSelf: 'center', marginRight: '0.25rem' }}>
                            SCHEDULE SLOTS:
                          </span>
                          {order.scheduleTimes.map((slotTime, idx) => {
                            // Check if already administered today
                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                            const matchAdmin = emarAdminLogs.find(
                              l => l.orderId === order.id && l.scheduledTime === slotTime && l.administeredAt.startsWith(todayStr)
                            );

                            return (
                              <div
                                key={idx}
                                className={`emar-slot-pill ${matchAdmin ? matchAdmin.status.toLowerCase() : 'due'}`}
                              >
                                <Clock size={14} />
                                <strong>{slotTime}</strong>
                                {matchAdmin ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                                    {matchAdmin.status === 'GIVEN' && <Check size={14} color="#16a34a" />}
                                    {matchAdmin.status === 'HELD' && <AlertTriangle size={14} color="#d97706" />}
                                    {matchAdmin.status} ({format(parseISO(matchAdmin.administeredAt), 'HH:mm')})
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleOpenAdministerModal(order, slotTime)}
                                    style={{
                                      background: '#0284c7',
                                      border: 'none',
                                      color: 'white',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      marginLeft: '0.25rem'
                                    }}
                                  >
                                    Administer
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VITALS & NEWS2 FLOWSHEET */}
          {activeTab === 'vitals' && (
            <div>
              {/* NEWS2 Clinical Gauge Banner */}
              {latestNews2 ? (
                <div className={`news2-banner risk-${latestNews2.risk.toLowerCase()}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div className="news2-score-circle">
                      <span className="news2-score-num" style={{ color: latestNews2.color }}>
                        {latestNews2.score}
                      </span>
                      <span className="news2-score-label">NEWS2</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>
                        {latestNews2.risk === 'HIGH' ? '⚠️ HIGH CLINICAL DETERIORATION RISK' : latestNews2.risk === 'MEDIUM' ? '⚡ MEDIUM CLINICAL RISK / ESCALATION' : '✅ LOW CLINICAL RISK (STABLE)'}
                      </div>
                      <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.9 }}>
                        {latestNews2.guidance}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setShowAddVitalModal(true)}
                  >
                    <Plus size={16} style={{ marginRight: '0.4rem' }} /> Record Fresh Vitals
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '1rem', marginBottom: '1.5rem' }}>
                  <p style={{ color: '#64748b' }}>No clinical vitals recorded yet for this admission.</p>
                  <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => setShowAddVitalModal(true)}>
                    <Plus size={16} style={{ marginRight: '0.4rem' }} /> Record Initial Admission Vitals
                  </button>
                </div>
              )}

              {/* Latest Vital Metrics Tiles */}
              {latestVital && (
                <div className="vitals-grid-card">
                  <div className="vital-metric-tile">
                    <span className="vital-metric-label">Blood Pressure</span>
                    <span className="vital-metric-val">
                      {latestVital.bpSystolic || '--'}/{latestVital.bpDiastolic || '--'}
                      <span className="vital-metric-unit">mmHg</span>
                    </span>
                  </div>
                  <div className="vital-metric-tile">
                    <span className="vital-metric-label">Heart Rate / Pulse</span>
                    <span className="vital-metric-val">
                      {latestVital.pulse || '--'}
                      <span className="vital-metric-unit">bpm</span>
                    </span>
                  </div>
                  <div className="vital-metric-tile">
                    <span className="vital-metric-label">SpO2 Oxygen</span>
                    <span className="vital-metric-val">
                      {latestVital.spo2 || '--'}%
                      <span className="vital-metric-unit">{latestVital.onOxygen ? `(O₂ @ ${latestVital.oxygenFlowRate}L)` : '(Air)'}</span>
                    </span>
                  </div>
                  <div className="vital-metric-tile">
                    <span className="vital-metric-label">Resp. Rate</span>
                    <span className="vital-metric-val">
                      {latestVital.respiratoryRate || '--'}
                      <span className="vital-metric-unit">/min</span>
                    </span>
                  </div>
                  <div className="vital-metric-tile">
                    <span className="vital-metric-label">Temperature</span>
                    <span className="vital-metric-val">
                      {latestVital.temp || '--'}
                      <span className="vital-metric-unit">°F</span>
                    </span>
                  </div>
                  <div className="vital-metric-tile">
                    <span className="vital-metric-label">Consciousness</span>
                    <span className="vital-metric-val" style={{ fontSize: '1.1rem' }}>
                      {latestVital.avpu || 'Alert'}
                    </span>
                  </div>
                </div>
              )}

              {/* Historical Vitals Flowsheet Table */}
              <div style={{ background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color="#0284c7" />
                    Chronological Vitals Flowsheet
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Time</th>
                        <th style={{ padding: '0.75rem 1rem' }}>NEWS2</th>
                        <th style={{ padding: '0.75rem 1rem' }}>BP (mmHg)</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Pulse (bpm)</th>
                        <th style={{ padding: '0.75rem 1rem' }}>SpO2 (%)</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Resp Rate</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Temp (°F)</th>
                        <th style={{ padding: '0.75rem 1rem' }}>AVPU</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Sugar (mg/dL)</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Nurse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitalsLog.map((v, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            {v.recordedAt ? format(parseISO(v.recordedAt), 'dd MMM, HH:mm') : '--'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                background: (v.news2Score ?? 0) >= 7 ? '#fee2e2' : (v.news2Score ?? 0) >= 5 ? '#fef3c7' : '#ecfdf5',
                                color: (v.news2Score ?? 0) >= 7 ? '#b91c1c' : (v.news2Score ?? 0) >= 5 ? '#b45309' : '#047857'
                              }}
                            >
                              {v.news2Score ?? calculateNews2(v).score}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>{v.bpSystolic}/{v.bpDiastolic}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{v.pulse}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{v.spo2}% {v.onOxygen ? '(O₂)' : ''}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{v.respiratoryRate || '--'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{v.temp}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{v.avpu || 'Alert'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{v.bloodSugar || '--'}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{v.recordedBy || 'Nurse'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 24h FLUID INTAKE / OUTPUT (I/O) */}
          {activeTab === 'fluid' && (
            <div>
              {/* Stat Summary Cards */}
              <div className="fluid-balance-bar">
                <div className="fluid-stat-card">
                  <div className="fluid-stat-icon intake">
                    <Droplets size={24} />
                  </div>
                  <div>
                    <div className="fluid-stat-val">{fluidStats.totalIntake} mL</div>
                    <div className="fluid-stat-lbl">Total Intake (IV + Oral)</div>
                  </div>
                </div>

                <div className="fluid-stat-card">
                  <div className="fluid-stat-icon output">
                    <Droplets size={24} />
                  </div>
                  <div>
                    <div className="fluid-stat-val">{fluidStats.totalOutput} mL</div>
                    <div className="fluid-stat-lbl">Total Output (Urine + Drains)</div>
                  </div>
                </div>

                <div className="fluid-stat-card">
                  <div className="fluid-stat-icon balance">
                    <Heart size={24} />
                  </div>
                  <div>
                    <div
                      className="fluid-stat-val"
                      style={{ color: fluidStats.balance >= 0 ? '#16a34a' : '#ea580c' }}
                    >
                      {fluidStats.balance >= 0 ? `+${fluidStats.balance}` : fluidStats.balance} mL
                    </div>
                    <div className="fluid-stat-lbl">
                      24h Net Fluid Balance {fluidStats.balance >= 0 ? '(Positive)' : '(Negative)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="emar-section-header">
                <div className="emar-section-title">
                  <Droplets size={20} color="#0284c7" />
                  Fluid Intake & Output Logs
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddFluidModal(true)}>
                  <Plus size={16} style={{ marginRight: '0.4rem' }} /> Add Intake / Output Entry
                </button>
              </div>

              {/* Fluid Log Table */}
              <div style={{ background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Recorded Time</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Fluid / Description</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Volume (mL)</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Recorded By</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fluidIoLog.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          No fluid intake/output entries recorded today.
                        </td>
                      </tr>
                    ) : (
                      fluidIoLog.map(entry => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            {format(parseISO(entry.recordedAt), 'dd MMM, HH:mm')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                background: entry.type === 'INTAKE' ? '#e0f2fe' : '#fef3c7',
                                color: entry.type === 'INTAKE' ? '#0369a1' : '#b45309'
                              }}
                            >
                              {entry.type}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                            {entry.category.replace(/_/g, ' ')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                            {entry.label}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, fontSize: '0.9375rem' }}>
                            {entry.type === 'INTAKE' ? `+${entry.volumeMl}` : `-${entry.volumeMl}`} mL
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {entry.recordedBy || 'Nurse'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteFluid(entry.id)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                              title="Delete Entry"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SBAR SHIFT HANDOVER */}
          {activeTab === 'sbar' && (
            <div>
              <div className="emar-section-header">
                <div className="emar-section-title">
                  <ClipboardList size={20} color="#0284c7" />
                  SBAR Clinical Shift Handover
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddSbarModal(true)}>
                  <Plus size={16} style={{ marginRight: '0.4rem' }} /> Create Shift Handover Note
                </button>
              </div>

              {nursingNotes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
                  <FileText size={48} color="#94a3b8" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>No Shift Handover Notes Yet</h3>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>Use the structured SBAR template to hand over clinical care between morning, evening, and night nursing shifts.</p>
                  <button className="btn btn-primary" onClick={() => setShowAddSbarModal(true)}>
                    <Plus size={16} style={{ marginRight: '0.4rem' }} /> Create First Handover Note
                  </button>
                </div>
              ) : (
                nursingNotes.map(note => (
                  <div key={note.id} className="sbar-card">
                    <div className="sbar-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            fontWeight: 800,
                            padding: '0.25rem 0.65rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem'
                          }}
                        >
                          {note.shift} SHIFT
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          Handed over by: <strong>{note.nurseName}</strong> on {format(parseISO(note.recordedAt), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    </div>

                    <div className="sbar-grid">
                      <div className="sbar-block">
                        <div className="sbar-block-title">S - Situation</div>
                        <div className="sbar-block-text">{note.situation}</div>
                      </div>
                      <div className="sbar-block">
                        <div className="sbar-block-title">B - Background</div>
                        <div className="sbar-block-text">{note.background}</div>
                      </div>
                      <div className="sbar-block">
                        <div className="sbar-block-title">A - Assessment</div>
                        <div className="sbar-block-text">{note.assessment}</div>
                      </div>
                      <div className="sbar-block">
                        <div className="sbar-block-title">R - Recommendation</div>
                        <div className="sbar-block-text">{note.recommendation}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── MODAL 1: ADD MEDICATION ORDER ── */}
        {showAddOrderModal && (
          <div className="emar-submodal-overlay">
            <div className="emar-submodal-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Schedule Medication Order</h3>
                <button onClick={() => setShowAddOrderModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveOrder}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Drug Name & Strength *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inj. Ceftriaxone 1g or Tab. Paracetamol 650mg"
                    value={orderForm.drugName}
                    onChange={e => setOrderForm(p => ({ ...p, drugName: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Dosage
                    </label>
                    <input
                      type="text"
                      value={orderForm.dosage}
                      onChange={e => setOrderForm(p => ({ ...p, dosage: e.target.value }))}
                      placeholder="e.g. 1g / 500mg"
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Route
                    </label>
                    <select
                      value={orderForm.route}
                      onChange={e => setOrderForm(p => ({ ...p, route: e.target.value as any }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    >
                      <option value="IV">IV (Intravenous)</option>
                      <option value="Oral">Oral (PO)</option>
                      <option value="SC">SC (Subcutaneous)</option>
                      <option value="IM">IM (Intramuscular)</option>
                      <option value="Inhalation">Inhalation / Nebulization</option>
                      <option value="Topical">Topical</option>
                      <option value="Sublingual">Sublingual</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Frequency
                    </label>
                    <select
                      value={orderForm.frequency}
                      onChange={e => handleFrequencyChange(e.target.value as any)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    >
                      <option value="OD">OD (Once Daily)</option>
                      <option value="BD">BD (Twice Daily)</option>
                      <option value="TDS">TDS (Thrice Daily)</option>
                      <option value="QID">QID (4 Times Daily)</option>
                      <option value="STAT">STAT (Immediately)</option>
                      <option value="PRN">PRN (As Needed)</option>
                      <option value="Q4H">Q4H (Every 4 Hours)</option>
                      <option value="Q6H">Q6H (Every 6 Hours)</option>
                      <option value="Q8H">Q8H (Every 8 Hours)</option>
                      <option value="Q12H">Q12H (Every 12 Hours)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Schedule Times (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={orderForm.scheduleTimesText}
                      onChange={e => setOrderForm(p => ({ ...p, scheduleTimesText: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={orderForm.isHighAlert}
                      onChange={e => setOrderForm(p => ({ ...p, isHighAlert: e.target.checked }))}
                    />
                    ⚠️ High-Alert Medication (Requires Dual Sign-off)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={orderForm.isLasa}
                      onChange={e => setOrderForm(p => ({ ...p, isLasa: e.target.checked }))}
                    />
                    🔍 LASA Drug
                  </label>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Special Instructions / Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Give over 30 mins, check BP before administration"
                    value={orderForm.specialInstructions}
                    onChange={e => setOrderForm(p => ({ ...p, specialInstructions: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddOrderModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={16} style={{ marginRight: '0.4rem' }} /> Schedule Medication
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 2: ADMINISTER DOSE ── */}
        {showAdministerModal && selectedOrderForAdmin && (
          <div className="emar-submodal-overlay">
            <div className="emar-submodal-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                  Administer Dose: {selectedOrderForAdmin.drugName}
                </h3>
                <button onClick={() => setShowAdministerModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.75rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedOrderForAdmin.dosage} via {selectedOrderForAdmin.route}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Scheduled Slot: <strong>{selectedTimeSlotForAdmin}</strong>
                </div>
                {selectedOrderForAdmin.isHighAlert && (
                  <div style={{ marginTop: '0.5rem', color: '#dc2626', fontWeight: 700, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ShieldAlert size={14} /> High-Alert Drug: Dual nurse verification required.
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveAdministration}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Administration Action *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                    {(['GIVEN', 'HELD', 'REFUSED', 'MISSED'] as const).map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAdminForm(p => ({ ...p, status: st }))}
                        style={{
                          padding: '0.65rem 0.25rem',
                          borderRadius: '0.5rem',
                          border: adminForm.status === st ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: adminForm.status === st ? '#e0f2fe' : '#ffffff',
                          color: adminForm.status === st ? '#0369a1' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Administering Nurse *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminForm.administeredBy}
                      onChange={e => setAdminForm(p => ({ ...p, administeredBy: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Dual Sign-Off Nurse {selectedOrderForAdmin.isHighAlert ? '(Required)' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nurse Priya"
                      value={adminForm.dualSignOffBy}
                      onChange={e => setAdminForm(p => ({ ...p, dualSignOffBy: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Pre-Administration Vital Checks
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="BP (120/80)"
                      value={adminForm.preBp}
                      onChange={e => setAdminForm(p => ({ ...p, preBp: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem' }}
                    />
                    <input
                      type="text"
                      placeholder="Pulse (bpm)"
                      value={adminForm.prePulse}
                      onChange={e => setAdminForm(p => ({ ...p, prePulse: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem' }}
                    />
                    <input
                      type="text"
                      placeholder="GRBS (mg/dL)"
                      value={adminForm.preSugar}
                      onChange={e => setAdminForm(p => ({ ...p, preSugar: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Notes / Reason (if Held or Refused)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Patient asleep, BP stable, cannula site clean"
                    value={adminForm.reasonOrNotes}
                    onChange={e => setAdminForm(p => ({ ...p, reasonOrNotes: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdministerModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle2 size={16} style={{ marginRight: '0.4rem' }} /> Confirm Dose Administration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 3: ADD VITALS & NEWS2 ── */}
        {showAddVitalModal && (
          <div className="emar-submodal-overlay">
            <div className="emar-submodal-box" style={{ maxWidth: '640px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Record Patient Vitals & NEWS2</h3>
                <button onClick={() => setShowAddVitalModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Dynamic Live Score Preview */}
              <div
                style={{
                  background: previewNews2.risk === 'HIGH' ? '#fef2f2' : previewNews2.risk === 'MEDIUM' ? '#fffbeb' : '#ecfdf5',
                  border: `1px solid ${previewNews2.color}`,
                  borderRadius: '0.75rem',
                  padding: '0.875rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: previewNews2.color }}>
                    Live NEWS2 Score: {previewNews2.score} ({previewNews2.risk} Risk)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' }}>
                    {previewNews2.guidance}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveVital}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Systolic BP (mmHg) *
                    </label>
                    <input
                      type="number"
                      required
                      value={vitalForm.bpSystolic}
                      onChange={e => setVitalForm(p => ({ ...p, bpSystolic: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Diastolic BP (mmHg)
                    </label>
                    <input
                      type="number"
                      value={vitalForm.bpDiastolic}
                      onChange={e => setVitalForm(p => ({ ...p, bpDiastolic: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Pulse (bpm) *
                    </label>
                    <input
                      type="number"
                      required
                      value={vitalForm.pulse}
                      onChange={e => setVitalForm(p => ({ ...p, pulse: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      SpO2 (%) *
                    </label>
                    <input
                      type="number"
                      required
                      value={vitalForm.spo2}
                      onChange={e => setVitalForm(p => ({ ...p, spo2: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Resp Rate (/min) *
                    </label>
                    <input
                      type="number"
                      required
                      value={vitalForm.respiratoryRate}
                      onChange={e => setVitalForm(p => ({ ...p, respiratoryRate: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Temperature (°F)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalForm.temp}
                      onChange={e => setVitalForm(p => ({ ...p, temp: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      AVPU Consciousness
                    </label>
                    <select
                      value={vitalForm.avpu}
                      onChange={e => setVitalForm(p => ({ ...p, avpu: e.target.value as any }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    >
                      <option value="Alert">Alert</option>
                      <option value="Voice">Voice (Responds to Voice)</option>
                      <option value="Pain">Pain (Responds to Pain)</option>
                      <option value="Unresponsive">Unresponsive</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={vitalForm.onOxygen}
                      onChange={e => setVitalForm(p => ({ ...p, onOxygen: e.target.checked }))}
                    />
                    Patient on Supplemental Oxygen (O₂ Therapy)
                  </label>
                  {vitalForm.onOxygen && (
                    <input
                      type="number"
                      placeholder="Flow (L/min)"
                      value={vitalForm.oxygenFlowRate}
                      onChange={e => setVitalForm(p => ({ ...p, oxygenFlowRate: e.target.value }))}
                      style={{ width: '100px', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.8125rem' }}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddVitalModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={16} style={{ marginRight: '0.4rem' }} /> Save Vitals Log
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 4: ADD FLUID INTAKE / OUTPUT ── */}
        {showAddFluidModal && (
          <div className="emar-submodal-overlay">
            <div className="emar-submodal-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Add Fluid Intake / Output</h3>
                <button onClick={() => setShowAddFluidModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Quick Presets */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                  QUICK CLINICAL PRESETS:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => handleFluidPreset('0.9% Normal Saline 500mL IV', 500, 'INTAKE', 'IV_CRYSTALLOID')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  >
                    + 500mL NS (IV)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFluidPreset('Ringer Lactate 500mL IV', 500, 'INTAKE', 'IV_CRYSTALLOID')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  >
                    + 500mL RL (IV)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFluidPreset('Oral Water / ORS', 250, 'INTAKE', 'ORAL_ENTERAL')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  >
                    + 250mL Oral
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFluidPreset('Foley Urine Output', 400, 'OUTPUT', 'URINE')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fffbeb', color: '#b45309', cursor: 'pointer' }}
                  >
                    - 400mL Urine
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveFluid}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Flow Type *
                    </label>
                    <select
                      value={fluidForm.type}
                      onChange={e => setFluidForm(p => ({ ...p, type: e.target.value as any }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    >
                      <option value="INTAKE">INTAKE (Fluid In)</option>
                      <option value="OUTPUT">OUTPUT (Fluid Out)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Category
                    </label>
                    <select
                      value={fluidForm.category}
                      onChange={e => setFluidForm(p => ({ ...p, category: e.target.value as any }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    >
                      <option value="IV_CRYSTALLOID">IV Crystalloid (NS, RL, DNS)</option>
                      <option value="IV_COLLOID_BLOOD">IV Colloid / Blood Products</option>
                      <option value="ORAL_ENTERAL">Oral / Enteral Feed</option>
                      <option value="URINE">Urine Output</option>
                      <option value="DRAIN">Surgical Drain</option>
                      <option value="NG_ASPIRATE">NG / RT Tube Aspirate</option>
                      <option value="VOMITUS">Vomitus</option>
                      <option value="STOOL">Stool / Loose Motion</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Fluid Description *
                    </label>
                    <input
                      type="text"
                      required
                      value={fluidForm.label}
                      onChange={e => setFluidForm(p => ({ ...p, label: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Volume (mL) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={fluidForm.volumeMl}
                      onChange={e => setFluidForm(p => ({ ...p, volumeMl: Number(e.target.value) }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddFluidModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={16} style={{ marginRight: '0.4rem' }} /> Add Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 5: ADD SBAR SHIFT HANDOVER ── */}
        {showAddSbarModal && (
          <div className="emar-submodal-overlay">
            <div className="emar-submodal-box" style={{ maxWidth: '680px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Create SBAR Clinical Handover Note</h3>
                <button onClick={() => setShowAddSbarModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSbar}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Handover Shift
                    </label>
                    <select
                      value={sbarForm.shift}
                      onChange={e => setSbarForm(p => ({ ...p, shift: e.target.value as any }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    >
                      <option value="MORNING">Morning Shift (07:00 - 15:00)</option>
                      <option value="EVENING">Evening Shift (15:00 - 23:00)</option>
                      <option value="NIGHT">Night Shift (23:00 - 07:00)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      Reporting Nurse
                    </label>
                    <input
                      type="text"
                      required
                      value={sbarForm.nurseName}
                      onChange={e => setSbarForm(p => ({ ...p, nurseName: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.25rem' }}>
                    S - Situation (Current patient state & reason for admission)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={sbarForm.situation}
                    onChange={e => setSbarForm(p => ({ ...p, situation: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.25rem' }}>
                    B - Background (History, procedures, IV lines, surgical status)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={sbarForm.background}
                    onChange={e => setSbarForm(p => ({ ...p, background: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.25rem' }}>
                    A - Assessment (NEWS2 score, vitals, pain level, fluid balance)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={sbarForm.assessment}
                    onChange={e => setSbarForm(p => ({ ...p, assessment: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.25rem' }}>
                    R - Recommendation (Pending investigations, planned doses, watchouts)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={sbarForm.recommendation}
                    onChange={e => setSbarForm(p => ({ ...p, recommendation: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddSbarModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Send size={16} style={{ marginRight: '0.4rem' }} /> Save Handover Note
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
