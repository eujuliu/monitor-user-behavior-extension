const DB_NAME = "MonitorEvents";
const DB_VERSION = 1;
const STORES = {
  PAGES: "pages",
  CLICK: "clicks",
  MOUSEDOWN: "mousedowns",
  MOUSEUP: "mouseups",
  MOUSE_TRACE: "mouse_traces",
  SCROLL: "scrolls",
  KEYDOWN: "keydowns",
  KEYUP: "keyups",
  ELEMENT: "elements",
};

let db = null;
let weeklyReportEnabled = false;
let isMonitoringEnabled = true;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      for (const storeName of Object.values(STORES)) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };
  });
}

function getStore(db, storeName, mode = "readonly") {
  return db.transaction([storeName], mode).objectStore(storeName);
}

async function updateStats(eventId, data) {
  const stats = await chrome.storage.local.get({
    totalClicks: 0,
    buttonClicks: 0,
    totalMouseDelay: 0,
    mouseEvents: 0,
    mouseMovementDistance: 0,
  });

  if (eventId === "CLICK") {
    stats.totalClicks++;
    if (data.isButton) {
      stats.buttonClicks++;
    }
  }

  if (eventId === "MOUSEUP" && data.speed !== undefined) {
    stats.totalMouseDelay += data.speed;
    stats.mouseEvents++;
  }

  if (eventId === "MOUSE_TRACE" && data.points && data.points.length > 1) {
    let distance = 0;
    for (let i = 1; i < data.points.length; i++) {
      const dx = data.points[i].x - data.points[i - 1].x;
      const dy = data.points[i].y - data.points[i - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);
    }
    stats.mouseMovementDistance += distance;
  }

  await chrome.storage.local.set(stats);
}

