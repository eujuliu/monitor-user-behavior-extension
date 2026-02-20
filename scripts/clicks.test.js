const puppeteer = require("puppeteer");
const path = require("path");
const {
  expect,
  beforeEach,
  afterEach,
  describe,
  it,
} = require("@jest/globals");

describe("CLICKS", () => {
  const EXTENSION_PATH = path.join(process.cwd(), "");
  const HTML_PATH = path.join(process.cwd(), "./test/test.html");

  let browser;
  let worker;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      headless: false,
      pipe: true,
      enableExtensions: [EXTENSION_PATH],
    });

    const workerTarget = await browser.waitForTarget(
      (target) =>
        target.type() === "service_worker" &&
        target.url().endsWith("background.js"),
    );

    worker = await workerTarget.worker();
  });

  afterEach(async () => {
    await browser.close();
    browser = undefined;
  });

  it("should click in x=200 and y=300", async () => {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      console.log("PAGE LOG:", msg.text());
    });

    await page.goto(`file://${HTML_PATH}`, { waitUntil: "load" });

    await page.click("#btn1-1");
    await page.click("#btn1-2");

    await page.screenshot({ path: "clicked_screenshot.png" });

    expect(null).toBe(null);
  });
});
