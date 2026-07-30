import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { OlyStateDatabase } from "./db";

describe("dataset revision control", () => {
  it("rejects stale writes and preserves the current snapshot", () => {
    const directory = mkdtempSync(join(tmpdir(), "olystate-db-"));
    const database = new OlyStateDatabase(join(directory, "test.sqlite"));
    try {
      assert.deepEqual(database.saveDataset('{"value":1}', 0), { saved: true, revision: 1 });
      const conflict = database.saveDataset('{"value":2}', 0);
      assert.equal(conflict.saved, false);
      if (!conflict.saved) {
        assert.equal(conflict.revision, 1);
        assert.equal(conflict.payloadJson, '{"value":1}');
      }
      assert.deepEqual(database.loadDataset(), {
        payloadJson: '{"value":1}',
        revision: 1,
      });
      assert.deepEqual(database.saveDataset('{"value":3}', 1), { saved: true, revision: 2 });
      assert.equal(database.loadDataset()?.payloadJson, '{"value":3}');
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
