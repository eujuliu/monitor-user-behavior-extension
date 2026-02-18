import { Stores } from './db.js';

const STORE_NAME = Stores.CLICKS;
const STATS_STORE = Stores.CLICK_STATS;
const STATS_ID = "current";

export async function storeClickEvent(db, data) {
  try {
    const transaction = db.transaction([STORE_NAME, STATS_STORE], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const statsStore = transaction.objectStore(STATS_STORE);

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
    
    // Update stats
    const statsRequest = statsStore.get(STATS_ID);
    const stats = await new Promise((resolve, reject) => {
      statsRequest.onsuccess = () => resolve(statsRequest.result);
      statsRequest.onerror = () => reject(statsRequest.error);
    });
    
    const updatedStats = stats || {
      id: STATS_ID,
      total: 0,
      clicks: 0,
      mousedowns: 0,
      mouseups: 0,
      totalDuration: 0,
      durationCount: 0
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

export function createClickMessageHandler(db) {
  return function handleClickMessage(message, sender) {
    if (message.type === "CLICK_EVENT") {
      const eventData = {
        ...message.data,
        url: sender.tab?.url || "unknown",
      };
      storeClickEvent(db, eventData);
      return false;
    }
    
    return null;
  };
}
