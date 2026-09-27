import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { WORKFLOW_STEPS } from '../data/workflowSteps';
import type { ShadowboxRunResult } from '../types/shadowboxApi';
import type { WorkflowOutletContext } from '../types/workflow';
import './AppLayout.css';

/**
 * AppLayout — persistent shell wrapping all pages.
 *
 * Renders:
 *  - A top header with SHADOWBOX branding
 *  - A workflow step navigation bar
 *  - An <Outlet /> for the active page
 */
export function AppLayout() {
  const location = useLocation();
  const [reproductionResult, setReproductionResult] = useState<ShadowboxRunResult | null>(null);
  const [verificationResult, setVerificationResult] = useState<ShadowboxRunResult | null>(null);

  const activeStepIndex = WORKFLOW_STEPS.findIndex((step) =>
    step.path === '/' ? location.pathname === '/' : location.pathname.startsWith(step.path),
  );

  const outletContext: WorkflowOutletContext = {
    reproductionResult,
    setReproductionResult,
    verificationResult,
    setVerificationResult,
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__identity">
            <span className="app-header__mark" aria-hidden="true">SB</span>
            <span className="app-header__brand">SHADOWBOX</span>
            <span className="app-header__divider" aria-hidden="true" />
            <span className="app-header__tagline">Environment Failure Investigation</span>
          </div>
          <span className="app-header__status">
            <span className="app-header__status-dot" aria-hidden="true" />
            Workflow active
          </span>
        </div>
      </header>

      <nav className="workflow-nav" aria-label="Workflow steps">
        <div className="workflow-nav__inner">
          <div className="workflow-nav__eyebrow">Investigation workflow</div>
          <ol className="workflow-nav__list">
            {WORKFLOW_STEPS.map((step, index) => (
              <li
                key={step.id}
                className={`workflow-nav__item${
                  index < activeStepIndex ? ' complete' : index === activeStepIndex ? ' current' : ' upcoming'
                }`}
              >
                <NavLink
                  to={step.path}
                  end={step.path === '/'}
                  className="workflow-nav__link"
                  title={step.description}
                  aria-current={index === activeStepIndex ? 'step' : undefined}
                >
                  <span className="workflow-nav__step-num" aria-hidden="true">
                    {index < activeStepIndex ? '✓' : index + 1}
                  </span>
                  <span className="workflow-nav__step-copy">
                    <span className="workflow-nav__step-label">{step.label}</span>
                    <span className="workflow-nav__step-state">
                      {index < activeStepIndex ? 'Complete' : index === activeStepIndex ? 'Current step' : 'Upcoming'}
                    </span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <main className="app-main">
        <Outlet context={outletContext} />
      </main>
    </div>
  );
}
