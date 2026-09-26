import React from 'react';
import type { InvestigationTrack } from '../types/investigation';
import { StatusBadge } from './StatusBadge';
import { FindingPanel } from './FindingPanel';
import { EvidenceList } from './EvidenceList';
import { MissingEvidence } from './MissingEvidence';
import './InvestigationCard.css';

interface InvestigationCardProps {
  track: InvestigationTrack;
}

const AGENT_ICONS: Record<string, string> = {
  environment: '🌐',
  code: '📄',
  ci: '⚙️',
};

export const InvestigationCard: React.FC<InvestigationCardProps> = ({ track }) => {
  const icon = AGENT_ICONS[track.id] || '🔍';

  return (
    <article className={`investigation-card investigation-card--${track.id}`} aria-label={track.label}>
      <div className="investigation-card__header">
        <div className="investigation-card__identity">
          <span className="investigation-card__icon" aria-hidden="true">
            {icon}
          </span>
          <div className="investigation-card__title-meta">
            <h2 className="investigation-card__title">{track.label}</h2>
            <span className="investigation-card__track-badge">Parallel Track</span>
          </div>
        </div>
        <StatusBadge status={track.status} size="sm" />
      </div>

      <div className="investigation-card__focus-bar">
        <span className="investigation-card__focus-label">Focus:</span>
        <span className="investigation-card__focus-text">{track.focus}</span>
      </div>

      <div className="investigation-card__body">
        {/* Findings */}
        {track.findings.map((finding, idx) => (
          <FindingPanel key={idx} finding={finding} />
        ))}

        {/* Evidence */}
        <EvidenceList evidence={track.evidence} />

        {/* Missing Evidence */}
        <MissingEvidence items={track.missingEvidence} />
      </div>

      <div className="investigation-card__footer">
        <span className="investigation-card__run-label">Execution:</span>
        <code className="investigation-card__run-at">{track.runAt}</code>
      </div>
    </article>
  );
};
