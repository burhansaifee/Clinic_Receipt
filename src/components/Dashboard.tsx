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
  ChevronRight
} from 'lucide-react';
import { storage, type Doctor, type Receipt as ReceiptType, type Prescription, type ReceiptPaperType, type PrescriptionPaperType } from '../lib/storage';
import type { Tab } from './layout/Sidebar';
import { useToast } from './ui/Toast';
import { sendReceiptViaWhatsApp } from '../lib/whatsappReceipt';

interface DashboardProps {
  doctors: Doctor[];
  dashboardMetrics: { totalReceipts: number; totalRevenue: number; avgPerReceipt: number };
  prescriptions?: Prescription[];
  pendingAppointmentsCount?: number;
  receiptPaperType?: ReceiptPaperType;
  prescriptionPaperType?: PrescriptionPaperType;
  botStatus?: any;
  workstationMode?: 'standalone' | 'host' | 'client';
  currentUser?: string | null;
  currentUserRole?: string;
  onNavigate: (tab: Tab) => void;
  onNewReceipt: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  doctors,
  dashboardMetrics,
  prescriptions = [],
  pendingAppointmentsCount = 0,
  receiptPaperType = 'A5',
  prescriptionPaperType = 'A4',
  botStatus = { status: 'DISCONNECTED' },
  workstationMode = 'standalone',
  currentUser = 'admin',
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

