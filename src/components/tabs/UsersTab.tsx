import React, { useState } from 'react';
import {
  Users, UserPlus, SlidersHorizontal, Trash2,
  Lock, AlertCircle, Search, UserCheck, Stethoscope, Briefcase, X
} from 'lucide-react';
import type { Doctor } from '../../lib/storage';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

interface UsersTabProps {
  currentUser: string | null;
  knownUsers: { id: string; role: string; doctorId?: string; allowedTabs?: string[] }[];
  setKnownUsers: (users: { id: string; role: string; doctorId?: string; allowedTabs?: string[] }[]) => void;
  doctors: Doctor[];
}

export const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard', desk: 'Clinical Desk' },
  { id: 'new-receipt', label: 'New Receipt', desk: 'Clinical Desk' },
  { id: 'history', label: 'Receipt History', desk: 'Clinical Desk' },
  { id: 'prescriptions', label: 'Prescriptions (Rx)', desk: 'Clinical Desk' },
  { id: 'appointments', label: 'Appointments', desk: 'Clinical Desk' },
  { id: 'follow-ups', label: 'Follow-Ups', desk: 'Clinical Desk' },
  { id: 'doctors', label: 'Doctors Registry', desk: 'Management' },
  { id: 'services', label: 'Clinic Services', desk: 'Management' },
  { id: 'expenses', label: 'Bills & Expenses', desk: 'Management' },
  { id: 'users', label: 'Profiles & Users', desk: 'Management' },
  { id: 'settings', label: 'Control Center', desk: 'Management' },
];

