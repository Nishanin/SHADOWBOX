import React from 'react';
import type { ShadowboxVerificationData } from '../types/verification';
import { StatusBadge } from './StatusBadge';
import './ShadowboxVerification.css';

interface ShadowboxVerificationProps {
  data: ShadowboxVerificationData;
}

export const ShadowboxVerification: React.FC<ShadowboxVerificationProps> = ({ data }) => {
  return (
    <section className="sb-verification" aria-labelledby="sb-verif-heading">
      <div className="sb-verification__header">
        <div className="sb-verification__title-group">
          <span className="sb-verification__icon" aria-hidden="true">
            📦
          </span>
          <h2 id="sb-verif-heading" className="sb-verification__title">
            {data.title}
          </h2>
        </div>

        <div className="sb-verification__state-transition">
          <span className="sb-verification__prev-label">Earlier:</span>
          <span className="sb-verification__prev-pill">{data.earlierStatus}</span>
          <span className="sb-verification__transition-arrow" aria-hidden="true">
            →
          </span>
          <span className="sb-verification__now-label">Now:</span>
          <StatusBadge status={data.status} variant="pass" size="sm" />
        </div>
      </div>

      <div className="sb-verification__body">
        <div className="sb-verification__env-strip">
          <div className="sb-verification__env-tag">
            <span className="sb-verification__env-label">Container Image</span>
            <code>{data.environment}</code>
          </div>
          <div className="sb-verification__env-tag">
            <span className="sb-verification__env-label">Runtime</span>
            <code>Node {data.nodeVersion}</code>
          </div>
          <div className="sb-verification__env-tag">
            <span className="sb-verification__env-label">Timezone</span>
            <code className="sb-verification__env-code--tz">{data.timezone}</code>
          </div>
          <div className="sb-verification__env-tag">
            <span className="sb-verification__env-label">Process Exit</span>
            <code className="sb-verification__env-code--exit">Exit code: {data.exitCode}</code>
          </div>
        </div>

        <div className="sb-verification__counts-row">
          <div className="sb-verification__count-card">
            <span className="sb-verification__count-num">{data.totalTests}</span>
            <span className="sb-verification__count-name">Total Tests</span>
          </div>
          <div className="sb-verification__count-card sb-verification__count-card--pass">
            <span className="sb-verification__count-num">{data.passedCount}</span>
            <span className="sb-verification__count-name">Passed</span>
          </div>
          <div className="sb-verification__count-card">
            <span className="sb-verification__count-num">{data.failedCount}</span>
            <span className="sb-verification__count-name">Failed</span>
          </div>
        </div>

        <div className="sb-verification__signal-callout">
          <span className="sb-verification__signal-icon" aria-hidden="true">
            🎯
          </span>
          <p className="sb-verification__signal-text">
            <strong>Strongest Verification Signal:</strong> {data.explanation}
          </p>
        </div>
      </div>
    </section>
  );
};
