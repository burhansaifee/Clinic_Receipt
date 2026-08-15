import React from 'react';
import { format } from 'date-fns';
import { formatAgeGender, type Doctor, type Receipt, type Prescription } from '../../lib/storage';

interface PrintTemplatesProps {
  receiptsToPrint: Receipt[];
  activePrintPrescription: Prescription | null;
  doctors: Doctor[];
}

const PrintTemplates: React.FC<PrintTemplatesProps> = ({
  receiptsToPrint,
  activePrintPrescription,
  doctors,
}) => {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr.split(' ')[0]), 'dd MMM yyyy');
    } catch {
      return dateStr || 'N/A';
    }
  };

  return (
    <>
      {/* Receipt print template — supports multi-receipt bulk print */}
      {receiptsToPrint.length > 0 && (
        <div id="receipt-print-template" className="print-only">
          {receiptsToPrint.map((r, idx) => {
            const doctorObj = doctors.find(d => d.id === r.doctorId);
            const printHeader = doctorObj ? doctorObj.printHeader !== false : true;
            const customTopMargin = doctorObj ? doctorObj.customTopMargin || 0 : 0;

            return (
              <div
                key={r.id}
                className="print-container page-break"
                style={{
                  paddingTop: !printHeader && customTopMargin ? `${customTopMargin}mm` : undefined,
                  borderTop: !printHeader ? 'none' : undefined,
                }}
              >
                {printHeader && (
                  <div className="print-header">
                    <div className="print-clinic-branding">
                      <h2>{doctorObj?.name || r.doctorName}</h2>
                      <p className="clinic-tagline" style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                        {doctorObj?.address || ''}
                      </p>
                    </div>
                    <div className="print-clinic-address">
                      <p style={{ fontWeight: 700 }}>{doctorObj?.qualifications || ''}</p>
                      <p>{doctorObj?.specialization || ''}</p>
                      <p>Ph: {doctorObj?.phone || ''}</p>
                    </div>
                  </div>
                )}

                <div className="print-title-bar">
                  <h1>PAYMENT RECEIPT (DUPLICATE)</h1>
                </div>

                <div className="print-info-grid">
                  <div className="info-section">
                    <h3>PATIENT DETAILS</h3>
                    <p><strong>Name:</strong> {r.patientName}</p>
                    <p><strong>Age/Gender:</strong> {formatAgeGender(r.patientAge, r.patientGender)}</p>
                    <p><strong>Phone No.:</strong> {r.patientPhone || 'N/A'}</p>
                  </div>
                  <div className="info-section">
                    <h3>BILL DETAILS</h3>
                    <p><strong>Receipt #:</strong> {r.receiptNumber}</p>
                    <p><strong>Original Date:</strong> {formatDate(r.date)}</p>
                    <p><strong>Payment Mode:</strong> {r.paymentMethod || 'CASH'}</p>
                  </div>
                </div>

                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Sr.</th>
                      <th>Description of Services</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{item.description}</td>
                        <td className="text-right">
                          ₹{(r.paymentMethod === 'FREE' ? 0 : (Number(item.amount) || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2} className="text-right">Total Payable Amount:</th>
                      <th className="text-right">₹{(Number(r.total) || 0).toFixed(2)}</th>
                    </tr>
                  </tfoot>
                </table>

                <div className="print-amount-words">
                  <p><strong>Total in words:</strong> Rupee {(Number(r.total) || 0).toLocaleString()} Only</p>
                </div>

                <div className="print-footer">
                  <div className="terms">
                    <p>• This is a computer-generated duplicate receipt.</p>
                    <p>• Original date of service: {formatDate(r.date)}</p>
                    {receiptsToPrint.length > 1 && (
                      <p className="print-page-info">Receipt {idx + 1} of {receiptsToPrint.length}</p>
                    )}
                  </div>
                  <div className="signature-box">
                    <div className="signature-line"></div>
                    <p>Authorized Signatory</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Prescription print template */}
      {activePrintPrescription && (() => {
        const doc = doctors.find(d => d.id === activePrintPrescription.doctorId);
        return (
          <div id="prescription-print-template" className="print-only">
            <div
              className="print-container"
              style={{
                paddingTop: doc?.printHeader === false && doc?.customTopMargin
                  ? `${doc.customTopMargin}mm`
                  : undefined,
                borderTop: doc?.printHeader === false ? 'none' : undefined,
              }}
            >
              {doc?.printHeader !== false && (
                <div className="print-header">
                  <div className="print-clinic-branding">
                    <h2>Dr. {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}</h2>
                    <p className="qualifications">{doc?.qualifications || ''}</p>
                    <p className="specialization">{doc?.specialization || 'Consulting Physician'}</p>
                  </div>
                  <div className="print-clinic-address">
                    <p className="address-text">{doc?.address || ''}</p>
                    {doc?.phone && <p className="phone-text"><strong>Ph:</strong> {doc.phone}</p>}
                  </div>
                </div>
              )}

              <div className="print-patient-meta-grid">
                <div>
                  <span className="meta-label">Patient Name</span>
                  <strong className="meta-value">{activePrintPrescription.patientName}</strong>
                </div>
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
                <div className="print-clinical-grid">
                  {activePrintPrescription.symptoms && (
                    <div className="clinical-card">
                      <span className="clinical-label">Chief Complaints / Symptoms</span>
                      <p className="clinical-text">{activePrintPrescription.symptoms}</p>
                    </div>
                  )}
                  {activePrintPrescription.diagnosis && (
                    <div className="clinical-card">
                      <span className="clinical-label">Diagnosis</span>
                      <p className="clinical-text">{activePrintPrescription.diagnosis}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="print-rx-section">
                <div className="rx-symbol">Rₓ</div>
                <table className="print-meds-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Sr.</th>
                      <th>Medicine Description</th>
                      <th style={{ width: '120px' }}>Dosage</th>
                      <th style={{ width: '100px' }}>Duration</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activePrintPrescription.medicines || []).map((m, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.dosage}</td>
                        <td>{m.duration}</td>
                        <td>{m.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activePrintPrescription.notes && (
                <div className="print-notes-section">
                  <span className="notes-label">Advice / Notes</span>
                  <p className="notes-text" style={{ whiteSpace: 'pre-wrap' }}>{activePrintPrescription.notes}</p>
                </div>
              )}

              <div className="print-footer">
                <div className="signature-box" style={{ marginLeft: 'auto', textAlign: 'center' }}>
                  <div className="signature-line"></div>
                  <p style={{ margin: '0 0 2px 0', fontWeight: '700' }}>
                    Dr. {activePrintPrescription.doctorName.replace(/^Dr\.?\s+/i, '')}
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
