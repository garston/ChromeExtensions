var getData = (tabId, callback) => chrome.storage.sync.get(getDataStorageKey(tabId), obj => callback(obj[getDataStorageKey(tabId)]));
var getDataStorageKey = id => 'data-' + id;
