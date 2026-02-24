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

describe("COLLECTION MODE CONTENT", () => {
  const EXTENSION_PATH = path.join(process.cwd(), "");

  let browser;
  let page;
  let popupPage;
  let worker;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      pipe: true,
      enableExtensions: [EXTENSION_PATH],
    });

    const workerTarget = await browser.waitForTarget(
      (target) =>
        target.type() === "service_worker" &&
        target.url().endsWith("background/index.js"),
    );
    worker = await workerTarget.worker();

    await worker.evaluate(() => {
      chrome.storage.local.clear();
    });

    await worker.evaluate("chrome.action.openPopup();");
    await new Promise((r) => setTimeout(r, 1000));

    const targets = browser.targets();
    const popupTarget = targets.find(
      (t) => t.type() === "page" && t.url().includes("popup"),
    );
    popupPage = await popupTarget.asPage();

    await worker.evaluate(() => {
      self.messages = [];
      chrome.runtime.onMessage.addListener((message) => {
        self.messages.push(message);
      });
    });
  }, 30000);

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
    browser = undefined;
    page = undefined;
    popupPage = undefined;
    worker = undefined;
  });

  async function addUrlToCollection(url) {
    await popupPage.type("#collectionInput", url);
    await popupPage.click("#addCollectionBtn");
    await new Promise((r) => setTimeout(r, 300));
  }

  async function switchToTab(tabName) {
    const selector = `.popup__collection-tab[data-collection="${tabName}"]`;
    await popupPage.click(selector);
    await new Promise((r) => setTimeout(r, 300));
  }

  async function closePopup() {
    await popupPage.close();
  }

  it("should capture clicks when page is in inverted list", async () => {
    await switchToTab("inverted");
    await addUrlToCollection("localhost");
    await closePopup();

    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);
    const clickMessage = messages.find((m) => m.id === "CLICK");

    expect(clickMessage).toBeDefined();
  });

  it("should NOT capture clicks when page is NOT in inverted list", async () => {
    await switchToTab("inverted");
    await addUrlToCollection("youtube.com");
    await closePopup();

    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);
    const clickMessage = messages.find((m) => m.id === "CLICK");

    expect(clickMessage).toBeUndefined();
  });

  it("should capture clicks when page is NOT in not-inverted list", async () => {
    await switchToTab("not-inverted");
    await addUrlToCollection("youtube.com");
    await closePopup();

    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);
    const clickMessage = messages.find((m) => m.id === "CLICK");

    expect(clickMessage).toBeDefined();
  });

  it("should NOT capture clicks when page IS in not-inverted list", async () => {
    await switchToTab("not-inverted");
    await addUrlToCollection("localhost");
    await closePopup();

    page = await browser.newPage();
    await page.goto(getServerUrl(), { waitUntil: "load" });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.click("#btn1-1");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const messages = await worker.evaluate(() => self.messages);
    const clickMessage = messages.find((m) => m.id === "CLICK");

    expect(clickMessage).toBeUndefined();
  });
});
