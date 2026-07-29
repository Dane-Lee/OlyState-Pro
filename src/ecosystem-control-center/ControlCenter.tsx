// VENDORED from @ecosystem/control-center — do not edit here.
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  APP_META,
  APP_ORDER,
  buildAppPairs,
  ecosystemHealth,
  humanizePayloadType,
  type AppPair,
  type PairFlow,
} from './model';
import type {
  ConnectionChange,
  ConnectionState,
  ControlCenterProps,
  EcosystemAppStatus,
  FlowStatus,
} from './types';

const STATE_OPTIONS: readonly ConnectionState[] = ['on', 'pause', 'off'];

function Icon({
  children,
  size = 18,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function CloseIcon() {
  return (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

function RefreshIcon() {
  return (
    <Icon>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.5-2.6L20 11M4 13l2.4 4.6A7 7 0 0 0 17.9 15" />
    </Icon>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <Icon size={16}>
      <path d={expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </Icon>
  );
}

function ArrowIcon() {
  return (
    <Icon size={14}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </Icon>
  );
}

function formatRelativeTime(value: string | null): string {
  if (!value) return 'Never';
  const difference = Date.now() - Date.parse(value);
  if (!Number.isFinite(difference)) return 'Unknown';
  const minutes = Math.max(0, Math.round(difference / 60_000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function appStatusTone(app: EcosystemAppStatus | undefined): string {
  if (!app?.provisioned) return 'ghost';
  if (app.active) return 'healthy';
  return 'warn';
}

function statusLabel(status: FlowStatus): string {
  if (status === 'flowing') return 'Flowing';
  if (status === 'stale') return 'Stale';
  return 'Silent';
}

function StateControl({
  value,
  disabled,
  pending,
  label,
  onChange,
}: {
  value: ConnectionState | 'mixed';
  disabled: boolean;
  pending?: boolean;
  label: string;
  onChange: (state: ConnectionState) => void;
}) {
  return (
    <div
      className={`eco-cc-state-control${pending ? ' is-pending' : ''}`}
      role="group"
      aria-label={label}
    >
      {STATE_OPTIONS.map((state) => (
        <button
          key={state}
          type="button"
          className={value === state ? 'is-active' : ''}
          disabled={disabled || pending}
          aria-pressed={value === state}
          onClick={(event) => {
            event.stopPropagation();
            onChange(state);
          }}
        >
          {state}
        </button>
      ))}
    </div>
  );
}

function FlowRow({
  flow,
  pending,
  canEdit,
  onChange,
}: {
  flow: PairFlow;
  pending: boolean;
  canEdit: boolean;
  onChange: (flow: PairFlow, state: ConnectionState) => void;
}) {
  const producer = APP_META[flow.producer];
  const consumer = APP_META[flow.consumer];
  return (
    <div className="eco-cc-flow-row">
      <div className="eco-cc-flow-row__main">
        <span className={`eco-cc-flow-dot eco-cc-flow-${flow.status}`} />
        <div>
          <strong>{humanizePayloadType(flow.payloadType)}</strong>
          <span>
            {producer.shortLabel} <ArrowIcon /> {consumer.shortLabel} ·{' '}
            {flow.cadence}
          </span>
        </div>
      </div>
      <div className="eco-cc-flow-row__activity">
        <strong>{flow.count24h}</strong>
        <span>24h</span>
      </div>
      <StateControl
        value={flow.state}
        disabled={!flow.editable || !canEdit}
        pending={pending}
        label={`${humanizePayloadType(flow.payloadType)} connection state`}
        onChange={(state) => onChange(flow, state)}
      />
      <p className="eco-cc-flow-row__note">
        {flow.editable
          ? `${flow.direction === 'outbound' ? 'Published' : 'Consumed'} by this app`
          : `Managed in ${producer.label} or ${consumer.label}`}
        {!flow.settingsReported && ' · default-open'}
      </p>
    </div>
  );
}

function PairCard({
  pair,
  expanded,
  pendingKeys,
  canEdit,
  onToggle,
  onPairState,
  onFlowState,
}: {
  pair: AppPair;
  expanded: boolean;
  pendingKeys: ReadonlySet<string>;
  canEdit: boolean;
  onToggle: () => void;
  onPairState: (state: ConnectionState) => void;
  onFlowState: (flow: PairFlow, state: ConnectionState) => void;
}) {
  const first = APP_META[pair.first];
  const second = APP_META[pair.second];
  const pairPending = pair.flows.some((flow) => pendingKeys.has(flow.key));
  return (
    <article
      className={`eco-cc-pair-card${expanded ? ' is-expanded' : ''}`}
    >
      <div className="eco-cc-pair-card__summary">
        <button
          type="button"
          className="eco-cc-pair-card__toggle"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span className="eco-cc-pair-apps">
            <span className="eco-cc-pair-badge">{first.shortLabel}</span>
            <span className={`eco-cc-edge eco-cc-flow-${pair.status}`}>
              <span />
            </span>
            <span className="eco-cc-pair-badge">{second.shortLabel}</span>
          </span>
          <span className="eco-cc-pair-copy">
            <strong>
              {first.label} ↔ {second.label}
            </strong>
            <small>
              {pair.flows.length}{' '}
              {pair.flows.length === 1 ? 'flow' : 'flows'} · {pair.count24h}{' '}
              envelopes in 24h
            </small>
          </span>
          <span className={`eco-cc-status-label eco-cc-flow-${pair.status}`}>
            {statusLabel(pair.status)}
          </span>
          <span className="eco-cc-chevron">
            <ChevronIcon expanded={expanded} />
          </span>
        </button>
        <StateControl
          value={pair.state}
          disabled={!pair.editable || !canEdit}
          pending={pairPending}
          label={`${first.label} and ${second.label} connection state`}
          onChange={onPairState}
        />
      </div>
      {expanded && (
        <div className="eco-cc-pair-card__flows">
          {pair.flows.map((flow) => (
            <FlowRow
              key={flow.key}
              flow={flow}
              pending={pendingKeys.has(flow.key)}
              canEdit={canEdit}
              onChange={onFlowState}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function ControlCenter({
  hostApp,
  status,
  mode = 'overlay',
  open = true,
  loading = false,
  error = null,
  onClose,
  onRefresh,
  onConnectionChange,
}: ControlCenterProps) {
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const health = ecosystemHealth(status);
  const pairs = useMemo(
    () => (status ? buildAppPairs(status, hostApp) : []),
    [hostApp, status],
  );
  const visiblePairs =
    scope === 'mine'
      ? pairs.filter(
          (pair) => pair.first === hostApp || pair.second === hostApp,
        )
      : pairs;

  useEffect(() => {
    if (!open || mode !== 'overlay') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [mode, onClose, open]);

  if (mode === 'overlay' && !open) return null;

  const changeFlow = async (flow: PairFlow, state: ConnectionState) => {
    if (!flow.editable || !flow.direction || !onConnectionChange) return;
    setPendingKeys((current) => new Set(current).add(flow.key));
    const change: ConnectionChange = {
      direction: flow.direction,
      payloadType: flow.payloadType,
      state,
    };
    try {
      await onConnectionChange(change);
    } finally {
      setPendingKeys((current) => {
        const next = new Set(current);
        next.delete(flow.key);
        return next;
      });
    }
  };

  const changePair = async (pair: AppPair, state: ConnectionState) => {
    const editableFlows = pair.flows.filter(
      (flow) => flow.editable && flow.direction,
    );
    await Promise.all(editableFlows.map((flow) => changeFlow(flow, state)));
  };

  const dismissBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose?.();
  };

  const content = (
    <section
      className={`eco-cc eco-cc--${mode}`}
      data-eco-theme="dark"
      role={mode === 'overlay' ? 'dialog' : undefined}
      aria-modal={mode === 'overlay' ? true : undefined}
      aria-label="Ecosystem Control Center"
    >
      <header className="eco-cc-header">
        <div className="eco-cc-brand">
          <span className="eco-cc-brand__mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <i />
          </span>
          <div>
            <p>Ecosystem</p>
            <h2>Control Center</h2>
          </div>
        </div>

        <div className="eco-cc-header__actions">
          <span
            className={`eco-cc-health-pill eco-cc-tone-${health.tone}`}
          >
            <i />
            {health.label}
          </span>
          {onRefresh && (
            <button
              type="button"
              className="eco-cc-icon-button"
              aria-label="Refresh ecosystem status"
              disabled={loading}
              onClick={() => void onRefresh()}
            >
              <RefreshIcon />
            </button>
          )}
          {mode === 'overlay' && (
            <button
              type="button"
              className="eco-cc-icon-button"
              aria-label="Close Control Center"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="eco-cc-alert" role="alert">
          <strong>Status feed unavailable.</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="eco-cc-layout">
        <section className="eco-cc-map-panel">
          <div className="eco-cc-section-heading">
            <div>
              <p>Live topology</p>
              <h3>Constellation</h3>
            </div>
            <span>
              {status?.apps.filter((app) => app.active).length ?? 0}/
              {status?.apps.length ?? APP_ORDER.length} active
            </span>
          </div>

          <div className="eco-cc-constellation">
            <svg
              className="eco-cc-spokes"
              viewBox="0 0 600 520"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line x1="300" y1="260" x2="300" y2="55" />
              <line x1="300" y1="260" x2="500" y2="145" />
              <line x1="300" y1="260" x2="500" y2="375" />
              <line x1="300" y1="260" x2="300" y2="465" />
              <line x1="300" y1="260" x2="100" y2="375" />
              <line x1="300" y1="260" x2="100" y2="145" />
            </svg>

            {APP_ORDER.map((appId) => {
              const meta = APP_META[appId];
              const app = status?.apps.find((item) => item.app === appId);
              const flowCount =
                status?.flows
                  .filter((flow) => flow.producer === appId)
                  .reduce((sum, flow) => sum + flow.count24h, 0) ?? 0;
              return (
                <div
                  key={appId}
                  className={`eco-cc-node eco-cc-node--${meta.orbit} eco-cc-node--${appStatusTone(app)}${appId === hostApp ? ' is-host' : ''}`}
                >
                  <span className="eco-cc-node__badge">
                    {meta.shortLabel}
                    <i />
                  </span>
                  <strong>{meta.label}</strong>
                  <small>{meta.role}</small>
                  <span className="eco-cc-node__meta">
                    {flowCount > 0
                      ? `${flowCount} envelopes · 24h`
                      : app?.provisioned
                        ? `Seen ${formatRelativeTime(app.lastSeenAt)}`
                        : 'Not provisioned'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="eco-cc-map-summary">
            <div>
              <span className="eco-cc-flow-dot eco-cc-flow-flowing" />
              <strong>{health.flowing}</strong>
              <small>Flowing</small>
            </div>
            <div>
              <span className="eco-cc-flow-dot eco-cc-flow-stale" />
              <strong>{health.stale}</strong>
              <small>Stale</small>
            </div>
            <div>
              <span className="eco-cc-flow-dot eco-cc-flow-silent" />
              <strong>{health.silent}</strong>
              <small>Silent</small>
            </div>
            <p>
              Updated{' '}
              {loading
                ? 'now'
                : formatRelativeTime(status?.generatedAt ?? null)}
            </p>
          </div>
        </section>

        <section className="eco-cc-connections-panel">
          <div className="eco-cc-connections-header">
            <div className="eco-cc-section-heading">
              <div>
                <p>Routing policy</p>
                <h3>Connections</h3>
              </div>
            </div>
            <div className="eco-cc-scope-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'mine'}
                className={scope === 'mine' ? 'is-active' : ''}
                onClick={() => setScope('mine')}
              >
                This app
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'all'}
                className={scope === 'all' ? 'is-active' : ''}
                onClick={() => setScope('all')}
              >
                All pairs
              </button>
            </div>
          </div>

          <p className="eco-cc-connection-note">
            On moves data · Pause keeps queuing · Off stops new queueing.
            Remote controls are read-only here.
          </p>

          <div className="eco-cc-pair-list">
            {visiblePairs.map((pair) => (
              <PairCard
                key={pair.key}
                pair={pair}
                expanded={expandedPair === pair.key}
                pendingKeys={pendingKeys}
                canEdit={Boolean(onConnectionChange)}
                onToggle={() =>
                  setExpandedPair((current) =>
                    current === pair.key ? null : pair.key,
                  )
                }
                onPairState={(state) => void changePair(pair, state)}
                onFlowState={(flow, state) => void changeFlow(flow, state)}
              />
            ))}
            {!loading && visiblePairs.length === 0 && (
              <div className="eco-cc-empty">
                <strong>No connection data yet</strong>
                <span>
                  The panel will populate when the hub returns canonical flow
                  status.
                </span>
              </div>
            )}
            {loading && visiblePairs.length === 0 && (
              <div className="eco-cc-loading" aria-label="Loading connections">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="eco-cc-footer">
        <span>
          Viewing as <strong>{APP_META[hostApp].label}</strong>
        </span>
        <span>
          <kbd>Ctrl</kbd> + <kbd>E</kbd> to toggle
        </span>
      </footer>
    </section>
  );

  return mode === 'overlay' ? (
    <div className="eco-cc-backdrop" onMouseDown={dismissBackdrop}>
      {content}
    </div>
  ) : (
    content
  );
}
