export const DB_NAME = "UserMonitorDB";
export const DB_VERSION = 5;

export const Stores = {
  CLICKS: "clickEvents",
  CLICK_STATS: "clickStats",
  KEYBOARD: "keyboardEvents",
  KEYBOARD_STATS: "keyboardStats",
  MOUSE_TRACE: "mouseTrace",
};

export function createDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(Stores.CLICKS)) {
        const clicksStore = db.createObjectStore(Stores.CLICKS, {
          keyPath: "id",
          autoIncrement: true,
        });
        clicksStore.createIndex("timestamp", "timestamp", { unique: false });
        clicksStore.createIndex("eventType", "eventType", { unique: false });
        clicksStore.createIndex("url", "url", { unique: false });
      }

      if (!db.objectStoreNames.contains(Stores.CLICK_STATS)) {
        const statsStore = db.createObjectStore(Stores.CLICK_STATS, {
          keyPath: "id",
        });
      }

      if (!db.objectStoreNames.contains(Stores.KEYBOARD)) {
        const keyboardStore = db.createObjectStore(Stores.KEYBOARD, {
          keyPath: "id",
          autoIncrement: true,
        });
        keyboardStore.createIndex("timestamp", "timestamp", { unique: false });
        keyboardStore.createIndex("eventType", "eventType", { unique: false });
        keyboardStore.createIndex("url", "url", { unique: false });
      }

      if (!db.objectStoreNames.contains(Stores.KEYBOARD_STATS)) {
        db.createObjectStore(Stores.KEYBOARD_STATS, {
          keyPath: "id",
        });
      }

      if (db.objectStoreNames.contains("keyboardSessions")) {
        db.deleteObjectStore("keyboardSessions");
      }

      if (!db.objectStoreNames.contains(Stores.MOUSE_TRACE)) {
        const traceStore = db.createObjectStore(Stores.MOUSE_TRACE, {
          keyPath: "id",
          autoIncrement: true,
        });
        traceStore.createIndex("timestamp", "timestamp", { unique: false });
        traceStore.createIndex("url", "url", { unique: false });
        traceStore.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
  });
}
