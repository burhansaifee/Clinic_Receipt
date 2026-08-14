import React, { useState, useEffect } from 'react';
import { storage, formatAgeGender, type Doctor, type Appointment, type AppointmentStatus } from '../lib/storage';
import { Calendar, Search, CheckCircle, XCircle, Clock, Plus, Trash2, MessageSquare, Phone, Tag, Save, Check, CalendarDays, RefreshCw } from 'lucide-react';

interface AppointmentManagementProps {
  doctors: Doctor[];
  onConvertToReceipt: (appointment: Appointment) => void;
  onRefreshData?: () => void;
}

const ALL_WEEKDAYS = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
  { key: 'Sat', label: 'Saturday' },
  { key: 'Sun', label: 'Sunday' },
];

export const AppointmentManagement: React.FC<AppointmentManagementProps> = ({ doctors, onConvertToReceipt }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState('');

  // Modal State - New Appointment
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('30');
  const [newPatientGender, setNewPatientGender] = useState('Male');
  const [newDoctorId, setNewDoctorId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00 AM');
  const [newNotes, setNewNotes] = useState('');

  // Modal State - WhatsApp Booking Schedule & Time Slots
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [allowedDays, setAllowedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [timeSlots, setTimeSlots] = useState<string[]>([
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '04:00 PM - 05:00 PM',
    '05:00 PM - 06:00 PM',
    '06:00 PM - 07:00 PM',
    '07:00 PM - 08:00 PM'
  ]);
  const [newSlotInput, setNewSlotInput] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const loadAppointments = async () => {
    try {
      const data = await storage.getAppointments();
      setAppointments(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
        return data;
      });
    } catch (err) {
      console.error('Failed to load appointments:', err);
    }
  };

  const loadSchedule = async () => {
    if ((window as any).whatsappBot?.getSchedule) {
      try {
        const res = await (window as any).whatsappBot.getSchedule();
        if (res) {
          if (res.allowedDays) setAllowedDays(res.allowedDays);
          if (res.timeSlots) setTimeSlots(res.timeSlots);
        }
      } catch (err) {
        console.error('Failed to load WhatsApp schedule:', err);
      }
    }
  };

  useEffect(() => {
    loadAppointments();
    loadSchedule();
  }, []);

  const handleToggleDay = (dayKey: string) => {
    setAllowedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const handleAddSlot = () => {
    const trimmed = newSlotInput.trim();
    if (!trimmed) return;
    if (timeSlots.includes(trimmed)) {
      alert('This time slot is already in the list.');
      return;
    }
    setTimeSlots([...timeSlots, trimmed]);
    setNewSlotInput('');
  };

  const handleRemoveSlot = (slotToRemove: string) => {
    setTimeSlots(timeSlots.filter((s) => s !== slotToRemove));
  };

  const handleResetDefaultSlots = () => {
    setTimeSlots([
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '12:00 PM - 01:00 PM',
      '04:00 PM - 05:00 PM',
      '05:00 PM - 06:00 PM',
      '06:00 PM - 07:00 PM',
      '07:00 PM - 08:00 PM'
    ]);
  };

  const handleSaveSchedule = async () => {
    if (allowedDays.length === 0) {
      alert('Please select at least one active operating day.');
      return;
    }
    if (timeSlots.length === 0) {
      alert('Please add at least one available time slot.');
      return;
    }
    setIsSavingSchedule(true);
    try {
      if ((window as any).whatsappBot?.saveSchedule) {
        await (window as any).whatsappBot.saveSchedule({ allowedDays, timeSlots });
        alert('✅ WhatsApp Booking Schedule & Time Slots saved successfully!\n\nThe WhatsApp bot will now strictly offer and validate these exact days and time slots to patients during chat.');
        setIsScheduleModalOpen(false);
      }
    } catch (err: any) {
      alert(`Failed to save schedule: ${err.message}`);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: AppointmentStatus, phone?: string, doctorName?: string, date?: string) => {
    console.log(`handleUpdateStatus: id=${id}, status=${status}, phone=${phone}, bot_exists=${!!(window as any).whatsappBot}`);
    await storage.updateAppointmentStatus(id, status);
    
    // Notify via WhatsApp if confirmed or cancelled
    if (phone && (window as any).whatsappBot) {
      console.log(`Sending WhatsApp message to ${phone}...`);
      try {
        if (status === 'CONFIRMED') {
          const msg = `✅ *Appointment Confirmed!*\n\nYour appointment with ${doctorName || 'your doctor'} on *${date || 'your requested slot'}* has been confirmed by MedFlow Clinic. We look forward to seeing you!`;
          await (window as any).whatsappBot.sendMessage(phone, msg);
          console.log('Confirmation message sent successfully via UI.');
        } else if (status === 'CANCELLED') {
          const msg = `❌ *Appointment Update*\n\nUnfortunately, your appointment request with ${doctorName || 'your doctor'} on *${date || 'your requested slot'}* could not be confirmed at this time. Please contact MedFlow Clinic reception to reschedule.`;
          await (window as any).whatsappBot.sendMessage(phone, msg);
          console.log('Cancellation message sent successfully via UI.');
        }
      } catch (err) {
        console.error('WhatsApp notification error:', err);
      }
    } else {
      console.log('Skipping WhatsApp message: phone missing or bot not available.');
    }
    loadAppointments();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this appointment record?')) {
      await storage.deleteAppointment(id);
      loadAppointments();
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName || !newDoctorId || !newDate || !newTime) {
      alert('Please fill in Patient Name, Doctor, Date, and Time.');
      return;
    }

    const doctor = doctors.find((d) => d.id === newDoctorId);
    const newApt: Appointment = {
      id: 'APT-' + Math.floor(100000 + Math.random() * 900000),
      patientName: newPatientName,
      patientPhone: newPatientPhone,
      patientAge: newPatientAge,
      patientGender: newPatientGender,
      doctorId: newDoctorId,
      doctorName: doctor ? doctor.name : 'Consulting Doctor',
      appointmentDate: newDate,
      appointmentTime: newTime,
      notes: newNotes,
      source: 'MANUAL',
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    await storage.saveAppointment(newApt);
    setIsModalOpen(false);
    setNewPatientName('');
    setNewPatientPhone('');
    setNewNotes('');
    loadAppointments();
  };

  const filteredAppointments = appointments.filter((apt) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      apt.patientName.toLowerCase().includes(query) ||
      apt.patientPhone.includes(query) ||
      apt.doctorName.toLowerCase().includes(query) ||
      apt.id.toLowerCase().includes(query);

    const matchesDoctor = !selectedDoctorId || apt.doctorId === selectedDoctorId;
    const matchesStatus = selectedStatus === 'ALL' || apt.status === selectedStatus;
    const matchesDate = !filterDate || apt.appointmentDate === filterDate;

    return matchesSearch && matchesDoctor && matchesStatus && matchesDate;
  }).sort((a, b) => {
    // Unapproved (PENDING) appointments come first at the top
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;

    // Secondary sorting by Date & Time ASC
    const dateA = `${a.appointmentDate} ${a.appointmentTime}`;
    const dateB = `${b.appointmentDate} ${b.appointmentTime}`;
    return dateA.localeCompare(dateB);
  });

  const pendingCount = appointments.filter((a) => a.status === 'PENDING').length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;

  return (
    <div className="appointments-page tab-pane">
      {/* Header Banner */}
      <div className="card filter-card no-print" style={{ marginBottom: '1.5rem' }}>
        <div className="filter-header" style={{ marginBottom: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="filter-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="filter-icon-bg" style={{ background: '#f0f9ff', color: '#0ea5e9', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <Calendar size={22} />
            </div>
            <div>
              <h3 style={{ margin: '0', fontSize: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>Appointment Management</h3>
              <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Review incoming WhatsApp bookings, approve requests, or schedule manual appointments</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn-secondary-sm"
              onClick={() => setIsScheduleModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.1rem',
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1px solid #bae6fd',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Clock size={16} /> WhatsApp Schedule & Slots
            </button>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}>
              <Plus size={16} /> New Appointment
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="summary-grid no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <div className="metric-icon secondary"><Calendar size={18} /></div>
          <div className="metric-info">
            <span className="label">TOTAL APPOINTMENTS</span>
            <span className="value">{appointments.length}</span>
          </div>
        </div>

        <div className="metric-card" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
          <div className="metric-icon" style={{ background: '#fef3c7', color: '#b45309' }}><Clock size={18} /></div>
          <div className="metric-info">
            <span className="label" style={{ color: '#b45309' }}>PENDING RECEPTION APPROVAL</span>
            <span className="value" style={{ color: '#b45309' }}>{pendingCount}</span>
          </div>
        </div>

        <div className="metric-card" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
          <div className="metric-icon" style={{ background: '#d1fae5', color: '#047857' }}><CheckCircle size={18} /></div>
          <div className="metric-info">
            <span className="label" style={{ color: '#047857' }}>CONFIRMED BOOKINGS</span>
            <span className="value" style={{ color: '#047857' }}>{confirmedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card filter-card no-print" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="filter-input-wrapper" style={{ flex: 2, minWidth: '220px' }}>
            <Search size={16} className="input-icon" />
            <input
              type="text"
              placeholder="Search patient, phone, doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div className="filter-input-wrapper" style={{ flex: 1, minWidth: '160px' }}>
            <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}>
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-input-wrapper" style={{ flex: 1, minWidth: '150px' }}>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="filter-input-wrapper" style={{ flex: 1, minWidth: '150px' }}>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>

          {(searchQuery || selectedDoctorId || selectedStatus !== 'ALL' || filterDate) && (
            <button className="btn-reset" onClick={() => { setSearchQuery(''); setSelectedDoctorId(''); setSelectedStatus('ALL'); setFilterDate(''); }}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Appointments List */}
      <div className="history-list no-print">
        {filteredAppointments.length === 0 ? (
          <div className="card empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
            <Calendar size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.4 }} />
            <p className="text-muted">No appointments found matching your current filter.</p>
          </div>
        ) : (
          <div className="history-table-wrapper" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.85rem 1rem' }}>Patient Details</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Doctor</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Requested Date & Time</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Source</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th className="text-right" style={{ padding: '0.85rem 1rem', width: '220px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((apt) => (
                  <tr key={apt.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{apt.patientName}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#0ea5e9', marginLeft: '6px', fontWeight: 600 }}>({apt.id})</span>
                      <br />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Phone size={12} /> {apt.patientPhone?.split('@')[0] || 'No Phone'} • {formatAgeGender(apt.patientAge, apt.patientGender)}
                      </span>
                    </td>

                    <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                       {apt.doctorName}
                    </td>

                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      <strong style={{ color: '#0f172a' }}>{apt.appointmentDate}</strong>
                      <br />
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{apt.appointmentTime}</span>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      {apt.source === 'WHATSAPP' ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MessageSquare size={13} /> WhatsApp
                        </span>
                      ) : (
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Tag size={13} /> Reception
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '1rem' }}>
                      {apt.status === 'PENDING' && (
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Pending Approval
                        </span>
                      )}
                      {apt.status === 'CONFIRMED' && (
                        <span style={{ background: '#ecfdf5', color: '#047857', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Confirmed
                        </span>
                      )}
                      {apt.status === 'CANCELLED' && (
                        <span style={{ background: '#fef2f2', color: '#dc2626', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={12} /> Cancelled
                        </span>
                      )}
                      {apt.status === 'COMPLETED' && (
                        <span style={{ background: '#f0f9ff', color: '#0284c7', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Completed
                        </span>
                      )}
                    </td>

                    <td className="text-right" style={{ padding: '1rem' }}>
                      <div className="action-buttons" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        {apt.status === 'PENDING' && (
                          <button
                            className="btn-primary-sm"
                            style={{ background: '#10b981', color: 'white', fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                            onClick={() => handleUpdateStatus(apt.id, 'CONFIRMED', apt.patientPhone, apt.doctorName, apt.appointmentTime)}
                            title="Approve & Confirm"
                          >
                            Approve
                          </button>
                        )}

                        <button
                          className="btn-secondary-sm"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', color: '#0284c7', borderColor: '#e0f2fe', background: '#f0f9ff' }}
                          onClick={() => onConvertToReceipt(apt)}
                          title="Generate Receipt from Appointment"
                        >
                          Create Receipt
                        </button>

                        <button
                          className="btn-icon-xs delete-btn"
                          onClick={() => handleDelete(apt.id)}
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Appointment Modal */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content card" style={{ width: '480px', maxWidth: '90%', padding: '1.75rem', borderRadius: '16px', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>New Appointment</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleCreateAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>PATIENT FULL NAME *</label>
                <input type="text" required placeholder="e.g. Rahul Sharma" value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>PHONE NO.</label>
                  <input type="text" placeholder="e.g. 9876543210" value={newPatientPhone} onChange={(e) => setNewPatientPhone(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>AGE</label>
                  <input type="text" value={newPatientAge} onChange={(e) => setNewPatientAge(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>GENDER</label>
                  <select value={newPatientGender} onChange={(e) => setNewPatientGender(e.target.value)}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>DOCTOR *</label>
                <select required value={newDoctorId} onChange={(e) => setNewDoctorId(e.target.value)}>
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>DATE *</label>
                  <input type="date" required value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>TIME / SLOT *</label>
                  <input type="text" required placeholder="e.g. 10:30 AM" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>NOTES / COMPLAINTS</label>
                <input type="text" placeholder="Optional notes..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary-sm" style={{ flex: 1, padding: '0.75rem' }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>
                  Save Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: WhatsApp Schedule & Time Slots */}
      {isScheduleModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '640px', width: '100%', borderRadius: '16px', border: '1px solid var(--border)', background: 'white', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'Outfit, sans-serif' }}>WhatsApp Booking Schedule & Time Slots</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configure clinic operating days and time slots enforced for WhatsApp patient bookings</p>
                </div>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                <XCircle size={22} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Days of Week Selection */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <CalendarDays size={16} style={{ color: '#0284c7' }} />
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
                    ALLOWED BOOKING DAYS OF THE WEEK
                  </label>
                </div>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Patients chatting on WhatsApp can only pick dates falling on these enabled clinic days.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {ALL_WEEKDAYS.map((day) => {
                    const isChecked = allowedDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => handleToggleDay(day.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '10px',
                          border: isChecked ? '1px solid #0284c7' : '1px solid var(--border)',
                          background: isChecked ? '#f0f9ff' : '#f8fafc',
                          color: isChecked ? '#0369a1' : 'var(--text-muted)',
                          fontWeight: isChecked ? 600 : 500,
                          fontSize: '0.825rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>{day.label}</span>
                        {isChecked ? <Check size={14} style={{ color: '#0284c7' }} /> : <span style={{ width: 14 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} style={{ color: '#0284c7' }} />
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
                      RECEPTIONIST-APPROVED TIME SLOTS ({timeSlots.length})
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetDefaultSlots}
                    style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <RefreshCw size={12} /> Reset Standard Slots
                  </button>
                </div>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  The WhatsApp bot will strictly restrict patients to picking from these available time slots.
                </p>

                {/* Add Slot Input */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="e.g. 02:30 PM - 03:30 PM"
                    value={newSlotInput}
                    onChange={(e) => setNewSlotInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSlot(); } }}
                    style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="btn-primary"
                    style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={15} /> Add Slot
                  </button>
                </div>

                {/* Time Slots Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: '#f8fafc',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        color: 'var(--text-main)'
                      }}
                    >
                      <span>⏰ {slot}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(slot)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                        title="Remove Slot"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: '#f8fafc' }}>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setIsScheduleModalOpen(false)}
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveSchedule}
                disabled={isSavingSchedule}
                style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Save size={16} /> {isSavingSchedule ? 'Saving...' : 'Save Schedule Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManagement;
