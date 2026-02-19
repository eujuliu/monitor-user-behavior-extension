const puppeteer = require("puppeteer");

const EXTENSION_PATH = ".";

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

test("popup renders correctly", async () => {
  const page = await browser.newPage();
  await page.goto("https://example.com");

  await worker.evaluate("chrome.action.openPopup();");

  const popupTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "page" && target.url().endsWith("popup/index.html"),
  );

  const popup = await popupTarget.asPage();

  const h1Text = await popup.$eval("h1", (el) => el.textContent.trim());

  expect(h1Text).toBe("Hello World");
});
