import React from 'react';
import type { InitialSignalData } from '../types/failure';
import { StatusBadge } from './StatusBadge';
import './SignalCard.css';

interface SignalCardProps {
  signal: InitialSignalData;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  return (
    <section className="signal-card" aria-labelledby="signal-card-heading">
      <div className="signal-card__header">
        <div className="signal-card__title-area">
          <span className="signal-card__icon" aria-hidden="true">⚡</span>
          <h2 id="signal-card-heading" className="signal-card__title">
            {signal.title}
          </h2>
        </div>
        <StatusBadge status={signal.statusTag} variant="unconfirmed" size="sm" />
      </div>

      <div className="signal-card__body">
        <p className="signal-card__text">{signal.description}</p>
        {signal.advisoryNote && (
          <div className="signal-card__advisory">
            <span className="signal-card__advisory-icon" aria-hidden="true">⚠️</span>
            <span className="signal-card__advisory-text">
              <strong>Notice:</strong> {signal.advisoryNote}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
