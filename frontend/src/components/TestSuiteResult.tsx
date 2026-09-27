import React from 'react';
import type { TestSuiteResultData } from '../types/verification';
import { StatusBadge } from './StatusBadge';
import './TestSuiteResult.css';

interface TestSuiteResultProps {
  data: TestSuiteResultData;
}

export const TestSuiteResult: React.FC<TestSuiteResultProps> = ({ data }) => {
  return (
    <section className="test-suite-result" aria-labelledby="suite-heading">
      <div className="test-suite-result__header">
        <div className="test-suite-result__title-group">
          <span className="test-suite-result__icon" aria-hidden="true">
            🧪
          </span>
          <h2 id="suite-heading" className="test-suite-result__title">
            {data.title}
          </h2>
        </div>
        <StatusBadge status={data.status} variant="pass" size="sm" />
      </div>

      <div className="test-suite-result__body">
        <div className="test-suite-result__command-row">
          <span className="test-suite-result__cmd-label">Test Command:</span>
          <code className="test-suite-result__cmd">{data.command}</code>
        </div>

        <div className="test-suite-result__counts-bar">
          <div className="test-suite-result__count-item">
            <span className="test-suite-result__count-label">Total Tests</span>
            <span className="test-suite-result__count-val">{data.total}</span>
          </div>

          <div className="test-suite-result__count-item test-suite-result__count-item--pass">
            <span className="test-suite-result__count-label">Passed</span>
            <span className="test-suite-result__count-val">{data.passed}</span>
          </div>

          <div className="test-suite-result__count-item">
            <span className="test-suite-result__count-label">Failed</span>
            <span className="test-suite-result__count-val">{data.failed}</span>
          </div>
        </div>

        <p className="test-suite-result__explanation">{data.explanation}</p>
      </div>
    </section>
  );
};
