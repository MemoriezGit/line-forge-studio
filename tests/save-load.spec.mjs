import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const HOST = "127.0.0.1";
const PORT = 4174;
const APP_URL = `http://${HOST}:${PORT}`;

let server;
let indexHtml;

test.beforeAll(async () => {
  indexHtml = await readFile("index.html", "utf8");
  server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", APP_URL).pathname;
    if (path === "/" || path === "/index.html") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(indexHtml);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });
});

test.afterAll(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function collectRuntimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

async function settleRenders(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function placeFirstPaletteItem(page) {
  const palette = page.locator(".palette-item").first();
  const canvas = page.locator("#canvas");
  const paletteBox = await palette.boundingBox();
  const canvasBox = await canvas.boundingBox();

  expect(paletteBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 340, canvasBox.y + 320, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".canvas-item")).toHaveCount(1);
}

test("explicit Save and Load restore the exact persisted layout", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(APP_URL, { waitUntil: "load" });
  await expect(page.locator("#canvas")).toBeVisible();
  await placeFirstPaletteItem(page);

  const saveButton = page.getByRole("button", { name: "Save" });
  await saveButton.focus();
  await page.keyboard.press("Enter");
  await settleRenders(page);

  const saved = await page.evaluate(() => ({
    items: JSON.parse(JSON.stringify(STATE.items)),
    selectedId: STATE.selectedId,
    revision: STATE.revision,
    status: STATE.status,
  }));
  expect(saved.items).toHaveLength(1);
  expect(saved.status).toContain("Saved");

  await page.evaluate(() => {
    STATE.items[0].name = "Unsaved transient edit";
    STATE.items[0].x += 137;
    STATE.items[0].y += 91;
    STATE.status = "Unsaved transient state";
    render_schedule();
  });
  await settleRenders(page);
  await expect(page.getByRole("application", { name: "Station layout canvas" })).toContainText("Unsaved transient edit");

  const loadButton = page.getByRole("button", { name: "Load" });
  await loadButton.focus();
  await page.keyboard.press("Enter");
  await settleRenders(page);

  const loaded = await page.evaluate(() => ({
    items: JSON.parse(JSON.stringify(STATE.items)),
    selectedId: STATE.selectedId,
    revision: STATE.revision,
    status: STATE.status,
  }));
  expect(loaded.items).toEqual(saved.items);
  expect(loaded.selectedId).toBeNull();
  expect(loaded.revision).toBeGreaterThan(saved.revision);
  expect(loaded.status).toContain("Loaded");

  await page.reload({ waitUntil: "load" });
  const restored = await page.evaluate(() => ({
    items: JSON.parse(JSON.stringify(STATE.items)),
    selectedId: STATE.selectedId,
  }));
  expect(restored.items).toEqual(saved.items);
  expect(restored.selectedId).toBeNull();

  await page.screenshot({ path: testInfo.outputPath("desktop-explicit-save-load-restored.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});
