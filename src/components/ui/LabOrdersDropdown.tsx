import React, { useState, useRef, useEffect } from 'react';
import { FlaskConical, ChevronDown, X } from 'lucide-react';

interface LabOrdersDropdownProps {
  tests: string[];
}

export const LabOrdersDropdown: React.FC<LabOrdersDropdownProps> = ({ tests }) => {
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

  if (!tests || tests.length === 0) {
    return null;
  }

  // If exactly 1 lab test, show a clean compact badge
  if (tests.length === 1) {
    const test = tests[0];
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            background: '#eef2ff',
            color: '#4338ca',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            border: '1px solid #c7d2fe',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
          title={`Lab Test: ${test}`}
        >
          <FlaskConical size={12} style={{ color: '#6366f1' }} />
          <span>{test}</span>
        </span>
      </div>
    );
  }

  const firstTest = tests[0];
  const remainingCount = tests.length - 1;

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
          background: isOpen ? '#ede9fe' : '#f5f3ff',
          color: isOpen ? '#5b21b6' : '#4338ca',
          border: `1px solid ${isOpen ? '#a78bfa' : '#c7d2fe'}`,
          padding: '0.25rem 0.6rem',
          borderRadius: '7px',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
          whiteSpace: 'nowrap',
        }}
        title={`Click to view all ${tests.length} ordered lab investigations`}
      >
        <FlaskConical size={13} style={{ color: isOpen ? '#5b21b6' : '#6366f1' }} />
        <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {firstTest}
        </span>
        <span
          style={{
            background: isOpen ? '#6366f1' : '#ddd6fe',
            color: isOpen ? '#ffffff' : '#4338ca',
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
            color: isOpen ? '#5b21b6' : '#6366f1',
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
            border: '1px solid #c7d2fe',
            borderRadius: '10px',
            boxShadow: '0 12px 28px -4px rgba(79, 70, 229, 0.18), 0 6px 12px -3px rgba(0, 0, 0, 0.08)',
            minWidth: '260px',
            maxWidth: '320px',
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
                  background: '#ede9fe',
                  color: '#5b21b6',
                  padding: '3px',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FlaskConical size={13} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e1b4b' }}>
                Lab Investigations ({tests.length})
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

          {/* Test list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxHeight: '200px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {tests.map((test, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.45rem 0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.25 }}>
                  {test}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
