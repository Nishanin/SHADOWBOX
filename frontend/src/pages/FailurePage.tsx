import React from 'react';
import { Link } from 'react-router-dom';
import { FAILURE_DATA } from '../data/failureData';
import { StatusBadge } from '../components/StatusBadge';
import { FailureSummary } from '../components/FailureSummary';
import { FailureDetails } from '../components/FailureDetails';
import { LogPanel } from '../components/LogPanel';
import { SignalCard } from '../components/SignalCard';
import './FailurePage.css';

/**
 * FailurePage — Step 1 entry point of the SHADOWBOX investigation workflow.
 *
 * Presents the environment-dependent test failure:
 * passes locally (macOS/IST), fails in CI (Ubuntu/UTC).
 * Provides one prominent CTA to proceed to `/investigation`.
 */
export const FailurePage: React.FC = () => {
  const data = FAILURE_DATA;

  return (
    <div className="failure-page">
      {/* 1. PAGE HEADER */}
      <header className="failure-page__header">
        <div className="failure-page__header-content">
          <div className="failure-page__title-row">
            <h1 className="failure-page__title">{data.pageTitle}</h1>
            <StatusBadge status={data.status} variant="fail" size="md" />
          </div>
          <p className="failure-page__subtitle">{data.pageSubtitle}</p>
        </div>
      </header>

      {/* 2. FAILURE SUMMARY (with Environment Comparison & Counts) */}
      <FailureSummary
        testName={data.testName}
        testFile={data.testFile}
        status={data.status}
        metrics={data.metrics}
        environments={data.environments}
      />

      {/* TWO-COLUMN DIAGNOSTIC GRID: Failure Details + Initial Signal VS Test Output */}
      <div className="failure-page__diagnostics-grid">
        <div className="failure-page__column failure-page__column--details">
          {/* 3. FAILURE DETAILS */}
          <FailureDetails details={data.details} />

          {/* 5. ROOT CAUSE PREVIEW (INITIAL SIGNAL) */}
          <SignalCard signal={data.initialSignal} />
        </div>

        <div className="failure-page__column failure-page__column--output">
          {/* 4. ERROR OUTPUT */}
          <LogPanel lines={data.rawLogOutput} />
        </div>
      </div>

      {/* 6. PRIMARY ACTION */}
      <section className="failure-page__action-bar" aria-label="Investigation trigger">
        <div className="failure-page__action-callout">
          <span className="failure-page__action-title">Ready to investigate</span>
          <span className="failure-page__action-desc">
            Reproduce this failure in a sandboxed container to isolate environment parameters.
          </span>
        </div>
        <Link
          to={data.ctaPath}
          className="failure-page__cta-btn"
          id="investigate-failure-btn"
        >
          <span>{data.ctaText}</span>
          <span className="failure-page__cta-arrow" aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
};
