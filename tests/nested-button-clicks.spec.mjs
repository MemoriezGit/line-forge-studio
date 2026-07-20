import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const HOST = "127.0.0.1";
const PORT = 4174;
const APP_URL = `http://${HOST}:${PORT}`;
const DEFECT_REASON = "Issue #2: handle_click dispatches from event.target.id instead of the closest owning button.";

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

async function settleRenders(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function placeFirstPaletteItem(page) {
  await page.goto(APP_URL, { waitUntil: "load" });

  const palette = page.locator(".palette-item").first();
  const canvas = page.locator("#canvas");
  const paletteBox = await palette.boundingBox();
  const canvasBox = await canvas.boundingBox();

  expect(paletteBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 280, canvasBox.y + 240, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".canvas-item")).toHaveCount(1);
  await page.locator(".canvas-item").first().click();
  await settleRenders(page);
}

test("nested SVG click activates the owning Rotate button", async ({ page }) => {
  test.fail(true, DEFECT_REASON);

  await placeFirstPaletteItem(page);

  const before = await page.evaluate(() => {
    const item = STATE.items[0];
    return { w: item.w, h: item.h, rotation: item.rotation, revision: STATE.revision };
  });

  await page.locator("#rotateBtn svg").click({ position: { x: 2, y: 2 } });
  await settleRenders(page);

  const after = await page.evaluate(() => {
    const item = STATE.items[0];
    return { w: item.w, h: item.h, rotation: item.rotation, revision: STATE.revision, status: STATE.status };
  });

  expect(after.w).toBe(before.h);
  expect(after.h).toBe(before.w);
  expect(after.rotation).toBe(before.rotation === 90 ? 0 : 90);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.status).toContain("Rotated");
});

test("nested label click activates the owning Duplicate button", async ({ page }) => {
  test.fail(true, DEFECT_REASON);

  await placeFirstPaletteItem(page);
  const before = await page.evaluate(() => ({ count: STATE.items.length, revision: STATE.revision }));

  await page.locator("#duplicateBtn span").last().click();
  await settleRenders(page);

  const after = await page.evaluate(() => ({
    count: STATE.items.length,
    revision: STATE.revision,
    selectedId: STATE.selectedId,
    lastId: STATE.items.at(-1)?.id,
    status: STATE.status,
  }));

  expect(after.count).toBe(before.count + 1);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.selectedId).toBe(after.lastId);
  expect(after.status).toContain("Duplicated");
});

test("nested label click activates the owning Delete button", async ({ page }) => {
  test.fail(true, DEFECT_REASON);

  await placeFirstPaletteItem(page);
  const beforeRevision = await page.evaluate(() => STATE.revision);

  await page.locator("#deleteBtn span").last().click();
  await settleRenders(page);

  const after = await page.evaluate(() => ({
    count: STATE.items.length,
    revision: STATE.revision,
    selectedId: STATE.selectedId,
    status: STATE.status,
  }));

  expect(after.count).toBe(0);
  expect(after.revision).toBe(beforeRevision + 1);
  expect(after.selectedId).toBeNull();
  expect(after.status).toContain("Deleted");
});
