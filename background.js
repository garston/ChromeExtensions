var HOST_METADATA = {
    'github.com': { appId: 472 },
    'rally1.rallydev.com': {
        appId: 399,
        urlTransformer: url => url.replace(/(rally1.rallydev.com\/)#\/\d+/, '$1slm/#')
    }
};
var IDENTITY = o => o;

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if(changeInfo.status !== 'loading') {
        return;
    }

    setBadgeText('', tabId);

    chrome.storage.sync.get(['apiToken', 'flowUrls'], prefs => {
        if(prefs.apiToken && prefs.flowUrls) {
            chrome.tabs.get(tabId, tab => {
                var metadata = HOST_METADATA[tab.url.replace(/[a-z]+:\/\/([^/]+).*/, '$1')];
                if(metadata) {
                    fetchChatMessages(metadata, tab, prefs);
                }
            });
        } else {
            setBadgeText('!', tabId);
        }
    });
});

var ajaxGet = (uri, {apiToken, flowUrls}, callback) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://' + apiToken + '@api.flowdock.com/flows/' + flowUrls + '/' + uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
            callback(JSON.parse(xhr.responseText));
        }
    };
    xhr.send();
};

var fetchChatMessages = ({ appId, urlTransformer }, { id, url }, prefs) => {
    url = (urlTransformer || IDENTITY)(url);

    ajaxGet('threads?application=' + appId, prefs, threads => {
        var thread = threads.find(t => t.external_url === url);
        if(thread) {
            ajaxGet('threads/' + thread.id + '/messages?app=chat', prefs, messages => {
                setBadgeText(messages.length, id);
            });
        }
    });
};

var setBadgeText = (text, tabId) => chrome.browserAction.setBadgeText({ tabId, text: '' + text });
