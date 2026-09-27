import React from 'react';
import './StatusBadge.css';

export type StatusBadgeVariant =
  | 'failed'
  | 'fail'
  | 'pass'
  | 'unconfirmed'
  | 'neutral'
  | 'investigating'
  | 'complete'
  | 'high'
  | 'medium';

interface StatusBadgeProps {
  status: string;
  variant?: StatusBadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

function resolveVariant(status: string, explicitVariant?: StatusBadgeVariant): StatusBadgeVariant {
  if (explicitVariant) return explicitVariant;
  const upper = status.trim().toUpperCase();
  if (upper === 'FAIL' || upper === 'FAILED' || upper === 'FAILURE REPRODUCED') return 'fail';
  if (upper === 'PASS' || upper === 'PASSED' || upper === 'MATCHED' || upper === 'VERIFIED') return 'pass';
  if (upper === 'COMPLETE') return 'complete';
  if (upper === 'INVESTIGATING' || upper === 'REPRODUCTION') return 'investigating';
  if (upper === 'HIGH') return 'high';
  if (upper === 'MEDIUM') return 'medium';
  if (upper === 'UNCONFIRMED' || upper === 'PRELIMINARY') return 'unconfirmed';
  return 'neutral';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  size = 'md',
  showDot = true,
  className = '',
}) => {
  const activeVariant = resolveVariant(status, variant);

  return (
    <span
      className={`status-badge status-badge--${activeVariant} status-badge--${size} ${className}`}
    >
      {showDot && <span className="status-badge__dot" aria-hidden="true" />}
      <span className="status-badge__text">{status}</span>
    </span>
  );
};
