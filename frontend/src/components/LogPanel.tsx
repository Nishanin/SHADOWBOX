import React, { useState } from 'react';
import './LogPanel.css';

interface LogPanelProps {
  title?: string;
  lines: string[];
}

export const LogPanel: React.FC<LogPanelProps> = ({
  title = 'Test Output',
  lines,
}) => {
  const [copied, setCopied] = useState(false);

  const fullText = lines.join('\n');

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const renderColoredLine = (line: string, index: number) => {
    if (line.startsWith('FAIL')) {
      const parts = line.split('FAIL');
      return (
        <span key={index} className="log-panel__line">
          <span className="log-panel__fail-badge">FAIL</span>
          <span className="log-panel__file-path">{parts[1]}</span>
        </span>
      );
    }
    if (line.includes('✕')) {
      return (
        <span key={index} className="log-panel__line log-panel__line--error">
          <span className="log-panel__cross">✕</span>
          <span>{line.replace('✕', '')}</span>
        </span>
      );
    }
    if (line.includes('Expected:')) {
      return (
        <span key={index} className="log-panel__line log-panel__line--expected">
          {line}
        </span>
      );
    }
    if (line.includes('Received:')) {
      return (
        <span key={index} className="log-panel__line log-panel__line--received">
          {line}
        </span>
      );
    }
    if (line.includes('failed') && line.includes('passed')) {
      return (
        <span key={index} className="log-panel__line log-panel__line--summary">
          {line}
        </span>
      );
    }
    return (
      <span key={index} className="log-panel__line">
        {line || '\u00A0'}
      </span>
    );
  };

  return (
    <section className="log-panel" aria-labelledby="log-panel-heading">
      <div className="log-panel__header">
        <div className="log-panel__header-left">
          <div className="log-panel__dots" aria-hidden="true">
            <span className="log-panel__dot log-panel__dot--red" />
            <span className="log-panel__dot log-panel__dot--yellow" />
            <span className="log-panel__dot log-panel__dot--green" />
          </div>
          <h2 id="log-panel-heading" className="log-panel__title">
            {title}
          </h2>
          <span className="log-panel__runner-badge">CI Runner stdout</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="log-panel__copy-btn"
          aria-label="Copy test output to clipboard"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="log-panel__terminal">
        <pre className="log-panel__pre" tabIndex={0} aria-label="Terminal test output log">
          <code>
            {lines.map((line, idx) => (
              <React.Fragment key={idx}>
                {renderColoredLine(line, idx)}
                {'\n'}
              </React.Fragment>
            ))}
          </code>
        </pre>
      </div>
    </section>
  );
};
