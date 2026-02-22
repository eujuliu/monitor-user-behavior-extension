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
        target.url().endsWith("background/index.js"),
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

  it("should calculate speed in mouseup", async () => {
    page = await browser.newPage();

    await page.goto(getServerUrl(), { waitUntil: "load" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const clickX = 250;
    const clickY = 150;

    await page.mouse.click(clickX, clickY);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const mouseupMessage = messages.find((m) => m.id === "MOUSEUP");

    expect(mouseupMessage.data.speed).toBeDefined();
    expect(mouseupMessage.data.speed).toBeGreaterThanOrEqual(0);
  });

  it("should send ELEMENT message when clicking on a button", async () => {
    page = await browser.newPage();

    await page.goto(getServerUrl(), { waitUntil: "load" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const elementMessage = messages.find((m) => m.id === "ELEMENT");

    expect(elementMessage).toBeDefined();
    expect(elementMessage.data.tag).toBe("button");
    expect(elementMessage.data.text).toBe("Button 1");
    expect(elementMessage.data.textColor).toBeDefined();
    expect(elementMessage.data.width).toBeGreaterThan(0);
    expect(elementMessage.data.height).toBeGreaterThan(0);
    expect(elementMessage.data.event).toBe("MOUSEPRESS");
    expect(elementMessage.data.eventId).toBeDefined();
  });

  it("should send ELEMENT message when clicking on an input", async () => {
    page = await browser.newPage();

    await page.goto(getServerUrl(), { waitUntil: "load" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#input1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const elementMessage = messages.find((m) => m.id === "ELEMENT");

    expect(elementMessage).toBeDefined();
    expect(elementMessage.data.tag).toBe("input");
    expect(elementMessage.data.event).toBe("MOUSEPRESS");
  });

  it("should send ELEMENT message when clicking on a link", async () => {
    page = await browser.newPage();

    await page.goto(getServerUrl(), { waitUntil: "load" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#link1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const elementMessage = messages.find((m) => m.id === "ELEMENT");

    expect(elementMessage).toBeDefined();
    expect(elementMessage.data.tag).toBe("a");
    expect(elementMessage.data.text).toBe("Link 1");
    expect(elementMessage.data.event).toBe("MOUSEPRESS");
  });

  it("should send ELEMENT message when clicking on a textarea", async () => {
    page = await browser.newPage();

    await page.goto(getServerUrl(), { waitUntil: "load" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#textarea1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const elementMessage = messages.find((m) => m.id === "ELEMENT");

    expect(elementMessage).toBeDefined();
    expect(elementMessage.data.tag).toBe("textarea");
    expect(elementMessage.data.event).toBe("MOUSEPRESS");
  });

  it("should NOT send ELEMENT message when clicking on non-clickable element", async () => {
    page = await browser.newPage();

    await page.goto(getServerUrl(), { waitUntil: "load" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("h1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const elementMessage = messages.find((m) => m.id === "ELEMENT");

    expect(elementMessage).toBeUndefined();
  });
});
