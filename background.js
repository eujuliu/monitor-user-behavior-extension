import { createDB, DB_NAME, DB_VERSION } from "./modules/db.js";
import { createClickMessageHandler } from "./modules/clicks.js";
import { createQueryHandler } from "./modules/queries.js";

let db = null;
let handleClickMessage = null;
let handleClickUIQueries = null;

async function initialize() {
  db = await createDB();
  handleClickMessage = createClickMessageHandler(db);
  handleClickUIQueries = createQueryHandler(db);

  console.log(`User Monitor: Database "${DB_NAME}" v${DB_VERSION} initialized`);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let result = handleClickMessage(message, sender);

  if (result === null) {
    result = handleClickUIQueries(message);
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
