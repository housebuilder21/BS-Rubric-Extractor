console.log("Activator loaded.")

// Send a signal to the content script to start injecting.
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.tabs.sendMessage(tab.id, { activateBSExtractor: true });
})