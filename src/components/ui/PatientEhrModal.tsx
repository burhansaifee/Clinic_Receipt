import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  X, 
  Activity, 
  Stethoscope, 
  Calendar, 
  Pill, 
  FlaskConical, 
  Printer, 
  MessageCircle, 
  Plus, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Receipt as ReceiptIcon,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { formatAgeGender, type Doctor, type Prescription, type Receipt, type PrescribedMedicine } from '../../lib/storage';

export interface PatientSummary {
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
}

export const isSamePatientRecord = (
  p1: { patientId?: string; patientName?: string; patientPhone?: string },
  p2: { patientId?: string; patientName?: string; patientPhone?: string }
): boolean => {
  const pid1 = (p1.patientId || '').trim().toLowerCase();
  const pid2 = (p2.patientId || '').trim().toLowerCase();
  if (pid1 && pid2 && pid1 === pid2) return true;

  const d1 = (p1.patientPhone || '').replace(/\D/g, '').slice(-10);
  const d2 = (p2.patientPhone || '').replace(/\D/g, '').slice(-10);
  if (d1 && d2 && d1.length >= 7 && d1 === d2) return true;

  const n1 = (p1.patientName || '').trim().toLowerCase();
  const n2 = (p2.patientName || '').trim().toLowerCase();
  if (n1 && n2 && n1.length > 2 && n1 === n2) return true;

  return false;
};

interface PatientEhrModalProps {
  patient: PatientSummary;
  prescriptions: Prescription[];
  receipts: Receipt[];
  doctors: Doctor[];
  currentUserDoctorId: string | null;
  onClose: () => void;
  onPrintRx: (rx: Prescription) => void;
  onShareWhatsapp: (rx: Prescription) => void;
  onPrescribeWithPastRx?: (rx: Prescription) => void;
  hasActiveTodayQueueTicket?: boolean;
}

