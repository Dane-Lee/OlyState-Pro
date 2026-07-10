const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { setTimeout: wait } = require("node:timers/promises");
const { chromium } = require("playwright");

const port = 5174;
const url = `http://127.0.0.1:${port}/`;
const serverCommand = process.platform === "win32" ? "cmd.exe" : "npm";
const serverArgs = process.platform === "win32" ? ["/c", "npm", "run", "dev", "--", "--port", String(port)] : ["run", "dev", "--", "--port", String(port)];
const server = spawn(serverCommand, serverArgs, {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"]
});

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await wait(300);
    }
  }
  throw new Error("Timed out waiting for dev server");
}

function stopServer() {
  if (server.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

(async () => {
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });

    await page.getByRole("button", { name: "New blank plan" }).click();
    const planEditor = page.locator(".editor-surface.planned");
    await planEditor.getByLabel("Title").fill("E2E heavy classic plan");
    await planEditor.locator(".component-row.planned").first().locator("input").first().fill("Power snatch");
    await planEditor.getByRole("button", { name: "Save plan" }).click();
    await expectVisible(page, "E2E heavy classic plan");

    await page.getByRole("button", { name: "Apply adjustments" }).click();
    await expectVisible(page, "Applied Adjustments");

    await page.getByRole("button", { name: "Convert to actual" }).click();
    const storedAfterConvert = await page.evaluate(() => JSON.parse(localStorage.getItem("olystate-pro:data:v1")));
    assert.equal(storedAfterConvert.sessions.some((session) => session.plannedSessionId), true);

    await page.reload({ waitUntil: "networkidle" });
    await expectVisible(page, "Adjusted E2E heavy classic plan");
    assert.deepEqual(consoleErrors, []);
    console.log("planned-session-flow-ok");
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})()
  .then(() => process.exit(0))
  .catch((error) => {
    stopServer();
    console.error(error);
    process.exit(1);
  });

async function expectVisible(page, text) {
  const locator = page.getByText(text).first();
  await locator.waitFor({ state: "visible", timeout: 10_000 });
}
