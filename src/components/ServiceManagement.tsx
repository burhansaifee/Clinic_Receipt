import React, { useState } from 'react';
import { storage, type Service } from '../lib/storage';
import { Trash2, Edit2, PlusCircle, Activity, Bed, Stethoscope, Layers } from 'lucide-react';

interface ServiceManagementProps {
  services: Service[];
  onUpdate: () => void;
}

const CATEGORY_OPTIONS = [
  'General',
  'Consultation',
  'Room Rent',
  'Oxygen',
  'Nursing',
  'Doctor Rounds',
  'Equipment',
  'Procedures',
  'Consumables',
  'Other'
];

const UNIT_OPTIONS = [
  'Units',
  'Days',
  'Hours',
  'Cylinders',
  'Visits',
  'Procedures',
  'Sessions',
  'Tests'
];

const ServiceManagement: React.FC<ServiceManagementProps> = ({ services, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'OPD' | 'FACILITY'>('ALL');
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<string>('General');
  const [unit, setUnit] = useState<string>('Units');
  const [serviceType, setServiceType] = useState<'OPD' | 'FACILITY'>('OPD');

  const resetForm = () => {
    setName('');
    setAmount(0);
    setCategory('General');
    setUnit('Units');
    setServiceType('OPD');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const service: Service = {
      id: editingId || crypto.randomUUID(),
      name: name.trim(),
      amount: Number(amount) || 0,
      category,
      unit,
      serviceType
    };
    await storage.saveService(service);
    onUpdate();
    resetForm();
  };

  const handleEdit = (service: Service) => {
    setName(service.name);
    setAmount(service.amount);
    setCategory(service.category || 'General');
    setUnit(service.unit || 'Units');
    setServiceType(service.serviceType === 'FACILITY' ? 'FACILITY' : 'OPD');
    setEditingId(service.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      await storage.deleteService(id);
      onUpdate();
    }
  };

  const filteredServices = services.filter(s => {
    if (filterType === 'ALL') return true;
    if (filterType === 'FACILITY') return s.serviceType === 'FACILITY' || ['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment', 'Procedures'].includes(s.category || '');
    return s.serviceType !== 'FACILITY' && !['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment', 'Procedures'].includes(s.category || '');
  });

  const getCategoryBadgeStyle = (cat?: string) => {
    switch (cat) {
      case 'Room Rent': return { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' };
      case 'Oxygen': return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
      case 'Nursing': return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
      case 'Doctor Rounds': return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'Equipment': return { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
      case 'Procedures': return { bg: '#ffe4e6', color: '#be123c', border: '#fecdd3' };
      default: return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <div className="service-management no-print">
      <div className="section-header">
        <div className="header-title">
           <Activity size={24} className="text-primary" style={{ color: 'var(--primary)' }} />
           <div>
             <h2 style={{ margin: 0 }}>Clinic Services & Facility Items</h2>
             <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
               Manage billable OPD consultation fees and Inpatient facility services (Room rent, Oxygen, Nursing)
             </p>
           </div>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { resetForm(); setIsAdding(true); }}>
          <PlusCircle size={18} />
          Add New Service
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setFilterType('ALL')}
          style={{
            background: filterType === 'ALL' ? 'var(--primary)' : 'transparent',
            color: filterType === 'ALL' ? 'white' : 'var(--text-main)',
            border: 'none',
            padding: '0.45rem 1rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Layers size={15} /> All Items ({services.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('OPD')}
          style={{
            background: filterType === 'OPD' ? 'var(--primary)' : 'transparent',
            color: filterType === 'OPD' ? 'white' : 'var(--text-main)',
            border: 'none',
            padding: '0.45rem 1rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Stethoscope size={15} /> OPD & Consultation ({services.filter(s => s.serviceType !== 'FACILITY' && !['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment', 'Procedures'].includes(s.category || '')).length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('FACILITY')}
          style={{
            background: filterType === 'FACILITY' ? '#0284c7' : 'transparent',
            color: filterType === 'FACILITY' ? 'white' : 'var(--text-main)',
            border: 'none',
            padding: '0.45rem 1rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Bed size={15} /> Facility & Inpatient ({services.filter(s => s.serviceType === 'FACILITY' || ['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment', 'Procedures'].includes(s.category || '')).length})
        </button>
      </div>

      {isAdding && (
        <div className="card form-card" style={{ maxWidth: '650px', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem 0' }}>{editingId ? 'Edit Service / Item' : 'Add New Service / Facility Item'}</h3>
          <form onSubmit={handleSave} className="service-form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Service / Item Name *</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Deluxe Room Bed or General Consultation" 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Service Desk Scope</label>
                <select
                  value={serviceType}
                  onChange={e => {
                    const val = e.target.value as 'OPD' | 'FACILITY';
                    setServiceType(val);
                    if (val === 'FACILITY' && category === 'General') {
                      setCategory('Room Rent');
                      setUnit('Days');
                    }
                  }}
                >
                  <option value="OPD">OPD Consultation & Care</option>
                  <option value="FACILITY">Facility & Inpatient (Room/O2)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select 
                  value={category} 
                  onChange={e => {
                    const cat = e.target.value;
                    setCategory(cat);
                    if (cat === 'Room Rent' || cat === 'Nursing') setUnit('Days');
                    else if (cat === 'Oxygen') setUnit('Hours');
                    else if (cat === 'Doctor Rounds') setUnit('Visits');
                    else if (cat === 'Procedures') setUnit('Procedures');
                  }}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Default Rate / Amount (₹) *</label>
                <input 
                  type="number"
                  value={amount} 
                  onChange={e => setAmount(Number(e.target.value))} 
                  placeholder="0.00" 
                  required 
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Billing Unit</label>
                <select value={unit} onChange={e => setUnit(e.target.value)}>
                  {UNIT_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary">Save Item</button>
            </div>
          </form>
        </div>
      )}

      <div className="service-grid">
        {filteredServices.length === 0 ? (
          <div className="card empty-state">
            <p className="text-muted">No items found for this filter. Click "Add New Service" above to create one.</p>
          </div>
        ) : (
          filteredServices.map(service => {
            const badge = getCategoryBadgeStyle(service.category);
            const isFacility = service.serviceType === 'FACILITY' || ['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment', 'Procedures'].includes(service.category || '');
            return (
              <div key={service.id} className="card service-card">
                <div className="service-info" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      {service.category || 'General'}
                    </span>
                    <span style={{
                      background: isFacility ? '#e0f2fe' : '#f1f5f9',
                      color: isFacility ? '#0284c7' : '#475569',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }}>
                      {isFacility ? 'Facility' : 'OPD'}
                    </span>
                  </div>
                  <div className="service-main">
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>{service.name}</h3>
                    <span className="service-price" style={{ fontSize: '1.15rem' }}>
                      ₹{service.amount.toLocaleString()} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {service.unit || 'Units'}</span>
                    </span>
                  </div>
                </div>
                <div className="service-actions">
                  <button onClick={() => handleEdit(service)} className="btn-icon" title="Edit Service"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(service.id)} className="btn-icon text-danger" title="Delete Service"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .form-card {
          margin-bottom: 2rem;
        }

        .service-form {
          display: grid;
          gap: 1.25rem;
          margin-top: 1rem;
        }

        .form-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 0.35rem;
          color: var(--text-main);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .service-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .service-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.15rem 1.25rem;
          border-radius: 10px;
          transition: all 0.2s;
        }

        .service-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08);
        }

        .service-main {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 4px;
        }

        .service-price {
          font-weight: 700;
          color: var(--primary);
        }

        .service-actions {
          display: flex;
          gap: 0.35rem;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-muted);
          padding: 0.6rem 1.2rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-icon {
          background: transparent;
          color: var(--text-muted);
          padding: 0.45rem;
          border-radius: 6px;
          border: none;
          cursor: pointer;
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

export default ServiceManagement;
