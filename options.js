document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['apiToken', 'flowUrls'], ({apiToken, flowUrls}) => {
        document.getElementById('api-token').value = apiToken || '';
        document.getElementById('flow-urls').value = flowUrls || '';
    });
});

document.getElementById('save').addEventListener('click', () => {
    chrome.storage.sync.set({
        apiToken: document.getElementById('api-token').value,
        flowUrls: document.getElementById('flow-urls').value
    });
    window.close();
});
