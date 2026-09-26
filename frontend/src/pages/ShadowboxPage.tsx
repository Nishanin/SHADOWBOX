import React from 'react';
import { Link } from 'react-router-dom';
import { SHADOWBOX_DATA } from '../data/shadowboxData';
import { StatusBadge } from '../components/StatusBadge';
import { ReproductionEnvironment } from '../components/ReproductionEnvironment';
import { CommandPanel } from '../components/CommandPanel';
import { ReproductionStatus } from '../components/ReproductionStatus';
import { LogPanel } from '../components/LogPanel';
import { FailureMatch } from '../components/FailureMatch';
import { ReproductionEvidence } from '../components/ReproductionEvidence';
import { ReproductionBoundary } from '../components/ReproductionBoundary';
import './ShadowboxPage.css';

/**
 * ShadowboxPage — Step 4 of the SHADOWBOX workflow.
 *
 * Demonstrates the controlled, isolated reproduction of the diagnosed
 * failure in a Linux container with TZ=UTC and Node 20.
 * Concludes with failure signature matching, evidence, and progression to verification.
 */
export const ShadowboxPage: React.FC = () => {
  const data = SHADOWBOX_DATA;

  return (
    <div className="shadowbox-page">
      {/* 1. PAGE HEADER */}
      <header className="shadowbox-page__header">
        <div className="shadowbox-page__header-top">
          <div className="shadowbox-page__title-group">
            <h1 className="shadowbox-page__title">{data.pageTitle}</h1>
            <StatusBadge status={data.statusBadge} variant="investigating" size="md" />
          </div>

          <div className="shadowbox-page__target-badge" aria-label="Scenario target">
            <span className="shadowbox-page__target-label">Scenario:</span>
            <code className="shadowbox-page__target-name">{data.scenario}</code>
          </div>
        </div>

        <p className="shadowbox-page__subtitle">{data.pageSubtitle}</p>
      </header>

      {/* 2. REPRODUCTION ENVIRONMENT */}
      <ReproductionEnvironment env={data.environment} />

      {/* 3. REPRODUCTION COMMAND */}
      <CommandPanel command={data.command} />

      {/* 4. REPRODUCTION STATUS */}
      <ReproductionStatus result={data.result} />

      {/* 5. REPRODUCTION LOG */}
      <LogPanel title="Reproduction Output" lines={data.logLines} />

      {/* 6. FAILURE MATCH */}
      <FailureMatch match={data.match} />

      {/* 7 & 8. WHAT HAS BEEN PROVEN & WHAT HAS NOT BEEN PROVEN */}
      <div className="shadowbox-page__evidence-grid">
        <ReproductionEvidence evidence={data.evidence} />
        <ReproductionBoundary boundary={data.boundary} />
      </div>

      {/* 9. PRIMARY ACTION */}
      <section className="shadowbox-page__action-bar" aria-label="Workflow progression">
        <div className="shadowbox-page__action-info">
          <span className="shadowbox-page__action-title">Deterministic Reproduction Confirmed</span>
          <span className="shadowbox-page__action-desc">
            The failure reproduces consistently in isolation under TZ=UTC. Proceed to verify the candidate
            fix against both environments.
          </span>
        </div>

        <div className="shadowbox-page__buttons">
          <Link to={data.backPath} className="shadowbox-page__back-btn">
            ← Back to Root Cause
          </Link>

          <Link
            to={data.ctaPath}
            className="shadowbox-page__cta-btn"
            id="continue-verification-btn"
          >
            <span>{data.ctaText}</span>
            <span className="shadowbox-page__cta-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
};
