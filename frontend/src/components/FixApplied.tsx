import React from 'react';
import type { FixAppliedData } from '../types/verification';
import './FixApplied.css';

interface FixAppliedProps {
  data: FixAppliedData;
}

export const FixApplied: React.FC<FixAppliedProps> = ({ data }) => {
  return (
    <section className="fix-applied" aria-labelledby="fix-applied-heading">
      <div className="fix-applied__header">
        <div className="fix-applied__title-group">
          <span className="fix-applied__icon" aria-hidden="true">
            🛠️
          </span>
          <h2 id="fix-applied-heading" className="fix-applied__title">
            {data.title}
          </h2>
        </div>
        <div className="fix-applied__file-badge">
          <span className="fix-applied__file-label">Affected File:</span>
          <code>{data.affectedFile}</code>
        </div>
      </div>

      <div className="fix-applied__body">
        <p className="fix-applied__desc">{data.description}</p>

        <div className="fix-applied__comparison">
          <div className="fix-applied__diff-col fix-applied__diff-col--before">
            <div className="fix-applied__col-head">
              <span className="fix-applied__col-tag">Before (Local-Time Accessors)</span>
            </div>
            <ul className="fix-applied__methods-list">
              {data.beforeMethods.map((m, i) => (
                <li key={i}>
                  <code className="fix-applied__method fix-applied__method--before">{m}</code>
                </li>
              ))}
            </ul>
            <div className="fix-applied__snippet">
              <pre>
                <code>{data.codeDiff.beforeLines.join('\n')}</code>
              </pre>
            </div>
          </div>

          <div className="fix-applied__diff-arrow" aria-hidden="true">
            →
          </div>

          <div className="fix-applied__diff-col fix-applied__diff-col--after">
            <div className="fix-applied__col-head">
              <span className="fix-applied__col-tag fix-applied__col-tag--after">
                After (UTC-Based Accessors)
              </span>
            </div>
            <ul className="fix-applied__methods-list">
              {data.afterMethods.map((m, i) => (
                <li key={i}>
                  <code className="fix-applied__method fix-applied__method--after">{m}</code>
                </li>
              ))}
            </ul>
            <div className="fix-applied__snippet fix-applied__snippet--after">
              <pre>
                <code>{data.codeDiff.afterLines.join('\n')}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="fix-applied__notice">
          <span className="fix-applied__notice-icon" aria-hidden="true">
            ℹ️
          </span>
          <span>
            <strong>Project Workflow Notice:</strong> This panel illustrates the verified fix
            implemented in the application repository. The frontend presents validated verification
            artifacts without directly manipulating codebase files.
          </span>
        </div>
      </div>
    </section>
  );
};
