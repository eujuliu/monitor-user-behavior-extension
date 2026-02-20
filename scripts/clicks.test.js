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

describe("MOUSE EVENTS", () => {
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
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  it("should send click coordinates in message data", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clickX = 250;
    const clickY = 150;

    await page.mouse.click(clickX, clickY);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();
    expect(messages.length).toBeGreaterThan(0);

    const clickMessage = messages.find((m) => m.id === "CLICK");

    expect(clickMessage).toBeDefined();
    expect(clickMessage.data).toBeDefined();
    expect(clickMessage.data.x).toBe(clickX);
    expect(clickMessage.data.y).toBe(clickY);
    expect(clickMessage.data.page).toBeDefined();
    expect(clickMessage.data.timestamp).toBeDefined();
    expect(clickMessage.data.id).toBeDefined();
  });

  it("should send mousedown and mouseup coordinates in message data after click", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clickX = 100;
    const clickY = 200;

    await page.mouse.click(clickX, clickY);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const mousedownMessage = messages.find((m) => m.id === "MOUSEDOWN");
    const mouseupMessage = messages.find((m) => m.id === "MOUSEUP");
    const clickMessage = messages.find((m) => m.id === "CLICK");

    expect(clickMessage).toBeDefined();
    expect(mousedownMessage).toBeDefined();
    expect(mouseupMessage).toBeDefined();

    expect(mousedownMessage.data.x).toBe(clickX);
    expect(mousedownMessage.data.y).toBe(clickY);
    expect(mouseupMessage.data.x).toBe(clickX);
    expect(mouseupMessage.data.y).toBe(clickY);

    expect(clickMessage.data.id).toBe(mousedownMessage.data.id);
    expect(clickMessage.data.id).toBe(mouseupMessage.data.id);
  });

  it("should have the same id for click, mousedown and mouseup", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clickX = 250;
    const clickY = 150;

    await page.mouse.click(clickX, clickY);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const clickMessage = messages.find((m) => m.id === "CLICK");
    const mousedownMessage = messages.find((m) => m.id === "MOUSEDOWN");
    const mouseupMessage = messages.find((m) => m.id === "MOUSEUP");

    expect(clickMessage).toBeDefined();
    expect(mousedownMessage).toBeDefined();
    expect(mouseupMessage).toBeDefined();

    expect(clickMessage.data.id).toBe(mousedownMessage.data.id);
    expect(clickMessage.data.id).toBe(mouseupMessage.data.id);
    expect(mousedownMessage.data.id).toBe(mouseupMessage.data.id);
  });

  it("should have ordered timestamps for click, mousedown and mouseup", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const clickX = 250;
    const clickY = 150;

    await page.mouse.click(clickX, clickY);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const clickMessage = messages.find((m) => m.id === "CLICK");
    const mousedownMessage = messages.find((m) => m.id === "MOUSEDOWN");
    const mouseupMessage = messages.find((m) => m.id === "MOUSEUP");

    expect(mousedownMessage.data.timestamp).toBeLessThanOrEqual(
      mouseupMessage.data.timestamp,
    );
    expect(mouseupMessage.data.timestamp).toBeLessThanOrEqual(
      clickMessage.data.timestamp,
    );
  });
});
