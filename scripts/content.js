const mousedownTimes = new Map();
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

let currentTrace = null;
let traceTimeout = null;
const TRACE_TIMEOUT_MS = 1000;

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

function sendEventData(data, type) {
  console.debug(data);
  chrome.runtime
    .sendMessage({
      type,
      data,
    })
    .catch((err) => {
      // Silently handle errors when extension context is invalidated
    });
}

function handleMousedown(event) {
  const timestamp = Date.now();
  const eventId = `${timestamp}-${Math.random()}`;

  mousedownTimes.set(eventId, timestamp);

  sendEventData(
    {
      eventType: "mousedown",
      x: event.clientX,
      y: event.clientY,
      timestamp: timestamp,
      duration: null,
      target: getElementInfo(event.target),
      eventId: eventId,
      page: getPageInfo(),
    },
    "CLICK",
  );
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

  sendEventData(
    {
      eventType: "mouseup",
      x: event.clientX,
      y: event.clientY,
      timestamp: timestamp,
      duration: duration,
      target: getElementInfo(event.target),
      eventId: eventId,
      page: getPageInfo(),
    },
    "CLICK",
  );
}

function handleClick(event) {
  const timestamp = Date.now();

  sendEventData(
    {
      eventType: "click",
      x: event.clientX,
      y: event.clientY,
      timestamp: timestamp,
      duration: null,
      target: getElementInfo(event.target),
      eventId: null,
      page: getPageInfo(),
    },
    "CLICK",
  );
}

function calculateSpeed(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const timeDiff = p2.timestamp - p1.timestamp;
  return timeDiff > 0 ? distance / timeDiff : 0;
}

function finalizeTrace() {
  if (currentTrace && currentTrace.points.length > 1) {
    const startPoint = currentTrace.points[0];
    const endPoint = currentTrace.points[currentTrace.points.length - 1];

    currentTrace.duration = endPoint.timestamp - startPoint.timestamp;
    currentTrace.totalDistance = currentTrace.points.reduce((sum, point, i) => {
      if (i === 0) return 0;
      const prev = currentTrace.points[i - 1];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0);

    currentTrace.avgSpeed =
      currentTrace.duration > 0
        ? currentTrace.totalDistance / currentTrace.duration
        : 0;

    sendEventData(
      {
        eventType: "mouse_trace",
        trace: currentTrace,
        page: getPageInfo(),
        timestamp: startPoint.timestamp,
        recordedAt: new Date().toISOString(),
      },
      "MOUSE_TRACE",
    );
  }

  currentTrace = null;
}

function handleMouseMove(event) {
  const timestamp = Date.now();
  const point = {
    x: event.clientX,
    y: event.clientY,
    timestamp: timestamp,
  };

  if (!currentTrace) {
    currentTrace = {
      startX: point.x,
      startY: point.y,
      startTimestamp: timestamp,
      points: [point],
    };
  } else {
    const lastPoint = currentTrace.points[currentTrace.points.length - 1];
    const speed = calculateSpeed(lastPoint, point);

    currentTrace.points.push({
      ...point,
      speed: speed,
    });
  }

  clearTimeout(traceTimeout);
  traceTimeout = setTimeout(finalizeTrace, TRACE_TIMEOUT_MS);
}

document.addEventListener("mousedown", handleMousedown, true);
document.addEventListener("mouseup", handleMouseup, true);
document.addEventListener("click", handleClick, true);
document.addEventListener("mousemove", handleMouseMove, { passive: true });
