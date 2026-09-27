import React from 'react';
import type { ReproductionResult } from '../types/shadowbox';
import { StatusBadge } from './StatusBadge';
import './ReproductionStatus.css';

interface ReproductionStatusProps {
  result: ReproductionResult;
}

export const ReproductionStatus: React.FC<ReproductionStatusProps> = ({ result }) => {
  const badgeVariant =
    result.status === 'REPRODUCED' || result.status === 'FAILURE REPRODUCED'
      ? 'fail'
      : result.status === 'NO_FAILURE' || result.status === 'VERIFIED'
      ? 'pass'
      : result.status === 'PENDING' || result.status === 'INVESTIGATING'
      ? 'investigating'
      : 'unconfirmed';

  return (
    <section className="repro-status" aria-labelledby="repro-status-heading">
      <div className="repro-status__left">
        <span className="repro-status__eyebrow">Reproduction Outcome</span>
        <div className="repro-status__main-row">
          <StatusBadge status={result.status} variant={badgeVariant} size="lg" />
          <span className="repro-status__demo-tag">{result.label}</span>
        </div>
      </div>

      <div className="repro-status__metrics">
        <div className="repro-status__metric-item">
          <span className="repro-status__metric-label">Test Total</span>
          <span className="repro-status__metric-val">{result.totalTests} tests</span>
        </div>

        <div className="repro-status__metric-item repro-status__metric-item--pass">
          <span className="repro-status__metric-label">Passed</span>
          <span className="repro-status__metric-val">{result.passedCount} passed</span>
        </div>

        <div className="repro-status__metric-item repro-status__metric-item--fail">
          <span className="repro-status__metric-label">Failed</span>
          <span className="repro-status__metric-val">{result.failedCount} failed</span>
        </div>

        <div className="repro-status__metric-item repro-status__metric-item--exit">
          <span className="repro-status__metric-label">Process Exit Code</span>
          <code className="repro-status__exit-code">{result.exitCode}</code>
        </div>

        {result.duration && (
          <div className="repro-status__metric-item repro-status__metric-item--duration">
            <span className="repro-status__metric-label">Duration</span>
            <span className="repro-status__metric-val">{result.duration}</span>
          </div>
        )}
      </div>
    </section>
  );
};
