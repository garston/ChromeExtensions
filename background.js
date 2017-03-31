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

var ajaxGet = (uri, orgFlow, apiToken, callback) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://' + apiToken + '@api.flowdock.com/flows/' + orgFlow + '/' + uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
            callback(JSON.parse(xhr.responseText));
        }
    };
    xhr.send();
};

var fetchChatMessages = ({ appId, urlTransformer }, { id, url }, { apiToken, flowUrls }) => {
    url = (urlTransformer || IDENTITY)(url);

    var messageCount = 0;
    flowUrls.split(',').forEach(flowUrl => {
        var orgFlow = flowUrl.replace(/https:\/\/www\.flowdock\.com\/app\/([^/]+\/[^/]+).*/, '$1');
        ajaxGet('threads?application=' + appId, orgFlow, apiToken, threads => {
            var thread = threads.find(t => t.external_url === url);
            if(thread) {
                ajaxGet('threads/' + thread.id + '/messages?app=chat', orgFlow, apiToken, messages => {
                    messageCount += messages.length;
                    setBadgeText(messageCount, id);
                });
            }
        });
    });
};

var setBadgeText = (text, tabId) => chrome.browserAction.setBadgeText({ tabId, text: '' + text });