async function saveEvent(eventId, data) {
  const database = await openDB();
  const storeName = STORES[eventId];

  if (!storeName) {
    console.warn(`Unknown event type: ${eventId}`);
    return;
  }

  await updateStats(eventId, data);

  return new Promise((resolve, reject) => {
    const store = getStore(database, storeName, "readwrite");

    const record = {
      id:
        data.id || `${Date.now()}${Math.random().toString(36).substring(2, 9)}`,
      data,
    };

    const request = store.add(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

async function getEventById(eventId, id) {
  const database = await openDB();
  const storeName = STORES[eventId];

  if (!storeName) {
    console.warn(`Unknown event type: ${eventId}`);
    return null;
  }

  return new Promise((resolve, reject) => {
    const store = getStore(database, storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllEvents(eventId) {
  const database = await openDB();
  const storeName = STORES[eventId];

  if (!storeName) {
    console.warn(`Unknown event type: ${eventId}`);
    return [];
  }

  return new Promise((resolve, reject) => {
    const store = getStore(database, storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearEvents(eventId) {
  const database = await openDB();
  const storeName = STORES[eventId];

  if (!storeName) {
    console.warn(`Unknown event type: ${eventId}`);
    return;
  }

  return new Promise((resolve, reject) => {
    const store = getStore(database, storeName, "readwrite");
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getPageById(pageId) {
  return getEventById("PAGES", pageId);
}

async function getAllPages() {
  return getAllEvents("PAGES");
}

async function getElementById(elementId) {
  return getEventById("ELEMENT", elementId);
}

async function queryEvents(eventId, predicate) {
  const allEvents = await getAllEvents(eventId);

  if (!predicate) {
    return allEvents;
  }

  return allEvents.filter(predicate);
}

async function exportToJson(startDate, endDate) {
  const exportData = {};

  for (const [eventKey, storeName] of Object.entries(STORES)) {
    const events = await getAllEvents(eventKey);

    exportData[storeName] = events;
  }

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });

  const startDateStr = new Date(startDate).toISOString().split("T")[0];
  const endDateStr = new Date(endDate).toISOString().split("T")[0];
  const filename = `user-monitoring-chrome/${startDateStr}-${endDateStr}.json`;

  const downloadId = await chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename: filename,
    saveAs: false,
  });

  return downloadId;
}

async function scheduleWeeklyExport() {
  if (weeklyReportEnabled) return;
  weeklyReportEnabled = true;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const nextSunday = new Date(now);

  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);

  const delay = nextSunday.getTime() - now.getTime();

  setTimeout(async () => {
    const startDate = new Date(nextSunday);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(nextSunday);

    await exportToJson(startDate.getTime(), endDate.getTime());

    weeklyReportEnabled = false;
    scheduleWeeklyExport();
  }, delay);
}

async function registerPage(pageId, pageData) {
  const existingPage = await getPageById(pageId);

  if (existingPage) {
    return existingPage;
  }

  return saveEvent("PAGES", { id: pageId, ...pageData });
}

async function checkElementExists(elementId) {
  const element = await getElementById(elementId);
  return !!element;
}

scheduleWeeklyExport();

self.db = {
  saveEvent,
  getEventById,
  getAllEvents,
  clearEvents,
  getPageById,
  getAllPages,
  getElementById,
  queryEvents,
  exportToJson,
  scheduleWeeklyExport,
  checkElementExists,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.type === "CHECK_ELEMENT") {
    checkElementExists(message.elementId).then((exists) => {
      sendResponse({ exists });
    });
    return true;
  }

  if (message.type === "START") {
    isMonitoringEnabled = true;
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "START" });
    });

    return;
  }

  if (message.type === "CLEAR") {
    isMonitoringEnabled = false;
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#f44336" });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "CLEAR" });
    });

    return;
  }

  if (message.type === "REGISTER_PAGE") {
    registerPage(message.pageId, message.page)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error registering page:", error);
        sendResponse({ success: false });
      });
    return true;
  }

  if (message.type === "GET_PAGES") {
    getAllPages().then((pages) => {
      sendResponse({ pages });
    });
    return true;
  }

  if (message.type === "GET_STATE") {
    sendResponse({ isEnabled: isMonitoringEnabled });
    return true;
  }

  if (message.type === "GET_STATS") {
    const { tab, pageId } = message;

    const queryPageStats = async (targetPageId) => {
      const clicks = await getAllEvents("CLICK");
      const mouseups = await getAllEvents("MOUSEUP");
      const mouseTraces = await getAllEvents("MOUSE_TRACE");

      const pageClicks = clicks.filter(c => c.data.pageId === targetPageId);
      const pageMouseups = mouseups.filter(m => m.data.pageId === targetPageId);
      const pageMouseTraces = mouseTraces.filter(t => t.data.pageId === targetPageId);

      const totalClicks = pageClicks.length;
      const buttonClicks = pageClicks.filter(c => c.data.isButton).length;

      const totalMouseDelay = pageMouseups.reduce((sum, m) => sum + (m.data.speed || 0), 0);
      const mouseEvents = pageMouseups.length;

      let mouseMovementDistance = 0;
      for (const trace of pageMouseTraces) {
        if (trace.data.points && trace.data.points.length > 1) {
          for (let i = 1; i < trace.data.points.length; i++) {
            const dx = trace.data.points[i].x - trace.data.points[i - 1].x;
            const dy = trace.data.points[i].y - trace.data.points[i - 1].y;
            mouseMovementDistance += Math.sqrt(dx * dx + dy * dy);
          }
        }
      }

      return { totalClicks, buttonClicks, totalMouseDelay, mouseEvents, mouseMovementDistance };
    };

    const getStatsForScope = async () => {
      if (tab === "exactly" && pageId) {
        return queryPageStats(pageId);
      }

      if (tab === "current" && pageId) {
        return queryPageStats(pageId);
      }

      const baseStats = await chrome.storage.local.get({
        totalClicks: 0,
        buttonClicks: 0,
        totalMouseDelay: 0,
        mouseEvents: 0,
        mouseMovementDistance: 0,
      });

      return baseStats;
    };

    getStatsForScope().then((stats) => {
      const avgDelay = stats.mouseEvents > 0
        ? Math.round(stats.totalMouseDelay / stats.mouseEvents)
        : 0;

      sendResponse({
        clicks: stats.totalClicks,
        buttonClicks: stats.buttonClicks,
        avgDelay: avgDelay,
        mouseDistance: Math.round(stats.mouseMovementDistance),
      });
    });
    return true;
  }

  const eventId = message.id;

  if (eventId && STORES[eventId]) {
    saveEvent(eventId, message.data)
      .then((record) => {
        console.debug(`Saved ${eventId} event:`, record);
      })
      .catch((error) => {
        console.error(`Error saving ${eventId} event:`, error);
      });
  }
});
