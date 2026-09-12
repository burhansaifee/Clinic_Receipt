import React from 'react';
import {
  LayoutDashboard, Users, Receipt, PlusCircle, Settings,
  Calendar, FileText, Briefcase, LogOut, KeyRound, X,
  CalendarClock, Bed, BedDouble, Pill, FlaskConical,
  Stethoscope, Wallet, ShieldCheck, Scissors, AlertOctagon,
  Tv, DollarSign, PackagePlus
} from 'lucide-react';

export type Tab =
  | 'dashboard'
  | 'doctors'
  | 'services'
  | 'expenses'
  | 'users'
  | 'new-receipt'
  | 'facility-billing'
  | 'insurance'
  | 'beds'
  | 'inpatient-census'
  | 'nursing-station'
  | 'ot-management'
  | 'emergency'
  | 'history'
  | 'prescriptions'
  | 'pharmacy'
  | 'lab'
  | 'appointments'
  | 'follow-ups'
  | 'doctor-payouts'
  | 'queue-display'
  | 'stock-indenting'
  | 'settings';

interface NavItemConfig {
  tab: Tab;
  label: string;
  icon: React.ComponentType<{ size: number; className?: string; color?: string; style?: React.CSSProperties }>;
  badgeCount?: number;
  badgeAlert?: boolean;
  badgeColor?: string;
  onClick?: () => void;
}

