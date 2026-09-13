import React, { useState } from 'react';
import { storage, getDoctorReceiptPrefix, type Doctor } from '../lib/storage';
import { Trash2, Edit2, UserPlus, Clock, CalendarDays, Plus, X, Check } from 'lucide-react';
import '../styles/components/DoctorManagement.css';

interface DoctorManagementProps {
  doctors: Doctor[];
  onUpdate: () => void;
}

const ALL_WEEKDAYS = [
  { key: 'Mon', label: 'Mon' },
  { key: 'Tue', label: 'Tue' },
  { key: 'Wed', label: 'Wed' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Fri', label: 'Fri' },
  { key: 'Sat', label: 'Sat' },
  { key: 'Sun', label: 'Sun' },
];

const DEFAULT_SLOTS = [
  '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 01:00 PM',
  '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM',
  '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM'
];

const DoctorManagement: React.FC<DoctorManagementProps> = ({ doctors, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [phone, setPhone] = useState('');
  const [chamber, setChamber] = useState('');
  const [receiptPrefix, setReceiptPrefix] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [address, setAddress] = useState('');
  const [printHeader, setPrintHeader] = useState(true);
  const [customTopMargin, setCustomTopMargin] = useState(0);
  const [customBottomMargin, setCustomBottomMargin] = useState(0);
  const [upiId, setUpiId] = useState('');
  const [qrCodeText, setQrCodeText] = useState('');
  const [showQrCodeOnReceipt, setShowQrCodeOnReceipt] = useState(false);
  
  // Doctor Timing & Slot Management
  const [availableDays, setAvailableDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [consultationTimings, setConsultationTimings] = useState('');
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState('');

  const resetForm = () => {
    setName('');
    setSpecialization('');
    setPhone('');
    setChamber('');
    setReceiptPrefix('');
    setQualifications('');
    setAddress('');
    setPrintHeader(true);
    setCustomTopMargin(0);
    setCustomBottomMargin(0);
    setUpiId('');
    setQrCodeText('');
    setShowQrCodeOnReceipt(false);
    setAvailableDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    setConsultationTimings('');
    setTimeSlots([]);
    setNewSlotInput('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const doctor: Doctor = {
      id: editingId || crypto.randomUUID(),
      name,
      specialization,
      qualifications,
      phone,
      chamber: chamber.trim() || undefined,
      receiptPrefix: receiptPrefix.trim().toUpperCase() || undefined,
      address,
      printHeader,
      customTopMargin,
      customBottomMargin,
      upiId,
      qrCodeText,
      showQrCodeOnReceipt,
      availableDays: availableDays.length > 0 ? availableDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      consultationTimings: consultationTimings.trim() || undefined,
      timeSlots: timeSlots
    };
    await storage.saveDoctor(doctor);
    onUpdate();
    resetForm();
  };

  const handleEdit = (doctor: Doctor) => {
    setName(doctor.name);
    setSpecialization(doctor.specialization);
    setPhone(doctor.phone);
    setChamber(doctor.chamber || '');
    setReceiptPrefix(doctor.receiptPrefix || '');
    setQualifications(doctor.qualifications || '');
    setAddress(doctor.address || '');
    setPrintHeader(doctor.printHeader !== false);
    setCustomTopMargin(doctor.customTopMargin || 0);
    setCustomBottomMargin(doctor.customBottomMargin || 0);
    setUpiId(doctor.upiId || '');
    setQrCodeText(doctor.qrCodeText || '');
    setShowQrCodeOnReceipt(doctor.showQrCodeOnReceipt || false);
    setAvailableDays(doctor.availableDays && doctor.availableDays.length > 0 ? doctor.availableDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    setConsultationTimings(doctor.consultationTimings || '');
    setTimeSlots(doctor.timeSlots || []);
    setNewSlotInput('');
    setEditingId(doctor.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this doctor?')) {
      await storage.deleteDoctor(id);
      onUpdate();
    }
  };

  const handleToggleDay = (dayKey: string) => {
    setAvailableDays(prev => 
      prev.includes(dayKey) ? prev.filter(d => d !== dayKey) : [...prev, dayKey]
    );
  };

  const handleAddSlot = () => {
    const trimmed = newSlotInput.trim();
    if (!trimmed) return;
    if (timeSlots.includes(trimmed)) return;
    setTimeSlots([...timeSlots, trimmed]);
    setNewSlotInput('');
  };

  const handleRemoveSlot = (slot: string) => {
    setTimeSlots(timeSlots.filter(s => s !== slot));
  };

  return (
    <div className="doctor-management no-print">
      <div className="section-header">
        <h2>Manage Doctors</h2>
        <button className="btn-primary flex items-center gap-2" onClick={() => setIsAdding(true)}>
          <UserPlus size={18} />
          Add New Doctor
        </button>
      </div>

      {isAdding && (
        <div className="card form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'Outfit, sans-serif' }}>
              {editingId ? '✏️ Edit Doctor Profile & Schedule' : '➕ Add New Doctor'}
            </h3>
            <button type="button" className="btn-ghost" onClick={resetForm} style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="doctor-form">
            {/* ROW 1: CORE DEMOGRAPHICS (3 columns across full width) */}
            <div className="form-grid-3">
              <div className="form-group">
                <label>Full Name *</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Dr. John Doe" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Specialization *</label>
                <input 
                  value={specialization} 
                  onChange={e => setSpecialization(e.target.value)} 
                  placeholder="e.g. Consultant Cardiologist" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Qualifications</label>
                <input 
                  value={qualifications} 
                  onChange={e => setQualifications(e.target.value)} 
                  placeholder="e.g. MBBS, MD, DM (Medicine)" 
                />
              </div>
            </div>

            {/* ROW 2: CONTACT, CHAMBER & PREFIX (3 columns across full width) */}
            <div className="form-grid-3">
              <div className="form-group">
                <label>Phone / Contact</label>
                <input 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="+91 98765 43210" 
                />
              </div>
              <div className="form-group">
                <label>Assigned Chamber / Room (OPD & Tokens)</label>
                <input 
                  value={chamber} 
                  onChange={e => setChamber(e.target.value)} 
                  placeholder="e.g. Chamber 1, Room 102, Cabin A" 
                />
              </div>
              <div className="form-group">
                <label>Receipt / Rx Prefix</label>
                <input 
                  value={receiptPrefix} 
                  onChange={e => setReceiptPrefix(e.target.value.toUpperCase())} 
                  placeholder={name ? `Auto: ${getDoctorReceiptPrefix({ name, receiptPrefix: '' })}` : 'e.g. AK, BS, RS'} 
                />
              </div>
            </div>

            {/* ROW 3: TWO WIDE PANELS (Schedule & Slots on Left vs Payments & Branding on Right) */}
            <div className="form-grid-2">
              {/* PANEL 1: SCHEDULE & SLOTS */}
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} style={{ color: '#0284c7' }} />
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Consultation Days & WhatsApp Slots</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" onClick={() => setAvailableDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>Mon-Sat</button>
                    <button type="button" onClick={() => setAvailableDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>Mon-Fri</button>
                    <button type="button" onClick={() => setAvailableDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>All Days</button>
                  </div>
                </div>

                {/* Days Chips */}
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>WORKING DAYS</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {ALL_WEEKDAYS.map(day => {
                      const isSelected = availableDays.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => handleToggleDay(day.key)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                            background: isSelected ? '#0284c7' : 'white',
                            color: isSelected ? 'white' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isSelected && <Check size={12} />} {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Timings Summary */}
                <div className="form-group">
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>TIMINGS SUMMARY</label>
                  <input 
                    value={consultationTimings} 
                    onChange={e => setConsultationTimings(e.target.value)} 
                    placeholder="e.g. 10:00 AM - 01:00 PM & 05:00 PM - 08:00 PM" 
                  />
                </div>

                {/* Time Slots */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', margin: 0 }}>BOOKING TIME SLOTS ({timeSlots.length})</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => setTimeSlots(DEFAULT_SLOTS)} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}>+ Clinic Defaults</button>
                      {timeSlots.length > 0 && <button type="button" onClick={() => setTimeSlots([])} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>Clear</button>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input
                      type="text"
                      placeholder="e.g. 10:00 AM - 11:00 AM"
                      value={newSlotInput}
                      onChange={e => setNewSlotInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSlot(); } }}
                      style={{ flex: 1, padding: '0.38rem 0.6rem', fontSize: '0.82rem' }}
                    />
                    <button type="button" onClick={handleAddSlot} className="btn-secondary-sm" style={{ padding: '0.38rem 0.75rem', fontSize: '0.78rem' }}>
                      <Plus size={14} /> Add
                    </button>
                  </div>

                  {timeSlots.length > 0 ? (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxHeight: '90px', overflowY: 'auto' }}>
                      {timeSlots.map((slot, idx) => (
                        <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          🕒 {slot}
                          <button type="button" onClick={() => handleRemoveSlot(slot)} style={{ background: 'transparent', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic' }}>Default clinic slots will be used.</span>
                  )}
                </div>
              </div>

              {/* PANEL 2: PAYMENTS, ADDRESS & PRINT SETTINGS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group">
                    <label>UPI / GPay / PhonePe ID</label>
                    <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="e.g. doctor@upi" />
                  </div>
                  <div className="form-group">
                    <label>Custom QR Link / Review URL</label>
                    <input value={qrCodeText} onChange={e => setQrCodeText(e.target.value)} placeholder="e.g. https://clinic.com" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Chamber / Clinic Address (For Prescription & Receipt Header)</label>
                  <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Doctor specific address / branch" rows={2} />
                </div>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="show-qr-default-checkbox" checked={showQrCodeOnReceipt} onChange={e => setShowQrCodeOnReceipt(e.target.checked)} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                    <label htmlFor="show-qr-default-checkbox" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Include Payment QR Code on Receipts by Default</label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="print-header-checkbox" checked={printHeader} onChange={e => setPrintHeader(e.target.checked)} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                    <label htmlFor="print-header-checkbox" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Print Doctor Letterhead Header on Prescriptions</label>
                  </div>

                  {!printHeader && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>Top Margin (mm)</label>
                        <input type="number" value={customTopMargin} onChange={e => setCustomTopMargin(Math.max(0, parseInt(e.target.value) || 0))} min="0" style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>Bottom Margin (mm)</label>
                        <input type="number" value={customBottomMargin} onChange={e => setCustomBottomMargin(Math.max(0, parseInt(e.target.value) || 0))} min="0" style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FORM ACTIONS */}
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.75rem', fontWeight: 700 }}>
                {editingId ? 'Update Doctor' : 'Save Doctor'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="doctor-grid">
        {doctors.length === 0 ? (
          <div className="card empty-state">
            <p className="text-muted">No doctors found. Use the button above to add one.</p>
          </div>
        ) : (
          doctors.map(doctor => (
            <div key={doctor.id} className="card doctor-card">
              <div className="doctor-info">
                <h3>{doctor.name}</h3>
                <div className="doctor-badges">
                  <span className="badge">{doctor.specialization}</span>
                  <span className="badge" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', fontWeight: 700 }}>
                    Rx Prefix: {getDoctorReceiptPrefix(doctor)}
                  </span>
                  {doctor.chamber && (
                    <span className="badge" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: 700 }}>
                      🚪 {doctor.chamber}
                    </span>
                  )}
                  {doctor.consultationTimings ? (
                    <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600 }}>
                      🕒 {doctor.consultationTimings}
                    </span>
                  ) : doctor.timeSlots && doctor.timeSlots.length > 0 ? (
                    <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600 }}>
                      🕒 {doctor.timeSlots.length} Custom Slots ({doctor.availableDays?.join(', ') || 'Mon-Sat'})
                    </span>
                  ) : null}
                  {doctor.qualifications && <span className="badge secondary">{doctor.qualifications}</span>}
                  {doctor.upiId && <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>UPI: {doctor.upiId}</span>}
                  {doctor.showQrCodeOnReceipt && <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>QR Enabled</span>}
                  {doctor.printHeader === false && (
                    <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                      Pre-Printed Pad ({doctor.customTopMargin || 0}mm top, {doctor.customBottomMargin || 0}mm bottom)
                    </span>
                  )}
                </div>
                <p className="text-muted">{doctor.phone}</p>
                {doctor.address && <p className="text-muted small-address">{doctor.address}</p>}
              </div>
              <div className="doctor-actions">
                <button onClick={() => handleEdit(doctor)} className="btn-icon"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(doctor.id)} className="btn-icon text-danger"><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DoctorManagement;
