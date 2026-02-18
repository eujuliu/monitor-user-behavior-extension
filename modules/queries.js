import { Stores } from "./db.js";

const STATS_ID = "current";

export async function getAllEvents(db, limit = 1000) {
  try {
    const transaction = db.transaction([Stores.CLICKS], "readonly");
    const store = transaction.objectStore(Stores.CLICKS);
    const request = store.getAll(null, limit);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("User Monitor: Error retrieving events:", error);
    return [];
  }
}

export async function getEventStats(db) {
  try {
    const transaction = db.transaction([Stores.CLICK_STATS], "readonly");
    const store = transaction.objectStore(Stores.CLICK_STATS);
    const request = store.get(STATS_ID);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const stats = request.result || {
          total: 0,
          clicks: 0,
          mousedowns: 0,
          mouseups: 0,
          avgDuration: 0,
        };

        if (stats.totalDuration > 0 && stats.durationCount > 0) {
          stats.avgDuration = stats.totalDuration / stats.durationCount;
        } else {
          stats.avgDuration = 0;
        }

        resolve(stats);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("User Monitor: Error getting stats:", error);
    return { total: 0, clicks: 0, mousedowns: 0, mouseups: 0, avgDuration: 0 };
  }
}

export async function clearAllEvents(db) {
  try {
    const transaction = db.transaction(
      [Stores.CLICKS, Stores.CLICK_STATS],
      "readwrite",
    );
    const store = transaction.objectStore(Stores.CLICKS);
    const statsStore = transaction.objectStore(Stores.CLICK_STATS);

    const request = store.clear();
    await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await new Promise((resolve, reject) => {
      const resetStats = {
        id: STATS_ID,
        total: 0,
        clicks: 0,
        mousedowns: 0,
        mouseups: 0,
        totalDuration: 0,
        durationCount: 0,
        updatedAt: new Date().toISOString(),
      };
      const putRequest = statsStore.put(resetStats);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    return true;
  } catch (error) {
    console.error("User Monitor: Error clearing events:", error);
    return false;
  }
}

export async function exportEvents(db) {
  const events = await getAllEvents(db, 10000);
  return {
    exportDate: new Date().toISOString(),
    totalEvents: events.length,
    events: events,
  };
}

export function createQueryHandler(db) {
  return function handleClickUIQueries(message) {
    if (message.type === "GET_EVENTS") {
      return getAllEvents(db, message.limit || 1000)
        .then((events) => ({ success: true, events }))
        .catch((error) => ({ success: false, error: error.message }));
    }

    if (message.type === "GET_STATS") {
      return getEventStats(db)
        .then((stats) => ({ success: true, stats }))
        .catch((error) => ({ success: false, error: error.message }));
    }

    if (message.type === "CLEAR_EVENTS") {
      return clearAllEvents(db)
        .then((result) => ({ success: result }))
        .catch((error) => ({ success: false, error: error.message }));
    }

    if (message.type === "EXPORT_EVENTS") {
      return exportEvents(db)
        .then((data) => ({ success: true, data }))
        .catch((error) => ({ success: false, error: error.message }));
    }

    return null;
  };
}
