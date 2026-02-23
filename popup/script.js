document.addEventListener("DOMContentLoaded", async () => {
  const enableToggle = document.getElementById("enableToggle");
  const tabBtns = document.querySelectorAll(".tab-selector__btn");
  const pageSelector = document.querySelector(".popup__page-selector");
  const pageSelect = document.getElementById("pageSelect");

  let currentTab = "all";
  let isEnabled = true;

  enableToggle.addEventListener("change", async () => {
    isEnabled = enableToggle.checked;
    updateMonitoringState();
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("tab-selector__btn--active"));

      btn.classList.add("tab-selector__btn--active");

      currentTab = btn.dataset.tab;

      if (currentTab === "exactly") {
        pageSelector.classList.add("popup__page-selector--visible");
      } else {
        pageSelector.classList.remove("popup__page-selector--visible");
      }

      savePreferences();
    });
  });

  pageSelect.addEventListener("change", () => {
    savePreferences();
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
      btn.classList.add("tab-selector__btn--active");
    } else {
      btn.classList.remove("tab-selector__btn--active");
    }
  });

  if (currentTab === "exactly") {
    pageSelector.classList.add("popup__page-selector--visible");
  }

  await populatePageSelect();
  updateMonitoringState();
});
