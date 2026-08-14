// VENDORED from @ecosystem/control-center — do not edit here.
import type {
  ConnectionDirection,
  ConnectionState,
  EcosystemConnectionReport,
  EcosystemFlowStatus,
  EcosystemStatus,
  FlowStatus,
  SourceAppId,
} from './types';

export const APP_META: Readonly<
  Record<
    SourceAppId,
    { label: string; shortLabel: string; role: string; orbit: number }
  >
> = {
  athleteOS: {
    label: 'AthleteOS',
    shortLabel: 'AOS',
    role: 'Intelligence hub',
    orbit: 0,
  },
  swimStatePro: {
    label: 'Swim State',
    shortLabel: 'SSP',
    role: 'Readiness',
    orbit: 1,
  },
  olbrechtSystem: {
    label: 'Olbrecht',
    shortLabel: 'OET',
    role: 'Energy systems',
    orbit: 2,
  },
  formLab: {
    label: 'FormLab',
    shortLabel: 'FL',
    role: 'Biomechanics',
    orbit: 3,
  },
  triathletePro: {
    label: 'Triathlete',
    shortLabel: 'TRI',
    role: 'Multisport load',
    orbit: 4,
  },
  olyStatePro: {
    label: 'OlyState',
    shortLabel: 'OLY',
    role: 'Strength readiness',
    orbit: 5,
  },
  sentiOS: {
    label: 'SentiOS',
    shortLabel: 'SEN',
    role: 'Observability',
    orbit: 6,
  },
  recoveryAI: {
    label: 'Recovery AI',
    shortLabel: 'RAI',
    role: 'Recovery prescriptions',
    orbit: 7,
  },
};

export const APP_ORDER = Object.keys(APP_META) as SourceAppId[];

export interface PairFlow {
  key: string;
  payloadType: string;
  producer: SourceAppId;
  consumer: SourceAppId;
  cadence: string;
  status: FlowStatus;
  count24h: number;
  lastEnvelopeAt: string | null;
  editable: boolean;
  direction: ConnectionDirection | null;
  state: ConnectionState;
  settingsReported: boolean;
}

export interface AppPair {
  key: string;
  first: SourceAppId;
  second: SourceAppId;
  flows: PairFlow[];
  state: ConnectionState | 'mixed';
  status: FlowStatus;
  count24h: number;
  editable: boolean;
}

function isConnectionState(value: unknown): value is ConnectionState {
  return value === 'on' || value === 'pause' || value === 'off';
}

function reportFor(
  reports: readonly EcosystemConnectionReport[],
  app: SourceAppId,
): EcosystemConnectionReport | undefined {
  return reports.find((report) => report.app === app);
}

