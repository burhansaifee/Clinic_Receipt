import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Pill, Activity, Droplets, Users, Search, RefreshCw,
  AlertTriangle, ShieldAlert, Heart, Clock,
  ChevronRight, Sparkles, Bed, Stethoscope, CheckCircle2, FileText
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import '../../styles/tabs/NursingStationTab.css';
import { EmarNursingModal } from './inpatient/EmarNursingModal';
import { DischargeSummaryModal } from './inpatient/DischargeSummaryModal';
import {
  storage,
  calculateNews2,
  type Ward,
  type HospitalBed,
  type BedAdmission,
  type EmarMedicationOrder,
  type EmarAdministrationRecord,
  type AdmissionVital,
  type FluidIoRecord
} from '../../lib/storage';

interface NursingStationTabProps {
  currentUser?: string;
}

export const NursingStationTab: React.FC<NursingStationTabProps> = ({
  currentUser = 'Duty Nurse'
}) => {
  const toast = useToast();

  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<HospitalBed[]>([]);
  const [admissions, setAdmissions] = useState<BedAdmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'due-meds' | 'high-risk'>('all');

  // Modal State for Selected Patient eMAR Workspace
  const [selectedBedForEmar, setSelectedBedForEmar] = useState<HospitalBed | null>(null);
  const [activeAdmissionForEmar, setActiveAdmissionForEmar] = useState<BedAdmission | null>(null);
  const [admissionForDischargeSummary, setAdmissionForDischargeSummary] = useState<BedAdmission | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [w, b, a] = await Promise.all([
        storage.getWards(),
        storage.getBeds(),
        storage.getBedAdmissions({ status: 'admitted', limit: 100 })
      ]);
      setWards(w || []);
      setBeds(b || []);
      setAdmissions(a || []);
    } catch (err) {
      console.error('Failed to load nursing ward data:', err);
      toast('Failed to refresh nursing roster', { type: 'error' });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = (e: any) => {
      const dt = e?.detail?.dataType;
      if (!dt || dt === 'beds' || dt === 'bed' || dt === 'admission' || dt === 'all') {
        loadData(true);
      }
    };
    window.addEventListener('buvora-data-updated', handleSync);
    const interval = setInterval(() => loadData(true), 5000);
    return () => {
      window.removeEventListener('buvora-data-updated', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Filtered Occupied Beds list with parsed clinical metrics
  const occupiedBedsWithData = useMemo(() => {
    const occupied = beds.filter(b => b.status === 'occupied' && b.currentAdmissionId);

    return occupied.map(bed => {
      const admission = admissions.find(a => a.id === bed.currentAdmissionId);

      let emarOrders: EmarMedicationOrder[] = [];
      let emarAdminLogs: EmarAdministrationRecord[] = [];
      let vitals: AdmissionVital[] = [];
      let fluidLogs: FluidIoRecord[] = [];

      if (admission) {
        try { emarOrders = JSON.parse(admission.emarOrdersLog || '[]'); } catch (_) {}
        try { emarAdminLogs = JSON.parse(admission.emarAdminLog || '[]'); } catch (_) {}
        try { vitals = JSON.parse(admission.vitalsLog || '[]'); } catch (_) {}
        try { fluidLogs = JSON.parse(admission.fluidIoLog || '[]'); } catch (_) {}
      }

      const latestVital = vitals[0] || null;
      const news2 = latestVital ? calculateNews2(latestVital) : null;

      // Calculate pending doses for today
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let pendingDosesCount = 0;
      const dueOrderNames: string[] = [];

      emarOrders.filter(o => o.status === 'ACTIVE').forEach(order => {
        order.scheduleTimes.forEach(slot => {
          const isGiven = emarAdminLogs.some(
            l => l.orderId === order.id && l.scheduledTime === slot && l.administeredAt.startsWith(todayStr)
          );
          if (!isGiven) {
            pendingDosesCount++;
            if (!dueOrderNames.includes(order.drugName)) {
              dueOrderNames.push(`${order.drugName} (${slot})`);
            }
          }
        });
      });

      // Calculate 24h Fluid Net Balance
      let totalIn = 0;
      let totalOut = 0;
      fluidLogs.forEach(f => {
        if (f.type === 'INTAKE') totalIn += Number(f.volumeMl) || 0;
        if (f.type === 'OUTPUT') totalOut += Number(f.volumeMl) || 0;
      });
      const netFluidBalance = totalIn - totalOut;

      return {
        bed,
        admission,
        latestVital,
        news2,
        emarOrders,
        pendingDosesCount,
        dueOrderNames,
        netFluidBalance
      };
    });
  }, [beds, admissions]);

  // Overall Shift KPIs
  const shiftKpis = useMemo(() => {
    const totalPatients = occupiedBedsWithData.length;
    let totalDosesDue = 0;
    let highRiskCount = 0;
    let totalWardFluidBalance = 0;

    occupiedBedsWithData.forEach(item => {
      totalDosesDue += item.pendingDosesCount;
      if (item.news2 && (item.news2.risk === 'HIGH' || item.news2.risk === 'MEDIUM')) {
        highRiskCount++;
      }
      totalWardFluidBalance += item.netFluidBalance;
    });

    return { totalPatients, totalDosesDue, highRiskCount, totalWardFluidBalance };
  }, [occupiedBedsWithData]);

  // Filtered Roster for UI
  const filteredRoster = useMemo(() => {
    return occupiedBedsWithData.filter(item => {
      // Ward filter
      if (selectedWardFilter !== 'ALL' && item.bed.wardId !== selectedWardFilter) {
        return false;
      }

      // Tab filter
      if (activeTabFilter === 'due-meds' && item.pendingDosesCount === 0) {
        return false;
      }
      if (activeTabFilter === 'high-risk' && (!item.news2 || item.news2.risk === 'LOW')) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (item.admission?.patientName || item.bed.patientName || '').toLowerCase();
        const bedNum = (item.bed.bedNumber || '').toLowerCase();
        const wardName = (item.bed.wardName || '').toLowerCase();
        const docName = (item.admission?.doctorName || '').toLowerCase();
        const diag = (item.admission?.diagnosis || '').toLowerCase();
        return pName.includes(q) || bedNum.includes(q) || wardName.includes(q) || docName.includes(q) || diag.includes(q);
      }

      return true;
    });
  }, [occupiedBedsWithData, selectedWardFilter, activeTabFilter, searchQuery]);

  const handleOpenPatientEmar = (bed: HospitalBed, admission?: BedAdmission) => {
    if (!admission) {
      toast('No active admission found for this bed', { type: 'error' });
      return;
    }
    setSelectedBedForEmar(bed);
    setActiveAdmissionForEmar(admission);
  };

  return (
    <div className="nursing-station-container">
      {/* Shift Overview KPIs */}
      <div className="nursing-kpi-grid">
        <div className="nursing-kpi-card">
          <div className="nursing-kpi-icon patients">
            <Users size={26} />
          </div>
          <div>
            <div className="nursing-kpi-val">{shiftKpis.totalPatients}</div>
            <div className="nursing-kpi-label">Active Inpatients</div>
          </div>
        </div>

        <div className="nursing-kpi-card">
          <div className="nursing-kpi-icon meds">
            <Pill size={26} />
          </div>
          <div>
            <div className="nursing-kpi-val">{shiftKpis.totalDosesDue}</div>
            <div className="nursing-kpi-label">eMAR Doses Pending</div>
          </div>
        </div>

        <div className="nursing-kpi-card">
          <div className="nursing-kpi-icon alerts">
            <ShieldAlert size={26} />
          </div>
          <div>
            <div className="nursing-kpi-val" style={{ color: shiftKpis.highRiskCount > 0 ? '#dc2626' : '#0f172a' }}>
              {shiftKpis.highRiskCount}
            </div>
            <div className="nursing-kpi-label">NEWS2 Risk Alerts</div>
          </div>
        </div>

        <div className="nursing-kpi-card">
          <div className="nursing-kpi-icon fluid">
            <Droplets size={26} />
          </div>
          <div>
            <div className="nursing-kpi-val" style={{ color: shiftKpis.totalWardFluidBalance >= 0 ? '#16a34a' : '#ea580c' }}>
              {shiftKpis.totalWardFluidBalance >= 0 ? `+${shiftKpis.totalWardFluidBalance}` : shiftKpis.totalWardFluidBalance} mL
            </div>
            <div className="nursing-kpi-label">Ward 24h Fluid Balance</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="nursing-filter-bar">
        <div className="nursing-search-box">
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search patient, bed number, doctor, diagnosis..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="nursing-ward-pills">
          <button
            className={`nursing-ward-pill ${selectedWardFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedWardFilter('ALL')}
          >
            All Wards ({occupiedBedsWithData.length})
          </button>
          {wards.map(w => {
            const count = occupiedBedsWithData.filter(i => i.bed.wardId === w.id).length;
            return (
              <button
                key={w.id}
                className={`nursing-ward-pill ${selectedWardFilter === w.id ? 'active' : ''}`}
                onClick={() => setSelectedWardFilter(w.id)}
              >
                {w.name} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => loadData(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.9rem' }}
            title="Refresh Inpatient Roster"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Quick Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTabFilter('all')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTabFilter === 'all' ? '#0f172a' : '#ffffff',
            color: activeTabFilter === 'all' ? '#ffffff' : '#64748b',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}
        >
          All Inpatients ({occupiedBedsWithData.length})
        </button>
        <button
          onClick={() => setActiveTabFilter('due-meds')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTabFilter === 'due-meds' ? '#d97706' : '#ffffff',
            color: activeTabFilter === 'due-meds' ? '#ffffff' : '#b45309',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}
        >
          ⏰ Pending Medication Doses ({occupiedBedsWithData.filter(i => i.pendingDosesCount > 0).length})
        </button>
        <button
          onClick={() => setActiveTabFilter('high-risk')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTabFilter === 'high-risk' ? '#dc2626' : '#ffffff',
            color: activeTabFilter === 'high-risk' ? '#ffffff' : '#dc2626',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}
        >
          ⚠️ High NEWS2 Clinical Risk ({occupiedBedsWithData.filter(i => i.news2 && i.news2.risk !== 'LOW').length})
        </button>
      </div>

      {/* Inpatient Bed Roster Grid (iPad / Mobile Optimized Cards) */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b', fontWeight: 600 }}>Loading nursing station roster...</p>
        </div>
      ) : filteredRoster.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#ffffff', borderRadius: '1.25rem', border: '1px dashed #cbd5e1' }}>
          <Bed size={52} color="#94a3b8" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>No Inpatients Found</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {searchQuery ? 'No admitted patients matched your search filters.' : 'All beds are currently available in this ward.'}
          </p>
        </div>
      ) : (
        <div className="nursing-roster-grid">
          {filteredRoster.map(item => {
            const { bed, admission, latestVital, news2, pendingDosesCount, dueOrderNames, netFluidBalance } = item;
            return (
              <div key={bed.id} className="nursing-patient-card">
                {/* Card Header */}
                <div className="nursing-card-header">
                  <div className="nursing-card-bed">
                    <Sparkles size={16} />
                    {bed.wardName} — Bed {bed.bedNumber}
                  </div>
                  {news2 ? (
                    <span
                      className="nursing-news2-badge"
                      style={{
                        background: news2.risk === 'HIGH' ? '#ef4444' : news2.risk === 'MEDIUM' ? '#f59e0b' : '#10b981',
                        color: 'white'
                      }}
                    >
                      NEWS2: {news2.score} ({news2.risk})
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No Vitals Yet</span>
                  )}
                </div>

                {/* Card Body */}
                <div className="nursing-card-body">
                  <div>
                    <div className="nursing-patient-title">
                      {admission?.patientName || bed.patientName || 'Admitted Patient'}
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginLeft: '0.5rem' }}>
                        ({admission?.patientGender || bed.patientGender || '—'}, {admission?.patientAge || bed.patientAge || '—'}y)
                      </span>
                    </div>
                    <div className="nursing-meta-row" style={{ marginTop: '0.35rem' }}>
                      <span><strong>IPD:</strong> {admission?.admissionNumber || bed.admissionNumber}</span>
                      <span>•</span>
                      <span><strong>Dr:</strong> {admission?.doctorName || bed.doctorName || 'Doctor'}</span>
                    </div>
                    {admission?.diagnosis && (
                      <div style={{ fontSize: '0.8125rem', color: '#0369a1', fontWeight: 600, marginTop: '0.25rem' }}>
                        🏥 {admission.diagnosis}
                      </div>
                    )}
                  </div>

                  {/* Vitals Strip */}
                  <div className="nursing-vitals-strip">
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>BP</span>
                      <strong>{latestVital ? `${latestVital.bpSystolic}/${latestVital.bpDiastolic}` : '--/--'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Pulse</span>
                      <strong>{latestVital?.pulse || '--'} <span style={{ fontSize: '0.65rem' }}>bpm</span></strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>SpO2</span>
                      <strong style={{ color: Number(latestVital?.spo2 || 99) < 95 ? '#dc2626' : '#16a34a' }}>
                        {latestVital?.spo2 ? `${latestVital.spo2}%` : '--%'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Temp</span>
                      <strong>{latestVital?.temp ? `${latestVital.temp}°F` : '--'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Fluid 24h</span>
                      <strong style={{ color: netFluidBalance >= 0 ? '#16a34a' : '#ea580c' }}>
                        {netFluidBalance >= 0 ? `+${netFluidBalance}` : netFluidBalance} mL
                      </strong>
                    </div>
                  </div>

                  {/* Due Medications Pill */}
                  {pendingDosesCount > 0 ? (
                    <div className="nursing-med-due-box">
                      <div className="nursing-med-due-title">
                        <Clock size={14} />
                        {pendingDosesCount} Dose{pendingDosesCount === 1 ? '' : 's'} Due Today:
                      </div>
                      <div style={{ color: '#78350f', fontSize: '0.78rem', lineHeight: '1.3' }}>
                        {dueOrderNames.slice(0, 2).join(', ')}
                        {dueOrderNames.length > 2 && ` +${dueOrderNames.length - 2} more`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', color: '#166534', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={15} color="#16a34a" /> All scheduled medication doses up to date.
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="nursing-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="nursing-action-btn primary"
                    style={{ flex: 1 }}
                    onClick={() => handleOpenPatientEmar(bed, admission)}
                  >
                    <Pill size={16} /> Open eMAR &amp; Vitals <ChevronRight size={16} />
                  </button>
                  <button
                    className="nursing-action-btn"
                    style={{
                      background: '#fff7ed',
                      color: '#c2410c',
                      border: '1px solid #fed7aa',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.75rem',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                    onClick={() => setAdmissionForDischargeSummary(admission)}
                    title="Open Clinical Discharge Summary & A4 Print Engine"
                  >
                    <FileText size={16} /> Summary
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clinical eMAR & Nursing Station Modal Workspace */}
      {selectedBedForEmar && activeAdmissionForEmar && (
        <EmarNursingModal
          bed={selectedBedForEmar}
          admission={activeAdmissionForEmar}
          currentUser={currentUser}
          onClose={() => {
            setSelectedBedForEmar(null);
            setActiveAdmissionForEmar(null);
          }}
          onAdmissionUpdated={async () => {
            await loadData(true);
            if (selectedBedForEmar?.currentAdmissionId) {
              const freshAdms = await storage.getBedAdmissions({ status: 'admitted', limit: 100 });
              const updated = freshAdms.find(a => a.id === selectedBedForEmar.currentAdmissionId);
              if (updated) {
                setActiveAdmissionForEmar(updated);
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
          }}
        />
      )}
    </div>
  );
};
