import React from 'react';
import { format } from 'date-fns';
import {
  formatAgeGender,
  storage,
  isAdvanceDepositReceipt,
  type Doctor,
  type Receipt,
  type Prescription,
  type ReceiptPaperType,
  type PrescriptionPaperType,
  type ClinicProfile
} from '../../lib/storage';
import QRCodeImage from '../ui/QRCodeImage';
import '../../styles/components/PrintTemplates.css';

interface PrintTemplatesProps {
  receiptsToPrint: Receipt[];
  activePrintPrescription: Prescription | null;
  doctors: Doctor[];
  receiptPaperType?: ReceiptPaperType;
  prescriptionPaperType?: PrescriptionPaperType;
}

const getReceiptPageStyle = (paper: ReceiptPaperType = 'A5') => {
  switch (paper) {
    case 'A4':
      return `@page { size: A4 portrait; margin: 1.2cm; }`;
    case 'A5':
      return `@page { size: A5 portrait; margin: 0.8cm; }`;
    case 'A6':
      return `@page { size: A6 portrait; margin: 0.5cm; }`;
    case 'Letter':
      return `@page { size: letter portrait; margin: 1.2cm; }`;
    case 'Thermal80':
      return `@page { size: 80mm auto; margin: 2mm 3mm; }`;
    case 'Thermal58':
      return `@page { size: 58mm auto; margin: 1mm 2mm; }`;
    default:
      return `@page { size: A5 portrait; margin: 0.8cm; }`;
  }
};

const getPrescriptionPageStyle = (paper: PrescriptionPaperType = 'A4') => {
  switch (paper) {
    case 'A4':
      return `@page { size: A4 portrait; margin: 0.8cm; }`;
    case 'A5':
      return `@page { size: A5 portrait; margin: 0.6cm; }`;
    case 'Letter':
      return `@page { size: letter portrait; margin: 0.8cm; }`;
    case 'A6':
      return `@page { size: A6 portrait; margin: 0.4cm; }`;
    default:
      return `@page { size: A4 portrait; margin: 0.8cm; }`;
  }
};

