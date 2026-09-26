import React from 'react';
import type { VerificationBoundaryData } from '../types/verification';
import './VerificationBoundary.css';

interface VerificationBoundaryProps {
  data: VerificationBoundaryData;
}

export const VerificationBoundary: React.FC<VerificationBoundaryProps> = ({ data }) => {
  return (
    <section className="verif-boundary" aria-labelledby="verif-boundary-heading">
      <div className="verif-boundary__header">
        <div className="verif-boundary__title-group">
          <span className="verif-boundary__icon" aria-hidden="true">
            🛡️
          </span>
          <h2 id="verif-boundary-heading" className="verif-boundary__title">
            {data.title}
          </h2>
        </div>
        <span className="verif-boundary__badge">Epistemic Boundary</span>
      </div>

      <div className="verif-boundary__body">
        <div className="verif-boundary__callout">
          <span className="verif-boundary__callout-icon" aria-hidden="true">
            ⚠️
          </span>
          <p className="verif-boundary__text">{data.statement}</p>
        </div>
        <p className="verif-boundary__note">
          Scope Notice: Test suites validate deterministic behavior against documented specifications
          and known regressions; exotic environment configurations, system locale mismatches, or
          external runtime bugs require separate isolated verification.
        </p>
      </div>
    </section>
  );
};