interface NavSectionConfig {
  id: string;
  title: string;
  items: NavItemConfig[];
}

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  currentUser: string;
  currentUserRole: string;
  isOnline: boolean;
  pendingAppointmentsCount: number;
  dueFollowUpsCount?: number;
  onLogout: () => void;
  onNewReceipt: () => void;
  isMobileMenuOpen?: boolean;
  closeMenu?: () => void;
  allowedTabs?: Tab[];
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  currentUserRole,
  isOnline,
  pendingAppointmentsCount,
  dueFollowUpsCount = 0,
  onLogout,
  onNewReceipt,
  isMobileMenuOpen,
  closeMenu,
  allowedTabs,
}) => {
  const isTabAllowed = (tab: Tab): boolean => {
    const isUserAdmin = currentUser?.toLowerCase() === 'admin';
    if (isUserAdmin) return true;
    if (allowedTabs && allowedTabs.length > 0) {
      return allowedTabs.includes(tab);
    }
    if (currentUserRole === 'nurse') {
      return ['nursing-station', 'inpatient-census', 'beds', 'emergency', 'ot-management', 'stock-indenting'].includes(tab);
    }
    if (currentUserRole === 'reception') {
      return [
        'dashboard', 'new-receipt', 'facility-billing', 'insurance', 'nursing-station', 'beds',
        'inpatient-census', 'emergency', 'ot-management', 'history', 'prescriptions', 'pharmacy',
        'lab', 'appointments', 'follow-ups', 'queue-display', 'stock-indenting'
      ].includes(tab);
    }
    if (currentUserRole === 'management') {
      return [
        'doctors', 'services', 'expenses', 'pharmacy', 'insurance', 'nursing-station', 'beds',
        'inpatient-census', 'emergency', 'ot-management', 'lab', 'users', 'doctor-payouts',
        'queue-display', 'stock-indenting', 'settings'
      ].includes(tab);
    }
    return true;
  };

  const navSections: NavSectionConfig[] = [
    {
      id: 'overview',
      title: 'OVERVIEW',
      items: [
        {
          tab: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
        }
      ]
    },
    {
      id: 'clinical',
      title: 'CLINICAL & OPD',
      items: [
        {
          tab: 'appointments',
          label: 'Appointments',
          icon: Calendar,
          badgeCount: pendingAppointmentsCount,
          badgeAlert: true,
        },
        {
          tab: 'prescriptions',
          label: 'Prescriptions (Rx)',
          icon: FileText,
        },
        {
          tab: 'follow-ups',
          label: 'Patient Follow-Ups',
          icon: CalendarClock,
          badgeCount: dueFollowUpsCount,
          badgeColor: '#0284c7',
        },
        {
          tab: 'queue-display',
          label: 'Queue Display & QDS',
          icon: Tv,
        }
      ]
    },
    {
      id: 'billing',
      title: 'CASHIER & BILLING',
      items: [
        {
          tab: 'new-receipt',
          label: 'New OPD Receipt',
          icon: PlusCircle,
          onClick: onNewReceipt,
        },
        {
          tab: 'facility-billing',
          label: 'Facility & IPD Billing',
          icon: Bed,
        },
        {
          tab: 'insurance',
          label: 'TPA / Cashless Claims',
          icon: ShieldCheck,
        },
        {
          tab: 'history',
          label: 'Invoices & History',
          icon: Receipt,
        }
      ]
    },
    {
      id: 'ipd',
      title: 'INPATIENT CARE (IPD)',
      items: [
        {
          tab: 'nursing-station',
          label: 'Nursing & eMAR Station',
          icon: Stethoscope,
        },
        {
          tab: 'inpatient-census',
          label: 'Inpatient Census',
          icon: Users,
        },
        {
          tab: 'beds',
          label: 'Beds & Wards Matrix',
          icon: BedDouble,
        }
      ]
    },
    {
      id: 'emergency-ot',
      title: 'EMERGENCY & SURGERY',
      items: [
        {
          tab: 'emergency',
          label: 'Emergency & Triage',
          icon: AlertOctagon,
        },
        {
          tab: 'ot-management',
          label: 'Operation Theatre (OT)',
          icon: Scissors,
        }
      ]
    },
    {
      id: 'pharmacy-lab',
      title: 'PHARMACY & LABS',
      items: [
        {
          tab: 'pharmacy',
          label: 'Pharmacy & POS',
          icon: Pill,
        },
        {
          tab: 'lab',
          label: 'Diagnostics & Lab',
          icon: FlaskConical,
        },
        {
          tab: 'stock-indenting',
          label: 'Internal Stock Indents',
          icon: PackagePlus,
        }
      ]
    },
    {
      id: 'management',
      title: 'MANAGEMENT & SETUP',
      items: [
        {
          tab: 'doctors',
          label: 'Doctors Registry',
          icon: Stethoscope,
        },
        {
          tab: 'services',
          label: 'Clinic Services & Tariffs',
          icon: Briefcase,
        },
        {
          tab: 'expenses',
          label: 'Clinic Expenses',
          icon: Wallet,
        },
        {
          tab: 'doctor-payouts',
          label: 'Doctor Revenue & Payouts',
          icon: DollarSign,
        },
        {
          tab: 'users',
          label: 'Staff & User Roles',
          icon: KeyRound,
        },
        {
          tab: 'settings',
          label: 'Control Center',
          icon: Settings,
        }
      ]
    }
  ];

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
          {navSections.map(section => {
            const visibleItems = section.items.filter(item => isTabAllowed(item.tab));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.id} className="nav-section-group">
                <div className="nav-section-label">
                  <span>{section.title}</span>
                </div>
                <div className="nav-section-items">
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.tab;

                    return (
                      <button
                        key={item.tab}
                        type="button"
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          if (item.onClick) {
                            item.onClick();
                          } else {
                            setActiveTab(item.tab);
                          }
                        }}
                        title={item.label}
                      >
                        <Icon size={17} className="nav-item-icon" />
                        <span className="nav-item-text">{item.label}</span>
                        {Boolean(item.badgeCount && item.badgeCount > 0) && (
                          <span
                            className={`nav-badge-pill ${item.badgeAlert ? 'alert' : ''}`}
                            style={item.badgeColor ? { background: item.badgeColor, color: 'white' } : undefined}
                          >
                            {item.badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
            <span>Buvora v4.0.1 • Developed by Badshah Computers</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
