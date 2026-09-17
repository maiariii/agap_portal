import React, { useState } from 'react';

export default function VacancyClusterAccordion({ title, colSpan, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <>
      <tr 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ 
          backgroundColor: 'var(--card-subtle)', 
          fontWeight: 'bold', 
          cursor: 'pointer', 
          userSelect: 'none',
          borderBottom: '2px solid var(--line)',
          transition: 'background-color 0.15s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--dropdown-hover)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--card-subtle)'}
      >
        <td colSpan={colSpan} style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text)', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ marginRight: '8px', display: 'inline-block', transition: 'transform 0.15s ease', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', color: 'var(--primary)' }}>
            ▼
          </span>
          📂 Vacancy Cluster: {title}
        </td>
      </tr>
      {isOpen && children}
    </>
  );
}
