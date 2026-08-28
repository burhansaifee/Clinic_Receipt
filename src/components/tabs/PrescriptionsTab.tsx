import React, { useState } from 'react';
import { FileText, Search, Printer, MessageCircle } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { storage, formatAgeGender, type Prescription } from '../../lib/storage';
import { MedicinesDropdown } from '../ui/MedicinesDropdown';

interface PrescriptionsTabProps {
  prescriptions: Prescription[];
  onPrintRx: (rx: Prescription) => void;
}

const PrescriptionsTab: React.FC<PrescriptionsTabProps> = ({ prescriptions, onPrintRx }) => {
  const [rxSearchQuery, setRxSearchQuery] = useState('');
  const toast = useToast();

  const handleShareWhatsapp = async (p: Prescription) => {
    if (!p.patientPhone) {
      alert(`No phone number recorded for ${p.patientName}. Please edit the patient record first.`);
      return;
    }
    const confirmed = window.confirm(`Send prescription PDF to ${p.patientName} at ${p.patientPhone} via WhatsApp?`);
    if (!confirmed) return;
    
    try {
      toast('Generating and sending PDF...', { type: 'info' });
      
      const docs = await storage.getDoctors();
      const docObj = docs.find(d => d.id === p.doctorId);
      const enrichedPrescription = {
        ...p,
        doctorSpecialization: docObj?.specialization || '',
        doctorQualifications: docObj?.qualifications || ''
      };
      
      const res = await window.whatsappBot.sharePrescriptionPdf(enrichedPrescription.patientPhone, enrichedPrescription);
      if (res && res.success) {
        toast('Prescription sent via WhatsApp!', { type: 'success' });
      } else {
        toast((res && res.error) || 'Failed to send prescription', { type: 'error' });
      }
    } catch (e: any) {
      toast(e.message || 'Error sending PDF', { type: 'error' });
    }
  };

  const filtered = prescriptions.filter(p => {
    const query = rxSearchQuery.toLowerCase();
    return (
      !query ||
      p.patientName.toLowerCase().includes(query) ||
      p.patientPhone.includes(query) ||
      p.doctorName.toLowerCase().includes(query) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(query)) ||
      (p.medicines && p.medicines.some(m => m.name.toLowerCase().includes(query)))
    );
  });

  return (
    <div className="prescriptions-page tab-pane">
      {/* Header / Search */}
      <div className="card filter-card no-print">
        <div
          className="filter-header"
          style={{ marginBottom: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="filter-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              className="filter-icon-bg"
              style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
            >
              <FileText size={18} />
            </div>
            <div>
              <h3 style={{ margin: '0', fontSize: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>Prescription Explorer</h3>
              <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Quick access to print prescriptions created by doctors
              </p>
            </div>
          </div>
          <div className="search-bar" style={{ position: 'relative', width: '320px' }}>
            <Search
              size={18}
              className="search-icon"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search patient name, phone, doctor..."
              value={rxSearchQuery}
              onChange={e => setRxSearchQuery(e.target.value)}
              className="sync-input-line"
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="history-list no-print" style={{ marginTop: '1.5rem' }}>
        {filtered.length === 0 ? (
          <div className="card empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
            <p className="text-muted">No prescriptions written yet or matches found.</p>
          </div>
        ) : (
          <div
            className="history-table-wrapper"
            style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflowX: 'auto' }}
          >
            <table className="history-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Date', 'Patient Details', 'Age / Gender', 'Prescribed By', 'Diagnosis', 'Medicines', 'Action'].map((col, idx, arr) => (
                    <th
                      key={col}
                      style={{
                        padding: '1rem',
                        background: '#f8fafc',
                        fontWeight: 600,
                        color: '#475569',
                        fontSize: '0.875rem',
                        borderBottom: '1px solid var(--border)',
                        ...(idx === 0 ? { borderTopLeftRadius: '12px' } : {}),
                        ...(idx === arr.length - 1 ? { borderTopRightRadius: '12px' } : {}),
                        ...(col === 'Action' ? { width: '100px', textAlign: 'center' } : {}),
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{p.date}</td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{p.patientName}</strong>
                      <br />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.patientPhone || 'No Phone'}</span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      {formatAgeGender(p.patientAge, p.patientGender)}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{p.doctorName}</td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      <div>{p.diagnosis || 'N/A'}</div>
                      {p.followUpDate && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>
                            Follow-Up: {p.followUpDate}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      <MedicinesDropdown medicines={p.medicines || []} />
                    </td>
                    <td className="text-center" style={{ padding: '1rem' }}>
                      <div className="table-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                        <button
                          className="btn-icon"
                          onClick={() => onPrintRx(p)}
                          title="Print Prescription (Rx)"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="btn-icon text-success"
                          style={{ color: '#10b981' }}
                          onClick={() => handleShareWhatsapp(p)}
                          title="Share via WhatsApp (PDF)"
                        >
                          <MessageCircle size={16} />
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
    </div>
  );
};

export default PrescriptionsTab;
