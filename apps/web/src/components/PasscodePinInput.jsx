import React, { useRef, useState, useEffect } from 'react';

/**
 * PasscodePinInput
 * Renders 6 distinct square digit boxes ("box box thingy") for entering a 6-digit secure passcode.
 * Features auto-advance focus, backspace navigation, paste handling, and show/hide toggle.
 */
export default function PasscodePinInput({
  value = '',
  onChange,
  autoFocus = true,
  disabled = false,
  length = 6,
  onComplete
}) {
  const [digits, setDigits] = useState(() => {
    const raw = String(value || '').replace(/\D/g, '').slice(0, length);
    const arr = Array(length).fill('');
    for (let i = 0; i < raw.length; i++) arr[i] = raw[i];
    return arr;
  });
  const [showDigits, setShowDigits] = useState(false);
  const inputRefs = useRef([]);

  // Sync internal digits with incoming value
  useEffect(() => {
    const raw = String(value || '').replace(/\D/g, '').slice(0, length);
    const arr = Array(length).fill('');
    for (let i = 0; i < raw.length; i++) arr[i] = raw[i];
    setDigits(arr);
  }, [value, length]);

  // Auto focus first empty box on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      const firstEmptyIndex = digits.findIndex(d => !d);
      const targetIndex = firstEmptyIndex === -1 ? length - 1 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
  }, [autoFocus]);

  const triggerChange = (newDigits) => {
    setDigits(newDigits);
    const combined = newDigits.join('');
    if (onChange) onChange(combined);
    if (combined.length === length && onComplete) {
      onComplete(combined);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index]) {
        newDigits[index] = '';
        triggerChange(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = '';
        triggerChange(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      const newDigits = [...digits];
      newDigits[index] = '';
      triggerChange(newDigits);
    }
  };

  const handleChange = (index, e) => {
    const val = e.target.value;
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const newDigits = [...digits];
      newDigits[index] = '';
      triggerChange(newDigits);
      return;
    }

    const char = cleaned[cleaned.length - 1];
    const newDigits = [...digits];
    newDigits[index] = char;
    triggerChange(newDigits);

    // Advance focus to next digit box
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text') || '';
    const pastedDigits = pasted.replace(/\D/g, '').slice(0, length);
    if (!pastedDigits) return;

    const newDigits = [...digits];
    for (let i = 0; i < pastedDigits.length; i++) {
      newDigits[i] = pastedDigits[i];
    }
    triggerChange(newDigits);

    const nextIndex = Math.min(pastedDigits.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div style={{ width: '100%', margin: '10px 0 6px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${length}, 1fr)`,
          gap: '8px',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: '360px',
          margin: '0 auto'
        }}
        onPaste={handlePaste}
      >
        {Array.from({ length }).map((_, i) => {
          const isFilled = Boolean(digits[i]);
          return (
            <input
              key={i}
              ref={el => (inputRefs.current[i] = el)}
              type={showDigits ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digits[i] || ''}
              disabled={disabled}
              onChange={e => handleChange(i, e)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.target.select()}
              aria-label={`Passcode digit ${i + 1}`}
              style={{
                width: '100%',
                height: '52px',
                borderRadius: '12px',
                border: isFilled
                  ? '2px solid var(--blue-600, #2563eb)'
                  : '1.5px solid var(--input-border, #cbd5e1)',
                background: 'var(--input-bg, #ffffff)',
                color: 'var(--input-text, #0f172a)',
                fontSize: '22px',
                fontWeight: '800',
                textAlign: 'center',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                boxShadow: isFilled
                  ? '0 2px 8px rgba(37, 99, 235, 0.18)'
                  : '0 1px 3px rgba(0, 0, 0, 0.04)',
                outline: 'none',
                transition: 'all 0.16s ease',
                padding: 0
              }}
              onFocusCapture={e => {
                e.target.style.borderColor = 'var(--blue-600, #2563eb)';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.2)';
              }}
              onBlurCapture={e => {
                const filled = Boolean(digits[i]);
                e.target.style.borderColor = filled ? 'var(--blue-600, #2563eb)' : 'var(--input-border, #cbd5e1)';
                e.target.style.boxShadow = filled ? '0 2px 8px rgba(37, 99, 235, 0.18)' : '0 1px 3px rgba(0, 0, 0, 0.04)';
              }}
            />
          );
        })}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '360px',
        margin: '8px auto 0',
        padding: '0 4px',
        fontSize: '11px',
        color: 'var(--muted)'
      }}>
        <span>6-digit numeric security code</span>
        <button
          type="button"
          onClick={() => setShowDigits(!showDigits)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--blue-600, #2563eb)',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {showDigits ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              Hide
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Show
            </>
          )}
        </button>
      </div>
    </div>
  );
}
