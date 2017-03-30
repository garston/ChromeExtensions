var ajaxGet = (uri, callback) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://' + API_KEY + '@api.flowdock.com/flows/' + ORG_FLOW + '/' + uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
            callback(JSON.parse(xhr.responseText));
        }
    };
    xhr.send();
};

var setBadgeText = (text, tabId) => chrome.browserAction.setBadgeText({ tabId, text: '' + text });

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if(changeInfo.status === 'loading') {
        setBadgeText('', tabId);

        chrome.tabs.get(tabId, tab => {
            var tabUrl = tab.url.replace(/(rally1.rallydev.com\/)#\/\d+/, '$1slm/#');

            ajaxGet('threads?application=399', threads => {
                var thread = threads.find(t => t.external_url === tabUrl);
                if(thread) {
                    ajaxGet('threads/' + thread.id + '/messages?app=chat', messages => {
                        setBadgeText(messages.length, tabId);
                    });
                }
            });
        });
    }
});
