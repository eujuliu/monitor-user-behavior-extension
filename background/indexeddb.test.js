const puppeteer = require("puppeteer");
const path = require("path");
const {
  expect,
  beforeEach,
  afterEach,
  describe,
  it,
} = require("@jest/globals");
const { getServerUrl } = require("../test/setup");

describe("INDEXEDDB", () => {
  const EXTENSION_PATH = path.join(process.cwd(), "");

  let browser;
  let page;
  let worker;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      pipe: true,
      enableExtensions: [EXTENSION_PATH],
    });

    const backgroundTarget = await browser.waitForTarget(
      (target) =>
        target.type() === "service_worker" &&
        target.url().endsWith("background/index.js"),
    );
    worker = await backgroundTarget.worker();
  });

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
    browser = undefined;
    page = undefined;
    worker = undefined;
  });

  it("should save CLICK event to IndexedDB", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clicks = await worker.evaluate(() => {
      return self.db.getAllEvents("CLICK");
    });

    expect(clicks).toBeDefined();
    expect(Array.isArray(clicks)).toBe(true);
  });

  it("should get event by ID from IndexedDB", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clicks = await worker.evaluate(() => {
      return self.db.getAllEvents("CLICK");
    });

    if (clicks.length > 0) {
      const firstClickId = clicks[0].id;
      const clickById = await worker.evaluate((id) => {
        return self.db.getEventById("CLICK", id);
      }, firstClickId);

      expect(clickById).toBeDefined();
      expect(clickById.id).toBe(firstClickId);
    }
  });

  it("should query events with predicate", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clicks = await worker.evaluate(() => {
      return self.db.queryEvents(
        "CLICK",
        (event) => event.data && event.data.id,
      );
    });

    expect(clicks).toBeDefined();
    expect(Array.isArray(clicks)).toBe(true);
  });

  it("should clear events from IndexedDB", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    await worker.evaluate(() => {
      return self.db.clearEvents("CLICK");
    });

    const clicks = await worker.evaluate(() => {
      return self.db.getAllEvents("CLICK");
    });

    expect(clicks).toBeDefined();
    expect(clicks.length).toBe(0);
  });

  it("should save all event types to IndexedDB", async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await page.click("#input1-1");
    await page.keyboard.type("a");
    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clicks = await worker.evaluate(() => self.db.getAllEvents("CLICK"));
    const mousedowns = await worker.evaluate(() =>
      self.db.getAllEvents("MOUSEDOWN"),
    );
    const keydowns = await worker.evaluate(() =>
      self.db.getAllEvents("KEYDOWN"),
    );
    const scrolls = await worker.evaluate(() => self.db.getAllEvents("SCROLL"));

    expect(clicks.length).toBeGreaterThan(0);
    expect(mousedowns.length).toBeGreaterThan(0);
    expect(keydowns.length).toBeGreaterThan(0);
    expect(scrolls.length).toBeGreaterThan(0);
  });
});
