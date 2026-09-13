import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet, DollarSign, Percent, FileCheck,
  Printer, Plus, Settings2, ArrowUpRight,
  TrendingUp, RefreshCw, X
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import '../../styles/tabs/DoctorPayoutsTab.css';
import {
  storage,
  type Doctor,
  type DoctorCommissionRule,
  type DoctorPayoutTransaction,
  type DoctorAccruedEarnings,
  type HospitalTier3Metrics
} from '../../lib/storage';

interface DoctorPayoutsTabProps {
  doctors: Doctor[];
}

export const DoctorPayoutsTab: React.FC<DoctorPayoutsTabProps> = ({ doctors }) => {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'accruals' | 'rules' | 'history'>('accruals');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH'>('THIS_MONTH');

  const [commissionRules, setCommissionRules] = useState<DoctorCommissionRule[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<DoctorPayoutTransaction[]>([]);
  const [accrued, setAccrued] = useState<DoctorAccruedEarnings | null>(null);
  const [metrics, setMetrics] = useState<HospitalTier3Metrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);
  const [ruleFormData, setRuleFormData] = useState<Partial<DoctorCommissionRule>>({});
  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [disburseFormData, setDisburseFormData] = useState<Partial<DoctorPayoutTransaction>>({});
  const [voucherData, setVoucherData] = useState<DoctorPayoutTransaction | null>(null);

  // Default doctor select
  const hasInitializedDoctorRef = useRef(false);
  useEffect(() => {
    if (doctors.length > 0 && !selectedDoctorId && !hasInitializedDoctorRef.current) {
      hasInitializedDoctorRef.current = true;
      setSelectedDoctorId(doctors[0].id);
    }
  }, [doctors, selectedDoctorId]);

  const dateBounds = useMemo(() => {
    const now = new Date();
    if (dateRangeFilter === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return { start, end };
    }
    if (dateRangeFilter === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start, end };
    }
    return { start: undefined, end: undefined };
  }, [dateRangeFilter]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [rules, payouts, m] = await Promise.all([
        storage.getDoctorCommissionRules(),
        storage.getDoctorPayoutTransactions(selectedDoctorId || undefined),
        storage.getHospitalTier3Metrics()
      ]);
      setCommissionRules(prev => JSON.stringify(prev) === JSON.stringify(rules) ? prev : rules);
      setPayoutHistory(prev => JSON.stringify(prev) === JSON.stringify(payouts) ? prev : payouts);
      setMetrics(prev => JSON.stringify(prev) === JSON.stringify(m) ? prev : m);

      if (selectedDoctorId) {
        const acc = await storage.calculateDoctorAccruedEarnings(selectedDoctorId, dateBounds.start, dateBounds.end);
        setAccrued(prev => JSON.stringify(prev) === JSON.stringify(acc) ? prev : acc);
      }
    } catch (e) {
      console.error('Failed to load doctor payouts data:', e);
      if (!silent) toast.show('Failed to load revenue share data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = (e: any) => {
      const dt = e?.detail?.dataType;
      if (!dt || dt === 'receipts' || dt === 'admission' || dt === 'ot' || dt === 'lab' || dt === 'payouts' || dt === 'all') {
        loadData(true);
      }
    };
    window.addEventListener('buvora-data-updated', handleSync);
    const interval = setInterval(() => loadData(true), 5000);
    return () => {
      window.removeEventListener('buvora-data-updated', handleSync);
      clearInterval(interval);
    };
  }, [selectedDoctorId, dateRangeFilter]);

  const currentDoctor = useMemo(() => {
    return doctors.find(d => d.id === selectedDoctorId);
  }, [doctors, selectedDoctorId]);

  // Open Edit/New Rule Modal
  const handleOpenRuleModal = (doctorIdToEdit?: string) => {
    const docId = doctorIdToEdit || selectedDoctorId;
    const doc = doctors.find(d => d.id === docId);
    const existingRule = commissionRules.find(r => r.doctorId === docId);

    if (existingRule) {
      setRuleFormData({ ...existingRule });
    } else {
      setRuleFormData({
        doctorId: docId,
        doctorName: doc?.name || 'Doctor',
        opdType: 'PERCENT',
        opdValue: 70,
        ipdVisitRate: 800,
        surgerySharePercent: 60,
        assistantSurgeonPercent: 15,
        anesthetistPercent: 25,
        labReferralPercent: 10,
        pharmacyReferralPercent: 0,
        tdsPercent: 10,
        hospitalFacilityRetentionPercent: 0,
        isActive: 1
      });
    }
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await storage.saveDoctorCommissionRule(ruleFormData);
      toast.show('Commission rule saved successfully', 'success');
      setShowRuleModal(false);
      loadData();
    } catch (e) {
      toast.show('Failed to save commission rule', 'error');
    }
  };

  // Open Settlement Modal
  const handleOpenDisburseModal = () => {
    if (!accrued || !currentDoctor) return;
    setDisburseFormData({
      doctorId: currentDoctor.id,
      doctorName: currentDoctor.name,
      periodStart: accrued.periodStart,
      periodEnd: accrued.periodEnd,
      opdConsultationEarnings: accrued.opdEarnings,
      ipdVisitsEarnings: accrued.ipdEarnings,
      surgeryEarnings: accrued.surgeryEarnings,
      labReferralEarnings: accrued.labEarnings,
      grossEarnings: accrued.grossEarnings,
      tdsDeduction: accrued.tdsDeduction,
      hospitalFacilityDeduction: accrued.hospitalFacilityDeduction,
      otherDeductions: 0,
      netPayoutAmount: accrued.balanceOutstanding > 0 ? accrued.balanceOutstanding : accrued.netPayable,
      paymentMode: 'BANK_TRANSFER',
      paymentReference: '',
      status: 'PAID',
      notes: `Payout settlement for ${currentDoctor.name} (${accrued.periodStart} to ${accrued.periodEnd})`,
      payoutDate: new Date().toISOString().split('T')[0]
    });
    setShowDisburseModal(true);
  };

  const handleSaveDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await storage.saveDoctorPayoutTransaction(disburseFormData);
      toast.show(`Disbursement recorded (${res.payoutNumber})`, 'success');
      setShowDisburseModal(false);
      loadData();
    } catch (e) {
      toast.show('Failed to record disbursement', 'error');
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleAfterPrint = () => {
      timer = setTimeout(() => {
        setVoucherData(null);
      }, 3000);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timer);
    };
  }, []);

  const handlePrintVoucher = (tx: DoctorPayoutTransaction) => {
    setVoucherData(tx);
    setTimeout(() => {
      window.print();
    }, 350);
  };

  return (
    <div className="payouts-container">
      <div className={`payouts-screen-ui ${voucherData ? 'no-print' : ''}`}>
      {/* ── KPI Summary Cards ───────────────────────────────────────────────── */}
      <div className="payouts-stats-grid">
        <div className="payout-stat-card">
          <div className="payout-stat-icon emerald">
            <DollarSign size={24} />
          </div>
          <div className="payout-stat-info">
            <span className="payout-stat-label">Total Payouts Disbursed</span>
            <span className="payout-stat-value">₹{(metrics?.totalDoctorPayoutsAmount || 0).toLocaleString()}</span>
            <span className="payout-stat-sub">{metrics?.totalDoctorPayoutsCount || 0} Transactions Settled</span>
          </div>
        </div>

        <div className="payout-stat-card">
          <div className="payout-stat-icon blue">
            <TrendingUp size={24} />
          </div>
          <div className="payout-stat-info">
            <span className="payout-stat-label">Doctor Net Payable</span>
            <span className="payout-stat-value">₹{(accrued?.netPayable || 0).toLocaleString()}</span>
            <span className="payout-stat-sub">Gross: ₹{(accrued?.grossEarnings || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="payout-stat-card">
          <div className="payout-stat-icon amber">
            <Wallet size={24} />
          </div>
          <div className="payout-stat-info">
            <span className="payout-stat-label">Outstanding Balance</span>
            <span className="payout-stat-value">₹{(accrued?.balanceOutstanding || 0).toLocaleString()}</span>
            <span className="payout-stat-sub">Paid: ₹{(accrued?.totalPaidAlready || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="payout-stat-card">
          <div className="payout-stat-icon purple">
            <Percent size={24} />
          </div>
          <div className="payout-stat-info">
            <span className="payout-stat-label">Commission Rules</span>
            <span className="payout-stat-value">{metrics?.activeDoctorsConfigured || 0}</span>
            <span className="payout-stat-sub">Configured Doctors</span>
          </div>
        </div>
      </div>

      {/* ── Top Navigation & Filters ────────────────────────────────────────── */}
      <div className="payouts-top-nav">
        <div className="payouts-mode-tabs">
          <button
            className={`payouts-mode-tab ${activeTab === 'accruals' ? 'active' : ''}`}
            onClick={() => setActiveTab('accruals')}
          >
            <TrendingUp size={15} /> Doctor Accrual & Settlement
          </button>
          <button
            className={`payouts-mode-tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            <Settings2 size={15} /> Commission Calibration
          </button>
          <button
            className={`payouts-mode-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FileCheck size={15} /> Disbursement Ledger ({payoutHistory.length})
          </button>
        </div>

        <div className="payouts-filter-bar">
          <div className="payouts-filter-left">
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Doctor:</label>
            <select
              className="payouts-filter-select"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
            >
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.specialization || 'Consultant'})</option>
              ))}
            </select>

            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</label>
            <select
              className="payouts-filter-select"
              value={dateRangeFilter}
              onChange={(e: any) => setDateRangeFilter(e.target.value)}
            >
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="ALL">All Time</option>
            </select>

            <button className="payout-btn-secondary" onClick={loadData} title="Refresh Ledger">
              <RefreshCw size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="payout-btn-secondary"
              onClick={() => handleOpenRuleModal(selectedDoctorId)}
            >
              <Settings2 size={14} /> Commission Rules
            </button>
            <button
              className="payout-btn-primary"
              onClick={handleOpenDisburseModal}
              disabled={!accrued || accrued.balanceOutstanding <= 0}
            >
              <ArrowUpRight size={14} /> Settle & Disburse (₹{(accrued?.balanceOutstanding || 0).toLocaleString()})
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB 1: DOCTOR ACCRUAL & SETTLEMENT BREAKDOWN ─────────────────────── */}
      {activeTab === 'accruals' && (
        <div className="doctor-accrual-overview">
          <div className="doctor-accrual-header">
            <div className="doctor-title-area">
              <h3>{currentDoctor?.name} — Revenue Share Ledger</h3>
              <p>Period: <strong>{accrued?.periodStart}</strong> to <strong>{accrued?.periodEnd}</strong> | Specialization: {currentDoctor?.specialization || 'Consultant'}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="payout-btn-secondary" onClick={() => handleOpenRuleModal(selectedDoctorId)}>
                Calibrate Rates ({accrued?.rule.opdValue}% OPD / ₹{accrued?.rule.ipdVisitRate} IPD)
              </button>
            </div>
          </div>

          <div className="doctor-accrual-grid">
            {/* 1. OPD Consultations */}
            <div className="accrual-breakdown-card opd">
              <div className="accrual-card-title">
                <span>OPD Consultations</span>
                <span>{accrued?.rule.opdType === 'FLAT' ? `₹${accrued?.rule.opdValue}/pt` : `${accrued?.rule.opdValue}% Share`}</span>
              </div>
              <div className="accrual-card-amount">₹{(accrued?.opdEarnings || 0).toLocaleString()}</div>
              <div className="accrual-card-detail">
                {accrued?.opdReceiptsCount || 0} visits | Total Rev: ₹{(accrued?.opdRevenue || 0).toLocaleString()}
              </div>
            </div>

            {/* 2. IPD Bed Rounds */}
            <div className="accrual-breakdown-card ipd">
              <div className="accrual-card-title">
                <span>IPD Inpatient Visits</span>
                <span>₹{accrued?.rule.ipdVisitRate}/visit</span>
              </div>
              <div className="accrual-card-amount">₹{(accrued?.ipdEarnings || 0).toLocaleString()}</div>
              <div className="accrual-card-detail">
                {accrued?.ipdVisitsCount || 0} inpatient admission rounds
              </div>
            </div>

            {/* 3. OT Surgical Procedures */}
            <div className="accrual-breakdown-card ot">
              <div className="accrual-card-title">
                <span>OT Surgical Procedures</span>
                <span>{accrued?.rule.surgerySharePercent}% Primary</span>
              </div>
              <div className="accrual-card-amount">₹{(accrued?.surgeryEarnings || 0).toLocaleString()}</div>
              <div className="accrual-card-detail">
                {accrued?.surgeryCount || 0} OT surgeries performed/assisted
              </div>
            </div>

            {/* 4. Diagnostic Lab Referrals */}
            <div className="accrual-breakdown-card lab">
              <div className="accrual-card-title">
                <span>Lab Test Referrals</span>
                <span>{accrued?.rule.labReferralPercent}% Cut</span>
              </div>
              <div className="accrual-card-amount">₹{(accrued?.labEarnings || 0).toLocaleString()}</div>
              <div className="accrual-card-detail">
                {accrued?.labOrdersCount || 0} orders | Rev: ₹{(accrued?.labRevenue || 0).toLocaleString()}
              </div>
            </div>

            {/* 5. Deductions */}
            <div className="accrual-breakdown-card deductions">
              <div className="accrual-card-title">
                <span>TDS & Facility Cut</span>
                <span>TDS {accrued?.rule.tdsPercent}%</span>
              </div>
              <div className="accrual-card-amount">-₹{((accrued?.tdsDeduction || 0) + (accrued?.hospitalFacilityDeduction || 0)).toLocaleString()}</div>
              <div className="accrual-card-detail">
                TDS: ₹{(accrued?.tdsDeduction || 0).toLocaleString()} | Hospital: ₹{(accrued?.hospitalFacilityDeduction || 0).toLocaleString()}
              </div>
            </div>

            {/* 6. Net Payable / Balance */}
            <div className="accrual-breakdown-card net">
              <div className="accrual-card-title">
                <span>Net Outstanding Balance</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>PAYABLE</span>
              </div>
              <div className="accrual-card-amount" style={{ color: '#059669' }}>
                ₹{(accrued?.balanceOutstanding || 0).toLocaleString()}
              </div>
              <div className="accrual-card-detail">
                Net Earned: ₹{(accrued?.netPayable || 0).toLocaleString()} | Paid: ₹{(accrued?.totalPaidAlready || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: COMMISSION RATE CALIBRATION ──────────────────────────────── */}
      {activeTab === 'rules' && (
        <div className="payouts-table-wrapper">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Doctor Commission Rules Matrix</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Configure department-wise revenue percentages and flat rates per doctor.
              </p>
            </div>
            <button className="payout-btn-primary" onClick={() => handleOpenRuleModal()}>
              <Plus size={14} /> Add Commission Rule
            </button>
          </div>

          <table className="payouts-table">
            <thead>
              <tr>
                <th>Doctor Name</th>
                <th>OPD Share</th>
                <th>IPD Round Rate</th>
                <th>OT Surgery Share</th>
                <th>Lab Referral</th>
                <th>TDS Deducted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map(d => {
                const rule = commissionRules.find(r => r.doctorId === d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.specialization || 'Consultant'}</div>
                    </td>
                    <td>
                      {rule ? (rule.opdType === 'FLAT' ? `₹${rule.opdValue} Flat` : `${rule.opdValue}%`) : '70% (Default)'}
                    </td>
                    <td>
                      ₹{rule?.ipdVisitRate ?? 800}/day
                    </td>
                    <td>
                      {rule?.surgerySharePercent ?? 60}% (Assist: {rule?.assistantSurgeonPercent ?? 15}%)
                    </td>
                    <td>
                      {rule?.labReferralPercent ?? 10}%
                    </td>
                    <td>
                      {rule?.tdsPercent ?? 10}%
                    </td>
                    <td>
                      <span className="badge-paid" style={{ background: '#ecfdf5', color: '#059669' }}>Active</span>
                    </td>
                    <td>
                      <button
                        className="payout-btn-secondary"
                        style={{ height: '28px !important', padding: '0 0.5rem !important', fontSize: '0.75rem !important' }}
                        onClick={() => handleOpenRuleModal(d.id)}
                      >
                        <Settings2 size={12} /> Configure
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 3: DISBURSEMENT HISTORY & LEDGER ────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="payouts-table-wrapper">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Disbursement Transaction History</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Official payouts ledger with voucher generation and bank transfer references.
              </p>
            </div>
          </div>

          <table className="payouts-table">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Doctor</th>
                <th>Period</th>
                <th>Gross Share</th>
                <th>TDS & Deductions</th>
                <th>Net Paid</th>
                <th>Mode & Ref</th>
                <th>Date</th>
                <th>Voucher</th>
              </tr>
            </thead>
            <tbody>
              {loading && payoutHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#0284c7', margin: '0 auto 8px', display: 'block' }} />
                    <div>Loading doctor payout history...</div>
                  </td>
                </tr>
              ) : payoutHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No disbursement transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payoutHistory.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <strong>{tx.payoutNumber}</strong>
                    </td>
                    <td>{tx.doctorName}</td>
                    <td>{tx.periodStart || 'N/A'} - {tx.periodEnd || 'N/A'}</td>
                    <td>₹{tx.grossEarnings?.toLocaleString()}</td>
                    <td style={{ color: '#dc2626' }}>-₹{(tx.tdsDeduction + tx.hospitalFacilityDeduction + (tx.otherDeductions || 0)).toLocaleString()}</td>
                    <td>
                      <strong style={{ color: '#059669', fontSize: '0.95rem' }}>₹{tx.netPayoutAmount?.toLocaleString()}</strong>
                    </td>
                    <td>
                      <span className="badge-mode">{tx.paymentMode}</span>
                      {tx.paymentReference && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ref: {tx.paymentReference}</div>}
                    </td>
                    <td>{tx.payoutDate}</td>
                    <td>
                      <button
                        className="payout-btn-secondary"
                        style={{ height: '28px !important', padding: '0 0.5rem !important', fontSize: '0.75rem !important' }}
                        onClick={() => handlePrintVoucher(tx)}
                      >
                        <Printer size={12} /> Voucher
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: COMMISSION RULE CALIBRATION ──────────────────────────────── */}
      {showRuleModal && (
        <div className="payout-modal-overlay">
          <div className="payout-modal-box">
            <div className="payout-modal-header">
              <h3>Configure Commission Rates — {ruleFormData.doctorName}</h3>
              <button className="indenting-clear-search" onClick={() => setShowRuleModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRule}>
              <div className="payout-modal-body">
                <div className="payout-form-row">
                  <div className="payout-form-group">
                    <label>OPD Commission Type</label>
                    <select
                      className="payouts-filter-select"
                      value={ruleFormData.opdType || 'PERCENT'}
                      onChange={(e: any) => setRuleFormData({ ...ruleFormData, opdType: e.target.value })}
                    >
                      <option value="PERCENT">Percentage of Consultation Fee (%)</option>
                      <option value="FLAT">Flat Rate Per Patient (₹)</option>
                    </select>
                  </div>
                  <div className="payout-form-group">
                    <label>{ruleFormData.opdType === 'FLAT' ? 'Flat Fee (₹)' : 'Commission Percentage (%)'}</label>
                    <input
                      type="number"
                      className="payouts-filter-input"
                      value={ruleFormData.opdValue ?? 70}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, opdValue: Number(e.target.value) })}
                      min="0"
                      max={ruleFormData.opdType === 'FLAT' ? 10000 : 100}
                      required
                    />
                  </div>
                </div>

                <div className="payout-form-row">
                  <div className="payout-form-group">
                    <label>IPD Inpatient Visit Rate (₹/round)</label>
                    <input
                      type="number"
                      className="payouts-filter-input"
                      value={ruleFormData.ipdVisitRate ?? 800}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, ipdVisitRate: Number(e.target.value) })}
                      min="0"
                      required
                    />
                  </div>
                  <div className="payout-form-group">
                    <label>Primary Surgeon OT Share (%)</label>
                    <input
                      type="number"
                      className="payouts-filter-input"
                      value={ruleFormData.surgerySharePercent ?? 60}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, surgerySharePercent: Number(e.target.value) })}
                      min="0"
                      max="100"
                      required
                    />
                  </div>
                </div>

                <div className="payout-form-row">
                  <div className="payout-form-group">
                    <label>Assistant Surgeon Share (%)</label>
                    <input
                      type="number"
                      className="payouts-filter-input"
                      value={ruleFormData.assistantSurgeonPercent ?? 15}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, assistantSurgeonPercent: Number(e.target.value) })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="payout-form-group">
                    <label>Anesthetist Share (%)</label>
                    <input
                      type="number"
                      className="payouts-filter-input"
                      value={ruleFormData.anesthetistPercent ?? 25}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, anesthetistPercent: Number(e.target.value) })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="payout-form-row">
                  <div className="payout-form-group">
                    <label>Lab Referral Cut (%)</label>
                    <input
                      type="number"
                      className="payouts-filter-input"
                      value={ruleFormData.labReferralPercent ?? 10}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, labReferralPercent: Number(e.target.value) })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="payout-form-group">
                    <label>TDS Deduction (%)</label>
                    <input
                      type="number"
                      className="payouts-filter-input"
                      value={ruleFormData.tdsPercent ?? 10}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, tdsPercent: Number(e.target.value) })}
                      min="0"
                      max="50"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="payout-modal-footer">
                <button type="button" className="payout-btn-secondary" onClick={() => setShowRuleModal(false)}>Cancel</button>
                <button type="submit" className="payout-btn-primary">Save Rates</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SETTLE & DISBURSE PAYOUT ─────────────────────────────────── */}
      {showDisburseModal && (
        <div className="payout-modal-overlay">
          <div className="payout-modal-box">
            <div className="payout-modal-header">
              <h3>Disburse Revenue Share — {disburseFormData.doctorName}</h3>
              <button className="indenting-clear-search" onClick={() => setShowDisburseModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveDisbursement}>
              <div className="payout-modal-body">
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span>Gross Earned Share:</span>
                    <strong>₹{disburseFormData.grossEarnings?.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#dc2626', marginBottom: '0.3rem' }}>
                    <span>TDS Deduction (10%):</span>
                    <span>-₹{disburseFormData.tdsDeduction?.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, color: '#059669', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                    <span>Net Disbursed Amount:</span>
                    <span>₹{disburseFormData.netPayoutAmount?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="payout-form-row">
                  <div className="payout-form-group">
                    <label>Payment Mode</label>
                    <select
                      className="payouts-filter-select"
                      value={disburseFormData.paymentMode}
                      onChange={(e: any) => setDisburseFormData({ ...disburseFormData, paymentMode: e.target.value })}
                    >
                      <option value="BANK_TRANSFER">Bank NEFT/RTGS</option>
                      <option value="UPI">UPI / Instant Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>
                  <div className="payout-form-group">
                    <label>Payment Reference / UTR #</label>
                    <input
                      type="text"
                      className="payouts-filter-input"
                      placeholder="e.g. UTR-98231456"
                      value={disburseFormData.paymentReference || ''}
                      onChange={(e) => setDisburseFormData({ ...disburseFormData, paymentReference: e.target.value })}
                    />
                  </div>
                </div>

                <div className="payout-form-row">
                  <div className="payout-form-group">
                    <label>Settlement Date</label>
                    <input
                      type="date"
                      className="payouts-filter-input"
                      value={disburseFormData.payoutDate}
                      onChange={(e) => setDisburseFormData({ ...disburseFormData, payoutDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="payout-form-group">
                    <label>Notes / Remarks</label>
                    <input
                      type="text"
                      className="payouts-filter-input"
                      value={disburseFormData.notes || ''}
                      onChange={(e) => setDisburseFormData({ ...disburseFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="payout-modal-footer">
                <button type="button" className="payout-btn-secondary" onClick={() => setShowDisburseModal(false)}>Cancel</button>
                <button type="submit" className="payout-btn-primary">Confirm Disbursement</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* ── PRINTABLE VOUCHER (MEDIA PRINT) ─────────────────────────────────── */}
      {voucherData && (
        <div className="payout-voucher-printable print-only">
          <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>HOSPITAL DOCTOR REVENUE SHARE VOUCHER</h2>
            <p style={{ margin: '0.25rem 0' }}>Payment Voucher #{voucherData.payoutNumber} | Date: {voucherData.payoutDate}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <p><strong>Doctor:</strong> {voucherData.doctorName}</p>
              <p><strong>Period:</strong> {voucherData.periodStart} to {voucherData.periodEnd}</p>
            </div>
            <div>
              <p><strong>Payment Mode:</strong> {voucherData.paymentMode}</p>
              <p><strong>Reference:</strong> {voucherData.paymentReference || 'N/A'}</p>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid black' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Component</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem' }}>OPD Consultations Earned</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>₹{voucherData.opdConsultationEarnings?.toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem' }}>IPD Inpatient Visits Earned</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>₹{voucherData.ipdVisitsEarnings?.toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem' }}>OT Surgical Fee Share</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>₹{voucherData.surgeryEarnings?.toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem' }}>Diagnostic Lab Referral Commission</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>₹{voucherData.labReferralEarnings?.toLocaleString()}</td>
              </tr>
              <tr style={{ borderTop: '1px solid black' }}>
                <td style={{ padding: '0.5rem' }}><strong>Gross Earnings</strong></td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}><strong>₹{voucherData.grossEarnings?.toLocaleString()}</strong></td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', color: '#b91c1c' }}>Less: TDS Deducted (10%)</td>
                <td style={{ textAlign: 'right', padding: '0.5rem', color: '#b91c1c' }}>-₹{voucherData.tdsDeduction?.toLocaleString()}</td>
              </tr>
              <tr style={{ borderTop: '2px solid black', fontSize: '1.1rem' }}>
                <td style={{ padding: '0.5rem' }}><strong>NET AMOUNT DISBURSED</strong></td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}><strong>₹{voucherData.netPayoutAmount?.toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4rem' }}>
            <div>_______________________<br />Doctor Signature</div>
            <div>_______________________<br />Authorized Hospital Signatory</div>
          </div>
        </div>
      )}
    </div>
  );
};
