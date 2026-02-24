function stringToBigInt(str) {
  let bigIntValue = 0n;
  for (let i = 0; i < str.length; i++) {
    bigIntValue = (bigIntValue << 8n) + BigInt(str.charCodeAt(i));
  }
  return bigIntValue;
}

function toBase62(str) {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  let num = stringToBigInt(str);
  let result = "";
  if (num === 0n) return alphabet[0];
  while (num > 0n) {
    result = alphabet[Number(num % 62n)] + result;
    num = num / 62n;
  }
  return result;
}

function generateId(timestamp) {
  const normalizedDomain = page.domain.replace(/\./g, "_");
  const normalizedRoute = page.route.replace(/\//g, "_") || "_";
  const baseString = `${normalizedDomain}_${normalizedRoute}`;
  return `${timestamp}${toBase62(baseString)}`;
}

function generatePageId(route, domain) {
  return `${domain}${route}`;
}

function getPageInfo() {
  return {
    route: window.location.pathname,
    domain: window.location.hostname,
    title: document.title,
  };
}

const page = getPageInfo();
let pageId = `${page.domain}${page.route}`;

function getElementInfo(element, eventType, eventId) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const elementId = getElementId(element);

  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
    tag: element.tagName.toLowerCase(),
    textColor: style.color,
    text: element.innerText || element.value || "",
    elementId,
    pageId,
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

  return element.closest(`${clickableTags.join(",")}, [role='button']`);
}

function sendMessage(id, data) {
  console.debug({ id, data });
  chrome.runtime.sendMessage({ id, data });
}

async function registerPage() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "REGISTER_PAGE", pageId, page },
      (response) => {
        resolve(response && response.success);
      },
    );
  });
}

async function checkElementExists(elementId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "CHECK_ELEMENT", elementId },
      (response) => {
        console.debug("CHECKED ELEMENT EXISTENCE");
        resolve(response && response.exists);
      },
    );
  });
}

let mouseDownTimestamp;
let clickId;
let keyTimestamp;
let keyId;
let active = false;

let scrollTimeout;
let scrollStartY;
let scrollLastY;
let scrollId;
let scrollTimestamp;

let mouseTraceTimeout;
let mouseTraceId;
let mouseTraceTimestamp;
let mouseTracePoints = [];
let lastMousePoint = null;

function getElementId(element) {
  const rect = element.getBoundingClientRect();
  const text = (element.innerText || element.value || "").substring(0, 50);
  return `${page.domain}${page.route}:${element.tagName.toLowerCase()}:${Math.round(rect.width)}:${Math.round(rect.height)}:${text}`;
}

function mousedown(event) {
  const timestamp = Date.now();
  mouseDownTimestamp = timestamp;
  clickId = generateId(timestamp);

  sendMessage("MOUSEDOWN", {
    x: event.pageX,
    y: event.pageY,
    pageId,
    timestamp,
    id: clickId,
  });

  const clickableElement = getClickableElement(event.target);

  if (clickableElement) {
    const currentElementId = getElementId(clickableElement);

    checkElementExists(currentElementId).then((exists) => {
      if (!exists) {
        sendMessage(
          "ELEMENT",
          getElementInfo(clickableElement, "MOUSEPRESS", clickId),
        );
      }
    });
  }
}

function mouseup(event) {
  if (!clickId) return;

  const timestamp = Date.now();

  sendMessage("MOUSEUP", {
    x: event.pageX,
    y: event.pageY,
    pageId,
    timestamp,
    id: clickId,
    speed: timestamp - mouseDownTimestamp,
  });
}

function mousemove(event) {
  const now = Date.now();

  if (!mouseTraceId) {
    mouseTraceId = generateId(now);
    mouseTraceTimestamp = now;
    mouseTracePoints = [];
    lastMousePoint = now;
  }

  const speed = lastMousePoint ? now - lastMousePoint : 0;

  mouseTracePoints.push({
    x: event.pageX,
    y: event.pageY,
    speed,
  });

  lastMousePoint = now;

  clearTimeout(mouseTraceTimeout);

  mouseTraceTimeout = setTimeout(() => {
    if (mouseTraceId && mouseTracePoints.length >= 3) {
      let totalSpeed = 0;
      for (const point of mouseTracePoints) {
        totalSpeed += point.speed;
      }
      const avgSpeed = totalSpeed / mouseTracePoints.length;

      sendMessage("MOUSE_TRACE", {
        pageId,
        timestamp: now,
        start_time: mouseTraceTimestamp,
        end_time: Date.now(),
        id: mouseTraceId,
        points: mouseTracePoints,
        avg_speed: avgSpeed,
      });
    }

    mouseTraceId = null;
    mouseTraceTimestamp = null;
    mouseTracePoints = [];
    lastMousePoint = null;
  }, 150);
}

