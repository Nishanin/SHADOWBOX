import React from 'react';
import type { BeforeAfterComparisonData } from '../types/verification';
import { StatusBadge } from './StatusBadge';
import './BeforeAfterComparison.css';

interface BeforeAfterComparisonProps {
  data: BeforeAfterComparisonData;
}

export const BeforeAfterComparison: React.FC<BeforeAfterComparisonProps> = ({ data }) => {
  return (
    <section className="before-after" aria-labelledby="before-after-heading">
      <div className="before-after__header">
        <div className="before-after__title-group">
          <span className="before-after__icon" aria-hidden="true">
            ⚖️
          </span>
          <h2 id="before-after-heading" className="before-after__title">
            {data.title}
          </h2>
        </div>
        <span className="before-after__badge">Full Lifecycle Contrast</span>
      </div>

      <div className="before-after__body">
        <div className="before-after__grid">
          {/* Before */}
          <div className="before-after__card before-after__card--before">
            <div className="before-after__card-head">
              <span className="before-after__card-label">Before Fix</span>
              <StatusBadge status={data.before.status} variant="fail" size="sm" />
            </div>

            <div className="before-after__card-content">
              <div className="before-after__row">
                <span className="before-after__row-name">Environment</span>
                <code className="before-after__row-val">{data.before.environment}</code>
              </div>
              <div className="before-after__row">
                <span className="before-after__row-name">Test Suite Scope</span>
                <span className="before-after__row-val">{data.before.tests}</span>
              </div>
              <div className="before-after__row">
                <span className="before-after__row-name">Execution Outcome</span>
                <code className="before-after__row-val before-after__row-val--fail">
                  {data.before.result}
                </code>
              </div>
            </div>
          </div>

          <div className="before-after__arrow" aria-hidden="true">
            →
          </div>

          {/* After */}
          <div className="before-after__card before-after__card--after">
            <div className="before-after__card-head">
              <span className="before-after__card-label before-after__card-label--after">
                After Fix
              </span>
              <StatusBadge status={data.after.status} variant="pass" size="sm" />
            </div>

            <div className="before-after__card-content">
              <div className="before-after__row">
                <span className="before-after__row-name">Environment</span>
                <code className="before-after__row-val">{data.after.environment}</code>
              </div>
              <div className="before-after__row">
                <span className="before-after__row-name">Test Suite Scope</span>
                <span className="before-after__row-val">{data.after.tests}</span>
              </div>
              <div className="before-after__row">
                <span className="before-after__row-name">Execution Outcome</span>
                <code className="before-after__row-val before-after__row-val--pass">
                  {data.after.result}
                </code>
              </div>
            </div>
          </div>
        </div>

        <p className="before-after__note">{data.note}</p>
      </div>
    </section>
  );
};
