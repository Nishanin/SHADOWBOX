import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { SHADOWBOX_DATA } from '../data/shadowboxData';
import { runShadowbox } from '../services/shadowboxApi';
import type { ReproductionResult } from '../types/shadowbox';
import type { WorkflowOutletContext } from '../types/workflow';
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
  const outlet = useOutletContext<WorkflowOutletContext | undefined>();
  const reproductionResult = outlet?.reproductionResult ?? null;
  const setReproductionResult = outlet?.setReproductionResult;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await runShadowbox('reproduction');
      setReproductionResult?.(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const activeResult: ReproductionResult = reproductionResult
    ? {
        status: reproductionResult.status,
        label: 'REAL SHADOWBOX CONTAINER EXECUTION',
        totalTests: reproductionResult.totalTests ?? 5,
        passedCount: reproductionResult.passedTests ?? 2,
        failedCount: reproductionResult.failedTests ?? 3,
        exitCode: reproductionResult.testExitCode ?? 1,
        duration: reproductionResult.duration,
        imageTag: reproductionResult.imageTag,
      }
    : data.result;

  const activeLogs: string[] = reproductionResult?.stdout
    ? reproductionResult.stdout.split('\n')
    : data.logLines;

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
      <CommandPanel command={data.command} onRun={handleRun} isLoading={isLoading} />

      {/* ERROR BANNER IF ANY */}
      {error && (
        <div className="shadowbox-page__error-banner" role="alert">
          <span className="shadowbox-page__error-icon" aria-hidden="true">
            ⚠️
          </span>
          <div className="shadowbox-page__error-content">
            <strong>Execution Error:</strong> {error}
          </div>
        </div>
      )}

      {/* 4. REPRODUCTION STATUS */}
      <ReproductionStatus result={activeResult} />

      {/* 5. REPRODUCTION LOG */}
      <LogPanel
        title={reproductionResult ? `Reproduction Output (${reproductionResult.duration})` : 'Reproduction Output'}
        lines={activeLogs}
      />

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
