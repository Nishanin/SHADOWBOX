import React from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import type { WorkflowOutletContext } from '../types/workflow';
import { ROOT_CAUSE_DATA } from '../data/rootCauseData';
import { StatusBadge } from '../components/StatusBadge';
import { RootCauseDiagnosis } from '../components/RootCauseDiagnosis';
import { EvidenceMatrix } from '../components/EvidenceMatrix';
import { CodeInspectionPanel } from '../components/CodeInspectionPanel';
import { MechanismTrace } from '../components/MechanismTrace';
import './RootCausePage.css';

/**
 * RootCausePage — Step 3 of the SHADOWBOX workflow.
 *
 * Consolidates the three-stream evidence matrix (Environment, Code, CI)
 * into a definitive diagnosis and mechanism trace, with a CTA to reproduce
 * the failure in Shadowbox.
 */
export const RootCausePage: React.FC = () => {
  const { session } = useOutletContext<WorkflowOutletContext>();
  const data = session?.isDemo ? ROOT_CAUSE_DATA : session?.rootCauseData;

  if (!data) {
    return (
      <div className="root-cause-page">
        <header className="root-cause-page__header">
          <h1 className="root-cause-page__title">Root Cause</h1>
          <p className="root-cause-page__subtitle">
            Complete the static investigation before reviewing a synthesized diagnosis.
          </p>
          <Link to="/investigation">Back to Investigation</Link>
        </header>
      </div>
    );
  }

  return (
    <div className="root-cause-page">
      {/* 1. PAGE HEADER */}
      <header className="root-cause-page__header">
        <div className="root-cause-page__header-top">
          <div className="root-cause-page__title-group">
            <h1 className="root-cause-page__title">{data.pageTitle}</h1>
            <StatusBadge status={data.status} variant="pass" size="md" />
          </div>

          <div className="root-cause-page__target-badge" aria-label="Diagnosed failure target">
            <span className="root-cause-page__target-label">Failure Target:</span>
            <code className="root-cause-page__target-name">{data.failureTarget}</code>
          </div>
        </div>

        <p className="root-cause-page__subtitle">{data.pageSubtitle}</p>
      </header>

      {/* 2. PRIMARY DIAGNOSED DEFECT */}
      <RootCauseDiagnosis
        status={data.status}
        confidenceRating={data.confidenceRating}
        confidenceNote={data.confidenceNote}
        title={data.primaryDiagnosis.title}
        description={data.primaryDiagnosis.description}
        category={data.primaryDiagnosis.category}
        affectedComponent={data.primaryDiagnosis.affectedComponent}
        impactSummary={data.primaryDiagnosis.impactSummary}
      />

      {/* 3. THREE-STREAM EVIDENCE MATRIX */}
      <EvidenceMatrix streams={data.evidenceStreams} />

      {data.missingEvidence && data.missingEvidence.length > 0 && (
        <section aria-label="Missing synthesis evidence">
          <h2>Missing Evidence</h2>
          <ul>
            {data.missingEvidence.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 4. CODE INSPECTION & MECHANISM TRACE */}
      <div className="root-cause-page__deep-dive-grid">
        <CodeInspectionPanel
          filename={data.codeInspection.filename}
          description={data.codeInspection.description}
          lines={data.codeInspection.lines}
          highlightedTokens={data.codeInspection.highlightedTokens}
        />

        <MechanismTrace
          timestamp={data.mechanismTrace.timestamp}
          steps={data.mechanismTrace.steps}
        />
      </div>

      {/* 5. RECOMMENDATION & PRIMARY ACTION */}
      <section className="root-cause-page__action-bar" aria-label="Workflow progression">
        <div className="root-cause-page__action-info">
          <div className="root-cause-page__rec-badge">
            <span>Next Action: Isolated Reproduction</span>
          </div>
          <span className="root-cause-page__action-title">{data.recommendation.title}</span>
          <span className="root-cause-page__action-desc">
            {data.recommendation.description}
          </span>
          <div className="root-cause-page__rec-env">
            <span className="root-cause-page__rec-env-label">Target Runtime:</span>
            <code>{data.recommendation.targetEnvironment}</code>
          </div>
        </div>

        <div className="root-cause-page__buttons">
          <Link to={data.backPath} className="root-cause-page__back-btn">
            ← Back to Investigation
          </Link>

          <Link
            to={data.ctaPath}
            className="root-cause-page__cta-btn"
            id="reproduce-shadowbox-btn"
          >
            <span>{data.ctaText}</span>
            <span className="root-cause-page__cta-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
};
