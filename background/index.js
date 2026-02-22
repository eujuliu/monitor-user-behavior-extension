const DB_NAME = "MonitorEvents";
const DB_VERSION = 1;
const STORES = {
  CLICK: "clicks",
  MOUSEDOWN: "mousedowns",
  MOUSEUP: "mouseups",
  MOUSE_TRACE: "mouse_traces",
  SCROLL: "scrolls",
  KEYDOWN: "keydowns",
  KEYUP: "keyups",
  ELEMENT: "elements",
};

let weeklyReportEnabled = false;

function createDatabase() {
  let db = null;

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

  async function saveEvent(eventId, data) {
    const database = await openDB();
    const storeName = STORES[eventId];

    if (!storeName) {
      console.warn(`Unknown event type: ${eventId}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      const record = {
        id:
          data.id ||
          `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        data,
        createdAt: Date.now(),
      };

      const request = store.add(record);

      request.onsuccess = () => resolve(record);
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
      const transaction = database.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
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
      const transaction = database.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
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
      const transaction = database.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
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

      const filteredEvents = events.filter((event) => {
        const createdAt = event.createdAt;
        return createdAt >= startDate && createdAt <= endDate;
      });

      exportData[storeName] = filteredEvents;
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

  return {
    openDB,
    saveEvent,
    getAllEvents,
    getEventById,
    queryEvents,
    clearEvents,
    exportToJson,
    scheduleWeeklyExport,
  };
}

const db = createDatabase();

self.db = db;

db.scheduleWeeklyExport();

chrome.runtime.onMessage.addListener((message) => {
  const eventId = message.id;

  if (eventId && STORES[eventId]) {
    db.saveEvent(eventId, message.data)
      .then((record) => {
        console.debug(`Saved ${eventId} event:`, record);
      })
      .catch((error) => {
        console.error(`Error saving ${eventId} event:`, error);
      });
  }
});
