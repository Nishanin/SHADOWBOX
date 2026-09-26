import React from 'react';
import type { MissingEvidenceItem } from '../types/investigation';
import './MissingEvidence.css';

interface MissingEvidenceProps {
  items: MissingEvidenceItem[];
}

export const MissingEvidence: React.FC<MissingEvidenceProps> = ({ items }) => {
  return (
    <div className="missing-evidence" aria-label="Missing evidence log">
      <div className="missing-evidence__header">
        <span className="missing-evidence__eyebrow">Missing Evidence</span>
        <span className="missing-evidence__badge">Out of Scope / Pending</span>
      </div>

      <div className="missing-evidence__list">
        {items.map((item, idx) => (
          <div key={idx} className="missing-evidence__item">
            <p className="missing-evidence__desc">{item.description}</p>
            <div className="missing-evidence__why">
              <span className="missing-evidence__why-label">Relevance:</span>
              <span className="missing-evidence__why-text">{item.whyItMatters}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
