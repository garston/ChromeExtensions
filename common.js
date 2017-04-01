(function(){
    window.getData = (tabId, callback) => chrome.storage.sync.get(getDataStorageKey(tabId), obj => callback(obj[getDataStorageKey(tabId)]));
    window.getDataStorageKey = id => 'data-' + id;
})();

