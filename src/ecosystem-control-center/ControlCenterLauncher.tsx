// VENDORED from @ecosystem/control-center — do not edit here.
import { ecosystemHealth } from './model';
import type { ControlCenterLauncherProps } from './types';

export function ControlCenterLauncher({
  status,
  label = 'Open ecosystem control center',
  onClick,
}: ControlCenterLauncherProps) {
  const health = ecosystemHealth(status);
  return (
    <button
      type="button"
      className="eco-cc-launcher"
      aria-label={label}
      title={`${health.label} · Ctrl+E`}
      onClick={onClick}
    >
      <span className="eco-cc-launcher__mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span
        className={`eco-cc-launcher__status eco-cc-tone-${health.tone}`}
        aria-hidden="true"
      />
      <span className="eco-cc-sr-only">{health.label}</span>
    </button>
  );
}
