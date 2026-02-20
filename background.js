chrome.runtime.onMessage.addListener((message) => {
  if (message.id === "CLICK") {
    console.debug(message);
  }
});
