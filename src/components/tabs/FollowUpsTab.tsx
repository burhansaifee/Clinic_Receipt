import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import {
  CalendarClock,
  Search,
  Plus,
  Trash2,
  Phone,
  MessageSquare,
  Receipt,
  X,
} from 'lucide-react';
import { storage, formatAgeGender, type Doctor, type FollowUp, type FollowUpStatus } from '../../lib/storage';
import { sendFollowUpViaWhatsApp, formatFollowUpWhatsAppMessage } from '../../lib/whatsappReceipt';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';

interface FollowUpsTabProps {
  doctors: Doctor[];
  followUps: FollowUp[];
  onRefresh: () => void;
  onConvertToReceipt: (followUp: FollowUp) => void;
}

export const FollowUpsTab: React.FC<FollowUpsTabProps> = ({
  doctors,
  followUps,
  onRefresh,
  onConvertToReceipt,
}) => {
  const toast = useToast();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('ALL');
  const [selectedTimeline, setSelectedTimeline] = useState<'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'ATTENDED'>('TODAY');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Manual Follow-Up Modal Form State
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState('Male');
  const [newDoctorId, setNewDoctorId] = useState(doctors[0]?.id || '');
  const [newScheduledDate, setNewScheduledDate] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [newNotes, setNewNotes] = useState('');

  // WhatsApp Preview Modal State
  const [previewFollowUp, setPreviewFollowUp] = useState<FollowUp | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Compute Metrics
  const metrics = React.useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let upcoming = 0;
    let attended = 0;

    for (const fu of followUps) {
      if (fu.status === 'ATTENDED') {
        attended++;
      } else if (fu.status === 'PENDING') {
        if (fu.scheduledDate === todayStr) {
          dueToday++;
        } else if (fu.scheduledDate < todayStr) {
          overdue++;
        } else {
          upcoming++;
        }
      }
    }
    return { dueToday, overdue, upcoming, attended, total: followUps.length };
  }, [followUps, todayStr]);

  // Filtered List
  const filteredFollowUps = React.useMemo(() => {
    return followUps.filter(fu => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = fu.patientName.toLowerCase().includes(q);
        const matchesPhone = (fu.patientPhone || '').includes(q);
        const matchesDoctor = fu.doctorName.toLowerCase().includes(q);
        const matchesNotes = (fu.notes || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesDoctor && !matchesNotes) {
          return false;
        }
      }

      // Doctor Filter
      if (selectedDoctorId !== 'ALL' && fu.doctorId !== selectedDoctorId) {
        return false;
      }

      // Timeline Filter
      if (selectedTimeline === 'TODAY') {
        return fu.scheduledDate === todayStr && fu.status === 'PENDING';
      }
      if (selectedTimeline === 'OVERDUE') {
        return fu.scheduledDate < todayStr && fu.status === 'PENDING';
      }
      if (selectedTimeline === 'UPCOMING') {
        return fu.scheduledDate > todayStr && fu.status === 'PENDING';
      }
      if (selectedTimeline === 'ATTENDED') {
        return fu.status === 'ATTENDED';
      }

      return true;
    });
  }, [followUps, searchQuery, selectedDoctorId, selectedTimeline, todayStr]);

  const handleStatusChange = async (id: string, newStatus: FollowUpStatus) => {
    try {
      await storage.updateFollowUpStatus(id, newStatus);
      toast(`Follow-up marked as ${newStatus}`, { type: 'success' });
      onRefresh();
    } catch (e: any) {
      toast(e?.message || 'Failed to update status', { type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm('Are you sure you want to delete this follow-up record?', { isDanger: true })) {
      try {
        await storage.deleteFollowUp(id);
        toast('Follow-up record removed', { type: 'success' });
        onRefresh();
      } catch (e: any) {
        toast('Failed to delete follow-up', { type: 'error' });
      }
    }
  };

  const handleSendWhatsApp = async (fu: FollowUp) => {
    if (!fu.patientPhone) {
      toast('Patient phone number is missing', { type: 'error' });
      return;
    }
    setIsSendingWhatsApp(true);
    try {
      const res = await sendFollowUpViaWhatsApp(fu);
      toast(res.message || 'WhatsApp message triggered!', { type: 'success' });
      setPreviewFollowUp(null);
    } catch (e: any) {
      toast(e.message || 'Failed to send WhatsApp message', { type: 'error' });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleCreateManualFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      toast('Please enter a patient name', { type: 'error' });
      return;
    }

    const docObj = doctors.find(d => d.id === newDoctorId) || doctors[0];
    const newFu: FollowUp = {
      id: `fu_${Date.now()}`,
      patientName: newPatientName.trim(),
      patientPhone: newPatientPhone.trim(),
      patientAge: newPatientAge.trim(),
      patientGender: newPatientGender,
      doctorId: docObj?.id || 'doc',
      doctorName: docObj?.name || 'Doctor',
      scheduledDate: newScheduledDate,
      notes: newNotes.trim() || 'Scheduled Follow-Up Revisit',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    try {
      await storage.saveFollowUp(newFu);
      toast(`Follow-up scheduled for ${newFu.patientName} on ${newFu.scheduledDate}`, { type: 'success' });
      setIsNewModalOpen(false);
      // Reset form
      setNewPatientName('');
      setNewPatientPhone('');
      setNewPatientAge('');
      setNewNotes('');
      setNewScheduledDate(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
      onRefresh();
    } catch (e: any) {
      toast(e?.message || 'Failed to schedule follow-up', { type: 'error' });
    }
  };

  const handleCheckInAndConvert = async (fu: FollowUp) => {
    if (fu.status !== 'ATTENDED') {
      await storage.updateFollowUpStatus(fu.id, 'ATTENDED');
      onRefresh();
    }
    onConvertToReceipt(fu);
  };

  const getRelativeDateTag = (dateStr: string, status: FollowUpStatus) => {
    if (status === 'ATTENDED') {
      return <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.75rem' }}>Attended</span>;
    }
    if (status === 'CANCELLED') {
      return <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>Cancelled</span>;
    }
    if (dateStr === todayStr) {
      return <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '0.75rem', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>DUE TODAY</span>;
    }
    if (dateStr < todayStr) {
      return <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.75rem', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>OVERDUE</span>;
    }
    return <span style={{ color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>Upcoming</span>;
  };

  return (
    <div className="followups-page tab-pane">
      {/* Top Header Card */}
      <div className="card control-card no-print" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: 'white', padding: '0.6rem', borderRadius: '10px', display: 'flex', alignItems: 'center', boxShadow: '0 4px 10px rgba(2,132,199,0.3)' }}>
              <CalendarClock size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Patient Follow-Up Tracker</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Track patient revisit appointments, send WhatsApp reminders, and process returning consultations
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              className="btn-primary"
              onClick={() => setIsNewModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}
            >
              <Plus size={16} /> Schedule Follow-Up
            </button>
          </div>
        </div>

        {/* Metric Counter Boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          <div
            onClick={() => setSelectedTimeline('TODAY')}
            style={{
              padding: '0.9rem 1.1rem',
              borderRadius: '10px',
              background: selectedTimeline === 'TODAY' ? '#e0f2fe' : '#f8fafc',
              border: selectedTimeline === 'TODAY' ? '2px solid #0284c7' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Due Today</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{metrics.dueToday}</span>
              {metrics.dueToday > 0 && <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700 }}>• Active now</span>}
            </div>
          </div>

          <div
            onClick={() => setSelectedTimeline('OVERDUE')}
            style={{
              padding: '0.9rem 1.1rem',
              borderRadius: '10px',
              background: selectedTimeline === 'OVERDUE' ? '#fee2e2' : '#f8fafc',
              border: selectedTimeline === 'OVERDUE' ? '2px solid #ef4444' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Overdue Revisit</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#991b1b' }}>{metrics.overdue}</span>
              {metrics.overdue > 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>• Needs reminder</span>}
            </div>
          </div>

          <div
            onClick={() => setSelectedTimeline('UPCOMING')}
            style={{
              padding: '0.9rem 1.1rem',
              borderRadius: '10px',
              background: selectedTimeline === 'UPCOMING' ? '#ede9fe' : '#f8fafc',
              border: selectedTimeline === 'UPCOMING' ? '2px solid #8b5cf6' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Upcoming Scheduled</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#5b21b6' }}>{metrics.upcoming}</span>
            </div>
          </div>

          <div
            onClick={() => setSelectedTimeline('ATTENDED')}
            style={{
              padding: '0.9rem 1.1rem',
              borderRadius: '10px',
              background: selectedTimeline === 'ATTENDED' ? '#dcfce7' : '#f8fafc',
              border: selectedTimeline === 'ATTENDED' ? '2px solid #10b981' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Attended / Completed</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065f46' }}>{metrics.attended}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card filter-card no-print" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
          {/* Timeline Chips */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `All (${metrics.total})` },
              { id: 'TODAY', label: `Due Today (${metrics.dueToday})` },
              { id: 'OVERDUE', label: `Overdue (${metrics.overdue})` },
              { id: 'UPCOMING', label: `Upcoming (${metrics.upcoming})` },
              { id: 'ATTENDED', label: `Attended (${metrics.attended})` },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTimeline(tab.id as any)}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '20px',
                  border: selectedTimeline === tab.id ? '1.5px solid #0284c7' : '1px solid var(--border)',
                  background: selectedTimeline === tab.id ? '#e0f2fe' : 'white',
                  color: selectedTimeline === tab.id ? '#0369a1' : 'var(--text-main)',
                  fontWeight: selectedTimeline === tab.id ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Doctor Filter */}
            <select
              value={selectedDoctorId}
              onChange={e => setSelectedDoctorId(e.target.value)}
              className="sync-input-line"
              style={{ width: '180px', padding: '0.45rem 0.6rem', fontSize: '0.825rem' }}
            >
              <option value="ALL">All Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>Dr. {d.name.replace(/^Dr\.?\s+/i, '')}</option>
              ))}
            </select>

            {/* Search Input */}
            <div className="search-bar" style={{ position: 'relative', width: '240px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                type="text"
                placeholder="Search patient, phone, notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="sync-input-line"
                style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.825rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Follow-Ups Table */}
      <div className="history-list no-print">
        {filteredFollowUps.length === 0 ? (
          <div className="card empty-state" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <CalendarClock size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.4 }} />
            <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-main)', fontWeight: 700 }}>No follow-up records found</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {selectedTimeline === 'TODAY'
                ? 'No patient follow-ups are due for revisit today.'
                : 'No follow-up visits matching the current filter criteria.'}
            </p>
          </div>
        ) : (
          <div
            className="history-table-wrapper"
            style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}
          >
            <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Scheduled Date', 'Patient Details', 'Age / Gender', 'Doctor', 'Status', 'Actions'].map(col => (
                    <th
                      key={col}
                      style={{
                        padding: '0.85rem 1rem',
                        background: '#f8fafc',
                        fontWeight: 700,
                        color: '#475569',
                        fontSize: '0.825rem',
                        borderBottom: '1px solid var(--border)',
                        textAlign: col === 'Actions' ? 'center' : 'left'
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFollowUps.map(fu => {
                  let formattedDate = fu.scheduledDate;
                  try {
                    formattedDate = format(new Date(fu.scheduledDate + 'T00:00:00'), 'dd MMM yyyy (EEE)');
                  } catch {
                    // ignore invalid dates
                  }

                  return (
                    <tr key={fu.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {/* Scheduled Date */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formattedDate}</div>
                        <div style={{ marginTop: '3px' }}>{getRelativeDateTag(fu.scheduledDate, fu.status)}</div>
                      </td>

                      {/* Patient Details */}
                      <td 
                        style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => alert(`Follow-Up Advice for ${fu.patientName}:\n\n${fu.notes || 'General consultation revisit'}`)}
                        title="Click to view follow-up advice"
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '0.9rem' }}>{fu.patientName}</strong>
                        {fu.patientPhone ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Phone size={12} /> {fu.patientPhone}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No phone</span>
                        )}
                        <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.7rem', color: '#0ea5e9', fontWeight: 600, background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px' }}>
                          View Advice
                        </span>
                      </td>

                      {/* Age / Gender */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', color: '#475569', whiteSpace: 'nowrap' }}>
                        {formatAgeGender(fu.patientAge, fu.patientGender)}
                      </td>

                      {/* Doctor */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        {fu.doctorName.replace(/^Dr\.?\s+/i, '')}
                      </td>

                      {/* Status Dropdown */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem' }}>
                        <select
                          value={fu.status}
                          onChange={e => handleStatusChange(fu.id, e.target.value as FollowUpStatus)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            border: '1px solid var(--border)',
                            background:
                              fu.status === 'ATTENDED' ? '#dcfce7' :
                              fu.status === 'MISSED' ? '#fee2e2' :
                              fu.status === 'CANCELLED' ? '#f1f5f9' : '#e0f2fe',
                            color:
                              fu.status === 'ATTENDED' ? '#166534' :
                              fu.status === 'MISSED' ? '#991b1b' :
                              fu.status === 'CANCELLED' ? '#475569' : '#0369a1',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="ATTENDED">Attended</option>
                          <option value="MISSED">Missed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                          {/* WhatsApp Reminder */}
                          {fu.patientPhone && (
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => setPreviewFollowUp(fu)}
                              title="Send WhatsApp Follow-Up Reminder"
                              style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              <MessageSquare size={14} />
                            </button>
                          )}

                          {/* Call Button */}
                          {fu.patientPhone && (
                            <a
                              href={`tel:${fu.patientPhone}`}
                              className="btn-icon"
                              title={`Call ${fu.patientPhone}`}
                              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid var(--border)', padding: '0.4rem', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                            >
                              <Phone size={14} />
                            </a>
                          )}

                          {/* Check-In / Create Receipt */}
                          <button
                            type="button"
                            className="btn-secondary-sm"
                            onClick={() => handleCheckInAndConvert(fu)}
                            title="Patient Arrived: Create Consultation Receipt"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: '#0284c7',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Receipt size={13} /> Check-In
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            className="btn-icon text-danger"
                            onClick={() => handleDelete(fu.id)}
                            title="Delete Record"
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '0.4rem', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Schedule Manual Follow-Up */}
      {isNewModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '480px', maxWidth: '90vw', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarClock size={20} style={{ color: '#0284c7' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Schedule Patient Follow-Up</h3>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateManualFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label className="label-caps" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PATIENT FULL NAME *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newPatientName}
                  onChange={e => setNewPatientName(e.target.value)}
                  className="sync-input-line"
                  required
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '0.6rem' }}>
                <div>
                  <label className="label-caps" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PHONE NO</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={newPatientPhone}
                    onChange={e => setNewPatientPhone(e.target.value)}
                    className="sync-input-line"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label className="label-caps" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>AGE</label>
                  <input
                    type="text"
                    placeholder="32"
                    value={newPatientAge}
                    onChange={e => setNewPatientAge(e.target.value)}
                    className="sync-input-line"
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label className="label-caps" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>GENDER</label>
                  <select
                    value={newPatientGender}
                    onChange={e => setNewPatientGender(e.target.value)}
                    className="sync-input-line"
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-caps" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CONSULTING DOCTOR</label>
                <select
                  value={newDoctorId}
                  onChange={e => setNewDoctorId(e.target.value)}
                  className="sync-input-line"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>Dr. {d.name.replace(/^Dr\.?\s+/i, '')} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-caps" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>REVISIT SCHEDULED DATE *</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '6px 0' }}>
                  {[
                    { label: '+3 Days', days: 3 },
                    { label: '+5 Days', days: 5 },
                    { label: '+1 Week', days: 7 },
                    { label: '+2 Weeks', days: 14 },
                  ].map(p => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setNewScheduledDate(format(addDays(new Date(), p.days), 'yyyy-MM-dd'))}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: '#f1f5f9',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={newScheduledDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setNewScheduledDate(e.target.value)}
                  className="sync-input-line"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="label-caps" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>FOLLOW-UP ADVICE / REASON</label>
                <textarea
                  placeholder="e.g. Review blood pressure, check healing, review lab reports..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="sync-input-line"
                  rows={2}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setIsNewModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.55rem 1.25rem', fontWeight: 700 }}>
                  Save Follow-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: WhatsApp Reminder Preview */}
      {previewFollowUp && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '460px', maxWidth: '90vw', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} style={{ color: '#16a34a' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>WhatsApp Reminder Preview</h3>
              </div>
              <button onClick={() => setPreviewFollowUp(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', fontSize: '0.825rem', color: '#334155', maxHeight: '250px', overflowY: 'auto' }}>
              {formatFollowUpWhatsAppMessage(previewFollowUp)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Sending to: <strong>+{previewFollowUp.patientPhone}</strong>
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setPreviewFollowUp(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleSendWhatsApp(previewFollowUp)}
                  disabled={isSendingWhatsApp}
                  style={{ background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                >
                  <MessageSquare size={16} /> Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
