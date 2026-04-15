import React from 'react';
import { type Doctor, type Receipt } from '../lib/storage';
import { Users, Receipt as ReceiptIcon, DollarSign, TrendingUp, PlusCircle } from 'lucide-react';

interface DashboardProps {
  doctors: Doctor[];
  receipts: Receipt[];
  onNewReceipt: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ doctors, receipts, onNewReceipt }) => {
  const totalRevenue = receipts.reduce((sum, r) => sum + r.total, 0);
  const recentReceipts = receipts.slice(-5).reverse();

  return (
    <div className="dashboard no-print">
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon blue">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Doctors</span>
            <span className="stat-value">{doctors.length}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon green">
            <ReceiptIcon size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Receipts Generated</span>
            <span className="stat-value">{receipts.length}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon purple">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">₹{totalRevenue.toLocaleString()}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon orange">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Avg. per Receipt</span>
            <span className="stat-value">₹{receipts.length ? (totalRevenue / receipts.length).toFixed(1) : 0}</span>
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
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.blue { background: #e0f2fe; color: #0ea5e9; }
        .stat-icon.green { background: #f0fdf4; color: #22c55e; }
        .stat-icon.purple { background: #faf5ff; color: #a855f7; }
        .stat-icon.orange { background: #fff7ed; color: #f97316; }

        .stat-label {
          display: block;
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 1.5rem;
        }

        .quick-actions-card {
           background: linear-gradient(135deg, white 0%, #f8fafc 100%);
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
          background: white;
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
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }

        .activity-list {
          margin-top: 1rem;
        }

        .activity-item {
          display: flex;
          justify-content: space-between;
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
        }

        .activity-item:last-child { border-bottom: none; }

        .activity-main {
          display: flex;
          flex-direction: column;
        }

        .activity-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .amount {
          font-weight: 600;
          color: var(--primary);
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
