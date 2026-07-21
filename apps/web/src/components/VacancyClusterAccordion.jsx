import React, { useState } from 'react';

export default function VacancyClusterAccordion({ title, colSpan, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <>
      <tr 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ 
          backgroundColor: '#f8fafc', 
          fontWeight: 'bold', 
          cursor: 'pointer', 
          userSelect: 'none',
          borderBottom: '2px solid var(--line)'
        }}
      >
        <td colSpan={colSpan} style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--navy)', borderLeft: '4px solid var(--blue)' }}>
          <span style={{ marginRight: '8px', display: 'inline-block', transition: 'transform 0.15s ease', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            ▼
          </span>
          📂 Vacancy Cluster: {title}
        </td>
      </tr>
      {isOpen && children}
    </>
  );
}
