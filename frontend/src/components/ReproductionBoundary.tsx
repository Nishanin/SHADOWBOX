import React from 'react';
import type { ReproductionBoundaryData } from '../types/shadowbox';
import './ReproductionBoundary.css';

interface ReproductionBoundaryProps {
  boundary: ReproductionBoundaryData;
}

export const ReproductionBoundary: React.FC<ReproductionBoundaryProps> = ({ boundary }) => {
  return (
    <section className="repro-boundary" aria-labelledby="repro-boundary-heading">
      <div className="repro-boundary__header">
        <div className="repro-boundary__title-group">
          <span className="repro-boundary__icon" aria-hidden="true">
            🛡️
          </span>
          <h2 id="repro-boundary-heading" className="repro-boundary__title">
            {boundary.title}
          </h2>
        </div>
        <span className="repro-boundary__badge">Epistemic Limit</span>
      </div>

      <div className="repro-boundary__body">
        <div className="repro-boundary__callout">
          <span className="repro-boundary__callout-icon" aria-hidden="true">
            ⚠️
          </span>
          <p className="repro-boundary__text">{boundary.statement}</p>
        </div>
        <span className="repro-boundary__note">
          Scope Notice: External runner factors, host virtualization quirks, or upstream container
          caching policies remain outside the bounded reproduction sandbox.
        </span>
      </div>
    </section>
  );
};
