import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  ReceiptText, Search, Plus, Download, Trash2, Edit3,
  Calendar, Wallet, Zap, Package, X, CreditCard, RefreshCw
} from 'lucide-react';
import { storage, type Expense, type ExpenseCategory } from '../../lib/storage';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

const CATEGORIES: { label: string; value: ExpenseCategory; color: string; bg: string }[] = [
  { label: 'Utilities & Power', value: 'Utilities & Power', color: '#b45309', bg: '#fef3c7' },
  { label: 'Medical Supplies', value: 'Medical Supplies', color: '#0284c7', bg: '#e0f2fe' },
  { label: 'Rent & Premises', value: 'Rent & Premises', color: '#7c3aed', bg: '#ede9fe' },
  { label: 'Equipment', value: 'Equipment', color: '#0369a1', bg: '#e0f2fe' },
  { label: 'Marketing & Software', value: 'Marketing & Software', color: '#2563eb', bg: '#dbeafe' },
  { label: 'Taxes & Licenses', value: 'Taxes & Licenses', color: '#475569', bg: '#f1f5f9' },
  { label: 'Miscellaneous', value: 'Miscellaneous', color: '#64748b', bg: '#f8fafc' },
];

export const ExpensesTab: React.FC = () => {
  const confirm = useConfirm();
  const toast = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form Fields matching user layout
  const [formVendorTitle, setFormVendorTitle] = useState('');
  const [formBillNumber, setFormBillNumber] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Utilities & Power');
  const [formPaymentMode, setFormPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD'>('CASH');
  const [formTotalAmount, setFormTotalAmount] = useState('');
  const [formPaidAmount, setFormPaidAmount] = useState('0');
  const [formBillDate, setFormBillDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formDueDate, setFormDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formVendorPhone, setFormVendorPhone] = useState('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getExpenses();
      setExpenses(data);
    } catch (e) {
      console.error(e);
      toast('Failed to load clinic expenses.', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const openNewModal = () => {
    setEditingExpense(null);
    setFormVendorTitle('');
    setFormBillNumber('');
    setFormCategory('Utilities & Power');
    setFormPaymentMode('CASH');
    setFormTotalAmount('');
    setFormPaidAmount('0');
    setFormBillDate(format(new Date(), 'yyyy-MM-dd'));
    setFormDueDate(format(new Date(), 'yyyy-MM-dd'));
    setFormVendorPhone('');
    setFormIsRecurring(false);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormVendorTitle(expense.title || expense.paidTo || '');
    setFormBillNumber(expense.billNumber || expense.id || '');
    setFormCategory((expense.category as ExpenseCategory) || 'Utilities & Power');
    setFormPaymentMode((expense.paymentMode as any) || 'CASH');
    setFormTotalAmount(String(expense.amount || ''));
    setFormPaidAmount(String(expense.paidAmount !== undefined ? expense.paidAmount : expense.amount || '0'));
    setFormBillDate(expense.date || format(new Date(), 'yyyy-MM-dd'));
    setFormDueDate(expense.dueDate || expense.date || format(new Date(), 'yyyy-MM-dd'));
    setFormVendorPhone(expense.vendorPhone || '');
    setFormIsRecurring(Boolean(expense.isRecurring));
    setFormNotes(expense.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVendorTitle.trim()) {
      toast('Please enter the Vendor .', { type: 'error' });
      return;
    }
    const numTotal = parseFloat(formTotalAmount);
    if (isNaN(numTotal) || numTotal <= 0) {
      toast('Please enter a valid Total Amount.', { type: 'error' });
      return;
    }

    const numPaid = parseFloat(formPaidAmount) || 0;

    let computedStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PAID';
    if (numPaid >= numTotal) {
      computedStatus = 'PAID';
    } else if (numPaid > 0) {
      computedStatus = 'PARTIAL';
    } else {
      computedStatus = 'PENDING';
    }

    try {
      const expenseData: Expense = {
        id: editingExpense ? editingExpense.id : formBillNumber.trim() || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
        title: formVendorTitle.trim(),
        paidTo: formVendorTitle.trim(),
        billNumber: formBillNumber.trim(),
        category: formCategory,
        amount: numTotal,
        paidAmount: numPaid,
        date: formBillDate || format(new Date(), 'yyyy-MM-dd'),
        dueDate: formDueDate || formBillDate,
        vendorPhone: formVendorPhone.trim(),
        isRecurring: formIsRecurring ? 1 : 0,
        status: computedStatus,
        paymentMode: formPaymentMode,
        notes: formNotes.trim(),
        createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
      };

      await storage.saveExpense(expenseData);
      toast(editingExpense ? 'Bill / Expense updated!' : 'Bill / Expense recorded successfully!', { type: 'success' });
      setIsModalOpen(false);
      loadExpenses();
    } catch (err: any) {
      console.error(err);
      toast(`Failed to save expense: ${err.message}`, { type: 'error' });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (await confirm(`Are you sure you want to delete the bill/expense record "${title}"?`, { isDanger: true })) {
      try {
        await storage.deleteExpense(id);
        toast('Record deleted.', { type: 'success' });
        loadExpenses();
      } catch (err: any) {
        toast(`Failed to delete: ${err.message}`, { type: 'error' });
      }
    }
  };

  // Metrics Calculation
  const currentMonthStr = format(new Date(), 'yyyy-MM');

  const metrics = useMemo(() => {
    let totalAll = 0;
    let totalMonth = 0;
    let totalUtilities = 0;
    let totalSupplies = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      totalAll += amt;

      if (exp.date && exp.date.startsWith(currentMonthStr)) {
        totalMonth += amt;
      }

      if (exp.category === 'Utilities & Power' || exp.category === 'Utilities') {
        totalUtilities += amt;
      } else if (exp.category === 'Medical Supplies') {
        totalSupplies += amt;
      }
    }

    return {
      totalAll,
      totalMonth,
      totalUtilities,
      totalSupplies,
      count: expenses.length,
    };
  }, [expenses, currentMonthStr]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesTitle = exp.title.toLowerCase().includes(q);
        const matchesVendor = exp.paidTo?.toLowerCase().includes(q);
        const matchesBill = exp.billNumber?.toLowerCase().includes(q);
        const matchesNotes = exp.notes?.toLowerCase().includes(q);
        const matchesPhone = exp.vendorPhone?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesVendor && !matchesBill && !matchesNotes && !matchesPhone) return false;
      }

      if (selectedCategory !== 'ALL' && exp.category !== selectedCategory) {
        return false;
      }

      if (selectedStatus !== 'ALL' && exp.status !== selectedStatus) {
        return false;
      }

      if (selectedPaymentMode !== 'ALL' && exp.paymentMode !== selectedPaymentMode) {
        return false;
      }

      if (startDate && exp.date < startDate) {
        return false;
      }

      if (endDate && exp.date > endDate) {
        return false;
      }

      return true;
    });
  }, [expenses, searchQuery, selectedCategory, selectedStatus, selectedPaymentMode, startDate, endDate]);

  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      toast('No expenses to export.', { type: 'error' });
      return;
    }
    storage.exportExpensesToCSV(filteredExpenses);
    toast('Expenses exported to CSV successfully!', { type: 'success' });
  };

  const getCategoryConfig = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat || c.label === cat) || {
      label: cat,
      color: '#475569',
      bg: '#f1f5f9',
    };
  };

  return (
    <div className="expenses-page tab-pane" style={{ paddingBottom: '2.5rem' }}>
      {/* Top Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          className="card"
          style={{
            padding: '1.15rem 1.25rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Expenses
            </span>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '6px', borderRadius: '8px' }}>
              <Wallet size={16} style={{ color: '#38bdf8' }} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
            ₹{metrics.totalAll.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {metrics.count} total records registered
          </span>
        </div>

        <div
          className="card"
          style={{
            padding: '1.15rem 1.25rem',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              This Month
            </span>
            <div style={{ background: '#ecfdf5', padding: '6px', borderRadius: '8px' }}>
              <Calendar size={16} style={{ color: '#059669' }} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
            ₹{metrics.totalMonth.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
            {format(new Date(), 'MMMM yyyy')} spend
          </span>
        </div>

        <div
          className="card"
          style={{
            padding: '1.15rem 1.25rem',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Utilities &amp; Power
            </span>
            <div style={{ background: '#fef3c7', padding: '6px', borderRadius: '8px' }}>
              <Zap size={16} style={{ color: '#d97706' }} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
            ₹{metrics.totalUtilities.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>
            Electricity, water &amp; telecom
          </span>
        </div>

        <div
          className="card"
          style={{
            padding: '1.15rem 1.25rem',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Clinic Supplies
            </span>
            <div style={{ background: '#e0f2fe', padding: '6px', borderRadius: '8px' }}>
              <Package size={16} style={{ color: '#0284c7' }} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
            ₹{metrics.totalSupplies.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
            Medicines &amp; consumables stock
          </span>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="card filter-card no-print" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        {/* Row 1: Search & Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search payee, invoice #, description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="sync-input-line"
              style={{ paddingLeft: '2.5rem', width: '100%', height: '38px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleExport}
              className="btn-secondary"
              style={{
                height: '38px',
                padding: '0 1rem',
                fontSize: '0.825rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid var(--border)',
                background: '#f8fafc',
                cursor: 'pointer',
                borderRadius: '8px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
              title="Export filtered bills to CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={openNewModal}
              className="btn-primary"
              style={{
                height: '38px',
                padding: '0 1.15rem',
                fontSize: '0.825rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                background: '#0284c7',
                color: 'white',
                border: 'none',
              }}
            >
              <Plus size={16} />
              <span>+ Record Expense</span>
            </button>
          </div>
        </div>

        {/* Row 2: All Categories, All Modes, All Status, and Date Range on the same line */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr auto',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{
              height: '38px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.825rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          <select
            value={selectedPaymentMode}
            onChange={e => setSelectedPaymentMode(e.target.value)}
            style={{
              height: '38px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.825rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Modes</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{
              height: '38px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.825rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partially Paid</option>
            <option value="PENDING">Pending / Due</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="sync-input-line"
              style={{ height: '38px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', width: '135px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              title="From date"
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>–</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="sync-input-line"
              style={{ height: '38px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', width: '135px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              title="To date"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0 4px' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="history-list no-print">
        {isLoading ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading clinic expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="card empty-state" style={{ textAlign: 'center', padding: '3.5rem' }}>
            <ReceiptText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No clinic bills or expenses recorded yet</h4>
            <p className="text-muted" style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem' }}>
              Track power &amp; electricity bills, clinic supplies, premises rent, and operational outlays.
            </p>
            <button onClick={openNewModal} className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}>
              + Record First Expense
            </button>
          </div>
        ) : (
          <div
            className="history-table-wrapper"
            style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table className="history-table" style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: '110px' }}>
                    Bill Date
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: '200px' }}>
                    Vendor
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: '150px' }}>
                    Category
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: '110px' }}>
                    Due Date
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: '120px' }}>
                    Status
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap', width: '120px' }}>
                    Total (₹)
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap', width: '120px' }}>
                    Paid (₹)
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: '130px' }}>
                    Payment Mode
                  </th>
                  <th style={{ padding: '0.9rem 1rem', background: '#f8fafc', fontWeight: 600, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', textAlign: 'center', width: '90px', whiteSpace: 'nowrap' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => {
                  const catCfg = getCategoryConfig(exp.category);
                  const isRecurring = Boolean(exp.isRecurring);
                  return (
                    <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {exp.date}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: 'var(--text-main)' }}>{exp.title}</strong>
                          {isRecurring && (
                            <span
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                fontSize: '0.68rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                              }}
                              title="Recurring Expense"
                            >
                              <RefreshCw size={10} /> Recurring
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {exp.billNumber && (
                            <span style={{ whiteSpace: 'nowrap' }}>Bill #: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{exp.billNumber}</span></span>
                          )}
                          {exp.vendorPhone && (
                            <span style={{ whiteSpace: 'nowrap' }}>📞 {exp.vendorPhone}</span>
                          )}
                        </div>
                        {exp.notes && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                            {exp.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                        <span
                          style={{
                            background: catCfg.bg,
                            color: catCfg.color,
                            padding: '0.25rem 0.65rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-block',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {catCfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', color: '#475569' }}>
                        {exp.dueDate || exp.date}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 10px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            display: 'inline-block',
                            whiteSpace: 'nowrap',
                            background:
                              exp.status === 'PAID' ? '#ecfdf5' : exp.status === 'PARTIAL' ? '#fef3c7' : '#fff7ed',
                            color:
                              exp.status === 'PAID' ? '#047857' : exp.status === 'PARTIAL' ? '#b45309' : '#c2410c',
                            border: `1px solid ${
                              exp.status === 'PAID' ? '#d1fae5' : exp.status === 'PARTIAL' ? '#fde68a' : '#ffedd5'
                            }`,
                          }}
                        >
                          {exp.status === 'PARTIAL' ? 'Partially Paid' : exp.status === 'PENDING' ? 'Pending' : 'Paid'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.95rem', fontWeight: 800, textAlign: 'right', color: '#0f172a', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                        ₹{Number(exp.amount).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: 600, textAlign: 'right', color: '#059669', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                        ₹{Number(exp.paidAmount !== undefined ? exp.paidAmount : exp.amount).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 9px', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {exp.paymentMode || 'CASH'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(exp)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#0284c7',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Edit Record"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(exp.id, exp.title)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Delete Record"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal Matching User Design */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '660px',
              width: '100%',
              background: '#ffffff',
              padding: '1.75rem 2rem',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              zIndex: 10000,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                  <CreditCard size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                  {editingExpense ? 'Edit Clinic Bill / Expense' : 'Record New Clinic Bill / Expense'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Row 1: Vendor/Payee/Title & Bill/Invoice # */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Vendor <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Badshah Computer"
                    value={formVendorTitle}
                    onChange={e => setFormVendorTitle(e.target.value)}
                    className="sync-input-line"
                    required
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Bill / Invoice #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EXP-5288"
                    value={formBillNumber}
                    onChange={e => setFormBillNumber(e.target.value)}
                    className="sync-input-line"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Row 2: Category, Total Amount, Paid Amount, Payment Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as ExpenseCategory)}
                    className="select-profile-dropdown"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Total Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formTotalAmount}
                    onChange={e => setFormTotalAmount(e.target.value)}
                    className="sync-input-line"
                    required
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={formPaidAmount}
                    onChange={e => setFormPaidAmount(e.target.value)}
                    className="sync-input-line"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Payment Mode
                  </label>
                  <select
                    value={formPaymentMode}
                    onChange={e => setFormPaymentMode(e.target.value as any)}
                    className="select-profile-dropdown"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Bill Date, Due Date, Vendor Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Bill Date
                  </label>
                  <input
                    type="date"
                    value={formBillDate}
                    onChange={e => setFormBillDate(e.target.value)}
                    className="sync-input-line"
                    required
                    style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    className="sync-input-line"
                    required
                    style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Vendor Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={formVendorPhone}
                    onChange={e => setFormVendorPhone(e.target.value)}
                    className="sync-input-line"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Row 4: Recurring Clinic Expense Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.9rem 1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <input
                  type="checkbox"
                  id="recurring-checkbox"
                  checked={formIsRecurring}
                  onChange={e => setFormIsRecurring(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="recurring-checkbox" style={{ cursor: 'pointer', lineHeight: 1.35 }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                    This is a recurring clinic expense
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    (e.g. Monthly Rent, Internet, Salaries)
                  </div>
                </label>
              </div>

              {/* Row 5: Notes / Description (Optional) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                  Notes / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Invoice for 50 box latex gloves and surgical masks"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="sync-input-line"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.6rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: '#475569',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    padding: '0.55rem 1.4rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  {editingExpense ? 'Save Changes' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesTab;
