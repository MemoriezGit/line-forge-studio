import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const HOST = "127.0.0.1";
const PORT = 4173;
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

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  return errors;
}

async function settleRenders(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function openClean(page) {
  await page.goto(APP_URL, { waitUntil: "load" });
  await expect(page.locator(".palette-item")).toHaveCount(9);
  await expect(page.locator("#canvas")).toBeVisible();
}

async function placeFirstPaletteItem(page, canvasOffset = { x: 240, y: 220 }) {
  const palette = page.locator(".palette-item").first();
  const canvas = page.locator("#canvas");
  const paletteBox = await palette.boundingBox();
  const canvasBox = await canvas.boundingBox();

  expect(paletteBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasOffset.x, canvasBox.y + canvasOffset.y, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator(".canvas-item")).toHaveCount(1);
}

test("clean startup, accessibility surface, and built-in self-tests", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);

  await expect(page).toHaveTitle("Station Layout Builder");
  await expect(page.getByRole("application", { name: "Station layout canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Snap to Grid" })).toHaveAttribute("aria-pressed", "true");

  const results = await page.evaluate(() => selftest_run());
  const failures = results.filter((result) => !result.pass);
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  await settleRenders(page);

  const saveButton = page.getByRole("button", { name: "Save" });
  const loadButton = page.getByRole("button", { name: "Load" });
  await saveButton.focus();
  await expect(saveButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(loadButton).toBeFocused();

  await page.screenshot({ path: testInfo.outputPath("desktop-clean-start.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("pointer placement, selection, duplicate, export, persistence, and keyboard delete", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);
  await placeFirstPaletteItem(page);

  await page.locator(".canvas-item").first().click();
  await expect(page.locator("#selectedEditor #editName")).toBeVisible();

  const duplicateButton = page.getByRole("button", { name: "Duplicate" });
  await duplicateButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".canvas-item")).toHaveCount(2);

  await page.getByRole("button", { name: "Export JSON" }).click();
  const jsonBox = page.locator("#jsonBox");
  await expect(jsonBox).not.toHaveValue("");
  const exported = await jsonBox.inputValue();
  const parsed = JSON.parse(exported);
  expect(parsed.items).toHaveLength(2);

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".canvas-item")).toHaveCount(2);

  await page.locator(".canvas-item").last().click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".canvas-item")).toHaveCount(1);
  await expect(page.locator("#canvas")).toBeFocused();

  await page.screenshot({ path: testInfo.outputPath("desktop-persisted-layout.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("duplicate creates a distinct selected copy, commits once, and survives reload", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);
  await placeFirstPaletteItem(page, { x: 300, y: 280 });
  await page.locator(".canvas-item").first().click();

  const before = await page.evaluate(() => {
    const item = STATE.items[0];
    return { item: JSON.parse(JSON.stringify(item)), revision: STATE.revision };
  });

  const duplicateButton = page.getByRole("button", { name: "Duplicate" });
  await duplicateButton.focus();
  await page.keyboard.press("Enter");
  await settleRenders(page);

  const duplicated = await page.evaluate(() => ({
    items: JSON.parse(JSON.stringify(STATE.items)),
    selectedId: STATE.selectedId,
    revision: STATE.revision,
    status: STATE.status,
  }));

  expect(duplicated.items).toHaveLength(2);
  const copy = duplicated.items[1];
  expect(copy.id).not.toBe(before.item.id);
  expect(copy.sourceId).toBe(before.item.sourceId);
  expect(copy.name).toBe(`${before.item.name} Copy`);
  expect(copy.w).toBe(before.item.w);
  expect(copy.h).toBe(before.item.h);
  expect(copy.x).toBeGreaterThanOrEqual(before.item.x);
  expect(copy.y).toBeGreaterThanOrEqual(before.item.y);
  expect(duplicated.selectedId).toBe(copy.id);
  expect(duplicated.revision).toBe(before.revision + 1);
  expect(duplicated.status).toContain("Duplicated");

  await page.reload({ waitUntil: "load" });
  const restored = await page.evaluate((copyId) => {
    const item = STATE.items.find((candidate) => candidate.id === copyId);
    return { item: item ? JSON.parse(JSON.stringify(item)) : null, itemCount: STATE.items.length };
  }, copy.id);
  expect(restored.itemCount).toBe(2);
  expect(restored.item).toEqual(copy);

  await page.screenshot({ path: testInfo.outputPath("desktop-duplicated-persisted-item.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("rotate swaps dimensions, commits once, and survives reload", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);
  await placeFirstPaletteItem(page, { x: 260, y: 240 });
  await page.locator(".canvas-item").first().click();

  const before = await page.evaluate(() => {
    const item = STATE.items[0];
    return { id: item.id, w: item.w, h: item.h, rotation: item.rotation, revision: STATE.revision };
  });

  const rotateButton = page.getByRole("button", { name: "Rotate" });
  await rotateButton.focus();
  await page.keyboard.press("Enter");
  await settleRenders(page);

  const rotated = await page.evaluate((id) => {
    const item = STATE.items.find((candidate) => candidate.id === id);
    return { w: item.w, h: item.h, rotation: item.rotation, revision: STATE.revision, status: STATE.status };
  }, before.id);

  expect(rotated.w).toBe(before.h);
  expect(rotated.h).toBe(before.w);
  expect(rotated.rotation).toBe(before.rotation === 90 ? 0 : 90);
  expect(rotated.revision).toBe(before.revision + 1);
  expect(rotated.status).toContain("Rotated");

  await page.reload({ waitUntil: "load" });
  const restored = await page.evaluate((id) => {
    const item = STATE.items.find((candidate) => candidate.id === id);
    return { w: item.w, h: item.h, rotation: item.rotation };
  }, before.id);
  expect(restored).toEqual({ w: rotated.w, h: rotated.h, rotation: rotated.rotation });

  await page.screenshot({ path: testInfo.outputPath("desktop-rotated-persisted-item.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("pointer movement snaps, clamps, commits, and survives reload", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);
  await placeFirstPaletteItem(page, { x: 280, y: 260 });

  const item = page.locator(".canvas-item").first();
  const before = await page.evaluate(() => {
    const current = STATE.items[0];
    return { id: current.id, x: current.x, y: current.y, revision: STATE.revision };
  });
  const itemBox = await item.boundingBox();
  expect(itemBox).not.toBeNull();

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(itemBox.x + itemBox.width / 2 + 53, itemBox.y + itemBox.height / 2 + 37, { steps: 10 });
  await page.mouse.up();
  await settleRenders(page);

  const moved = await page.evaluate((id) => {
    const current = STATE.items.find((candidate) => candidate.id === id);
    return { x: current.x, y: current.y, revision: STATE.revision, status: STATE.status, gridSize: GRID_SIZE };
  }, before.id);

  expect(moved.x).not.toBe(before.x);
  expect(moved.y).not.toBe(before.y);
  expect(moved.x % moved.gridSize).toBe(0);
  expect(moved.y % moved.gridSize).toBe(0);
  expect(moved.revision).toBeGreaterThan(before.revision);
  expect(moved.status).toBe("Moved item");

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".canvas-item")).toHaveCount(1);
  const restored = await page.evaluate((id) => {
    const current = STATE.items.find((candidate) => candidate.id === id);
    return { x: current.x, y: current.y };
  }, before.id);
  expect(restored).toEqual({ x: moved.x, y: moved.y });

  await page.screenshot({ path: testInfo.outputPath("desktop-moved-persisted-item.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("invalid JSON import is contained without replacing the working layout", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);
  await placeFirstPaletteItem(page, { x: 320, y: 300 });

  const before = await page.evaluate(() => ({ items: JSON.parse(JSON.stringify(STATE.items)), selectedId: STATE.selectedId, revision: STATE.revision }));
  const jsonBox = page.locator("#jsonBox");
  await jsonBox.fill('{"schemaVersion":1,"items":[');
  await settleRenders(page);
  await page.getByRole("button", { name: "Import JSON" }).click();
  await settleRenders(page);

  const after = await page.evaluate(() => ({ items: JSON.parse(JSON.stringify(STATE.items)), selectedId: STATE.selectedId, revision: STATE.revision, status: STATE.status }));
  expect(after.items).toEqual(before.items);
  expect(after.selectedId).toBe(before.selectedId);
  expect(after.revision).toBeGreaterThanOrEqual(before.revision);
  expect(after.status).toBe("Could not import JSON.");
  await expect(page.locator(".canvas-item")).toHaveCount(1);

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".canvas-item")).toHaveCount(1);
  const restored = await page.evaluate(() => JSON.parse(JSON.stringify(STATE.items)));
  expect(restored).toEqual(before.items);

  await page.screenshot({ path: testInfo.outputPath("desktop-invalid-import-contained.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("corrupted persisted JSON falls back to a clean usable layout", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);

  const storageKey = await page.evaluate(() => STORAGE_KEY);
  await page.evaluate(({ key }) => { localStorage.setItem(key, '{"schemaVersion":1,"items":['); }, { key: storageKey });
  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".palette-item")).toHaveCount(9);
  await expect(page.locator("#canvas")).toBeVisible();
  await expect(page.locator(".canvas-item")).toHaveCount(0);

  const recovered = await page.evaluate(() => ({ itemCount: STATE.items.length, selectedId: STATE.selectedId, schemaVersion: STATE.schemaVersion, expectedSchemaVersion: SCHEMA_VERSION, revision: STATE.revision }));
  expect(recovered.itemCount).toBe(0);
  expect(recovered.selectedId).toBeNull();
  expect(recovered.schemaVersion).toBe(recovered.expectedSchemaVersion);
  expect(recovered.revision).toBeGreaterThan(0);

  await placeFirstPaletteItem(page, { x: 360, y: 340 });
  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".canvas-item")).toHaveCount(1);

  await page.screenshot({ path: testInfo.outputPath("desktop-corrupt-storage-recovered.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("clear layout requires confirmation and persists only after acceptance", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);
  await placeFirstPaletteItem(page, { x: 400, y: 380 });

  const clearButton = page.getByRole("button", { name: "Clear Layout" });
  page.once("dialog", async (dialog) => { expect(dialog.type()).toBe("confirm"); await dialog.dismiss(); });
  await clearButton.click();
  await expect(page.locator(".canvas-item")).toHaveCount(1);

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".canvas-item")).toHaveCount(1);

  page.once("dialog", async (dialog) => { expect(dialog.type()).toBe("confirm"); await dialog.accept(); });
  await clearButton.click();
  await settleRenders(page);
  await expect(page.locator(".canvas-item")).toHaveCount(0);

  const cleared = await page.evaluate(() => ({ itemCount: STATE.items.length, selectedId: STATE.selectedId, status: STATE.status }));
  expect(cleared.itemCount).toBe(0);
  expect(cleared.selectedId).toBeNull();
  expect(cleared.status).toBe("Cleared layout");

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(".canvas-item")).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath("desktop-clear-confirmed.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("constrained-width layout preserves the palette and canvas", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 900, height: 800 });
  await openClean(page);

  await expect(page.locator("#leftPanel")).toBeVisible();
  await expect(page.locator("#mainPanel")).toBeVisible();
  await expect(page.locator("#canvas")).toBeVisible();
  await expect(page.locator("#rightPanel")).toBeHidden();
  await expect(page.locator(".toolbar-btn-label").first()).toBeHidden();

  await page.screenshot({ path: testInfo.outputPath("constrained-900x800.png"), fullPage: false });
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});