  useEffect(() => {
    let active = true;
    const loadDashboardData = async () => {
      try {
        const [receipts, appointments] = await Promise.all([
          storage.getReceipts({ limit: 5 }),
          storage.getAppointments(),
        ]);

        if (!active) return;

        setRecentReceipts(receipts || []);
        
        // Filter today or pending/confirmed appointments sorted by date/time
        const sortedApts = [...(appointments || [])].sort((a, b) => {
          if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
          if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
          return (b.appointmentDate || '').localeCompare(a.appointmentDate || '');
        });
        setRecentAppointments(sortedApts.slice(0, 5));

        // Calculate payment breakdown from all receipts
        const allReceipts = await storage.getReceipts();
        let cash = 0, online = 0, free = 0;
        let cashCount = 0, onlineCount = 0, freeCount = 0;

        (allReceipts || []).forEach((r) => {
          const amount = Number(r.total) || 0;
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
            Clinic operational summary: {dashboardMetrics.totalReceipts} invoices generated, {prescriptions.length} medical prescriptions issued, and {doctors.length} active doctors on duty.
          </p>
        </div>

        <div className="hero-actions">
          <button className="btn-hero-primary" onClick={onNewReceipt}>
            <PlusCircle size={18} />
            <span>Generate Receipt</span>
          </button>
          <button className="btn-hero-secondary" onClick={() => onNavigate('appointments')}>
            <Calendar size={18} />
            <span>Appointment Desk</span>
            {pendingAppointmentsCount > 0 && (
              <span className="hero-alert-pill">{pendingAppointmentsCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. Key Operational Metrics (6-Card Executive Grid) ───────────────── */}
      <div className="stats-metric-grid">
        {/* Card 1: Total Revenue */}
        <div className="stat-box stat-emerald">
          <div className="stat-box-top">
            <div className="stat-icon-wrapper emerald-icon">
              <DollarSign size={22} />
            </div>
            <span className="stat-pill-trend positive">+₹ Net Income</span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Total Revenue</span>
            <div className="stat-number-text">₹{dashboardMetrics.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill emerald-fill" style={{ width: '85%' }} />
            </div>
            <span className="stat-subtext">Includes Cash &amp; Online UPI</span>
          </div>
        </div>

        {/* Card 2: Receipts Issued */}
        <div className="stat-box stat-blue">
          <div className="stat-box-top">
            <div className="stat-icon-wrapper blue-icon">
              <ReceiptIcon size={22} />
            </div>
            <span className="stat-pill-trend info">Invoices</span>
          </div>
          <div className="stat-box-body">
            <span className="stat-label-text">Total Receipts</span>
            <div className="stat-number-text">{dashboardMetrics.totalReceipts.toLocaleString()}</div>
          </div>
          <div className="stat-footer-bar">
            <div className="stat-progress-bg">
              <div className="stat-progress-fill blue-fill" style={{ width: '70%' }} />
            </div>
            <span className="stat-subtext">Issued &amp; printed records</span>
          </div>
        </div>

        {/* Card 3: Avg Ticket Size */}
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

        {/* Card 6: Doctors Registered */}
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
                  <div className="activity-left">
                    <div className="activity-avatar">
                      {rec.patientName ? rec.patientName.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div>
                      <div className="activity-main-line">
                        <span className="activity-patient-name">{rec.patientName}</span>
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

      <style>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
          padding-bottom: 2rem;
        }

        /* Hero Card */
        .dashboard-hero-card {
          position: relative;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f233a 100%);
          color: white;
          padding: 2.25rem 2.5rem;
          border-radius: 20px;
          box-shadow: 0 20px 30px -10px rgba(15, 23, 42, 0.25);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .hero-ambient-glow {
          position: absolute;
          right: -80px;
          top: -80px;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.12) 50%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 680px;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(14, 165, 233, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.3);
          color: #38bdf8;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.3rem 0.85rem;
          border-radius: 9999px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 0.85rem;
        }

        .hero-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 8px #38bdf8;
        }

        .hero-badge-divider {
          opacity: 0.5;
        }

        .hero-title {
          font-size: 1.85rem;
          font-weight: 700;
          color: white;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.02em;
          font-family: 'Outfit', sans-serif;
        }

        .hero-user-highlight {
          color: #38bdf8;
          text-shadow: 0 0 20px rgba(56, 189, 248, 0.3);
        }

        .hero-subtitle {
          color: #94a3b8;
          font-size: 0.9rem;
          line-height: 1.55;
        }

        .hero-actions {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 210px;
        }

        .btn-hero-primary {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white;
          border: none;
          padding: 0.85rem 1.4rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          cursor: pointer;
          box-shadow: 0 10px 20px -3px rgba(14, 165, 233, 0.4);
          transition: all 0.25s ease;
        }

        .btn-hero-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -4px rgba(14, 165, 233, 0.5);
        }

        .btn-hero-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.18);
          padding: 0.75rem 1.4rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }

        .btn-hero-secondary:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .hero-alert-pill {
          background: #ef4444;
          color: white;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          margin-left: 4px;
        }

        /* ── Metric Cards Grid ────────────────────────────────────────────── */
        .stats-metric-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.25rem;
        }

        .stat-box {
          background: white;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.35rem 1.4rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          transition: all 0.25s ease;
          box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.03);
          position: relative;
          overflow: hidden;
        }

        .stat-box:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 20px -4px rgba(15, 23, 42, 0.07);
          border-color: #cbd5e1;
        }

        .stat-box-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .emerald-icon { background: #ecfdf5; color: #059669; }
        .blue-icon { background: #eff6ff; color: #2563eb; }
        .indigo-icon { background: #eef2ff; color: #4f46e5; }
        .purple-icon { background: #f5f3ff; color: #7c3aed; }
        .amber-icon { background: #fffbeb; color: #d97706; }
        .cyan-icon { background: #ecfeff; color: #0891b2; }

        .stat-pill-trend {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .positive { background: #dcfce7; color: #15803d; }
        .info { background: #e0f2fe; color: #0369a1; }
        .neutral { background: #f1f5f9; color: #475569; }
        .purple-pill { background: #ede9fe; color: #6d28d9; }
        .alert-pulse { background: #fee2e2; color: #b91c1c; animation: pulse 2s infinite; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .stat-label-text {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .stat-number-text {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
          line-height: 1.1;
          margin-top: 2px;
        }

        .stat-footer-bar {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: auto;
          padding-top: 4px;
        }

        .stat-progress-bg {
          height: 4px;
          width: 100%;
          background: #f1f5f9;
          border-radius: 9999px;
          overflow: hidden;
        }

        .stat-progress-fill {
          height: 100%;
          border-radius: 9999px;
        }

        .emerald-fill { background: linear-gradient(90deg, #10b981, #059669); }
        .blue-fill { background: linear-gradient(90deg, #38bdf8, #0284c7); }
        .indigo-fill { background: linear-gradient(90deg, #818cf8, #4f46e5); }
        .purple-fill { background: linear-gradient(90deg, #c084fc, #9333ea); }
        .amber-fill { background: linear-gradient(90deg, #fbbf24, #d97706); }
        .cyan-fill { background: linear-gradient(90deg, #22d3ee, #0891b2); }

        .stat-subtext {
          font-size: 0.725rem;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Two Column Sections ──────────────────────────────────────────── */
        .dashboard-two-col {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        .dash-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.6rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.03);
        }

        .dash-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
          padding-bottom: 1rem;
        }

        .dash-header-title {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .dash-header-title h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .dash-header-title p {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .header-icon-mini {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon-mini.green { background: #dcfce7; color: #059669; }
        .header-icon-mini.cyan { background: #cffafe; color: #0891b2; }
        .header-icon-mini.blue { background: #dbeafe; color: #2563eb; }
        .header-icon-mini.amber { background: #fef3c7; color: #d97706; }

        .dash-badge-sub {
          background: #f1f5f9;
          color: #334155;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 8px;
        }

        .btn-dash-link {
          background: transparent;
          border: none;
          color: var(--primary);
          font-size: 0.82rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .btn-dash-link:hover {
          background: #f0f9ff;
        }

        /* Payment Distribution */
        .payment-distribution-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .payment-multi-bar {
          height: 12px;
          width: 100%;
          background: #f1f5f9;
          border-radius: 9999px;
          display: flex;
          overflow: hidden;
        }

        .payment-segment {
          height: 100%;
          transition: width 0.4s ease;
        }

        .seg-cash { background: #10b981; }
        .seg-online { background: #0284c7; }

        .payment-channel-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .payment-channel-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .channel-info-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .channel-icon-pill {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cash-pill { background: #dcfce7; color: #15803d; }
        .online-pill { background: #e0f2fe; color: #0369a1; }
        .free-pill { background: #f1f5f9; color: #64748b; }

        .channel-name {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .channel-count {
          display: block;
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .channel-amount-right {
          text-align: right;
        }

        .channel-val {
          display: block;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-main);
        }

        .channel-pct {
          display: block;
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
        }

        /* Health Tiles */
        .system-health-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .health-tile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .health-tile-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .health-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .health-icon.purple { background: #f3e8ff; color: #9333ea; }
        .health-icon.green { background: #dcfce7; color: #16a34a; }
        .health-icon.blue { background: #dbeafe; color: #2563eb; }
        .health-icon.slate { background: #f1f5f9; color: #475569; }

        .health-title {
          display: block;
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .health-desc {
          display: block;
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .health-status-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .health-status-badge.active { background: #dcfce7; color: #15803d; }
        .health-status-badge.pending { background: #fef3c7; color: #b45309; }
        .health-status-badge.neutral { background: #f1f5f9; color: #64748b; }

        /* Activity Lists */
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .activity-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0.9rem;
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 12px;
          transition: background 0.15s;
        }

        .activity-item:hover {
          background: #f1f5f9;
        }

        .activity-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .activity-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0ea5e9, #0284c7);
          color: white;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .activity-avatar.avatar-apt { background: linear-gradient(135deg, #6366f1, #4f46e5); }
        .activity-avatar.avatar-pending { background: linear-gradient(135deg, #f59e0b, #d97706); }

        .activity-main-line {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .activity-patient-name {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .activity-meta-tag {
          font-size: 0.72rem;
          color: #64748b;
          background: #e2e8f0;
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .activity-sub-line {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .activity-dot {
          opacity: 0.4;
        }

        .activity-right {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
          flex-shrink: 0;
        }

        .activity-amount {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-main);
        }

        .payment-badge-pill {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.04em;
        }

        .badge-cash { background: #dcfce7; color: #15803d; }
        .badge-online { background: #e0f2fe; color: #0284c7; }
        .badge-free { background: #f1f5f9; color: #64748b; }

        .btn-quick-wa {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #16a34a;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .btn-quick-wa:hover {
          background: #16a34a;
          color: white;
          border-color: #16a34a;
          transform: scale(1.1);
        }

        .apt-badge-pill {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .apt-confirmed { background: #dcfce7; color: #15803d; }
        .apt-pending { background: #fef3c7; color: #b45309; }
        .apt-cancelled { background: #fee2e2; color: #b91c1c; }

        .btn-quick-review {
          background: #0284c7;
          color: white;
          border: none;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 2px;
        }

        .empty-activity-state {
          text-align: center;
          padding: 2rem 1rem;
          color: #94a3b8;
          font-size: 0.85rem;
        }

        /* ── Responsive Rules ─────────────────────────────────────────────── */
        @media (max-width: 1024px) {
          .dashboard-hero-card {
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-actions {
            width: 100%;
            flex-direction: row;
          }
          .btn-hero-primary, .btn-hero-secondary {
            flex: 1;
          }
          .dashboard-two-col {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .hero-actions {
            flex-direction: column;
          }
          .stats-metric-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
