import React from 'react';
import type { InvestigationSynthesisData } from '../types/investigation';
import { StatusBadge } from './StatusBadge';
import './InvestigationSynthesis.css';

interface InvestigationSynthesisProps {
  synthesis: InvestigationSynthesisData;
}

export const InvestigationSynthesis: React.FC<InvestigationSynthesisProps> = ({ synthesis }) => {
  return (
    <section className="investigation-synthesis" aria-labelledby="synthesis-heading">
      <div className="investigation-synthesis__header">
        <div className="investigation-synthesis__title-group">
          <span className="investigation-synthesis__icon" aria-hidden="true">
            🧩
          </span>
          <h2 id="synthesis-heading" className="investigation-synthesis__title">
            {synthesis.title}
          </h2>
        </div>
        <StatusBadge status={synthesis.tag} variant="unconfirmed" size="md" />
      </div>

      <div className="investigation-synthesis__body">
        <p className="investigation-synthesis__summary">{synthesis.description}</p>

        <div className="investigation-synthesis__signals-block">
          <span className="investigation-synthesis__signals-eyebrow">Contributing Signals</span>
          <div className="investigation-synthesis__signals-grid">
            {synthesis.contributingSignals.map((signal, idx) => (
              <div key={idx} className="investigation-synthesis__signal-card">
                <span className="investigation-synthesis__signal-dimension">
                  {signal.dimension}
                </span>
                <span className="investigation-synthesis__signal-text">{signal.summary}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="investigation-synthesis__disclaimer">
          <span className="investigation-synthesis__disclaimer-tag">Preliminary Note:</span>
          <span>
            These findings represent correlated evidence across three parallel tracks. They do not
            constitute a finalized root cause diagnosis. Full verification and isolation occur in the
            subsequent workflow phase.
          </span>
        </div>
      </div>
    </section>
  );
};
