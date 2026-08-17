import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Filter, Search, Calendar, Users, FileText,
  Printer, Edit2, Trash2, CheckCircle
} from 'lucide-react';
import { type Receipt, storage } from '../../lib/storage';

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
  const [localReceipts, setLocalReceipts] = useState<Receipt[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  // Reset pagination limit whenever filters change
  useEffect(() => {
    setDisplayLimit(INITIAL_LIMIT);
  }, [startDate, endDate, searchQuery]);

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
              onClick={() => { setStartDate(''); setEndDate(''); setSearchQuery(''); }}
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
                placeholder="Search patient, phone, receipt..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-input-wrapper date-picker-group">
              <span className="date-field-label">From</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="date-input"
              />
            </div>
            <div className="filter-input-wrapper date-picker-group">
              <span className="date-field-label">To</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
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
          <span className="summary-value">₹{
            localReceipts.reduce((acc, r) => {
              const rTotal = typeof r.total === 'number' ? r.total : parseFloat(r.total as any) || 0;
              return acc + (r.paymentMethod !== 'FREE' ? rTotal : 0);
            }, 0)
          }</span>
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
                              </td>
                              <td>
                                <div className="r-name">{r.patientName}</div>
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
    </div>
  );
};

export default HistoryTab;
