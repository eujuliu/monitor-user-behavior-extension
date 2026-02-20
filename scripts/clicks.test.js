const puppeteer = require("puppeteer");
const path = require("path");
const http = require("http");
const fs = require("fs");
const {
  expect,
  beforeEach,
  afterEach,
  describe,
  it,
} = require("@jest/globals");

describe("CLICKS", () => {
  const EXTENSION_PATH = path.join(process.cwd(), "");

  let browser;
  let page;
  let worker;
  let server;
  let serverUrl;

  beforeEach(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }

      const filePath = path.join(
        process.cwd(),
        req.url === "/" ? "/test/test.html" : req.url,
      );

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath);
      const contentType = ext === ".html" ? "text/html" : "text/plain";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    });

    await new Promise((resolve) => server.listen(0, resolve));
    serverUrl = `http://localhost:${server.address().port}`;

    browser = await puppeteer.launch({
      pipe: true,
      enableExtensions: [EXTENSION_PATH],
    });
  });

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.close();
    }
    browser = undefined;
    page = undefined;
    worker = undefined;
    server = undefined;
  });

  it("should send click coordinates in message data", async () => {
    const backgroundTarget = await browser.waitForTarget(
      (target) =>
        target.type() === "service_worker" &&
        target.url().endsWith("background.js"),
    );

    if (!backgroundTarget) {
      throw new Error("Extension service worker not found");
    }

    worker = await backgroundTarget.worker();

    await worker.evaluate(() => {
      self.messages = [];

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        self.messages.push(message);
      });
    });

    page = await browser.newPage();

    await page.goto(serverUrl, { waitUntil: "load" });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const clickX = 250;
    const clickY = 150;

    await page.mouse.click(clickX, clickY);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const messages = await worker.evaluate(() => self.messages);

    expect(messages).toBeDefined();
    expect(messages.length).toBeGreaterThan(0);

    const clickMessage = messages.find((m) => m.id === "CLICK");

    expect(clickMessage).toBeDefined();
    expect(clickMessage.data).toBeDefined();
    expect(clickMessage.data.x).toBe(clickX);
    expect(clickMessage.data.y).toBe(clickY);
  }, 30000);
});
