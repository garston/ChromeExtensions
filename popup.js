(function(){
    document.addEventListener('DOMContentLoaded', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, ([{id}]) => {
            getData(id, ({ error, messages } = {}) => {
                if(error) {
                    setHeader(error);
                } else {
                    displayMessages(messages);
                }
            });
        });
    });

    var displayMessages = (messages = []) => {
        setHeader(`There are ${messages.length} message(s) about this page in Flowdock!`);

        if(messages.length) {
            chrome.storage.sync.get('flowIdsToUrls', ({flowIdsToUrls}) => {
                document.getElementById('messages-table').innerHTML = ['<tr><th>Flow</th><th>Message Content</th></tr>'].
                    concat(messages.map(m => `<tr><td><a href="${flowIdsToUrls[m.flow]}" target="_blank">${flowIdsToUrls[m.flow]}</a></td><td>${m.content}</td></tr>`)).
                    join('');
            });
        }
    };

    var setHeader = html => document.getElementById('header').innerHTML = html;
})();
