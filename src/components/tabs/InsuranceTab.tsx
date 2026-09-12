import React, { useState, useEffect } from 'react';
import {
  storage,
  type InsuranceClaim,
  type TpaProvider,
  type ClaimStatus,
  type InsuranceDashboardMetrics,
  type BedAdmission
} from '../../lib/storage';
import {
  ShieldCheck,
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Building2,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  ExternalLink,
  Edit2,
  MessageSquare,
  ArrowUpRight,
  User,
  Phone,
  Mail,
  X,
  Save,
  Check,
  Building
} from 'lucide-react';
import '../../styles/tabs/InsuranceTab.css';

export const InsuranceTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'CLAIMS' | 'PROVIDERS'>('CLAIMS');
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [providers, setProviders] = useState<TpaProvider[]>([]);
  const [admissions, setAdmissions] = useState<BedAdmission[]>([]);
  const [metrics, setMetrics] = useState<InsuranceDashboardMetrics>({
    totalClaims: 0,
    activeClaims: 0,
    pendingApprovals: 0,
    approvedTotalAmount: 0,
    settledTotalAmount: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Partial<InsuranceClaim> | null>(null);

  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<TpaProvider> | null>(null);

  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryClaim, setQueryClaim] = useState<InsuranceClaim | null>(null);
  const [queryDetails, setQueryDetails] = useState('');
  const [replyDetails, setReplyDetails] = useState('');

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusClaim, setStatusClaim] = useState<InsuranceClaim | null>(null);
  const [newStatus, setNewStatus] = useState<ClaimStatus>('PREAUTH_DRAFT');
  const [newApprovedAmount, setNewApprovedAmount] = useState<number>(0);
  const [newFinalAmount, setNewFinalAmount] = useState<number>(0);
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    loadData();
    const handleSync = (e: any) => {
      const dt = e?.detail?.dataType;
      if (!dt || dt === 'insurance' || dt === 'admission' || dt === 'all') {
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [claimsData, providersData, metricsData, admissionsData] = await Promise.all([
        storage.getInsuranceClaims(),
        storage.getTpaProviders(),
        storage.getInsuranceDashboardMetrics(),
        storage.getBedAdmissions({ status: 'admitted' })
      ]);
      setClaims(claimsData);
      setProviders(providersData);
      setMetrics(metricsData);
      setAdmissions(admissionsData);
    } catch (e) {
      console.error('Failed to load insurance data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClaims = claims.filter(claim => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      claim.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.policyNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (claim.patientUhid && claim.patientUhid.toLowerCase().includes(searchQuery.toLowerCase())) ||
      claim.tpaProviderName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Open Claim Modal
  const handleOpenNewClaim = () => {
    const defaultProvider = providers.length > 0 ? providers[0] : undefined;
    setEditingClaim({
      claimNumber: `CLM-${Math.floor(100000 + Math.random() * 900000)}`,
      patientName: '',
      tpaProviderId: defaultProvider?.id || '',
      tpaProviderName: defaultProvider?.name || '',
      insurerName: defaultProvider?.name || '',
      policyNumber: '',
      cardId: '',
      corporateName: '',
      sumInsured: 300000,
      initialPreAuthAmount: 50000,
      approvedAmount: 0,
      finalSettledAmount: 0,
      copayPercent: defaultProvider?.defaultCopayPercent || 0,
      nonPayableDeductions: 0,
      status: 'PREAUTH_DRAFT',
      notes: ''
    });
    setShowClaimModal(true);
  };

  const handleSelectAdmission = (admId: string) => {
    const adm = admissions.find(a => a.id === admId);
    if (adm && editingClaim) {
      setEditingClaim({
        ...editingClaim,
        admissionId: adm.id,
        patientId: adm.patientId,
        patientUhid: adm.patientUhid,
        patientName: adm.patientName,
        patientPhone: adm.patientPhone
      });
    }
  };

  const handleSaveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClaim || !editingClaim.patientName || !editingClaim.tpaProviderId) {
      alert('Please fill in Patient Name and select a TPA Provider.');
      return;
    }
    try {
      await storage.saveInsuranceClaim(editingClaim);
      setShowClaimModal(false);
      setEditingClaim(null);
      await loadData();
    } catch (e) {
      console.error('Failed to save claim:', e);
      alert('Failed to save insurance claim. Please try again.');
    }
  };

  // Status Modal Handlers
  const handleOpenStatusModal = (claim: InsuranceClaim) => {
    setStatusClaim(claim);
    setNewStatus(claim.status);
    setNewApprovedAmount(claim.approvedAmount || 0);
    setNewFinalAmount(claim.finalSettledAmount || claim.approvedAmount || 0);
    setStatusNotes(claim.notes || '');
    setShowStatusModal(true);
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusClaim) return;
    try {
      const updated: Partial<InsuranceClaim> = {
        ...statusClaim,
        status: newStatus,
        approvedAmount: Number(newApprovedAmount) || 0,
        finalSettledAmount: Number(newFinalAmount) || 0,
        notes: statusNotes
      };
      await storage.saveInsuranceClaim(updated);
      setShowStatusModal(false);
      setStatusClaim(null);
      await loadData();
    } catch (e) {
      console.error('Failed to update claim status:', e);
      alert('Error updating claim status.');
    }
  };

  // Query Modal Handlers
  const handleOpenQueryModal = (claim: InsuranceClaim) => {
    setQueryClaim(claim);
    setQueryDetails('');
    setReplyDetails('');
    setShowQueryModal(true);
  };

  const handleSaveQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryClaim || !queryDetails.trim()) {
      alert('Please enter query details from TPA.');
      return;
    }
    try {
      await storage.addClaimQuery(queryClaim.id, {
        queryDetails,
        replyDetails: replyDetails || undefined,
        repliedBy: 'Hospital Cashless Desk'
      });
      setShowQueryModal(false);
      setQueryClaim(null);
      await loadData();
    } catch (e) {
      console.error('Failed to record query:', e);
      alert('Failed to save query.');
    }
  };

  // Provider Modal Handlers
  const handleOpenNewProvider = () => {
    setEditingProvider({
      name: '',
      code: '',
      contactEmail: '',
      contactPhone: '',
      portalUrl: '',
      defaultCopayPercent: 0,
      isActive: true
    });
    setShowProviderModal(true);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider || !editingProvider.name) {
      alert('Please enter TPA / Insurer name.');
      return;
    }
    try {
      await storage.saveTpaProvider(editingProvider);
      setShowProviderModal(false);
      setEditingProvider(null);
      await loadData();
    } catch (e) {
      console.error('Failed to save provider:', e);
      alert('Failed to save provider.');
    }
  };

  const getStatusBadgeClass = (status: ClaimStatus) => {
    return `claim-badge claim-badge-${status}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="insurance-tab-container">
      {/* Header */}
      <div className="insurance-header">
        <div className="insurance-header-title-wrap">
          <div className="insurance-header-icon">
            <ShieldCheck />
          </div>
          <div>
            <h1 className="insurance-title">TPA & Health Insurance Claims Management</h1>
            <div className="insurance-subtitle">
              Hospital Cashless Desk &bull; Pre-Auth Approvals &bull; Enhancements &bull; TPA Query Settlement
            </div>
          </div>
        </div>

        <div className="insurance-header-actions">
          <button
            type="button"
            className="insurance-btn insurance-btn-secondary"
            onClick={loadData}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> Refresh
          </button>
          {activeSubTab === 'CLAIMS' ? (
            <button
              type="button"
              className="insurance-btn insurance-btn-primary"
              onClick={handleOpenNewClaim}
            >
              <Plus size={16} /> New Pre-Auth Claim
            </button>
          ) : (
            <button
              type="button"
              className="insurance-btn insurance-btn-primary"
              onClick={handleOpenNewProvider}
            >
              <Plus size={16} /> Add TPA / Insurer
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Banner */}
      <div className="insurance-metrics-grid">
        <div className="insurance-metric-card">
          <div className="insurance-metric-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
            <FileText size={22} />
          </div>
          <div>
            <div className="insurance-metric-val">{metrics.totalClaims}</div>
            <div className="insurance-metric-label">Total Claims Logged</div>
          </div>
        </div>

        <div className="insurance-metric-card">
          <div className="insurance-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="insurance-metric-val">{metrics.activeClaims}</div>
            <div className="insurance-metric-label">Active Cashless Inpatients</div>
          </div>
        </div>

        <div className="insurance-metric-card">
          <div className="insurance-metric-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div className="insurance-metric-val">{metrics.pendingApprovals}</div>
            <div className="insurance-metric-label">Pending / Query Raised</div>
          </div>
        </div>

        <div className="insurance-metric-card">
          <div className="insurance-metric-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="insurance-metric-val">{formatCurrency(metrics.approvedTotalAmount)}</div>
            <div className="insurance-metric-label">Total Approved Amount</div>
          </div>
        </div>

        <div className="insurance-metric-card">
          <div className="insurance-metric-icon" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#0d9488' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div className="insurance-metric-val">{formatCurrency(metrics.settledTotalAmount)}</div>
            <div className="insurance-metric-label">Total Settled Cashless</div>
          </div>
        </div>
      </div>

      {/* Navigation Subtabs & Filters */}
      <div className="insurance-nav-bar">
        <div className="insurance-nav-tabs">
          <button
            type="button"
            className={`insurance-nav-tab ${activeSubTab === 'CLAIMS' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('CLAIMS')}
          >
            <ShieldCheck size={16} /> Cashless Claims Desk ({claims.length})
          </button>
          <button
            type="button"
            className={`insurance-nav-tab ${activeSubTab === 'PROVIDERS' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('PROVIDERS')}
          >
            <Building2 size={16} /> TPA & Insurer Directory ({providers.length})
          </button>
        </div>

        {activeSubTab === 'CLAIMS' && (
          <div className="insurance-filter-row">
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="insurance-search-input"
                placeholder="Search patient, UHID, claim #..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="insurance-status-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PREAUTH_DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="QUERY_RAISED">Query Raised</option>
              <option value="INITIAL_APPROVED">Initial Approved</option>
              <option value="ENHANCEMENT_REQUESTED">Enhancement Req</option>
              <option value="FINAL_APPROVED">Final Approved</option>
              <option value="SETTLED">Settled</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'CLAIMS' ? (
        <div className="insurance-table-card">
          <div className="insurance-table-wrapper">
            <table className="insurance-table">
              <thead>
                <tr>
                  <th>Claim Number</th>
                  <th>Patient Details</th>
                  <th>TPA / Insurer</th>
                  <th>Policy / Card No.</th>
                  <th>Pre-Auth Req.</th>
                  <th>Approved Amt</th>
                  <th>Status</th>
                  <th>Settlement / Queries</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No insurance claims found. Click &ldquo;New Pre-Auth Claim&rdquo; to initiate a cashless case.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map(claim => {
                    let parsedQueries: any[] = [];
                    try {
                      parsedQueries = claim.queriesLog ? JSON.parse(claim.queriesLog) : [];
                    } catch (_) {}

                    return (
                      <tr key={claim.id}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-color)' }}>
                          {claim.claimNumber}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{claim.patientName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {claim.patientPhone || 'No phone'} {claim.patientUhid ? `• UHID: ${claim.patientUhid}` : ''}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{claim.tpaProviderName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {claim.corporateName ? `Corp: ${claim.corporateName}` : 'Retail Policy'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{claim.policyNumber}</div>
                          {claim.cardId && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              Card: {claim.cardId}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {formatCurrency(claim.initialPreAuthAmount || 0)}
                        </td>
                        <td style={{ fontWeight: 700, color: claim.approvedAmount > 0 ? '#059669' : 'inherit' }}>
                          {formatCurrency(claim.approvedAmount || 0)}
                        </td>
                        <td>
                          <span className={getStatusBadgeClass(claim.status)}>
                            {claim.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {parsedQueries.length > 0 ? (
                            <span style={{ fontSize: '0.8rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MessageSquare size={13} /> {parsedQueries.length} Query/Queries
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No queries</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="insurance-action-btn"
                              title="Update Status / Pre-Auth Amounts"
                              onClick={() => handleOpenStatusModal(claim)}
                            >
                              <Edit2 size={13} /> Update Status
                            </button>
                            <button
                              type="button"
                              className="insurance-action-btn"
                              title="Log TPA Query or Reply"
                              onClick={() => handleOpenQueryModal(claim)}
                            >
                              <MessageSquare size={13} /> Query
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
      ) : (
        /* Providers Directory */
        <div className="insurance-providers-grid">
          {providers.map(provider => (
            <div key={provider.id} className="insurance-provider-card">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="insurance-provider-title">{provider.name}</div>
                    <span className="insurance-provider-code">{provider.code}</span>
                  </div>
                  {provider.portalUrl && (
                    <a
                      href={provider.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0284c7', padding: '4px' }}
                      title="Open TPA Portal"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>

                <div className="insurance-provider-meta">
                  {provider.contactPhone && (
                    <div className="insurance-provider-meta-row">
                      <Phone size={14} /> <span>{provider.contactPhone}</span>
                    </div>
                  )}
                  {provider.contactEmail && (
                    <div className="insurance-provider-meta-row">
                      <Mail size={14} /> <span>{provider.contactEmail}</span>
                    </div>
                  )}
                  <div className="insurance-provider-meta-row">
                    <DollarSign size={14} /> <span>Default Co-pay: {provider.defaultCopayPercent || 0}%</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="insurance-action-btn"
                  onClick={() => {
                    setEditingProvider(provider);
                    setShowProviderModal(true);
                  }}
                >
                  <Edit2 size={13} /> Edit Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New / Edit Claim Modal */}
      {showClaimModal && editingClaim && (
        <div className="insurance-modal-overlay">
          <div className="insurance-modal">
            <div className="insurance-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {editingClaim.id ? 'Edit Insurance Claim' : 'Initiate New Pre-Auth Cashless Claim'}
              </h3>
              <button
                type="button"
                className="insurance-btn insurance-btn-secondary"
                style={{ padding: '0.4rem' }}
                onClick={() => setShowClaimModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveClaim}>
              <div className="insurance-modal-body">
                {/* Link Inpatient Admission */}
                {admissions.length > 0 && !editingClaim.id && (
                  <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)', textTransform: 'uppercase' }}>
                      Auto-Link Admitted Inpatient Bed:
                    </label>
                    <select
                      className="insurance-status-select"
                      style={{ width: '100%', marginTop: '0.35rem' }}
                      value={editingClaim.admissionId || ''}
                      onChange={e => handleSelectAdmission(e.target.value)}
                    >
                      <option value="">-- Select Active Admitted Patient (Optional) --</option>
                      {admissions.map(adm => (
                        <option key={adm.id} value={adm.id}>
                          {adm.patientName} &bull; Bed: {adm.bedNumber} ({adm.wardName}) &bull; IPD: {adm.admissionNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Patient Full Name *</label>
                    <input
                      type="text"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      required
                      value={editingClaim.patientName || ''}
                      onChange={e => setEditingClaim({ ...editingClaim, patientName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Patient Phone</label>
                    <input
                      type="text"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={editingClaim.patientPhone || ''}
                      onChange={e => setEditingClaim({ ...editingClaim, patientPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>TPA / Health Insurer *</label>
                    <select
                      className="insurance-status-select"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      required
                      value={editingClaim.tpaProviderId || ''}
                      onChange={e => {
                        const prov = providers.find(p => p.id === e.target.value);
                        setEditingClaim({
                          ...editingClaim,
                          tpaProviderId: e.target.value,
                          tpaProviderName: prov?.name || '',
                          insurerName: prov?.name || '',
                          copayPercent: prov?.defaultCopayPercent || 0
                        });
                      }}
                    >
                      <option value="">-- Select TPA / Insurer --</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Policy / Member ID Number *</label>
                    <input
                      type="text"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      required
                      placeholder="e.g. 0124/88921/2026"
                      value={editingClaim.policyNumber || ''}
                      onChange={e => setEditingClaim({ ...editingClaim, policyNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Card ID / Member No</label>
                    <input
                      type="text"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={editingClaim.cardId || ''}
                      onChange={e => setEditingClaim({ ...editingClaim, cardId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Corporate / Employer</label>
                    <input
                      type="text"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      placeholder="Optional"
                      value={editingClaim.corporateName || ''}
                      onChange={e => setEditingClaim({ ...editingClaim, corporateName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sum Insured (₹)</label>
                    <input
                      type="number"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={editingClaim.sumInsured || 0}
                      onChange={e => setEditingClaim({ ...editingClaim, sumInsured: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Initial Pre-Auth Requested (₹)</label>
                    <input
                      type="number"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={editingClaim.initialPreAuthAmount || 0}
                      onChange={e => setEditingClaim({ ...editingClaim, initialPreAuthAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Approved Amount (₹)</label>
                    <input
                      type="number"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={editingClaim.approvedAmount || 0}
                      onChange={e => setEditingClaim({ ...editingClaim, approvedAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Co-pay (%)</label>
                    <input
                      type="number"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={editingClaim.copayPercent || 0}
                      onChange={e => setEditingClaim({ ...editingClaim, copayPercent: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Remarks / Desk Notes</label>
                  <textarea
                    className="insurance-search-input"
                    style={{ width: '100%', marginTop: '0.25rem', minHeight: '60px' }}
                    placeholder="Diagnosis, pre-existing conditions, claim reference notes..."
                    value={editingClaim.notes || ''}
                    onChange={e => setEditingClaim({ ...editingClaim, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="insurance-modal-footer">
                <button
                  type="button"
                  className="insurance-btn insurance-btn-secondary"
                  onClick={() => setShowClaimModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="insurance-btn insurance-btn-primary"
                >
                  <Save size={15} /> Save Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status & Pre-Auth Update Modal */}
      {showStatusModal && statusClaim && (
        <div className="insurance-modal-overlay">
          <div className="insurance-modal" style={{ maxWidth: '520px' }}>
            <div className="insurance-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Update Status: {statusClaim.claimNumber}
              </h3>
              <button
                type="button"
                className="insurance-btn insurance-btn-secondary"
                style={{ padding: '0.4rem' }}
                onClick={() => setShowStatusModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStatus}>
              <div className="insurance-modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Claim Status</label>
                  <select
                    className="insurance-status-select"
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as ClaimStatus)}
                  >
                    <option value="PREAUTH_DRAFT">PREAUTH_DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED to TPA</option>
                    <option value="QUERY_RAISED">QUERY_RAISED by TPA</option>
                    <option value="INITIAL_APPROVED">INITIAL_APPROVED (Pre-Auth Granted)</option>
                    <option value="ENHANCEMENT_REQUESTED">ENHANCEMENT_REQUESTED</option>
                    <option value="FINAL_APPROVED">FINAL_APPROVED (Discharge Sanctioned)</option>
                    <option value="SETTLED">SETTLED (Payment Received)</option>
                    <option value="REJECTED">REJECTED / Repudiated</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Current Approved Pre-Auth Amount (₹)</label>
                  <input
                    type="number"
                    className="insurance-search-input"
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    value={newApprovedAmount}
                    onChange={e => setNewApprovedAmount(Number(e.target.value))}
                  />
                </div>

                {newStatus === 'SETTLED' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#059669' }}>Final Settled Amount from TPA (₹)</label>
                    <input
                      type="number"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem', borderColor: '#059669' }}
                      value={newFinalAmount}
                      onChange={e => setNewFinalAmount(Number(e.target.value))}
                    />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pre-Auth Letter Ref / Status Notes</label>
                  <textarea
                    className="insurance-search-input"
                    style={{ width: '100%', marginTop: '0.25rem', minHeight: '60px' }}
                    placeholder="Approval letter reference number, deductibles reason..."
                    value={statusNotes}
                    onChange={e => setStatusNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="insurance-modal-footer">
                <button
                  type="button"
                  className="insurance-btn insurance-btn-secondary"
                  onClick={() => setShowStatusModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="insurance-btn insurance-btn-primary"
                >
                  <Save size={15} /> Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Query Logger Modal */}
      {showQueryModal && queryClaim && (
        <div className="insurance-modal-overlay">
          <div className="insurance-modal" style={{ maxWidth: '580px' }}>
            <div className="insurance-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Log TPA Query / Reply: {queryClaim.claimNumber}
              </h3>
              <button
                type="button"
                className="insurance-btn insurance-btn-secondary"
                style={{ padding: '0.4rem' }}
                onClick={() => setShowQueryModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuery}>
              <div className="insurance-modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b45309' }}>
                    Query Details Received from TPA *
                  </label>
                  <textarea
                    className="insurance-search-input"
                    style={{ width: '100%', marginTop: '0.25rem', minHeight: '70px', borderColor: 'rgba(245, 158, 11, 0.5)' }}
                    required
                    placeholder="e.g. Please provide Day 1 to Day 3 vital sheets, indoor case paper, and clinical justification for ICU stay..."
                    value={queryDetails}
                    onChange={e => setQueryDetails(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hospital Reply / Documents Uploaded</label>
                  <textarea
                    className="insurance-search-input"
                    style={{ width: '100%', marginTop: '0.25rem', minHeight: '70px' }}
                    placeholder="e.g. Scanned indoor case papers, doctor notes, and eMAR chart attached and submitted on portal..."
                    value={replyDetails}
                    onChange={e => setReplyDetails(e.target.value)}
                  />
                </div>
              </div>

              <div className="insurance-modal-footer">
                <button
                  type="button"
                  className="insurance-btn insurance-btn-secondary"
                  onClick={() => setShowQueryModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="insurance-btn insurance-btn-primary"
                >
                  <Save size={15} /> Save Query Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TPA Provider Add/Edit Modal */}
      {showProviderModal && editingProvider && (
        <div className="insurance-modal-overlay">
          <div className="insurance-modal" style={{ maxWidth: '520px' }}>
            <div className="insurance-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {editingProvider.id ? 'Edit TPA Provider' : 'Add TPA / Health Insurer'}
              </h3>
              <button
                type="button"
                className="insurance-btn insurance-btn-secondary"
                style={{ padding: '0.4rem' }}
                onClick={() => setShowProviderModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProvider}>
              <div className="insurance-modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Provider Name *</label>
                  <input
                    type="text"
                    className="insurance-search-input"
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    required
                    placeholder="e.g. Star Health & Allied Insurance"
                    value={editingProvider.name || ''}
                    onChange={e => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Provider Short Code</label>
                    <input
                      type="text"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      placeholder="e.g. STAR-HEALTH"
                      value={editingProvider.code || ''}
                      onChange={e => setEditingProvider({ ...editingProvider, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Default Co-pay (%)</label>
                    <input
                      type="number"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      value={editingProvider.defaultCopayPercent || 0}
                      onChange={e => setEditingProvider({ ...editingProvider, defaultCopayPercent: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Helpline Phone</label>
                    <input
                      type="text"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      placeholder="1800-..."
                      value={editingProvider.contactPhone || ''}
                      onChange={e => setEditingProvider({ ...editingProvider, contactPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pre-Auth Email</label>
                    <input
                      type="email"
                      className="insurance-search-input"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      placeholder="cashless@..."
                      value={editingProvider.contactEmail || ''}
                      onChange={e => setEditingProvider({ ...editingProvider, contactEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pre-Auth Portal URL</label>
                  <input
                    type="url"
                    className="insurance-search-input"
                    style={{ width: '100%', marginTop: '0.25rem' }}
                    placeholder="https://..."
                    value={editingProvider.portalUrl || ''}
                    onChange={e => setEditingProvider({ ...editingProvider, portalUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="insurance-modal-footer">
                <button
                  type="button"
                  className="insurance-btn insurance-btn-secondary"
                  onClick={() => setShowProviderModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="insurance-btn insurance-btn-primary"
                >
                  <Save size={15} /> Save Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
