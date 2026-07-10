import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Download,
  Gauge,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sun,
  Target,
  Trash2,
  Upload,
  Users,
  Wand2
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BODY_REGIONS } from "./domain/types";
import type {
  AthleteProfile,
  BodyRegion,
  ExerciseCategory,
  OlyStateDataSet,
  ReadinessSnapshot,
  RecommendationAction,
  WeightliftingSession
} from "./domain/types";
import { CATEGORY_LABELS, REGION_LABELS } from "./domain/constants";
import {
  adjustPlannedSession,
  calculateSessionLoad,
  convertPlannedSessionToActual,
  createSystemVector,
  evaluateAthlete,
  getMeetSummary,
  reviewPlannedSession,
  round,
  summarizePlanChanges
} from "./domain/engine";
import { formatBodyweightClass, getCategoryRule } from "./domain/iwfCategories";
import { futureSensorAdapters, makeId } from "./domain/sensorAdapters";
import { exportDataSet, loadDataSet, resetDataSet, saveDataSet } from "./domain/storage";

type DraftComponent = {
  id: string;
  name: string;
  category: ExerciseCategory;
  sets: number;
  reps: number;
  loadKg: number;
  percentOfMax: number;
  rpe: number;
  misses: number;
  technicalQuality: number;
};

const categoryOptions = Object.keys(CATEGORY_LABELS) as ExerciseCategory[];
const themeStorageKey = "olystate-theme-mode";

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
  } catch {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const defaultDraftComponent = (athlete: AthleteProfile): DraftComponent => ({
  id: makeId("draft"),
  name: "Snatch",
  category: "snatch",
  sets: 3,
  reps: 1,
  loadKg: Math.round(athlete.personalBests.snatch * 0.78),
  percentOfMax: 78,
  rpe: 7.5,
  misses: 0,
  technicalQuality: 8
});

const todayForInput = () => new Date().toISOString().slice(0, 10);

function dateForInput(date: string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function tomorrowForInput(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function getActivePlannedSession(plannedSessions: WeightliftingSession[], athleteId: string): WeightliftingSession | undefined {
  return plannedSessions.filter((session) => session.athleteId === athleteId).at(-1);
}

function draftComponentsFromSession(session: WeightliftingSession, athlete: AthleteProfile): DraftComponent[] {
  return session.entries.length
    ? session.entries.map((entry) => {
        const firstSet = entry.sets[0];
        const defaults = defaultDraftComponent(athlete);
        return {
          id: entry.id,
          name: entry.name,
          category: entry.category,
          sets: Math.max(1, entry.sets.length),
          reps: firstSet?.reps ?? defaults.reps,
          loadKg: firstSet?.loadKg ?? defaults.loadKg,
          percentOfMax: firstSet?.percentOfMax ?? defaults.percentOfMax,
          rpe: firstSet?.rpe ?? defaults.rpe,
          misses: entry.sets.filter((set) => !set.made).length,
          technicalQuality: firstSet?.technicalQuality ?? defaults.technicalQuality
        };
      })
    : [defaultDraftComponent(athlete)];
}

function duplicateActualAsPlan(session: WeightliftingSession): WeightliftingSession {
  const planDate = new Date(tomorrowForInput());
  planDate.setHours(15, 0, 0, 0);
  return {
    ...session,
    id: makeId("plan"),
    title: `Planned from ${session.title}`,
    mode: "planned",
    date: planDate.toISOString(),
    plannedSessionId: undefined,
    adjustedFromPlanId: undefined,
    wellness: {},
    painRatings: {},
    adjustmentNotes: [`Duplicated from actual session ${session.title}.`],
    entries: session.entries.map((entry) => ({
      ...entry,
      id: makeId("entry"),
      sets: entry.sets.map((set) => ({
        ...set,
        id: makeId("set"),
        made: true,
        painRegions: []
      }))
    }))
  };
}

function createBlankPlan(athlete: AthleteProfile): WeightliftingSession {
  const planDate = new Date(tomorrowForInput());
  planDate.setHours(15, 0, 0, 0);
  const component = defaultDraftComponent(athlete);
  return {
    id: makeId("plan"),
    athleteId: athlete.id,
    title: "Planned training session",
    date: planDate.toISOString(),
    mode: "planned",
    durationMinutes: 90,
    wellness: {},
    painRatings: {},
    entries: [
      {
        id: makeId("entry"),
        exerciseId: component.name.toLowerCase().replaceAll(" ", "-"),
        name: component.name,
        category: component.category,
        sets: Array.from({ length: component.sets }).map(() => ({
          id: makeId("set"),
          reps: component.reps,
          loadKg: component.loadKg,
          percentOfMax: component.percentOfMax,
          rpe: component.rpe,
          made: true,
          technicalQuality: component.technicalQuality
        }))
      }
    ]
  };
}

function App() {
  const [dataSet, setDataSet] = useState<OlyStateDataSet>(() => loadDataSet());
  const [activeAthleteId, setActiveAthleteId] = useState(() => dataSet.athletes[0]?.id ?? "");
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDarkMode = theme === "dark";

  const activeAthlete = dataSet.athletes.find((athlete) => athlete.id === activeAthleteId) ?? dataSet.athletes[0];
  const athleteSessions = useMemo(
    () => dataSet.sessions.filter((session) => session.athleteId === activeAthlete?.id),
    [activeAthlete?.id, dataSet.sessions]
  );
  const plannedSession = useMemo(
    () => (activeAthlete ? getActivePlannedSession(dataSet.plannedSessions, activeAthlete.id) : undefined),
    [activeAthlete?.id, dataSet.plannedSessions]
  );
  const snapshot = useMemo(
    () => (activeAthlete ? evaluateAthlete(activeAthlete, dataSet.sessions) : undefined),
    [activeAthlete, dataSet.sessions]
  );
  const planSnapshot = useMemo(
    () => (activeAthlete && plannedSession ? reviewPlannedSession(activeAthlete, dataSet.sessions, plannedSession) : undefined),
    [activeAthlete, dataSet.sessions, plannedSession]
  );

  useEffect(() => {
    saveDataSet(dataSet);
  }, [dataSet]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Theme still applies for the current session when local storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    if (activeAthlete && !activeAthleteId) {
      setActiveAthleteId(activeAthlete.id);
    }
  }, [activeAthlete, activeAthleteId]);

  if (!activeAthlete || !snapshot) {
    return <EmptyState />;
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as OlyStateDataSet;
    setDataSet({
      athletes: parsed.athletes ?? [],
      sessions: parsed.sessions ?? [],
      plannedSessions: parsed.plannedSessions ?? [],
      observations: parsed.observations ?? []
    });
    setActiveAthleteId(parsed.athletes?.[0]?.id ?? "");
    event.target.value = "";
  };

  const savePlannedSession = (session: WeightliftingSession) => {
    setDataSet((current) => {
      const exists = current.plannedSessions.some((planned) => planned.id === session.id);
      return {
        ...current,
        plannedSessions: exists
          ? current.plannedSessions.map((planned) => (planned.id === session.id ? session : planned))
          : [...current.plannedSessions, session]
      };
    });
  };

  const latestActualSession = athleteSessions
    .filter((session) => session.mode === "actual")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .at(-1);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">OlyState Pro</p>
          <h1>Coach Readiness Console</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDarkMode}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDarkMode ? "Light mode" : "Dark mode"}</span>
          </button>
          <button className="icon-button" type="button" onClick={() => exportDataSet(dataSet)} title="Export JSON">
            <Download size={18} />
            <span>Export</span>
          </button>
          <button className="icon-button" type="button" onClick={() => fileInputRef.current?.click()} title="Import JSON">
            <Upload size={18} />
            <span>Import</span>
          </button>
          <button className="icon-button ghost" type="button" onClick={() => setDataSet(resetDataSet())} title="Reset sample data">
            <RotateCcw size={18} />
            <span>Reset</span>
          </button>
          <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={handleImport} />
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="roster-panel" aria-label="Athlete roster">
          <div className="panel-heading">
            <Users size={18} />
            <h2>Athletes</h2>
          </div>
          <div className="athlete-list">
            {dataSet.athletes.map((athlete) => {
              const athleteSnapshot = evaluateAthlete(athlete, dataSet.sessions);
              return (
                <button
                  type="button"
                  className={`athlete-row ${athlete.id === activeAthlete.id ? "selected" : ""}`}
                  key={athlete.id}
                  onClick={() => setActiveAthleteId(athlete.id)}
                >
                  <span>
                    <strong>{athlete.name}</strong>
                    <small>{formatBodyweightClass(athlete.bodyweightKg, athlete.sex, new Date().toISOString())}</small>
                  </span>
                  <span className={`status-dot ${athleteSnapshot.readinessBand}`}>{athleteSnapshot.globalReadiness}</span>
                </button>
              );
            })}
          </div>
          <AthleteCreator
            onCreate={(athlete) => {
              setDataSet((current) => ({ ...current, athletes: [...current.athletes, athlete] }));
              setActiveAthleteId(athlete.id);
            }}
          />
        </aside>

        <section className="dashboard">
          <ReadinessHeader athlete={activeAthlete} snapshot={snapshot} />
          <SystemGrid snapshot={snapshot} />
          <div className="two-column">
            <ReadinessTrend athlete={activeAthlete} sessions={athleteSessions} />
            <MeetPanel athlete={activeAthlete} snapshot={snapshot} />
          </div>
          <div className="two-column wide-left">
            <RecommendationsPanel title="Warnings" items={snapshot.warnings} empty="No active warnings" />
            <RecommendationsPanel title="Next Constraints" items={snapshot.recommendations} empty="No constraints beyond normal coach review" />
          </div>
          <PlannedSessionPanel
            athlete={activeAthlete}
            actualSessions={dataSet.sessions}
            plannedSessions={dataSet.plannedSessions}
            session={plannedSession}
            snapshot={planSnapshot}
            latestActualSession={latestActualSession}
            onSavePlan={savePlannedSession}
            onCreateBlank={() => savePlannedSession(createBlankPlan(activeAthlete))}
            onApplyAdjustments={(session) => savePlannedSession(adjustPlannedSession(activeAthlete, dataSet.sessions, session))}
            onConvertToActual={(session) =>
              setDataSet((current) => ({
                ...current,
                sessions: [...current.sessions, convertPlannedSessionToActual(session)]
              }))
            }
            onDuplicateLast={() => {
              if (latestActualSession) savePlannedSession(duplicateActualAsPlan(latestActualSession));
            }}
            onDeletePlan={(sessionId) =>
              setDataSet((current) => ({
                ...current,
                plannedSessions: current.plannedSessions.filter((session) => session.id !== sessionId)
              }))
            }
            onResetPlans={() =>
              setDataSet((current) => ({
                ...current,
                plannedSessions: current.plannedSessions.filter((session) => session.athleteId !== activeAthlete.id)
              }))
            }
          />
          <SessionEditor
            key={`actual-${activeAthlete.id}`}
            athlete={activeAthlete}
            mode="actual"
            heading="Session Logger"
            submitLabel="Save session"
            defaultTitle="New training session"
            onSave={(session) => setDataSet((current) => ({ ...current, sessions: [...current.sessions, session] }))}
          />
          <SensorPanel observationCount={dataSet.observations.length} />
        </section>
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <main className="empty-state">
      <Database size={32} />
      <h1>OlyState Pro</h1>
      <p>No athlete data is loaded.</p>
    </main>
  );
}

