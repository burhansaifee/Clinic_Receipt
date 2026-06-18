import React, { useState } from 'react';
import { storage, type Doctor } from '../lib/storage';
import { Trash2, Edit2, UserPlus } from 'lucide-react';

interface DoctorManagementProps {
  doctors: Doctor[];
  onUpdate: () => void;
  isDevMode?: boolean;
}

const DoctorManagement: React.FC<DoctorManagementProps> = ({ doctors, onUpdate, isDevMode = false }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [phone, setPhone] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [address, setAddress] = useState('');

  const resetForm = () => {
    setName('');
    setSpecialization('');
    setPhone('');
    setQualifications('');
    setAddress('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const doctor: Doctor = {
      id: editingId || Date.now().toString(),
      name,
      specialization,
      qualifications,
      phone,
      address
    };
    await storage.saveDoctor(doctor);
    onUpdate();
    resetForm();
  };

  const handleEdit = (doctor: Doctor) => {
    setName(doctor.name);
    setSpecialization(doctor.specialization);
    setPhone(doctor.phone);
    setQualifications(doctor.qualifications || '');
    setAddress(doctor.address || '');
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
        <h2>{isDevMode ? 'Manage Doctors (Dev)' : 'Our Doctors'}</h2>
        {isDevMode && (
          <button className="btn-primary flex items-center gap-2" onClick={() => setIsAdding(true)}>
            <UserPlus size={18} />
            Add New Doctor
          </button>
        )}
      </div>

      {isAdding && isDevMode && (
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
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Specific Address (For Receipt Header)</label>
              <textarea 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Enter the specific clinic/chamber address for this doctor"
                rows={2}
              />
            </div>
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
            <p className="text-muted">No doctors found. {isDevMode ? 'Use the button above to add one.' : 'Please contact the developer to add doctors.'}</p>
          </div>
        ) : (
          doctors.map(doctor => (
            <div key={doctor.id} className="card doctor-card">
              <div className="doctor-info">
                <h3>{doctor.name}</h3>
                <div className="doctor-badges">
                  <span className="badge">{doctor.specialization}</span>
                  {doctor.qualifications && <span className="badge secondary">{doctor.qualifications}</span>}
                </div>
                <p className="text-muted">{doctor.phone}</p>
                {doctor.address && <p className="text-muted small-address">{doctor.address}</p>}
              </div>
              {isDevMode && (
                <div className="doctor-actions">
                  <button onClick={() => handleEdit(doctor)} className="btn-icon"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(doctor.id)} className="btn-icon text-danger"><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .form-card {
          margin-bottom: 2rem;
          max-width: 600px;
        }

        .doctor-form {
          display: grid;
          gap: 1.25rem;
          margin-top: 1.5rem;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: var(--text-main);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 0.5rem;
        }

        .doctor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .doctor-card {
          display: flex;
          justify-content: space-between;
          padding: 1.5rem;
        }

        .doctor-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .badge {
          display: inline-block;
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .badge.secondary {
          background: #f1f5f9;
          color: #475569;
        }

        .small-address {
          font-size: 0.8rem;
          margin-top: 0.5rem;
          border-top: 1px solid var(--border);
          padding-top: 0.5rem;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-muted);
          padding: 0.75rem 1.5rem;
        }

        .btn-icon {
          background: transparent;
          color: var(--text-muted);
          padding: 0.5rem;
        }

        .btn-icon:hover {
          color: var(--primary);
          background: #f1f5f9;
        }

        .text-danger {
          color: #ef4444 !important;
        }

        .text-danger:hover {
          background: #fef2f2 !important;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem;
        }
      `}</style>
    </div>
  );
};

export default DoctorManagement;
