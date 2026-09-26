import React from 'react';
import type { VerificationEvidenceData } from '../types/verification';
import './VerificationEvidence.css';

interface VerificationEvidenceProps {
  data: VerificationEvidenceData;
}

export const VerificationEvidence: React.FC<VerificationEvidenceProps> = ({ data }) => {
  return (
    <section className="verif-evidence" aria-labelledby="verif-evidence-heading">
      <div className="verif-evidence__header">
        <div className="verif-evidence__title-group">
          <span className="verif-evidence__icon" aria-hidden="true">
            📋
          </span>
          <h2 id="verif-evidence-heading" className="verif-evidence__title">
            {data.title}
          </h2>
        </div>
        <span className="verif-evidence__label-badge">{data.label}</span>
      </div>

      <div className="verif-evidence__body">
        <ul className="verif-evidence__list">
          {data.points.map((point, idx) => (
            <li key={idx} className="verif-evidence__item">
              <span className="verif-evidence__check" aria-hidden="true">
                ✓
              </span>
              <span className="verif-evidence__text">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
