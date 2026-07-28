import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  connectionSettingsPath,
  loadConnectionSettings,
  outboundState,
  reportToHub,
  saveConnectionSettings,
  setConnectionState,
  shouldEnqueue,
  shouldTransmit,
} from "./connectionSettings";
import { SyncPayloadType } from "../src/ecosystem-contracts/enums";
import { DEFAULT_CONNECTION_SETTINGS, type ConnectionSettings } from "../src/ecosystem-contracts/connections";

describe("connectionSettingsPath", () => {
  it("places the settings file next to the DB file, not in browser storage", () => {
    const path = connectionSettingsPath(join("data", "olystate.sqlite"));
    assert.equal(path.endsWith(join("data", "connection-settings.json")), true);
  });
});

describe("load / save / setConnectionState", () => {
  let dir: string;
  let settingsPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "olystate-connsettings-"));
    settingsPath = join(dir, "connection-settings.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to fully open when no file exists yet", () => {
    const settings = loadConnectionSettings(settingsPath);
    assert.deepEqual(settings.outbound, {});
    assert.deepEqual(settings.inbound, {});
    assert.equal(outboundState(settings, SyncPayloadType.ObservationUpsert), "on");
  });

  it("degrades to default-open when the file on disk is malformed", () => {
    writeFileSync(settingsPath, "{not valid json", "utf8");
    const settings = loadConnectionSettings(settingsPath);
    assert.deepEqual(settings, DEFAULT_CONNECTION_SETTINGS);
  });

  it("persists a mutation and reflects it on the next load", () => {
    setConnectionState(settingsPath, "outbound", SyncPayloadType.ObservationUpsert, "pause");
    const reloaded = loadConnectionSettings(settingsPath);
    const state = outboundState(reloaded, SyncPayloadType.ObservationUpsert);
    assert.equal(state, "pause");
    // 'pause' still queues locally but stops transmission.
    assert.equal(shouldEnqueue(state), true);
    assert.equal(shouldTransmit(state), false);
  });

  it("'off' stops even enqueueing, on top of stopping transmission", () => {
    setConnectionState(settingsPath, "outbound", SyncPayloadType.ObservationUpsert, "off");
    const state = outboundState(loadConnectionSettings(settingsPath), SyncPayloadType.ObservationUpsert);
    assert.equal(shouldEnqueue(state), false);
    assert.equal(shouldTransmit(state), false);
  });

  it("leaves other flows untouched when one flow is changed", () => {
    setConnectionState(settingsPath, "outbound", SyncPayloadType.ObservationUpsert, "pause");
    setConnectionState(settingsPath, "outbound", SyncPayloadType.ReadinessSnapshotUpsert, "off");
    const reloaded = loadConnectionSettings(settingsPath);
    assert.equal(outboundState(reloaded, SyncPayloadType.ObservationUpsert), "pause");
    assert.equal(outboundState(reloaded, SyncPayloadType.ReadinessSnapshotUpsert), "off");
    // Untouched payload types stay default-open.
    assert.equal(outboundState(reloaded, SyncPayloadType.SessionPlanUpsert), "on");
  });

  it("stamps updatedAt on every save", () => {
    const before = Date.now();
    const saved = saveConnectionSettings(settingsPath, DEFAULT_CONNECTION_SETTINGS);
    assert.ok(Date.parse(saved.updatedAt) >= before);
  });
});

describe("reportToHub", () => {
  it("is a no-op (never calls fetch) when the hub is not configured", async () => {
    let called = false;
    await reportToHub(DEFAULT_CONNECTION_SETTINGS, {
      fetchImpl: (async () => {
        called = true;
        return new Response("{}");
      }) as unknown as typeof fetch,
    });
    assert.equal(called, false);
  });

  it("PUTs the settings object directly (unwrapped) with x-service-key auth when configured", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init as RequestInit });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const settings: ConnectionSettings = {
      ...DEFAULT_CONNECTION_SETTINGS,
      outbound: { [SyncPayloadType.ObservationUpsert]: "pause" },
    };

    await reportToHub(settings, {
      hubUrl: "http://hub.test/",
      serviceKey: "sk-test",
      fetchImpl: fakeFetch,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://hub.test/api/ecosystem/connections");
    assert.equal(calls[0].init.method, "PUT");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["x-service-key"], "sk-test");
    // Body is the settings object itself — the hub reads app identity from
    // the service key header, not from a wrapper field in the body.
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), settings);
  });

  it("never throws even when the hub is unreachable", async () => {
    const throwingFetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await assert.doesNotReject(
      reportToHub(DEFAULT_CONNECTION_SETTINGS, {
        hubUrl: "http://hub.test",
        serviceKey: "sk",
        fetchImpl: throwingFetch,
      })
    );
  });
});
