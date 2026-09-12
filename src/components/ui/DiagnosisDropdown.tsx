import React, { useState, useRef, useEffect } from 'react';
import { Stethoscope, ChevronDown, X, Calendar, FileText, AlertCircle } from 'lucide-react';

interface DiagnosisDropdownProps {
  diagnosis?: string;
  symptoms?: string;
  notes?: string;
  followUpDate?: string;
  followUpNotes?: string;
  doctorName?: string;
}

export const DiagnosisDropdown: React.FC<DiagnosisDropdownProps> = ({
  diagnosis,
  symptoms,
  notes,
  followUpDate,
  followUpNotes,
  doctorName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      // Check positioning relative to viewport bottom
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 320 && rect.top > 320) {
          setOpenUpwards(true);
        } else {
          setOpenUpwards(false);
        }
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayDiagnosis = diagnosis?.trim() || 'No Diagnosis Recorded';
  const hasExtraInfo = Boolean(symptoms || notes || followUpDate || followUpNotes || (diagnosis && diagnosis.length > 25));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        zIndex: isOpen ? 100 : 'auto',
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          background: isOpen ? '#ecfdf5' : '#f8fafc',
          color: isOpen ? '#047857' : '#334155',
          border: `1px solid ${isOpen ? '#6ee7b7' : '#cbd5e1'}`,
          padding: '0.25rem 0.6rem',
          borderRadius: '7px',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
          maxWidth: '220px',
          textAlign: 'left',
        }}
        title={`Click to view full diagnosis & clinical notes`}
      >
        <Stethoscope size={13} style={{ color: isOpen ? '#059669' : '#0d9488', flexShrink: 0 }} />
        <span
          style={{
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayDiagnosis}
        </span>
        {followUpDate && (
          <span
            style={{
              background: isOpen ? '#059669' : '#e0f2fe',
              color: isOpen ? '#ffffff' : '#0369a1',
              padding: '0.1rem 0.4rem',
              borderRadius: '8px',
              fontSize: '0.65rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title={`Follow-up scheduled: ${followUpDate}`}
          >
            F/U
          </span>
        )}
        <ChevronDown
          size={12}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: isOpen ? '#047857' : '#64748b',
            flexShrink: 0,
          }}
        />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: openUpwards ? 'auto' : 'calc(100% + 6px)',
            bottom: openUpwards ? 'calc(100% + 6px)' : 'auto',
            left: 0,
            zIndex: 1000,
            background: '#ffffff',
            border: '1px solid #a7f3d0',
            borderRadius: '10px',
            boxShadow: '0 12px 28px -4px rgba(16, 185, 129, 0.18), 0 6px 12px -3px rgba(0, 0, 0, 0.08)',
            minWidth: '280px',
            maxWidth: '360px',
            padding: '0.85rem',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.65rem',
              paddingBottom: '0.45rem',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div
                style={{
                  background: '#d1fae5',
                  color: '#065f46',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Stethoscope size={14} />
              </div>
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#064e3b', display: 'block' }}>
                  Clinical Diagnosis
                </span>
                {doctorName && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {doctorName.replace(/^Dr\.?\s*/i, '')}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content Body */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {/* Full Diagnosis */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '2px' }}>
                Primary Diagnosis
              </span>
              <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.35 }}>
                {diagnosis || 'N/A'}
              </p>
            </div>

            {/* Symptoms */}
            {symptoms && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '2px' }}>
                  Reported Symptoms
                </span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#78350f', lineHeight: 1.35 }}>
                  {symptoms}
                </p>
              </div>
            )}

            {/* Clinical Notes / Advice */}
            {notes && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '2px' }}>
                  Doctor's Advice & Notes
                </span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#166534', lineHeight: 1.35 }}>
                  {notes}
                </p>
              </div>
            )}

            {/* Follow-Up */}
            {followUpDate && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={12} style={{ color: '#2563eb' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Follow-Up Date: {followUpDate}
                  </span>
                </div>
                {followUpNotes && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#1e40af', lineHeight: 1.3 }}>
                    {followUpNotes}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
