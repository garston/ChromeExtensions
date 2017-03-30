var HOST_METADATA = {
    'rally1.rallydev.com': {
        appId: 399,
        urlTransformer: url => url.replace(/(rally1.rallydev.com\/)#\/\d+/, '$1slm/#')
    }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if(changeInfo.status === 'loading') {
        setBadgeText('', tabId);

        chrome.tabs.get(tabId, tab => {
            var metadata = HOST_METADATA[tab.url.replace(/[a-z]+:\/\/([^/]+).*/, '$1')];
            if(metadata) {
                fetchChatMessages(metadata, tab);
            }
        });
    }
});

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

var fetchChatMessages = ({ appId, urlTransformer }, { id, url }) => {
    url = urlTransformer(url);

    ajaxGet('threads?application=' + appId, threads => {
        var thread = threads.find(t => t.external_url === url);
        if(thread) {
            ajaxGet('threads/' + thread.id + '/messages?app=chat', messages => {
                setBadgeText(messages.length, id);
            });
        }
    });
};

var setBadgeText = (text, tabId) => chrome.browserAction.setBadgeText({ tabId, text: '' + text });
