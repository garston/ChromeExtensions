chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
    if(changeInfo.status === 'loading') {
        chrome.tabs.get(tabId, function (tab) {
            chrome.browserAction.setBadgeText({ tabId: tabId, text: '' + Math.random() });
        });
    }
});
