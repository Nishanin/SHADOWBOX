import React from 'react';
import type { FailureMatchComparison } from '../types/shadowbox';
import { StatusBadge } from './StatusBadge';
import './FailureMatch.css';

interface FailureMatchProps {
  match: FailureMatchComparison;
}

export const FailureMatch: React.FC<FailureMatchProps> = ({ match }) => {
  return (
    <section className="failure-match" aria-labelledby="failure-match-heading">
      <div className="failure-match__header">
        <div className="failure-match__title-group">
          <span className="failure-match__icon" aria-hidden="true">
            🎯
          </span>
          <h2 id="failure-match-heading" className="failure-match__title">
            {match.title}
          </h2>
        </div>
        <StatusBadge status={match.status} variant="pass" size="md" />
      </div>

      <div className="failure-match__body">
        <div className="failure-match__comparison-grid">
          {/* Original Failure */}
          <div className="failure-match__col">
            <div className="failure-match__col-header">
              <span className="failure-match__col-label">Original Failure</span>
              <span className="failure-match__env-badge">{match.original.environment}</span>
            </div>
            <div className="failure-match__col-body">
              <div className="failure-match__prop">
                <span className="failure-match__prop-name">Expected</span>
                <code className="failure-match__prop-val failure-match__prop-val--expected">
                  {match.original.expected}
                </code>
              </div>
              <div className="failure-match__prop">
                <span className="failure-match__prop-name">Actual</span>
                <code className="failure-match__prop-val failure-match__prop-val--actual">
                  {match.original.actual}
                </code>
              </div>
            </div>
          </div>

          <div className="failure-match__arrow-col" aria-hidden="true">
            <span className="failure-match__arrow">≡</span>
          </div>

          {/* Reproduction */}
          <div className="failure-match__col failure-match__col--repro">
            <div className="failure-match__col-header">
              <span className="failure-match__col-label">Reproduction Run</span>
              <span className="failure-match__env-badge failure-match__env-badge--repro">
                {match.reproduction.environment}
              </span>
            </div>
            <div className="failure-match__col-body">
              <div className="failure-match__prop">
                <span className="failure-match__prop-name">Expected</span>
                <code className="failure-match__prop-val failure-match__prop-val--expected">
                  {match.reproduction.expected}
                </code>
              </div>
              <div className="failure-match__prop">
                <span className="failure-match__prop-name">Actual</span>
                <code className="failure-match__prop-val failure-match__prop-val--actual">
                  {match.reproduction.actual}
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="failure-match__outcome-bar">
          <div className="failure-match__summary-row">
            <span className="failure-match__check-icon" aria-hidden="true">✓</span>
            <span className="failure-match__summary-text">{match.matchSummary}</span>
          </div>
          <p className="failure-match__epistemic-note">{match.epistemicNote}</p>
        </div>
      </div>
    </section>
  );
};
