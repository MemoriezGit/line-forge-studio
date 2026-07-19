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

  await page.screenshot({
    path: testInfo.outputPath("desktop-clean-start.png"),
    fullPage: false,
  });

  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("pointer placement, selection, duplicate, export, persistence, and keyboard delete", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openClean(page);

  const palette = page.locator(".palette-item").first();
  const canvas = page.locator("#canvas");
  const paletteBox = await palette.boundingBox();
  const canvasBox = await canvas.boundingBox();

  expect(paletteBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move(
    paletteBox.x + paletteBox.width / 2,
    paletteBox.y + paletteBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 240, canvasBox.y + 220, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator(".canvas-item")).toHaveCount(1);
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

  await page.screenshot({
    path: testInfo.outputPath("desktop-persisted-layout.png"),
    fullPage: false,
  });

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

  await page.screenshot({
    path: testInfo.outputPath("constrained-900x800.png"),
    fullPage: false,
  });

  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});
