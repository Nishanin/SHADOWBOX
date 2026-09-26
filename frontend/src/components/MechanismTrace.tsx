import React from 'react';
import type { MechanismStep } from '../types/rootCause';
import './MechanismTrace.css';

interface MechanismTraceProps {
  timestamp: string;
  steps: MechanismStep[];
}

export const MechanismTrace: React.FC<MechanismTraceProps> = ({ timestamp, steps }) => {
  return (
    <section className="mechanism-trace" aria-labelledby="mechanism-heading">
      <div className="mechanism-trace__header">
        <div className="mechanism-trace__title-group">
          <span className="mechanism-trace__icon" aria-hidden="true">
            ⏱️
          </span>
          <h2 id="mechanism-heading" className="mechanism-trace__title">
            Comparative Mechanism Trace
          </h2>
        </div>
        <div className="mechanism-trace__timestamp-badge">
          <span className="mechanism-trace__ts-label">Reference Timestamp:</span>
          <code>{timestamp}</code>
        </div>
      </div>

      <div className="mechanism-trace__table-wrap">
        <table className="mechanism-trace__table">
          <thead>
            <tr>
              <th scope="col" className="mechanism-trace__col-step">#</th>
              <th scope="col" className="mechanism-trace__col-label">Evaluation Phase</th>
              <th scope="col" className="mechanism-trace__col-local">Local Host (Passing)</th>
              <th scope="col" className="mechanism-trace__col-ci">CI Environment (Failing)</th>
              <th scope="col" className="mechanism-trace__col-note">Causal Note</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.stepNumber} className="mechanism-trace__row">
                <td className="mechanism-trace__cell-step">
                  <span className="mechanism-trace__step-circle">{step.stepNumber}</span>
                </td>
                <th scope="row" className="mechanism-trace__cell-label">
                  <strong>{step.label}</strong>
                </th>
                <td className="mechanism-trace__cell-local">
                  <code>{step.localState}</code>
                </td>
                <td className="mechanism-trace__cell-ci">
                  <code>{step.ciState}</code>
                </td>
                <td className="mechanism-trace__cell-note">{step.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
