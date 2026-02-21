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

function getElementInfo(element, eventType, eventId) {
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
    eventId,
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
  console.debug({ id, data });
  chrome.runtime.sendMessage({ id, data });
}

let timestamp;
let clickId;
let keyTimestamp;
let keyId;
let lastKeypressElement;
let active = false;

let scrollTimeout;
let scrollStartY;
let scrollLastY;
let scrollId;
let scrollTimestamp;

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
    sendMessage(
      "ELEMENT",
      getElementInfo(clickableElement, "MOUSEPRESS", clickId),
    );
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

function keydown(event) {
  if (event.repeat) return;

  const target = event.target;
  const isInputElement =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable;

  if (!isInputElement) return;

  const page = getPageInfo();
  keyTimestamp = Date.now();
  keyId = generateId(keyTimestamp, page.domain, page.route);

  sendMessage("KEYDOWN", {
    page,
    timestamp: keyTimestamp,
    id: keyId,
  });

  if (lastKeypressElement !== target) {
    lastKeypressElement = target;
    sendMessage("ELEMENT", getElementInfo(target, "KEYPRESS", keyId));
  }
}

function keyup(event) {
  if (!keyTimestamp || !keyId) return;

  const page = getPageInfo();
  const keyupTimestamp = Date.now();

  sendMessage("KEYUP", {
    page,
    timestamp: keyupTimestamp,
    id: keyId,
    speed: keyupTimestamp - keyTimestamp,
  });

  keyTimestamp = null;
  keyId = null;
}

function scroll(event) {
  const currentY = window.scrollY;
  const page = getPageInfo();
  const now = Date.now();

  if (!scrollId) {
    scrollStartY = currentY;
    scrollLastY = currentY;
    scrollTimestamp = now;
    scrollId = generateId(scrollTimestamp, page.domain, page.route);
  }

  scrollLastY = currentY;

  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    if (scrollId) {
      const distance = Math.abs(scrollLastY - scrollStartY);
      const direction = scrollLastY > scrollStartY ? "down" : "up";

      sendMessage("SCROLL", {
        page,
        timestamp: now,
        start_time: scrollTimestamp,
        end_time: Date.now(),
        start_y: scrollStartY,
        id: scrollId,
        distance,
        direction,
      });

      scrollId = null;
      scrollStartY = null;
      scrollLastY = null;
      scrollTimestamp = null;
    }
  }, 150);
}

function clearListeners() {
  if (!active) return;
  document.removeEventListener("click", click, { capture: true });
  document.removeEventListener("mousedown", mousedown, { capture: true });
  document.removeEventListener("mouseup", mouseup, { capture: true });
  document.removeEventListener("keydown", keydown);
  document.removeEventListener("keyup", keyup);
  document.removeEventListener("scroll", scroll);
  active = false;
}

function addListeners() {
  if (active) return;
  document.addEventListener("click", click);
  document.addEventListener("mousedown", mousedown);
  document.addEventListener("mouseup", mouseup);
  document.addEventListener("keydown", keydown);
  document.addEventListener("keyup", keyup);
  document.addEventListener("scroll", scroll);
  active = true;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLEAR") clearListeners();
  if (message.type === "START") addListeners();
});

addListeners();
console.log("Initialized listeners");
