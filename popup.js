document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([{id}]) => {
        getData(id, ({ messages = [] } = {}) => {
            document.getElementById('messages-table').innerHTML = [`<tr><th>There are ${messages.length} message(s) about this page in Flowdock!</th></tr>`].
                concat(messages.map(m => `<tr><td>${m.content}</td></tr>`)).
                join('');
        });
    });
});
