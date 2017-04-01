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
                document.getElementById('messages-table').innerHTML = messages.map(m => {
                    return `<tr>
                                <td>${m.content}</td>
                                <td><a href="${flowIdsToUrls[m.flow]}/messages/${m.id}" target="_blank"><img class="fd-link" src="favicon.ico" /></a></td>
                            </tr>`;
                }).join('');
            });
        }
    };

    var setHeader = html => document.getElementById('header').innerHTML = html;
})();
