import React from 'react';
import type { Finding } from '../types/investigation';
import { StatusBadge } from './StatusBadge';
import './FindingPanel.css';

interface FindingPanelProps {
  finding: Finding;
}

export const FindingPanel: React.FC<FindingPanelProps> = ({ finding }) => {
  return (
    <div className="finding-panel">
      <div className="finding-panel__header">
        <span className="finding-panel__eyebrow">{finding.type?.replaceAll('_', ' ') || 'Finding'}</span>
        <div className="finding-panel__impact-wrap">
          <span className="finding-panel__impact-label">Impact:</span>
          <StatusBadge status={finding.impact} size="sm" />
        </div>
      </div>
      <h3 className="finding-panel__title">{finding.title}</h3>
      <p className="finding-panel__description">{finding.description}</p>
    </div>
  );
};
