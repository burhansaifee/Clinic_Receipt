import React, { useState, useEffect } from 'react';
import {
  Users,
  Receipt as ReceiptIcon,
  DollarSign,
  TrendingUp,
  PlusCircle,
  Calendar,
  Printer,
  MessageSquare,
  Server,
  Clock,
  Stethoscope,
  CreditCard,
  Banknote,
  Gift,
  Activity,
  ChevronRight,
  CalendarClock,
  Bed,
  Wallet,
  Pill
} from 'lucide-react';
import { storage, isAdvanceDepositReceipt, type Doctor, type Receipt as ReceiptType, type Prescription, type ReceiptPaperType, type PrescriptionPaperType, type FollowUp } from '../lib/storage';
import type { Tab } from './layout/Sidebar';
import '../styles/components/Dashboard.css';
import { useToast } from './ui/Toast';
import { sendReceiptViaWhatsApp } from '../lib/whatsappReceipt';

interface DashboardProps {
  doctors: Doctor[];
  dashboardMetrics: { totalReceipts: number; totalRevenue: number; avgPerReceipt: number };
  prescriptions?: Prescription[];
  pendingAppointmentsCount?: number;
  followUps?: FollowUp[];
  dueFollowUpsCount?: number;
  receiptPaperType?: ReceiptPaperType;
  prescriptionPaperType?: PrescriptionPaperType;
  botStatus?: any;
  workstationMode?: 'standalone' | 'host' | 'client';
  currentUser?: string | null;
  currentUserRole?: string;
  allowedTabs?: Tab[];
  onNavigate: (tab: Tab) => void;
  onNewReceipt: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  doctors,
  dashboardMetrics,
  prescriptions = [],
  pendingAppointmentsCount = 0,
  dueFollowUpsCount = 0,
  receiptPaperType = 'A5',
  prescriptionPaperType = 'A4',
  botStatus = { status: 'DISCONNECTED' },
  workstationMode = 'standalone',
  currentUser = 'admin',
  allowedTabs,
  onNavigate,
  onNewReceipt,
}) => {
  const toast = useToast();
  const [recentReceipts, setRecentReceipts] = useState<ReceiptType[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    cash: 0,
    online: 0,
    free: 0,
    cashCount: 0,
    onlineCount: 0,
    freeCount: 0,
  });
  const [facilityStats, setFacilityStats] = useState({
    facilityCount: 0,
    facilityRevenue: 0,
    opdCount: 0,
    opdRevenue: 0,
  });
  const [expenseStats, setExpenseStats] = useState({
    totalExpenses: 0,
    expenseCount: 0,
  });
  const [pharmacyStats, setPharmacyStats] = useState({
    totalMedicines: 0,
    todaySales: 0,
    lowStockCount: 0
  });
  const [ipdStats, setIpdStats] = useState({
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    occupancyRate: 0
  });

  useEffect(() => {
    let active = true;
    const loadDashboardData = async () => {
      try {
        const [receipts, appointments, allReceipts, expenses, pMetrics, ipdMetrics] = await Promise.all([
          storage.getReceipts({ limit: 6 }),
          storage.getAppointments(),
          storage.getReceipts(),
          storage.getExpenses(),
          storage.getPharmacyMetrics().catch(() => ({ totalMedicines: 0, todaySales: 0, lowStockCount: 0 })),
          storage.getIpdDashboardMetrics().catch(() => ({ totalBeds: 0, occupiedBeds: 0, availableBeds: 0, occupancyRate: 0 }))
        ]);

        if (!active) return;

        setRecentReceipts(receipts || []);
        if (pMetrics) {
          setPharmacyStats({
            totalMedicines: pMetrics.totalMedicines || 0,
            todaySales: pMetrics.todaySales || 0,
            lowStockCount: pMetrics.lowStockCount || 0
          });
        }
        if (ipdMetrics) {
          setIpdStats({
            totalBeds: ipdMetrics.totalBeds || 0,
            occupiedBeds: ipdMetrics.occupiedBeds || 0,
            availableBeds: ipdMetrics.availableBeds || 0,
            occupancyRate: ipdMetrics.occupancyRate || 0
          });
        }
        
        // Filter today or pending/confirmed appointments sorted by date/time
        const sortedApts = [...(appointments || [])].sort((a, b) => {
          if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
          if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
          return (b.appointmentDate || '').localeCompare(a.appointmentDate || '');
        });
        setRecentAppointments(sortedApts.slice(0, 5));

        // Calculate payment and departmental breakdown from all receipts
        let cash = 0, online = 0, free = 0;
        let cashCount = 0, onlineCount = 0, freeCount = 0;
        let facilityCount = 0, facilityRevenue = 0;
        let opdCount = 0, opdRevenue = 0;

        (allReceipts || []).forEach((r) => {
          const amount = Number(r.total) || 0;
          if (r.billType === 'FACILITY') {
            facilityCount++;
            facilityRevenue += amount;
          } else {
            opdCount++;
            opdRevenue += amount;
          }

          if (r.paymentMethod === 'ONLINE') {
            online += amount;
            onlineCount++;
          } else if (r.paymentMethod === 'FREE') {
            free += amount;
            freeCount++;
          } else {
            cash += amount;
            cashCount++;
          }
        });

        setPaymentBreakdown({ cash, online, free, cashCount, onlineCount, freeCount });
        setFacilityStats({ facilityCount, facilityRevenue, opdCount, opdRevenue });

        const totalExp = (expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
        setExpenseStats({ totalExpenses: totalExp, expenseCount: (expenses || []).length });
      } catch (err) {
        console.error('Failed to load dashboard extended data:', err);
      }
    };

    loadDashboardData();
    return () => {
      active = false;
    };
  }, []);

  const totalCalculatedRevenue = paymentBreakdown.cash + paymentBreakdown.online;
  const cashPercentage = totalCalculatedRevenue > 0 ? Math.round((paymentBreakdown.cash / totalCalculatedRevenue) * 100) : 50;
  const onlinePercentage = totalCalculatedRevenue > 0 ? Math.round((paymentBreakdown.online / totalCalculatedRevenue) * 100) : 50;

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard no-print">
      {/* ── 1. Modern Clinical Hero Banner ─────────────────────────────────── */}
      <div className="dashboard-hero-card">
        <div className="hero-ambient-glow" />

        {/* Quick Action Navigation Buttons - Horizontal On Top */}
        <div className="hero-actions">
          <button className="btn-hero-primary" onClick={onNewReceipt}>
            <PlusCircle size={18} />
            <span>Generate OPD Receipt</span>
          </button>
          <button
            className="btn-hero-secondary"
            onClick={() => onNavigate('beds')}
            style={{ background: 'rgba(2, 132, 199, 0.25)', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#e0f2fe' }}
          >
            <Bed size={18} style={{ color: '#38bdf8' }} />
            <span>IPD Beds ({ipdStats.occupiedBeds}/{ipdStats.totalBeds})</span>
          </button>
          <button
            className="btn-hero-secondary"
            onClick={() => onNavigate('facility-billing')}
            style={{ background: 'rgba(126, 34, 206, 0.25)', borderColor: 'rgba(192, 132, 252, 0.4)', color: '#f3e8ff' }}
          >
            <Bed size={18} style={{ color: '#c084fc' }} />
            <span>Inpatient &amp; Facility Bill</span>
          </button>
          <button
            className="btn-hero-secondary"
            onClick={() => onNavigate('pharmacy')}
            style={{ background: 'rgba(16, 185, 129, 0.25)', borderColor: 'rgba(52, 211, 153, 0.4)', color: '#ecfdf5' }}
          >
            <Pill size={18} style={{ color: '#34d399' }} />
            <span>Pharmacy &amp; POS</span>
          </button>
          {(!allowedTabs || allowedTabs.includes('appointments')) && (
            <button className="btn-hero-secondary" onClick={() => onNavigate('appointments')}>
              <Calendar size={18} />
              <span>Appointments</span>
              {pendingAppointmentsCount > 0 && (
                <span className="hero-alert-pill">{pendingAppointmentsCount}</span>
              )}
            </button>
          )}
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-status-dot" />
            <span>CLINICAL COMMAND CENTER</span>
            <span className="hero-badge-divider">•</span>
            <span>{currentDateFormatted}</span>
          </div>
          <h2 className="hero-title">
            Welcome back, <span className="hero-user-highlight">{currentUser || 'Administrator'}</span>
          </h2>
          <p className="hero-subtitle" style={{ margin: 0 }}>
            Clinic operational summary: {dashboardMetrics.totalReceipts} invoices ({facilityStats.opdCount} OPD • {facilityStats.facilityCount} Inpatient), {prescriptions.length} prescriptions issued, and {doctors.length} consulting doctors active.
          </p>
        </div>
      </div>

      {/* ── 2. Key Operational Metrics (6-Card Executive Grid) ───────────────── */}
      <div className="stats-metric-grid">
        {/* Card 1: Total Gross Revenue */}
        <div className="stat-box stat-emerald">
          <div className="stat-box-top">
            <div className="stat-icon-wrapper emerald-icon">
              <DollarSign size={22} />
            </div>
            <span className="stat-pill-trend positive">+₹ Gross Income</span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Gross Clinic Revenue</span>
            <div className="stat-number-text">₹{dashboardMetrics.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill emerald-fill" style={{ width: '85%' }} />
            </div>
            <span className="stat-subtext">OPD: ₹{facilityStats.opdRevenue.toLocaleString()} • Inpatient: ₹{facilityStats.facilityRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 2: Clinic Expenses & Net Profit */}
        <div className="stat-box stat-rose" onClick={() => onNavigate('expenses')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper" style={{ background: '#ffe4e6', color: '#e11d48' }}>
              <Wallet size={22} />
            </div>
            <span className="stat-pill-trend" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
              Net: ₹{(dashboardMetrics.totalRevenue - expenseStats.totalExpenses).toLocaleString()}
            </span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Clinic Expenses</span>
            <div className="stat-number-text" style={{ color: '#e11d48' }}>₹{expenseStats.totalExpenses.toLocaleString()}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill" style={{ width: `${Math.min(100, (expenseStats.totalExpenses / (dashboardMetrics.totalRevenue || 1)) * 100)}%`, background: '#f43f5e' }} />
            </div>
            <span className="stat-subtext">{expenseStats.expenseCount} logged expenses • Click to view ledger</span>
          </div>
        </div>

        {/* Card 3: Inpatient & Facility Care */}
        <div className="stat-box stat-purple" onClick={() => onNavigate('facility-billing')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
              <Bed size={22} />
            </div>
            <span className="stat-pill-trend" style={{ background: '#f3e8ff', color: '#7e22ce', borderColor: '#e9d5ff' }}>
              ₹{facilityStats.facilityRevenue.toLocaleString()}
            </span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Inpatient &amp; Facility Stays</span>
            <div className="stat-number-text">{facilityStats.facilityCount}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill purple-fill" style={{ width: `${Math.min(100, facilityStats.facilityCount * 15)}%` }} />
            </div>
            <span className="stat-subtext">Room, oxygen &amp; daycare admissions</span>
          </div>
        </div>

        {/* Card 4: Total Receipts & Bills */}
        <div className="stat-box stat-blue" onClick={() => onNavigate('history')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper blue-icon">
              <ReceiptIcon size={22} />
            </div>
            <span className="stat-pill-trend info">Invoices</span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Total Receipts &amp; Bills</span>
            <div className="stat-number-text">{dashboardMetrics.totalReceipts.toLocaleString()}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill blue-fill" style={{ width: '70%' }} />
            </div>
            <span className="stat-subtext">{facilityStats.opdCount} OPD • {facilityStats.facilityCount} Inpatient</span>
          </div>
        </div>

        {/* Card 5: Avg Ticket Size */}
        <div className="stat-box stat-indigo">
          <div className="stat-box-top">
            <div className="stat-icon-wrapper indigo-icon">
              <TrendingUp size={22} />
            </div>
            <span className="stat-pill-trend neutral">Per Patient</span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Avg. Ticket Size</span>
            <div className="stat-number-text">₹{dashboardMetrics.avgPerReceipt.toFixed(1)}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill indigo-fill" style={{ width: '60%' }} />
            </div>
            <span className="stat-subtext">Average consultation charge</span>
          </div>
        </div>

        {/* Card 4: Prescriptions Issued */}
        <div className="stat-box stat-purple" onClick={() => onNavigate('prescriptions')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper purple-icon">
              <Stethoscope size={22} />
            </div>
            <span className="stat-pill-trend purple-pill">Rx Records</span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Prescriptions (Rx)</span>
            <div className="stat-number-text">{prescriptions.length}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill purple-fill" style={{ width: '75%' }} />
            </div>
            <span className="stat-subtext">Doctor workstation consultations</span>
          </div>
        </div>

        {/* Card 5: Appointments & Queue */}
        {(!allowedTabs || allowedTabs.includes('appointments')) && (
          <div className="stat-box stat-amber" onClick={() => onNavigate('appointments')} style={{ cursor: 'pointer' }}>
            <div className="stat-box-top">
              <div className="stat-icon-wrapper amber-icon">
                <Calendar size={22} />
              </div>
              {pendingAppointmentsCount > 0 ? (
                <span className="stat-pill-trend alert-pulse">{pendingAppointmentsCount} Pending</span>
              ) : (
                <span className="stat-pill-trend neutral">All Clear</span>
              )}
            </div>
            <div className="stat-box-body">
              <span className="stat-label-text">Pending Appointments</span>
              <div className="stat-number-text">{pendingAppointmentsCount}</div>
            </div>
            <div className="stat-footer-bar">
              <div className="stat-progress-bg">
                <div className="stat-progress-fill amber-fill" style={{ width: `${Math.min(100, pendingAppointmentsCount * 25)}%` }} />
              </div>
              <span className="stat-subtext">WhatsApp booking desk queue</span>
            </div>
          </div>
        )}

        {/* Card 6: Follow-Ups Due Today */}
        <div className="stat-box stat-cyan" onClick={() => onNavigate('follow-ups')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper cyan-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <CalendarClock size={22} />
            </div>
            {dueFollowUpsCount > 0 ? (
              <span className="stat-pill-trend alert-pulse" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>{dueFollowUpsCount} Due Today</span>
            ) : (
              <span className="stat-pill-trend neutral">All Clear</span>
            )}
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Follow-Ups Today</span>
            <div className="stat-number-text">{dueFollowUpsCount}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill cyan-fill" style={{ width: `${Math.min(100, (dueFollowUpsCount || 0) * 20)}%` }} />
            </div>
            <span className="stat-subtext">Patient revisits scheduled for today</span>
          </div>
        </div>

        {/* Card 7: Doctors Registered */}
        <div className="stat-box stat-cyan" onClick={() => onNavigate('doctors')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper cyan-icon">
              <Users size={22} />
            </div>
            <span className="stat-pill-trend info">Medical Registry</span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Consulting Doctors</span>
            <div className="stat-number-text">{doctors.length}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill cyan-fill" style={{ width: '90%' }} />
            </div>
            <span className="stat-subtext">Active medical specialists</span>
          </div>
        </div>

        {/* Card 8: Hospital Pharmacy & POS */}
        <div className="stat-box stat-purple" onClick={() => onNavigate('pharmacy')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <Pill size={22} />
            </div>
            <span className="stat-pill-trend" style={{ background: '#dcfce7', color: '#15803d' }}>
              {pharmacyStats.lowStockCount > 0 ? `${pharmacyStats.lowStockCount} Low Stock` : 'Stock Healthy'}
            </span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Hospital Pharmacy</span>
            <div className="stat-number-text">{pharmacyStats.totalMedicines} Formulations</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill" style={{ width: '88%', background: '#16a34a' }} />
            </div>
            <span className="stat-subtext">₹{pharmacyStats.todaySales.toLocaleString()} dispensed today • 1-click POS</span>
          </div>
        </div>

        {/* Card 9: Hospital Inpatient Beds & Ward Occupancy */}
        <div className="stat-box stat-cyan" onClick={() => onNavigate('beds')} style={{ cursor: 'pointer' }}>
          <div className="stat-box-top">
            <div className="stat-icon-wrapper" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <Bed size={22} />
            </div>
            <span
              className="stat-pill-trend"
              style={{
                background: ipdStats.occupancyRate > 80 ? '#fee2e2' : '#ecfdf5',
                color: ipdStats.occupancyRate > 80 ? '#dc2626' : '#059669',
                borderColor: ipdStats.occupancyRate > 80 ? '#fecaca' : '#a7f3d0'
              }}
            >
              {ipdStats.occupancyRate}% Occupied
            </span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Inpatient Bed Matrix</span>
            <div className="stat-number-text">{ipdStats.occupiedBeds} / {ipdStats.totalBeds} Beds</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div
                className="stat-progress-fill"
                style={{
                  width: `${Math.min(100, ipdStats.occupancyRate || 10)}%`,
                  background: ipdStats.occupancyRate > 80 ? '#ef4444' : '#0284c7'
                }}
              />
            </div>
            <span className="stat-subtext">{ipdStats.availableBeds} vacant beds ready for admission</span>
          </div>
        </div>
      </div>

      {/* ── 3. Middle Section: Payment Breakdown & Clinic Health Hub ────────── */}
      <div className="dashboard-two-col">
        {/* Payment Breakdown Card */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <div className="dash-header-title">
              <div className="header-icon-mini green">
                <CreditCard size={18} />
              </div>
              <div>
                <h3>Payment Methods &amp; Split</h3>
                <p>Distribution of total receipts across payment channels</p>
              </div>
            </div>
            <span className="dash-badge-sub">₹{totalCalculatedRevenue.toLocaleString()} Total</span>
          </div>

          <div className="payment-distribution-container">
            {/* Visual Multi-Segment Bar */}
            <div className="payment-multi-bar">
              <div
                className="payment-segment seg-cash"
                style={{ width: `${cashPercentage}%` }}
                title={`Cash: ₹${paymentBreakdown.cash} (${cashPercentage}%)`}
              />
              <div
                className="payment-segment seg-online"
                style={{ width: `${onlinePercentage}%` }}
                title={`Online/UPI: ₹${paymentBreakdown.online} (${onlinePercentage}%)`}
              />
            </div>

            {/* Detailed Row Cards */}
            <div className="payment-channel-list">
              <div className="payment-channel-item">
                <div className="channel-info-left">
                  <div className="channel-icon-pill cash-pill">
                    <Banknote size={16} />
                  </div>
                  <div>
                    <span className="channel-name">Cash Collections</span>
                    <span className="channel-count">{paymentBreakdown.cashCount} receipts</span>
                  </div>
                </div>
                <div className="channel-amount-right">
                  <span className="channel-val">₹{paymentBreakdown.cash.toLocaleString()}</span>
                  <span className="channel-pct">{cashPercentage}%</span>
                </div>
              </div>

              <div className="payment-channel-item">
                <div className="channel-info-left">
                  <div className="channel-icon-pill online-pill">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <span className="channel-name">Online UPI &amp; Digital</span>
                    <span className="channel-count">{paymentBreakdown.onlineCount} receipts</span>
                  </div>
                </div>
                <div className="channel-amount-right">
                  <span className="channel-val">₹{paymentBreakdown.online.toLocaleString()}</span>
                  <span className="channel-pct">{onlinePercentage}%</span>
                </div>
              </div>

              <div className="payment-channel-item">
                <div className="channel-info-left">
                  <div className="channel-icon-pill free-pill">
                    <Gift size={16} />
                  </div>
                  <div>
                    <span className="channel-name">Complimentary / Free</span>
                    <span className="channel-count">{paymentBreakdown.freeCount} patient visits</span>
                  </div>
                </div>
                <div className="channel-amount-right">
                  <span className="channel-val">₹0.00</span>
                  <span className="channel-pct">Exempt</span>
                </div>
              </div>
            </div>

            {/* Department Collections Breakdown */}
            <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block' }}>OPD CONSULTATIONS</span>
                <strong style={{ fontSize: '1rem', color: '#0284c7' }}>₹{facilityStats.opdRevenue.toLocaleString()}</strong>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>{facilityStats.opdCount} visits</span>
              </div>
              <div style={{ background: '#faf5ff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                <span style={{ fontSize: '0.72rem', color: '#7e22ce', fontWeight: 600, display: 'block' }}>INPATIENT &amp; FACILITY</span>
                <strong style={{ fontSize: '1rem', color: '#7e22ce' }}>₹{facilityStats.facilityRevenue.toLocaleString()}</strong>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>{facilityStats.facilityCount} stays / care</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices / Receipts */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <div className="dash-header-title">
              <div className="header-icon-mini blue">
                <ReceiptIcon size={18} />
              </div>
              <div>
                <h3>Recent Patient Invoices</h3>
                <p>Latest generated billing transactions</p>
              </div>
            </div>
            <button className="btn-dash-link" onClick={() => onNavigate('history')}>
              View All History <ChevronRight size={14} />
            </button>
          </div>

          <div className="activity-list">
            {recentReceipts.length === 0 ? (
              <div className="empty-activity-state">
                <ReceiptIcon size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>No billing receipts recorded yet.</p>
                <button className="btn-primary-sm" onClick={onNewReceipt} style={{ marginTop: '0.5rem' }}>
                  + Create First Receipt
                </button>
              </div>
            ) : (
              recentReceipts.map((rec) => (
                <div key={rec.id} className="activity-item">
                  <div className="activity-left" onClick={() => onNavigate('history')} style={{ cursor: 'pointer' }}>
                    <div className="activity-avatar" style={{ background: rec.billType === 'FACILITY' ? '#7e22ce' : undefined }}>
                      {rec.patientName ? rec.patientName.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div>
                      <div className="activity-main-line" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="activity-patient-name">{rec.patientName}</span>
                        {rec.patientId && (
                          <span style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            {rec.patientId}
                          </span>
                        )}
                        {isAdvanceDepositReceipt(rec) ? (
                          <span style={{ fontSize: '0.65rem', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            ADVANCE DEPOSIT {rec.roomNumber ? `• ${rec.roomNumber}` : ''}
                          </span>
                        ) : rec.billType === 'FACILITY' ? (
                          <span style={{ fontSize: '0.65rem', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            DISCHARGE BILL {rec.roomNumber ? `• ${rec.roomNumber}` : ''}
                          </span>
                        ) : null}
                        <span className="activity-meta-tag">
                          {rec.patientAge ? `${rec.patientAge}y` : ''} {rec.patientGender ? `• ${rec.patientGender}` : ''}
                        </span>
                      </div>
                      <div className="activity-sub-line">
                        <span className="activity-doc">{rec.doctorName || 'Consulting Doctor'}</span>
                        <span className="activity-dot">•</span>
                        <span className="activity-rec-no">{rec.receiptNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="activity-right">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="activity-amount">₹{Number(rec.total || 0).toLocaleString()}</span>
                      <button
                        className="btn-quick-wa"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await sendReceiptViaWhatsApp(rec);
                            toast(res.message || 'Receipt sent via WhatsApp!', { type: 'success' });
                          } catch (err: any) {
                            toast(err.message || 'Failed to send WhatsApp message', { type: 'error' });
                          }
                        }}
                        title="Send Receipt via WhatsApp"
                      >
                        <MessageSquare size={12} />
                      </button>
                    </div>
                    <span
                      className={`payment-badge-pill ${
                        rec.paymentMethod === 'ONLINE'
                          ? 'badge-online'
                          : rec.paymentMethod === 'FREE'
                          ? 'badge-free'
                          : 'badge-cash'
                      }`}
                    >
                      {rec.paymentMethod || 'CASH'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Lower Section: System Diagnostics & Appointments Activity ─────── */}
      <div className="dashboard-two-col">
        {/* System Diagnostics & Automation Hub */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <div className="dash-header-title">
              <div className="header-icon-mini cyan">
                <Activity size={18} />
              </div>
              <div>
                <h3>System &amp; Hardware Status</h3>
                <p>Real-time connectivity, printer formats, and database health</p>
              </div>
            </div>
            <button className="btn-dash-link" onClick={() => onNavigate('settings')}>
              Control Center <ChevronRight size={14} />
            </button>
          </div>

          <div className="system-health-grid">
            <div className="health-tile">
              <div className="health-tile-left">
                <div className="health-icon purple">
                  <Printer size={18} />
                </div>
                <div>
                  <span className="health-title">Printer Configuration</span>
                  <span className="health-desc">
                    Receipt: <strong>{receiptPaperType}</strong> • Rx: <strong>{prescriptionPaperType}</strong>
                  </span>
                </div>
              </div>
              <span className="health-status-badge active">Configured</span>
            </div>

            <div className="health-tile">
              <div className="health-tile-left">
                <div className="health-icon green">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <span className="health-title">WhatsApp Booking Bot</span>
                  <span className="health-desc">
                    {botStatus?.status === 'CONNECTED'
                      ? 'Automated 24/7 patient booking active'
                      : botStatus?.status === 'QR_READY'
                      ? 'Scan QR code in Control Center'
                      : 'Bot disconnected'}
                  </span>
                </div>
              </div>
              <span
                className={`health-status-badge ${
                  botStatus?.status === 'CONNECTED' ? 'active' : botStatus?.status === 'QR_READY' ? 'pending' : 'neutral'
                }`}
              >
                {botStatus?.status || 'OFFLINE'}
              </span>
            </div>

            <div className="health-tile">
              <div className="health-tile-left">
                <div className="health-icon blue">
                  <Server size={18} />
                </div>
                <div>
                  <span className="health-title">Workstation Network Mode</span>
                  <span className="health-desc">
                    {workstationMode === 'host'
                      ? 'Central Database Host Server'
                      : workstationMode === 'client'
                      ? 'Connected to Network Host'
                      : 'Standalone Local Workstation'}
                  </span>
                </div>
              </div>
              <span className="health-status-badge active">{workstationMode.toUpperCase()}</span>
            </div>

          </div>
        </div>

        {/* Recent / Upcoming Appointments */}
        <div className="card dash-card">
          <div className="dash-card-header">
            <div className="dash-header-title">
              <div className="header-icon-mini amber">
                <Calendar size={18} />
              </div>
              <div>
                <h3>Appointment Desk</h3>
                <p>WhatsApp &amp; reception patient schedule</p>
              </div>
            </div>
            <button className="btn-dash-link" onClick={() => onNavigate('appointments')}>
              Open Desk <ChevronRight size={14} />
            </button>
          </div>

          <div className="activity-list">
            {recentAppointments.length === 0 ? (
              <div className="empty-activity-state">
                <Calendar size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>No active or pending appointments found.</p>
                <button className="btn-secondary-sm" onClick={() => onNavigate('appointments')} style={{ marginTop: '0.5rem' }}>
                  Open Appointment Desk
                </button>
              </div>
            ) : (
              recentAppointments.map((apt) => (
                <div key={apt.id} className="activity-item">
                  <div className="activity-left">
                    <div className={`activity-avatar ${apt.status === 'PENDING' ? 'avatar-pending' : 'avatar-apt'}`}>
                      <Clock size={16} />
                    </div>
                    <div>
                      <div className="activity-main-line">
                        <span className="activity-patient-name">{apt.patientName}</span>
                        {apt.patientPhone && (
                          <span className="activity-meta-tag">{apt.patientPhone}</span>
                        )}
                      </div>
                      <div className="activity-sub-line">
                        <span className="activity-doc">{apt.doctorName || 'Doctor'}</span>
                        <span className="activity-dot">•</span>
                        <span className="activity-rec-no">{apt.appointmentDate} {apt.appointmentTime ? `(${apt.appointmentTime})` : ''}</span>
                      </div>
                    </div>
                  </div>

                  <div className="activity-right">
                    <span
                      className={`apt-badge-pill ${
                        apt.status === 'CONFIRMED'
                          ? 'apt-confirmed'
                          : apt.status === 'CANCELLED'
                          ? 'apt-cancelled'
                          : 'apt-pending'
                      }`}
                    >
                      {apt.status || 'PENDING'}
                    </span>
                    {apt.status === 'PENDING' && (
                      <button
                        className="btn-quick-review"
                        onClick={() => onNavigate('appointments')}
                        title="Review Appointment"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
