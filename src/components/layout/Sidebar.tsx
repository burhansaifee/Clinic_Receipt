import React from 'react';
import {
  LayoutDashboard, Users, Receipt, PlusCircle, Settings,
  Calendar, FileText, Briefcase, LogOut, KeyRound
} from 'lucide-react';

export type Tab =
  | 'dashboard'
  | 'doctors'
  | 'services'
  | 'new-receipt'
  | 'history'
  | 'prescriptions'
  | 'appointments'
  | 'settings';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  currentUser: string;
  isOnline: boolean;
  pendingAppointmentsCount: number;
  onLogout: () => void;
  onNewReceipt: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  isOnline,
  pendingAppointmentsCount,
  onLogout,
  onNewReceipt,
}) => {
  return (
    <aside className="sidebar no-print">
      <div className="sidebar-header">
        <div className="logo">
          <svg className="logo-svg" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
            <rect x="32" y="32" width="448" height="448" rx="110" fill="url(#logoGrad)" />
            <path d="M256 128 V384 M128 256 H384" stroke="#ffffff" strokeWidth="64" strokeLinecap="round" />
          </svg>
          <span>MedFlow</span>
        </div>
      </div>

      <nav className="nav-menu">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'new-receipt' ? 'active' : ''}`}
          onClick={onNewReceipt}
        >
          <PlusCircle size={20} />
          <span>New Receipt</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Receipt size={20} />
          <span>History</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          <FileText size={20} />
          <span>Prescriptions</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
          style={{ position: 'relative' }}
        >
          <Calendar size={20} />
          <span>Appointments</span>
          {pendingAppointmentsCount > 0 && (
            <span style={{
              marginLeft: 'auto',
              background: '#ef4444',
              color: 'white',
              borderRadius: '9999px',
              padding: '2px 8px',
              fontSize: '0.72rem',
              fontWeight: 'bold',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
            }}>
              {pendingAppointmentsCount}
            </span>
          )}
        </button>

        <button
          className={`nav-item ${activeTab === 'doctors' ? 'active' : ''}`}
          onClick={() => setActiveTab('doctors')}
        >
          <Users size={20} />
          <span>Doctors</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <Briefcase size={20} />
          <span>Clinic Services</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={20} />
          <span>Control Center</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-container" style={{ flexDirection: 'column', width: '100%', marginBottom: '1rem' }}>
          <div className="user-profile" style={{ width: '100%', justifyContent: 'center' }}>
            <KeyRound size={14} style={{ marginRight: '6px', color: '#0ea5e9' }} />
            <span>Workstation: <strong>{currentUser}</strong></span>
          </div>
          <button
            className="btn-logout"
            onClick={onLogout}
            title="Sign Out Profile"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <LogOut size={15} />
            <span>Disconnect</span>
          </button>
        </div>

        {(currentUser && currentUser !== 'default' && isOnline) ? (
          <div className="status-badge online">
            <div className="dot green"></div>
            Online Mode Active
          </div>
        ) : (currentUser && currentUser !== 'default' && !isOnline) ? (
          <div className="status-badge offline">
            <div className="dot amber"></div>
            Offline (No Network)
          </div>
        ) : (
          <div className="status-badge offline">
            <div className="dot amber"></div>
            Offline Mode Active
          </div>
        )}

        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Software Developed by</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>Badshah Computer's</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
