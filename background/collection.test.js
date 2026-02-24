const puppeteer = require("puppeteer");
const path = require("path");
const {
  expect,
  beforeEach,
  afterEach,
  describe,
  it,
} = require("@jest/globals");

describe("COLLECTION MODE", () => {
  const EXTENSION_PATH = path.join(process.cwd(), "");

  let browser;
  let popupPage;
  let worker;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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

    if (!popupTarget) {
      throw new Error(
        "Popup not found. Available targets: " +
          targets
            .map((t) => t.type() + ":" + t.url().substring(0, 50))
            .join(", "),
      );
    }

    popupPage = await popupTarget.asPage();
  }, 30000);

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
    browser = undefined;
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

  async function getCollectionList() {
    const items = await popupPage.$$eval(
      ".popup__collection-item-pattern",
      (els) => els.map((el) => el.textContent),
    );
    return items;
  }

  it("should add URL to collection list via popup input", async () => {
    await addUrlToCollection("youtube.com");
    const items = await getCollectionList();
    expect(items).toContain("youtube.com");
  });

  it("should add multiple URLs to collection list", async () => {
    await addUrlToCollection("youtube.com");
    await addUrlToCollection("google.com");
    const items = await getCollectionList();
    expect(items).toContain("youtube.com");
    expect(items).toContain("google.com");
  });

  it("should switch between inverted and not-inverted tabs", async () => {
    await switchToTab("inverted");
    let activeTab = await popupPage.$eval(
      '.popup__collection-tab[data-collection="inverted"]',
      (el) => el.classList.contains("popup__collection-tab--active"),
    );
    expect(activeTab).toBe(true);

    await switchToTab("not-inverted");
    activeTab = await popupPage.$eval(
      '.popup__collection-tab[data-collection="not-inverted"]',
      (el) => el.classList.contains("popup__collection-tab--active"),
    );
    expect(activeTab).toBe(true);
  });

  it("should save collection mode to storage when switching tabs", async () => {
    await switchToTab("inverted");

    const mode = await worker.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(["collectionMode"], (result) => {
          resolve(result.collectionMode);
        });
      });
    });
    expect(mode).toBe("inverted");

    await switchToTab("not-inverted");

    const mode2 = await worker.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(["collectionMode"], (result) => {
          resolve(result.collectionMode);
        });
      });
    });
    expect(mode2).toBe("not-inverted");
  });

  it("should save URL to storage when adding via popup", async () => {
    await addUrlToCollection("youtube.com");

    const list = await worker.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(["collectionList"], (result) => {
          resolve(result.collectionList);
        });
      });
    });
    expect(list).toContain("youtube.com");
  });

  it("should delete URL from collection list", async () => {
    await addUrlToCollection("youtube.com");

    await popupPage.click(".popup__collection-item-delete");

    const items = await getCollectionList();
    expect(items).not.toContain("youtube.com");
  });

  it("should preserve list when switching between modes", async () => {
    await addUrlToCollection("youtube.com");
    await switchToTab("not-inverted");
    await switchToTab("inverted");

    const items = await getCollectionList();
    expect(items).toContain("youtube.com");
  });

  it("should collect page when in inverted mode and page is in list", async () => {
    await switchToTab("inverted");
    await addUrlToCollection("example.com");

    const result = await worker.evaluate(async () => {
      const storage = await new Promise((resolve) => {
        chrome.storage.local.get(["collectionList", "collectionMode"], resolve);
      });

      const list = storage.collectionList || [];
      const mode = storage.collectionMode || "inverted";
      const pageId = "example.com";

      if (list.length === 0) return true;

      const matchesList = list.some((pattern) => pageId.includes(pattern));

      if (mode === "inverted") {
        return matchesList;
      } else {
        return !matchesList;
      }
    });

    expect(result).toBe(true);
  }, 10000);

  it("should NOT collect page when in inverted mode and page is NOT in list", async () => {
    await switchToTab("inverted");
    await addUrlToCollection("youtube.com");

    const result = await worker.evaluate(async () => {
      const storage = await new Promise((resolve) => {
        chrome.storage.local.get(["collectionList", "collectionMode"], resolve);
      });

      const list = storage.collectionList || [];
      const mode = storage.collectionMode || "inverted";
      const pageId = "google.com";

      if (list.length === 0) return true;

      const matchesList = list.some((pattern) => pageId.includes(pattern));

      if (mode === "inverted") {
        return matchesList;
      } else {
        return !matchesList;
      }
    });

    expect(result).toBe(false);
  }, 10000);

  it("should collect page when in not-inverted mode and page is NOT in list", async () => {
    await switchToTab("not-inverted");
    await addUrlToCollection("youtube.com");

    const result = await worker.evaluate(async () => {
      const storage = await new Promise((resolve) => {
        chrome.storage.local.get(["collectionList", "collectionMode"], resolve);
      });

      const list = storage.collectionList || [];
      const mode = storage.collectionMode || "inverted";
      const pageId = "google.com";

      if (list.length === 0) return true;

      const matchesList = list.some((pattern) => pageId.includes(pattern));

      if (mode === "inverted") {
        return matchesList;
      } else {
        return !matchesList;
      }
    });

    expect(result).toBe(true);
  }, 10000);

  it("should NOT collect page when in not-inverted mode and page IS in list", async () => {
    await switchToTab("not-inverted");
    await addUrlToCollection("youtube.com");

    const result = await worker.evaluate(async () => {
      const storage = await new Promise((resolve) => {
        chrome.storage.local.get(["collectionList", "collectionMode"], resolve);
      });

      const list = storage.collectionList || [];
      const mode = storage.collectionMode || "inverted";
      const pageId = "youtube.com";

      if (list.length === 0) return true;

      const matchesList = list.some((pattern) => pageId.includes(pattern));

      if (mode === "inverted") {
        return matchesList;
      } else {
        return !matchesList;
      }
    });

    expect(result).toBe(false);
  }, 10000);
});

