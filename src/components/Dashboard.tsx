import React from 'react';
import { type Doctor, type Receipt } from '../lib/storage';
import { Users, Receipt as ReceiptIcon, DollarSign, TrendingUp, PlusCircle } from 'lucide-react';

interface DashboardProps {
  doctors: Doctor[];
  receipts: Receipt[];
  onNewReceipt: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ doctors, receipts, onNewReceipt }) => {
  const totalRevenue = receipts.reduce((sum, r) => sum + (r.paymentMethod === 'FREE' ? 0 : r.total), 0);
  const recentReceipts = receipts.slice(-5).reverse();

  return (
    <div className="dashboard no-print">
      <header className="dashboard-header">
        <div className="welcome-section">
          <h2>Welcome back, Admin</h2>
          <p className="text-muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn-primary-glow" onClick={onNewReceipt}>
          <PlusCircle size={20} />
          Generate New Receipt
        </button>
      </header>

      <div className="stats-grid">
        <div className="card stat-card gradient-blue">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Doctors</span>
            <span className="stat-value">{doctors.length}</span>
          </div>
          <div className="stat-chart-mini">
             <div className="bar" style={{ height: '40%' }}></div>
             <div className="bar" style={{ height: '60%' }}></div>
             <div className="bar" style={{ height: '45%' }}></div>
             <div className="bar" style={{ height: '80%' }}></div>
          </div>
        </div>

        <div className="card stat-card gradient-green">
          <div className="stat-icon">
            <ReceiptIcon size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Receipts Generated</span>
            <span className="stat-value">{receipts.length}</span>
          </div>
           <div className="stat-chart-mini">
             <div className="bar" style={{ height: '30%' }}></div>
             <div className="bar" style={{ height: '50%' }}></div>
             <div className="bar" style={{ height: '70%' }}></div>
             <div className="bar" style={{ height: '90%' }}></div>
          </div>
        </div>

        <div className="card stat-card gradient-purple">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">₹{totalRevenue.toLocaleString()}</span>
          </div>
           <div className="stat-chart-mini">
             <div className="bar" style={{ height: '50%' }}></div>
             <div className="bar" style={{ height: '40%' }}></div>
             <div className="bar" style={{ height: '60%' }}></div>
             <div className="bar" style={{ height: '75%' }}></div>
          </div>
        </div>

        <div className="card stat-card gradient-orange">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Avg. per Receipt</span>
            <span className="stat-value">₹{receipts.length ? (totalRevenue / receipts.length).toFixed(1) : 0}</span>
          </div>
           <div className="stat-chart-mini">
             <div className="bar" style={{ height: '40%' }}></div>
             <div className="bar" style={{ height: '55%' }}></div>
             <div className="bar" style={{ height: '45%' }}></div>
             <div className="bar" style={{ height: '65%' }}></div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card quick-actions-card">
          <h3>Quick Actions</h3>
          <div className="actions-list">
            <button className="action-btn" onClick={onNewReceipt}>
              <PlusCircle size={20} />
              <span>Create New Receipt</span>
            </button>
          </div>
        </div>

        <div className="card recent-activity">
          <h3>Recent Receipts</h3>
          <div className="activity-list">
            {recentReceipts.length === 0 ? (
              <p className="text-muted">No recent activity</p>
            ) : (
              recentReceipts.map(r => (
                <div key={r.id} className="activity-item">
                  <div className="activity-main">
                    <strong>{r.patientName}</strong>
                    <span className="text-muted">#{r.receiptNumber}</span>
                  </div>
                  <div className="activity-meta">
                    <span className="amount">₹{r.total}</span>
                    <span className="date">{r.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .welcome-section h2 {
          font-size: 1.75rem;
          color: var(--text-main);
          margin: 0;
        }

        .btn-primary-glow {
          background: var(--primary);
          color: white;
          padding: 0.75rem 1.5rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.3);
          transition: all 0.2s;
        }

        .btn-primary-glow:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 25px -5px rgba(14, 165, 233, 0.4);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          border: none;
        }

        .stat-card::after {
          content: '';
          position: absolute;
          top: 0; right: 0; width: 100px; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1));
          pointer-events: none;
        }

        .gradient-blue { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; }
        .gradient-green { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; }
        .gradient-purple { background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: white; }
        .gradient-orange { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(4px);
        }

        .stat-label {
          display: block;
          font-size: 0.875rem;
          opacity: 0.9;
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
        }

        .stat-chart-mini {
          position: absolute;
          bottom: 0;
          right: 1.5rem;
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 40px;
        }

        .stat-chart-mini .bar {
          width: 4px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px 2px 0 0;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 1.5rem;
        }

        .quick-actions-card {
           background: white;
           padding: 2rem;
        }

        .actions-list {
          margin-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text-main);
          font-weight: 600;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }

        .action-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }

        .activity-list {
          margin-top: 1rem;
        }

        .activity-item {
          display: flex;
          justify-content: space-between;
          padding: 1.25rem 0;
          border-bottom: 1px solid var(--border);
        }

        .activity-item:last-child { border-bottom: none; }

        .activity-main {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .activity-main strong { font-size: 1.05rem; }

        .activity-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }

        .amount {
          font-weight: 700;
          color: var(--primary);
          font-size: 1.1rem;
        }

        .date {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
