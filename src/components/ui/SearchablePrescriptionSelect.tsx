import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check, FileText, Pill } from 'lucide-react';
import type { Prescription } from '../../lib/storage';

interface SearchablePrescriptionSelectProps {
  prescriptions: Prescription[];
  selectedRxId: string;
  onSelectRx: (rxId: string) => void;
}

export const SearchablePrescriptionSelect: React.FC<SearchablePrescriptionSelectProps> = ({
  prescriptions,
  selectedRxId,
  onSelectRx
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected prescription object
  const selectedRx = useMemo(() => {
    return prescriptions.find(p => p.id === selectedRxId) || null;
  }, [prescriptions, selectedRxId]);

  // Filtered prescriptions based on search term
  const filteredPrescriptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return prescriptions;

    return prescriptions.filter(rx => {
      const patientNameMatch = (rx.patientName || '').toLowerCase().includes(term);
      const patientIdMatch = (rx.patientId || rx.pid || rx.receiptNumber || '').toLowerCase().includes(term);
      const phoneMatch = (rx.patientPhone || '').toLowerCase().includes(term);
      const doctorMatch = (rx.doctorName || '').toLowerCase().includes(term);
      const diagnosisMatch = (rx.diagnosis || '').toLowerCase().includes(term);
      const medsMatch = (rx.medicines || []).some(m => (m.name || '').toLowerCase().includes(term));

      return patientNameMatch || patientIdMatch || phoneMatch || doctorMatch || diagnosisMatch || medsMatch;
    });
  }, [prescriptions, searchTerm]);

  // Handle click outside & escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setHighlightedIndex(-1);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const elements = listRef.current.querySelectorAll('.rx-select-item');
      if (elements[highlightedIndex]) {
        (elements[highlightedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (rxId: string) => {
    onSelectRx(rxId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectRx('');
    setSearchTerm('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredPrescriptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredPrescriptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredPrescriptions.length) {
        handleSelect(filteredPrescriptions[highlightedIndex].id);
      } else if (filteredPrescriptions.length === 1) {
        handleSelect(filteredPrescriptions[0].id);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          minHeight: '42px',
          padding: '0.5rem 0.75rem',
          borderRadius: '10px',
          border: isOpen ? '1.5px solid #0284c7' : '1px solid var(--border)',
          background: selectedRx ? '#f0f9ff' : '#f8fafc',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(2, 132, 199, 0.12)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <FileText size={16} style={{ color: selectedRx ? '#0284c7' : '#94a3b8', flexShrink: 0 }} />
          {selectedRx ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>
                {selectedRx.patientName}
              </span>
              {(selectedRx.patientId || selectedRx.pid) && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}>
                  UHID: {selectedRx.patientId || selectedRx.pid}
                </span>
              )}
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                — {selectedRx.medicines?.length || 0} Meds ({selectedRx.doctorName})
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '0.825rem', color: '#64748b', fontWeight: 500 }}>
              -- Choose Patient Prescription (Search name, UHID, phone...) --
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {selectedRx && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
            >
              <X size={15} />
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              color: '#94a3b8',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease'
            }}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'white',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {/* Search Box Header */}
          <div
            style={{
              padding: '0.5rem 0.65rem',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Search size={15} style={{ color: '#0284c7', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type patient name, UHID, phone number, doctor..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.825rem',
                color: '#1e293b',
                fontWeight: 500
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '4px 0'
            }}
          >
            {filteredPrescriptions.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem 1rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.8rem'
                }}
              >
                No prescriptions matching &ldquo;{searchTerm}&rdquo;
              </div>
            ) : (
              filteredPrescriptions.map((rx, idx) => {
                const isSelected = rx.id === selectedRxId;
                const isHighlighted = idx === highlightedIndex;

                const pid = rx.patientId || rx.pid || rx.receiptNumber;
                const medsList = (rx.medicines || []).map(m => m.name).filter(Boolean);

                return (
                  <div
                    key={rx.id}
                    className="rx-select-item"
                    onClick={() => handleSelect(rx.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '0.6rem 0.85rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f8fafc',
                      background: isSelected
                        ? '#e0f2fe'
                        : isHighlighted
                        ? '#f1f5f9'
                        : 'transparent',
                      transition: 'background 0.1s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Top Row: Patient Name & UHID */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.85rem', color: isSelected ? '#0369a1' : '#0f172a' }}>
                          {rx.patientName}
                        </strong>
                        {pid && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: '#e0f2fe',
                              color: '#0284c7',
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}
                          >
                            {pid.startsWith('#') || pid.startsWith('PID-') ? pid : `#${pid}`}
                          </span>
                        )}
                        {rx.patientPhone && (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            ({rx.patientPhone})
                          </span>
                        )}
                      </div>

                      {/* Middle Row: Doctor & Date */}
                      <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{rx.doctorName}</span>
                        <span>•</span>
                        <span>{rx.date}</span>
                        <span>•</span>
                        <span style={{ fontWeight: 600, color: '#0369a1' }}>
                          {rx.medicines?.length || 0} Meds
                        </span>
                      </div>

                      {/* Medicines Preview */}
                      {medsList.length > 0 && (
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <Pill size={11} style={{ color: '#0284c7', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                            {medsList.slice(0, 3).join(', ')}{medsList.length > 3 ? ` +${medsList.length - 3} more` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Checkmark icon for selected item */}
                    {isSelected && (
                      <Check size={16} style={{ color: '#0284c7', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
