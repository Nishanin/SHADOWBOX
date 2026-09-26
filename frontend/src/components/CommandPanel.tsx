import React, { useState } from 'react';
import type { ReproductionCommandSpec } from '../types/shadowbox';
import './CommandPanel.css';

interface CommandPanelProps {
  command: ReproductionCommandSpec;
}

export const CommandPanel: React.FC<CommandPanelProps> = ({ command }) => {
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

        <button
          type="button"
          onClick={handleCopy}
          className="command-panel__copy-btn"
          aria-label="Copy full command invocation to clipboard"
        >
          {copied ? 'Copied' : 'Copy Command'}
        </button>
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
