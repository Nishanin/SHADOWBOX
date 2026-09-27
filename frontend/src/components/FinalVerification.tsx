import React from 'react';
import { Link } from 'react-router-dom';
import type { FinalVerificationData } from '../types/verification';
import { StatusBadge } from './StatusBadge';
import './FinalVerification.css';

interface FinalVerificationProps {
  data: FinalVerificationData;
}

const STEP_PATHS: Record<string, string> = {
  Failure: '/',
  Investigation: '/investigation',
  'Root Cause': '/root-cause',
  Shadowbox: '/shadowbox',
  Verification: '/verification',
};

export const FinalVerification: React.FC<FinalVerificationProps> = ({ data }) => {
  return (
    <section className="final-verification" aria-labelledby="final-verif-heading">
      <div className="final-verification__header">
        <div className="final-verification__status-group">
          <StatusBadge status={data.status} variant="pass" size="lg" />
          <h2 id="final-verif-heading" className="final-verification__title">
            Workflow Complete: Issue Resolved
          </h2>
        </div>
        <span className="final-verification__stamp">Final Stage Passed</span>
      </div>

      <div className="final-verification__body">
        <p className="final-verification__summary">{data.summary}</p>

        <div className="final-verification__pipeline-block">
          <span className="final-verification__pipeline-eyebrow">
            Complete Investigation & Verification Pipeline:
          </span>

          <ol className="final-verification__steps-list" aria-label="Completed workflow stages">
            {data.workflowSteps.map((step) => {
              const path = STEP_PATHS[step.name] || '/';
              return (
                <li key={step.stepNumber} className="final-verification__step-item">
                  <Link to={path} className="final-verification__step-link">
                    <span className="final-verification__check" aria-hidden="true">
                      ✓
                    </span>
                    <span className="final-verification__step-copy">
                      <span className="final-verification__step-label">{step.name}</span>
                      <span className="final-verification__step-state">Verified (Passed)</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="final-verification__actions">
          <Link to="/" className="final-verification__reset-btn">
            ↺ Review Failure from Step 1
          </Link>
        </div>
      </div>
    </section>
  );
};
