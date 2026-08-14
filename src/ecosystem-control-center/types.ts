// VENDORED from @ecosystem/control-center — do not edit here.
export type SourceAppId =
  | 'athleteOS'
  | 'swimStatePro'
  | 'olbrechtSystem'
  | 'formLab'
  | 'triathletePro'
  | 'olyStatePro'
  | 'sentiOS'
  | 'recoveryAI';

export type FlowStatus = 'flowing' | 'stale' | 'silent';
export type ConnectionState = 'on' | 'pause' | 'off';
export type ConnectionDirection = 'outbound' | 'inbound';

export interface EcosystemAppStatus {
  app: SourceAppId;
  provisioned: boolean;
  active: boolean;
  lastSeenAt: string | null;
}

export interface EcosystemFlowStatus {
  payloadType: string;
  producer: SourceAppId;
  consumers: readonly SourceAppId[];
  cadence: string;
  flowOrder: number;
  lastEnvelopeAt: string | null;
  count24h: number;
  status: FlowStatus;
}

export interface EcosystemConnectionReport {
  app: SourceAppId | string;
  settings: Record<string, unknown>;
  reportedAt: string;
}

export interface EcosystemStatus {
  generatedAt: string;
  apps: readonly EcosystemAppStatus[];
  flows: readonly EcosystemFlowStatus[];
  connections: readonly EcosystemConnectionReport[];
}

export interface ConnectionChange {
  direction: ConnectionDirection;
  payloadType: string;
  state: ConnectionState;
}

export interface ControlCenterProps {
  hostApp: SourceAppId;
  status: EcosystemStatus | null;
  mode?: 'overlay' | 'standalone';
  open?: boolean;
  loading?: boolean;
  error?: string | null;
  onClose?: () => void;
  onRefresh?: () => void | Promise<void>;
  onConnectionChange?: (
    change: ConnectionChange,
  ) => void | Promise<void>;
}

export interface ControlCenterLauncherProps {
  status: EcosystemStatus | null;
  label?: string;
  onClick: () => void;
}
