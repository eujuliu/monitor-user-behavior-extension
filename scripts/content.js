const mousedownTimes = new Map();

function getElementInfo(element) {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  const absoluteX = rect.left + window.scrollX;
  const absoluteY = rect.top + window.scrollY;

  const meaningfulAttrs = {};
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const name = attr.name.toLowerCase();

      if (name !== "id" && name !== "class" && !name.startsWith("data-")) {
        meaningfulAttrs[name] = attr.value;
      }
    }
  }

  const parent = element.parentElement;
  const siblingIndex = parent
    ? Array.from(parent.children).indexOf(element)
    : -1;
  const totalSiblings = parent ? parent.children.length : 0;

  const path = [];
  let current = element;
  while (current && current !== document.body) {
    path.unshift(current.tagName?.toLowerCase());
    current = current.parentElement;
  }

  return {
    tagName: element.tagName?.toLowerCase() || "unknown",
    dimensions: {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    position: {
      x: Math.round(absoluteX),
      y: Math.round(absoluteY),
      viewportX: Math.round(rect.left),
      viewportY: Math.round(rect.top),
    },
    styles: {
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
      visibility: computedStyle.visibility,
      display: computedStyle.display,
    },
    text: element.textContent?.substring(0, 100) || null,
    attributes: meaningfulAttrs,
    hierarchy: {
      index: siblingIndex,
      totalSiblings: totalSiblings,
      parentTag: parent?.tagName?.toLowerCase() || null,
      path: path.slice(-5).join(" > "), // Last 5 levels
    },
    href: element.href || null,
    src: element.src || null,
    type: element.type || null,
    name: element.name || null,
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
