import React from 'react';
import { VERIFICATION_DATA } from '../data/verificationData';
import { StatusBadge } from '../components/StatusBadge';
import { VerificationSummary } from '../components/VerificationSummary';
import { FixApplied } from '../components/FixApplied';
import { RegressionResult } from '../components/RegressionResult';
import { TestSuiteResult } from '../components/TestSuiteResult';
import { ShadowboxVerification } from '../components/ShadowboxVerification';
import { BeforeAfterComparison } from '../components/BeforeAfterComparison';
import { VerificationEvidence } from '../components/VerificationEvidence';
import { VerificationBoundary } from '../components/VerificationBoundary';
import { FinalVerification } from '../components/FinalVerification';
import './VerificationPage.css';

/**
 * VerificationPage — Final Step 5 of the SHADOWBOX workflow.
 *
 * Validates the fix across regression coverage, the complete test suite,
 * and the controlled Shadowbox reproduction environment, demonstrating
 * that the failure has been eliminated without regressions.
 */
export const VerificationPage: React.FC = () => {
  const data = VERIFICATION_DATA;

  return (
    <div className="verification-page">
      {/* 1. PAGE HEADER */}
      <header className="verification-page__header">
        <div className="verification-page__header-top">
          <div className="verification-page__title-group">
            <h1 className="verification-page__title">{data.pageTitle}</h1>
            <StatusBadge status={data.statusBadge} variant="pass" size="md" />
          </div>

          <div className="verification-page__target-badge" aria-label="Validated scenario">
            <span className="verification-page__target-label">Scenario:</span>
            <code className="verification-page__target-name">{data.scenario}</code>
          </div>
        </div>

        <p className="verification-page__subtitle">{data.pageSubtitle}</p>
      </header>

      {/* 2. VERIFICATION SUMMARY (3 LAYERS) */}
      <VerificationSummary
        status={data.statusBadge}
        summaryText={data.summaryText}
        layers={data.layers}
      />

      {/* 3. FIX APPLIED */}
      <FixApplied data={data.fixApplied} />

      {/* 4 & 5. REGRESSION TEST & EXISTING TEST SUITE */}
      <div className="verification-page__tests-grid">
        <RegressionResult data={data.regression} />
        <TestSuiteResult data={data.testSuite} />
      </div>

      {/* 6. SHADOWBOX VERIFICATION */}
      <ShadowboxVerification data={data.shadowboxVerification} />

      {/* 7. BEFORE / AFTER COMPARISON */}
      <BeforeAfterComparison data={data.beforeAfter} />

      {/* 8 & 9. VERIFICATION EVIDENCE & BOUNDARY */}
      <div className="verification-page__evidence-grid">
        <VerificationEvidence data={data.evidence} />
        <VerificationBoundary data={data.boundary} />
      </div>

      {/* 10. FINAL RESULT & WORKFLOW COMPLETION */}
      <FinalVerification data={data.finalResult} />
    </div>
  );
};
