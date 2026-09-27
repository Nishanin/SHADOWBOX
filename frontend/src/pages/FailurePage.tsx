import React, { useState } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import type { WorkflowOutletContext } from '../types/workflow';
import { createInvestigation } from '../services/shadowboxApi';
import { validateIntakeForm } from '../services/intakeValidation';
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
 * Provides:
 * 1. User Intake UI: Submit GitHub repository URL, branch, error description, CI logs, and environment.
 * 2. Load Verified Demo: Instant offline reproduction using pre-verified timezone scenario.
 * 3. Diagnostic Preview: Displays active session status and demo failure diagnostics.
 */
export const FailurePage: React.FC = () => {
  const navigate = useNavigate();
  const { session, setSession } = useOutletContext<WorkflowOutletContext>();

  // Form Fields
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [errorDescription, setErrorDescription] = useState('');
  const [ciLog, setCiLog] = useState('');
  const [envOs, setEnvOs] = useState('');
  const [envNode, setEnvNode] = useState('');
  const [envTz, setEnvTz] = useState('');

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'intake' | 'demo' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [showDemoDetails, setShowDemoDetails] = useState(false);

  // Submit User Intake
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent duplicate submission

    const validation = validateIntakeForm({
      repositoryUrl,
      branch,
      errorDescription,
      ciLog,
      environment: {
        os: envOs,
        nodeVersion: envNode,
        timezone: envTz,
      },
    });

    if (!validation.isValid || !validation.cleanedPayload) {
      setFieldErrors(validation.errors);
      setApiError(null);
      return;
    }

    setFieldErrors({});
    setApiError(null);
    setIsLoading(true);
    setLoadingAction('intake');

    try {
      const newSession = await createInvestigation(validation.cleanedPayload);
      setSession(newSession);
      navigate('/investigation');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setApiError(message);
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  // Load Verified Demo
  const handleLoadDemo = async () => {
    if (isLoading) return; // Prevent duplicate submission

    setFieldErrors({});
    setApiError(null);
    setIsLoading(true);
    setLoadingAction('demo');

    try {
      const demoSession = await createInvestigation({ isDemo: true });
      setSession(demoSession);
      navigate('/investigation');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setApiError(message);
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const demoData = FAILURE_DATA;

  return (
    <div className="failure-page">
      {/* 1. PAGE HEADER */}
      <header className="failure-page__header">
        <div className="failure-page__header-content">
          <div className="failure-page__title-row">
            <h1 className="failure-page__title">SHADOWBOX Failure Intake</h1>
            <StatusBadge
              status={session ? session.status : 'AWAITING_INPUT'}
              variant={session?.status === 'INITIALIZED' ? 'pass' : 'investigating'}
              size="md"
            />
          </div>
          <p className="failure-page__subtitle">
            Provide an untrusted GitHub repository to isolate environment-dependent bugs in a sandboxed
            container, or load our verified demo to test the reproduction and fix pipeline.
          </p>
        </div>
      </header>

      {/* ACTIVE SESSION BANNER (if an investigation is already in context) */}
      {session && (
        <section className="failure-page__session-banner" aria-label="Active investigation session">
          <div className="failure-page__session-banner-info">
            <span className="failure-page__session-tag">
              {session.isDemo ? '★ Verified Demo Session Active' : 'Active Investigation Session'}
            </span>
            <div className="failure-page__session-details">
              <span><strong>ID:</strong> <code>{session.id}</code></span>
              <span><strong>Repo:</strong> <code>{session.repositoryUrl}</code></span>
              <span><strong>Branch:</strong> <code>{session.branch}</code></span>
              {session.resolvedCommit && (
                <span><strong>Commit:</strong> <code>{session.resolvedCommit.slice(0, 8)}</code></span>
              )}
            </div>
          </div>
          <Link
            to="/investigation"
            className="failure-page__session-continue-btn"
            id="continue-investigation-btn"
          >
            <span>Continue to Investigation</span>
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}

      {/* 2. INTAKE FORM CARD */}
      <section className="failure-page__intake-card" aria-label="Investigation Intake Form">
        <div className="failure-page__intake-header">
          <h2 className="failure-page__intake-title">Investigate New Repository</h2>
          <span className="failure-page__intake-badge">Sandboxed Clone & Inspection</span>
        </div>

        {/* API ERROR ALERT */}
        {apiError && (
          <div className="failure-page__alert failure-page__alert--error" role="alert">
            <span className="failure-page__alert-icon" aria-hidden="true">⚠️</span>
            <div className="failure-page__alert-content">
              <strong>Investigation Ingestion Failed:</strong>
              <p>{apiError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="failure-page__form" noValidate>
          {/* REPOSITORY URL */}
          <div className="failure-page__form-group">
            <label htmlFor="intake-repo-url" className="failure-page__label">
              GitHub Repository URL <span className="failure-page__required">*</span>
            </label>
            <input
              id="intake-repo-url"
              type="url"
              className={`failure-page__input ${fieldErrors.repositoryUrl ? 'failure-page__input--error' : ''}`}
              placeholder="https://github.com/owner/repository"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              disabled={isLoading}
              required
            />
            {fieldErrors.repositoryUrl && (
              <span className="failure-page__error-msg">{fieldErrors.repositoryUrl}</span>
            )}
            <span className="failure-page__field-hint">
              Must be a public HTTPS GitHub repository (e.g. https://github.com/facebook/react).
            </span>
          </div>

          {/* BRANCH */}
          <div className="failure-page__form-group">
            <label htmlFor="intake-branch" className="failure-page__label">
              Branch <span className="failure-page__optional">(optional, default: main)</span>
            </label>
            <input
              id="intake-branch"
              type="text"
              className={`failure-page__input ${fieldErrors.branch ? 'failure-page__input--error' : ''}`}
              placeholder="main"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={isLoading}
            />
            {fieldErrors.branch && (
              <span className="failure-page__error-msg">{fieldErrors.branch}</span>
            )}
          </div>

          {/* ERROR DESCRIPTION */}
          <div className="failure-page__form-group">
            <label htmlFor="intake-error-description" className="failure-page__label">
              What went wrong? (Failure Description) <span className="failure-page__required">*</span>
            </label>
            <textarea
              id="intake-error-description"
              className={`failure-page__textarea ${fieldErrors.errorDescription ? 'failure-page__input--error' : ''}`}
              placeholder="Describe the failure (e.g. Tests pass locally in IST but fail in CI under UTC; invoice calendar date discrepancy)..."
              rows={3}
              value={errorDescription}
              onChange={(e) => setErrorDescription(e.target.value)}
              disabled={isLoading}
              required
            />
            {fieldErrors.errorDescription && (
              <span className="failure-page__error-msg">{fieldErrors.errorDescription}</span>
            )}
          </div>

          {/* CI LOGS (OPTIONAL) */}
          <div className="failure-page__form-group">
            <label htmlFor="intake-ci-logs" className="failure-page__label">
              CI Logs / Terminal Failure Output <span className="failure-page__optional">(optional)</span>
            </label>
            <textarea
              id="intake-ci-logs"
              className="failure-page__textarea failure-page__textarea--code"
              placeholder="Paste relevant test output, stack trace, or failure messages..."
              rows={4}
              value={ciLog}
              onChange={(e) => setCiLog(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* ENVIRONMENT INFORMATION (OPTIONAL) */}
          <fieldset className="failure-page__fieldset">
            <legend className="failure-page__legend">
              Target Environment Parameters <span className="failure-page__optional">(optional)</span>
            </legend>
            <div className="failure-page__env-grid">
              <div className="failure-page__form-group">
                <label htmlFor="intake-env-os" className="failure-page__sublabel">Operating System</label>
                <input
                  id="intake-env-os"
                  type="text"
                  className="failure-page__input"
                  placeholder="Ubuntu 22.04"
                  value={envOs}
                  onChange={(e) => setEnvOs(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="failure-page__form-group">
                <label htmlFor="intake-env-node" className="failure-page__sublabel">Node Version</label>
                <input
                  id="intake-env-node"
                  type="text"
                  className="failure-page__input"
                  placeholder="20"
                  value={envNode}
                  onChange={(e) => setEnvNode(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="failure-page__form-group">
                <label htmlFor="intake-env-tz" className="failure-page__sublabel">Timezone</label>
                <input
                  id="intake-env-tz"
                  type="text"
                  className="failure-page__input"
                  placeholder="UTC"
                  value={envTz}
                  onChange={(e) => setEnvTz(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </fieldset>

          {/* ACTION BUTTONS */}
          <div className="failure-page__form-actions">
            <button
              type="submit"
              className="failure-page__btn failure-page__btn--primary"
              id="investigate-failure-btn"
              disabled={isLoading}
            >
              {isLoading && loadingAction === 'intake' ? (
                <>
                  <span className="failure-page__spinner" aria-hidden="true" />
                  <span>Cloning & Ingesting Repository...</span>
                </>
              ) : (
                <>
                  <span>Investigate Repository</span>
                  <span className="failure-page__cta-arrow" aria-hidden="true">→</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="failure-page__btn failure-page__btn--demo"
              id="load-demo-btn"
              onClick={handleLoadDemo}
              disabled={isLoading}
            >
              {isLoading && loadingAction === 'demo' ? (
                <>
                  <span className="failure-page__spinner" aria-hidden="true" />
                  <span>Initializing Demo Session...</span>
                </>
              ) : (
                <>
                  <span>★ Load Verified Demo ★</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* 3. DEMO SCENARIO ACCORDION / PREVIEW */}
      <section className="failure-page__demo-preview-card" aria-label="Demo Failure Reference">
        <div className="failure-page__demo-preview-header">
          <div>
            <h3 className="failure-page__demo-preview-title">Verified Benchmark Scenario: Timezone Discrepancy</h3>
            <p className="failure-page__demo-preview-desc">
              Reference defect in <code>demo-app</code>: Invoice calendar date validator passes in local IST (+05:30)
              but breaks under UTC.
            </p>
          </div>
          <button
            type="button"
            className="failure-page__toggle-demo-btn"
            onClick={() => setShowDemoDetails(!showDemoDetails)}
            aria-expanded={showDemoDetails}
          >
            {showDemoDetails ? 'Hide Demo Diagnostics ▲' : 'View Demo Diagnostics ▼'}
          </button>
        </div>

        {showDemoDetails && (
          <div className="failure-page__demo-details-content">
            <FailureSummary
              testName={demoData.testName}
              testFile={demoData.testFile}
              status={demoData.status}
              metrics={demoData.metrics}
              environments={demoData.environments}
            />

            <div className="failure-page__diagnostics-grid">
              <div className="failure-page__column failure-page__column--details">
                <FailureDetails details={demoData.details} />
                <SignalCard signal={demoData.initialSignal} />
              </div>

              <div className="failure-page__column failure-page__column--output">
                <LogPanel lines={demoData.rawLogOutput} />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