const PrintTemplates: React.FC<PrintTemplatesProps> = ({
  receiptsToPrint,
  activePrintPrescription,
  doctors,
  receiptPaperType = 'A5',
  prescriptionPaperType = 'A4',
}) => {
  const [clinicProfile, setClinicProfile] = React.useState<ClinicProfile>({
    clinicName: 'Buvora Clinic',
    clinicUpiId: '',
  });

  React.useEffect(() => {
    storage.getClinicProfile().then(setClinicProfile);
  }, [receiptsToPrint]);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr.split(' ')[0]), 'dd MMM yyyy');
    } catch {
      return dateStr || 'N/A';
    }
  };

  const isReceiptActive = receiptsToPrint.length > 0;
  const isPrescriptionActive = Boolean(activePrintPrescription);

  const dynamicPageCss = isPrescriptionActive
    ? getPrescriptionPageStyle(prescriptionPaperType)
    : isReceiptActive
    ? getReceiptPageStyle(receiptPaperType)
    : '';

  const receiptPaperClass = `paper-${receiptPaperType.toLowerCase()}`;
  const prescriptionPaperClass = `paper-${prescriptionPaperType.toLowerCase()}`;

  return (
    <>
      {/* Dynamic @page style */}
      {dynamicPageCss && (
        <style dangerouslySetInnerHTML={{ __html: dynamicPageCss }} />
      )}

      {/* Receipt print template — supports multi-receipt bulk print */}
      {receiptsToPrint.length > 0 && (
        <div id="receipt-print-template" className={`print-only ${receiptPaperClass}`}>
          {receiptsToPrint.map((r, idx) => {
            const doctorObj = doctors.find(d => d.id === r.doctorId);
            const printHeader = doctorObj ? doctorObj.printHeader !== false : true;
            const customTopMargin = doctorObj ? doctorObj.customTopMargin || 0 : 0;
            const customBottomMargin = doctorObj ? doctorObj.customBottomMargin || 0 : 0;

            const isFacility = r.billType === 'FACILITY';
            let qrPayload = r.qrCodeText;
            if (!qrPayload && r.showQrCode) {
              if (isFacility) {
                if (clinicProfile.clinicUpiId) {
                  qrPayload = `upi://pay?pa=${encodeURIComponent(clinicProfile.clinicUpiId)}&pn=${encodeURIComponent(clinicProfile.clinicName || 'Hospital')}&am=${(Number(r.total) || 0).toFixed(2)}&cu=INR`;
                } else if (clinicProfile.clinicQrText) {
                  qrPayload = clinicProfile.clinicQrText;
                }
              } else {
                if (doctorObj?.upiId) {
                  qrPayload = `upi://pay?pa=${encodeURIComponent(doctorObj.upiId)}&pn=${encodeURIComponent(doctorObj.name)}&am=${(Number(r.total) || 0).toFixed(2)}&cu=INR`;
                } else if (doctorObj?.qrCodeText) {
                  qrPayload = doctorObj.qrCodeText;
                }
              }
            }

            let displayUpiId = isFacility ? (clinicProfile.clinicUpiId || '') : (doctorObj?.upiId || '');
            if (qrPayload && qrPayload.startsWith('upi://')) {
              try {
                const match = qrPayload.match(/[?&]pa=([^&]+)/);
                if (match && match[1]) {
                  displayUpiId = decodeURIComponent(match[1]);
                }
              } catch {
                /* Ignore malformed URI parameter */
              }
            }
            const isUpi = Boolean(qrPayload && (qrPayload.startsWith('upi://') || qrPayload.includes('@upi') || displayUpiId));

            return (
              <div
                key={r.id}
                className="print-container page-break"
                style={{
                  paddingTop: !printHeader && customTopMargin ? `${customTopMargin}mm` : undefined,
                  paddingBottom: !printHeader && customBottomMargin ? `${customBottomMargin}mm` : undefined,
                  borderTop: !printHeader ? 'none' : undefined,
                }}
              >
                {printHeader && (
                  <div className="print-header">
                    <div className="print-clinic-branding">
                      <h2>{isFacility ? (clinicProfile.clinicName || 'HOSPITAL & CLINIC CARE') : (doctorObj?.name || r.doctorName)}</h2>
                      <p className="clinic-tagline" style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                        {isFacility ? (clinicProfile.clinicAddress || 'Inpatient & Specialized Facility Care') : (doctorObj?.address || '')}
                      </p>
                    </div>
                    <div className="print-clinic-address">
                      {isFacility ? (
                        <>
                          <p style={{ fontWeight: 700 }}>IN-PATIENT &amp; FACILITY DEPARTMENT</p>
                          <p>Attending: {doctorObj?.name || r.doctorName}</p>
                          {clinicProfile.clinicPhone ? (
                            <p>Ph: {clinicProfile.clinicPhone}</p>
                          ) : doctorObj?.phone ? (
                            <p>Ph: {doctorObj.phone}</p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p style={{ fontWeight: 700 }}>{doctorObj?.qualifications || ''}</p>
                          <p>{doctorObj?.specialization || ''}</p>
                          <p>Ph: {doctorObj?.phone || ''}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="print-title-bar">
                  <h1>
                    {isAdvanceDepositReceipt(r)
                      ? 'ADVANCE DEPOSIT RECEIPT'
                      : r.billType === 'FACILITY'
                      ? 'IN-PATIENT & DISCHARGE BILL'
                      : 'PAYMENT RECEIPT (DUPLICATE)'}
                  </h1>
                </div>

                <div className="print-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="info-section">
                    <h3>PATIENT DETAILS</h3>
                    {r.patientId && <p><strong>Patient ID:</strong> {r.patientId}</p>}
                    <p><strong>Name:</strong> {r.patientName}</p>
                    <p><strong>Age/Gender:</strong> {formatAgeGender(r.patientAge, r.patientGender)}</p>
                    <p><strong>Phone No.:</strong> {r.patientPhone || 'N/A'}</p>
                  </div>
                  <div className="info-section">
                    <h3>
                      {isAdvanceDepositReceipt(r)
                        ? 'DEPOSIT DETAILS'
                        : r.billType === 'FACILITY'
                        ? 'STAY & BILL DETAILS'
                        : 'BILL DETAILS'}
                    </h3>
                    <p><strong>Receipt #:</strong> #{r.receiptNumber}</p>
                    {r.billType === 'FACILITY' && r.roomNumber && (
                      <p><strong>Room / Bed:</strong> {r.roomNumber}</p>
                    )}
                    {r.billType === 'FACILITY' && r.admissionDate && (
                      <p><strong>Admission:</strong> {r.admissionDate}</p>
                    )}
                    {r.billType === 'FACILITY' && r.dischargeDate && (
                      <p><strong>Discharge:</strong> {r.dischargeDate}</p>
                    )}
                    <p><strong>Bill Date:</strong> {formatDate(r.date)}</p>
                    <p><strong>Payment Mode:</strong> {r.paymentMethod || 'CASH'}</p>
                  </div>
                </div>

                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35px', textAlign: 'center' }}>Sr.</th>
                      <th>Description of Services</th>
                      {r.billType === 'FACILITY' && <th style={{ width: '80px', textAlign: 'right' }}>Rate</th>}
                      {r.billType === 'FACILITY' && <th style={{ width: '70px', textAlign: 'center' }}>Qty</th>}
                      <th className="text-right" style={{ width: '90px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                        <td>
                          {item.category && item.category !== 'Other' && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginRight: '5px' }}>
                              [{item.category}]
                            </span>
                          )}
                          {item.description}
                        </td>
                        {r.billType === 'FACILITY' && (
                          <td className="text-right">
                            {item.rate ? `₹${Number(item.rate).toFixed(2)}` : '-'}
                          </td>
                        )}
                        {r.billType === 'FACILITY' && (
                          <td className="text-center">
                            {item.quantity ? `${item.quantity} ${item.unit || ''}` : '1'}
                          </td>
                        )}
                        <td className="text-right">
                          ₹{(r.paymentMethod === 'FREE' ? 0 : (Number(item.amount) || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {r.billType === 'FACILITY' && ((r.advancePaid && r.advancePaid > 0) || (r.discount && r.discount > 0)) && (
                      <>
                        <tr>
                          <th colSpan={4} className="text-right">Gross Subtotal:</th>
                          <th className="text-right">
                            ₹{(r.items.reduce((s, i) => s + (Number(i.amount) || 0), 0)).toFixed(2)}
                          </th>
                        </tr>
                        {r.discount && r.discount > 0 ? (
                          <tr>
                            <th colSpan={4} className="text-right">Discount:</th>
                            <th className="text-right">-₹{Number(r.discount).toFixed(2)}</th>
                          </tr>
                        ) : null}
                        {r.advancePaid && r.advancePaid > 0 ? (
                          <tr>
                            <th colSpan={4} className="text-right">Less: Advance Deposit:</th>
                            <th className="text-right">-₹{Number(r.advancePaid).toFixed(2)}</th>
                          </tr>
                        ) : null}
                      </>
                    )}
                    <tr>
                      <th colSpan={r.billType === 'FACILITY' ? 4 : 2} className="text-right">Total Payable Amount:</th>
                      <th className="text-right">₹{(Number(r.total) || 0).toFixed(2)}</th>
                    </tr>
                  </tfoot>
                </table>

                <div className="print-amount-words">
                  <p><strong>Total in words:</strong> Rupee {(Number(r.total) || 0).toLocaleString()} Only</p>
                </div>

                {qrPayload && (
                  <div className="print-qr-section" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                    <QRCodeImage text={qrPayload} size={receiptPaperType === 'Thermal58' ? 50 : receiptPaperType === 'Thermal80' ? 65 : 75} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                        {isUpi
                          ? (isFacility ? 'Scan to Pay Hospital / Clinic via UPI' : 'Scan to Pay via UPI')
                          : 'Scan QR Code'}
                      </p>
                      {isUpi && displayUpiId && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#334155' }}>
                          {isFacility ? 'Hospital / Clinic UPI: ' : 'UPI VPA: '}<strong>{displayUpiId}</strong>
                        </p>
                      )}
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                        {isUpi ? 'Supported: GPay / PhonePe / Paytm / BHIM / Any UPI App' : 'Scan for details'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="print-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <div className="terms">
                    <p>• This is a computer-generated duplicate receipt.</p>
                    <p>• Original date of service: {formatDate(r.date)}</p>
                    {receiptsToPrint.length > 1 && (
                      <p className="print-page-info">Receipt {idx + 1} of {receiptsToPrint.length}</p>
                    )}
                  </div>
                  <div className="signature-box" style={{ textAlign: 'center' }}>
                    <div className="signature-line"></div>
                    <p>Authorized Signatory</p>
                  </div>
                </div>

                <div className="software-branding" style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '8px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 3px 0' }}>Software Developed by: <strong>Badshah Computers</strong></p>
                  <p style={{ margin: 0 }}>Support: +91 9981188253, +91 9039010987 | Email: burhansaifee2003@gmail.com</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Prescription print template */}
      {activePrintPrescription && (() => {
        const doc = doctors.find(d => String(d.id) === String(activePrintPrescription.doctorId));
        const rawMeds = activePrintPrescription.medicines;
        const medsList = Array.isArray(rawMeds) ? rawMeds : typeof rawMeds === 'string' ? JSON.parse(rawMeds || '[]') : [];

        const rawLabs = activePrintPrescription.labInvestigations;
        const labsList: string[] = Array.isArray(rawLabs) ? rawLabs : typeof rawLabs === 'string' ? JSON.parse(rawLabs || '[]') : [];

        return (
          <div id="prescription-print-template" className={`print-only ${prescriptionPaperClass}`}>
            <div
              className="print-container"
              style={{
                paddingTop: doc?.printHeader === false && doc?.customTopMargin
                  ? `${doc.customTopMargin}mm`
                  : undefined,
                paddingBottom: doc?.printHeader === false && doc?.customBottomMargin
                  ? `${doc.customBottomMargin}mm`
                  : undefined,
                borderTop: doc?.printHeader === false ? 'none' : undefined,
              }}
            >
              {doc?.printHeader !== false && (
                <div className="print-header">
                  <div className="print-clinic-branding">
                    <h2> {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}</h2>
                    <p className="qualifications">{doc?.qualifications || ''}</p>
                    <p className="specialization">{doc?.specialization || 'Consulting Physician'}</p>
                  </div>
                  <div className="print-clinic-address">
                    <p className="address-text">{doc?.address || ''}</p>
                    {doc?.phone && <p className="phone-text"><strong>Ph:</strong> {doc.phone}</p>}
                  </div>
                </div>
              )}

              <div className="print-patient-meta-grid" style={{ marginBottom: '0.6rem', padding: '0.6rem 0.8rem', gap: '0.6rem' }}>
                <div>
                  <span className="meta-label">Patient Name</span>
                  <strong className="meta-value">{activePrintPrescription.patientName}</strong>
                </div>
                {activePrintPrescription.patientId && (
                  <div>
                    <span className="meta-label">Patient ID</span>
                    <strong className="meta-value">{activePrintPrescription.patientId}</strong>
                  </div>
                )}
                <div>
                  <span className="meta-label">Age / Gender</span>
                  <strong className="meta-value">{formatAgeGender(activePrintPrescription.patientAge, activePrintPrescription.patientGender)}</strong>
                </div>
                <div>
                  <span className="meta-label">Date</span>
                  <strong className="meta-value">{formatDate(activePrintPrescription.date)}</strong>
                </div>
                <div>
                  <span className="meta-label">Phone No</span>
                  <strong className="meta-value">{activePrintPrescription.patientPhone || 'N/A'}</strong>
                </div>
              </div>

              {(activePrintPrescription.symptoms || activePrintPrescription.diagnosis) && (
                <div className="print-clinical-grid" style={{ display: 'flex', flexDirection: 'row', gap: '1rem', marginBottom: '0.6rem', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.6rem' }}>
                  {activePrintPrescription.symptoms && (
                    <div className="clinical-card" style={{ flex: 1, minWidth: 0 }}>
                      <span className="clinical-label">Chief Complaints / Symptoms</span>
                      <p className="clinical-text">{activePrintPrescription.symptoms}</p>
                    </div>
                  )}
                  {activePrintPrescription.diagnosis && (
                    <div className="clinical-card" style={{ flex: 1, minWidth: 0 }}>
                      <span className="clinical-label">Diagnosis</span>
                      <p className="clinical-text">{activePrintPrescription.diagnosis}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="print-rx-section" style={{ marginBottom: '0.6rem' }}>
                <table className="print-meds-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>Sr.</th>
                      <th>Medicine Description</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Dosage</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Duration</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medsList.map((m: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td><strong>{m.name}</strong></td>
                        <td style={{ textAlign: 'center' }}>{m.dosage}</td>
                        <td style={{ textAlign: 'center' }}>{m.duration}</td>
                        <td>{m.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {labsList.length > 0 && (
                <div className="print-investigations-section" style={{ marginBottom: '0.6rem', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Diagnostic Laboratory Investigations Advised:
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {labsList.map((testName: string, idx: number) => (
                      <span key={idx} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        background: 'white',
                        border: '1px solid #94a3b8',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#0f172a'
                      }}>
                        {idx + 1}. {testName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {activePrintPrescription.notes && (
                <div className="print-notes-section" style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem' }}>
                  <span className="notes-label">Advice / Notes</span>
                  <p className="notes-text" style={{ whiteSpace: 'pre-wrap' }}>{activePrintPrescription.notes}</p>
                </div>
              )}

              {activePrintPrescription.followUpDate && (
                <div className="print-followup-box" style={{ marginTop: '0.5rem', marginBottom: '0.5rem', padding: '0.4rem 0.75rem', border: '1.5px dashed #0284c7', borderRadius: '6px', background: '#f0f9ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>NEXT VISIT / PATIENT FOLLOW-UP</span>
                      <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                        {(() => {
                          try {
                            return format(new Date(activePrintPrescription.followUpDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy');
                          } catch {
                            return activePrintPrescription.followUpDate;
                          }
                        })()}
                      </strong>
                    </div>
                    {activePrintPrescription.followUpNotes && (
                      <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#334155' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block' }}>REASON / ADVICE</span>
                        <strong>{activePrintPrescription.followUpNotes}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="print-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <div className="signature-box" style={{ textAlign: 'center' }}>
                  <div className="signature-line" style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}></div>
                  <p style={{ margin: '0 0 2px 0', fontWeight: '700', fontSize: '0.85rem' }}>
                     {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}
                  </p>
                  <p className="subtitle">Authorized Signature</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default PrintTemplates;
