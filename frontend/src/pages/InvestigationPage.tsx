import React from 'react';
import { Link } from 'react-router-dom';
import { INVESTIGATION_DATA } from '../data/investigationData';
import { StatusBadge } from '../components/StatusBadge';
import { InvestigationCard } from '../components/InvestigationCard';
import { InvestigationSynthesis } from '../components/InvestigationSynthesis';
import './InvestigationPage.css';

/**
 * InvestigationPage — Step 2 of the SHADOWBOX workflow.
 *
 * Visualizes three parallel investigation agents (Environment, Code, CI)
 * inspecting the failure concurrently without sequential dependencies.
 * Concludes with a preliminary synthesis and a primary CTA to `/root-cause`.
 */
export const InvestigationPage: React.FC = () => {
  const data = INVESTIGATION_DATA;

  return (
    <div className="investigation-page">
      {/* 1. PAGE HEADER */}
      <header className="investigation-page__header">
        <div className="investigation-page__header-top">
          <div className="investigation-page__title-group">
            <h1 className="investigation-page__title">{data.pageTitle}</h1>
            <StatusBadge status={data.overallStatus} variant="investigating" size="md" />
          </div>

          <div className="investigation-page__target-badge" aria-label="Investigation target">
            <span className="investigation-page__target-label">Target Failure:</span>
            <code className="investigation-page__target-name">{data.failureTarget}</code>
          </div>
        </div>

        <p className="investigation-page__subtitle">{data.pageSubtitle}</p>

        <div className="investigation-page__parallel-notice">
          <span className="investigation-page__parallel-indicator" aria-hidden="true">
            ⚡
          </span>
          <span>
            <strong>Parallel Execution Mode:</strong> All three agents run concurrently. No track
            depends on another.
          </span>
        </div>
      </header>

      {/* 2. PARALLEL INVESTIGATION OVERVIEW (3 EQUAL CARDS) */}
      <section className="investigation-page__tracks" aria-label="Parallel Investigation Tracks">
        <div className="investigation-page__grid">
          {data.tracks.map((track) => (
            <InvestigationCard key={track.id} track={track} />
          ))}
        </div>
      </section>

      {/* 8. OVERALL SYNTHESIS */}
      <InvestigationSynthesis synthesis={data.synthesis} />

      {/* 9. PRIMARY ACTION */}
      <section className="investigation-page__action-bar" aria-label="Workflow progression">
        <div className="investigation-page__action-info">
          <span className="investigation-page__action-title">Evidence Collected</span>
          <span className="investigation-page__action-desc">
            All three parallel tracks have completed analysis. Proceed to synthesize and isolate the
            root cause candidate.
          </span>
        </div>

        <Link
          to={data.ctaPath}
          className="investigation-page__cta-btn"
          id="review-root-cause-btn"
        >
          <span>{data.ctaText}</span>
          <span className="investigation-page__cta-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </section>
    </div>
  );
};
