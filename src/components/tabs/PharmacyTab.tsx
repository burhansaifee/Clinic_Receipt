import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Pill, Plus, Search, Filter, AlertTriangle, Clock,
  Printer, CheckCircle, RefreshCw,
  Trash2, Edit, ShoppingCart,
  Sparkles, Layers,
  Download, X, MessageCircle, PackagePlus
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import {
  storage,
  notifyDataChanged,
  type Medicine,
  type MedicineBatch,
  type PharmacySale,
  type PharmacySaleItem,
  type PharmacyDashboardMetrics,
  type Prescription,
  type GlobalPatientProfile,
  type HospitalIndent,
  formatAgeGender
} from '../../lib/storage';
import { SearchablePrescriptionSelect } from '../ui/SearchablePrescriptionSelect';
import { StockIndentingTab } from './StockIndentingTab';
import '../../styles/tabs/PharmacyTab.css';

interface PharmacyTabProps {
  onRefresh?: () => void;
}

export const PharmacyTab: React.FC<PharmacyTabProps> = () => {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'inventory' | 'batches' | 'sales' | 'indents'>('pos');
  
  // Data States
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [sales, setSales] = useState<PharmacySale[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [pendingIndents, setPendingIndents] = useState<HospitalIndent[]>([]);
  const [metrics, setMetrics] = useState<PharmacyDashboardMetrics>({
    totalInventoryValue: 0,
    totalCostValue: 0,
    totalUnits: 0,
    totalMedicines: 0,
    lowStockCount: 0,
    expiringCount: 0,
    todaySales: 0,
    todaySalesCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter States
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [salesSearch, setSalesSearch] = useState('');
  const [batchFilterMedicineId, setBatchFilterMedicineId] = useState<string>('All');

  // Modals
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [selectedMedForBatch, setSelectedMedForBatch] = useState<Medicine | null>(null);
  const [selectedSaleForView, setSelectedSaleForView] = useState<PharmacySale | null>(null);
  const [clinicProfile, setClinicProfile] = useState<{
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
    clinicEmail?: string;
    clinicUpiId?: string;
  }>({ clinicName: 'Buvora Clinic' });
  const [receiptPaperType, setReceiptPaperType] = useState<'A4' | 'A5' | 'A6' | 'Thermal80' | 'Thermal58'>('A5');

  // Form State: New Medicine
  const [medFormData, setMedFormData] = useState({
    name: '',
    genericName: '',
    category: 'Tablet',
    manufacturer: '',
    unit: 'Strip (10 Tab)',
    hsnCode: '',
    minStockAlert: 15,
    locationRack: '',
    notes: ''
  });

  // Form State: New Batch
  const [batchFormData, setBatchFormData] = useState({
    batchNumber: '',
    expiryDate: '',
    purchaseRate: '',
    salePrice: '',
    quantity: ''
  });

  // POS / Dispensary State
  const [posPatientName, setPosPatientName] = useState('');
  const [posPatientPhone, setPosPatientPhone] = useState('');
  const [posPatientId, setPosPatientId] = useState('');
  const [posSelectedRxId, setPosSelectedRxId] = useState('');
  const [posCart, setPosCart] = useState<PharmacySaleItem[]>([]);
  const [posDiscount, setPosDiscount] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'CASH' | 'ONLINE' | 'FREE'>('CASH');
  const [posNotes, setPosNotes] = useState('');
  const [posSearchTerm, setPosSearchTerm] = useState('');
  const [posPatientSuggestions, setPosPatientSuggestions] = useState<GlobalPatientProfile[]>([]);
  const [showPosPatientDropdown, setShowPosPatientDropdown] = useState(false);

  // Categories list
  const categories = ['All', 'Tablet', 'Capsule', 'Syrup', 'Injection', 'IV Fluid', 'Ointment', 'Drops', 'Inhaler', 'Surgical'];

  // Load all data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [medsData, batchesData, salesData, rxData, metricsData, indentsData, paperSettings, profileData] = await Promise.all([
        storage.getMedicines(),
        storage.getMedicineBatches(),
        storage.getPharmacySales({ limit: 100 }),
        storage.getPrescriptions(),
        storage.getPharmacyMetrics(),
        storage.getHospitalIndents ? storage.getHospitalIndents({ status: 'PENDING' }) : [],
        storage.getPrintPaperSettings().catch(() => ({ receiptPaper: 'A5' as const })),
        storage.getClinicProfile().catch(() => ({ clinicName: 'Buvora Clinic' }))
      ]);
      setMedicines(medsData);
      setBatches(batchesData);
      setSales(salesData);
      setPrescriptions(rxData);
      setMetrics(metricsData);
      setPendingIndents(indentsData || []);
      if (paperSettings?.receiptPaper) {
        setReceiptPaperType(paperSettings.receiptPaper as any);
      }
      if (profileData) {
        setClinicProfile(profileData);
      }
    } catch (err: any) {
      console.error('Failed to load pharmacy data:', err);
      toast('Failed to load pharmacy data', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = (e: any) => {
      const dt = e?.detail?.dataType;
      if (!dt || dt === 'medicines' || dt === 'prescriptions' || dt === 'sales' || dt === 'indents' || dt === 'all') {
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

  const handlePosPatientNameChange = async (val: string) => {
    setPosPatientName(val);
    if (val.trim().length >= 2) {
      try {
        const results = await storage.searchGlobalPatients(val.trim());
        setPosPatientSuggestions(results || []);
        setShowPosPatientDropdown((results || []).length > 0);
      } catch (_) {
        setPosPatientSuggestions([]);
      }
    } else {
      setPosPatientSuggestions([]);
      setShowPosPatientDropdown(false);
    }
  };

  const handleSelectPosPatient = (p: GlobalPatientProfile) => {
    setPosPatientName(p.patientName);
    setPosPatientPhone(p.patientPhone || '');
    setPosPatientId(p.patientUhid || p.patientId || '');
    setShowPosPatientDropdown(false);

    // Look for matching prescription by phone, id, or name
    const cleanPhone = p.patientPhone?.trim();
    const cleanId = (p.patientUhid || p.patientId || '').trim().toLowerCase();
    const cleanName = p.patientName.trim().toLowerCase();

    const matchingRx = prescriptions.find(rx => {
      if (cleanPhone && rx.patientPhone && rx.patientPhone.trim() === cleanPhone) return true;
      if (cleanId && ((rx.patientId && rx.patientId.toLowerCase() === cleanId) || (rx.pid && rx.pid.toLowerCase() === cleanId))) return true;
      if (cleanName && rx.patientName.toLowerCase().trim() === cleanName) return true;
      return false;
    });

    if (matchingRx) {
      handleLoadPrescription(matchingRx.id);
      toast(`Auto-loaded prescription #${matchingRx.receiptNumber || matchingRx.id} for ${p.patientName}!`, { type: 'success' });
    }
  };

  // Filtered inventory
  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      const matchesSearch = inventorySearch === '' ||
        m.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        (m.genericName && m.genericName.toLowerCase().includes(inventorySearch.toLowerCase())) ||
        (m.manufacturer && m.manufacturer.toLowerCase().includes(inventorySearch.toLowerCase())) ||
        (m.locationRack && m.locationRack.toLowerCase().includes(inventorySearch.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [medicines, inventorySearch, selectedCategory]);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (batchFilterMedicineId === 'All') return true;
      return b.medicineId === batchFilterMedicineId;
    });
  }, [batches, batchFilterMedicineId]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (!salesSearch.trim()) return true;
      const q = salesSearch.toLowerCase();
      return s.saleNumber.toLowerCase().includes(q) ||
        s.patientName.toLowerCase().includes(q) ||
        (s.patientPhone && s.patientPhone.includes(q)) ||
        (s.patientId && s.patientId.toLowerCase().includes(q));
    });
  }, [sales, salesSearch]);

  // Handle Save Medicine
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medFormData.name.trim()) {
      toast('Please enter medicine name', { type: 'error' });
      return;
    }
    try {
      const medPayload: Medicine = {
        id: editingMed ? editingMed.id : '',
        name: medFormData.name.trim(),
        genericName: medFormData.genericName.trim() || undefined,
        category: medFormData.category,
        manufacturer: medFormData.manufacturer.trim() || undefined,
        unit: medFormData.unit.trim() || 'Strip',
        hsnCode: medFormData.hsnCode.trim() || undefined,
        minStockAlert: Number(medFormData.minStockAlert) || 10,
        locationRack: medFormData.locationRack.trim() || undefined,
        notes: medFormData.notes.trim() || undefined
      };
      await storage.saveMedicine(medPayload);
      toast(editingMed ? 'Medicine updated successfully' : 'Medicine formulation added', { type: 'success' });
      setShowAddMedModal(false);
      setEditingMed(null);
      setMedFormData({
        name: '',
        genericName: '',
        category: 'Tablet',
        manufacturer: '',
        unit: 'Strip (10 Tab)',
        hsnCode: '',
        minStockAlert: 15,
        locationRack: '',
        notes: ''
      });
      loadData();
    } catch (err: any) {
      toast('Failed to save medicine: ' + err.message, { type: 'error' });
    }
  };

  // Handle Save Batch
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedForBatch) return;
    if (!batchFormData.batchNumber.trim()) {
      toast('Please enter batch number', { type: 'error' });
      return;
    }
    if (!batchFormData.expiryDate) {
      toast('Please select expiry date', { type: 'error' });
      return;
    }
    const qty = Number(batchFormData.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast('Please enter a valid stock quantity', { type: 'error' });
      return;
    }
    const price = Number(batchFormData.salePrice);
    if (isNaN(price) || price < 0) {
      toast('Please enter a valid sale price', { type: 'error' });
      return;
    }

    try {
      const batchPayload: MedicineBatch = {
        id: '',
        medicineId: selectedMedForBatch.id,
        batchNumber: batchFormData.batchNumber.trim().toUpperCase(),
        expiryDate: batchFormData.expiryDate,
        purchaseRate: Number(batchFormData.purchaseRate) || 0,
        salePrice: price,
        quantity: qty
      };
      await storage.saveMedicineBatch(batchPayload);
      toast(`Stock batch ${batchPayload.batchNumber} added for ${selectedMedForBatch.name}`, { type: 'success' });
      setShowAddBatchModal(false);
      setSelectedMedForBatch(null);
      setBatchFormData({
        batchNumber: '',
        expiryDate: '',
        purchaseRate: '',
        salePrice: '',
        quantity: ''
      });
      loadData();
    } catch (err: any) {
      toast('Failed to save batch: ' + err.message, { type: 'error' });
    }
  };

  // Quick Stock Adjustment (+ or -)
  const handleStockAdjust = async (batch: MedicineBatch, diff: number) => {
    try {
      await storage.adjustMedicineStock(batch.id, diff);
      toast(`Stock updated for ${batch.batchNumber}`, { type: 'success' });
      loadData();
    } catch (err: any) {
      toast('Failed to adjust stock', { type: 'error' });
    }
  };

  // POS: Load Prescribed Medicines into Cart
  const handleLoadPrescription = (rxId: string) => {
    setPosSelectedRxId(rxId);
    if (!rxId) {
      setPosPatientName('');
      setPosPatientPhone('');
      setPosPatientId('');
      setPosCart([]);
      return;
    }
    const rx = prescriptions.find(p => p.id === rxId);
    if (!rx) return;

    setPosPatientName(rx.patientName);
    setPosPatientPhone(rx.patientPhone || '');
    setPosPatientId(rx.patientId || rx.pid || '');

    const newCartItems: PharmacySaleItem[] = [];

    (rx.medicines || []).forEach(pm => {
      const matched = medicines.find(m => m.name.toLowerCase() === pm.name.trim().toLowerCase());
      if (matched) {
        const medBatches = batches.filter(b => b.medicineId === matched.id && b.quantity > 0)
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
        const chosenBatch = medBatches[0];
        const price = chosenBatch ? chosenBatch.salePrice : (matched.minPrice || 0);

        newCartItems.push({
          medicineId: matched.id,
          batchId: chosenBatch ? chosenBatch.id : undefined,
          batchNumber: chosenBatch ? chosenBatch.batchNumber : undefined,
          name: matched.name,
          genericName: matched.genericName,
          quantity: 1,
          salePrice: price,
          amount: price
        });
      } else {
        newCartItems.push({
          medicineId: '',
          name: pm.name,
          quantity: 1,
          salePrice: 0,
          amount: 0
        });
      }
    });

    setPosCart(newCartItems);
    toast(`Loaded ${newCartItems.length} prescribed medicines for ${rx.patientName}`, { type: 'success' });
  };

  // POS: Add medicine directly to cart
  const handleAddToCart = (med: Medicine) => {
    const medBatches = batches.filter(b => b.medicineId === med.id && b.quantity > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const chosenBatch = medBatches[0];
    const price = chosenBatch ? chosenBatch.salePrice : (med.minPrice || 0);

    const existingIndex = posCart.findIndex(item => item.medicineId === med.id);
    if (existingIndex >= 0) {
      const updated = [...posCart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].amount = updated[existingIndex].quantity * updated[existingIndex].salePrice;
      setPosCart(updated);
    } else {
      setPosCart(prev => [
        ...prev,
        {
          medicineId: med.id,
          batchId: chosenBatch ? chosenBatch.id : undefined,
          batchNumber: chosenBatch ? chosenBatch.batchNumber : undefined,
          name: med.name,
          genericName: med.genericName,
          quantity: 1,
          salePrice: price,
          amount: price
        }
      ]);
    }
  };

  // POS: Update item quantity or price
  const handleUpdateCartItem = (index: number, field: 'quantity' | 'salePrice', val: number) => {
    const updated = [...posCart];
    const item = updated[index];
    if (field === 'quantity') {
      item.quantity = Math.max(1, val);
    } else if (field === 'salePrice') {
      item.salePrice = Math.max(0, val);
    }
    item.amount = item.quantity * item.salePrice;
    setPosCart(updated);
  };

  // POS: Remove item from cart
  const handleRemoveCartItem = (index: number) => {
    setPosCart(prev => prev.filter((_, i) => i !== index));
  };

  // POS Totals
  const posSubtotal = useMemo(() => {
    return posCart.reduce((sum, item) => sum + item.amount, 0);
  }, [posCart]);

  const posTotal = useMemo(() => {
    if (posPaymentMethod === 'FREE') return 0;
    return Math.max(0, posSubtotal - posDiscount);
  }, [posSubtotal, posDiscount, posPaymentMethod]);

  // POS: Complete Sale & Dispense
  const handleCompleteSale = async () => {
    if (posCart.length === 0) {
      toast('Cart is empty. Please add medicines to dispense.', { type: 'error' });
      return;
    }
    if (!posPatientName.trim()) {
      toast('Please enter customer / patient name', { type: 'error' });
      return;
    }

    try {
      const salePayload: PharmacySale = {
        id: '',
        saleNumber: '',
        patientId: posPatientId.trim() || undefined,
        patientName: posPatientName.trim(),
        patientPhone: posPatientPhone.trim() || undefined,
        prescriptionId: posSelectedRxId || undefined,
        date: format(new Date(), 'yyyy-MM-dd HH:mm'),
        items: posCart,
        subtotal: posSubtotal,
        discount: posDiscount,
        tax: 0,
        total: posTotal,
        paymentMethod: posPaymentMethod,
        dispensedBy: 'Hospital Pharmacist',
        notes: posNotes.trim() || undefined
      };

      const savedSale = await storage.savePharmacySale(salePayload);
      toast(`✅ Medicines dispensed! Bill #${savedSale.saleNumber} generated.`, { type: 'success' });

      // Open print preview modal
      setSelectedSaleForView(savedSale);

      // Reset POS
      setPosCart([]);
      setPosPatientName('');
      setPosPatientPhone('');
      setPosPatientId('');
      setPosSelectedRxId('');
      setPosDiscount(0);
      setPosNotes('');
      loadData();
    } catch (err: any) {
      toast('Failed to complete dispensary sale: ' + err.message, { type: 'error' });
    }
  };

  // Quick WhatsApp receipt for sale
  const handleShareWhatsApp = (sale: PharmacySale) => {
    const phone = sale.patientPhone?.replace(/[^0-9]/g, '') || '';
    if (!phone) {
      toast('No patient phone number available for WhatsApp', { type: 'error' });
      return;
    }
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    let msg = `*🏥 HOSPITAL PHARMACY DISPENSATION RECEIPT*\n`;
    msg += `*Bill No:* ${sale.saleNumber}\n`;
    msg += `*Date:* ${sale.date}\n`;
    msg += `*Patient:* ${sale.patientName} ${sale.patientId ? `(UHID: ${sale.patientId})` : ''}\n`;
    msg += `--------------------------------\n`;
    sale.items.forEach((item, idx) => {
      msg += `${idx + 1}. *${item.name}*\n`;
      msg += `   Qty: ${item.quantity} × ₹${item.salePrice} = ₹${item.amount}\n`;
      if (item.batchNumber) msg += `   Batch: ${item.batchNumber}\n`;
    });
    msg += `--------------------------------\n`;
    msg += `*Subtotal:* ₹${sale.subtotal}\n`;
    if (sale.discount) msg += `*Discount:* -₹${sale.discount}\n`;
    msg += `*Net Amount Paid:* ₹${sale.total} (${sale.paymentMethod})\n\n`;
    msg += `_Thank you for choosing our clinic pharmacy. Wish you a speedy recovery!_`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    if (window.system?.openExternal) {
      window.system.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div className="pharmacy-workstation animate-fade-in no-print" style={{ padding: '0 0.5rem' }}>
      {/* ── TOP KPI METRIC CARDS ────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="kpi-card" style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
          borderRadius: '16px',
          padding: '1.2rem',
          color: '#ffffff',
          boxShadow: '0 8px 20px -6px rgba(14, 165, 233, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Inventory Valuation
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.35rem' }}>
                ₹{metrics.totalInventoryValue.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '0.2rem' }}>
                {metrics.totalUnits} Total Units in Stock
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.6rem', borderRadius: '12px' }}>
              <Layers size={22} color="#fff" />
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '16px',
          padding: '1.2rem',
          color: '#ffffff',
          boxShadow: '0 8px 20px -6px rgba(16, 185, 129, 0.4)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Today's Dispensation
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.35rem' }}>
                ₹{metrics.todaySales.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '0.2rem' }}>
                {metrics.todaySalesCount} Bills Dispensed Today
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.6rem', borderRadius: '12px' }}>
              <ShoppingCart size={22} color="#fff" />
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{
          background: metrics.lowStockCount > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
          borderRadius: '16px',
          padding: '1.2rem',
          color: '#ffffff',
          boxShadow: '0 8px 20px -6px rgba(245, 158, 11, 0.35)',
          cursor: 'pointer'
        }} onClick={() => setActiveSubTab('inventory')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Low Stock Radar
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.35rem' }}>
                {metrics.lowStockCount} Items
              </div>
              <div style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '0.2rem' }}>
                {metrics.lowStockCount > 0 ? 'Restocking required soon' : 'All stocks healthy'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.6rem', borderRadius: '12px' }}>
              <AlertTriangle size={22} color="#fff" />
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{
          background: metrics.expiringCount > 0 ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: '16px',
          padding: '1.2rem',
          color: '#ffffff',
          boxShadow: '0 8px 20px -6px rgba(239, 68, 68, 0.35)',
          cursor: 'pointer'
        }} onClick={() => setActiveSubTab('batches')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Expiring Batches (≤60d)
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.35rem' }}>
                {metrics.expiringCount} Batches
              </div>
              <div style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '0.2rem' }}>
                {metrics.expiringCount > 0 ? 'Action needed: FIFO dispense' : 'Zero near-expiry items'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.6rem', borderRadius: '12px' }}>
              <Clock size={22} color="#fff" />
            </div>
          </div>
        </div>
      </div>

      {/* ── PENDING WARD INDENTS ALERT BANNER ─────────────────────────── */}
      {pendingIndents.length > 0 && activeSubTab !== 'indents' && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '0.75rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#1e40af',
          fontSize: '0.875rem',
          boxShadow: '0 2px 8px rgba(37,99,235,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.25rem' }}>📦</span>
            <div>
              <strong>{pendingIndents.length} Ward / OT Requisition{pendingIndents.length > 1 ? 's' : ''} Pending:</strong>{' '}
              {pendingIndents[0].sourceLocation} requested medicines &amp; consumables.
            </div>
          </div>
          <button
            onClick={() => setActiveSubTab('indents')}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <PackagePlus size={15} />
            <span>Fulfill Indents</span>
          </button>
        </div>
      )}

      {/* ── NAVIGATION SUB-TABS ────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0.75rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
          <button
            onClick={() => setActiveSubTab('pos')}
            style={{
              padding: '0.5rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'pos' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'pos' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeSubTab === 'pos' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <ShoppingCart size={16} />
            <span>Dispensary &amp; POS</span>
          </button>

          <button
            onClick={() => setActiveSubTab('inventory')}
            style={{
              padding: '0.5rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'inventory' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'inventory' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeSubTab === 'inventory' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Pill size={16} />
            <span>Medicine Inventory ({medicines.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('batches')}
            style={{
              padding: '0.5rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'batches' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'batches' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeSubTab === 'batches' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Clock size={16} />
            <span>Batches &amp; Expiry ({batches.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('sales')}
            style={{
              padding: '0.5rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'sales' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'sales' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeSubTab === 'sales' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Printer size={16} />
            <span>Sales &amp; Dispensation Log</span>
          </button>

          <button
            onClick={() => setActiveSubTab('indents')}
            style={{
              padding: '0.5rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'indents' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'indents' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeSubTab === 'indents' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <PackagePlus size={16} />
            <span>Ward &amp; OT Indents</span>
            {pendingIndents.length > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {pendingIndents.length}
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={loadData}
            title="Refresh"
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => storage.exportPharmacyToCSV(medicines)}
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              cursor: 'pointer',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              setEditingMed(null);
              setMedFormData({
                name: '',
                genericName: '',
                category: 'Tablet',
                manufacturer: '',
                unit: 'Strip (10 Tab)',
                hsnCode: '',
                minStockAlert: 15,
                locationRack: '',
                notes: ''
              });
              setActiveSubTab('inventory');
              setShowAddMedModal(true);
            }}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={15} />
            <span>+ Add Medicine</span>
          </button>
        </div>
      </div>

      {/* ── INLINE: VIEW & PRINT PHARMACY BILL SLIP ─────────────────────── */}
      {selectedSaleForView && (
        <div
          className="card no-print animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
          }}
        >
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                <Printer size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Pharmacy Dispensation Slip
                  </h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
                    Bill #{selectedSaleForView.saleNumber || selectedSaleForView.id || 'PH-SALE'}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={12} /> Dispensed &amp; Billed
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  {clinicProfile.clinicName || 'Buvora Hospital & Clinic'} • {selectedSaleForView.date}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleShareWhatsApp(selectedSaleForView)}
                style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Send Bill via WhatsApp"
              >
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Print Dispensation Receipt Slip"
              >
                <Printer size={15} /> Print Slip
              </button>
              <button
                type="button"
                onClick={() => setSelectedSaleForView(null)}
                style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Close Slip"
              >
                <X size={15} /> Close Slip
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
            {/* Left: Dispensed Medicines Table */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Dispensed Items ({selectedSaleForView.items.length})</span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'none', fontWeight: 600 }}>Hospital Formulary</span>
              </div>
              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ paddingBottom: '6px' }}>Medicine</th>
                      <th style={{ textAlign: 'center', paddingBottom: '6px' }}>Qty</th>
                      <th style={{ textAlign: 'right', paddingBottom: '6px' }}>Rate</th>
                      <th style={{ textAlign: 'right', paddingBottom: '6px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSaleForView.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '6px 0' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                          {item.batchNumber && <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Batch: {item.batchNumber}</span>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', color: '#475569' }}>₹{item.salePrice}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Meta & Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Patient & Doctor Meta Card */}
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Patient:</span>
                  <strong style={{ color: '#0f172a' }}>{selectedSaleForView.patientName}</strong>
                </div>
                {selectedSaleForView.patientId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>UHID:</span>
                    <strong style={{ color: '#0284c7' }}>{selectedSaleForView.patientId}</strong>
                  </div>
                )}
                {selectedSaleForView.patientPhone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Phone:</span>
                    <span>{selectedSaleForView.patientPhone}</span>
                  </div>
                )}
                {(() => {
                  const linkedRx = prescriptions.find(p => p.id === selectedSaleForView.prescriptionId);
                  if (linkedRx?.doctorName) {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>Doctor:</span>
                        <span>{linkedRx.doctorName}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Financial Totals Card */}
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Subtotal:</span>
                  <span>₹{selectedSaleForView.subtotal}</span>
                </div>
                {Boolean(selectedSaleForView.discount) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                    <span>Discount / Concession:</span>
                    <span>-₹{selectedSaleForView.discount}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '2px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Total Amount Paid:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0284c7' }}>₹{selectedSaleForView.total}</span>
                    <span style={{ fontSize: '0.72rem', background: '#0284c7', color: '#fff', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
                      {selectedSaleForView.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── INLINE: ADD / EDIT MEDICINE FORMULATION ─────────────────────── */}
      {showAddMedModal && (
        <div
          className="card form-card no-print animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                {editingMed ? 'Edit Medicine Formulation' : '+ Add New Medicine Formulation'}
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                {editingMed ? `Update formulation parameters for ${editingMed.name}` : 'Register a new drug formulation into the pharmacy inventory catalog'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAddMedModal(false); setEditingMed(null); }}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              title="Close form"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveMedicine}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Medicine Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol 500mg, Augmentin 625 Duo"
                  value={medFormData.name}
                  onChange={e => setMedFormData({ ...medFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Generic Formulation / Molecule
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acetaminophen, Amoxicillin"
                  value={medFormData.genericName}
                  onChange={e => setMedFormData({ ...medFormData, genericName: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Category
                </label>
                <select
                  value={medFormData.category}
                  onChange={e => setMedFormData({ ...medFormData, category: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                >
                  {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Dispensing Unit
                </label>
                <input
                  type="text"
                  placeholder="Strip (10 Tab), Bottle (100ml)"
                  value={medFormData.unit}
                  onChange={e => setMedFormData({ ...medFormData, unit: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Manufacturer / Brand
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cipla, Sun Pharma, GSK"
                  value={medFormData.manufacturer}
                  onChange={e => setMedFormData({ ...medFormData, manufacturer: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Rack / Shelf Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rack A-04, Fridge 2"
                  value={medFormData.locationRack}
                  onChange={e => setMedFormData({ ...medFormData, locationRack: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Min Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  value={medFormData.minStockAlert}
                  onChange={e => setMedFormData({ ...medFormData, minStockAlert: parseInt(e.target.value) || 10 })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => { setShowAddMedModal(false); setEditingMed(null); }}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', fontWeight: 700 }}
              >
                {editingMed ? 'Update Formulation' : 'Save Formulation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── INLINE: ADD BATCH STOCK ─────────────────────────────────────── */}
      {showAddBatchModal && selectedMedForBatch && (
        <div
          className="card form-card no-print animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                + Inward Stock Batch
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#0284c7', fontWeight: 700 }}>
                {selectedMedForBatch.name} ({selectedMedForBatch.unit})
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAddBatchModal(false); setSelectedMedForBatch(null); }}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              title="Close form"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveBatch}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Batch Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BATCH-24A"
                  value={batchFormData.batchNumber}
                  onChange={e => setBatchFormData({ ...batchFormData, batchNumber: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem', textTransform: 'uppercase' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Expiry Date (YYYY-MM) *
                </label>
                <input
                  type="month"
                  required
                  value={batchFormData.expiryDate}
                  onChange={e => setBatchFormData({ ...batchFormData, expiryDate: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Inward Quantity (Units) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 100"
                  value={batchFormData.quantity}
                  onChange={e => setBatchFormData({ ...batchFormData, quantity: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Sale MRP (₹ per unit) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="e.g. 45"
                  value={batchFormData.salePrice}
                  onChange={e => setBatchFormData({ ...batchFormData, salePrice: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Purchase Rate (₹ per unit, for accounting)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 30"
                  value={batchFormData.purchaseRate}
                  onChange={e => setBatchFormData({ ...batchFormData, purchaseRate: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => { setShowAddBatchModal(false); setSelectedMedForBatch(null); }}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', fontWeight: 700 }}
              >
                Record Stock Inward
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SUB-TAB 1: DISPENSARY & POS ─────────────────────────────────── */}
      {activeSubTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left Column: Prescription Loader & Quick Catalog */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={18} color="#0284c7" />
                  <span>1-Click Doctor Prescription Fulfillment</span>
                </h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                  Select patient consultation to auto-populate prescribed drugs &amp; dosages
                </p>
              </div>
            </div>

            {/* Prescription Picker */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Recent Prescriptions Today / Waiting:
              </label>
              <SearchablePrescriptionSelect
                prescriptions={prescriptions}
                selectedRxId={posSelectedRxId}
                onSelectRx={handleLoadPrescription}
              />
            </div>

            {/* OTC Fast Catalog Search */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                  Or Direct Counter Search (Walk-In):
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Click to add to bill
                </span>
              </div>
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by brand name, generic or category..."
                  value={posSearchTerm}
                  onChange={e => setPosSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem 0.55rem 2.2rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    fontSize: '0.825rem',
                    background: '#f8fafc'
                  }}
                />
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {medicines
                  .filter(m => !posSearchTerm.trim() || m.name.toLowerCase().includes(posSearchTerm.toLowerCase()) || m.genericName?.toLowerCase().includes(posSearchTerm.toLowerCase()))
                  .slice(0, 10)
                  .map(med => {
                    const stock = med.currentStock || 0;
                    return (
                      <div
                        key={med.id}
                        onClick={() => handleAddToCart(med)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.85rem',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease'
                        }}
                        className="hover-shadow-sm"
                      >
                        <div>
                          <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1e293b' }}>
                            {med.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {med.genericName || med.category} • Rack: {med.locationRack || 'General'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0284c7' }}>
                            ₹{med.minPrice || 0}
                          </div>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: stock > 0 ? '#dcfce7' : '#fee2e2',
                            color: stock > 0 ? '#15803d' : '#b91c1c'
                          }}>
                            {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Right Column: Active Dispensary Cart & Checkout */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '6px', borderRadius: '8px' }}>
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    Dispensary Cart ({posCart.length} item{posCart.length !== 1 ? 's' : ''})
                  </h3>
                </div>
              </div>
              {posCart.length > 0 && (
                <button
                  onClick={() => setPosCart([])}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Patient Header Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                  Patient / Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma (Search global clinic database)"
                  value={posPatientName}
                  onChange={e => handlePosPatientNameChange(e.target.value)}
                  onFocus={() => {
                    if (posPatientName.trim().length >= 2) setShowPosPatientDropdown(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowPosPatientDropdown(false), 200);
                  }}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                />

                {showPosPatientDropdown && posPatientSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                    zIndex: 1000,
                    marginTop: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}>
                    {posPatientSuggestions.map(p => (
                      <div
                        key={p.patientUhid || p.patientId || p.patientPhone || p.patientName}
                        onMouseDown={e => {
                          e.preventDefault();
                          handleSelectPosPatient(p);
                        }}
                        onClick={() => handleSelectPosPatient(p)}
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
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                  Phone (for WhatsApp Bill)
                </label>
                <input
                  type="text"
                  placeholder="10-digit mobile"
                  value={posPatientPhone}
                  onChange={e => setPosPatientPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* Cart Table */}
            <div style={{ minHeight: '160px', maxHeight: '260px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
              {posCart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                  <ShoppingCart size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.825rem' }}>No medicines added to dispensary cart.</p>
                  <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Pick a prescription or search drugs on the left</span>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '0.45rem 0.4rem', width: '60px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '0.45rem 0.4rem', width: '70px', textAlign: 'right' }}>Rate (₹)</th>
                      <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '0.45rem 0.4rem', width: '30px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {posCart.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.name}</div>
                          {item.batchNumber && (
                            <span style={{ fontSize: '0.65rem', color: '#0284c7', background: '#f0f9ff', padding: '1px 4px', borderRadius: '4px' }}>
                              Batch: {item.batchNumber}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleUpdateCartItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            style={{ width: '50px', padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            value={item.salePrice}
                            onChange={e => handleUpdateCartItem(idx, 'salePrice', parseFloat(e.target.value) || 0)}
                            style={{ width: '60px', padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ₹{item.amount}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRemoveCartItem(idx)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Financial Totals & Payment Method */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '0.85rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                <span>Gross Subtotal:</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>₹{posSubtotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>
                <span>Discount / Concession (₹):</span>
                <input
                  type="number"
                  min="0"
                  value={posDiscount}
                  onChange={e => setPosDiscount(Number(e.target.value) || 0)}
                  style={{ width: '75px', padding: '0.2rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', textAlign: 'right' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Net Total Due:</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7' }}>₹{posTotal}</span>
              </div>
            </div>

            {/* Payment Method Segmented Pills */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Payment Method
              </label>
              <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
                {(['CASH', 'ONLINE', 'FREE'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPosPaymentMethod(mode)}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: posPaymentMethod === mode ? (mode === 'FREE' ? '#10b981' : '#0284c7') : 'transparent',
                      color: posPaymentMethod === mode ? '#fff' : '#64748b',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    {mode === 'ONLINE' ? 'UPI / QR' : mode === 'FREE' ? 'Free / Waived' : 'Cash'}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <button
              className="btn-primary"
              onClick={handleCompleteSale}
              disabled={posCart.length === 0}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: posCart.length === 0 ? 0.5 : 1,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              <CheckCircle size={18} />
              <span>Dispense &amp; Generate Bill (₹{posTotal})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: MEDICINE INVENTORY ───────────────────────────────── */}
      {activeSubTab === 'inventory' && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search formulations by name, generic, rack..."
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.85rem 0.55rem 2.2rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={16} color="#64748b" />
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Medicine Formulation</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Category</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Unit</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Rack / Shelf</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Stock Status</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Price (₹)</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedicines.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No medicines match your search.
                    </td>
                  </tr>
                ) : (
                  filteredMedicines.map(med => {
                    const stock = med.currentStock || 0;
                    const isLow = stock <= med.minStockAlert;
                    return (
                      <tr key={med.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-bg-slate">
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{med.name}</div>
                          {med.genericName ? `Generic: ${med.genericName}` : ''} {med.manufacturer ? `• ${med.manufacturer}` : ''}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>
                            {med.category}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#475569', textAlign: 'center' }}>
                          {med.unit}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>
                          <span style={{ fontWeight: 600, color: '#0284c7' }}>
                            {med.locationRack || 'General'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: stock === 0 ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7',
                            color: stock === 0 ? '#b91c1c' : isLow ? '#b45309' : '#15803d'
                          }}>
                            {stock === 0 ? 'Out of Stock' : `${stock} Units`}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>
                          {med.minPrice ? `₹${med.minPrice}` : 'N/A'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setSelectedMedForBatch(med);
                                setShowAddBatchModal(true);
                              }}
                              style={{
                                background: '#f0f9ff',
                                color: '#0284c7',
                                border: '1px solid #bae6fd',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              + Batch
                            </button>
                            <button
                              onClick={() => {
                                setEditingMed(med);
                                setMedFormData({
                                  name: med.name,
                                  genericName: med.genericName || '',
                                  category: med.category,
                                  manufacturer: med.manufacturer || '',
                                  unit: med.unit,
                                  hsnCode: med.hsnCode || '',
                                  minStockAlert: med.minStockAlert,
                                  locationRack: med.locationRack || '',
                                  notes: med.notes || ''
                                });
                                setShowAddMedModal(true);
                              }}
                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '3px' }}
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={async () => {
                                if (await confirm(`Are you sure you want to delete formulation "${med.name}"?`)) {
                                  await storage.deleteMedicine(med.id);
                                  toast('Medicine deleted', { type: 'success' });
                                  loadData();
                                }
                              }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px' }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 3: BATCHES & EXPIRY RADAR ───────────────────────────── */}
      {activeSubTab === 'batches' && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                Batch Inventory &amp; Expiry Surveillance
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Filter Formulation:</span>
              <select
                value={batchFilterMedicineId}
                onChange={e => setBatchFilterMedicineId(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                <option value="All">All Medicines ({batches.length} batches)</option>
                {medicines.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Medicine</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Batch Number</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Expiry Date</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Purchase Cost</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Sale MRP</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Stock Quantity</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Quick Adjust</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No batches recorded yet. Add a batch from the Inventory tab.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(b => {
                    const todayStr = format(new Date(), 'yyyy-MM');
                    const isExpired = b.expiryDate < todayStr;
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#1e293b', textAlign: 'left' }}>
                          {b.medicineName || 'Medicine'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                            {b.batchNumber}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            background: isExpired ? '#fee2e2' : '#f0fdf4',
                            color: isExpired ? '#b91c1c' : '#166534'
                          }}>
                            {isExpired ? `⚠️ Expired (${b.expiryDate})` : b.expiryDate}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#64748b', textAlign: 'right' }}>
                          ₹{b.purchaseRate}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>
                          ₹{b.salePrice}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: b.quantity > 0 ? '#0284c7' : '#ef4444' }}>
                            {b.quantity} Units
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <button
                              onClick={() => handleStockAdjust(b, 10)}
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              +10
                            </button>
                            <button
                              onClick={() => handleStockAdjust(b, -10)}
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              -10
                            </button>
                            <button
                              onClick={async () => {
                                if (await confirm(`Delete batch ${b.batchNumber}?`)) {
                                  await storage.deleteMedicineBatch(b.id);
                                  toast('Batch deleted', { type: 'success' });
                                  loadData();
                                }
                              }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 4: SALES & DISPENSATION LOG ────────────────────────── */}
      {activeSubTab === 'sales' && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search sales by bill number, patient name, UHID..."
                value={salesSearch}
                onChange={e => setSalesSearch(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.85rem 0.55rem 2.2rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Bill No</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Date &amp; Time</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Patient Name</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Items Dispensed</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Payment Mode</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No pharmacy sales recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(sale => (
                    <tr key={sale.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#0284c7', textAlign: 'left' }}>
                        {sale.saleNumber}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: '#64748b', fontSize: '0.75rem', textAlign: 'left' }}>
                        {sale.date}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{sale.patientName}</div>
                        {sale.patientId && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>UHID: {sale.patientId}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          {sale.items.length} Drug{sale.items.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: sale.paymentMethod === 'ONLINE' ? '#e0f2fe' : sale.paymentMethod === 'FREE' ? '#dcfce7' : '#fef3c7',
                          color: sale.paymentMethod === 'ONLINE' ? '#0369a1' : sale.paymentMethod === 'FREE' ? '#15803d' : '#b45309'
                        }}>
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>
                        ₹{sale.total}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedSaleForView(sale)}
                            style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            View Slip
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(sale)}
                            style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                            title="Send WhatsApp Bill"
                          >
                            WhatsApp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'indents' && (
        <div className="no-print animate-fade-in" style={{ marginTop: '0.5rem' }}>
          <StockIndentingTab />
        </div>
      )}

    </div>

    {/* ── DEDICATED PHARMACY DISPENSATION SLIP (PRINT-ONLY, EXACTLY 1 PAGE) ─── */}
    {selectedSaleForView && (
      <>
        {/* Dynamic @page style for accurate printer margins */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              ${receiptPaperType === 'Thermal80' ? '@page { size: 80mm auto; margin: 2mm 3mm; }' :
                receiptPaperType === 'Thermal58' ? '@page { size: 58mm auto; margin: 1mm 2mm; }' :
                receiptPaperType === 'A6' ? '@page { size: A6 portrait; margin: 0.5cm; }' :
                receiptPaperType === 'A4' ? '@page { size: A4 portrait; margin: 1cm; }' :
                '@page { size: A5 portrait; margin: 0.8cm; }'}
            }
          `
        }} />

        <div id="pharmacy-print-slip" className={`print-only paper-${receiptPaperType.toLowerCase()}`}>
          <div className="pharmacy-slip-container">
            <div className="pharmacy-slip-header">
              <h2 className="clinic-name">{clinicProfile.clinicName || 'BUVORA HOSPITAL & CLINIC'}</h2>
              {clinicProfile.clinicAddress && <p className="clinic-address">{clinicProfile.clinicAddress}</p>}
              {clinicProfile.clinicPhone && <p className="clinic-phone">Ph: {clinicProfile.clinicPhone}</p>}
              <div className="slip-title-bar">
                <span>PHARMACY DISPENSATION SLIP</span>
              </div>
            </div>

            <div className="pharmacy-slip-meta">
              <div className="meta-row">
                <span><strong>Bill No:</strong> {selectedSaleForView.saleNumber || selectedSaleForView.id || 'PH-1001'}</span>
                <span><strong>Date:</strong> {selectedSaleForView.date}</span>
              </div>
              <div className="meta-row">
                <span><strong>Patient:</strong> {selectedSaleForView.patientName} {selectedSaleForView.patientId ? `(${selectedSaleForView.patientId})` : ''}</span>
                {selectedSaleForView.patientPhone && <span><strong>Phone:</strong> {selectedSaleForView.patientPhone}</span>}
              </div>
              {(() => {
                const linkedRx = prescriptions.find(p => p.id === selectedSaleForView.prescriptionId);
                if (linkedRx?.doctorName) {
                  return (
                    <div className="meta-row">
                      <span><strong>Doctor:</strong> {linkedRx.doctorName}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <table className="pharmacy-slip-table">
              <thead>
                <tr>
                  <th style={{ width: '22px', textAlign: 'center' }}>#</th>
                  <th>Item Description</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '55px', textAlign: 'right' }}>Rate</th>
                  <th style={{ width: '60px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedSaleForView.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.batchNumber && <div className="item-batch">Batch: {item.batchNumber}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>₹{Number(item.salePrice).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}>Subtotal:</td>
                  <td style={{ textAlign: 'right' }}>₹{Number(selectedSaleForView.subtotal).toFixed(2)}</td>
                </tr>
                {Boolean(selectedSaleForView.discount) && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right' }}>Discount:</td>
                    <td style={{ textAlign: 'right' }}>-₹{Number(selectedSaleForView.discount).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="total-row">
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 800 }}>NET TOTAL PAID ({selectedSaleForView.paymentMethod}):</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.05em' }}>₹{Number(selectedSaleForView.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            {selectedSaleForView.notes && (
              <div className="pharmacy-slip-notes">
                <strong>Notes:</strong> {selectedSaleForView.notes}
              </div>
            )}

            <div className="pharmacy-slip-footer">
              <p>*** Wish You a Speedy Recovery ***</p>
              <p className="sub-foot">Medicines once sold cannot be returned without original bill • Computer Generated Slip</p>
            </div>
          </div>
        </div>
      </>
    )}
  </>
  );
};
