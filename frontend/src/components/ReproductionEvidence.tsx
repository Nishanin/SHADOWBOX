import React from 'react';
import type { ReproductionEvidenceData } from '../types/shadowbox';
import './ReproductionEvidence.css';

interface ReproductionEvidenceProps {
  evidence: ReproductionEvidenceData;
}

export const ReproductionEvidence: React.FC<ReproductionEvidenceProps> = ({ evidence }) => {
  return (
    <section className="repro-evidence" aria-labelledby="repro-evidence-heading">
      <div className="repro-evidence__header">
        <div className="repro-evidence__title-group">
          <span className="repro-evidence__icon" aria-hidden="true">
            🔬
          </span>
          <h2 id="repro-evidence-heading" className="repro-evidence__title">
            {evidence.title}
          </h2>
        </div>
        <span className="repro-evidence__badge">Proven Invariants</span>
      </div>

      <div className="repro-evidence__body">
        <ol className="repro-evidence__list">
          {evidence.points.map((point, idx) => (
            <li key={idx} className="repro-evidence__item">
              <span className="repro-evidence__step-num" aria-hidden="true">
                {idx + 1}
              </span>
              <span className="repro-evidence__point-text">{point}</span>
            </li>
          ))}
        </ol>

        <div className="repro-evidence__conclusion-box">
          <span className="repro-evidence__conclusion-icon" aria-hidden="true">
            📌
          </span>
          <p className="repro-evidence__conclusion-text">{evidence.conclusion}</p>
        </div>
      </div>
    </section>
  );
};
