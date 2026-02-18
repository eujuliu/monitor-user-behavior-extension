import { Stores } from "./db.js";

const CLICK_STATS_ID = "click-current";
const KEYBOARD_STATS_ID = "keyboard-current";

// Store click event
export async function storeClickEvent(db, data) {
  try {
    const transaction = db.transaction(
      [Stores.CLICKS, Stores.CLICK_STATS],
      "readwrite",
    );
    const store = transaction.objectStore(Stores.CLICKS);
    const statsStore = transaction.objectStore(Stores.CLICK_STATS);

    const eventRecord = {
      eventType: data.eventType,
      x: data.x,
      y: data.y,
      timestamp: data.timestamp,
      duration: data.duration,
      target: data.target,
      url: data.url || "unknown",
      recordedAt: new Date().toISOString(),
    };

    const request = store.add(eventRecord);

    await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const statsRequest = statsStore.get(CLICK_STATS_ID);
    const stats = await new Promise((resolve, reject) => {
      statsRequest.onsuccess = () => resolve(statsRequest.result);
      statsRequest.onerror = () => reject(statsRequest.error);
    });

    const updatedStats = stats || {
      id: CLICK_STATS_ID,
      total: 0,
      clicks: 0,
      mousedowns: 0,
      mouseups: 0,
      totalDuration: 0,
      durationCount: 0,
    };

    updatedStats.total++;

    if (data.eventType === "click") updatedStats.clicks++;
    else if (data.eventType === "mousedown") updatedStats.mousedowns++;
    else if (data.eventType === "mouseup") updatedStats.mouseups++;

    if (data.duration !== null && data.duration !== undefined) {
      updatedStats.totalDuration += data.duration;
      updatedStats.durationCount++;
    }

    updatedStats.updatedAt = new Date().toISOString();

    await new Promise((resolve, reject) => {
      const putRequest = statsStore.put(updatedStats);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (error) {
    console.error("User Monitor: Error storing click event:", error);
  }
}

// Store mouse trace
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

// Store keyboard event (no key content)
export async function storeKeyboardEvent(db, data) {
  try {
    const transaction = db.transaction(
      [Stores.KEYBOARD, Stores.KEYBOARD_STATS],
      "readwrite",
    );
    const store = transaction.objectStore(Stores.KEYBOARD);
    const statsStore = transaction.objectStore(Stores.KEYBOARD_STATS);

    const eventRecord = {
      eventType: data.eventType,
      timestamp: data.timestamp,
      interval: data.interval,
      url: data.url || "unknown",
      recordedAt: new Date().toISOString(),
      target: data.target,
    };

    const request = store.add(eventRecord);

    await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const statsRequest = statsStore.get(KEYBOARD_STATS_ID);
    const stats = await new Promise((resolve, reject) => {
      statsRequest.onsuccess = () => resolve(statsRequest.result);
      statsRequest.onerror = () => reject(statsRequest.error);
    });

    const updatedStats = stats || {
      id: KEYBOARD_STATS_ID,
      total: 0,
      keydowns: 0,
      keyups: 0,
      totalInterval: 0,
      intervalCount: 0,
    };

    updatedStats.total++;

    if (data.eventType === "keydown") updatedStats.keydowns++;
    else if (data.eventType === "keyup") updatedStats.keyups++;

    if (data.interval !== null && data.interval !== undefined) {
      updatedStats.totalInterval += data.interval;
      updatedStats.intervalCount++;
    }

    updatedStats.updatedAt = new Date().toISOString();

    await new Promise((resolve, reject) => {
      const putRequest = statsStore.put(updatedStats);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (error) {
    console.error("User Monitor: Error storing keyboard event:", error);
  }
}

// Unified message handler
export function handleMessage(db, message, sender) {
  if (message.type === "CLICK") {
    const eventData = {
      ...message.data,
      url: sender.tab?.url || "unknown",
    };
    storeClickEvent(db, eventData);
    return false;
  }

  if (message.type === "MOUSE_TRACE") {
    const traceData = {
      ...message.data,
      url: sender.tab?.url || message.data.page?.url || "unknown",
    };
    storeMouseTrace(db, traceData);
    return false;
  }

  if (message.type === "KEYBOARD") {
    const keyboardData = {
      ...message.data,
      url: sender.tab?.url || "unknown",
    };
    storeKeyboardEvent(db, keyboardData);
    return false;
  }

  return null;
}