export const PatientEhrModal: React.FC<PatientEhrModalProps> = ({
  patient,
  prescriptions,
  receipts,
  doctors,
  currentUserDoctorId,
  onClose,
  onPrintRx,
  onShareWhatsapp,
  onPrescribeWithPastRx,
  hasActiveTodayQueueTicket = false
}) => {
  const [showOtherReceipts, setShowOtherReceipts] = useState(false);

  // Match all prescriptions for this patient across all doctors
  const patientPrescriptions = prescriptions
    .filter(p => isSamePatientRecord(p, patient))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Match all receipts for this patient
  const patientReceipts = receipts
    .filter(r => isSamePatientRecord(r, patient))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Receipts that don't have an attached prescription
  const standaloneReceipts = patientReceipts.filter(r => 
    !patientPrescriptions.some(p => p.receiptId === r.id)
  );

  // Doctors consulted across clinic
  const doctorIdsConsulted = Array.from(new Set([
    ...patientPrescriptions.map(p => p.doctorId),
    ...patientReceipts.map(r => r.doctorId)
  ])).filter(Boolean);

  const doctorsConsulted = doctorIdsConsulted.map(id => {
    const doc = doctors.find(d => d.id === id);
    if (doc) return doc;
    const fromRx = patientPrescriptions.find(p => p.doctorId === id);
    return { id, name: fromRx?.doctorName || 'Doctor', specialization: 'Consultant' } as Doctor;
  });

  // Unique diagnoses across past visits
  const uniqueDiagnoses = Array.from(new Set(
    patientPrescriptions
      .map(p => (p.diagnosis || '').trim())
      .filter(d => d.length > 0)
  ));

  // Unique medicines prescribed
  const uniqueMeds = Array.from(new Set(
    patientPrescriptions
      .flatMap(p => (p.medicines || []).map(m => m.name.trim()))
      .filter(m => m.length > 0)
  ));

  return (
    <div className="ehr-modal-overlay" onClick={onClose}>
      <div className="ehr-modal-container" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="ehr-modal-header">
          <div className="ehr-patient-banner">
            <div className="ehr-icon-badge">
              <Activity size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                  {patient.patientName}
                </h2>
                {patient.patientId && (
                  <span className="ehr-uhid-badge">
                    UHID: {patient.patientId}
                  </span>
                )}
                <span className="ehr-crossdoc-pill">
                  <ShieldCheck size={13} /> Hospital EHR Dossier
                </span>
              </div>
              <div className="ehr-patient-submeta">
                <span>{formatAgeGender(patient.patientAge, patient.patientGender)}</span>
                {patient.patientPhone && <span>• 📞 {patient.patientPhone}</span>}
                <span>• 📋 {patientPrescriptions.length} Prescriptions across facility</span>
                <span>• 🏥 {patientReceipts.length} Total Visits</span>
              </div>
            </div>
          </div>
          <button type="button" className="btn-close-ehr" onClick={onClose} title="Close Dossier">
            <X size={20} />
          </button>
        </div>

        {/* Clinical Summary Bar */}
        <div className="ehr-summary-bar">
          {/* Doctors Consulted in this Facility */}
          <div className="ehr-summary-card">
            <span className="summary-label">
              <Stethoscope size={13} /> Doctors Consulted in Clinic ({doctorsConsulted.length})
            </span>
            <div className="ehr-tags-wrap">
              {doctorsConsulted.length === 0 ? (
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>None recorded</span>
              ) : (
                doctorsConsulted.map((doc, idx) => {
                  const isCurrent = currentUserDoctorId && doc.id === currentUserDoctorId;
                  return (
                    <span 
                      key={idx} 
                      className={`ehr-doc-tag ${isCurrent ? 'current-doc' : 'other-doc'}`}
                    >
                      <UserCheck size={12} />
                      <strong>{doc.name}</strong>
                      {doc.specialization && <span>({doc.specialization})</span>}
                      {isCurrent && <span className="tag-self-pill">You</span>}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Known / Previous Diagnoses */}
          {uniqueDiagnoses.length > 0 && (
            <div className="ehr-summary-card">
              <span className="summary-label">
                <Activity size={13} /> Clinical Diagnoses & Impressions ({uniqueDiagnoses.length})
              </span>
              <div className="ehr-tags-wrap">
                {uniqueDiagnoses.map((dx, idx) => (
                  <span key={idx} className="ehr-diagnosis-tag">
                    🩺 {dx}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Past Medications */}
          {uniqueMeds.length > 0 && (
            <div className="ehr-summary-card">
              <span className="summary-label">
                <Pill size={13} /> Past Prescribed Medications ({uniqueMeds.length})
              </span>
              <div className="ehr-tags-wrap">
                {uniqueMeds.slice(0, 10).map((med, idx) => (
                  <span key={idx} className="ehr-med-tag">
                    💊 {med}
                  </span>
                ))}
                {uniqueMeds.length > 10 && (
                  <span className="text-muted" style={{ fontSize: '0.72rem', alignSelf: 'center' }}>
                    +{uniqueMeds.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Body / Timeline */}
        <div className="ehr-modal-body">
          <div className="ehr-timeline-header">
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} className="text-primary" /> Chronological Consultation Timeline
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Showing records from all departments and doctors in this facility
            </span>
          </div>

          {patientPrescriptions.length === 0 ? (
            <div className="ehr-empty-state">
              <FileText size={40} style={{ opacity: 0.35 }} />
              <h4>No Prescriptions Recorded</h4>
              <p>This patient does not have prior digital prescriptions authored by any doctor in this facility.</p>
            </div>
          ) : (
            <div className="ehr-timeline-list">
              {patientPrescriptions.map(rx => {
                const doc = doctors.find(d => d.id === rx.doctorId || d.name.toLowerCase() === rx.doctorName.toLowerCase());
                const isOtherDoctor = currentUserDoctorId ? rx.doctorId !== currentUserDoctorId : false;

                const rawMeds = rx.medicines;
                const medsList: PrescribedMedicine[] = Array.isArray(rawMeds) ? rawMeds : typeof rawMeds === 'string' ? JSON.parse(rawMeds || '[]') : [];

                return (
                  <div key={rx.id} className={`ehr-visit-card ${isOtherDoctor ? 'card-crossdoc' : 'card-currentdoc'}`}>
                    {/* Visit Card Header */}
                    <div className="ehr-visit-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="ehr-visit-date">
                          {(() => {
                            try {
                              return format(new Date(rx.date.split(' ')[0]), 'dd MMMM yyyy');
                            } catch {
                              return rx.date;
                            }
                          })()}
                        </span>
                        {rx.receiptNumber && (
                          <span className="ehr-receipt-badge">
                            Rx #{rx.receiptNumber}
                          </span>
                        )}
                        <span className={`ehr-badge-doc-status ${isOtherDoctor ? 'badge-crossdoc' : 'badge-self'}`}>
                          {isOtherDoctor ? '🏥 Seen by Other Doctor' : '👤 Attended by You'}
                        </span>
                      </div>

                      {/* Doctor Info */}
                      <div className="ehr-visit-doctor-info">
                        <span className="doctor-name">Dr. {rx.doctorName.replace(/^Dr\.?\s+/i, '')}</span>
                        {doc?.specialization && (
                          <span className="doctor-spec">({doc.specialization})</span>
                        )}
                      </div>
                    </div>

                    {/* Diagnosis Highlight Banner */}
                    {rx.diagnosis && (
                      <div className="ehr-diagnosis-banner">
                        <Activity size={16} style={{ color: '#0369a1', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ color: '#0369a1', marginRight: '6px' }}>Diagnosis:</strong>
                          <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' }}>{rx.diagnosis}</span>
                        </div>
                      </div>
                    )}

                    {/* Chief Complaints / Symptoms */}
                    {rx.symptoms && (
                      <div className="ehr-clinical-row">
                        <strong className="ehr-field-label">Chief Complaints / Symptoms:</strong>
                        <p className="ehr-field-text">{rx.symptoms}</p>
                      </div>
                    )}

                    {/* Prescribed Medicines */}
                    {medsList.length > 0 && (
                      <div className="ehr-meds-container">
                        <strong className="ehr-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Pill size={13} /> Prescribed Medicines:
                        </strong>
                        <table className="ehr-meds-table">
                          <thead>
                            <tr>
                              <th>Medicine</th>
                              <th>Dosage</th>
                              <th>Duration</th>
                              <th>Instructions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {medsList.map((m, idx) => (
                              <tr key={idx}>
                                <td><strong style={{ color: '#1e293b' }}>{m.name}</strong></td>
                                <td><span className="badge-dose">{m.dosage || 'As directed'}</span></td>
                                <td>{m.duration || '-'}</td>
                                <td><span style={{ color: '#64748b' }}>{m.instructions || '-'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Diagnostic Lab Investigations */}
                    {rx.labInvestigations && rx.labInvestigations.length > 0 && (
                      <div className="ehr-clinical-row">
                        <strong className="ehr-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FlaskConical size={13} /> Diagnostic Investigations Ordered:
                        </strong>
                        <div className="ehr-labs-tags">
                          {rx.labInvestigations.map((test, idx) => (
                            <span key={idx} className="ehr-lab-tag">
                              🧪 {test}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Doctor's Advice & Clinical Notes */}
                    {rx.notes && (
                      <div className="ehr-clinical-row">
                        <strong className="ehr-field-label">Doctor's Advice / Notes:</strong>
                        <p className="ehr-field-text advice-text">{rx.notes}</p>
                      </div>
                    )}

                    {/* Follow-up recommendation */}
                    {(rx.followUpDate || rx.followUpNotes) && (
                      <div className="ehr-followup-box">
                        <Calendar size={13} style={{ color: '#0284c7' }} />
                        <span>
                          <strong>Follow-up Scheduled:</strong> {rx.followUpDate ? format(new Date(rx.followUpDate), 'dd MMM yyyy') : 'As advised'}
                          {rx.followUpNotes ? ` (${rx.followUpNotes})` : ''}
                        </span>
                      </div>
                    )}

                    {/* Visit Actions Footer */}
                    <div className="ehr-visit-actions">
                      <button
                        type="button"
                        className="btn-ehr-action"
                        onClick={() => onPrintRx(rx)}
                        title="Print this Prescription"
                      >
                        <Printer size={14} /> Print Rx
                      </button>
                      <button
                        type="button"
                        className="btn-ehr-action text-whatsapp"
                        onClick={() => onShareWhatsapp(rx)}
                        title="Send via WhatsApp"
                      >
                        <MessageCircle size={14} /> Send WhatsApp
                      </button>
                      {onPrescribeWithPastRx && hasActiveTodayQueueTicket && (
                        <button
                          type="button"
                          className="btn-ehr-action btn-prescribe-import"
                          onClick={() => onPrescribeWithPastRx(rx)}
                          title="Import past clinical data and write today's prescription"
                        >
                          <Plus size={14} /> Write Today's Rx With This
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standalone OPD Visits / Receipts Accordion */}
          {standaloneReceipts.length > 0 && (
            <div className="ehr-standalone-receipts">
              <button 
                type="button" 
                className="btn-toggle-standalone"
                onClick={() => setShowOtherReceipts(!showOtherReceipts)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ReceiptIcon size={16} />
                  <span>Other OPD Visits & Service Bills in Facility ({standaloneReceipts.length})</span>
                </div>
                {showOtherReceipts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showOtherReceipts && (
                <div className="standalone-receipts-list">
                  {standaloneReceipts.map(r => (
                    <div key={r.id} className="standalone-receipt-row">
                      <div className="receipt-meta">
                        <strong>{r.date.split(' ')[0]}</strong>
                        <span>• #{r.receiptNumber}</span>
                        <span className="doc-pill">Dr. {r.doctorName}</span>
                      </div>
                      <div className="receipt-items">
                        {r.items.map(i => i.description).join(', ')}
                      </div>
                      <div className="receipt-amount">
                        ₹{r.total.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="ehr-modal-footer">
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            🔒 Hospital Information System (HIS) Cross-Consultant Clinical Record
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
