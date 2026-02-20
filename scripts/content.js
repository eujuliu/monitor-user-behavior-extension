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

function getElementInfo(element, eventType) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
    tag: element.tagName.toLowerCase(),
    textColor: style.color,
    text: element.innerText || element.value || "",
    page: getPageInfo(),
    timestamp: Date.now(),
    eventId: clickId,
    event: eventType,
  };
}

function getClickableElement(element) {
  const clickableTags = ["input", "textarea", "button", "a", "select", "label"];
  const tag = element.tagName.toLowerCase();

  if (clickableTags.includes(tag)) {
    return element;
  }

  return element.closest(
    "button, a, input, textarea, select, label, [role='button']",
  );
}

function sendMessage(id, data) {
  console.log({ id, data });
  chrome.runtime.sendMessage({ id, data });
}

let timestamp;
let clickId;

function mousedown(event) {
  const page = getPageInfo();

  timestamp = Date.now();
  clickId = generateId(timestamp, page.domain, page.route);

  sendMessage("MOUSEDOWN", {
    x: event.pageX,
    y: event.pageY,
    page,
    timestamp,
    id: clickId,
  });

  const clickableElement = getClickableElement(event.target);
  if (clickableElement) {
    sendMessage("ELEMENT", getElementInfo(clickableElement, "MOUSEPRESS"));
  }
}

function mouseup(event) {
  if (!timestamp || !clickId) return;

  const page = getPageInfo();
  const mouseupTimestamp = Date.now();

  sendMessage("MOUSEUP", {
    x: event.pageX,
    y: event.pageY,
    page,
    timestamp,
    id: clickId,
    speed: mouseupTimestamp - timestamp,
  });
}

function click(event) {
  if (!timestamp || !clickId) return;

  const page = getPageInfo();

  sendMessage("CLICK", {
    x: event.pageX,
    y: event.pageY,
    page,
    timestamp,
    id: clickId,
  });
}

function clearListeners() {
  document.removeEventListener("click", click, { capture: true });
  document.removeEventListener("mousedown", mousedown, { capture: true });
  document.removeEventListener("mouseup", mouseup, { capture: true });
}

document.addEventListener("click", click);
document.addEventListener("mousedown", mousedown);
document.addEventListener("mouseup", mouseup);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLEAR") clearListeners();
});

console.log("Initialized listeners");
