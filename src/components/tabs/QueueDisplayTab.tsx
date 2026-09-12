import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Volume2, Tv, Bell, CheckCircle2, Stethoscope, RotateCcw, Edit3
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import '../../styles/tabs/QueueDisplayTab.css';
import { storage, notifyDataChanged, type Doctor, type DoctorNextCallEvent } from '../../lib/storage';

interface QueueDisplayTabProps {
  doctors: Doctor[];
  isDirectTvMode?: boolean;
}

interface ChamberQueueState {
  chamberId: string;
  chamberName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  currentToken: string | null;
  currentPatientName: string | null;
  waitingQueue: { token: string; patientName: string; time: string }[];
  completedCount: number;
}

export const QueueDisplayTab: React.FC<QueueDisplayTabProps> = ({ doctors, isDirectTvMode = false }) => {
  const toast = useToast();
  const [isTvMode, setIsTvMode] = useState<boolean>(isDirectTvMode);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [voiceSupported, setVoiceSupported] = useState<boolean>(false);
  const [announcingBanner, setAnnouncingBanner] = useState<{ token: string; chamber: string } | null>(null);

  // Chamber queues state
  const [chambers, setChambers] = useState<ChamberQueueState[]>([]);

  // Check speech synthesis support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setVoiceSupported(true);
      // Pre-load voices for browsers that load them asynchronously
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Clock tick for TV mode
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize chambers from doctors & today's receipts
  const loadQueueData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const receipts = await storage.getReceipts();
      const todayReceipts = receipts.filter(r => r.date === today);

      const initialChambers: ChamberQueueState[] = doctors.map((doc, idx) => {
        const chamberId = `CH-${idx + 1}`;
        const chamberName = doc.chamber?.trim() || `Chamber ${idx + 1}`;
        const docReceipts = todayReceipts.filter(r => r.doctorId === doc.id);

        const waiting = docReceipts.map(r => ({
          token: String((r as any).tokenNumber || r.receiptNumber || '01'),
          patientName: r.patientName,
          time: (r as any).createdAt ? format(new Date((r as any).createdAt), 'hh:mm a') : (r.date || 'Now')
        }));

        // Try restoring saved chamber state from localStorage
        const saved = localStorage.getItem(`clinic_qds_${doc.id}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            return {
              ...parsed,
              chamberName: doc.chamber?.trim() || parsed.chamberName || chamberName,
              doctorName: doc.name,
              doctorSpecialty: doc.specialization || 'Consultant',
            };
          } catch (_) {}
        }

        const current = waiting.length > 0 ? waiting[0] : null;
        const remaining = waiting.length > 1 ? waiting.slice(1) : [];

        return {
          chamberId,
          chamberName,
          doctorId: doc.id,
          doctorName: doc.name,
          doctorSpecialty: doc.specialization || 'Consultant',
          currentToken: current ? current.token : null,
          currentPatientName: current ? current.patientName : null,
          waitingQueue: remaining,
          completedCount: 0
        };
      });

      setChambers(initialChambers);
    } catch (e) {
      console.error('Failed to load queue data:', e);
    }
  };

  // Chamber assignment modal state
  const [editingChamberDoc, setEditingChamberDoc] = useState<{ doctorId: string; doctorName: string; currentChamber: string } | null>(null);
  const [chamberInputVal, setChamberInputVal] = useState('');

  const openChamberModal = (doctorId: string, currentChamber: string) => {
    const doc = doctors.find(d => d.id === doctorId);
    setEditingChamberDoc({
      doctorId,
      doctorName: doc?.name || 'Doctor',
      currentChamber
    });
    setChamberInputVal(currentChamber);
  };

  const handleSaveChamberModal = async () => {
    if (!editingChamberDoc) return;
    const cleaned = chamberInputVal.trim();
    if (!cleaned) {
      toast.show('Please enter a valid chamber name', 'warning');
      return;
    }

    try {
      const doc = doctors.find(d => d.id === editingChamberDoc.doctorId);
      if (doc) {
        const updatedDoc: Doctor = {
          ...doc,
          chamber: cleaned
        };
        await storage.saveDoctor(updatedDoc);
      }

      const updated = chambers.map(c => {
        if (c.doctorId === editingChamberDoc.doctorId) {
          return {
            ...c,
            chamberName: cleaned
          };
        }
        return c;
      });
      updateChamberState(updated);
      notifyDataChanged('doctors');
      toast.show(`Assigned ${editingChamberDoc.doctorName} to "${cleaned}"`, 'success');
      setEditingChamberDoc(null);
    } catch (err) {
      console.error('Failed to update doctor chamber:', err);
      toast.show('Failed to update chamber name', 'error');
    }
  };

  useEffect(() => {
    loadQueueData();
    const interval = setInterval(loadQueueData, 5000);
    const handleLiveSync = (e: CustomEvent) => {
      if (!e.detail?.dataType || e.detail.dataType === 'queue' || e.detail.dataType === 'receipts') {
        loadQueueData();
      }
    };
    window.addEventListener('buvora-data-updated', handleLiveSync as EventListener);
    return () => {
      clearInterval(interval);
      window.removeEventListener('buvora-data-updated', handleLiveSync as EventListener);
    };
  }, [doctors]);

  // Listen for doctor calling next patient from doctor workstation
  useEffect(() => {
    const handleDoctorCall = (e: any) => {
      const callData: DoctorNextCallEvent = e.detail;
      if (callData && callData.token) {
        speakToken(callData.token, callData.chamberName, callData.patientName);
        loadQueueData();
      }
    };
    window.addEventListener('buvora-doctor-called-next', handleDoctorCall as EventListener);
    return () => window.removeEventListener('buvora-doctor-called-next', handleDoctorCall as EventListener);
  }, [doctors]);

  // Launch dedicated TV Display in independent window
  const handleLaunchTvWindow = async () => {
    try {
      if (window.system?.openTvDisplay) {
        await window.system.openTvDisplay();
        toast.show('1080p TV Display launched in separate window! Move it to your TV / second monitor.', 'success');
      } else {
        const url = `${window.location.origin}${window.location.pathname}?mode=tv-display`;
        const opened = window.open(url, 'buvora_tv_display', 'width=1920,height=1080,menubar=no,toolbar=no,location=no');
        if (!opened) {
          setIsTvMode(true);
        } else {
          toast.show('1080p TV Display opened in new window! Drag to external screen.', 'success');
        }
      }
    } catch (err) {
      console.error('Failed to open TV window:', err);
      setIsTvMode(true);
    }
  };

  // Save changes to localStorage for offline persistence & notify connected screens
  const updateChamberState = (updated: ChamberQueueState[]) => {
    setChambers(updated);
    updated.forEach(c => {
      localStorage.setItem(`clinic_qds_${c.doctorId}`, JSON.stringify(c));
    });
    notifyDataChanged('queue');
  };

  // Announce Token using Web Speech API
  const speakToken = (token: string, chamberName: string, patientName?: string | null) => {
    setAnnouncingBanner({ token, chamber: chamberName });
    setTimeout(() => {
      setAnnouncingBanner(null);
    }, 4500);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const message = patientName
        ? `Token Number ${token}, ${patientName}, please proceed to ${chamberName}`
        : `Token Number ${token}, please proceed to ${chamberName}`;
      const utterance = new SpeechSynthesisUtterance(message);
      
      // Attempt to find a clearer, more natural voice
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(v => v.name.includes('Google UK English Female')) ||
                        voices.find(v => v.name.includes('Google US English')) ||
                        voices.find(v => v.name.includes('Siri')) ||
                        voices.find(v => v.name.includes('Samantha')) ||
                        voices.find(v => v.name.includes('Microsoft Zira')) ||
                        voices.find(v => v.name.includes('Microsoft Mark')) ||
                        voices.find(v => v.name.includes('Premium') && v.lang.startsWith('en')) ||
                        voices.find(v => v.lang.startsWith('en-IN')) ||
                        voices.find(v => v.lang.startsWith('en'));

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.rate = 0.85; // Slower rate for clearer pronunciation
      utterance.pitch = 1.0;
      utterance.lang = bestVoice ? bestVoice.lang : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Call Next Patient
  const handleCallNext = (chamberId: string) => {
    const updated = chambers.map(c => {
      if (c.chamberId === chamberId) {
        if (c.waitingQueue.length === 0) {
          toast.show(`No more waiting patients for ${c.doctorName}`, 'info');
          return c;
        }
        const next = c.waitingQueue[0];
        const remaining = c.waitingQueue.slice(1);
        const newChamber = {
          ...c,
          currentToken: next.token,
          currentPatientName: next.patientName,
          waitingQueue: remaining,
          completedCount: c.currentToken ? c.completedCount + 1 : c.completedCount
        };
        speakToken(next.token, c.chamberName, next.patientName);
        return newChamber;
      }
      return c;
    });
    updateChamberState(updated);
  };

  // Repeat Call
  const handleRepeatCall = (chamber: ChamberQueueState) => {
    if (!chamber.currentToken) {
      toast.show('No token currently being served', 'warning');
      return;
    }
    speakToken(chamber.currentToken, chamber.chamberName, chamber.currentPatientName);
    toast.show(`Re-calling Token #${chamber.currentToken}`, 'info');
  };

  // Mark Completed
  const handleCompleteConsultation = (chamberId: string) => {
    const updated = chambers.map(c => {
      if (c.chamberId === chamberId) {
        return {
          ...c,
          currentToken: null,
          currentPatientName: null,
          completedCount: c.currentToken ? c.completedCount + 1 : c.completedCount
        };
      }
      return c;
    });
    updateChamberState(updated);
    toast.show('Consultation marked completed', 'success');
  };

  // Add Manual Walk-In Token
  const handleAddManualToken = (chamberId: string) => {
    const pName = prompt('Enter Patient Name for Token:');
    if (!pName) return;
    const token = prompt('Enter Token Number:', `${Math.floor(Math.random() * 80) + 10}`);
    if (!token) return;

    const updated = chambers.map(c => {
      if (c.chamberId === chamberId) {
        return {
          ...c,
          waitingQueue: [
            ...c.waitingQueue,
            { token, patientName: pName, time: format(new Date(), 'hh:mm a') }
          ]
        };
      }
      return c;
    });
    updateChamberState(updated);
    toast.show(`Token #${token} added to queue`, 'success');
  };

  // Toggle TV Mode with escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirectTvMode) {
          window.close();
        } else if (isTvMode) {
          setIsTvMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTvMode, isDirectTvMode]);

  // Render dedicated standalone TV view (when opened in separate window)
  if (isDirectTvMode) {
    return (
      <div className="qds-tv-view" style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
        {/* Header */}
        <div className="qds-tv-header">
          <div className="qds-tv-hospital-brand">
            <div className="qds-tv-logo-pulse">🏥</div>
            <div>
              <div className="qds-tv-hospital-name">OUTPATIENT QUEUE SYSTEM</div>
              <div className="qds-tv-hospital-sub">Consultant Chambers • Live OPD Status</div>
            </div>
          </div>

          <div className="qds-tv-time-box">
            <div className="qds-tv-clock">{format(currentTime, 'hh:mm:ss a')}</div>
            <button className="qds-tv-close-btn" onClick={() => window.close()}>
              ✕ Close Window (Esc)
            </button>
          </div>
        </div>

        {/* Flash Announcement Banner */}
        {announcingBanner && (
          <div className="qds-tv-announcement-banner">
            <div className="qds-tv-banner-text">
              📢 PLEASE PROCEED TO {announcingBanner.chamber.toUpperCase()}
            </div>
            <div className="qds-tv-banner-token">
              TOKEN #{announcingBanner.token}
            </div>
          </div>
        )}

        {/* Chambers Grid */}
        <div className="qds-tv-grid">
          {chambers.map(chamber => (
            <div
              key={chamber.chamberId}
              className={`qds-tv-card ${announcingBanner?.chamber === chamber.chamberName ? 'active-calling' : ''}`}
            >
              <div className="qds-tv-card-top">
                <div>
                  <div className="qds-tv-chamber-title">{chamber.chamberName}</div>
                  <div className="qds-tv-doctor-name">{chamber.doctorName}</div>
                </div>
                <span className="qds-tv-card-badge">
                  {chamber.waitingQueue.length} WAITING
                </span>
              </div>

              <div className="qds-tv-token-display">
                <div className="qds-tv-token-label">NOW SERVING</div>
                <div className="qds-tv-token-number">
                  {chamber.currentToken ? chamber.currentToken : '--'}
                </div>
                <div className="qds-tv-patient-name">
                  {chamber.currentPatientName || 'Please Wait'}
                </div>
              </div>

              <div className="qds-tv-next-strip">
                <span>Next In Line:</span>
                <span className="qds-tv-next-badge">
                  {chamber.waitingQueue[0] ? `Token #${chamber.waitingQueue[0].token} (${chamber.waitingQueue[0].patientName})` : 'Queue Empty'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Scrolling Footer News Ticker */}
        <div className="qds-tv-ticker">
          <div className="qds-tv-ticker-content">
            ★ Welcome to Clinic OPD Desk • Please have your prescription slip and previous medical records ready • Tokens are called in sequence • For emergency assistance please contact the triage nursing desk • Hand sanitizers available at each chamber entrance ★
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qds-container">
      {/* ── TOP BAR / DESK CONTROLS ─────────────────────────────────────────── */}
      <div className="qds-top-bar">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            OPD Waiting Area Token Caller & Queue Display
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Real-time multi-chamber voice token announcer with high-visibility 1080p TV projection mode.
          </p>
        </div>

        <div className="qds-mode-controls">
          {voiceSupported && (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '5px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Volume2 size={13} /> TTS Voice Ready
            </span>
          )}
          <button
            className="payout-btn-secondary"
            onClick={() => speakToken('01', 'Chamber 1', 'Test Patient')}
            title="Test Voice Announcement"
          >
            <Volume2 size={15} /> Test Audio Caller
          </button>

          <button
            className="payout-btn-secondary"
            onClick={() => setIsTvMode(true)}
            title="Preview full-screen TV view in current window"
          >
            <Tv size={14} /> In-Window Preview
          </button>

          <button
            className="qds-btn-tv-mode"
            onClick={handleLaunchTvWindow}
            title="Launch 1080p TV Display in a dedicated separate window for TV / second monitor"
          >
            <Tv size={16} /> Launch TV Display (New Window)
          </button>
        </div>
      </div>

      {/* ── DESK VIEW: CHAMBERS QUEUE CONTROLLER ────────────────────────────── */}
      <div className="qds-desk-grid">
        {chambers.map(chamber => (
          <div key={chamber.chamberId} className="qds-chamber-desk-card">
            <div className="qds-chamber-header">
              <div>
                <div
                  className="qds-chamber-title"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={() => openChamberModal(chamber.doctorId, chamber.chamberName)}
                  title="Click to assign Chamber / Room"
                >
                  <Stethoscope size={18} color="#0284c7" />
                  <span>{chamber.chamberName}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openChamberModal(chamber.doctorId, chamber.chamberName);
                    }}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      padding: '3px 6px',
                      cursor: 'pointer',
                      color: '#0284c7',
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: '5px',
                      marginLeft: '2px'
                    }}
                    title="Change Assigned Chamber / Room"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  {chamber.doctorName}
                </div>
              </div>
              <span className="qds-chamber-badge">
                {chamber.waitingQueue.length} Waiting
              </span>
            </div>

            <div className="qds-chamber-body">
              {/* Currently Serving Box */}
              <div className="qds-serving-box">
                <span className="qds-serving-label">Now Serving In Chamber</span>
                <div className="qds-serving-token">
                  {chamber.currentToken ? `#${chamber.currentToken}` : '--'}
                </div>
                <div className="qds-serving-patient">
                  {chamber.currentPatientName || 'No Patient In Chamber'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="qds-chamber-actions">
                <button
                  className="qds-action-btn call-next"
                  onClick={() => handleCallNext(chamber.chamberId)}
                  disabled={chamber.waitingQueue.length === 0}
                >
                  <Bell size={14} /> Call Next Token ({chamber.waitingQueue[0]?.token ? `#${chamber.waitingQueue[0].token}` : 'None'})
                </button>

                <button
                  className="qds-action-btn repeat-call"
                  onClick={() => handleRepeatCall(chamber)}
                  disabled={!chamber.currentToken}
                >
                  <RotateCcw size={13} /> Repeat Call
                </button>

                <button
                  className="qds-action-btn complete"
                  onClick={() => handleCompleteConsultation(chamber.chamberId)}
                  disabled={!chamber.currentToken}
                >
                  <CheckCircle2 size={13} /> Finish
                </button>
              </div>

              {/* Upcoming Queue Preview */}
              <div className="qds-queue-preview">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="qds-queue-preview-title">Next In Line ({chamber.waitingQueue.length})</span>
                  <button
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => handleAddManualToken(chamber.chamberId)}
                  >
                    + Walk-In Token
                  </button>
                </div>
                <div className="qds-queue-list">
                  {chamber.waitingQueue.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                      No patients waiting in queue
                    </div>
                  ) : (
                    chamber.waitingQueue.map((item, idx) => (
                      <div key={idx} className="qds-queue-item">
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>Token #{item.token}</span>
                        <span style={{ color: '#475569' }}>{item.patientName}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{item.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── HIGH-VISIBILITY 1080P TV FULLSCREEN VIEW ─────────────────────────── */}
      {isTvMode && (
        <div className="qds-tv-view">
          {/* Header */}
          <div className="qds-tv-header">
            <div className="qds-tv-hospital-brand">
              <div className="qds-tv-logo-pulse">🏥</div>
              <div>
                <div className="qds-tv-hospital-name">OUTPATIENT QUEUE SYSTEM</div>
                <div className="qds-tv-hospital-sub">Consultant Chambers • Live OPD Status</div>
              </div>
            </div>

            <div className="qds-tv-time-box">
              <div className="qds-tv-clock">{format(currentTime, 'hh:mm:ss a')}</div>
              <button className="qds-tv-close-btn" onClick={() => setIsTvMode(false)}>
                ✕ Exit TV Display (Esc)
              </button>
            </div>
          </div>

          {/* Flash Announcement Banner */}
          {announcingBanner && (
            <div className="qds-tv-announcement-banner">
              <div className="qds-tv-banner-text">
                📢 PLEASE PROCEED TO {announcingBanner.chamber.toUpperCase()}
              </div>
              <div className="qds-tv-banner-token">
                TOKEN #{announcingBanner.token}
              </div>
            </div>
          )}

          {/* Chambers Grid */}
          <div className="qds-tv-grid">
            {chambers.map(chamber => (
              <div
                key={chamber.chamberId}
                className={`qds-tv-card ${announcingBanner?.chamber === chamber.chamberName ? 'active-calling' : ''}`}
              >
                <div className="qds-tv-card-top">
                  <div>
                    <div className="qds-tv-chamber-title">{chamber.chamberName}</div>
                    <div className="qds-tv-doctor-name">{chamber.doctorName}</div>
                  </div>
                  <span className="qds-tv-card-badge">
                    {chamber.waitingQueue.length} WAITING
                  </span>
                </div>

                <div className="qds-tv-token-display">
                  <div className="qds-tv-token-label">NOW SERVING</div>
                  <div className="qds-tv-token-number">
                    {chamber.currentToken ? chamber.currentToken : '--'}
                  </div>
                  <div className="qds-tv-patient-name">
                    {chamber.currentPatientName || 'Please Wait'}
                  </div>
                </div>

                <div className="qds-tv-next-strip">
                  <span>Next In Line:</span>
                  <span className="qds-tv-next-badge">
                    {chamber.waitingQueue[0] ? `Token #${chamber.waitingQueue[0].token} (${chamber.waitingQueue[0].patientName})` : 'Queue Empty'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Scrolling Footer News Ticker */}
          <div className="qds-tv-ticker">
            <div className="qds-tv-ticker-content">
              ★ Welcome to Clinic OPD Desk • Please have your prescription slip and previous medical records ready • Tokens are called in sequence • For emergency assistance please contact the triage nursing desk • Hand sanitizers available at each chamber entrance ★
            </div>
          </div>
        </div>
      )}

      {/* ── CHAMBER ASSIGNMENT POPUP MODAL ──────────────────────────────── */}
      {editingChamberDoc && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Assign Chamber / Room
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                    {editingChamberDoc.doctorName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingChamberDoc(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Chamber / Room Name
              </label>
              <input
                type="text"
                autoFocus
                value={chamberInputVal}
                onChange={(e) => setChamberInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveChamberModal();
                  if (e.key === 'Escape') setEditingChamberDoc(null);
                }}
                placeholder="e.g. Chamber 1, Room 102, Cabin A, OPD Desk 1"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1.5px solid #0284c7',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  outline: 'none',
                  background: '#f8fafc'
                }}
              />
            </div>

            {/* Quick Presets */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                Quick Presets:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Chamber 1', 'Chamber 2', 'Chamber 3', 'Room 101', 'Room 102', 'Cabin A', 'OPD-1'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setChamberInputVal(preset)}
                    style={{
                      background: chamberInputVal === preset ? '#0284c7' : '#f1f5f9',
                      color: chamberInputVal === preset ? 'white' : '#475569',
                      border: '1px solid',
                      borderColor: chamberInputVal === preset ? '#0284c7' : '#e2e8f0',
                      padding: '5px 11px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setEditingChamberDoc(null)}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveChamberModal}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: 'white',
                  border: 'none',
                  padding: '0.55rem 1.35rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)'
                }}
              >
                Save Chamber
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
