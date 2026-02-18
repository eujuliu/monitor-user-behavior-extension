import { createDB, DB_NAME, DB_VERSION } from "./modules/db.js";
import { handleMessage } from "./modules/handlers.js";
import { handleQuery } from "./modules/queries.js";

let db = null;

async function initialize() {
  db = await createDB();

  console.log(`User Monitor: Database "${DB_NAME}" v${DB_VERSION} initialized`);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle data events (CLICK, MOUSE_TRACE, KEYBOARD)
  let result = handleMessage(db, message, sender);

  // Handle queries if not an event
  if (result === null) {
    result = handleQuery(message);
  }

  if (result !== null && typeof result.then === "function") {
    result
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

initialize().catch((error) => {
  console.error("User Monitor: Failed to initialize database:", error);
});

console.log("User Monitor: Background service worker initialized");
