import React, { useState } from 'react';
import { storage, type Doctor } from '../lib/storage';
import { Trash2, Edit2, UserPlus } from 'lucide-react';
import '../styles/components/DoctorManagement.css';

interface DoctorManagementProps {
  doctors: Doctor[];
  onUpdate: () => void;
}

const DoctorManagement: React.FC<DoctorManagementProps> = ({ doctors, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [phone, setPhone] = useState('');
  const [chamber, setChamber] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [address, setAddress] = useState('');
  const [printHeader, setPrintHeader] = useState(true);
  const [customTopMargin, setCustomTopMargin] = useState(0);
  const [customBottomMargin, setCustomBottomMargin] = useState(0);
  const [upiId, setUpiId] = useState('');
  const [qrCodeText, setQrCodeText] = useState('');
  const [showQrCodeOnReceipt, setShowQrCodeOnReceipt] = useState(false);

  const resetForm = () => {
    setName('');
    setSpecialization('');
    setPhone('');
    setChamber('');
    setQualifications('');
    setAddress('');
    setPrintHeader(true);
    setCustomTopMargin(0);
    setCustomBottomMargin(0);
    setUpiId('');
    setQrCodeText('');
    setShowQrCodeOnReceipt(false);
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
      address,
      printHeader,
      customTopMargin,
      customBottomMargin,
      upiId,
      qrCodeText,
      showQrCodeOnReceipt
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
    setQualifications(doctor.qualifications || '');
    setAddress(doctor.address || '');
    setPrintHeader(doctor.printHeader !== false);
    setCustomTopMargin(doctor.customTopMargin || 0);
    setCustomBottomMargin(doctor.customBottomMargin || 0);
    setUpiId(doctor.upiId || '');
    setQrCodeText(doctor.qrCodeText || '');
    setShowQrCodeOnReceipt(doctor.showQrCodeOnReceipt || false);
    setEditingId(doctor.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this doctor?')) {
      await storage.deleteDoctor(id);
      onUpdate();
    }
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
          <h3>{editingId ? 'Edit Doctor' : 'Add New Doctor'}</h3>
          <form onSubmit={handleSave} className="doctor-form">
            <div className="form-group">
              <label>Full Name</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Dr. John Doe" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Specialization</label>
              <input 
                value={specialization} 
                onChange={e => setSpecialization(e.target.value)} 
                placeholder="Cardiologist" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Qualifications</label>
              <input 
                value={qualifications} 
                onChange={e => setQualifications(e.target.value)} 
                placeholder="e.g. MBBS, MD (Medicine)" 
              />
            </div>
            <div className="form-group">
              <label>Phone / Contact</label>
              <input 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="+91 98765 43210" 
              />
            </div>

            <div className="form-group">
              <label>Assigned Chamber / Room (For OPD Queue & Tokens)</label>
              <input 
                value={chamber} 
                onChange={e => setChamber(e.target.value)} 
                placeholder="e.g. Chamber 1, Room 102, Cabin A, OPD-1" 
              />
            </div>

            <div className="form-group">
              <label>UPI VPA / PhonePe / GPay ID (For Payment QR)</label>
              <input 
                value={upiId} 
                onChange={e => setUpiId(e.target.value)} 
                placeholder="e.g. clinicdoctor@upi or 9876543210@paytm" 
              />
            </div>

            <div className="form-group">
              <label>Custom QR Text / Web Link (Optional)</label>
              <input 
                value={qrCodeText} 
                onChange={e => setQrCodeText(e.target.value)} 
                placeholder="e.g. https://myclinic.com or review link" 
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Specific Address (For Receipt Header)</label>
              <textarea 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Enter the specific clinic/chamber address for this doctor"
                rows={2}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1', margin: '0.25rem 0' }}>
              <input 
                type="checkbox"
                id="show-qr-default-checkbox"
                checked={showQrCodeOnReceipt}
                onChange={e => setShowQrCodeOnReceipt(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="show-qr-default-checkbox" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                Include QR Code on Printed Receipts by Default for this Doctor
              </label>
            </div>
            
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1', margin: '0.25rem 0' }}>
              <input 
                type="checkbox"
                id="print-header-checkbox"
                checked={printHeader}
                onChange={e => setPrintHeader(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="print-header-checkbox" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                Print Doctor Branding & Address Header on Prescription
              </label>
            </div>

            {!printHeader && (
              <>
                <div className="form-group" style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: 0 }}>
                    Pre-Printed Pad Top Margin (in millimeters)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="number"
                      value={customTopMargin}
                      onChange={e => setCustomTopMargin(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="e.g. 45"
                      style={{ width: '100px', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      min="0"
                    />
                    <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
                      Leave this much blank space at the top of the print page so Buvora text does not overlap your pad's pre-printed letterhead.
                    </span>
                  </div>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '-0.5rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: 0 }}>
                    Pre-Printed Pad Bottom Margin (in millimeters)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="number"
                      value={customBottomMargin}
                      onChange={e => setCustomBottomMargin(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="e.g. 20"
                      style={{ width: '100px', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      min="0"
                    />
                    <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
                      Leave this much blank space at the bottom to avoid printing over the pre-printed footer.
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary">Save Doctor</button>
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
                  {doctor.chamber && (
                    <span className="badge" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: 700 }}>
                      🚪 {doctor.chamber}
                    </span>
                  )}
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
