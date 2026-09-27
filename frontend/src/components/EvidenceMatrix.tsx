import React from 'react';
import type { EvidenceStreamItem } from '../types/rootCause';
import './EvidenceMatrix.css';

interface EvidenceMatrixProps {
  streams: EvidenceStreamItem[];
}

export const EvidenceMatrix: React.FC<EvidenceMatrixProps> = ({ streams }) => {
  return (
    <section className="evidence-matrix" aria-labelledby="matrix-heading">
      <div className="evidence-matrix__header">
        <div className="evidence-matrix__title-group">
          <span className="evidence-matrix__icon" aria-hidden="true">
            📊
          </span>
          <h2 id="matrix-heading" className="evidence-matrix__title">
            Three-Stream Evidence Matrix
          </h2>
        </div>
        <span className="evidence-matrix__badge">Correlated Triangulation</span>
      </div>

      <div className="evidence-matrix__grid">
        {streams.map((stream) => (
          <div key={stream.id} className="evidence-matrix__card">
            <div className="evidence-matrix__card-header">
              <div className="evidence-matrix__dimension">
                <span className="evidence-matrix__dim-icon" aria-hidden="true">
                  {stream.icon}
                </span>
                <span className="evidence-matrix__dim-name">{stream.dimension} Stream</span>
              </div>
              <span className="evidence-matrix__weight-tag">{stream.weight}</span>
            </div>

            <div className="evidence-matrix__card-body">
              <div className="evidence-matrix__source-line">
                <span className="evidence-matrix__field-label">Source:</span>
                <span className="evidence-matrix__source-val">{stream.source}</span>
              </div>

              <div className="evidence-matrix__finding-block">
                <span className="evidence-matrix__field-label">Synthesized Finding:</span>
                <p className="evidence-matrix__finding-text">{stream.finding}</p>
              </div>

              <div className="evidence-matrix__details-block">
                <span className="evidence-matrix__field-label">Key Evidentiary Points:</span>
                <ul className="evidence-matrix__points">
                  {stream.keyDetails.map((detail, idx) => (
                    <li key={idx} className="evidence-matrix__point">
                      <code>{detail}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
