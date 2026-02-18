import { Stores } from "./db.js";

export async function storeMouseTrace(db, data) {
  try {
    const transaction = db.transaction([Stores.MOUSE_TRACE], "readwrite");
    const store = transaction.objectStore(Stores.MOUSE_TRACE);

    const traceRecord = {
      eventType: data.eventType,
      trace: data.trace,
      page: data.page,
      timestamp: data.timestamp,
      recordedAt: data.recordedAt,
      url: data.page?.url || "unknown",
      domain: data.page?.domain || "unknown",
      sessionId: data.page?.sessionId || "unknown",
    };

    const request = store.add(traceRecord);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("User Monitor: Error storing mouse trace:", error);
  }
}

export function createMouseTraceHandler(db) {
  return function handleMouseTraceMessage(message, sender) {
    if (message.type === "MOUSE_TRACE") {
      const traceData = {
        ...message.data,
        url: sender.tab?.url || message.data.page?.url || "unknown",
      };
      storeMouseTrace(db, traceData);
      return false;
    }

    return null;
  };
}
