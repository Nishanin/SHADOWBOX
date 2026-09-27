import React, { useState } from 'react';
import type { ReproductionCommandSpec } from '../types/shadowbox';
import './CommandPanel.css';

interface CommandPanelProps {
  command: ReproductionCommandSpec;
  onRun?: () => void;
  isLoading?: boolean;
}

export const CommandPanel: React.FC<CommandPanelProps> = ({
  command,
  onRun,
  isLoading = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(command.fullInvocation).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <section className="command-panel" aria-labelledby="command-panel-heading">
      <div className="command-panel__header">
        <div className="command-panel__title-group">
          <span className="command-panel__icon" aria-hidden="true">
            ⌨️
          </span>
          <h2 id="command-panel-heading" className="command-panel__title">
            Command
          </h2>
        </div>

        <div className="command-panel__header-actions">
          {onRun && (
            <button
              type="button"
              onClick={onRun}
              disabled={isLoading}
              className="command-panel__run-btn"
              id="run-reproduction-btn"
              aria-label="Execute reproduction in Shadowbox"
            >
              {isLoading ? (
                <>
                  <span className="command-panel__spinner" aria-hidden="true" />
                  <span>Running in Shadowbox...</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">▶</span>
                  <span>Run in Shadowbox</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="command-panel__copy-btn"
            aria-label="Copy full command invocation to clipboard"
          >
            {copied ? 'Copied' : 'Copy Command'}
          </button>
        </div>
      </div>

      <div className="command-panel__body">
        <div className="command-panel__entry">
          <span className="command-panel__entry-label">Execution Command:</span>
          <div className="command-panel__terminal-row">
            <span className="command-panel__prompt" aria-hidden="true">
              $
            </span>
            <code className="command-panel__code">{command.command}</code>
          </div>
        </div>

        <div className="command-panel__entry">
          <span className="command-panel__entry-label">Full Environment Invocation:</span>
          <div className="command-panel__terminal-row command-panel__terminal-row--full">
            <span className="command-panel__prompt" aria-hidden="true">
              $
            </span>
            <code className="command-panel__code">{command.fullInvocation}</code>
          </div>
        </div>
      </div>
    </section>
  );
};
