import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { WorkflowOutletContext } from '../types/workflow';
import { INVESTIGATION_DATA } from '../data/investigationData';
import { analyzeInvestigation } from '../services/shadowboxApi';
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
  const { session, setSession } = useOutletContext<WorkflowOutletContext>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const data = session?.isDemo ? INVESTIGATION_DATA : session?.investigationData;

  const handleAnalyze = async () => {
    if (!session || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      setSession(await analyzeInvestigation(session.id));
    } catch (error: unknown) {
      setAnalysisError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!data) {
    return (
      <div className="investigation-page">
        <header className="investigation-page__header">
          <h1 className="investigation-page__title">Investigation</h1>
          <p className="investigation-page__subtitle">
            Static repository analysis is ready to inspect environment, code, and CI evidence.
          </p>
          {analysisError && <p role="alert">{analysisError}</p>}
          <button type="button" onClick={handleAnalyze} disabled={isAnalyzing || !session}>
            {isAnalyzing ? 'Analyzing...' : 'Start Investigation'}
          </button>
        </header>
      </div>
    );
  }

  const targetFailure = session?.repositoryUrl
    ? `${session.repositoryUrl} (${session.resolvedCommit ? session.resolvedCommit.slice(0, 8) : session.branch})`
    : data.failureTarget;

  return (
    <div className="investigation-page">
      {/* 1. PAGE HEADER */}
      <header className="investigation-page__header">
        <div className="investigation-page__header-top">
          <div className="investigation-page__title-group">
            <h1 className="investigation-page__title">{data.pageTitle}</h1>
            <StatusBadge
              status={session ? session.status : data.overallStatus}
              variant={session?.status === 'INITIALIZED' ? 'pass' : 'investigating'}
              size="md"
            />
          </div>

          <div className="investigation-page__target-badge" aria-label="Investigation target">
            <span className="investigation-page__target-label">Target Failure:</span>
            <code className="investigation-page__target-name">{targetFailure}</code>
          </div>
        </div>

        <p className="investigation-page__subtitle">{data.pageSubtitle}</p>

        {session && !session.isDemo && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#334155',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <span><strong>Session ID:</strong> <code>{session.id}</code></span>
            <span><strong>Branch:</strong> <code>{session.branch}</code></span>
            {session.resolvedCommit && (
              <span><strong>Commit SHA:</strong> <code>{session.resolvedCommit}</code></span>
            )}
            <span>
              <strong>Status:</strong> {session.status} (Ingested successfully. Dynamic analysis pending Bob's workflow.)
            </span>
          </div>
        )}

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
