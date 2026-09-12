import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  FlaskConical, Plus, Search, Filter, Clock,
  Printer, CheckCircle2, RefreshCw, Trash2, Edit3,
  Send, FileText, Check, Droplet, ClipboardList, ChevronDown
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import '../../styles/tabs/LaboratoryTab.css';
import {
  storage,
  notifyDataChanged,
  type LabTest,
  type LabTestParameter,
  type LabOrder,
  type LabOrderItem,
  type LabParameterResult,
  type LabDashboardMetrics,
  type Doctor,
  type Receipt,
  type GlobalPatientProfile,
  formatAgeGender
} from '../../lib/storage';

interface LaboratoryTabProps {
  onRefresh?: () => void;
}

export const LaboratoryTab: React.FC<LaboratoryTabProps> = ({ onRefresh }) => {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'catalog'>('queue');

  // Core Data States
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>([]);
  const [metrics, setMetrics] = useState<LabDashboardMetrics>({
    ordersTodayCount: 0,
    samplesPendingCount: 0,
    inAnalysisCount: 0,
    completedTodayCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTestsOrderId, setExpandedTestsOrderId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.tests-dropdown-container')) {
        setExpandedTestsOrderId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Filters & Search
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatusFilter, setQueueStatusFilter] = useState<'ALL' | 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_ANALYSIS' | 'COMPLETED'>('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('ALL');

  // Modals
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showResultEntryModal, setShowResultEntryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAddTestModal, setShowAddTestModal] = useState(false);

  // Active Selected Records
  const [selectedOrderForResults, setSelectedOrderForResults] = useState<LabOrder | null>(null);
  const [selectedOrderForReport, setSelectedOrderForReport] = useState<LabOrder | null>(null);
  const [editingTest, setEditingTest] = useState<LabTest | null>(null);

  // New Order Form State
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const [newOrderData, setNewOrderData] = useState({
    patientId: '',
    patientName: '',
    patientPhone: '',
    patientAge: '',
    patientGender: 'Male',
    doctorId: '',
    doctorName: 'Self / Walk-in',
    selectedTestIds: [] as string[],
    discount: 0,
    paidAmount: 0,
    paymentMode: 'CASH' as 'CASH' | 'UPI' | 'CARD' | 'FREE',
    sampleCollectedNow: true,
    technicianNotes: ''
  });

  // Result Entry Form State
  const [resultEntries, setResultEntries] = useState<Record<string, Record<string, { value: string; flag: string; isAbnormal: boolean }>>>({});
  const [pathologistRemarks, setPathologistRemarks] = useState('');

  // Add/Edit Test Form State
  const [testFormData, setTestFormData] = useState<{
    id?: string;
    name: string;
    code: string;
    category: string;
    rate: number;
    sampleType: string;
    turnaroundTime: string;
    description: string;
    parameters: LabTestParameter[];
  }>({
    name: '',
    code: '',
    category: 'Hematology',
    rate: 300,
    sampleType: 'Blood (EDTA)',
    turnaroundTime: '2-4 Hours',
    description: '',
    parameters: [{ id: 'p1', name: 'Parameter 1', unit: 'g/dL', defaultRange: '10 - 20' }]
  });

  // Load All Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ordList, tstList, docList, recList, met] = await Promise.all([
        storage.getLabOrders(),
        storage.getLabTests(),
        storage.getDoctors(),
        storage.getReceipts({ limit: 100 }),
        storage.getLabDashboardMetrics()
      ]);
      setOrders(ordList);
      setTests(tstList);
      setDoctors(docList);
      setRecentReceipts(recList);
      setMetrics(met);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to load laboratory data:', err);
      toast('Failed to load lab records', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = (e: any) => {
      const dt = e?.detail?.dataType;
      if (!dt || dt === 'lab' || dt === 'receipts' || dt === 'prescriptions' || dt === 'all') {
        loadData();
      }
    };
    window.addEventListener('buvora-data-updated', handleSync);
    const interval = setInterval(loadData, 5000);
    return () => {
      window.removeEventListener('buvora-data-updated', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Filtered Queue
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesStatus = queueStatusFilter === 'ALL' || o.status === queueStatusFilter;
      const q = queueSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.patientName.toLowerCase().includes(q) ||
        (o.patientId && o.patientId.toLowerCase().includes(q)) ||
        (o.patientPhone && o.patientPhone.includes(q)) ||
        (o.doctorName && o.doctorName.toLowerCase().includes(q)) ||
        (o.tests && o.tests.some(t => t.testName.toLowerCase().includes(q)));
      return matchesStatus && matchesSearch;
    });
  }, [orders, queueStatusFilter, queueSearch]);

  // Categories in catalog
  const catalogCategories = useMemo(() => {
    const set = new Set<string>();
    tests.forEach(t => { if (t.category) set.add(t.category); });
    return ['ALL', ...Array.from(set)];
  }, [tests]);

  // Filtered Tests
  const filteredTests = useMemo(() => {
    return tests.filter(t => {
      const matchesCategory = catalogCategoryFilter === 'ALL' || t.category === catalogCategoryFilter;
      const q = catalogSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.sampleType.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [tests, catalogCategoryFilter, catalogSearch]);

  // Global Patient Autocomplete Suggestions
  const [patientSuggestions, setPatientSuggestions] = useState<GlobalPatientProfile[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const handlePatientSearchChange = async (val: string) => {
    setPatientSearchTerm(val);
    setNewOrderData(prev => ({ ...prev, patientName: val }));
    if (val.trim().length >= 2) {
      setIsSearchingPatient(true);
      try {
        const results = await storage.searchGlobalPatients(val.trim());
        setPatientSuggestions(results || []);
        setShowPatientSuggestions((results || []).length > 0);
      } catch (_) {
        setPatientSuggestions([]);
      } finally {
        setIsSearchingPatient(false);
      }
    } else {
      setPatientSuggestions([]);
      setShowPatientSuggestions(false);
    }
  };

  // Helper: Total calculation for new order
  const calculatedTotal = useMemo(() => {
    const sum = newOrderData.selectedTestIds.reduce((acc, testId) => {
      const t = tests.find(item => item.id === testId);
      return acc + (t ? t.rate : 0);
    }, 0);
    return Math.max(0, sum - (Number(newOrderData.discount) || 0));
  }, [newOrderData.selectedTestIds, newOrderData.discount, tests]);

  // Action: Open New Order Modal
  const handleOpenNewOrder = () => {
    setNewOrderData({
      patientId: '',
      patientName: '',
      patientPhone: '',
      patientAge: '',
      patientGender: 'Male',
      doctorId: doctors.length > 0 ? doctors[0].id : '',
      doctorName: doctors.length > 0 ? doctors[0].name : 'Self / Walk-in',
      selectedTestIds: [],
      discount: 0,
      paidAmount: 0,
      paymentMode: 'CASH',
      sampleCollectedNow: true,
      technicianNotes: ''
    });
    setPatientSearchTerm('');
    setPatientSuggestions([]);
    setShowPatientSuggestions(false);
    setShowNewOrderModal(true);
  };

  // Action: Select Patient from Suggestions (Autofill Demographic Data)
  const handleSelectPatient = (p: GlobalPatientProfile) => {
    const doc = doctors.find(d => d.id === p.lastDoctorId || d.name === p.previousDoctorName);
    setNewOrderData(prev => ({
      ...prev,
      patientId: p.patientUhid || p.patientId || '',
      patientName: p.patientName,
      patientPhone: p.patientPhone || '',
      patientAge: p.patientAge || '',
      patientGender: p.patientGender || 'Male',
      doctorId: doc ? doc.id : prev.doctorId,
      doctorName: doc ? doc.name : (p.previousDoctorName || prev.doctorName)
    }));
    setPatientSearchTerm(p.patientName);
    setShowPatientSuggestions(false);
  };

  // Action: Save New Order
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderData.patientName.trim()) {
      toast('Please enter patient name', { type: 'error' });
      return;
    }
    if (newOrderData.selectedTestIds.length === 0) {
      toast('Please select at least one laboratory test', { type: 'error' });
      return;
    }

    try {
      const selectedTests: LabOrderItem[] = newOrderData.selectedTestIds.map(testId => {
        const t = tests.find(item => item.id === testId)!;
        return {
          testId: t.id,
          testName: t.name,
          category: t.category,
          sampleType: t.sampleType,
          rate: t.rate,
          status: newOrderData.sampleCollectedNow ? 'COLLECTED' : 'PENDING',
          results: t.parameters.map(p => ({
            parameterId: p.id,
            parameterName: p.name,
            value: '',
            unit: p.unit,
            referenceRange: p.defaultRange,
            isAbnormal: false,
            flag: 'NORMAL'
          }))
        };
      });

      const initialStatus = newOrderData.sampleCollectedNow ? 'SAMPLE_COLLECTED' : 'ORDERED';
      const nowIso = new Date().toISOString();

      await storage.saveLabOrder({
        patientId: newOrderData.patientId,
        patientName: newOrderData.patientName.trim(),
        patientPhone: newOrderData.patientPhone.trim(),
        patientAge: newOrderData.patientAge.trim(),
        patientGender: newOrderData.patientGender,
        doctorId: newOrderData.doctorId,
        doctorName: newOrderData.doctorName,
        tests: selectedTests,
        totalAmount: calculatedTotal,
        discount: Number(newOrderData.discount) || 0,
        paidAmount: Number(newOrderData.paidAmount) || calculatedTotal,
        paymentMode: newOrderData.paymentMode,
        status: initialStatus,
        sampleCollectedAt: newOrderData.sampleCollectedNow ? nowIso : undefined,
        sampleCollectedBy: newOrderData.sampleCollectedNow ? 'Laboratory Desk' : undefined,
        technicianNotes: newOrderData.technicianNotes,
        orderDate: nowIso.split('T')[0]
      });

      toast(`Lab Order created successfully!`, { type: 'success' });
      setShowNewOrderModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to create lab order:', err);
      toast('Failed to save lab order', { type: 'error' });
    }
  };

  // Action: Mark Sample Collected
  const handleMarkSampleCollected = async (orderId: string) => {
    try {
      await storage.updateLabOrderStatus(orderId, 'SAMPLE_COLLECTED', {
        sampleCollectedAt: new Date().toISOString(),
        sampleCollectedBy: 'Laboratory Desk'
      });
      toast('Specimen marked as collected', { type: 'success' });
      loadData();
    } catch (err) {
      console.error('Failed to update sample status:', err);
      toast('Failed to update specimen status', { type: 'error' });
    }
  };

  // Action: Delete / Cancel Order
  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (window.confirm(`Are you sure you want to cancel and remove Lab Order "${orderNumber}"?`)) {
      try {
        await storage.deleteLabOrder(orderId);
        toast(`Order ${orderNumber} removed`, { type: 'success' });
        loadData();
      } catch (err) {
        console.error('Failed to delete lab order:', err);
        toast('Failed to delete lab order', { type: 'error' });
      }
    }
  };

  // Helper: Detect if a numeric value is abnormal based on standard range string
  const checkIsAbnormal = (valStr: string, rangeStr?: string): { isAbnormal: boolean; flag: string } => {
    if (!valStr || !rangeStr) return { isAbnormal: false, flag: 'NORMAL' };
    const num = parseFloat(valStr.trim());
    if (isNaN(num)) {
      const lowerVal = valStr.toLowerCase().trim();
      const lowerRange = rangeStr.toLowerCase().trim();
      if ((lowerRange.includes('negative') || lowerRange.includes('nil')) && (lowerVal.includes('positive') || lowerVal.includes('present') || lowerVal.includes('reactive'))) {
        return { isAbnormal: true, flag: 'HIGH' };
      }
      return { isAbnormal: false, flag: 'NORMAL' };
    }

    const dashMatch = rangeStr.match(/([0-9.]+)\s*-\s*([0-9.]+)/);
    if (dashMatch) {
      const min = parseFloat(dashMatch[1]);
      const max = parseFloat(dashMatch[2]);
      if (num < min) return { isAbnormal: true, flag: 'LOW' };
      if (num > max) return { isAbnormal: true, flag: 'HIGH' };
      return { isAbnormal: false, flag: 'NORMAL' };
    }

    const lessMatch = rangeStr.match(/<\s*=?\s*([0-9.]+)/);
    if (lessMatch) {
      const max = parseFloat(lessMatch[1]);
      if (num > max) return { isAbnormal: true, flag: 'HIGH' };
      return { isAbnormal: false, flag: 'NORMAL' };
    }

    const greaterMatch = rangeStr.match(/>\s*=?\s*([0-9.]+)/);
    if (greaterMatch) {
      const min = parseFloat(greaterMatch[1]);
      if (num < min) return { isAbnormal: true, flag: 'LOW' };
      return { isAbnormal: false, flag: 'NORMAL' };
    }

    return { isAbnormal: false, flag: 'NORMAL' };
  };

  // Action: Open Result Entry Modal
  const handleOpenResultEntry = (order: LabOrder) => {
    setSelectedOrderForResults(order);
    const initialEntries: Record<string, Record<string, { value: string; flag: string; isAbnormal: boolean }>> = {};

    order.tests.forEach(t => {
      initialEntries[t.testId] = {};
      if (t.results && t.results.length > 0) {
        t.results.forEach(r => {
          initialEntries[t.testId][r.parameterId] = {
            value: r.value !== undefined ? String(r.value) : '',
            flag: r.flag || 'NORMAL',
            isAbnormal: !!r.isAbnormal
          };
        });
      } else {
        const catTest = tests.find(item => item.id === t.testId);
        if (catTest) {
          catTest.parameters.forEach(p => {
            initialEntries[t.testId][p.id] = { value: '', flag: 'NORMAL', isAbnormal: false };
          });
        }
      }
    });

    setResultEntries(initialEntries);
    setPathologistRemarks(order.pathologistRemarks || '');
    setShowResultEntryModal(true);
  };

  // Action: Save Result Entry
  const handleSaveResults = async (verifyAndComplete: boolean) => {
    if (!selectedOrderForResults) return;

    try {
      const updatedTests: LabOrderItem[] = selectedOrderForResults.tests.map(t => {
        const catTest = tests.find(item => item.id === t.testId);
        const params = (t.results && t.results.length > 0)
          ? t.results
          : (catTest ? catTest.parameters.map(p => ({
              parameterId: p.id,
              parameterName: p.name,
              value: '',
              unit: p.unit,
              referenceRange: p.defaultRange,
              isAbnormal: false,
              flag: 'NORMAL'
            })) : []);

        const resultsWithValues: LabParameterResult[] = params.map(p => {
          const entry = resultEntries[t.testId]?.[p.parameterId] || { value: '', flag: 'NORMAL', isAbnormal: false };
          return {
            parameterId: p.parameterId,
            parameterName: p.parameterName,
            value: entry.value,
            unit: p.unit,
            referenceRange: p.referenceRange,
            isAbnormal: entry.isAbnormal,
            flag: entry.flag
          };
        });

        const hasAnyResult = resultsWithValues.some(r => r.value !== '');
        const itemStatus = hasAnyResult ? (verifyAndComplete ? 'COMPLETED' : 'IN_ANALYSIS') : 'COLLECTED';

        return {
          ...t,
          status: itemStatus,
          results: resultsWithValues
        };
      });

      await storage.saveLabOrderResults(selectedOrderForResults.id, updatedTests, pathologistRemarks);

      if (verifyAndComplete) {
        await storage.updateLabOrderStatus(selectedOrderForResults.id, 'COMPLETED', {
          completedAt: new Date().toISOString(),
          pathologistRemarks
        });
        toast('Laboratory report verified & marked completed!', { type: 'success' });
      } else {
        await storage.updateLabOrderStatus(selectedOrderForResults.id, 'IN_ANALYSIS', {
          pathologistRemarks
        });
        toast('Results saved as draft (In Analysis)', { type: 'info' });
      }

      setShowResultEntryModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to save test results:', err);
      toast('Failed to save results', { type: 'error' });
    }
  };

  // Action: Open Report Modal
  const handleOpenReport = (order: LabOrder) => {
    setSelectedOrderForReport(order);
    setShowReportModal(true);
  };

  // Action: Print Report
  const handlePrintReport = () => {
    window.print();
  };

  // Action: Share Report via WhatsApp
  const handleWhatsAppShare = (order: LabOrder) => {
    if (!order.patientPhone) {
      toast('Patient phone number not available', { type: 'error' });
      return;
    }

    let phone = order.patientPhone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    let msg = `*LABORATORY DIAGNOSTIC REPORT*\n`;
    msg += `------------------------------------\n`;
    msg += `*Patient:* ${order.patientName} (${formatAgeGender(order.patientAge, order.patientGender)})\n`;
    if (order.patientId) msg += `*UHID/PID:* ${order.patientId}\n`;
    msg += `*Order No:* ${order.orderNumber}\n`;
    msg += `*Date:* ${order.orderDate}\n`;
    msg += `*Ref By:* ${order.doctorName || 'Self'}\n`;
    msg += `*Status:* ${order.status === 'COMPLETED' ? 'Verified & Final' : 'In Progress'}\n\n`;

    order.tests.forEach(t => {
      msg += `🔬 *${t.testName.toUpperCase()}*\n`;
      if (t.results && t.results.length > 0) {
        t.results.forEach(r => {
          if (r.value !== '') {
            const flagEmoji = r.isAbnormal ? (r.flag === 'HIGH' ? ' 🔺[HIGH]' : ' 🔻[LOW]') : '';
            msg += `• ${r.parameterName}: *${r.value} ${r.unit}* (Ref: ${r.referenceRange})${flagEmoji}\n`;
          }
        });
      }
      msg += `\n`;
    });

    if (order.pathologistRemarks) {
      msg += `*Pathologist Remarks:* ${order.pathologistRemarks}\n\n`;
    }

    msg += `_Generated by Buvora™ Hospital Diagnostics Suite._`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  // Action: Add/Edit Test Catalog
  const handleOpenAddTest = (t?: LabTest) => {
    if (t) {
      setEditingTest(t);
      setTestFormData({
        id: t.id,
        name: t.name,
        code: t.code,
        category: t.category,
        rate: t.rate,
        sampleType: t.sampleType,
        turnaroundTime: t.turnaroundTime,
        description: t.description || '',
        parameters: t.parameters && t.parameters.length > 0 ? [...t.parameters] : [{ id: 'p1', name: 'Result', unit: '', defaultRange: '' }]
      });
    } else {
      setEditingTest(null);
      setTestFormData({
        name: '',
        code: '',
        category: 'Hematology',
        rate: 300,
        sampleType: 'Blood (EDTA)',
        turnaroundTime: '2-4 Hours',
        description: '',
        parameters: [
          { id: 'p1', name: 'Parameter 1', unit: 'g/dL', defaultRange: '10 - 20' }
        ]
      });
    }
    setShowAddTestModal(true);
  };

  const handleSaveTestCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testFormData.name.trim()) {
      toast('Please enter test name', { type: 'error' });
      return;
    }

    try {
      await storage.saveLabTest({
        id: testFormData.id,
        name: testFormData.name.trim(),
        code: testFormData.code.trim() || testFormData.name.slice(0, 4).toUpperCase(),
        category: testFormData.category,
        rate: Number(testFormData.rate) || 0,
        sampleType: testFormData.sampleType,
        turnaroundTime: testFormData.turnaroundTime,
        description: testFormData.description,
        parameters: testFormData.parameters
      });

      toast(editingTest ? 'Test updated successfully' : 'New test added to catalog', { type: 'success' });
      setShowAddTestModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to save test:', err);
      toast('Failed to save test profile', { type: 'error' });
    }
  };

  const handleDeleteTest = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to deactivate "${name}" from the laboratory test catalog?`)) {
      try {
        await storage.deleteLabTest(id);
        toast('Test removed from catalog', { type: 'success' });
        loadData();
      } catch (err) {
        toast('Failed to delete test', { type: 'error' });
      }
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              color: 'white',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)'
            }}>
              <FlaskConical size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Laboratory & Diagnostics Desk
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Pathology investigations, specimen tracking, biological reference ranges, and verified A4 reports
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={loadData}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1rem' }}
            title="Refresh laboratory records"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleOpenNewOrder}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
              padding: '0.6rem 1.25rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
            }}
          >
            <Plus size={18} />
            + New Investigation Order
          </button>
        </div>
      </div>

      {/* ── KPI Metric Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Metric 1 */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #4f46e5', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Orders Today</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e1b4b' }}>{metrics.ordersTodayCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#6366f1' }}>Total active in workflow: {orders.length}</div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Droplet size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Samples Pending</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#92400e' }}>{metrics.samplesPendingCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Specimen awaiting collection</div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0284c7', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Analysis</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#075985' }}>{metrics.inAnalysisCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>Testing & result entry in progress</div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reports Completed Today</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#064e3b' }}>{metrics.completedTodayCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#059669' }}>Verified and delivered to patients</div>
          </div>
        </div>
      </div>

      {/* ── Sub-Navigation Pill Bar ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveSubTab('queue')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeSubTab === 'queue' ? '#4f46e5' : 'transparent',
              color: activeSubTab === 'queue' ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            <FlaskConical size={16} />
            Active Investigation Queue ({orders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('catalog')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeSubTab === 'catalog' ? '#4f46e5' : 'transparent',
              color: activeSubTab === 'catalog' ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={16} />
            Diagnostic Test Catalog ({tests.length})
          </button>
        </div>

        {activeSubTab === 'catalog' && (
          <button
            onClick={() => handleOpenAddTest()}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
          >
            <Plus size={15} /> + Add Test Profile
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SUB-TAB 1: ACTIVE INVESTIGATION QUEUE
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'queue' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search patient name, PID-XXXX, order LAB-XXXX, or test..."
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>

            {/* Status Segmented Pills */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              {(['ALL', 'ORDERED', 'SAMPLE_COLLECTED', 'IN_ANALYSIS', 'COMPLETED'] as const).map(st => {
                const labelMap = {
                  ALL: 'All Orders',
                  ORDERED: 'Pending Specimen',
                  SAMPLE_COLLECTED: 'Collected',
                  IN_ANALYSIS: 'In Analysis',
                  COMPLETED: 'Completed'
                };
                const isSelected = queueStatusFilter === st;
                return (
                  <button
                    key={st}
                    onClick={() => setQueueStatusFilter(st)}
                    style={{
                      border: 'none',
                      background: isSelected ? 'white' : 'transparent',
                      color: isSelected ? '#0f172a' : '#64748b',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.8rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {labelMap[st]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <FlaskConical size={48} style={{ opacity: 0.25, margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>No laboratory orders found</h3>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {queueSearch || queueStatusFilter !== 'ALL' ? 'Try adjusting your search or status filter' : 'Create your first diagnostic order with "+ New Investigation Order"'}
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'left' }}>Order # &amp; Date</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'left' }}>Patient Demographics</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'left' }}>Tests Requested</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'left' }}>Referring Doctor</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Billing</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => {
                    const statusBadgeMap: Record<string, { label: string; bg: string; color: string; border: string }> = {
                      ORDERED: { label: 'Specimen Pending', bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
                      SAMPLE_COLLECTED: { label: 'Specimen Collected', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
                      IN_ANALYSIS: { label: 'In Analysis', bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' },
                      COMPLETED: { label: 'Report Verified', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
                      CANCELLED: { label: 'Cancelled', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' }
                    };
                    const badge = statusBadgeMap[order.status] || statusBadgeMap.ORDERED;

                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}>
                        {/* Order # & Date */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, color: '#4f46e5', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                            {order.orderNumber}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {order.orderDate ? format(new Date(order.orderDate), 'dd MMM yyyy') : 'Today'}
                          </div>
                        </td>

                        {/* Patient Demographics */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ color: '#0f172a' }}>{order.patientName}</strong>
                            {order.patientId && (
                              <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                {order.patientId}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {formatAgeGender(order.patientAge, order.patientGender)}
                            {order.patientPhone && ` • ${order.patientPhone}`}
                          </div>
                        </td>

                        {/* Tests Requested */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'left' }}>
                          {order.tests.length === 0 ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tests</span>
                          ) : order.tests.length === 1 ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.78rem',
                                background: '#f8fafc',
                                color: '#1e293b',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                border: '1px solid #e2e8f0',
                                maxWidth: '220px'
                              }}
                              title={`${order.tests[0].testName}${order.tests[0].rate ? ` (₹${order.tests[0].rate})` : ''}`}
                            >
                              <FlaskConical size={12} color="#0284c7" style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {order.tests[0].testName}
                              </span>
                            </div>
                          ) : (
                            <div className="tests-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTestsOrderId(expandedTestsOrderId === order.id ? null : order.id);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.75rem',
                                  background: expandedTestsOrderId === order.id ? '#eff6ff' : '#f8fafc',
                                  color: expandedTestsOrderId === order.id ? '#1d4ed8' : '#334155',
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  border: `1px solid ${expandedTestsOrderId === order.id ? '#93c5fd' : '#cbd5e1'}`,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Click to view all requested tests"
                              >
                                <FlaskConical size={12} color={expandedTestsOrderId === order.id ? '#1d4ed8' : '#0284c7'} />
                                <span>{order.tests.length} Tests Requested</span>
                                <ChevronDown
                                  size={12}
                                  style={{
                                    transform: expandedTestsOrderId === order.id ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.2s ease'
                                  }}
                                />
                              </button>

                              {expandedTestsOrderId === order.id && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 4px)',
                                    left: 0,
                                    zIndex: 9999,
                                    background: 'white',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                    width: '270px',
                                    padding: '8px'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      Requested Tests ({order.tests.length})
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                                      Total: ₹{order.totalAmount}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                                    {order.tests.map((t, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          fontSize: '0.75rem',
                                          color: '#1e293b',
                                          padding: '5px 8px',
                                          borderRadius: '5px',
                                          background: '#f8fafc',
                                          border: '1px solid #f1f5f9',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.testName}>
                                          {idx + 1}. {t.testName}
                                        </span>
                                        {t.rate !== undefined && (
                                          <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0 }}>
                                            ₹{t.rate}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedTestsOrderId(null);
                                        if (order.status === 'COMPLETED') {
                                          handleOpenReport(order);
                                        } else {
                                          handleOpenResultEntry(order);
                                        }
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#4f46e5',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        padding: 0,
                                        textDecoration: 'underline'
                                      }}
                                    >
                                      {order.status === 'COMPLETED' ? 'Open Diagnostic Report →' : 'Enter Results & Values →'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Referring Doctor */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', fontSize: '0.85rem', textAlign: 'left' }}>
                          <div style={{ color: '#334155', fontWeight: 600 }}>{order.doctorName || 'Self / Walk-in'}</div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: badge.bg,
                              color: badge.color,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: `1px solid ${badge.border}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {order.status === 'COMPLETED' && <CheckCircle2 size={12} />}
                            {order.status === 'SAMPLE_COLLECTED' && <Droplet size={12} />}
                            {order.status === 'IN_ANALYSIS' && <Clock size={12} />}
                            {badge.label}
                          </span>
                        </td>

                        {/* Billing */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>₹{order.totalAmount}</div>
                          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                            Paid: ₹{order.paidAmount} ({order.paymentMode})
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                            {order.status === 'ORDERED' && (
                              <button
                                onClick={() => handleMarkSampleCollected(order.id)}
                                className="btn-secondary"
                                style={{
                                  fontSize: '0.78rem',
                                  padding: '0.35rem 0.65rem',
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  borderColor: '#bae6fd',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Record specimen collected from patient"
                              >
                                <Droplet size={13} /> Collect Sample
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenResultEntry(order)}
                              className="btn-secondary"
                              style={{
                                fontSize: '0.78rem',
                                padding: '0.35rem 0.65rem',
                                background: '#f8fafc',
                                color: '#4f46e5',
                                borderColor: '#cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Enter parameter test values & normal ranges"
                            >
                              <Edit3 size={13} /> {order.status === 'COMPLETED' ? 'Edit Results' : 'Enter Results'}
                            </button>

                            {(order.status === 'COMPLETED' || order.status === 'IN_ANALYSIS') && (
                              <button
                                onClick={() => handleOpenReport(order)}
                                className="btn-primary"
                                style={{
                                  fontSize: '0.78rem',
                                  padding: '0.35rem 0.65rem',
                                  background: '#4f46e5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="View & Print A4 Diagnostic Report"
                              >
                                <FileText size={13} /> Report
                              </button>
                            )}

                            <button
                              onClick={() => handleWhatsAppShare(order)}
                              className="btn-secondary"
                              style={{
                                fontSize: '0.78rem',
                                padding: '0.35rem 0.6rem',
                                background: '#f0fdf4',
                                color: '#15803d',
                                borderColor: '#bbf7d0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Share report via WhatsApp"
                            >
                              <Send size={13} />
                            </button>

                            <button
                              onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                              className="btn-secondary"
                              style={{
                                fontSize: '0.78rem',
                                padding: '0.35rem 0.6rem',
                                background: '#fef2f2',
                                color: '#dc2626',
                                borderColor: '#fecaca',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Cancel & Delete Order"
                            >
                              <Trash2 size={13} />
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          SUB-TAB 2: DIAGNOSTIC TEST MASTER CATALOG
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'catalog' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search test name, code, or specimen..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                value={catalogCategoryFilter}
                onChange={e => setCatalogCategoryFilter(e.target.value)}
                className="input-field"
                style={{ minWidth: '180px' }}
              >
                {catalogCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'ALL' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Test Cards / Table */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
            {filteredTests.map(test => (
              <div
                key={test.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '3px solid #4f46e5'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        {test.code}
                      </span>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {test.name}
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600 }}>
                        {test.category}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>
                        ₹{test.rate}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>standard fee</div>
                    </div>
                  </div>

                  {test.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0', lineHeight: 1.4 }}>
                      {test.description}
                    </p>
                  )}

                  {/* Specimen & Turnaround */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px', margin: '0.75rem 0', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Specimen: </span>
                      <strong style={{ color: '#334155' }}>{test.sampleType}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Turnaround: </span>
                      <strong style={{ color: '#334155' }}>{test.turnaroundTime}</strong>
                    </div>
                  </div>

                  {/* Parameters List Preview */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Parameters Included ({test.parameters.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '60px', overflowY: 'auto' }}>
                      {test.parameters.map((p, pIdx) => (
                        <span key={pIdx} style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '4px' }}>
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <button
                    onClick={() => handleOpenAddTest(test)}
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTest(test.id, test.name)}
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 1: NEW INVESTIGATION ORDER
      ══════════════════════════════════════════════════════════════════════════ */}
      {showNewOrderModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowNewOrderModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '750px',
              width: '95%',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              padding: '1.5rem',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlaskConical size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>New Diagnostic Investigation Order</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Register test order, specimen, and cashier settlement</div>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setShowNewOrderModal(false)} style={{ padding: '0.35rem 0.65rem' }}>✕</button>
            </div>

            <form onSubmit={handleSaveOrder}>
              {/* Section 1: Patient Details */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  1. Patient Demographics & Identification
                </div>

                {/* Patient Search */}
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search patient database by name, phone, or UHID/PID to auto-fill..."
                    value={patientSearchTerm}
                    onChange={e => handlePatientSearchChange(e.target.value)}
                    onFocus={() => {
                      if (patientSearchTerm && patientSearchTerm.length >= 2) {
                        setShowPatientSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowPatientSuggestions(false), 200);
                    }}
                    className="input-field"
                    style={{ paddingLeft: '32px', paddingRight: patientSearchTerm ? '32px' : '10px', width: '100%' }}
                  />

                  {patientSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatientSearchTerm('');
                        setPatientSuggestions([]);
                        setShowPatientSuggestions(false);
                      }}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '2px 6px',
                        fontSize: '0.85rem'
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}

                  {showPatientSuggestions && patientSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                      zIndex: 100,
                      marginTop: '4px',
                      maxHeight: '220px',
                      overflowY: 'auto'
                    }}>
                      {patientSuggestions.map(p => (
                        <div
                          key={p.patientUhid || p.patientId || p.patientPhone || p.patientName}
                          onMouseDown={e => {
                            e.preventDefault();
                            handleSelectPatient(p);
                          }}
                          onClick={() => handleSelectPatient(p)}
                          style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <div>
                            <strong style={{ color: '#0f172a' }}>{p.patientName}</strong>
                            {p.patientPhone && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                📞 {p.patientPhone}
                              </span>
                            )}
                            {p.patientAge && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '6px' }}>
                                • {formatAgeGender(p.patientAge, p.patientGender)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {(p.patientUhid || p.patientId) && (
                              <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {p.patientUhid || p.patientId}
                              </span>
                            )}
                            {p.source && (
                              <span style={{ fontSize: '0.68rem', background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                {p.source}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Patient Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={newOrderData.patientName}
                      onChange={e => setNewOrderData({ ...newOrderData, patientName: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="form-label">Patient ID (UHID)</label>
                    <input
                      type="text"
                      placeholder="e.g. PID-1001"
                      value={newOrderData.patientId}
                      onChange={e => setNewOrderData({ ...newOrderData, patientId: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      placeholder="10 digits"
                      value={newOrderData.patientPhone}
                      onChange={e => setNewOrderData({ ...newOrderData, patientPhone: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="form-label">Gender</label>
                    <select
                      value={newOrderData.patientGender}
                      onChange={e => setNewOrderData({ ...newOrderData, patientGender: e.target.value })}
                      className="input-field"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Referring Doctor */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  2. Prescribing / Referring Doctor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Select Registered Doctor</label>
                    <select
                      value={newOrderData.doctorId}
                      onChange={e => {
                        const doc = doctors.find(d => d.id === e.target.value);
                        setNewOrderData({
                          ...newOrderData,
                          doctorId: e.target.value,
                          doctorName: doc ? doc.name : 'Self / Walk-in'
                        });
                      }}
                      className="input-field"
                    >
                      <option value="">-- Self / External Referral --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Doctor / Clinic Name (Printed on Report)</label>
                    <input
                      type="text"
                      value={newOrderData.doctorName}
                      onChange={e => setNewOrderData({ ...newOrderData, doctorName: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Select Tests */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>
                    3. Select Laboratory Investigations ({newOrderData.selectedTestIds.length} Selected)
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#047857' }}>
                    Estimated Total: ₹{calculatedTotal}
                  </div>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {tests.map(t => {
                    const isChecked = newOrderData.selectedTestIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          const updated = isChecked
                            ? newOrderData.selectedTestIds.filter(id => id !== t.id)
                            : [...newOrderData.selectedTestIds, t.id];
                          setNewOrderData({ ...newOrderData, selectedTestIds: updated });
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          border: isChecked ? '1px solid #6366f1' : '1px solid #e2e8f0',
                          background: isChecked ? '#eef2ff' : '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <div>
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{t.name}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {t.category} • {t.sampleType}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#047857' }}>
                          ₹{t.rate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 4: Specimen & Billing */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={newOrderData.sampleCollectedNow}
                      onChange={e => setNewOrderData({ ...newOrderData, sampleCollectedNow: e.target.checked })}
                    />
                    🩸 Mark Specimen Sample Collected Now (Phlebotomy Done)
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Discount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={newOrderData.discount}
                      onChange={e => setNewOrderData({ ...newOrderData, discount: Number(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="form-label">Paid Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={newOrderData.paidAmount}
                      onChange={e => setNewOrderData({ ...newOrderData, paidAmount: Number(e.target.value) })}
                      className="input-field"
                      placeholder={`Full: ₹${calculatedTotal}`}
                    />
                  </div>
                  <div>
                    <label className="form-label">Payment Mode</label>
                    <select
                      value={newOrderData.paymentMode}
                      onChange={e => setNewOrderData({ ...newOrderData, paymentMode: e.target.value as any })}
                      className="input-field"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="FREE">Waived / Free</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowNewOrderModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.6rem 1.25rem'
                  }}
                >
                  <Check size={16} /> Confirm Lab Order (₹{calculatedTotal})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 2: RESULT ENTRY FORM
      ══════════════════════════════════════════════════════════════════════════ */}
      {showResultEntryModal && selectedOrderForResults && (
        <div
          className="modal-backdrop"
          onClick={() => setShowResultEntryModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '850px',
              width: '95%',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              padding: '1.5rem',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Test Result Entry — {selectedOrderForResults.orderNumber}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Patient: <strong>{selectedOrderForResults.patientName}</strong> ({formatAgeGender(selectedOrderForResults.patientAge, selectedOrderForResults.patientGender)}) • Ref: {selectedOrderForResults.doctorName}
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setShowResultEntryModal(false)} style={{ padding: '0.35rem 0.65rem' }}>✕</button>
            </div>

            {/* Parameter Entry Tables by Test */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {selectedOrderForResults.tests.map(testItem => {
                const catTest = tests.find(t => t.id === testItem.testId);
                const parametersToDisplay = (testItem.results && testItem.results.length > 0)
                  ? testItem.results.map(r => ({ id: r.parameterId, name: r.parameterName, unit: r.unit, defaultRange: r.referenceRange }))
                  : (catTest ? catTest.parameters : []);

                return (
                  <div key={testItem.testId} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FlaskConical size={16} color="#4f46e5" />
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{testItem.testName}</strong>
                        <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          {testItem.sampleType || 'Blood'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Category: {testItem.category}
                      </span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                          <th style={{ padding: '0.5rem 1rem', width: '35%', textAlign: 'left' }}>Parameter Name</th>
                          <th style={{ padding: '0.5rem 1rem', width: '25%', textAlign: 'left' }}>Observed Result</th>
                          <th style={{ padding: '0.5rem 1rem', width: '15%', textAlign: 'center' }}>Unit</th>
                          <th style={{ padding: '0.5rem 1rem', width: '25%', textAlign: 'left' }}>Standard Reference Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parametersToDisplay.map(param => {
                          const currentEntry = resultEntries[testItem.testId]?.[param.id] || { value: '', flag: 'NORMAL', isAbnormal: false };

                          return (
                            <tr key={param.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '0.5rem 1rem', fontWeight: 600, color: '#1e293b', textAlign: 'left' }}>
                                {param.name}
                              </td>
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="text"
                                    placeholder="Enter value"
                                    value={currentEntry.value}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const { isAbnormal, flag } = checkIsAbnormal(val, param.defaultRange);
                                      setResultEntries(prev => ({
                                        ...prev,
                                        [testItem.testId]: {
                                          ...prev[testItem.testId],
                                          [param.id]: { value: val, flag, isAbnormal }
                                        }
                                      }));
                                    }}
                                    className="input-field"
                                    style={{
                                      padding: '0.35rem 0.6rem',
                                      fontWeight: currentEntry.isAbnormal ? 800 : 500,
                                      color: currentEntry.isAbnormal ? '#b91c1c' : '#0f172a',
                                      borderColor: currentEntry.isAbnormal ? '#f87171' : 'var(--border)',
                                      background: currentEntry.isAbnormal ? '#fff1f2' : 'white',
                                      width: '120px'
                                    }}
                                  />
                                  {currentEntry.isAbnormal && (
                                    <span style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 800,
                                      color: '#b91c1c',
                                      background: '#fee2e2',
                                      padding: '2px 5px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}>
                                      {currentEntry.flag === 'HIGH' ? '🔺 HIGH' : '🔻 LOW'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '0.5rem 1rem', color: '#64748b', textAlign: 'center' }}>
                                {param.unit}
                              </td>
                              <td style={{ padding: '0.5rem 1rem', color: '#64748b', fontSize: '0.8rem', textAlign: 'left' }}>
                                {param.defaultRange}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Pathologist Clinical Remarks */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>
                Pathologist Clinical Impression & Remarks
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Mild microcytic hypochromic anemia observed. Recommend serum ferritin evaluation."
                value={pathologistRemarks}
                onChange={e => setPathologistRemarks(e.target.value)}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowResultEntryModal(false)}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleSaveResults(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Clock size={16} /> Save as Draft (In Analysis)
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleSaveResults(true)}
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle2 size={16} /> Verify & Complete Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 3: A4 DIAGNOSTIC REPORT PREVIEW & PRINT
      ══════════════════════════════════════════════════════════════════════════ */}
      {showReportModal && selectedOrderForReport && (
        <div
          className="modal-backdrop"
          onClick={() => setShowReportModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '820px',
              width: '95%',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              padding: '1.5rem',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            {/* Action Bar Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>A4 Diagnostic Investigation Report</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleWhatsAppShare(selectedOrderForReport)}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#f0fdf4',
                    color: '#15803d',
                    borderColor: '#bbf7d0',
                    fontSize: '0.85rem'
                  }}
                >
                  <Send size={15} /> WhatsApp Share
                </button>
                <button
                  onClick={handlePrintReport}
                  className="btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#4f46e5',
                    fontSize: '0.85rem'
                  }}
                >
                  <Printer size={15} /> Print Report
                </button>
                <button className="btn-secondary" onClick={() => setShowReportModal(false)} style={{ padding: '0.35rem 0.65rem' }}>✕</button>
              </div>
            </div>

            {/* Printable Report Sheet (A4 Styling) */}
            <div
              id="printable-lab-report"
              style={{
                border: '1px solid #cbd5e1',
                padding: '2rem',
                borderRadius: '8px',
                background: 'white',
                color: '#0f172a',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            >
              {/* Lab Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  BUVORA CLINICAL DIAGNOSTICS & PATHOLOGY LABORATORY
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>
                  Accredited Clinical Pathology • Biochemistry • Hematology • Serology
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Ph: +91 98765 43210 • Email: lab@buvora.hospital • Licensed Diagnostic Facility
                </div>
              </div>

              {/* Patient Demographics & Specimen Information Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                <div>
                  <div>Patient Name: <strong style={{ fontSize: '0.95rem' }}>{selectedOrderForReport.patientName}</strong></div>
                  <div style={{ marginTop: '3px' }}>Age / Gender: <strong>{formatAgeGender(selectedOrderForReport.patientAge, selectedOrderForReport.patientGender)}</strong></div>
                  {selectedOrderForReport.patientId && <div style={{ marginTop: '3px' }}>UHID / Patient ID: <strong>{selectedOrderForReport.patientId}</strong></div>}
                  {selectedOrderForReport.patientPhone && <div style={{ marginTop: '3px' }}>Contact: <strong>{selectedOrderForReport.patientPhone}</strong></div>}
                </div>
                <div>
                  <div>Order / Lab ID: <strong style={{ color: '#4f46e5' }}>{selectedOrderForReport.orderNumber}</strong></div>
                  <div style={{ marginTop: '3px' }}>Ref Doctor: <strong>{selectedOrderForReport.doctorName || 'Self'}</strong></div>
                  <div style={{ marginTop: '3px' }}>Sample Collected: <strong>{selectedOrderForReport.sampleCollectedAt ? format(new Date(selectedOrderForReport.sampleCollectedAt), 'dd/MM/yyyy HH:mm') : 'Recorded'}</strong></div>
                  <div style={{ marginTop: '3px' }}>Report Verified: <strong>{selectedOrderForReport.completedAt ? format(new Date(selectedOrderForReport.completedAt), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy')}</strong></div>
                </div>
              </div>

              {/* Test Investigations Results Table */}
              {selectedOrderForReport.tests.map((testItem, tIdx) => (
                <div key={tIdx} style={{ marginBottom: '1.5rem' }}>
                  <div style={{
                    background: '#0f172a',
                    color: 'white',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{testItem.testName}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9 }}>
                      Specimen: {testItem.sampleType || 'Blood'} • Method: Automated Analyzer
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '4px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                        <th style={{ padding: '0.5rem 0.75rem', width: '35%', textAlign: 'left' }}>Investigation Parameter</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '22%', textAlign: 'left' }}>Observed Result</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '18%', textAlign: 'left' }}>Biological Ref Range</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '15%', textAlign: 'center' }}>Units</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '10%', textAlign: 'center' }}>Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testItem.results && testItem.results.length > 0 ? (
                        testItem.results.map((r, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9', background: r.isAbnormal ? '#fff1f2' : 'transparent' }}>
                            <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: '#1e293b', textAlign: 'left' }}>
                              {r.parameterName}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', fontWeight: r.isAbnormal ? 800 : 600, color: r.isAbnormal ? '#b91c1c' : '#0f172a', textAlign: 'left' }}>
                              {r.value || '—'}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', color: '#475569', textAlign: 'left' }}>
                              {r.referenceRange}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', color: '#64748b', textAlign: 'center' }}>
                              {r.unit}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center' }}>
                              {r.isAbnormal ? (
                                <span style={{ fontWeight: 800, fontSize: '0.7rem', color: '#b91c1c' }}>
                                  {r.flag}
                                </span>
                              ) : (
                                <span style={{ color: '#16a34a', fontSize: '0.7rem', fontWeight: 700 }}>NORMAL</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Results pending analysis.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Pathologist Remarks */}
              {selectedOrderForReport.pathologistRemarks && (
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.82rem' }}>
                  <strong style={{ color: '#0f172a' }}>Clinical Interpretation / Pathologist Remarks:</strong>
                  <div style={{ marginTop: '4px', color: '#334155', fontStyle: 'italic' }}>
                    "{selectedOrderForReport.pathologistRemarks}"
                  </div>
                </div>
              )}

              {/* Signatures Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#334155' }}>Medical Laboratory Technologist</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Specimen Analysis Verified</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #94a3b8', width: '160px', margin: '0 auto 6px auto' }}></div>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>Dr. Consultant Pathologist</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MD (Pathology), DCP</div>
                </div>
              </div>

              {/* Fineprint */}
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center', marginTop: '1.5rem' }}>
                *** End of Diagnostic Investigation Report • Not valid for medico-legal purposes without authorized seal ***
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 4: ADD / EDIT LAB TEST PROFILE
      ══════════════════════════════════════════════════════════════════════════ */}
      {showAddTestModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddTestModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '650px',
              width: '95%',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              padding: '1.5rem',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FlaskConical size={20} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  {editingTest ? 'Edit Diagnostic Test Profile' : 'Add New Diagnostic Test Profile'}
                </h3>
              </div>
              <button className="btn-secondary" onClick={() => setShowAddTestModal(false)} style={{ padding: '0.35rem 0.65rem' }}>✕</button>
            </div>

            <form onSubmit={handleSaveTestCatalog}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Test Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Serum Ferritin"
                    value={testFormData.name}
                    onChange={e => setTestFormData({ ...testFormData, name: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Short Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FERR"
                    value={testFormData.code}
                    onChange={e => setTestFormData({ ...testFormData, code: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Category</label>
                  <select
                    value={testFormData.category}
                    onChange={e => setTestFormData({ ...testFormData, category: e.target.value })}
                    className="input-field"
                  >
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Serology">Serology</option>
                    <option value="Clinical Pathology">Clinical Pathology</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Radiology / Imaging">Radiology / Imaging</option>
                    <option value="Specialized">Specialized</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Standard Fee (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={testFormData.rate}
                    onChange={e => setTestFormData({ ...testFormData, rate: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Specimen Sample</label>
                  <input
                    type="text"
                    placeholder="e.g. Blood (Serum)"
                    value={testFormData.sampleType}
                    onChange={e => setTestFormData({ ...testFormData, sampleType: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Turnaround Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 2-4 Hours"
                    value={testFormData.turnaroundTime}
                    onChange={e => setTestFormData({ ...testFormData, turnaroundTime: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Clinical Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Iron deficiency evaluation"
                    value={testFormData.description}
                    onChange={e => setTestFormData({ ...testFormData, description: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Parameter Rows */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                    Parameters & Reference Ranges ({testFormData.parameters.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTestFormData({
                        ...testFormData,
                        parameters: [
                          ...testFormData.parameters,
                          { id: `p_${Date.now()}`, name: '', unit: '', defaultRange: '' }
                        ]
                      });
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    + Add Parameter Row
                  </button>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {testFormData.parameters.map((param, pIdx) => (
                    <div key={param.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Parameter Name"
                        value={param.name}
                        onChange={e => {
                          const updated = [...testFormData.parameters];
                          updated[pIdx].name = e.target.value;
                          setTestFormData({ ...testFormData, parameters: updated });
                        }}
                        className="input-field"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Unit (e.g. g/dL)"
                        value={param.unit}
                        onChange={e => {
                          const updated = [...testFormData.parameters];
                          updated[pIdx].unit = e.target.value;
                          setTestFormData({ ...testFormData, parameters: updated });
                        }}
                        className="input-field"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Normal Range (e.g. 12.0 - 17.5)"
                        value={param.defaultRange}
                        onChange={e => {
                          const updated = [...testFormData.parameters];
                          updated[pIdx].defaultRange = e.target.value;
                          setTestFormData({ ...testFormData, parameters: updated });
                        }}
                        className="input-field"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (testFormData.parameters.length > 1) {
                            setTestFormData({
                              ...testFormData,
                              parameters: testFormData.parameters.filter((_, idx) => idx !== pIdx)
                            });
                          }
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddTestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#4f46e5' }}>
                  Save Test Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
