import React from 'react';
import type { ReproductionEnvSpec } from '../types/shadowbox';
import './ReproductionEnvironment.css';

interface ReproductionEnvironmentProps {
  env: ReproductionEnvSpec;
}

export const ReproductionEnvironment: React.FC<ReproductionEnvironmentProps> = ({ env }) => {
  return (
    <section className="repro-env" aria-labelledby="repro-env-heading">
      <div className="repro-env__header">
        <div className="repro-env__title-group">
          <span className="repro-env__icon" aria-hidden="true">
            📦
          </span>
          <h2 id="repro-env-heading" className="repro-env__title">
            Reproduction Environment
          </h2>
        </div>
        <span className="repro-env__label-badge">{env.label}</span>
      </div>

      <div className="repro-env__grid">
        <div className="repro-env__item">
          <span className="repro-env__prop-label">Base Image</span>
          <code className="repro-env__prop-val">{env.baseImage}</code>
        </div>

        <div className="repro-env__item">
          <span className="repro-env__prop-label">Node Runtime</span>
          <code className="repro-env__prop-val">{env.nodeVersion}</code>
        </div>

        <div className="repro-env__item">
          <span className="repro-env__prop-label">Operating Environment</span>
          <code className="repro-env__prop-val">{env.operatingEnvironment}</code>
        </div>

        <div className="repro-env__item">
          <span className="repro-env__prop-label">Timezone</span>
          <code className="repro-env__prop-val repro-env__prop-val--highlight">
            {env.timezone}
          </code>
        </div>

        <div className="repro-env__item">
          <span className="repro-env__prop-label">Environment Variable</span>
          <code className="repro-env__prop-val repro-env__prop-val--highlight">
            {env.envVariable}
          </code>
        </div>

        <div className="repro-env__item">
          <span className="repro-env__prop-label">Working Directory</span>
          <code className="repro-env__prop-val">{env.workingDir}</code>
        </div>
      </div>
    </section>
  );
};
