import React from 'react';
import {
  LayoutDashboard, Users, Receipt, PlusCircle, Settings,
  Calendar, FileText, Briefcase, LogOut, KeyRound, X
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
  isMobileMenuOpen?: boolean;
  closeMenu?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  isOnline,
  pendingAppointmentsCount,
  onLogout,
  onNewReceipt,
  isMobileMenuOpen,
  closeMenu,
}) => {
  return (
    <>
      {isMobileMenuOpen && <div className="sidebar-overlay" onClick={closeMenu}></div>}
      <aside className={`sidebar no-print ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <svg className="logo-svg" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0d9488" />
              </linearGradient>
            </defs>
            <rect x="32" y="32" width="448" height="448" rx="110" fill="url(#logoGrad)" />
            <path d="M256 128 V384 M128 256 H384" stroke="#ffffff" strokeWidth="64" strokeLinecap="round" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Buvora</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Clinic System</span>
          </div>
        </div>
        {isMobileMenuOpen && (
          <button className="btn-close-menu" onClick={closeMenu}>
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="nav-menu">
        <div className="nav-section-label">CLINICAL DESK</div>

        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'new-receipt' ? 'active' : ''}`}
          onClick={onNewReceipt}
        >
          <PlusCircle size={18} />
          <span>New Receipt</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Receipt size={18} />
          <span> Receipt History</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          <FileText size={18} />
          <span>Prescriptions (Rx)</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          <Calendar size={18} />
          <span>Appointments</span>
          {pendingAppointmentsCount > 0 && (
            <span className="nav-badge-pill alert">
              {pendingAppointmentsCount}
            </span>
          )}
        </button>

        <div className="nav-section-label" style={{ marginTop: '0.75rem' }}>MANAGEMENT</div>

        <button
          className={`nav-item ${activeTab === 'doctors' ? 'active' : ''}`}
          onClick={() => setActiveTab('doctors')}
        >
          <Users size={18} />
          <span>Doctors Registry</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <Briefcase size={18} />
          <span>Clinic Services</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} />
          <span>Control Center</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-box">
          <div className="user-profile-info">
            <div className="user-avatar-pill">
              <KeyRound size={14} />
            </div>
            <div className="user-text-details">
              <span className="user-name">{currentUser || 'Admin'}</span>
              <span className="user-status-text">
                <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`} />
                {isOnline ? 'Active Sync' : 'Local Standalone'}
              </span>
            </div>
          </div>
          <button
            className="btn-user-disconnect"
            onClick={onLogout}
            title="Sign Out / Switch Profile"
          >
            <LogOut size={15} />
          </button>
        </div>

        <div className="sidebar-brand-footer">
          <span>Buvora v3.0 • Developed by Badshah Computers</span>
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