function click(event) {
  if (!clickId) return;

  const clickableElement = getClickableElement(event.target);
  const isButton =
    clickableElement &&
    (clickableElement.tagName.toLowerCase() === "button" ||
      clickableElement.type === "button" ||
      clickableElement.type === "submit");

  sendMessage("CLICK", {
    x: event.pageX,
    y: event.pageY,
    pageId,
    timestamp: Date.now(),
    id: clickId,
    isButton: !!isButton,
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

  keyTimestamp = Date.now();
  keyId = generateId(keyTimestamp);

  sendMessage("KEYDOWN", {
    pageId,
    timestamp: keyTimestamp,
    id: keyId,
  });

  const currentElementId = getElementId(target);

  checkElementExists(currentElementId).then((exists) => {
    if (!exists) {
      sendMessage("ELEMENT", getElementInfo(target, "KEYPRESS", keyId));
    }
  });
}

function keyup(event) {
  if (!keyTimestamp || !keyId) return;

  const keyupTimestamp = Date.now();

  sendMessage("KEYUP", {
    pageId,
    timestamp: keyupTimestamp,
    id: keyId,
    speed: keyupTimestamp - keyTimestamp,
  });

  keyTimestamp = null;
  keyId = null;
}

function scroll(event) {
  const currentY = window.scrollY;
  const now = Date.now();

  if (!scrollId) {
    scrollStartY = currentY;
    scrollLastY = currentY;
    scrollTimestamp = now;
    scrollId = generateId(scrollTimestamp);
  }

  scrollLastY = currentY;

  clearTimeout(scrollTimeout);

  scrollTimeout = setTimeout(() => {
    if (scrollId) {
      const distance = Math.abs(scrollLastY - scrollStartY);
      const direction = scrollLastY > scrollStartY ? "down" : "up";

      sendMessage("SCROLL", {
        pageId,
        timestamp: now,
        start_time: scrollTimestamp,
        end_time: now,
        start_y: scrollStartY,
        id: scrollId,
        distance,
        direction,
      });

      scrollId = null;
    }
  }, 150);
}

function clearListeners() {
  if (!active) return;

  document.removeEventListener("click", click);
  document.removeEventListener("mousedown", mousedown);
  document.removeEventListener("mouseup", mouseup);
  document.removeEventListener("mousemove", mousemove);
  document.removeEventListener("keydown", keydown);
  document.removeEventListener("keyup", keyup);
  document.removeEventListener("scroll", scroll);

  active = false;
  console.log("all events are clean");
}

function addListeners() {
  if (active) return;

  document.addEventListener("click", click);
  document.addEventListener("mousedown", mousedown);
  document.addEventListener("mouseup", mouseup);
  document.addEventListener("mousemove", mousemove);
  document.addEventListener("keydown", keydown);
  document.addEventListener("keyup", keyup);
  document.addEventListener("scroll", scroll);

  active = true;
  console.log("listeners started...");
}

function checkCollectionAndUpdate() {
  chrome.runtime.sendMessage(
    { type: "CHECK_COLLECTION", pageId },
    (response) => {
      if (response && response.shouldCollect) {
        addListeners();
      } else {
        clearListeners();
      }
    },
  );
}

function setupUrlChangeListener() {
  let lastUrl = location.href;

  function wrapRegisterPage() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      page.route = window.location.pathname;
      pageId = `${page.domain}${page.route}`;

      registerPage();
      checkCollectionAndUpdate();
    }
  }

  const observer = new MutationObserver(wrapRegisterPage);

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("popstate", wrapRegisterPage);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLEAR") clearListeners();
  if (message.type === "START") addListeners();
});

function checkAndSetInitialState() {
  const currentPageId = pageId;
  
  chrome.runtime.sendMessage({ type: "CHECK_COLLECTION", pageId: currentPageId }, (response) => {
    if (response && response.shouldCollect) {
      addListeners();
    } else {
      clearListeners();
    }
  });
}

registerPage().then(() => {
  checkAndSetInitialState();
  setupUrlChangeListener();
});
