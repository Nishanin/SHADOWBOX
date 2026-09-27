import React from 'react';
import type { ValidationLayer } from '../types/verification';
import { StatusBadge } from './StatusBadge';
import './VerificationSummary.css';

interface VerificationSummaryProps {
  status: string;
  summaryText: string;
  layers: ValidationLayer[];
}

export const VerificationSummary: React.FC<VerificationSummaryProps> = ({
  status,
  summaryText,
  layers,
}) => {
  return (
    <section className="verification-summary" aria-labelledby="verification-summary-heading">
      <div className="verification-summary__top">
        <div className="verification-summary__status-info">
          <span className="verification-summary__eyebrow">Overall Outcome</span>
          <div className="verification-summary__status-row">
            <StatusBadge status={status} variant="pass" size="lg" />
            <h2 id="verification-summary-heading" className="verification-summary__heading">
              {summaryText}
            </h2>
          </div>
        </div>
      </div>

      <div className="verification-summary__layers">
        {layers.map((layer) => (
          <div key={layer.id} className="verification-summary__layer-card">
            <div className="verification-summary__layer-header">
              <span className="verification-summary__layer-icon" aria-hidden="true">
                {layer.icon}
              </span>
              <h3 className="verification-summary__layer-title">{layer.name}</h3>
              <StatusBadge status={layer.status} variant="pass" size="sm" />
            </div>
            <p className="verification-summary__layer-summary">{layer.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
