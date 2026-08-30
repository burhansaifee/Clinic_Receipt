import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Filter, Search, Calendar, Users, FileText,
  Printer, Edit2, Trash2, CheckCircle, MessageSquare, Send, X, Phone,
  History, User, Activity, Clock, Bed, Pill, Stethoscope
} from 'lucide-react';
import type { Receipt, PatientHistorySummary } from '../../lib/storage';
import { storage } from '../../lib/storage';
import { useToast } from '../ui/Toast';
import { sendReceiptViaWhatsApp, formatReceiptWhatsAppMessage } from '../../lib/whatsappReceipt';

interface HistoryTabProps {
  onPrint: (receipts: Receipt[]) => void;
  onEdit: (receipt: Receipt) => void;
  onDelete: (id: string) => void;
  onExportCsv: () => void;
}

const INITIAL_LIMIT = 20;

const HistoryTab: React.FC<HistoryTabProps> = ({
  onPrint,
  onEdit,
  onDelete,
  onExportCsv,
}) => {
  const toast = useToast();
  const [localReceipts, setLocalReceipts] = useState<Receipt[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  // WhatsApp Send Modal State
  const [whatsAppModalReceipt, setWhatsAppModalReceipt] = useState<Receipt | null>(null);
  const [targetPhone, setTargetPhone] = useState('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Patient Complete History Modal State
  const [selectedPatientForHistory, setSelectedPatientForHistory] = useState<{
    patientId?: string;
    patientName: string;
    patientPhone?: string;
    patientAge?: string;
    patientGender?: string;
  } | null>(null);

  const [patientHistoryData, setPatientHistoryData] = useState<PatientHistorySummary | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'timeline' | 'receipts' | 'prescriptions' | 'facility' | 'appointments'>('timeline');

  const handleOpenPatientHistory = async (receipt: Receipt) => {
    const info = {
      patientId: receipt.patientId,
      patientName: receipt.patientName,
      patientPhone: receipt.patientPhone,
      patientAge: receipt.patientAge,
      patientGender: receipt.patientGender,
    };
    setSelectedPatientForHistory(info);
    setIsLoadingHistory(true);
    setHistoryTab('timeline');

    try {
      const summary = await storage.getPatientCompleteHistory({
        patientId: receipt.patientId,
        patientPhone: receipt.patientPhone,
        patientName: receipt.patientName,
      });
      setPatientHistoryData(summary);
    } catch (err) {
      console.error('Error fetching patient complete history:', err);
      toast('Failed to load complete patient history', { type: 'error' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Timeline events aggregation
  const timelineEvents = useMemo(() => {
    if (!patientHistoryData) return [];
    const list: Array<{
      id: string;
      type: 'OPD_RECEIPT' | 'FACILITY_BILL' | 'PRESCRIPTION' | 'APPOINTMENT' | 'FOLLOW_UP';
      date: string;
      title: string;
      doctorName?: string;
      summary: string;
      data: any;
    }> = [];

    // Receipts
    patientHistoryData.receipts.forEach(r => {
      const isFacility = r.billType === 'FACILITY';
      list.push({
        id: `receipt-${r.id}`,
        type: isFacility ? 'FACILITY_BILL' : 'OPD_RECEIPT',
        date: r.date,
        title: isFacility ? `Facility Bill #${r.receiptNumber}${r.roomNumber ? ` (${r.roomNumber})` : ''}` : `OPD Receipt #${r.receiptNumber}`,
        doctorName: r.doctorName,
        summary: `Total: ₹${Number(r.total || 0).toFixed(2)} (${r.paymentMethod}) • ${r.items?.length || 0} item(s)`,
        data: r
      });
    });

    // Prescriptions
    patientHistoryData.prescriptions.forEach(p => {
      const medNames = p.medicines?.map(m => m.name).slice(0, 3).join(', ') || 'No medicines';
      list.push({
        id: `rx-${p.id}`,
        type: 'PRESCRIPTION',
        date: p.date,
        title: `Clinical Consultation & Rx`,
        doctorName: p.doctorName,
        summary: `${p.diagnosis ? `Dx: ${p.diagnosis} • ` : ''}${p.medicines?.length || 0} Meds (${medNames})`,
        data: p
      });
    });

    // Appointments
    patientHistoryData.appointments.forEach(a => {
      list.push({
        id: `apt-${a.id}`,
        type: 'APPOINTMENT',
        date: a.appointmentDate,
        title: `Appointment (${a.appointmentTime})`,
        doctorName: a.doctorName,
        summary: `Status: ${a.status} ${a.notes ? `• ${a.notes}` : ''}`,
        data: a
      });
    });

    // Follow-ups
    patientHistoryData.followUps.forEach(f => {
      list.push({
        id: `fu-${f.id}`,
        type: 'FOLLOW_UP',
        date: f.scheduledDate,
        title: `Scheduled Follow-Up Revisit`,
        doctorName: f.doctorName,
        summary: `Status: ${f.status} ${f.notes ? `• ${f.notes}` : ''}`,
        data: f
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [patientHistoryData]);

  const handleOpenWhatsAppModal = (receipt: Receipt) => {
    setWhatsAppModalReceipt(receipt);
    setTargetPhone(receipt.patientPhone || '');
  };

  const handleSendWhatsApp = async () => {
    if (!whatsAppModalReceipt) return;
    if (!targetPhone.trim()) {
      toast('Please enter a valid patient phone number.', { type: 'error' });
      return;
    }
    setIsSendingWhatsApp(true);
    try {
      const res = await sendReceiptViaWhatsApp(whatsAppModalReceipt, targetPhone.trim());
      toast(res.message || 'Receipt sent via WhatsApp successfully!', { type: 'success' });
      setWhatsAppModalReceipt(null);
    } catch (err: any) {
      toast(err.message || 'Failed to send receipt via WhatsApp.', { type: 'error' });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Fetch receipts from backend with filters and pagination
  useEffect(() => {
    let active = true;
    const fetchReceipts = async () => {
      try {
        const fetched = await storage.getReceipts({
          limit: displayLimit + 1, // Fetch one extra to determine if hasMore
          search: searchQuery,
          startDate: startDate,
          endDate: endDate
        });
        if (active && fetched) {
          setLocalReceipts(fetched);
        }
      } catch (err) {
        console.error("Failed to fetch paginated receipts", err);
      }
    };
    fetchReceipts();
    return () => { active = false; };
  }, [displayLimit, searchQuery, startDate, endDate]);

  const visibleReceipts = useMemo(() => {
    return localReceipts.slice(0, displayLimit);
  }, [localReceipts, displayLimit]);

  const hasMore = localReceipts.length > displayLimit;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && hasMore) {
            setDisplayLimit(prev => prev + 20);
          }
        },
        { rootMargin: '200px' }
      );

      observerRef.current.observe(node);
    },
    [hasMore]
  );

  const visibleGroups = useMemo(() => {
    const groupsMap: Record<string, Receipt[]> = {};
    const dateOrder: string[] = [];

    for (const r of visibleReceipts) {
      const dateOnly = r.date.split(' ')[0];
      if (!groupsMap[dateOnly]) {
        groupsMap[dateOnly] = [];
        dateOrder.push(dateOnly);
      }
      groupsMap[dateOnly].push(r);
    }

    return dateOrder.map(date => ({
      date,
      dateReceipts: groupsMap[date],
    }));
  }, [visibleReceipts]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkPrint = () => {
    onPrint(localReceipts.filter(r => selectedIds.has(r.id)));
  };

  const handleDeleteReceipt = (id: string) => {
    onDelete(id);
    if (selectedIds.has(id)) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="history-page">
      {/* Filter Card */}
      <div className="card filter-card no-print">
        <div className="filter-header">
          <div className="filter-title">
            <div className="filter-icon-bg">
              <Filter size={16} />
            </div>
            <h3>Records Explorer</h3>
          </div>
          {(startDate || endDate || searchQuery) && (
            <button
              className="btn-reset"
              onClick={() => { setStartDate(''); setEndDate(''); setSearchQuery(''); setDisplayLimit(INITIAL_LIMIT); }}
            >
              Show All Records
            </button>
          )}
        </div>
        <div className="filter-controls">
          <div className="range-filter-group">
            <div className="filter-input-wrapper">
              <Search size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Search by Patient ID (PID), patient, phone, receipt #..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setDisplayLimit(INITIAL_LIMIT); }}
              />
            </div>
            <div className="filter-input-wrapper date-picker-group">
              <span className="date-field-label">From</span>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setDisplayLimit(INITIAL_LIMIT); }}
                className="date-input"
              />
            </div>
            <div className="filter-input-wrapper date-picker-group">
              <span className="date-field-label">To</span>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setDisplayLimit(INITIAL_LIMIT); }}
                className="date-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="card financial-summary no-print">
        <div className="summary-header">
          <h2>Financial Summary {startDate || endDate ? `Period: ${startDate || 'Start'} to ${endDate || 'Today'}` : 'Overview'}</h2>
          <button
            className="btn-secondary"
            onClick={onExportCsv}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FileText size={16} /> Export CSV Report
          </button>
        </div>

        <div className="summary-grid">

          {Object.entries(
            localReceipts.reduce((acc, r) => {
              const name = r.doctorName || 'General';
              const amount = r.paymentMethod === 'FREE' ? 0 : (Number(r.total) || 0);
              acc[name] = (acc[name] || 0) + amount;
              return acc;
            }, {} as Record<string, number>)
          ).map(([name, total]) => (
            <div key={name} className="metric-card doctor-metric">
              <div className="metric-icon secondary"><Users size={16} /></div>
              <div className="metric-info">
                <span className="label">{name}</span>
                <span className="value small">₹{total.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="history-list no-print">
        {selectedIds.size > 0 && (
          <div className="bulk-action-bar anim-up">
            <div className="bulk-info">
              <span className="bulk-count">{selectedIds.size} records selected</span>
              <button className="btn-ghost-sm" onClick={clearSelection}>Clear Selection</button>
            </div>
            <button className="btn-primary-sm bulk-print-btn" onClick={handleBulkPrint}>
              <Printer size={16} /> Print Selected
            </button>
          </div>
        )}

        <div className="history-timeline">
        {localReceipts.length === 0 ? (
          <div className="card empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
            <p className="text-muted">No receipts found for the selected period.</p>
          </div>
        ) : (
          <>
            {visibleGroups.map(({ date, dateReceipts }) => {
              const dateAllReceipts = localReceipts.filter(r => r.date.split(' ')[0] === date);
              const dailyDoctorTotals = dateAllReceipts.reduce((acc, r) => {
                const name = r.doctorName || 'General';
                const amount = r.paymentMethod === 'FREE' ? 0 : (Number(r.total) || 0);
                acc[name] = (acc[name] || 0) + amount;
                return acc;
              }, {} as Record<string, number>);
              const daySum = dateAllReceipts.reduce(
                (sum, r) => sum + (r.paymentMethod === 'FREE' ? 0 : (Number(r.total) || 0)),
                0
              );

              return (
                <div key={date} className="date-group-modern">
                  <div className="date-header">
                    <div className="date-info">
                      <Calendar size={18} />
                      <h3>{date}</h3>
                      <button
                        className="btn-ghost-xs"
                        onClick={() => {
                          const ids = dateAllReceipts.map(r => r.id);
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            const allSelected = ids.every(id => next.has(id));
                            if (allSelected) ids.forEach(id => next.delete(id));
                            else ids.forEach(id => next.add(id));
                            return next;
                          });
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={dateAllReceipts.every(r => selectedIds.has(r.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                dateAllReceipts.forEach(r => next.add(r.id));
                                return next;
                              });
                            } else {
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                dateAllReceipts.forEach(r => next.delete(r.id));
                                return next;
                              });
                            }
                          }}
                        />{dateAllReceipts.every(r => selectedIds.has(r.id)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="date-totals">
                      {Object.entries(dailyDoctorTotals).map(([name, total]) => (
                        <div key={name} className="dr-day-total">
                          {name}: <strong>₹{total.toLocaleString()}</strong>
                        </div>
                      ))}
                      <div className="day-sum">
                        Day Total: <strong>₹{daySum.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="receipt-items-table-container">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}></th>
                          <th>Receipt</th>
                          <th>Patient</th>
                          <th>Doctor &amp; Method</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateReceipts.map(r => {
                          const totalNum = typeof r.total === 'number' ? r.total : parseFloat(r.total as any) || 0;
                          return (
                            <tr key={r.id} className={`receipt-table-row ${selectedIds.has(r.id) ? 'selected' : ''}`}>
                              <td className="center-cell">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(r.id)}
                                  onChange={() => toggleSelection(r.id)}
                                  className="row-checkbox"
                                />
                              </td>
                              <td>
                                <span className="r-num">#{r.receiptNumber}</span>
                                {r.billType === 'FACILITY' && (
                                  <div style={{ marginTop: '2px' }}>
                                    <span style={{ fontSize: '0.65rem', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                      FACILITY {r.roomNumber ? `• ${r.roomNumber}` : ''}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td
                                className="patient-cell-clickable"
                                onClick={() => handleOpenPatientHistory(r)}
                                title={`Click to view complete patient history for ${r.patientName}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                  {r.patientId && (
                                    <span className="patient-id-badge">{r.patientId}</span>
                                  )}
                                  <span style={{
                                    fontSize: '0.65rem',
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <History size={10} /> History
                                  </span>
                                </div>
                                <div className="r-name" style={{ color: '#0284c7', fontWeight: 700 }}>{r.patientName}</div>
                                {r.patientPhone && <div className="r-ph">{r.patientPhone}</div>}
                              </td>
                              <td>
                                <div className="r-dr">by {r.doctorName}</div>
                                <span className={`payment-badge ${(r.paymentMethod || 'CASH').toLowerCase()}`}>
                                  {r.paymentMethod || 'CASH'}
                                </span>
                              </td>
                              <td className="text-right">
                                <span className="r-amt">₹{totalNum.toFixed(2)}</span>
                              </td>
                              <td className="text-right">
                                <div className="action-buttons">
                                  <button
                                    className="btn-icon-xs history-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPatientHistory(r);
                                    }}
                                    title={`View Complete Patient History for ${r.patientName}`}
                                    style={{ color: '#0284c7', background: '#f0f9ff' }}
                                  >
                                    <History size={14} />
                                  </button>
                                  <button
                                    className="btn-icon-xs whatsapp-btn"
                                    onClick={() => handleOpenWhatsAppModal(r)}
                                    title="Send Receipt via WhatsApp"
                                  >
                                    <MessageSquare size={14} />
                                  </button>
                                  <button
                                    className="btn-icon-xs print-btn"
                                    onClick={() => onPrint([r])}
                                    title="Print Receipt"
                                  >
                                    <Printer size={14} />
                                  </button>
                                  <button
                                    className="btn-icon-xs edit-btn"
                                    onClick={() => onEdit(r)}
                                    title="Edit Receipt"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    className="btn-icon-xs delete-btn"
                                    onClick={() => handleDeleteReceipt(r.id)}
                                    title="Delete Receipt"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="load-more-container" ref={loadMoreRef}>
                <button 
                  className="btn-secondary"
                  onClick={() => setDisplayLimit(prev => prev + 20)}
                >
                  Load More Records
                </button>
              </div>
            )}
            
            {!hasMore && localReceipts.length > 0 && (
              <div className="end-of-results">
                <div className="end-divider"></div>
                <p>
                  <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Showing all records for this query
                </p>
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* WhatsApp Send & Preview Modal */}
      {whatsAppModalReceipt && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%', borderRadius: '16px', background: 'white', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#dcfce7', color: '#16a34a', padding: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#14532d', fontFamily: 'Outfit, sans-serif' }}>Send Receipt via WhatsApp</h3>
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Receipt #{whatsAppModalReceipt.receiptNumber}</span>
                </div>
              </div>
              <button onClick={() => setWhatsAppModalReceipt(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Patient Name:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{whatsAppModalReceipt.patientName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Doctor:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Dr. {whatsAppModalReceipt.doctorName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                  <span style={{ color: 'var(--text-main)' }}>{whatsAppModalReceipt.date}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Amount:</span>
                  <strong style={{ color: '#16a34a', fontSize: '1rem' }}>₹{Number(whatsAppModalReceipt.total || 0).toFixed(2)} ({whatsAppModalReceipt.paymentMethod})</strong>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Phone size={14} style={{ color: '#16a34a' }} /> RECIPIENT PHONE NUMBER *
                </label>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile or international phone..."
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                  Enter 10-digit number (e.g. 9876543210). Indian country code (+91) is added automatically.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  MESSAGE PREVIEW
                </label>
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '140px', overflowY: 'auto', fontSize: '0.78rem', whiteSpace: 'pre-line', color: '#334155', fontFamily: 'monospace' }}>
                  {formatReceiptWhatsAppMessage(whatsAppModalReceipt)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: '#f8fafc' }}>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setWhatsAppModalReceipt(null)}
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSendWhatsApp}
                disabled={isSendingWhatsApp || !targetPhone.trim()}
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '0.6rem 1.4rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)'
                }}
              >
                <Send size={15} /> {isSendingWhatsApp ? 'Sending...' : 'Send WhatsApp Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Patient Clinical & Billing History Modal */}
      {selectedPatientForHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.25rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '980px',
            height: '88vh',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Modal Header - Fixed Top */}
            <div style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
                }}>
                  <User size={26} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a', fontWeight: 800 }}>
                      {selectedPatientForHistory.patientName}
                    </h2>
                    {selectedPatientForHistory.patientId && (
                      <span className="patient-id-badge" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
                        {selectedPatientForHistory.patientId}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Complete Patient Dossier
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '0.82rem', color: '#64748b' }}>
                    {selectedPatientForHistory.patientAge && (
                      <span>Age: <strong>{selectedPatientForHistory.patientAge}</strong></span>
                    )}
                    {selectedPatientForHistory.patientGender && (
                      <span>• Gender: <strong>{selectedPatientForHistory.patientGender}</strong></span>
                    )}
                    {selectedPatientForHistory.patientPhone && (
                      <span>• Phone: <strong> {selectedPatientForHistory.patientPhone}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {selectedPatientForHistory.patientPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      const latest = patientHistoryData?.receipts[0];
                      if (latest) {
                        handleOpenWhatsAppModal(latest);
                      } else {
                        const cleanPh = selectedPatientForHistory.patientPhone?.replace(/\D/g, '') || '';
                        window.open(`https://wa.me/${cleanPh.length === 10 ? '91' + cleanPh : cleanPh}`, '_blank');
                      }
                    }}
                    style={{
                      background: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.5rem 0.9rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    <MessageSquare size={14} /> Send WhatsApp
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPatientForHistory(null)}
                  style={{
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '8px',
                    width: '34px',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#475569',
                    transition: 'all 0.15s ease'
                  }}
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Metrics KPI Bar - Fixed Top */}
            {patientHistoryData && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '0.75rem 1.5rem',
                background: '#f8fafc',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0
              }}>
                <div style={{ background: 'white', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Visits</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    {patientHistoryData.totalVisits}
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>
                      ({patientHistoryData.opdCount} OPD • {patientHistoryData.facilityCount} Facility)
                    </span>
                  </div>
                </div>

                <div style={{ background: 'white', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Billed</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>
                    ₹{patientHistoryData.totalSpent.toFixed(2)}
                  </div>
                </div>

                <div style={{ background: 'white', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Prescriptions (Rx)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7' }}>
                    {patientHistoryData.prescriptionCount} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>Consultations</span>
                  </div>
                </div>

                <div style={{ background: 'white', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Appointments & Revisits</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7e22ce' }}>
                    {patientHistoryData.appointments.length + patientHistoryData.followUps.length}
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>
                      Recorded
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs - Fixed Pinned Top */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              flexShrink: 0,
              padding: '0.65rem 1.5rem',
              background: '#f8fafc',
              borderBottom: '1px solid var(--border)',
              gap: '0.5rem'
            }}>
              {[
                { id: 'timeline', label: 'All Activity Timeline', icon: Clock, count: timelineEvents.length },
                { id: 'receipts', label: 'Invoices & Receipts', icon: FileText, count: patientHistoryData?.receipts.length || 0 },
                { id: 'prescriptions', label: 'Prescriptions & Rx', icon: Pill, count: patientHistoryData?.prescriptions.length || 0 },
                { id: 'facility', label: 'Inpatient Stays', icon: Bed, count: patientHistoryData?.facilityCount || 0 },
                { id: 'appointments', label: 'Appointments & Follow-ups', icon: Calendar, count: (patientHistoryData?.appointments.length || 0) + (patientHistoryData?.followUps.length || 0) }
              ].map(t => {
                const Icon = t.icon;
                const active = historyTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHistoryTab(t.id as any)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      background: active ? '#0284c7' : '#ffffff',
                      border: `1px solid ${active ? '#0284c7' : '#cbd5e1'}`,
                      borderRadius: '8px',
                      color: active ? '#ffffff' : '#334155',
                      fontWeight: active ? 700 : 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      boxShadow: active ? '0 2px 6px rgba(2, 132, 199, 0.35)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={14} />
                    <span>{t.label}</span>
                    <span style={{
                      fontSize: '0.68rem',
                      background: active ? 'rgba(255, 255, 255, 0.28)' : '#f1f5f9',
                      color: active ? '#ffffff' : '#64748b',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body with dynamic tabs - Scrollable inner container only */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.25rem 1.5rem', background: '#fafbfc' }}>
              {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
                  <Activity size={32} className="text-primary" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontWeight: 600, margin: 0 }}>Gathering comprehensive medical records...</p>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Querying SQLite database for receipts, prescriptions, and visits</span>
                </div>
              ) : !patientHistoryData || (timelineEvents.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                  <History size={36} style={{ color: '#94a3b8', margin: '0 auto 0.5rem auto' }} />
                  <p style={{ margin: 0, fontWeight: 700, color: '#334155' }}>No prior historical visits found</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    This appears to be the patient's first registered visit.
                  </p>
                </div>
              ) : (
                <>
                  {/* TAB 1: ALL ACTIVITY TIMELINE */}
                  {historyTab === 'timeline' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {timelineEvents.map(event => {
                        const isReceipt = event.type === 'OPD_RECEIPT';
                        const isFacility = event.type === 'FACILITY_BILL';
                        const isRx = event.type === 'PRESCRIPTION';
                        const isApt = event.type === 'APPOINTMENT';
                        const isFu = event.type === 'FOLLOW_UP';

                        return (
                          <div
                            key={event.id}
                            style={{
                              background: 'white',
                              borderRadius: '12px',
                              border: '1px solid var(--border)',
                              padding: '1rem 1.25rem',
                              display: 'flex',
                              gap: '1rem',
                              alignItems: 'flex-start',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              background: isFacility ? '#f3e8ff' : isReceipt ? '#e0f2fe' : isRx ? '#dcfce7' : isApt ? '#fef3c7' : '#ffe4e6',
                              color: isFacility ? '#7e22ce' : isReceipt ? '#0284c7' : isRx ? '#16a34a' : isApt ? '#d97706' : '#e11d48'
                            }}>
                              {isFacility && <Bed size={18} />}
                              {isReceipt && <FileText size={18} />}
                              {isRx && <Stethoscope size={18} />}
                              {isApt && <Calendar size={18} />}
                              {isFu && <Clock size={18} />}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{event.title}</strong>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: isFacility ? '#f3e8ff' : isReceipt ? '#e0f2fe' : isRx ? '#dcfce7' : '#f1f5f9',
                                    color: isFacility ? '#7e22ce' : isReceipt ? '#0284c7' : isRx ? '#16a34a' : '#475569'
                                  }}>
                                    {event.type.replace('_', ' ')}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                  {event.date}
                                </span>
                              </div>

                              {event.doctorName && (
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                  Attending Doctor: <strong>Dr. {event.doctorName}</strong>
                                </div>
                              )}

                              <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '6px' }}>
                                {event.summary}
                              </div>

                              {/* Action Buttons for Receipts */}
                              {(isReceipt || isFacility) && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => onPrint([event.data])}
                                    style={{
                                      background: '#f8fafc',
                                      border: '1px solid var(--border)',
                                      borderRadius: '6px',
                                      padding: '3px 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: '#475569'
                                    }}
                                  >
                                    <Printer size={12} /> Print
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenWhatsAppModal(event.data)}
                                    style={{
                                      background: '#f0fdf4',
                                      border: '1px solid #bbf7d0',
                                      borderRadius: '6px',
                                      padding: '3px 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: '#16a34a'
                                    }}
                                  >
                                    <MessageSquare size={12} /> WhatsApp
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TAB 2: INVOICES & RECEIPTS */}
                  {historyTab === 'receipts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {patientHistoryData.receipts.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>No billing receipts found.</p>
                      ) : (
                        patientHistoryData.receipts.map(r => (
                          <div
                            key={r.id}
                            style={{
                              background: 'white',
                              borderRadius: '12px',
                              border: '1px solid var(--border)',
                              padding: '1.25rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem', marginBottom: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Receipt #{r.receiptNumber}</span>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: r.billType === 'FACILITY' ? '#f3e8ff' : '#e0f2fe',
                                  color: r.billType === 'FACILITY' ? '#7e22ce' : '#0284c7'
                                }}>
                                  {r.billType === 'FACILITY' ? `FACILITY ${r.roomNumber ? `• ${r.roomNumber}` : ''}` : 'OPD CONSULTATION'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📅 {r.date}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                              <span style={{ color: '#64748b' }}>Doctor: <strong>Dr. {r.doctorName}</strong></span>
                              <span className={`payment-badge ${(r.paymentMethod || 'CASH').toLowerCase()}`}>
                                {r.paymentMethod || 'CASH'}
                              </span>
                            </div>

                            {/* Line items preview */}
                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Billed Services</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {r.items?.map((item, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ color: '#334155' }}>• {item.description} {item.quantity ? `(${item.quantity} ${item.unit || ''})` : ''}</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{Number(item.amount || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                              <div>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Billed: </span>
                                <strong style={{ fontSize: '1.15rem', color: '#16a34a' }}>₹{Number(r.total || 0).toFixed(2)}</strong>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsAppModal(r)}
                                  className="btn-icon-xs whatsapp-btn"
                                  title="Send WhatsApp Receipt"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onPrint([r])}
                                  className="btn-icon-xs print-btn"
                                  title="Print Receipt"
                                >
                                  <Printer size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEdit(r)}
                                  className="btn-icon-xs edit-btn"
                                  title="Edit Receipt"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: PRESCRIPTIONS & RX */}
                  {historyTab === 'prescriptions' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {patientHistoryData.prescriptions.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>No clinical prescriptions found for this patient.</p>
                      ) : (
                        patientHistoryData.prescriptions.map(p => (
                          <div
                            key={p.id}
                            style={{
                              background: 'white',
                              borderRadius: '12px',
                              border: '1px solid var(--border)',
                              padding: '1.25rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem', marginBottom: '0.75rem' }}>
                              <div>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Clinical Prescription</span>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Attending Physician: <strong>Dr. {p.doctorName}</strong></div>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📅 {p.date}</span>
                            </div>

                            {/* Diagnosis & Symptoms */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                              {p.symptoms && (
                                <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Symptoms / Complaints</div>
                                  <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '2px' }}>{p.symptoms}</div>
                                </div>
                              )}
                              {p.diagnosis && (
                                <div style={{ background: '#eff6ff', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Clinical Diagnosis</div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginTop: '2px' }}>{p.diagnosis}</div>
                                </div>
                              )}
                            </div>

                            {/* Medicines Table */}
                            {p.medicines && p.medicines.length > 0 && (
                              <div style={{ marginBottom: '0.85rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                                  Prescribed Medications ({p.medicines.length})
                                </div>
                                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                                      <tr>
                                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Medicine</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Dosage</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Duration</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Instructions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.medicines.map((m, mIdx) => (
                                        <tr key={mIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0f172a' }}>{m.name}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'center', color: '#0284c7', fontWeight: 700 }}>{m.dosage}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b' }}>{m.duration}</td>
                                          <td style={{ padding: '6px 10px', color: '#64748b', fontSize: '0.75rem' }}>{m.instructions || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Advice & Follow-up */}
                            {(p.notes || p.followUpDate) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem' }}>
                                {p.notes && <span style={{ color: '#475569' }}>Advice: {p.notes}</span>}
                                {p.followUpDate && <span style={{ color: '#d97706', fontWeight: 700 }}>Next Visit: {p.followUpDate}</span>}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: INPATIENT STAYS */}
                  {historyTab === 'facility' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {patientHistoryData.receipts.filter(r => r.billType === 'FACILITY').length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                          <Bed size={32} style={{ color: '#94a3b8', margin: '0 auto 0.5rem auto' }} />
                          <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>No Inpatient or Facility Stays on record</p>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>This patient has only visited for Outpatient consultations.</span>
                        </div>
                      ) : (
                        patientHistoryData.receipts.filter(r => r.billType === 'FACILITY').map(f => (
                          <div
                            key={f.id}
                            style={{
                              background: 'white',
                              borderRadius: '12px',
                              border: '1px solid #e9d5ff',
                              padding: '1.25rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3e8ff', paddingBottom: '0.65rem', marginBottom: '0.75rem' }}>
                              <div>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#7e22ce' }}>Inpatient Bill #{f.receiptNumber}</span>
                                <span style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#f3e8ff', color: '#7e22ce', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  Room/Bed: {f.roomNumber || 'Assigned Ward'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📅 {f.date}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem', fontSize: '0.82rem' }}>
                              <div>Admission: <strong>{f.admissionDate || f.date}</strong></div>
                              <div>Discharge: <strong>{f.dischargeDate || 'Completed'}</strong></div>
                            </div>

                            {/* Itemized charges */}
                            <div style={{ background: '#faf5ff', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', marginBottom: '4px' }}>Itemized Facility Breakdown</div>
                              {f.items?.map((it, itIdx) => (
                                <div key={itIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '2px 0' }}>
                                  <span>• {it.description} {it.quantity ? `(${it.quantity} ${it.unit || ''})` : ''}</span>
                                  <strong>₹{Number(it.amount || 0).toFixed(2)}</strong>
                                </div>
                              ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px dashed #e9d5ff' }}>
                              <div>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Net Total: </span>
                                <strong style={{ fontSize: '1.15rem', color: '#7e22ce' }}>₹{Number(f.total || 0).toFixed(2)}</strong>
                                {f.advancePaid ? (
                                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>
                                    (Advance paid: ₹{f.advancePaid})
                                  </span>
                                ) : null}
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsAppModal(f)}
                                  className="btn-icon-xs whatsapp-btn"
                                  title="Send Bill via WhatsApp"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onPrint([f])}
                                  className="btn-icon-xs print-btn"
                                  title="Print Bill"
                                >
                                  <Printer size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 5: APPOINTMENTS & FOLLOW-UPS */}
                  {historyTab === 'appointments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Appointments section */}
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={16} className="text-primary" /> Booked Appointments ({patientHistoryData.appointments.length})
                        </h4>
                        {patientHistoryData.appointments.length === 0 ? (
                          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>No scheduled appointments on record.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                            {patientHistoryData.appointments.map(a => (
                              <div key={a.id} style={{ background: 'white', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                                    {a.appointmentDate} at {a.appointmentTime}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                    Doctor: Dr. {a.doctorName} {a.notes ? `• ${a.notes}` : ''}
                                  </div>
                                </div>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: a.status === 'CONFIRMED' ? '#dcfce7' : a.status === 'COMPLETED' ? '#e0f2fe' : '#fef3c7',
                                  color: a.status === 'CONFIRMED' ? '#166534' : a.status === 'COMPLETED' ? '#0369a1' : '#b45309'
                                }}>
                                  {a.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Follow-ups section */}
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={16} style={{ color: '#d97706' }} /> Follow-up Revisits ({patientHistoryData.followUps.length})
                        </h4>
                        {patientHistoryData.followUps.length === 0 ? (
                          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>No follow-up visits recorded.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {patientHistoryData.followUps.map(f => (
                              <div key={f.id} style={{ background: 'white', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                                    Revisit Date: {f.scheduledDate}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                    Dr. {f.doctorName} {f.notes ? `• ${f.notes}` : ''}
                                  </div>
                                </div>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: f.status === 'ATTENDED' ? '#dcfce7' : f.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                                  color: f.status === 'ATTENDED' ? '#166534' : f.status === 'PENDING' ? '#b45309' : '#b91c1c'
                                }}>
                                  {f.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.85rem 1.5rem',
              background: '#f8fafc',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Patient ID: <strong>{selectedPatientForHistory.patientId || 'Unassigned'}</strong> • Verified against local SQLite database
              </span>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setSelectedPatientForHistory(null)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTab;
