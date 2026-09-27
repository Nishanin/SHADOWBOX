import React from 'react';
import type { EnvironmentRun } from '../types/failure';
import { StatusBadge } from './StatusBadge';
import './EnvironmentComparison.css';

interface EnvironmentComparisonProps {
  local: EnvironmentRun;
  ci: EnvironmentRun;
}

export const EnvironmentComparison: React.FC<EnvironmentComparisonProps> = ({ local, ci }) => {
  return (
    <div className="env-comparison" aria-label="Environment Comparison">
      <div className="env-comparison__col env-comparison__col--local">
        <div className="env-comparison__header">
          <div className="env-comparison__target">
            <span className="env-comparison__icon" aria-hidden="true">💻</span>
            <span className="env-comparison__label">{local.name}</span>
          </div>
          <StatusBadge status={local.status} variant="pass" size="sm" />
        </div>
        <div className="env-comparison__body">
          <div className="env-comparison__prop">
            <span className="env-comparison__prop-label">Environment</span>
            <code className="env-comparison__prop-value">{local.environment}</code>
          </div>
          <div className="env-comparison__breakdown">
            <span className="env-comparison__tag">OS: {local.os}</span>
            <span className="env-comparison__tag">Runtime: {local.runtime}</span>
            <span className="env-comparison__tag env-comparison__tag--highlight-pass">TZ: {local.timezone}</span>
          </div>
        </div>
      </div>

      <div className="env-comparison__divider" aria-hidden="true">
        <span className="env-comparison__vs">VS</span>
      </div>

      <div className="env-comparison__col env-comparison__col--ci">
        <div className="env-comparison__header">
          <div className="env-comparison__target">
            <span className="env-comparison__icon" aria-hidden="true">☁️</span>
            <span className="env-comparison__label">{ci.name}</span>
          </div>
          <StatusBadge status={ci.status} variant="fail" size="sm" />
        </div>
        <div className="env-comparison__body">
          <div className="env-comparison__prop">
            <span className="env-comparison__prop-label">Environment</span>
            <code className="env-comparison__prop-value">{ci.environment}</code>
          </div>
          <div className="env-comparison__breakdown">
            <span className="env-comparison__tag">OS: {ci.os}</span>
            <span className="env-comparison__tag">Runtime: {ci.runtime}</span>
            <span className="env-comparison__tag env-comparison__tag--highlight-fail">TZ: {ci.timezone}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
