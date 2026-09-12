import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Clock, CheckCircle2,
  Search, X, Plus, ChevronDown, ChevronRight,
  Boxes, ShieldAlert, RefreshCw, Send
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import '../../styles/tabs/StockIndentingTab.css';
import {
  storage,
  notifyDataChanged,
  type HospitalIndent,
  type HospitalIndentDepartment,
  type HospitalIndentPriority,
  type Medicine,
  type MedicineBatch
} from '../../lib/storage';

export const StockIndentingTab: React.FC = () => {
  const toast = useToast();

  const [indents, setIndents] = useState<HospitalIndent[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expandable row state
  const [expandedIndentIds, setExpandedIndentIds] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showFulfillModal, setShowFulfillModal] = useState<boolean>(false);
  const [selectedIndentForFulfill, setSelectedIndentForFulfill] = useState<HospitalIndent | null>(null);

  // New Indent Form State
  const [newIndentForm, setNewIndentForm] = useState<{
    departmentType: HospitalIndentDepartment;
    sourceLocation: string;
    requestedBy: string;
    priority: HospitalIndentPriority;
    notes: string;
  }>({
    departmentType: 'WARD',
    sourceLocation: 'General Ward A',
    requestedBy: 'Staff Nurse In-Charge',
    priority: 'ROUTINE',
    notes: ''
  });

  const [newIndentItems, setNewIndentItems] = useState<{
    medicineId?: string;
    itemName: string;
    itemCategory: string;
    requestedQuantity: number;
    notes?: string;
    isCustom?: boolean;
  }[]>([
    { itemName: '', itemCategory: 'Medicine', requestedQuantity: 10, isCustom: false }
  ]);

  // Fulfillment Form State
  const [fulfillmentItems, setFulfillmentItems] = useState<{
    itemId: string;
    medicineId?: string;
    itemName: string;
    requestedQuantity: number;
    issuedQuantity: number;
    batchNumber?: string;
  }[]>([]);
  const [fulfilledBy, setFulfilledBy] = useState<string>('Lead Pharmacist');

  const loadData = async () => {
    setLoading(true);
    try {
      const [indList, medList, batchList] = await Promise.all([
        storage.getHospitalIndents({
          departmentType: departmentFilter !== 'ALL' ? departmentFilter : undefined,
          priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined
        }),
        storage.getMedicines ? storage.getMedicines() : [],
        storage.getMedicineBatches ? storage.getMedicineBatches() : []
      ]);
      setIndents(indList);
      setMedicines(medList);
      setBatches(batchList);
    } catch (e) {
      console.error('Failed to load stock indents:', e);
      toast.show('Failed to load departmental requisitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s auto-refresh for LAN sync
    const handleLiveSync = (e: CustomEvent) => {
      if (!e.detail?.dataType || e.detail.dataType === 'indents' || e.detail.dataType === 'medicines') {
        loadData();
      }
    };
    window.addEventListener('buvora-data-updated', handleLiveSync as EventListener);
    return () => {
      clearInterval(interval);
      window.removeEventListener('buvora-data-updated', handleLiveSync as EventListener);
    };
  }, [departmentFilter, priorityFilter, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedIndentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Metrics
  const metrics = useMemo(() => {
    return {
      pending: indents.filter(i => i.status === 'PENDING').length,
      urgent: indents.filter(i => i.priority === 'URGENT' || i.priority === 'STAT_EMERGENCY').length,
      completed: indents.filter(i => i.status === 'COMPLETED').length,
      departments: new Set(indents.map(i => i.sourceLocation)).size
    };
  }, [indents]);

  // Filtered indents
  const filteredIndents = useMemo(() => {
    return indents.filter(i => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = i.indentNumber.toLowerCase().includes(q);
        const matchLoc = i.sourceLocation.toLowerCase().includes(q);
        const matchReq = i.requestedBy.toLowerCase().includes(q);
        const matchItem = i.items?.some(it => it.itemName.toLowerCase().includes(q));
        if (!matchNum && !matchLoc && !matchReq && !matchItem) return false;
      }
      return true;
    });
  }, [indents, searchQuery]);

  // Handle "+ Add Row" in create modal
  const handleAddItemRow = () => {
    setNewIndentItems(prev => [
      ...prev,
      { itemName: '', itemCategory: 'Medicine', requestedQuantity: 5, isCustom: false }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setNewIndentItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemSelect = (idx: number, medId: string) => {
    const med = medicines.find(m => m.id === medId);
    if (!med) return;
    setNewIndentItems(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        isCustom: false,
        medicineId: med.id,
        itemName: med.name,
        itemCategory: med.category || 'Medicine'
      };
      return copy;
    });
  };

  // Submit New Indent
  const handleCreateIndent = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = newIndentItems.filter(it => it.itemName.trim().length > 0);
    if (validItems.length === 0) {
      toast.show('Please add at least one item to requisition', 'warning');
      return;
    }

    try {
      const res = await storage.saveHospitalIndent(newIndentForm, validItems);
      notifyDataChanged('indents');
      toast.show(`Requisition ${res.indentNumber} created successfully!`, 'success');
      setShowCreateModal(false);
      setNewIndentItems([{ itemName: '', itemCategory: 'Medicine', requestedQuantity: 10, isCustom: false }]);
      loadData();
    } catch (e) {
      toast.show('Failed to create requisition', 'error');
    }
  };

  // Open Fulfill Modal
  const handleOpenFulfillModal = (indent: HospitalIndent) => {
    setSelectedIndentForFulfill(indent);
    const mapped = (indent.items || []).map(it => {
      const itemBatches = batches.filter(b => b.medicineId === it.medicineId && b.quantity > 0);
      const firstBatch = itemBatches.length > 0 ? itemBatches[0].batchNumber : 'DIRECT-DISPATCH';
      const remainingQty = Math.max(0, it.requestedQuantity - (it.issuedQuantity || 0));
      return {
        itemId: it.id,
        medicineId: it.medicineId,
        itemName: it.itemName,
        requestedQuantity: it.requestedQuantity,
        issuedQuantity: remainingQty,
        batchNumber: firstBatch
      };
    });
    setFulfillmentItems(mapped);
    setShowFulfillModal(true);
  };

  // Direct 1-Click Complete Indent
  const handleDirectCompleteIndent = async (indent: HospitalIndent) => {
    try {
      await storage.completeHospitalIndent(indent.id, fulfilledBy);
      notifyDataChanged('indents');
      notifyDataChanged('medicines');
      toast.show(`Requisition ${indent.indentNumber} marked COMPLETED!`, 'success');
      loadData();
    } catch (e) {
      toast.show('Failed to complete requisition', 'error');
    }
  };

  // Cancel Requisition
  const handleCancelIndent = async (indent: HospitalIndent) => {
    if (!confirm(`Are you sure you want to cancel requisition ${indent.indentNumber}?`)) return;
    try {
      await storage.cancelHospitalIndent(indent.id, 'Cancelled by Pharmacy Staff');
      notifyDataChanged('indents');
      toast.show(`Requisition ${indent.indentNumber} cancelled`, 'info');
      loadData();
    } catch (e) {
      toast.show('Failed to cancel requisition', 'error');
    }
  };

  // Submit Issue Indent
  const handleFulfillIndent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIndentForFulfill) return;

    try {
      await storage.issueHospitalIndent(
        selectedIndentForFulfill.id,
        fulfillmentItems,
        fulfilledBy
      );
      notifyDataChanged('indents');
      notifyDataChanged('medicines');
      toast.show(`Requisition ${selectedIndentForFulfill.indentNumber} issued & updated!`, 'success');
      setShowFulfillModal(false);
      loadData();
    } catch (e) {
      toast.show('Failed to issue requisition', 'error');
    }
  };

  return (
    <div className="indenting-container">
      {/* ── KPI Summary Cards ───────────────────────────────────────────────── */}
      <div className="indenting-stats-grid">
        <div className="indenting-stat-card">
          <div className="indenting-stat-icon amber">
            <Clock size={22} />
          </div>
          <div className="indenting-stat-info">
            <span className="indenting-stat-label">Pending Pharmacy Indents</span>
            <span className="indenting-stat-value">{metrics.pending}</span>
          </div>
        </div>

        <div className="indenting-stat-card">
          <div className="indenting-stat-icon rose">
            <ShieldAlert size={22} />
          </div>
          <div className="indenting-stat-info">
            <span className="indenting-stat-label">Urgent & STAT Orders</span>
            <span className="indenting-stat-value">{metrics.urgent}</span>
          </div>
        </div>

        <div className="indenting-stat-card">
          <div className="indenting-stat-icon emerald">
            <CheckCircle2 size={22} />
          </div>
          <div className="indenting-stat-info">
            <span className="indenting-stat-label">Fulfilled Orders</span>
            <span className="indenting-stat-value">{metrics.completed}</span>
          </div>
        </div>

        <div className="indenting-stat-card">
          <div className="indenting-stat-icon blue">
            <Boxes size={22} />
          </div>
          <div className="indenting-stat-info">
            <span className="indenting-stat-label">Active Wards / Units</span>
            <span className="indenting-stat-value">{metrics.departments}</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="indenting-filter-bar">
        <div className="indenting-filter-left">
          <div className="indenting-search-box">
            <Search className="indenting-search-icon" size={14} />
            <input
              type="text"
              className="indenting-filter-input"
              placeholder="Search indents, items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="indenting-clear-search" onClick={() => setSearchQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>

          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dept:</label>
          <select
            className="indenting-filter-select"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            <option value="WARD">Inpatient Ward</option>
            <option value="OT">Operation Theatre</option>
            <option value="ICU">Intensive Care Unit</option>
            <option value="EMERGENCY">Emergency / Casualty</option>
            <option value="LAB">Pathology Lab</option>
            <option value="DIALYSIS">Dialysis Unit</option>
          </select>

          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Priority:</label>
          <select
            className="indenting-filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
            <option value="STAT_EMERGENCY">STAT / Emergency</option>
          </select>

          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</label>
          <select
            className="indenting-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_ISSUED">Partially Issued</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <button className="payout-btn-secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        <button className="indent-btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={15} /> + Create Indent Requisition
        </button>
      </div>

      {/* ── Indents Table ───────────────────────────────────────────────────── */}
      <div className="indent-table-container">
        <table className="indent-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Indent #</th>
              <th>Source Location</th>
              <th>Target Dept</th>
              <th>Requested By</th>
              <th>Priority</th>
              <th>Items Count</th>
              <th>Requested At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && indents.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#0284c7', margin: '0 auto 8px', display: 'block' }} />
                  <div>Loading stock indents &amp; pharmacy catalog...</div>
                </td>
              </tr>
            ) : filteredIndents.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No stock indent requisitions found matching current filters.
                </td>
              </tr>
            ) : (
              filteredIndents.map(indent => {
                const isExpanded = expandedIndentIds.has(indent.id);
                return (
                  <React.Fragment key={indent.id}>
                    <tr className={isExpanded ? 'expanded-header' : ''}>
                      <td>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                          onClick={() => toggleExpand(indent.id)}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td>
                        <strong>{indent.indentNumber}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{indent.sourceLocation}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{indent.departmentType}</div>
                      </td>
                      <td>{indent.targetDepartment}</td>
                      <td>{indent.requestedBy}</td>
                      <td>
                        {indent.priority === 'STAT_EMERGENCY' && <span className="badge-priority-stat">STAT Emergency</span>}
                        {indent.priority === 'URGENT' && <span className="badge-priority-urgent">Urgent</span>}
                        {indent.priority === 'ROUTINE' && <span className="badge-priority-routine">Routine</span>}
                      </td>
                      <td>
                        <strong>{indent.items?.length || 0} items</strong>
                      </td>
                      <td>
                        {indent.requestedAt ? format(new Date(indent.requestedAt), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                      </td>
                      <td>
                        {indent.status === 'COMPLETED' && <span className="badge-indent-completed">Completed</span>}
                        {indent.status === 'PARTIALLY_ISSUED' && <span className="badge-indent-partial">Partially Issued</span>}
                        {indent.status === 'PENDING' && <span className="badge-indent-pending">Pending</span>}
                      </td>
                      <td>
                        {indent.status === 'COMPLETED' ? (
                          <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Fulfilled by {indent.fulfilledBy || 'Pharmacy'}
                          </span>
                        ) : indent.status === 'CANCELLED' ? (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                            Cancelled
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="indent-btn-primary"
                              style={{ height: '28px !important', padding: '0 0.6rem !important', fontSize: '0.75rem !important' }}
                              onClick={() => handleOpenFulfillModal(indent)}
                              title="Open batch assignment & dispensing modal"
                            >
                              <Send size={12} /> Issue &amp; Fulfill
                            </button>

                            <button
                              type="button"
                              style={{
                                background: '#dcfce7',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                padding: '0 0.55rem',
                                height: '28px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onClick={() => handleDirectCompleteIndent(indent)}
                              title="1-Click Mark Completed & Delivered"
                            >
                              <CheckCircle2 size={13} /> Complete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable items subtable */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} style={{ padding: '0.75rem 1.5rem', background: '#f8fafc' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                            Requisition Items Breakdown:
                          </div>
                          <table className="indent-items-subtable">
                            <thead>
                              <tr>
                                <th>Item / Drug Name</th>
                                <th>Category</th>
                                <th>Requested Qty</th>
                                <th>Issued Qty</th>
                                <th>Fulfilled Batch #</th>
                                <th>Item Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {indent.items?.map(it => (
                                <tr key={it.id}>
                                  <td style={{ fontWeight: 600 }}>{it.itemName}</td>
                                  <td>{it.itemCategory}</td>
                                  <td>{it.requestedQuantity}</td>
                                  <td>
                                    <strong>{it.issuedQuantity}</strong> / {it.requestedQuantity}
                                  </td>
                                  <td>
                                    {it.batchNumber ? (
                                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0369a1' }}>
                                        {it.batchNumber}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)' }}>--</span>
                                    )}
                                  </td>
                                  <td>
                                    {it.issuedQuantity >= it.requestedQuantity ? (
                                      <span style={{ color: '#15803d', fontWeight: 600 }}>Fully Issued</span>
                                    ) : it.issuedQuantity > 0 ? (
                                      <span style={{ color: '#0369a1', fontWeight: 600 }}>Partial</span>
                                    ) : (
                                      <span style={{ color: '#b45309' }}>Pending</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL: CREATE INDENT REQUISITION ───────────────────────────────── */}
      {showCreateModal && (
        <div className="indent-modal-overlay">
          <div className="indent-modal-box">
            <div className="indent-modal-header">
              <h3>Create Departmental Stock Requisition</h3>
              <button className="indenting-clear-search" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateIndent}>
              <div className="indent-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Source Department</label>
                    <select
                      className="indenting-filter-select"
                      value={newIndentForm.departmentType}
                      onChange={(e: any) => setNewIndentForm({ ...newIndentForm, departmentType: e.target.value })}
                    >
                      <option value="WARD">Inpatient Ward</option>
                      <option value="OT">Operation Theatre (OT)</option>
                      <option value="ICU">Intensive Care Unit (ICU)</option>
                      <option value="EMERGENCY">Emergency / Casualty</option>
                      <option value="LAB">Pathology Lab</option>
                      <option value="DIALYSIS">Dialysis Unit</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ward / Room / Station Name</label>
                    <input
                      type="text"
                      className="indenting-filter-input"
                      value={newIndentForm.sourceLocation}
                      onChange={(e) => setNewIndentForm({ ...newIndentForm, sourceLocation: e.target.value })}
                      placeholder="e.g. Ward 3B, OT-2, Trauma Bed 1"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Requested By (Nurse/Staff Name)</label>
                    <input
                      type="text"
                      className="indenting-filter-input"
                      value={newIndentForm.requestedBy}
                      onChange={(e) => setNewIndentForm({ ...newIndentForm, requestedBy: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Priority</label>
                    <select
                      className="indenting-filter-select"
                      value={newIndentForm.priority}
                      onChange={(e: any) => setNewIndentForm({ ...newIndentForm, priority: e.target.value })}
                    >
                      <option value="ROUTINE">Routine Stock Replenishment</option>
                      <option value="URGENT">Urgent (Within 1 Hour)</option>
                      <option value="STAT_EMERGENCY">STAT / Emergency (Immediate)</option>
                    </select>
                  </div>
                </div>

                {/* Items List */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Requested Consumables & Medicines</label>
                    <button
                      type="button"
                      className="payout-btn-secondary"
                      style={{ height: '28px !important', padding: '0 0.5rem !important', fontSize: '0.75rem !important' }}
                      onClick={handleAddItemRow}
                    >
                      <Plus size={12} /> Add Item Row
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {newIndentItems.map((row, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 30px', gap: '0.5rem', alignItems: 'center' }}>
                        <div>
                          {!row.isCustom && medicines.length > 0 ? (
                            <select
                              className="indenting-filter-select"
                              style={{ width: '100% !important' }}
                              value={row.medicineId || ''}
                              onChange={(e) => {
                                if (e.target.value === 'CUSTOM') {
                                  setNewIndentItems(prev => {
                                    const copy = [...prev];
                                    copy[idx] = {
                                      ...copy[idx],
                                      isCustom: true,
                                      medicineId: undefined,
                                      itemName: '',
                                      itemCategory: 'Consumable'
                                    };
                                    return copy;
                                  });
                                } else {
                                  handleItemSelect(idx, e.target.value);
                                }
                              }}
                            >
                              <option value="">-- Select Pharmacy Drug --</option>
                              {medicines.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.category || 'Medicine'})</option>
                              ))}
                              <option value="CUSTOM">✏️ + Custom / Surgical Consumable...</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="indenting-filter-input"
                                placeholder="Type consumable / item name..."
                                value={row.itemName}
                                autoFocus={row.isCustom}
                                onChange={(e) => {
                                  const copy = [...newIndentItems];
                                  copy[idx].itemName = e.target.value;
                                  setNewIndentItems(copy);
                                }}
                                required
                                style={{ flex: 1 }}
                              />
                              {medicines.length > 0 && (
                                <button
                                  type="button"
                                  title="Switch to Pharmacy Drug dropdown"
                                  style={{
                                    background: 'var(--bg-secondary, #f1f5f9)',
                                    border: '1px solid var(--border, #cbd5e1)',
                                    borderRadius: '6px',
                                    padding: '6px 8px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: 'var(--primary, #0284c7)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onClick={() => {
                                    setNewIndentItems(prev => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], isCustom: false, medicineId: '', itemName: '' };
                                      return copy;
                                    });
                                  }}
                                >
                                  Drug List
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            className="indenting-filter-input"
                            placeholder="Category"
                            value={row.itemCategory}
                            onChange={(e) => {
                              const copy = [...newIndentItems];
                              copy[idx].itemCategory = e.target.value;
                              setNewIndentItems(copy);
                            }}
                          />
                        </div>

                        <div>
                          <input
                            type="number"
                            className="indenting-filter-input"
                            placeholder="Qty"
                            min="1"
                            value={row.requestedQuantity}
                            onChange={(e) => {
                              const copy = [...newIndentItems];
                              copy[idx].requestedQuantity = Number(e.target.value);
                              setNewIndentItems(copy);
                            }}
                            required
                          />
                        </div>

                        <div>
                          {newIndentItems.length > 1 && (
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                              onClick={() => handleRemoveItemRow(idx)}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Justification / Notes</label>
                  <input
                    type="text"
                    className="indenting-filter-input"
                    placeholder="e.g. Required for OT Case #12 or ward stock replenishment"
                    value={newIndentForm.notes}
                    onChange={(e) => setNewIndentForm({ ...newIndentForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="indent-modal-footer">
                <button type="button" className="payout-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="indent-btn-primary">Submit Requisition</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: FULFILL / ISSUE REQUISITION ──────────────────────────────── */}
      {showFulfillModal && selectedIndentForFulfill && (
        <div className="indent-modal-overlay">
          <div className="indent-modal-box">
            <div className="indent-modal-header">
              <h3>Fulfill Indent #{selectedIndentForFulfill.indentNumber} ({selectedIndentForFulfill.sourceLocation})</h3>
              <button className="indenting-clear-search" onClick={() => setShowFulfillModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleFulfillIndent}>
              <div className="indent-modal-body">
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Assign available medicine batch numbers and specify quantities issued from central pharmacy.
                  Stock will be automatically decremented from pharmacy inventory.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {fulfillmentItems.map((it, idx) => {
                    const availableBatches = batches.filter(b => b.medicineId === it.medicineId && b.quantity > 0);
                    return (
                      <div key={it.itemId} style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <strong style={{ fontSize: '0.88rem' }}>{it.itemName}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Requested: {it.requestedQuantity}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fulfillment Batch</label>
                            <select
                              className="indenting-filter-select"
                              style={{ width: '100% !important' }}
                              value={it.batchNumber || ''}
                              onChange={(e) => {
                                const copy = [...fulfillmentItems];
                                copy[idx].batchNumber = e.target.value;
                                setFulfillmentItems(copy);
                              }}
                            >
                              <option value="">-- Select Pharmacy Batch --</option>
                              {availableBatches.map(b => (
                                <option key={b.id} value={b.batchNumber}>
                                  {b.batchNumber} (Avail: {b.quantity}, Exp: {b.expiryDate || 'N/A'})
                                </option>
                              ))}
                              {availableBatches.length === 0 && (
                                <option value="GENERAL-STOCK">Direct Department Issue (Non-batch)</option>
                              )}
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantity Issued</label>
                            <input
                              type="number"
                              className="indenting-filter-input"
                              min="0"
                              max={it.requestedQuantity}
                              value={it.issuedQuantity}
                              onChange={(e) => {
                                const copy = [...fulfillmentItems];
                                copy[idx].issuedQuantity = Number(e.target.value);
                                setFulfillmentItems(copy);
                              }}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fulfilled By (Pharmacist Name)</label>
                  <input
                    type="text"
                    className="indenting-filter-input"
                    value={fulfilledBy}
                    onChange={(e) => setFulfilledBy(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="indent-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <button
                    type="button"
                    style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.45rem 0.8rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      if (selectedIndentForFulfill) {
                        setShowFulfillModal(false);
                        handleCancelIndent(selectedIndentForFulfill);
                      }
                    }}
                  >
                    Cancel Requisition
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" className="payout-btn-secondary" onClick={() => setShowFulfillModal(false)}>Close</button>
                  <button
                    type="button"
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    onClick={() => {
                      if (selectedIndentForFulfill) {
                        setShowFulfillModal(false);
                        handleDirectCompleteIndent(selectedIndentForFulfill);
                      }
                    }}
                  >
                    <CheckCircle2 size={14} /> Mark Full Order Delivered
                  </button>
                  <button type="submit" className="indent-btn-primary">Confirm &amp; Deduct Pharmacy Stock</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
