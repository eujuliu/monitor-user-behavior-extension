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

describe("SCROLL EVENTS", () => {
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
        target.url().endsWith("background.js"),
    );
    worker = await backgroundTarget.worker();

    await worker.evaluate(() => {
      self.messages = [];
      chrome.runtime.onMessage.addListener((message) => {
        self.messages.push(message);
      });
    });
  });

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
    browser = undefined;
    page = undefined;
    worker = undefined;
  });

  it("should send SCROLL message after scrolling", async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const scrollMessage = messages.find((m) => m.id === "SCROLL");

    expect(scrollMessage).toBeDefined();
    expect(scrollMessage.data.page).toBeDefined();
    expect(scrollMessage.data.timestamp).toBeDefined();
    expect(scrollMessage.data.start_time).toBeDefined();
    expect(scrollMessage.data.end_time).toBeDefined();
    expect(scrollMessage.data.id).toBeDefined();
    expect(scrollMessage.data.distance).toBeDefined();
    expect(scrollMessage.data.direction).toBeDefined();
  });

  it("should have correct direction for scroll down", async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const scrollMessage = messages.find((m) => m.id === "SCROLL");

    expect(scrollMessage).toBeDefined();
    expect(scrollMessage.data.direction).toMatch(/up|down/);
  });

  it("should have correct direction for scroll up", async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise((resolve) => setTimeout(resolve, 300));

    await page.evaluate(() => window.scrollTo(0, 100));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const scrollMessages = messages.filter((m) => m.id === "SCROLL");
    expect(scrollMessages.length).toBeGreaterThan(0);

    const lastScroll = scrollMessages[scrollMessages.length - 1];
    expect(lastScroll.data.direction).toBe("up");
  });
});
