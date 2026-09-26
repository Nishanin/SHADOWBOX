import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { FailurePage } from '../pages/FailurePage';
import { InvestigationPage } from '../pages/InvestigationPage';
import { RootCausePage } from '../pages/RootCausePage';
import { ShadowboxPage } from '../pages/ShadowboxPage';
import { VerificationPage } from '../pages/VerificationPage';

/**
 * Application router.
 *
 * All routes are nested under AppLayout so every page shares
 * the SHADOWBOX header and workflow navigation bar.
 *
 * Routes:
 *   /               → Failure       (Step 1)
 *   /investigation  → Investigation (Step 2)
 *   /root-cause     → Root Cause    (Step 3)
 *   /shadowbox      → Shadowbox     (Step 4)
 *   /verification   → Verification  (Step 5)
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,              element: <FailurePage /> },
      { path: 'investigation',    element: <InvestigationPage /> },
      { path: 'root-cause',       element: <RootCausePage /> },
      { path: 'shadowbox',        element: <ShadowboxPage /> },
      { path: 'verification',     element: <VerificationPage /> },
    ],
  },
]);