function ReadinessHeader({ athlete, snapshot }: { athlete: AthleteProfile; snapshot: ReadinessSnapshot }) {
  const categoryRule = getCategoryRule(new Date().toISOString());
  return (
    <section className="readiness-header">
      <div>
        <p className="eyebrow">{categoryRule.label}</p>
        <h2>{athlete.name}</h2>
        <p className="subtle">
          {formatBodyweightClass(athlete.bodyweightKg, athlete.sex, new Date().toISOString())} · PB{" "}
          {athlete.personalBests.snatch}/{athlete.personalBests.cleanJerk}
        </p>
      </div>
      <div className={`readiness-score ${snapshot.readinessBand}`}>
        <span>{snapshot.globalReadiness}</span>
        <small>Readiness</small>
      </div>
      <div className="compact-metrics">
        <Metric icon={<Gauge size={17} />} label="Technical" value={`${snapshot.technicalReadiness}`} />
        <Metric icon={<Target size={17} />} label="Sn/CJ confidence" value={`${snapshot.attemptConfidence.snatch}/${snapshot.attemptConfidence.cleanJerk}`} />
        <Metric icon={<Shield size={17} />} label="Debt" value={`${snapshot.recoveryDebt}`} />
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span className="metric-icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function SystemGrid({ snapshot }: { snapshot: ReadinessSnapshot }) {
  return (
    <section className="system-grid" aria-label="System readiness">
      {Object.entries(snapshot.systemReadiness).map(([system, readiness]) => (
        <div className="system-panel" key={system}>
          <div className="system-topline">
            <span>{system}</span>
            <strong>{readiness}</strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span style={{ width: `${readiness}%` }} />
          </div>
          <div className="state-row">
            <small>State</small>
            <code>{snapshot.systemState[system as keyof typeof snapshot.systemState]}</code>
          </div>
        </div>
      ))}
    </section>
  );
}

function ReadinessTrend({ athlete, sessions }: { athlete: AthleteProfile; sessions: WeightliftingSession[] }) {
  const points = useMemo(() => {
    return sessions
      .filter((session) => session.mode === "actual")
      .slice(-8)
      .map((_, index, subset) => evaluateAthlete(athlete, subset.slice(0, index + 1)).globalReadiness);
  }, [athlete, sessions]);

  const path = points
    .map((point, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 100 - point;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <section className="panel">
      <div className="panel-heading">
        <BarChart3 size={18} />
        <h2>Readiness Trend</h2>
      </div>
      <div className="trend-chart">
        <svg viewBox="0 0 100 100" role="img" aria-label="Recent readiness trend">
          <line x1="0" x2="100" y1="32" y2="32" />
          <line x1="0" x2="100" y1="58" y2="58" />
          <path d={path || "M 0 50 L 100 50"} />
          {points.map((point, index) => (
            <circle key={`${point}-${index}`} cx={points.length <= 1 ? 0 : (index / (points.length - 1)) * 100} cy={100 - point} r="2.2" />
          ))}
        </svg>
      </div>
    </section>
  );
}

function MeetPanel({ athlete, snapshot }: { athlete: AthleteProfile; snapshot: ReadinessSnapshot }) {
  const nextMeet = athlete.meets
    .filter((meet) => new Date(meet.date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  return (
    <section className="panel">
      <div className="panel-heading">
        <CalendarDays size={18} />
        <h2>Meet Context</h2>
      </div>
      <p className="meet-line">{getMeetSummary(athlete, snapshot)}</p>
      {nextMeet ? (
        <div className="attempt-grid">
          <Metric icon={<Target size={17} />} label="Sn opener" value={`${snapshot.attemptConfidence.projectedSnatchOpenerKg} kg`} />
          <Metric icon={<Target size={17} />} label="CJ opener" value={`${snapshot.attemptConfidence.projectedCleanJerkOpenerKg} kg`} />
          <Metric icon={<Gauge size={17} />} label="Projected total" value={`${snapshot.attemptConfidence.projectedSnatchOpenerKg + snapshot.attemptConfidence.projectedCleanJerkOpenerKg} kg`} />
        </div>
      ) : null}
    </section>
  );
}

function AthleteCreator({ onCreate }: { onCreate: (athlete: AthleteProfile) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("New athlete");
  const [sex, setSex] = useState<AthleteProfile["sex"]>("female");
  const [bodyweightKg, setBodyweightKg] = useState(71);
  const [snatch, setSnatch] = useState(80);
  const [cleanJerk, setCleanJerk] = useState(100);
  const [frontSquat, setFrontSquat] = useState(115);
  const [backSquat, setBackSquat] = useState(140);
  const [baselineHrvRmssd, setBaselineHrvRmssd] = useState(62);
  const [baselineRestingHr, setBaselineRestingHr] = useState(52);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const athlete: AthleteProfile = {
      id: makeId("ath"),
      name,
      sex,
      bodyweightKg,
      personalBests: {
        snatch,
        cleanJerk,
        frontSquat,
        backSquat,
        jerk: cleanJerk,
        clean: cleanJerk,
        snatchPull: Math.round(snatch * 1.12),
        cleanPull: Math.round(cleanJerk * 1.12)
      },
      baselineHrvRmssd,
      baselineRestingHr,
      systemState: createSystemVector(0),
      stateUpdatedAt: new Date().toISOString(),
      meets: []
    };
    onCreate(athlete);
    setIsOpen(false);
    setName("New athlete");
  };

  return (
    <div className="athlete-create">
      <button type="button" className="icon-button primary roster-add" onClick={() => setIsOpen((value) => !value)}>
        <Plus size={18} />
        <span>New athlete</span>
      </button>
      {isOpen ? (
        <form className="athlete-create-form" onSubmit={submit}>
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>Sex</span>
            <select value={sex} onChange={(event) => setSex(event.target.value as AthleteProfile["sex"])}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
          <NumberField label="Body kg" value={bodyweightKg} onChange={setBodyweightKg} step={0.1} />
          <NumberField label="Snatch" value={snatch} onChange={setSnatch} />
          <NumberField label="Clean & jerk" value={cleanJerk} onChange={setCleanJerk} />
          <NumberField label="Front squat" value={frontSquat} onChange={setFrontSquat} />
          <NumberField label="Back squat" value={backSquat} onChange={setBackSquat} />
          <NumberField label="HRV" value={baselineHrvRmssd} onChange={setBaselineHrvRmssd} />
          <NumberField label="Rest HR" value={baselineRestingHr} onChange={setBaselineRestingHr} />
          <button type="submit" className="icon-button primary">
            <Save size={18} />
            <span>Create</span>
          </button>
        </form>
      ) : null}
    </div>
  );
}

function RecommendationsPanel({ title, items, empty }: { title: string; items: RecommendationAction[]; empty: string }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <AlertTriangle size={18} />
        <h2>{title}</h2>
      </div>
      <div className="action-list">
        {items.length ? (
          items.map((item) => (
            <article className={`action-item ${item.severity}`} key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))
        ) : (
          <p className="subtle">{empty}</p>
        )}
      </div>
    </section>
  );
}

function InlineActionGroup({ title, items, empty }: { title: string; items: RecommendationAction[]; empty: string }) {
  return (
    <div className="inline-action-group">
      <div className="inline-action-heading">
        <AlertTriangle size={16} />
        <h3>{title}</h3>
      </div>
      <div className="action-list">
        {items.length ? (
          items.map((item) => (
            <article className={`action-item ${item.severity}`} key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))
        ) : (
          <p className="subtle">{empty}</p>
        )}
      </div>
    </div>
  );
}

function PlannedSessionPanel({
  athlete,
  actualSessions,
  plannedSessions,
  session,
  snapshot,
  latestActualSession,
  onSavePlan,
  onCreateBlank,
  onApplyAdjustments,
  onConvertToActual,
  onDuplicateLast,
  onDeletePlan,
  onResetPlans
}: {
  athlete: AthleteProfile;
  actualSessions: WeightliftingSession[];
  plannedSessions: WeightliftingSession[];
  session?: WeightliftingSession;
  snapshot?: ReadinessSnapshot;
  latestActualSession?: WeightliftingSession;
  onSavePlan: (session: WeightliftingSession) => void;
  onCreateBlank: () => void;
  onApplyAdjustments: (session: WeightliftingSession) => void;
  onConvertToActual: (session: WeightliftingSession) => void;
  onDuplicateLast: () => void;
  onDeletePlan: (sessionId: string) => void;
  onResetPlans: () => void;
}) {
  const load = session ? calculateSessionLoad(session, athlete) : undefined;
  const originalPlan = session?.adjustedFromPlanId ? plannedSessions.find((candidate) => candidate.id === session.adjustedFromPlanId) : undefined;
  const planChanges = session?.adjustmentNotes?.length ? summarizePlanChanges(originalPlan ?? session, session) : [];

  return (
    <section className="panel planned-workflow">
      <div className="panel-heading">
        <ClipboardList size={18} />
        <h2>Planned Session Builder</h2>
      </div>

      {session && snapshot && load ? (
        <div className="planned-layout">
          <div>
            <h3>{session.title}</h3>
            <p className="subtle">
              {snapshot.classification.label.replace("_", " ")} - {round(load.averageIntensity * 100)}% avg intensity - {round(load.relativeVolume)} kg volume
            </p>
          </div>
          <div className="plan-score">
            <span>{snapshot.globalReadiness}</span>
            <small>After plan stress</small>
          </div>
        </div>
      ) : (
        <p className="subtle">Create a plan, duplicate the last actual session, then let OlyState review it against current readiness.</p>
      )}

      {load ? (
        <div className="plan-load-grid">
          {Object.entries(load.systemLoad).map(([system, value]) => (
            <Metric key={system} icon={<Gauge size={17} />} label={`${system} load`} value={`${round(value, 1)}`} />
          ))}
        </div>
      ) : null}

      {snapshot ? (
        <div className="two-column plan-constraints">
          <InlineActionGroup title="Plan Warnings" items={snapshot.warnings} empty="No warnings for this plan" />
          <InlineActionGroup title="Plan Constraints" items={snapshot.recommendations} empty="No plan constraints" />
        </div>
      ) : null}

      {planChanges.length ? <InlineActionGroup title="Applied Adjustments" items={planChanges} empty="No changes applied" /> : null}

      <div className="form-actions plan-actions">
        <button type="button" className="icon-button ghost" onClick={onCreateBlank}>
          <Plus size={18} />
          <span>New blank plan</span>
        </button>
        <button type="button" className="icon-button ghost" onClick={onDuplicateLast} disabled={!latestActualSession}>
          <Copy size={18} />
          <span>Duplicate last actual</span>
        </button>
        <button type="button" className="icon-button ghost" onClick={() => session && onApplyAdjustments(session)} disabled={!session}>
          <Wand2 size={18} />
          <span>Apply adjustments</span>
        </button>
        <button type="button" className="icon-button ghost" onClick={() => session && onConvertToActual(session)} disabled={!session}>
          <CheckCircle2 size={18} />
          <span>Convert to actual</span>
        </button>
        <button type="button" className="icon-button ghost" onClick={() => session && onDeletePlan(session.id)} disabled={!session}>
          <Trash2 size={18} />
          <span>Delete plan</span>
        </button>
        <button type="button" className="icon-button ghost" onClick={onResetPlans}>
          <RotateCcw size={18} />
          <span>Reset plans</span>
        </button>
      </div>

      <SessionEditor
        key={`planned-${athlete.id}-${session?.id ?? "new"}`}
        athlete={athlete}
        mode="planned"
        heading={session ? "Edit Active Plan" : "Create Active Plan"}
        submitLabel={session ? "Save plan" : "Create plan"}
        defaultTitle="Planned training session"
        initialSession={session}
        onSave={onSavePlan}
      />
    </section>
  );
}

function SessionEditor({
  athlete,
  mode,
  heading,
  submitLabel,
  defaultTitle,
  initialSession,
  onSave
}: {
  athlete: AthleteProfile;
  mode: "planned" | "actual";
  heading: string;
  submitLabel: string;
  defaultTitle: string;
  initialSession?: WeightliftingSession;
  onSave: (session: WeightliftingSession) => void;
}) {
  const [title, setTitle] = useState(initialSession?.title ?? defaultTitle);
  const [date, setDate] = useState(initialSession ? dateForInput(initialSession.date) : mode === "planned" ? tomorrowForInput() : todayForInput());
  const [sleepQuality, setSleepQuality] = useState(initialSession?.wellness?.sleepQuality ?? 0.72);
  const [stress, setStress] = useState(initialSession?.wellness?.stress ?? 0.35);
  const [soreness, setSoreness] = useState(initialSession?.wellness?.soreness ?? 0.35);
  const [subjectiveReadiness, setSubjectiveReadiness] = useState(initialSession?.wellness?.subjectiveReadiness ?? 0.72);
  const [hrvRmssd, setHrvRmssd] = useState(initialSession?.wellness?.hrvRmssd ?? athlete.baselineHrvRmssd ?? 60);
  const [restingHr, setRestingHr] = useState(initialSession?.wellness?.restingHr ?? athlete.baselineRestingHr ?? 52);
  const [painRegion, setPainRegion] = useState<BodyRegion>("knee");
  const [painScore, setPainScore] = useState(0);
  const [taperFlag, setTaperFlag] = useState(initialSession?.taperFlag ?? false);
  const [meetSimulation, setMeetSimulation] = useState(initialSession?.meetSimulation ?? false);
  const [components, setComponents] = useState<DraftComponent[]>(() =>
    initialSession ? draftComponentsFromSession(initialSession, athlete) : [defaultDraftComponent(athlete)]
  );

  useEffect(() => {
    const firstPainRegion = BODY_REGIONS.find((region) => (initialSession?.painRatings?.[region] ?? 0) > 0) ?? "knee";
    setTitle(initialSession?.title ?? defaultTitle);
    setDate(initialSession ? dateForInput(initialSession.date) : mode === "planned" ? tomorrowForInput() : todayForInput());
    setSleepQuality(initialSession?.wellness?.sleepQuality ?? 0.72);
    setStress(initialSession?.wellness?.stress ?? 0.35);
    setSoreness(initialSession?.wellness?.soreness ?? 0.35);
    setSubjectiveReadiness(initialSession?.wellness?.subjectiveReadiness ?? 0.72);
    setHrvRmssd(initialSession?.wellness?.hrvRmssd ?? athlete.baselineHrvRmssd ?? 60);
    setRestingHr(initialSession?.wellness?.restingHr ?? athlete.baselineRestingHr ?? 52);
    setPainRegion(firstPainRegion);
    setPainScore(initialSession?.painRatings?.[firstPainRegion] ?? 0);
    setTaperFlag(initialSession?.taperFlag ?? false);
    setMeetSimulation(initialSession?.meetSimulation ?? false);
    setComponents(initialSession ? draftComponentsFromSession(initialSession, athlete) : [defaultDraftComponent(athlete)]);
  }, [athlete, defaultTitle, initialSession, mode]);

  const updateComponent = (id: string, patch: Partial<DraftComponent>) => {
    setComponents((current) => current.map((component) => (component.id === id ? { ...component, ...patch } : component)));
  };

  const saveSession = (event: FormEvent) => {
    event.preventDefault();
    const sessionDate = new Date(date);
    sessionDate.setHours(15, 0, 0, 0);
    const entries = components.map((component) => ({
      id: component.id.startsWith("entry") ? component.id : makeId("entry"),
      exerciseId: component.name.toLowerCase().replaceAll(" ", "-"),
      name: component.name,
      category: component.category,
      sets: Array.from({ length: Math.max(1, component.sets) }).map((_, index) => ({
        id: makeId("set"),
        reps: Math.max(1, component.reps),
        loadKg: Math.max(0, component.loadKg),
        percentOfMax: Math.max(0, component.percentOfMax),
        rpe: Math.max(1, component.rpe),
        made: mode === "planned" ? true : index >= component.misses,
        technicalQuality: component.technicalQuality,
        painRegions: mode === "actual" && painScore > 0 ? [painRegion] : []
      }))
    }));

    onSave({
      id: initialSession?.id ?? makeId(mode === "planned" ? "plan" : "session"),
      athleteId: athlete.id,
      title,
      date: sessionDate.toISOString(),
      mode,
      durationMinutes: initialSession?.durationMinutes ?? 90,
      plannedSessionId: initialSession?.plannedSessionId,
      adjustedFromPlanId: initialSession?.adjustedFromPlanId,
      adjustmentNotes: initialSession?.adjustmentNotes,
      wellness:
        mode === "actual"
          ? {
              sleepQuality,
              hrvRmssd,
              restingHr,
              stress,
              soreness,
              subjectiveReadiness,
              bodyweightKg: athlete.bodyweightKg
            }
          : {},
      painRatings: mode === "actual" && painScore > 0 ? { [painRegion]: painScore } : {},
      entries,
      taperFlag,
      meetSimulation,
      notes: initialSession?.notes
    });

    if (!initialSession && mode === "actual") {
      setTitle(defaultTitle);
      setComponents([defaultDraftComponent(athlete)]);
      setPainScore(0);
    }
  };

  return (
    <section className={`editor-surface ${mode}`}>
      <div className="panel-heading">
        <Save size={18} />
        <h2>{heading}</h2>
      </div>
      <form onSubmit={saveSession}>
        <div className="form-grid">
          <label>
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          {mode === "actual" ? (
            <>
              <RangeInput label="Sleep" value={sleepQuality} min={0} max={1} step={0.01} onChange={setSleepQuality} />
              <RangeInput label="Stress" value={stress} min={0} max={1} step={0.01} onChange={setStress} />
              <RangeInput label="Soreness" value={soreness} min={0} max={1} step={0.01} onChange={setSoreness} />
              <RangeInput label="Readiness" value={subjectiveReadiness} min={0} max={1} step={0.01} onChange={setSubjectiveReadiness} />
              <label>
                <span>HRV RMSSD</span>
                <input type="number" value={hrvRmssd} onChange={(event) => setHrvRmssd(Number(event.target.value))} />
              </label>
              <label>
                <span>Resting HR</span>
                <input type="number" value={restingHr} onChange={(event) => setRestingHr(Number(event.target.value))} />
              </label>
              <label>
                <span>Pain region</span>
                <select value={painRegion} onChange={(event) => setPainRegion(event.target.value as BodyRegion)}>
                  {BODY_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {REGION_LABELS[region]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Pain score</span>
                <input type="number" min={0} max={10} value={painScore} onChange={(event) => setPainScore(Number(event.target.value))} />
              </label>
            </>
          ) : (
            <>
              <label className="checkbox-field">
                <input type="checkbox" checked={taperFlag} onChange={(event) => setTaperFlag(event.target.checked)} />
                <span>Taper session</span>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" checked={meetSimulation} onChange={(event) => setMeetSimulation(event.target.checked)} />
                <span>Meet simulation</span>
              </label>
            </>
          )}
        </div>

        <div className="component-list">
          {components.map((component) => (
            <div className={`component-row ${mode}`} key={component.id}>
              <input value={component.name} onChange={(event) => updateComponent(component.id, { name: event.target.value })} />
              <select value={component.category} onChange={(event) => updateComponent(component.id, { category: event.target.value as ExerciseCategory })}>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <NumberField label="Sets" value={component.sets} onChange={(sets) => updateComponent(component.id, { sets })} />
              <NumberField label="Reps" value={component.reps} onChange={(reps) => updateComponent(component.id, { reps })} />
              <NumberField label="Kg" value={component.loadKg} onChange={(loadKg) => updateComponent(component.id, { loadKg })} />
              <NumberField label="%" value={component.percentOfMax} onChange={(percentOfMax) => updateComponent(component.id, { percentOfMax })} />
              <NumberField label="RPE" value={component.rpe} onChange={(rpe) => updateComponent(component.id, { rpe })} step={0.5} />
              {mode === "actual" ? <NumberField label="Miss" value={component.misses} onChange={(misses) => updateComponent(component.id, { misses })} /> : null}
              <NumberField label="Tech" value={component.technicalQuality} onChange={(technicalQuality) => updateComponent(component.id, { technicalQuality })} step={0.5} />
              <button
                className="icon-only"
                type="button"
                title="Remove component"
                onClick={() => setComponents((current) => current.filter((item) => item.id !== component.id))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" className="icon-button ghost" onClick={() => setComponents((current) => [...current, defaultDraftComponent(athlete)])}>
            <Plus size={18} />
            <span>Add component</span>
          </button>
          <button type="submit" className="icon-button primary">
            <Save size={18} />
            <span>{submitLabel}</span>
          </button>
        </div>
      </form>
    </section>
  );
}

function LegacyPlannedSessionPanel({
  session,
  snapshot,
  athlete
}: {
  session: WeightliftingSession;
  snapshot: ReadinessSnapshot;
  athlete: AthleteProfile;
}) {
  const load = calculateSessionLoad(session, athlete);
  return (
    <section className="panel">
      <div className="panel-heading">
        <Activity size={18} />
        <h2>Planned Session Review</h2>
      </div>
      <div className="planned-layout">
        <div>
          <h3>{session.title}</h3>
          <p className="subtle">
            {snapshot.classification.label.replace("_", " ")} · {round(load.averageIntensity * 100)}% avg intensity · {round(load.relativeVolume)} kg volume
          </p>
        </div>
        <div className="plan-score">
          <span>{snapshot.globalReadiness}</span>
          <small>After plan stress</small>
        </div>
      </div>
    </section>
  );
}

function LegacySessionLogger({ athlete, onSave }: { athlete: AthleteProfile; onSave: (session: WeightliftingSession) => void }) {
  const [title, setTitle] = useState("New training session");
  const [date, setDate] = useState(todayForInput());
  const [sleepQuality, setSleepQuality] = useState(0.72);
  const [stress, setStress] = useState(0.35);
  const [soreness, setSoreness] = useState(0.35);
  const [subjectiveReadiness, setSubjectiveReadiness] = useState(0.72);
  const [hrvRmssd, setHrvRmssd] = useState(athlete.baselineHrvRmssd ?? 60);
  const [restingHr, setRestingHr] = useState(athlete.baselineRestingHr ?? 52);
  const [painRegion, setPainRegion] = useState<BodyRegion>("knee");
  const [painScore, setPainScore] = useState(0);
  const [components, setComponents] = useState<DraftComponent[]>(() => [defaultDraftComponent(athlete)]);

  useEffect(() => {
    setComponents([defaultDraftComponent(athlete)]);
    setHrvRmssd(athlete.baselineHrvRmssd ?? 60);
    setRestingHr(athlete.baselineRestingHr ?? 52);
  }, [athlete]);

  const updateComponent = (id: string, patch: Partial<DraftComponent>) => {
    setComponents((current) => current.map((component) => (component.id === id ? { ...component, ...patch } : component)));
  };

  const saveSession = (event: FormEvent) => {
    event.preventDefault();
    const sessionId = makeId("session");
    const sessionDate = new Date(date);
    sessionDate.setHours(15, 0, 0, 0);

    const entries = components.map((component) => ({
      id: makeId("entry"),
      exerciseId: component.name.toLowerCase().replaceAll(" ", "-"),
      name: component.name,
      category: component.category,
      sets: Array.from({ length: component.sets }).map((_, index) => ({
        id: makeId("set"),
        reps: component.reps,
        loadKg: component.loadKg,
        percentOfMax: component.percentOfMax,
        rpe: component.rpe,
        made: index >= component.misses,
        technicalQuality: component.technicalQuality,
        painRegions: painScore > 0 ? [painRegion] : []
      }))
    }));

    onSave({
      id: sessionId,
      athleteId: athlete.id,
      title,
      date: sessionDate.toISOString(),
      mode: "actual",
      durationMinutes: 90,
      wellness: {
        sleepQuality,
        hrvRmssd,
        restingHr,
        stress,
        soreness,
        subjectiveReadiness,
        bodyweightKg: athlete.bodyweightKg
      },
      painRatings: painScore > 0 ? { [painRegion]: painScore } : {},
      entries
    });

    setTitle("New training session");
    setComponents([defaultDraftComponent(athlete)]);
    setPainScore(0);
  };

  return (
    <section className="panel logger-panel">
      <div className="panel-heading">
        <Save size={18} />
        <h2>Session Logger</h2>
      </div>
      <form onSubmit={saveSession}>
        <div className="form-grid">
          <label>
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <RangeInput label="Sleep" value={sleepQuality} min={0} max={1} step={0.01} onChange={setSleepQuality} />
          <RangeInput label="Stress" value={stress} min={0} max={1} step={0.01} onChange={setStress} />
          <RangeInput label="Soreness" value={soreness} min={0} max={1} step={0.01} onChange={setSoreness} />
          <RangeInput label="Readiness" value={subjectiveReadiness} min={0} max={1} step={0.01} onChange={setSubjectiveReadiness} />
          <label>
            <span>HRV RMSSD</span>
            <input type="number" value={hrvRmssd} onChange={(event) => setHrvRmssd(Number(event.target.value))} />
          </label>
          <label>
            <span>Resting HR</span>
            <input type="number" value={restingHr} onChange={(event) => setRestingHr(Number(event.target.value))} />
          </label>
          <label>
            <span>Pain region</span>
            <select value={painRegion} onChange={(event) => setPainRegion(event.target.value as BodyRegion)}>
              {BODY_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {REGION_LABELS[region]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Pain score</span>
            <input type="number" min={0} max={10} value={painScore} onChange={(event) => setPainScore(Number(event.target.value))} />
          </label>
        </div>

        <div className="component-list">
          {components.map((component) => (
            <div className="component-row" key={component.id}>
              <input value={component.name} onChange={(event) => updateComponent(component.id, { name: event.target.value })} />
              <select value={component.category} onChange={(event) => updateComponent(component.id, { category: event.target.value as ExerciseCategory })}>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <NumberField label="Sets" value={component.sets} onChange={(sets) => updateComponent(component.id, { sets })} />
              <NumberField label="Reps" value={component.reps} onChange={(reps) => updateComponent(component.id, { reps })} />
              <NumberField label="Kg" value={component.loadKg} onChange={(loadKg) => updateComponent(component.id, { loadKg })} />
              <NumberField label="%" value={component.percentOfMax} onChange={(percentOfMax) => updateComponent(component.id, { percentOfMax })} />
              <NumberField label="RPE" value={component.rpe} onChange={(rpe) => updateComponent(component.id, { rpe })} step={0.5} />
              <NumberField label="Miss" value={component.misses} onChange={(misses) => updateComponent(component.id, { misses })} />
              <NumberField label="Tech" value={component.technicalQuality} onChange={(technicalQuality) => updateComponent(component.id, { technicalQuality })} step={0.5} />
              <button
                className="icon-only"
                type="button"
                title="Remove component"
                onClick={() => setComponents((current) => current.filter((item) => item.id !== component.id))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" className="icon-button ghost" onClick={() => setComponents((current) => [...current, defaultDraftComponent(athlete)])}>
            <Plus size={18} />
            <span>Add component</span>
          </button>
          <button type="submit" className="icon-button primary">
            <Save size={18} />
            <span>Save session</span>
          </button>
        </div>
      </form>
    </section>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>
        {label} <code>{round(value, 2)}</code>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="compact-field">
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SensorPanel({ observationCount }: { observationCount: number }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <Database size={18} />
        <h2>Sensor Intake</h2>
      </div>
      <div className="sensor-grid">
        <Metric icon={<Activity size={17} />} label="Observations" value={`${observationCount}`} />
        {futureSensorAdapters.map((adapter) => (
          <div className="sensor-chip" key={adapter.id}>
            <span>{adapter.displayName}</span>
            <small>{adapter.sourceType.replace("_", " ")}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export default App;
