document.addEventListener("DOMContentLoaded", async () => {
  const enableToggle = document.getElementById("enableToggle");
  const tabBtns = document.querySelectorAll(".popup__tab-btn");
  const pageSelector = document.querySelector(".popup__page-selector");
  const pageSelect = document.getElementById("pageSelect");
  const collectionTabs = document.querySelectorAll(".popup__collection-tab");
  const collectionInput = document.getElementById("collectionInput");
  const addCollectionBtn = document.getElementById("addCollectionBtn");
  const collectionItems = document.getElementById("collectionItems");
  const collectionError = document.getElementById("collectionError");

  let currentTab = "all";
  let isEnabled = true;
  let collectionMode = "inverted";
  let collectionList = [];

  collectionTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      collectionTabs.forEach((t) =>
        t.classList.remove("popup__collection-tab--active"),
      );

      tab.classList.add("popup__collection-tab--active");

      collectionMode = tab.dataset.collection;

      saveCollectionList();
      renderCollectionItems();
    });
  });

  function validateAndSanitize(input) {
    const url = input.trim().toLowerCase();

    if (!url) {
      return { valid: false, error: "Enter a domain (e.g., youtube.com)" };
    }

    let domain = url;
    let path = "";

    if (url.includes("://")) {
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname;
        path = urlObj.pathname + urlObj.search;
      } catch (e) {
        return { valid: false, error: "Invalid URL format" };
      }
    } else if (url.includes("/") || url.includes("?")) {
      const firstSlash = url.indexOf("/");
      const firstQuestion = url.indexOf("?");
      const splitPoint = firstQuestion === -1 ? url.length : firstQuestion;
      const firstPart = url.substring(0, splitPoint);

      if (
        firstSlash !== -1 &&
        (firstQuestion === -1 || firstSlash < firstQuestion)
      ) {
        domain = url.substring(0, firstSlash);
        path = url.substring(firstSlash);
      } else {
        domain = firstPart;
        path = "";
      }
    }

    if (domain.startsWith("www.")) {
      domain = domain.slice(4);
    }

    if (domain.startsWith(".") || domain.endsWith(".")) {
      return { valid: false, error: "Domain cannot start or end with a dot" };
    }

    if (
      !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9.-]*[a-z0-9])?)+$/.test(
        domain,
      )
    ) {
      return {
        valid: false,
        error: "Invalid domain format. Use: example.com, sub.example.com",
      };
    }

    if (domain.includes("..")) {
      return { valid: false, error: "Domain cannot have consecutive dots" };
    }

    const result = domain + path;
    return { valid: true, value: result };
  }

  function showError(message) {
    collectionError.textContent = message;
    collectionError.style.display = "block";
  }

  function hideError() {
    collectionError.textContent = "";
    collectionError.style.display = "none";
  }

  collectionInput.addEventListener("input", () => {
    const rawInput = collectionInput.value.trim();

    if (!rawInput) {
      hideError();
      return;
    }

    const result = validateAndSanitize(rawInput);

    if (!result.valid) {
      showError(result.error);
    } else {
      hideError();
    }
  });

  addCollectionBtn.addEventListener("click", () => {
    const rawInput = collectionInput.value.trim();
    const result = validateAndSanitize(rawInput);

    if (result.valid && !collectionList.includes(result.value)) {
      collectionList.push(result.value);
      collectionInput.value = "";

      hideError();
      saveCollectionList();
      renderCollectionItems();
    } else if (result.valid && collectionList.includes(result.value)) {
      showError("Domain already in list");
    } else if (!result.valid && rawInput) {
      showError(result.error);
    }
  });

  collectionInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addCollectionBtn.click();
    }
  });

  function renderCollectionItems() {
    collectionItems.innerHTML = "";

    collectionList.forEach((pattern, index) => {
      const div = document.createElement("div");

      div.className = "popup__collection-item";
      div.innerHTML = `
        <span class="popup__collection-item-pattern">${pattern}</span>
        <button class="popup__collection-item-delete" data-index="${index}">&times;</button>
      `;

      const deleteBtn = div.querySelector(".popup__collection-item-delete");

      deleteBtn.addEventListener("click", () => {
        collectionList.splice(index, 1);
        saveCollectionList();
        renderCollectionItems();
      });

      collectionItems.appendChild(div);
    });
  }

  async function saveCollectionList() {
    await chrome.storage.local.set({ collectionList, collectionMode });

    chrome.runtime.sendMessage({ type: "UPDATE_COLLECTION" });
  }

  async function loadCollectionList() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["collectionList", "collectionMode"],
        (result) => {
          resolve({
            list: result.collectionList || [],
            mode: result.collectionMode || "inverted",
          });
        },
      );
    });
  }

  enableToggle.addEventListener("change", async () => {
    isEnabled = enableToggle.checked;
    updateMonitoringState();
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      tabBtns.forEach((b) => b.classList.remove("popup__tab-btn--active"));

      btn.classList.add("popup__tab-btn--active");

      currentTab = btn.dataset.tab;

      if (currentTab === "exactly") {
        pageSelector.classList.add("popup__page-selector--visible");
      } else {
        pageSelector.classList.remove("popup__page-selector--visible");
      }

      savePreferences();
      await displayStats();
    });
  });

  pageSelect.addEventListener("change", async () => {
    savePreferences();
    await displayStats();
  });

  function updateMonitoringState() {
    chrome.runtime.sendMessage({ type: isEnabled ? "START" : "CLEAR" });
    savePreferences();
  }

  async function loadPages() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_PAGES" }, (response) => {
        if (response && response.pages) {
          resolve(response.pages);
        } else {
          resolve([]);
        }
      });
    });
  }

  async function populatePageSelect() {
    const pages = await loadPages();
    pageSelect.innerHTML = "";

    if (pages.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No pages saved";
      pageSelect.appendChild(option);
      return;
    }

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a page";
    pageSelect.appendChild(defaultOption);

    pages.forEach((page) => {
      const option = document.createElement("option");
      option.value = page.id;
      const displayName = page.data.title
        ? `${page.data.title} - ${page.data.domain}${page.data.route}`
        : `${page.data.domain}${page.data.route}`;
      option.textContent = displayName;
      pageSelect.appendChild(option);
    });

    const savedPageId = await getSavedPageId();
    if (savedPageId) {
      pageSelect.value = savedPageId;
    }
  }

  async function getCurrentTabPageId() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const url = new URL(tabs[0].url);
          const pageId = `${url.hostname}${url.pathname}`;
          resolve(pageId);
        } else {
          resolve(null);
        }
      });
    });
  }

  async function loadStats() {
    let pageId = null;

    if (currentTab === "exactly") {
      pageId = pageSelect.value || null;
    } else if (currentTab === "current") {
      pageId = await getCurrentTabPageId();
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "GET_STATS", tab: currentTab, pageId },
        (response) => {
          if (response) {
            resolve(response);
          } else {
            resolve({
              clicks: 0,
              buttonClicks: 0,
              avgDelay: 0,
              mouseDistance: 0,
            });
          }
        },
      );
    });
  }

  async function displayStats() {
    const stats = await loadStats();
    document.getElementById("clicksCount").textContent = stats.clicks;
    document.getElementById("buttonClicks").textContent = stats.buttonClicks;
    document.getElementById("avgDelay").textContent = `${stats.avgDelay}ms`;
    document.getElementById("mouseDistance").textContent =
      `${stats.mouseDistance}px`;
  }

  function savePreferences() {
    const prefs = {
      tab: currentTab,
      enabled: isEnabled,
      pageId: currentTab === "exactly" ? pageSelect.value : null,
    };
    chrome.storage.local.set({ monitorPreferences: prefs });
  }

  async function loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["monitorPreferences"], (result) => {
        resolve(result.monitorPreferences || { tab: "all", enabled: true });
      });
    });
  }

  async function getSavedPageId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["monitorPreferences"], (result) => {
        const prefs = result.monitorPreferences;
        resolve(prefs && prefs.pageId ? prefs.pageId : "");
      });
    });
  }

  async function getState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
        resolve(response && response.isEnabled);
      });
    });
  }

  const collectionData = await loadCollectionList();
  collectionList = collectionData.list;
  collectionMode = collectionData.mode;

  collectionTabs.forEach((tab) => {
    if (tab.dataset.collection === collectionMode) {
      tab.classList.add("popup__collection-tab--active");
    } else {
      tab.classList.remove("popup__collection-tab--active");
    }
  });

  renderCollectionItems();

  const prefs = await loadPreferences();
  currentTab = prefs.tab || "all";
  isEnabled = prefs.enabled !== false;

  const currentState = await getState();
  if (currentState !== undefined) {
    isEnabled = currentState;
  }

  enableToggle.checked = isEnabled;

  tabBtns.forEach((btn) => {
    if (btn.dataset.tab === currentTab) {
      btn.classList.add("popup__tab-btn--active");
    } else {
      btn.classList.remove("popup__tab-btn--active");
    }
  });

  if (currentTab === "exactly") {
    pageSelector.classList.add("popup__page-selector--visible");
  }

  await populatePageSelect();
  await displayStats();
  updateMonitoringState();
});
