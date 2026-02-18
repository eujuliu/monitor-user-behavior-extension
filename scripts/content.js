const mousedownTimes = new Map();

function getElementInfo(element) {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  return {
    tag: element.tagName?.toLowerCase() || 'unknown',
    text: element.textContent?.substring(0, 100) || null,
    position: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY)
    },
    dimensions: {
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    color: computedStyle.color,
    backgroundColor: computedStyle.backgroundColor
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
  });
}

document.addEventListener("mousedown", handleMousedown, true);
document.addEventListener("mouseup", handleMouseup, true);
document.addEventListener("click", handleClick, true);
