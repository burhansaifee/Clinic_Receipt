import React, { useState, useRef, useEffect } from 'react';
import { Pill, ChevronDown, X } from 'lucide-react';
import type { PrescribedMedicine } from '../../lib/storage';

interface MedicinesDropdownProps {
  medicines: PrescribedMedicine[];
}

export const MedicinesDropdown: React.FC<MedicinesDropdownProps> = ({ medicines }) => {
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
        if (spaceBelow < 280 && rect.top > 280) {
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

  if (!medicines || medicines.length === 0) {
    return <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>None</span>;
  }

  // If exactly 1 medicine, show a clean, compact badge
  if (medicines.length === 1) {
    const med = medicines[0];
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            background: '#f1f5f9',
            color: '#334155',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            border: '1px solid #e2e8f0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
          title={med.dosage ? `${med.name} (${med.dosage}${med.duration ? ` • ${med.duration}` : ''})` : med.name}
        >
          <Pill size={12} style={{ color: '#0ea5e9' }} />
          <span>{med.name}</span>
          {med.dosage && (
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
              • {med.dosage}
            </span>
          )}
        </span>
      </div>
    );
  }

  const firstMed = medicines[0];
  const remainingCount = medicines.length - 1;

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
          background: isOpen ? '#e0f2fe' : '#f8fafc',
          color: isOpen ? '#0284c7' : '#334155',
          border: `1px solid ${isOpen ? '#38bdf8' : '#cbd5e1'}`,
          padding: '0.25rem 0.6rem',
          borderRadius: '7px',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 2px rgba(14, 165, 233, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
          whiteSpace: 'nowrap',
        }}
        title={`Click to view all ${medicines.length} medicines`}
      >
        <Pill size={13} style={{ color: isOpen ? '#0284c7' : '#0ea5e9' }} />
        <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {firstMed.name}
        </span>
        <span
          style={{
            background: isOpen ? '#0284c7' : '#e2e8f0',
            color: isOpen ? '#ffffff' : '#475569',
            padding: '0.1rem 0.45rem',
            borderRadius: '10px',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}
        >
          +{remainingCount}
        </span>
        <ChevronDown
          size={13}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: isOpen ? '#0284c7' : '#64748b',
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
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.16), 0 6px 12px -3px rgba(0, 0, 0, 0.08)',
            minWidth: '280px',
            maxWidth: '340px',
            padding: '0.75rem',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.6rem',
              paddingBottom: '0.45rem',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div
                style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '3px',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Pill size={13} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                Prescribed Medicines ({medicines.length})
              </span>
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

          {/* Medicines list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              maxHeight: '220px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {medicines.map((m, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.45rem 0.6rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.25 }}>
                    {idx + 1}. {m.name}
                  </span>
                  {m.duration && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: '#0369a1',
                        background: '#e0f2fe',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.duration}
                    </span>
                  )}
                </div>

                {(m.dosage || m.instructions) && (
                  <div
                    style={{
                      marginTop: '0.3rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexWrap: 'wrap',
                      fontSize: '0.72rem',
                      color: '#64748b',
                    }}
                  >
                    {m.dosage && (
                      <span
                        style={{
                          background: '#e2e8f0',
                          color: '#334155',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {m.dosage}
                      </span>
                    )}
                    {m.instructions && (
                      <span style={{ color: '#475569' }}>
                        {m.dosage ? '• ' : ''}{m.instructions}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
