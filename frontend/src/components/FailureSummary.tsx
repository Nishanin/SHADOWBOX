import React from 'react';
import type { EnvironmentRun, TestMetrics } from '../types/failure';
import { StatusBadge } from './StatusBadge';
import { EnvironmentComparison } from './EnvironmentComparison';
import './FailureSummary.css';

interface FailureSummaryProps {
  testName: string;
  testFile?: string;
  status: string;
  metrics: TestMetrics;
  environments: {
    local: EnvironmentRun;
    ci: EnvironmentRun;
  };
}

export const FailureSummary: React.FC<FailureSummaryProps> = ({
  testName,
  testFile,
  status,
  metrics,
  environments,
}) => {
  return (
    <section className="failure-summary" aria-labelledby="failure-summary-title">
      <div className="failure-summary__top">
        <div className="failure-summary__info">
          <div className="failure-summary__header-meta">
            <span className="failure-summary__label">Test Target</span>
            {testFile && <code className="failure-summary__file">{testFile}</code>}
            <span className="failure-summary__demo-pill" title="Static demo failure data">
              Demo Data
            </span>
          </div>
          <h2 id="failure-summary-title" className="failure-summary__test-name">
            {testName}
          </h2>
        </div>

        <div className="failure-summary__metrics-bar">
          <StatusBadge status={status} size="lg" />
          <div className="failure-summary__counts" aria-label="Test run statistics">
            <span className="failure-summary__metric-tag failure-summary__metric-tag--total">
              <strong>{metrics.total}</strong> tests
            </span>
            <span className="failure-summary__metric-tag failure-summary__metric-tag--passed">
              <strong>{metrics.passed}</strong> passed
            </span>
            <span className="failure-summary__metric-tag failure-summary__metric-tag--failed">
              <strong>{metrics.failed}</strong> failed
            </span>
          </div>
        </div>
      </div>

      <div className="failure-summary__comparison-wrapper">
        <div className="failure-summary__section-subhead">
          <span className="failure-summary__subhead-title">Environment Contrast</span>
          <span className="failure-summary__subhead-desc">
            Local reproduction passes; CI runner fails on identical commit
          </span>
        </div>
        <EnvironmentComparison
          local={environments.local}
          ci={environments.ci}
        />
      </div>
    </section>
  );
};
