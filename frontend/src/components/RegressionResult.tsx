import React from 'react';
import type { RegressionResultData } from '../types/verification';
import { StatusBadge } from './StatusBadge';
import './RegressionResult.css';

interface RegressionResultProps {
  data: RegressionResultData;
}

export const RegressionResult: React.FC<RegressionResultProps> = ({ data }) => {
  return (
    <section className="regression-result" aria-labelledby="regression-heading">
      <div className="regression-result__header">
        <div className="regression-result__title-group">
          <span className="regression-result__icon" aria-hidden="true">
            🛡️
          </span>
          <h2 id="regression-heading" className="regression-result__title">
            {data.title}
          </h2>
        </div>
        <StatusBadge status={data.status} variant="pass" size="sm" />
      </div>

      <div className="regression-result__body">
        <div className="regression-result__test-bar">
          <span className="regression-result__label">Target Test:</span>
          <code className="regression-result__test-name">{data.testName}</code>
        </div>

        <p className="regression-result__purpose">{data.purpose}</p>

        <div className="regression-result__meta-grid">
          <div className="regression-result__meta-item">
            <span className="regression-result__meta-label">Environment</span>
            <code className="regression-result__meta-val">{data.environment}</code>
          </div>

          <div className="regression-result__meta-item">
            <span className="regression-result__meta-label">Expected Value</span>
            <code className="regression-result__meta-val regression-result__meta-val--pass">
              {data.expected}
            </code>
          </div>

          <div className="regression-result__meta-item">
            <span className="regression-result__meta-label">Actual Value</span>
            <code className="regression-result__meta-val regression-result__meta-val--pass">
              {data.actual}
            </code>
          </div>

          <div className="regression-result__meta-item">
            <span className="regression-result__meta-label">Assertion Status</span>
            <span className="regression-result__assertion-match">MATCHED (Preserved)</span>
          </div>
        </div>

        <p className="regression-result__explanation">{data.explanation}</p>
      </div>
    </section>
  );
};
