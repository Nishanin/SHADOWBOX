import React from 'react';
import type { EvidenceItem } from '../types/investigation';
import './EvidenceList.css';

interface EvidenceListProps {
  evidence: EvidenceItem[];
}

export const EvidenceList: React.FC<EvidenceListProps> = ({ evidence }) => {
  return (
    <div className="evidence-list" aria-label="Evidence collection">
      <div className="evidence-list__header">
        <span className="evidence-list__eyebrow">Evidence</span>
        <span className="evidence-list__count">{evidence.length} captured</span>
      </div>

      <ul className="evidence-list__items">
        {evidence.map((item, idx) => (
          <li key={idx} className="evidence-list__item">
            <div className="evidence-list__item-top">
              <span className="evidence-list__source">{item.source}</span>
              <span className="evidence-list__type-tag">{item.type}</span>
            </div>

            <p className="evidence-list__desc">{item.description}</p>

            {item.technicalValues && item.technicalValues.length > 0 && (
              <div className="evidence-list__chips">
                {item.technicalValues.map((val, valIdx) => (
                  <code key={valIdx} className="evidence-list__chip">
                    {val}
                  </code>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
