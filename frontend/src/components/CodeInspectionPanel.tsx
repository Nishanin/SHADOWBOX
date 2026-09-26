import React from 'react';
import type { CodeSnippetLine } from '../types/rootCause';
import './CodeInspectionPanel.css';

interface CodeInspectionPanelProps {
  filename: string;
  description: string;
  lines: CodeSnippetLine[];
  highlightedTokens: string[];
}

export const CodeInspectionPanel: React.FC<CodeInspectionPanelProps> = ({
  filename,
  description,
  lines,
  highlightedTokens,
}) => {
  return (
    <section className="code-inspection-panel" aria-labelledby="code-inspection-heading">
      <div className="code-inspection-panel__header">
        <div className="code-inspection-panel__title-left">
          <span className="code-inspection-panel__icon" aria-hidden="true">
            🔍
          </span>
          <div className="code-inspection-panel__file-meta">
            <h2 id="code-inspection-heading" className="code-inspection-panel__title">
              Code Mechanism Inspection
            </h2>
            <code className="code-inspection-panel__filename">{filename}</code>
          </div>
        </div>

        <div className="code-inspection-panel__tokens">
          <span className="code-inspection-panel__tokens-label">Implicated APIs:</span>
          {highlightedTokens.map((token, idx) => (
            <code key={idx} className="code-inspection-panel__token">
              {token}
            </code>
          ))}
        </div>
      </div>

      <div className="code-inspection-panel__info-bar">
        <p className="code-inspection-panel__desc">{description}</p>
      </div>

      <div className="code-inspection-panel__editor">
        <div className="code-inspection-panel__code-block">
          {lines.map((line) => (
            <div
              key={line.lineNumber}
              className={`code-inspection-panel__line code-inspection-panel__line--${line.highlight || 'normal'}`}
            >
              <span className="code-inspection-panel__line-num" aria-hidden="true">
                {line.lineNumber}
              </span>
              <pre className="code-inspection-panel__line-content">
                <code>{line.content}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
