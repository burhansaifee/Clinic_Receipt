import React, { useState } from 'react';
import { storage, type Service } from '../lib/storage';
import { Trash2, Edit2, PlusCircle, Activity } from 'lucide-react';

interface ServiceManagementProps {
  services: Service[];
  onUpdate: () => void;
}

const ServiceManagement: React.FC<ServiceManagementProps> = ({ services, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number>(0);

  const resetForm = () => {
    setName('');
    setAmount(0);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const service: Service = {
      id: editingId || Date.now().toString(),
      name,
      amount
    };
    await storage.saveService(service);
    onUpdate();
    resetForm();
  };

  const handleEdit = (service: Service) => {
    setName(service.name);
    setAmount(service.amount);
    setEditingId(service.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      await storage.deleteService(id);
      onUpdate();
    }
  };

  return (
    <div className="service-management no-print">
      <div className="section-header">
        <div className="header-title">
           <Activity size={24} className="text-primary" style={{ color: 'var(--primary)' }} />
           <h2>Clinic Services</h2>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setIsAdding(true)}>
          <PlusCircle size={18} />
          Add New Service
        </button>
      </div>

      {isAdding && (
        <div className="card form-card">
          <h3>{editingId ? 'Edit Service' : 'Add New Service'}</h3>
          <form onSubmit={handleSave} className="service-form">
            <div className="form-group">
              <label>Service Name</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Regular Consultation" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Default Amount (₹)</label>
              <input 
                type="number"
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))} 
                placeholder="0.00" 
                required 
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary">Save Service</button>
            </div>
          </form>
        </div>
      )}

      <div className="service-grid">
        {services.length === 0 ? (
          <div className="card empty-state">
            <p className="text-muted">No services predefined. Use the button above to add your clinic services for faster billing.</p>
          </div>
        ) : (
          services.map(service => (
            <div key={service.id} className="card service-card">
              <div className="service-info">
                <div className="service-main">
                  <h3>{service.name}</h3>
                  <span className="service-price">₹{service.amount.toLocaleString()}</span>
                </div>
              </div>
              <div className="service-actions">
                <button onClick={() => handleEdit(service)} className="btn-icon"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(service.id)} className="btn-icon text-danger"><Trash2 size={16} /></button>
              </div>
            </div>
          ))
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
          margin-bottom: 2rem;
        }

        .form-card {
          margin-bottom: 2rem;
          max-width: 500px;
        }

        .service-form {
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

        .service-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .service-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          transition: all 0.2s;
        }

        .service-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .service-main {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .service-main h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .service-price {
          font-weight: 700;
          color: var(--primary);
          font-size: 1.25rem;
        }

        .service-actions {
          display: flex;
          gap: 0.5rem;
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
          border-radius: 8px;
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
