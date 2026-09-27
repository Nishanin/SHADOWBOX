import React from 'react';
import type { ConfidenceLevel } from '../types/rootCause';
import { StatusBadge } from './StatusBadge';
import './RootCauseDiagnosis.css';

interface RootCauseDiagnosisProps {
  status: string;
  confidenceRating: ConfidenceLevel;
  confidenceNote?: string;
  title: string;
  description: string;
  category: string;
  affectedComponent: string;
  impactSummary: string;
}

export const RootCauseDiagnosis: React.FC<RootCauseDiagnosisProps> = ({
  status,
  confidenceRating,
  confidenceNote,
  title,
  description,
  category,
  affectedComponent,
  impactSummary,
}) => {
  return (
    <section className="root-cause-diagnosis" aria-labelledby="diagnosis-heading">
      <div className="root-cause-diagnosis__top">
        <div className="root-cause-diagnosis__header-left">
          <span className="root-cause-diagnosis__eyebrow">Diagnosed Defect</span>
          <h2 id="diagnosis-heading" className="root-cause-diagnosis__title">
            {title}
          </h2>
        </div>

        <div className="root-cause-diagnosis__badges">
          <StatusBadge status={status} variant="pass" size="md" />
          <div className="root-cause-diagnosis__confidence-pill" title="Synthesized confidence rating">
            <span className="root-cause-diagnosis__confidence-dot" aria-hidden="true" />
            <span className="root-cause-diagnosis__confidence-label">
              <strong>{confidenceRating} CONFIDENCE</strong>
            </span>
            {confidenceNote && (
              <span className="root-cause-diagnosis__confidence-sub">
                · {confidenceNote}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="root-cause-diagnosis__body">
        <p className="root-cause-diagnosis__desc">{description}</p>

        <div className="root-cause-diagnosis__meta-grid">
          <div className="root-cause-diagnosis__meta-item">
            <span className="root-cause-diagnosis__meta-label">Category</span>
            <span className="root-cause-diagnosis__meta-val">{category}</span>
          </div>

          <div className="root-cause-diagnosis__meta-item">
            <span className="root-cause-diagnosis__meta-label">Affected Component</span>
            <code className="root-cause-diagnosis__meta-val root-cause-diagnosis__meta-val--code">
              {affectedComponent}
            </code>
          </div>

          <div className="root-cause-diagnosis__meta-item">
            <span className="root-cause-diagnosis__meta-label">Impact Summary</span>
            <span className="root-cause-diagnosis__meta-val">{impactSummary}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