function settingsMap(
  report: EcosystemConnectionReport | undefined,
  direction: ConnectionDirection,
): Record<string, unknown> {
  const value = report?.settings?.[direction];
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function connectionStateForFlow(
  flow: Pick<EcosystemFlowStatus, 'payloadType' | 'producer'> & {
    consumer: SourceAppId;
  },
  reports: readonly EcosystemConnectionReport[],
  hostApp: SourceAppId,
): Pick<PairFlow, 'editable' | 'direction' | 'state' | 'settingsReported'> {
  const direction: ConnectionDirection | null =
    flow.producer === hostApp
      ? 'outbound'
      : flow.consumer === hostApp
        ? 'inbound'
        : null;

  if (direction) {
    const report = reportFor(reports, hostApp);
    const candidate = settingsMap(report, direction)[flow.payloadType];
    return {
      editable: true,
      direction,
      state: isConnectionState(candidate) ? candidate : 'on',
      settingsReported: Boolean(report),
    };
  }

  const producerReport = reportFor(reports, flow.producer);
  const consumerReport = reportFor(reports, flow.consumer);
  const producerState = settingsMap(producerReport, 'outbound')[
    flow.payloadType
  ];
  const consumerState = settingsMap(consumerReport, 'inbound')[
    flow.payloadType
  ];
  const states = [producerState, consumerState].filter(isConnectionState);
  const state: ConnectionState = states.includes('off')
    ? 'off'
    : states.includes('pause')
      ? 'pause'
      : 'on';
  return {
    editable: false,
    direction: null,
    state,
    settingsReported: Boolean(producerReport || consumerReport),
  };
}

function pairKey(first: SourceAppId, second: SourceAppId): string {
  return [first, second].sort().join('::');
}

function aggregateState(flows: readonly PairFlow[]): ConnectionState | 'mixed' {
  const states = new Set(flows.map((flow) => flow.state));
  return states.size === 1 ? flows[0]?.state ?? 'on' : 'mixed';
}

function aggregateStatus(flows: readonly PairFlow[]): FlowStatus {
  if (flows.some((flow) => flow.status === 'flowing')) return 'flowing';
  if (flows.some((flow) => flow.status === 'stale')) return 'stale';
  return 'silent';
}

export function buildAppPairs(
  status: Pick<EcosystemStatus, 'flows' | 'connections'>,
  hostApp: SourceAppId,
): AppPair[] {
  const pairs = new Map<string, AppPair>();

  for (const flow of status.flows) {
    for (const consumer of flow.consumers) {
      if (consumer === flow.producer) continue;
      const key = pairKey(flow.producer, consumer);
      const current =
        pairs.get(key) ??
        ({
          key,
          first: flow.producer,
          second: consumer,
          flows: [],
          state: 'on',
          status: 'silent',
          count24h: 0,
          editable: false,
        } satisfies AppPair);
      const connection = connectionStateForFlow(
        { ...flow, consumer },
        status.connections,
        hostApp,
      );
      current.flows.push({
        key: `${flow.producer}::${consumer}::${flow.payloadType}`,
        payloadType: flow.payloadType,
        producer: flow.producer,
        consumer,
        cadence: flow.cadence,
        status: flow.status,
        count24h: flow.count24h,
        lastEnvelopeAt: flow.lastEnvelopeAt,
        ...connection,
      });
      pairs.set(key, current);
    }
  }

  return [...pairs.values()]
    .map((pair) => ({
      ...pair,
      state: aggregateState(pair.flows),
      status: aggregateStatus(pair.flows),
      count24h: pair.flows.reduce((sum, flow) => sum + flow.count24h, 0),
      editable: pair.flows.some((flow) => flow.editable),
      flows: pair.flows.sort(
        (a, b) =>
          a.payloadType.localeCompare(b.payloadType) ||
          a.producer.localeCompare(b.producer),
      ),
    }))
    .sort((a, b) => {
      const aHost = a.first === hostApp || a.second === hostApp ? 0 : 1;
      const bHost = b.first === hostApp || b.second === hostApp ? 0 : 1;
      return aHost - bHost || a.key.localeCompare(b.key);
    });
}

export function ecosystemHealth(status: EcosystemStatus | null): {
  tone: 'healthy' | 'warn' | 'error' | 'unknown';
  label: string;
  flowing: number;
  stale: number;
  silent: number;
} {
  if (!status) {
    return {
      tone: 'unknown',
      label: 'Status unavailable',
      flowing: 0,
      stale: 0,
      silent: 0,
    };
  }
  const flowing = status.flows.filter((flow) => flow.status === 'flowing').length;
  const stale = status.flows.filter((flow) => flow.status === 'stale').length;
  const silent = status.flows.filter((flow) => flow.status === 'silent').length;
  if (status.flows.length === 0 || flowing === 0) {
    return {
      tone: 'error',
      label: 'No active flows',
      flowing,
      stale,
      silent,
    };
  }
  if (stale > 0 || silent > 0) {
    return {
      tone: 'warn',
      label: 'Attention needed',
      flowing,
      stale,
      silent,
    };
  }
  return {
    tone: 'healthy',
    label: 'Ecosystem healthy',
    flowing,
    stale,
    silent,
  };
}

export function humanizePayloadType(payloadType: string): string {
  return payloadType
    .replace(/Upsert$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}
