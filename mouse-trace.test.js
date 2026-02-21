const puppeteer = require("puppeteer");
const path = require("path");
const {
  expect,
  beforeEach,
  afterEach,
  describe,
  it,
} = require("@jest/globals");
const { getServerUrl } = require("./test/setup");

describe("MOUSE TRACE EVENTS", () => {
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

  it("should send MOUSE_TRACE message after mouse movement", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);
    await page.mouse.move(300, 300);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const traceMessage = messages.find((m) => m.id === "MOUSE_TRACE");

    expect(traceMessage).toBeDefined();
    expect(traceMessage.data.page).toBeDefined();
    expect(traceMessage.data.timestamp).toBeDefined();
    expect(traceMessage.data.start_time).toBeDefined();
    expect(traceMessage.data.end_time).toBeDefined();
    expect(traceMessage.data.id).toBeDefined();
    expect(traceMessage.data.points).toBeDefined();
    expect(traceMessage.data.points.length).toBeGreaterThan(0);
    expect(traceMessage.data.avg_speed).toBeDefined();
  });

  it("should have correct points structure in MOUSE_TRACE", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.mouse.move(100, 100);
    await page.mouse.move(150, 150);
    await page.mouse.move(200, 200);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const traceMessage = messages.find((m) => m.id === "MOUSE_TRACE");

    expect(traceMessage).toBeDefined();
    expect(traceMessage.data.points[0]).toHaveProperty("x");
    expect(traceMessage.data.points[0]).toHaveProperty("y");
    expect(traceMessage.data.points[0]).toHaveProperty("speed");
  });
});