export const UsersTab: React.FC<UsersTabProps> = ({
  currentUser,
  knownUsers,
  setKnownUsers,
  doctors,
}) => {
  const confirm = useConfirm();
  const toast = useToast();

  // Registration form state
  const [newUserIdInput, setNewUserIdInput] = useState('');
  const [newUserRole, setNewUserRole] = useState<'reception' | 'doctor' | 'management'>('reception');
  const [selectedDoctorIdForUser, setSelectedDoctorIdForUser] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'reception' | 'doctor' | 'management' | 'admin'>('all');

  // Modal / Drawer state for screen assignments
  const [editingUserTabsId, setEditingUserTabsId] = useState<string | null>(null);
  const [tempUserTabs, setTempUserTabs] = useState<string[]>([]);

  // Password reset modal state
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const isAdmin = currentUser?.toLowerCase() === 'admin';

  // Stats calculation
  const totalUsers = knownUsers.length;
  const receptionCount = knownUsers.filter(u => u.role === 'reception').length;
  const doctorCount = knownUsers.filter(u => u.role === 'doctor').length;
  const managementCount = knownUsers.filter(u => u.role === 'management' || u.role === 'admin').length;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = newUserIdInput.trim().toLowerCase();
    if (!userId) {
      toast('Please enter a User ID', { type: 'error' });
      return;
    }

    if (newUserRole === 'doctor' && !selectedDoctorIdForUser) {
      toast('Please link a physician profile from the Doctors Registry', { type: 'error' });
      return;
    }

    try {
      const result = await window.users.addKnownUser(
        userId,
        newUserRole,
        newUserRole === 'doctor' ? selectedDoctorIdForUser : undefined
      );

      if (result.success) {
        if (newUserPassword.trim()) {
          await window.users.setUserPassword(userId, newUserPassword.trim());
        }

        setNewUserIdInput('');
        setNewUserPassword('');
        setNewUserRole('reception');
        setSelectedDoctorIdForUser('');

        const users = await window.users.getKnownUsers();
        setKnownUsers(users);
        toast(`User ID "${userId}" successfully registered!`, { type: 'success' });
      } else {
        toast(result.error || 'Failed to add user.', { type: 'error' });
      }
    } catch (err: any) {
      toast(err.message || 'An error occurred while creating user.', { type: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === 'default' || userId === 'admin') return;
    const ok = await confirm(
      `Are you sure you want to delete "${userId}"? This user will no longer be able to log in to this workstation.`,
      { isDanger: true }
    );
    if (ok) {
      const result = await window.users.deleteKnownUser(userId);
      if (result.success) {
        const users = await window.users.getKnownUsers();
        setKnownUsers(users);
        toast(`User ID "${userId}" has been removed.`, { type: 'success' });
      } else {
        toast(result.error || 'Failed to delete user.', { type: 'error' });
      }
    }
  };

  const handleSaveUserTabs = async (userId: string) => {
    try {
      const res = await window.users.updateUserTabs(userId, tempUserTabs);
      if (res.success) {
        toast(`Updated allowed screens for "${userId}"`, { type: 'success' });
        setEditingUserTabsId(null);
        const updated = await window.users.getKnownUsers();
        setKnownUsers(updated);
      } else {
        toast(res.error || 'Failed to update user screens', { type: 'error' });
      }
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUserId) return;
    try {
      const res = await window.users.setUserPassword(passwordResetUserId, newPasswordInput.trim() || undefined);
      if (res.success) {
        toast(`Password for "${passwordResetUserId}" has been updated!`, { type: 'success' });
        setPasswordResetUserId(null);
        setNewPasswordInput('');
      } else {
        toast(res.error || 'Failed to update password', { type: 'error' });
      }
    } catch (err: any) {
      toast(err.message || 'Error setting password', { type: 'error' });
    }
  };

  // Filtered users
  const filteredUsers = knownUsers.filter(u => {
    const matchesSearch = u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' ? true : u.role.toLowerCase() === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="users-management-tab" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Hero Banner */}
      <div
        className="control-header-banner"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: 'white',
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          marginBottom: '1.75rem',
          boxShadow: '0 10px 25px -5px rgba(15,23,42,0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '160px', height: '160px', background: 'radial-gradient(circle, rgba(244,63,94,0.2) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(244,63,94,0.15)', color: '#fb7185', fontSize: '0.725rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '9999px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.65rem', border: '1px solid rgba(244,63,94,0.25)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fb7185' }} /> WORKSPACE ACCESS &amp; RBAC
        </div>
        <h2 style={{ fontSize: '1.65rem', margin: '0 0 0.4rem 0', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'white' }}>Clinic Profiles &amp; User Management</h2>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', maxWidth: '720px', lineHeight: 1.5 }}>
          Create and manage authorized staff login accounts, link physician credentials to consultation desks, and fine-tune modular screen permissions across your clinic workstations.
        </p>

        {/* Quick Stats Pill Row */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 1.1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Users size={18} style={{ color: '#38bdf8' }} />
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Accounts</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>{totalUsers}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 1.1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <UserCheck size={18} style={{ color: '#34d399' }} />
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Receptionists</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>{receptionCount}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 1.1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Stethoscope size={18} style={{ color: '#a78bfa' }} />
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Doctors</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>{doctorCount}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 1.1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Briefcase size={18} style={{ color: '#fbbf24' }} />
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Managers &amp; Admin</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>{managementCount}</div>
            </div>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div style={{ padding: '0.85rem 1.25rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>You are viewing user profiles in read-only mode. Only the system administrator (<strong>admin</strong>) can create new accounts, assign screen permissions, or delete profiles.</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '380px 1fr' : '1fr', gap: '1.75rem', alignItems: 'start' }}>
        {/* Left Column: Register New Account (Admin Only) */}
        {isAdmin && (
          <div className="card" style={{ padding: '1.75rem', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.55rem', borderRadius: '10px' }}>
                <UserPlus size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Register New User</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authorize a new staff login profile</p>
              </div>
            </div>

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  USER ID / LOGIN USERNAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g. reception_front, dr_smith"
                  value={newUserIdInput}
                  onChange={e => setNewUserIdInput(e.target.value.toLowerCase())}
                  className="sync-input-line"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.875rem', borderRadius: '10px', boxSizing: 'border-box' }}
                  required
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '3px', display: 'block' }}>Lowercase letters, numbers, and underscores</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  SYSTEM ROLE *
                </label>
                <select
                  value={newUserRole}
                  onChange={e => {
                    const role = e.target.value as 'reception' | 'doctor' | 'management';
                    setNewUserRole(role);
                    if (role === 'doctor' && doctors.length > 0 && !selectedDoctorIdForUser) {
                      setSelectedDoctorIdForUser(doctors[0].id);
                    }
                  }}
                  className="select-profile-dropdown"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.875rem', borderRadius: '10px', boxSizing: 'border-box' }}
                >
                  <option value="reception">Receptionist (Clinical Front Desk)</option>
                  <option value="doctor">Consulting Doctor (Clinical Pad)</option>
                  <option value="management">Practice Manager (Admin Tools)</option>
                </select>
              </div>

              {newUserRole === 'doctor' && (
                <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                    LINK DOCTOR PROFILE *
                  </label>
                  <select
                    value={selectedDoctorIdForUser}
                    onChange={e => setSelectedDoctorIdForUser(e.target.value)}
                    className="select-profile-dropdown"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.85rem', borderRadius: '8px', boxSizing: 'border-box' }}
                    required
                  >
                    <option value="">-- Choose Registered Physician --</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.7rem', color: '#7c3aed', marginTop: '4px', display: 'block' }}>
                    When this user logs in, the workstation automatically defaults to this physician's consultations pad.
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  INITIAL PASSWORD (OPTIONAL)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to prompt at login"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  className="sync-input-line"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.875rem', borderRadius: '10px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={!newUserIdInput.trim() || (newUserRole === 'doctor' && !selectedDoctorIdForUser)}
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}
              >
                <UserPlus size={16} />
                <span>Create User Profile</span>
              </button>
            </form>
          </div>
        )}

        {/* Right Column: Registered Users Directory */}
        <div className="card" style={{ padding: '1.75rem', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          {/* Header Controls: Search and Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Registered User Directory</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Showing {filteredUsers.length} of {knownUsers.length} staff profiles
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="sync-input-line"
                  style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', fontSize: '0.825rem', borderRadius: '8px', margin: 0, boxSizing: 'border-box' }}
                />
              </div>

              {/* Role filter buttons */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
                {(['all', 'reception', 'doctor', 'management'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleFilter(role)}
                    style={{
                      border: 'none',
                      background: roleFilter === role ? 'white' : 'transparent',
                      color: roleFilter === role ? '#0284c7' : '#64748b',
                      fontWeight: roleFilter === role ? 700 : 500,
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: roleFilter === role ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      textTransform: 'capitalize'
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* User Cards Grid / List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <Users size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>No user profiles match your filter</p>
              </div>
            ) : (
              filteredUsers.map(user => {
                const isCurrent = user.id === currentUser;
                const linkedDoc = user.doctorId ? doctors.find(d => d.id === user.doctorId) : null;
                const isDefaultOrAdmin = user.id === 'admin' || user.id === 'default';

                const roleBadgeStyle = {
                  reception: { bg: '#e0f2fe', color: '#0369a1', label: 'Receptionist' },
                  doctor: { bg: '#dcfce7', color: '#15803d', label: 'Doctor' },
                  management: { bg: '#f3e8ff', color: '#7e22ce', label: 'Management' },
                  admin: { bg: '#ffe4e6', color: '#be123c', label: 'System Admin' },
                }[user.role as 'reception' | 'doctor' | 'management'] || { bg: '#f1f5f9', color: '#475569', label: user.role };

                return (
                  <div
                    key={user.id}
                    style={{
                      border: isCurrent ? '2px solid #38bdf8' : '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      background: isCurrent ? '#f0f9ff' : '#ffffff',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: roleBadgeStyle.bg,
                            color: roleBadgeStyle.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '1rem',
                            textTransform: 'uppercase'
                          }}
                        >
                          {user.id.charAt(0)}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                              {user.id}
                            </span>

                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                background: roleBadgeStyle.bg,
                                color: roleBadgeStyle.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}
                            >
                              {roleBadgeStyle.label}
                            </span>

                            {isCurrent && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '9999px' }}>
                                (Current Session)
                              </span>
                            )}
                          </div>

                          {linkedDoc && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Stethoscope size={13} style={{ color: '#059669' }} />
                              <span>Linked Physician: <strong>Dr. {linkedDoc.name}</strong> ({linkedDoc.specialization})</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons (Admin only) */}
                      {isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Screen Assignment Button */}
                          {user.id !== 'admin' && user.role !== 'doctor' && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserTabsId(user.id);
                                setTempUserTabs(user.allowedTabs || []);
                              }}
                              className="btn-secondary-sm"
                              style={{
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                borderRadius: '8px',
                                background: '#f8fafc',
                                border: '1px solid var(--border)'
                              }}
                              title="Configure Screen Access"
                            >
                              <SlidersHorizontal size={13} />
                              <span>Screens ({user.allowedTabs && user.allowedTabs.length > 0 ? user.allowedTabs.length : 'Default'})</span>
                            </button>
                          )}

                          {/* Set/Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordResetUserId(user.id);
                              setNewPasswordInput('');
                            }}
                            className="btn-secondary-sm"
                            style={{
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              borderRadius: '8px',
                              background: '#f8fafc',
                              border: '1px solid var(--border)'
                            }}
                            title="Set or reset password"
                          >
                            <Lock size={13} />
                            <span>Password</span>
                          </button>

                          {/* Delete Button */}
                          {!isDefaultOrAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id)}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Delete User ID"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Assigned Screens preview pills */}
                    {user.id !== 'admin' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px dashed #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginRight: '4px' }}>
                          Allowed Screens:
                        </span>
                        {user.allowedTabs && user.allowedTabs.length > 0 ? (
                          user.allowedTabs.map(tabId => {
                            const tabInfo = AVAILABLE_TABS.find(t => t.id === tabId);
                            return (
                              <span
                                key={tabId}
                                style={{
                                  fontSize: '0.7rem',
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontWeight: 600
                                }}
                              >
                                {tabInfo ? tabInfo.label : tabId}
                              </span>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                            Role Defaults ({user.role === 'reception' ? 'Clinical Desk Modules' : user.role === 'doctor' ? 'Clinical Pad' : 'Management Modules'})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Screen Permissions Modal */}
      {editingUserTabsId && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '600px', width: '100%', padding: '1.75rem', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Screen Permissions: <span style={{ color: '#0284c7' }}>{editingUserTabsId}</span>
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Select which modular workspace tabs this user is permitted to open.
                </p>
              </div>
              <button
                onClick={() => setEditingUserTabsId(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setTempUserTabs(AVAILABLE_TABS.map(t => t.id))}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                Select All
              </button>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setTempUserTabs([])}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                Clear All (Restore Defaults)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem', maxHeight: '350px', overflowY: 'auto', padding: '0.25rem' }}>
              {AVAILABLE_TABS.map(tab => {
                const checked = tempUserTabs.includes(tab.id);
                return (
                  <label
                    key={tab.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: checked ? '1px solid #0284c7' : '1px solid var(--border)',
                      background: checked ? '#f0f9ff' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setTempUserTabs(prev => [...prev, tab.id]);
                        else setTempUserTabs(prev => prev.filter(t => t !== tab.id));
                      }}
                      style={{ accentColor: '#0284c7', width: '16px', height: '16px', margin: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{tab.label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{tab.desk}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn-secondary-sm" onClick={() => setEditingUserTabsId(null)} style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => handleSaveUserTabs(editingUserTabsId)} style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 700 }}>
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordResetUserId && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '1.75rem', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.5rem', borderRadius: '8px' }}>
                  <Lock size={18} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Update Password: <span style={{ color: '#0284c7' }}>{passwordResetUserId}</span>
                </h3>
              </div>
              <button
                onClick={() => setPasswordResetUserId(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  NEW PASSWORD
                </label>
                <input
                  type="password"
                  placeholder="Enter new password (or leave blank to remove)"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  className="sync-input-line"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.875rem', borderRadius: '10px', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary-sm" onClick={() => setPasswordResetUserId(null)} style={{ padding: '0.55rem 1rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '0.55rem 1.25rem', fontWeight: 700 }}>
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
