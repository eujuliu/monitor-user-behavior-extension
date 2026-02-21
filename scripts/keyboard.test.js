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

describe("KEYBOARD EVENTS", () => {
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

  it("should send KEYDOWN message on key press in input", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#input1-1");
    await page.keyboard.press("a");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const keydownMessage = messages.find((m) => m.id === "KEYDOWN");

    expect(keydownMessage).toBeDefined();
    expect(keydownMessage.data.page).toBeDefined();
    expect(keydownMessage.data.timestamp).toBeDefined();
    expect(keydownMessage.data.id).toBeDefined();
    expect(keydownMessage.data.type_speed).toBe(0);
  });

  it("should send KEYUP message on key release", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#input1-1");
    await page.keyboard.press("a");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const keyupMessage = messages.find((m) => m.id === "KEYUP");

    expect(keyupMessage).toBeDefined();
    expect(keyupMessage.data.page).toBeDefined();
    expect(keyupMessage.data.timestamp).toBeDefined();
    expect(keyupMessage.data.id).toBeDefined();
    expect(keyupMessage.data.type_speed).toBeDefined();
    expect(keyupMessage.data.type_speed).toBeGreaterThanOrEqual(0);
  });

  it("should have same id for KEYDOWN and KEYUP", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#input1-1");
    await page.keyboard.press("a");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const keydownMessage = messages.find((m) => m.id === "KEYDOWN");
    const keyupMessage = messages.find((m) => m.id === "KEYUP");

    expect(keydownMessage).toBeDefined();
    expect(keyupMessage).toBeDefined();
    expect(keydownMessage.data.id).toBe(keyupMessage.data.id);
  });

  it("should send ELEMENT message when typing in input", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#input1-1");
    await page.keyboard.press("a");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const elementMessage = messages.find(
      (m) => m.id === "ELEMENT" && m.data.event === "KEYPRESS",
    );

    expect(elementMessage).toBeDefined();
    expect(elementMessage.data.tag).toBe("input");
    expect(elementMessage.data.event).toBe("KEYPRESS");
    expect(elementMessage.data.eventId).toBeDefined();
  });

  it("should send ELEMENT message when typing in textarea", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#textarea1-1");
    await page.keyboard.press("a");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const elementMessage = messages.find(
      (m) => m.id === "ELEMENT" && m.data.event === "KEYPRESS",
    );

    expect(elementMessage).toBeDefined();
    expect(elementMessage.data.tag).toBe("textarea");
    expect(elementMessage.data.event).toBe("KEYPRESS");
  });

  it("should NOT send keyboard events when not focused on input element", async () => {
    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("h1");
    await page.keyboard.press("a");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();

    const keydownMessage = messages.find((m) => m.id === "KEYDOWN");
    const elementMessage = messages.find(
      (m) => m.id === "ELEMENT" && m.data.event === "KEYPRESS",
    );

    expect(keydownMessage).toBeUndefined();
    expect(elementMessage).toBeUndefined();
  });
});
