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

describe("EXPORT", () => {
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

  it("should have exportToJson function available", async () => {
    const hasExport = await worker.evaluate(() => {
      return typeof self.db.exportToJson === "function";
    });

    expect(hasExport).toBe(true);
  });

  it("should have scheduleWeeklyExport function available", async () => {
    const hasSchedule = await worker.evaluate(() => {
      return typeof self.db.scheduleWeeklyExport === "function";
    });

    expect(hasSchedule).toBe(true);
  });

  it("should export events with correct structure", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const exportData = await worker.evaluate(() => {
      const startDate = Date.now() - 86400000;
      const endDate = Date.now();
      const events = {};
      
      return self.db.getAllEvents("CLICK").then(clicks => {
        const filtered = clicks.filter(e => e.createdAt >= startDate && e.createdAt <= endDate);
        events.clicks = filtered;
        return events;
      });
    });

    expect(exportData).toBeDefined();
    expect(exportData.clicks).toBeDefined();
    expect(Array.isArray(exportData.clicks)).toBe(true);
  });
});
