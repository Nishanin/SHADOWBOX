import React from 'react';
import type { FailureDetailsData } from '../types/failure';
import './FailureDetails.css';

interface FailureDetailsProps {
  details: FailureDetailsData;
}

export const FailureDetails: React.FC<FailureDetailsProps> = ({ details }) => {
  return (
    <section className="failure-details" aria-labelledby="failure-details-heading">
      <div className="failure-details__header">
        <h2 id="failure-details-heading" className="failure-details__title">
          Failure Details
        </h2>
        <span className="failure-details__badge">Assertion Mismatch</span>
      </div>

      <div className="failure-details__body">
        {/* Expected vs Actual Diff */}
        <div className="failure-details__diff">
          <div className="failure-details__diff-item failure-details__diff-item--expected">
            <div className="failure-details__diff-header">
              <span className="failure-details__diff-indicator" aria-hidden="true">✓</span>
              <span className="failure-details__diff-label">Expected</span>
            </div>
            <div className="failure-details__diff-content">
              <code>{details.expected}</code>
            </div>
          </div>

          <div className="failure-details__diff-item failure-details__diff-item--actual">
            <div className="failure-details__diff-header">
              <span className="failure-details__diff-indicator" aria-hidden="true">✕</span>
              <span className="failure-details__diff-label">Actual</span>
            </div>
            <div className="failure-details__diff-content">
              <code>{details.actual}</code>
            </div>
          </div>
        </div>

        {/* Diagnostic Metadata */}
        <div className="failure-details__meta-grid">
          <div className="failure-details__meta-item">
            <span className="failure-details__meta-label">Timestamp</span>
            <div className="failure-details__meta-val-wrapper">
              <code className="failure-details__meta-value">{details.timestamp}</code>
              <span className="failure-details__meta-note">Execution moment</span>
            </div>
          </div>

          <div className="failure-details__meta-item">
            <span className="failure-details__meta-label">Environment</span>
            <div className="failure-details__meta-val-wrapper">
              <code className="failure-details__meta-value failure-details__meta-value--env">
                {details.environment}
              </code>
              <span className="failure-details__meta-note">CI runner setting</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
