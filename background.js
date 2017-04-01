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

    setState('', {}, tabId);

    chrome.storage.sync.get(['apiToken', 'flowUrls'], prefs => {
        if(prefs.apiToken && prefs.flowUrls) {
            chrome.tabs.get(tabId, tab => {
                var metadata = HOST_METADATA[tab.url.replace(/[a-z]+:\/\/([^/]+).*/, '$1')];
                if(metadata) {
                    fetchChatMessages(metadata, tab, prefs);
                }
            });
        } else {
            setState('!', {error: 'Please setup the Flowdock Chrome Extension from its Options link on the Extensions page'}, tabId);
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

    var messages = [];
    flowUrls.split(',').forEach(flowUrl => {
        var orgFlow = flowUrl.replace(/https:\/\/www\.flowdock\.com\/app\/([^/]+\/[^/]+).*/, '$1');
        ajaxGet('threads?application=' + appId, orgFlow, apiToken, threads => {
            var thread = threads.find(t => t.external_url === url);
            if(thread) {
                ajaxGet('threads/' + thread.id + '/messages?app=chat', orgFlow, apiToken, threadMessages => {
                    messages = messages.concat(threadMessages);
                    setState(messages.length, { messages }, id);

                    if(messages.length) {
                        chrome.storage.sync.get('flowIdsToUrls', ({ flowIdsToUrls = {} }) => {
                            flowIdsToUrls[messages[0].flow] = flowUrl;
                            chrome.storage.sync.set({ flowIdsToUrls });
                        });
                    }
                });
            }
        });
    });
};

var setState = (badgeText, data, tabId) => {
    chrome.browserAction.setBadgeText({ tabId, text: '' + badgeText });
    chrome.storage.sync.set({ [getDataStorageKey(tabId)]: data });
};
