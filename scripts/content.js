const mousedownTimes = new Map();
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

function getPageInfo() {
  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    sessionId: SESSION_ID,
  };
}

function getElementInfo(element) {
  const meaningfulTags = [
    "button",
    "a",
    "label",
    "input",
    "textarea",
    "select",
  ];
  let targetElement = element;

  if (!element.textContent || element.textContent.trim().length === 0) {
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const tag = parent.tagName?.toLowerCase();
      if (
        meaningfulTags.includes(tag) ||
        parent.textContent?.trim().length > 0
      ) {
        targetElement = parent;
        break;
      }
      parent = parent.parentElement;
    }
  }

  const rect = targetElement.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(targetElement);
  const text = targetElement.textContent?.trim().substring(0, 100) || null;

  let elementText = text;
  if (targetElement.tagName?.toLowerCase() === "input") {
    elementText =
      targetElement.value ||
      targetElement.placeholder ||
      text ||
      `[${targetElement.type}]`;
  }

  return {
    tag: targetElement.tagName?.toLowerCase() || "unknown",
    text: elementText,
    position: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
    },
    dimensions: {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    color: computedStyle.color,
    backgroundColor: computedStyle.backgroundColor,
  };
}

function sendEventData(data) {
  console.debug(data);
  chrome.runtime
    .sendMessage({
      type: "CLICK_EVENT",
      data: data,
    })
    .catch((err) => {
      // Silently handle errors when extension context is invalidated
    });
}

function handleMousedown(event) {
  const timestamp = Date.now();
  const eventId = `${timestamp}-${Math.random()}`;

  mousedownTimes.set(eventId, timestamp);

  sendEventData({
    eventType: "mousedown",
    x: event.clientX,
    y: event.clientY,
    timestamp: timestamp,
    duration: null,
    target: getElementInfo(event.target),
    eventId: eventId,
    page: getPageInfo(),
  });
}

function handleMouseup(event) {
  const timestamp = Date.now();
  let duration = null;
  let eventId = null;

  if (mousedownTimes.size > 0) {
    const [lastId, lastTime] = Array.from(mousedownTimes.entries()).pop();
    duration = timestamp - lastTime;
    eventId = lastId;
    mousedownTimes.delete(lastId);
  }

  sendEventData({
    eventType: "mouseup",
    x: event.clientX,
    y: event.clientY,
    timestamp: timestamp,
    duration: duration,
    target: getElementInfo(event.target),
    eventId: eventId,
    page: getPageInfo(),
  });
}

function handleClick(event) {
  const timestamp = Date.now();

  sendEventData({
    eventType: "click",
    x: event.clientX,
    y: event.clientY,
    timestamp: timestamp,
    duration: null,
    target: getElementInfo(event.target),
    eventId: null,
    page: getPageInfo(),
  });
}

document.addEventListener("mousedown", handleMousedown, true);
document.addEventListener("mouseup", handleMouseup, true);
document.addEventListener("click", handleClick, true);
