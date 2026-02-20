function toBase62(num) {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  if (num === 0) return "0";

  let result = "";
  let n = Math.abs(num);

  while (n > 0) {
    result = chars[n % 62] + result;
    n = Math.floor(n / 62);
  }

  return result;
}

function generateId(timestamp, domain, route) {
  const normalizedDomain = domain.replace(/\./g, "_");
  const normalizedRoute = route.replace(/\//g, "_") || "_";
  const baseString = `${normalizedDomain}_${normalizedRoute}`;

  let hash = 0;

  for (let i = 0; i < baseString.length; i++) {
    const char = baseString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return `${timestamp}-${toBase62(Math.abs(hash))}`;
}

function getPageInfo() {
  return {
    route: window.location.pathname,
    domain: window.location.hostname,
    title: document.title,
  };
}

function sendMessage(id, data) {
  console.log({ id, data });
  debugger;
  chrome.runtime.sendMessage({ id, data });
}

function click(event) {
  const timestamp = Date.now();
  const page = getPageInfo();

  sendMessage("CLICK", {
    x: event.clientX + window.scrollX,
    y: event.clientY + window.scrollY,
    page,
    timestamp,
    id: generateId(timestamp, page.domain, page.route),
  });
}

function clearListeners() {
  document.removeEventListener("click", click, { capture: true });
}

document.addEventListener("click", click);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLEAR") clearListeners();
});

console.log("Initialized listeners");
