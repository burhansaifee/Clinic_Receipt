import React, { useState, useEffect } from 'react';
import {
  storage,
  type BedAdmission,
  type DischargeSummaryData,
  type DischargeMedication,
  type AdmissionVital,
  type EmarOrder
} from '../../../lib/storage';
import {
  FileText,
  Printer,
  Save,
  X,
  Plus,
  Trash2,
  Edit3,
  Eye,
  CheckCircle,
  Stethoscope,
  Heart,
  Pill,
  Calendar,
  Sparkles
} from 'lucide-react';
import '../../../styles/tabs/DischargeSummary.css';

interface DischargeSummaryModalProps {
  admission: BedAdmission;
  onClose: () => void;
  onSaved?: () => void;
}

export const DischargeSummaryModal: React.FC<DischargeSummaryModalProps> = ({
  admission,
  onClose,
  onSaved
}) => {
  const [viewMode, setViewMode] = useState<'EDIT' | 'PREVIEW'>('EDIT');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(admission.diagnosis || '');
  const [icd10Code, setIcd10Code] = useState('');
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState('');
  const [admissionReason, setAdmissionReason] = useState(admission.diagnosis || '');
  const [presentingComplaints, setPresentingComplaints] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [examinationOnAdmission, setExaminationOnAdmission] = useState('');
  const [hospitalCourse, setHospitalCourse] = useState('');
  const [surgicalProcedures, setSurgicalProcedures] = useState('');
  const [dischargeCondition, setDischargeCondition] = useState<
    'STABLE' | 'IMPROVED' | 'RELIEVED' | 'LAMA' | 'TRANSFERRED' | 'DECEASED'
  >('STABLE');

  // Vitals
  const [dischargeBp, setDischargeBp] = useState('120/80');
  const [dischargePulse, setDischargePulse] = useState('72');
  const [dischargeTemp, setDischargeTemp] = useState('98.6');
  const [dischargeSpo2, setDischargeSpo2] = useState('98');
  const [dischargeRespRate, setDischargeRespRate] = useState('18');

  // Medications Table
  const [medications, setMedications] = useState<DischargeMedication[]>([]);

  // Follow-up & Advice
  const defaultFollowUp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUp);
  const [followUpInstructions, setFollowUpInstructions] = useState('Review in OPD after 7 days with recent lab reports. Continue prescribed oral medications.');
  const [emergencyRedFlags, setEmergencyRedFlags] = useState('High-grade fever (>101°F), severe shortness of breath, sudden severe chest pain, persistent vomiting, or altered consciousness. Report immediately to 24/7 Emergency.');
  const [dietaryInstructions, setDietaryInstructions] = useState('Soft, low salt, well-hydrated diet. Avoid heavy, oily or spicy foods.');
  const [consultantDoctorName, setConsultantDoctorName] = useState(admission.doctorName || 'Attending Physician');
  const [rmoName, setRmoName] = useState('Resident Medical Officer (RMO)');

  // Load existing summary if available
  useEffect(() => {
    loadExistingSummary();
  }, [admission.id]);

  const loadExistingSummary = async () => {
    try {
      const summary = await storage.getDischargeSummary(admission.id);
      if (summary) {
        setPrimaryDiagnosis(summary.primaryDiagnosis || admission.diagnosis || '');
        setIcd10Code(summary.icd10Code || '');
        setSecondaryDiagnosis(summary.secondaryDiagnosis || '');
        setAdmissionReason(summary.admissionReason || admission.diagnosis || '');
        setPresentingComplaints(summary.presentingComplaints || '');
        setClinicalHistory(summary.clinicalHistory || '');
        setExaminationOnAdmission(summary.examinationOnAdmission || '');
        setHospitalCourse(summary.hospitalCourse || '');
        setSurgicalProcedures(summary.surgicalProcedures || '');
        setDischargeCondition(summary.dischargeCondition || 'STABLE');
        if (summary.dischargeVitals) {
          setDischargeBp(summary.dischargeVitals.bp || '120/80');
          setDischargePulse(summary.dischargeVitals.pulse || '72');
          setDischargeTemp(summary.dischargeVitals.temp || '98.6');
          setDischargeSpo2(summary.dischargeVitals.spo2 || '98');
          setDischargeRespRate(summary.dischargeVitals.respRate || '18');
        }
        if (summary.dischargeMedications && summary.dischargeMedications.length > 0) {
          setMedications(summary.dischargeMedications);
        }
        setFollowUpDate(summary.followUpDate || defaultFollowUp);
        setFollowUpInstructions(summary.followUpInstructions || '');
        setEmergencyRedFlags(summary.emergencyRedFlags || '');
        setDietaryInstructions(summary.dietaryInstructions || '');
        setConsultantDoctorName(summary.consultantDoctorName || admission.doctorName || '');
        setRmoName(summary.rmoName || 'Resident Medical Officer (RMO)');
      } else {
        // Auto-seed latest vitals from vitalsLog if available
        autoPopulateFromAdmission();
      }
    } catch (e) {
      console.error('Error loading discharge summary:', e);
      autoPopulateFromAdmission();
    }
  };

  const autoPopulateFromAdmission = () => {
    // Vitals from vitalsLog
    try {
      if (admission.vitalsLog) {
        const vitals: AdmissionVital[] = JSON.parse(admission.vitalsLog);
        if (vitals && vitals.length > 0) {
          const latest = vitals[vitals.length - 1];
          if (latest.bpSystolic && latest.bpDiastolic) {
            setDischargeBp(`${latest.bpSystolic}/${latest.bpDiastolic}`);
          }
          if (latest.pulse) setDischargePulse(String(latest.pulse));
          if (latest.temp) setDischargeTemp(String(latest.temp));
          if (latest.spo2) setDischargeSpo2(String(latest.spo2));
          if (latest.respiratoryRate) setDischargeRespRate(String(latest.respiratoryRate));
        }
      }
    } catch (_) {}

    // Medications from eMAR orders
    try {
      if (admission.emarOrdersLog) {
        const emarOrders: EmarOrder[] = JSON.parse(admission.emarOrdersLog);
        const activeOrders = emarOrders.filter(o => o.status === 'ACTIVE');
        if (activeOrders.length > 0) {
          const initialMeds: DischargeMedication[] = activeOrders.map((o, idx) => ({
            id: `DMED-${Date.now()}-${idx}`,
            name: o.drugName,
            dosage: o.dosage,
            route: o.route,
            frequency: o.frequency,
            duration: '5 Days',
            instructions: o.specialInstructions || 'Take with water after meals'
          }));
          setMedications(initialMeds);
        }
      }
    } catch (_) {}
  };

  const handleAddMedication = () => {
    setMedications([
      ...medications,
      {
        id: `DMED-${Date.now()}`,
        name: '',
        dosage: '1 Tab',
        route: 'Oral',
        frequency: '1-0-1 (BD)',
        duration: '5 Days',
        instructions: 'After food'
      }
    ]);
  };

  const handleUpdateMedication = (index: number, field: keyof DischargeMedication, val: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: val };
    setMedications(updated);
  };

  const handleDeleteMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const summaryData: DischargeSummaryData = {
        admissionId: admission.id,
        primaryDiagnosis,
        icd10Code,
        secondaryDiagnosis,
        admissionReason,
        presentingComplaints,
        clinicalHistory,
        examinationOnAdmission,
        hospitalCourse,
        surgicalProcedures,
        dischargeCondition,
        dischargeVitals: {
          bp: dischargeBp,
          pulse: dischargePulse,
          temp: dischargeTemp,
          spo2: dischargeSpo2,
          respRate: dischargeRespRate
        },
        dischargeMedications: medications,
        followUpDate,
        followUpInstructions,
        emergencyRedFlags,
        dietaryInstructions,
        consultantDoctorName,
        rmoName,
        generatedAt: new Date().toISOString()
      };

      await storage.saveDischargeSummary(admission.id, summaryData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      if (onSaved) onSaved();
    } catch (e) {
      console.error('Failed to save discharge summary:', e);
      alert('Failed to save discharge summary. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    document.body.classList.add('printing-discharge-summary');
    return () => {
      document.body.classList.remove('printing-discharge-summary');
    };
  }, []);

  const handlePrint = () => {
    // Switch to preview mode then print
    setViewMode('PREVIEW');
    setTimeout(() => {
      window.print();
    }, 350);
  };

  return (
    <div className="discharge-modal-overlay">
      <div className="discharge-modal-container">
        {/* Header */}
        <div className="discharge-modal-header">
          <div className="discharge-modal-header-left">
            <div className="discharge-modal-header-icon">
              <FileText />
            </div>
            <div>
              <h2 className="discharge-modal-title">Clinical Discharge Summary Engine</h2>
              <div className="discharge-modal-subtitle">
                Patient: <strong>{admission.patientName}</strong> ({admission.patientAge || 'Adult'} / {admission.patientGender || 'N/A'}) &bull; IPD: {admission.admissionNumber} &bull; Bed: {admission.bedNumber} ({admission.wardName})
              </div>
            </div>
          </div>

          <div className="discharge-header-actions">
            <div className="discharge-view-mode-toggle">
              <button
                type="button"
                className={`discharge-mode-btn ${viewMode === 'EDIT' ? 'active' : ''}`}
                onClick={() => setViewMode('EDIT')}
              >
                <Edit3 size={15} /> Edit Form
              </button>
              <button
                type="button"
                className={`discharge-mode-btn ${viewMode === 'PREVIEW' ? 'active' : ''}`}
                onClick={() => setViewMode('PREVIEW')}
              >
                <Eye size={15} /> A4 Print Preview
              </button>
            </div>

            <button
              type="button"
              className="discharge-btn discharge-btn-print"
              onClick={handlePrint}
              title="Print standard A4 summary"
            >
              <Printer size={16} /> Print A4
            </button>

            <button
              type="button"
              className="discharge-btn discharge-btn-secondary"
              onClick={onClose}
              style={{ padding: '0.5rem' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="discharge-modal-body">
          {viewMode === 'EDIT' ? (
            <div className="discharge-form-grid">
              {/* Diagnosis & Admission Info */}
              <div className="discharge-section-card">
                <div className="discharge-section-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Stethoscope size={16} /> 1. Diagnosis & Clinical History
                  </span>
                </div>

                <div className="discharge-grid-3" style={{ marginBottom: '1rem' }}>
                  <div className="discharge-input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Primary Final Diagnosis *</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="e.g. Acute Appendicitis with localized peritonitis"
                      value={primaryDiagnosis}
                      onChange={e => setPrimaryDiagnosis(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>ICD-10 Code</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="e.g. K35.80"
                      value={icd10Code}
                      onChange={e => setIcd10Code(e.target.value)}
                    />
                  </div>
                </div>

                <div className="discharge-grid-2" style={{ marginBottom: '1rem' }}>
                  <div className="discharge-input-group">
                    <label>Secondary / Comorbid Diagnosis</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="e.g. Type 2 Diabetes Mellitus, Essential Hypertension"
                      value={secondaryDiagnosis}
                      onChange={e => setSecondaryDiagnosis(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>Reason for Admission</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="e.g. Severe right iliac fossa abdominal pain with fever"
                      value={admissionReason}
                      onChange={e => setAdmissionReason(e.target.value)}
                    />
                  </div>
                </div>

                <div className="discharge-grid-2">
                  <div className="discharge-input-group">
                    <label>History of Present Illness (HPI)</label>
                    <textarea
                      className="discharge-textarea"
                      placeholder="Detailed clinical history on admission..."
                      value={clinicalHistory}
                      onChange={e => setClinicalHistory(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>Physical Examination on Admission</label>
                    <textarea
                      className="discharge-textarea"
                      placeholder="Key physical signs, abdominal tenderness, systemic findings..."
                      value={examinationOnAdmission}
                      onChange={e => setExaminationOnAdmission(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Hospital Course & Procedures */}
              <div className="discharge-section-card">
                <div className="discharge-section-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} /> 2. Hospital Course & Procedures Performed
                  </span>
                </div>

                <div className="discharge-grid-2">
                  <div className="discharge-input-group">
                    <label>Hospital Course & Clinical Progress Summary</label>
                    <textarea
                      className="discharge-textarea"
                      style={{ minHeight: '100px' }}
                      placeholder="Patient was admitted in ward, started on IV antibiotics and fluids. Underwent laparoscopic procedure on Day 2 with uneventful postoperative recovery..."
                      value={hospitalCourse}
                      onChange={e => setHospitalCourse(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>Surgical / Diagnostic Procedures Performed</label>
                    <textarea
                      className="discharge-textarea"
                      style={{ minHeight: '100px' }}
                      placeholder="e.g. Laparoscopic Appendectomy under General Anesthesia on 08/09/2026. Biopsy sent for histopathology."
                      value={surgicalProcedures}
                      onChange={e => setSurgicalProcedures(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Discharge Condition & Vitals */}
              <div className="discharge-section-card">
                <div className="discharge-section-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Heart size={16} /> 3. Condition at Discharge & Vitals
                  </span>
                </div>

                <div className="discharge-grid-2" style={{ marginBottom: '1rem' }}>
                  <div className="discharge-input-group">
                    <label>Discharge Condition Status *</label>
                    <select
                      className="discharge-select"
                      value={dischargeCondition}
                      onChange={e => setDischargeCondition(e.target.value as any)}
                    >
                      <option value="STABLE">STABLE - Satisfactory Clinical Recovery</option>
                      <option value="IMPROVED">IMPROVED - Symptoms Resolved</option>
                      <option value="RELIEVED">RELIEVED - Discharged on Request</option>
                      <option value="LAMA">LAMA - Left Against Medical Advice</option>
                      <option value="TRANSFERRED">TRANSFERRED - Higher Center Referral</option>
                      <option value="DECEASED">DECEASED</option>
                    </select>
                  </div>
                  <div className="discharge-input-group">
                    <label>Consultant In-Charge</label>
                    <input
                      type="text"
                      className="discharge-input"
                      value={consultantDoctorName}
                      onChange={e => setConsultantDoctorName(e.target.value)}
                    />
                  </div>
                </div>

                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Discharge Recorded Vitals:
                </label>
                <div className="discharge-grid-5" style={{ marginTop: '0.35rem' }}>
                  <div className="discharge-input-group">
                    <label>Blood Pressure (BP)</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="120/80 mmHg"
                      value={dischargeBp}
                      onChange={e => setDischargeBp(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>Heart Rate (Pulse)</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="72 bpm"
                      value={dischargePulse}
                      onChange={e => setDischargePulse(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>Temperature</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="98.6 °F"
                      value={dischargeTemp}
                      onChange={e => setDischargeTemp(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>SpO2 (%)</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="98%"
                      value={dischargeSpo2}
                      onChange={e => setDischargeSpo2(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>Resp. Rate (/min)</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="18 /min"
                      value={dischargeRespRate}
                      onChange={e => setDischargeRespRate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Discharge Medications */}
              <div className="discharge-section-card">
                <div className="discharge-section-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Pill size={16} /> 4. Discharge Medications (Rx to Continue at Home)
                  </span>
                  <button
                    type="button"
                    className="discharge-add-med-btn"
                    onClick={handleAddMedication}
                  >
                    <Plus size={14} /> Add Medicine
                  </button>
                </div>

                {medications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    No discharge medications added yet. Click &ldquo;Add Medicine&rdquo; to add prescribed drugs.
                  </div>
                ) : (
                  <div className="discharge-meds-table-wrapper">
                    <table className="discharge-meds-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Medicine Name</th>
                          <th style={{ width: '12%' }}>Dosage</th>
                          <th style={{ width: '12%' }}>Route</th>
                          <th style={{ width: '16%' }}>Frequency</th>
                          <th style={{ width: '12%' }}>Duration</th>
                          <th style={{ width: '15%' }}>Special Instructions</th>
                          <th style={{ width: '5%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {medications.map((med, idx) => (
                          <tr key={med.id || idx}>
                            <td>
                              <input
                                type="text"
                                className="discharge-med-input"
                                placeholder="e.g. Tab Cefuroxime 500mg"
                                value={med.name}
                                onChange={e => handleUpdateMedication(idx, 'name', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="discharge-med-input"
                                placeholder="1 Tab"
                                value={med.dosage}
                                onChange={e => handleUpdateMedication(idx, 'dosage', e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="discharge-med-input"
                                value={med.route}
                                onChange={e => handleUpdateMedication(idx, 'route', e.target.value)}
                              >
                                <option value="Oral">Oral</option>
                                <option value="Sublingual">Sublingual</option>
                                <option value="Topical">Topical</option>
                                <option value="Inhalation">Inhalation</option>
                                <option value="SC">SC (Subcut)</option>
                                <option value="IV">IV</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="discharge-med-input"
                                placeholder="1-0-1 (BD)"
                                value={med.frequency}
                                onChange={e => handleUpdateMedication(idx, 'frequency', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="discharge-med-input"
                                placeholder="5 Days"
                                value={med.duration}
                                onChange={e => handleUpdateMedication(idx, 'duration', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="discharge-med-input"
                                placeholder="After meals"
                                value={med.instructions || ''}
                                onChange={e => handleUpdateMedication(idx, 'instructions', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="discharge-med-delete-btn"
                                onClick={() => handleDeleteMedication(idx)}
                                title="Remove item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Follow-up, Diet & Emergency Red Flags */}
              <div className="discharge-section-card">
                <div className="discharge-section-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={16} /> 5. Follow-up Advice & Emergency Warnings
                  </span>
                </div>

                <div className="discharge-grid-2" style={{ marginBottom: '1rem' }}>
                  <div className="discharge-input-group">
                    <label>Follow-up Review Date</label>
                    <input
                      type="date"
                      className="discharge-input"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label>Dietary & Lifestyle Advice</label>
                    <input
                      type="text"
                      className="discharge-input"
                      placeholder="Diet instructions..."
                      value={dietaryInstructions}
                      onChange={e => setDietaryInstructions(e.target.value)}
                    />
                  </div>
                </div>

                <div className="discharge-grid-2">
                  <div className="discharge-input-group">
                    <label>Follow-up Instructions</label>
                    <textarea
                      className="discharge-textarea"
                      placeholder="Follow-up instructions..."
                      value={followUpInstructions}
                      onChange={e => setFollowUpInstructions(e.target.value)}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <label style={{ color: '#ef4444' }}>Emergency Red Flags (When to return immediately)</label>
                    <textarea
                      className="discharge-textarea"
                      style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      placeholder="Warning red flags..."
                      value={emergencyRedFlags}
                      onChange={e => setEmergencyRedFlags(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* A4 Print Preview */
            <div className="discharge-a4-preview-wrapper">
              <div className="discharge-a4-paper">
                {/* Header */}
                <div className="a4-hospital-header">
                  <div className="a4-hospital-name">CITY HOSPITAL & MEDICAL RESEARCH CENTER</div>
                  <div className="a4-hospital-subtitle">
                    24/7 Multi-Specialty Care &bull; ISO 9001:2015 & NABH Certified &bull; Emergency Tel: 011-2345-6789
                  </div>
                  <div className="a4-doc-title-badge">CLINICAL DISCHARGE SUMMARY</div>
                </div>

                {/* Patient Meta Box */}
                <div className="a4-patient-meta-box">
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">Patient Name:</span>
                    <span className="a4-meta-value">{admission.patientName}</span>
                  </div>
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">IPD Admission No:</span>
                    <span className="a4-meta-value">{admission.admissionNumber}</span>
                  </div>
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">Age / Gender:</span>
                    <span className="a4-meta-value">{admission.patientAge || 'Adult'} / {admission.patientGender || 'N/A'}</span>
                  </div>
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">Ward / Bed:</span>
                    <span className="a4-meta-value">{admission.wardName} - {admission.bedNumber}</span>
                  </div>
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">Date of Admission:</span>
                    <span className="a4-meta-value">{new Date(admission.admittedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">Date of Discharge:</span>
                    <span className="a4-meta-value">{admission.dischargedAt ? new Date(admission.dischargedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">Consultant In-Charge:</span>
                    <span className="a4-meta-value">{consultantDoctorName}</span>
                  </div>
                  <div className="a4-meta-row">
                    <span className="a4-meta-label">Discharge Condition:</span>
                    <span className="a4-meta-value">{dischargeCondition}</span>
                  </div>
                </div>

                {/* Section: Diagnosis */}
                <div className="a4-section">
                  <div className="a4-section-header">
                    <span>Final Diagnosis</span>
                    {icd10Code && <span style={{ fontSize: '8.5pt', color: '#64748b' }}>ICD-10: {icd10Code}</span>}
                  </div>
                  <div className="a4-section-body" style={{ fontWeight: 700 }}>
                    {primaryDiagnosis || 'Clinical diagnosis pending final entry'}
                  </div>
                  {secondaryDiagnosis && (
                    <div className="a4-section-body" style={{ marginTop: '2px', color: '#475569' }}>
                      Comorbidities: {secondaryDiagnosis}
                    </div>
                  )}
                </div>

                {/* Section: Reason for Admission & History */}
                {(admissionReason || clinicalHistory) && (
                  <div className="a4-section">
                    <div className="a4-section-header">Reason for Admission & Clinical History</div>
                    {admissionReason && <div className="a4-section-body" style={{ marginBottom: '4px' }}><strong>Chief Complaints:</strong> {admissionReason}</div>}
                    {clinicalHistory && <div className="a4-section-body">{clinicalHistory}</div>}
                  </div>
                )}

                {/* Section: Hospital Course & Procedures */}
                {(hospitalCourse || surgicalProcedures) && (
                  <div className="a4-section">
                    <div className="a4-section-header">Hospital Course & Procedures Performed</div>
                    {surgicalProcedures && <div className="a4-section-body" style={{ marginBottom: '4px' }}><strong>Procedures:</strong> {surgicalProcedures}</div>}
                    {hospitalCourse && <div className="a4-section-body">{hospitalCourse}</div>}
                  </div>
                )}

                {/* Section: Vitals at Discharge */}
                <div className="a4-section">
                  <div className="a4-section-header">Discharge Vitals</div>
                  <div className="a4-vitals-strip">
                    <div className="a4-vital-item"><strong>BP:</strong> {dischargeBp}</div>
                    <div className="a4-vital-item"><strong>Pulse:</strong> {dischargePulse} bpm</div>
                    <div className="a4-vital-item"><strong>Temp:</strong> {dischargeTemp} °F</div>
                    <div className="a4-vital-item"><strong>SpO2:</strong> {dischargeSpo2}%</div>
                    <div className="a4-vital-item"><strong>RR:</strong> {dischargeRespRate} /min</div>
                  </div>
                </div>

                {/* Section: Discharge Medications */}
                <div className="a4-section">
                  <div className="a4-section-header">Discharge Medications (Rx)</div>
                  {medications.length === 0 ? (
                    <div className="a4-section-body" style={{ color: '#64748b' }}>No medications prescribed.</div>
                  ) : (
                    <table className="a4-meds-table">
                      <thead>
                        <tr>
                          <th>Medicine & Dosage</th>
                          <th>Route</th>
                          <th>Frequency</th>
                          <th>Duration</th>
                          <th>Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {medications.map((m, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{m.name} ({m.dosage})</td>
                            <td>{m.route}</td>
                            <td>{m.frequency}</td>
                            <td>{m.duration}</td>
                            <td>{m.instructions || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Section: Advice & Follow-up */}
                <div className="a4-section">
                  <div className="a4-section-header">Follow-up & Advice</div>
                  <div className="a4-section-body">
                    <strong>Next Follow-up Date:</strong> {followUpDate ? new Date(followUpDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'As advised'}
                  </div>
                  {dietaryInstructions && (
                    <div className="a4-section-body" style={{ marginTop: '3px' }}>
                      <strong>Diet & Lifestyle:</strong> {dietaryInstructions}
                    </div>
                  )}
                  {followUpInstructions && (
                    <div className="a4-section-body" style={{ marginTop: '3px' }}>
                      <strong>Instructions:</strong> {followUpInstructions}
                    </div>
                  )}
                  {emergencyRedFlags && (
                    <div className="a4-red-flags-box">
                      <strong>EMERGENCY WARNING RED FLAGS:</strong> {emergencyRedFlags}
                    </div>
                  )}
                </div>

                {/* Signatures */}
                <div className="a4-signatures-block">
                  <div className="a4-sign-box">
                    <div className="a4-sign-line"></div>
                    <div className="a4-sign-title">{rmoName}</div>
                    <div className="a4-sign-sub">Resident Medical Officer</div>
                  </div>
                  <div className="a4-sign-box">
                    <div className="a4-sign-line"></div>
                    <div className="a4-sign-title">{consultantDoctorName}</div>
                    <div className="a4-sign-sub">Consultant In-Charge / Specialist</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="discharge-modal-footer">
          <div>
            {savedSuccess && (
              <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.88rem' }}>
                <CheckCircle size={16} /> Discharge summary saved successfully!
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="discharge-btn discharge-btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="discharge-btn discharge-btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save Summary'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
