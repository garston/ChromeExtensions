(() => {
    const channelThreads = {};

    const scriptName = 'PhysEd';
    chrome.alarms.create(scriptName, {
        delayInMinutes: 0,
        periodInMinutes: 1
    });
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name !== scriptName) {
            return;
        }

        chrome.tabs.query({url: 'https://app.slack.com/*'}, async (tabs) => {
            const scriptMsgPrefix = `${scriptName} - `
            const reminderMsgPrefix = `Reminder: ${scriptMsgPrefix}`;

            for (const tab of tabs) {
                await chrome.tabs.update(tab.id, {active: true}); // new messages aren't rendered until Slack has focus

                const channelUrl = tab.url.split('/').slice(0, 6).join('/');
                const channelId = channelUrl.split('/').slice(-1)[0];
                const thread = (await new Promise(resolve => chrome.scripting.executeScript({
                    args: [channelUrl, channelId, reminderMsgPrefix],
                    func: executeInSlack,
                    target: {tabId: tab.id}
                }, resolve)))[0].result;

                const existingThread = channelThreads[channelId];
                if (!thread) {
                    delete channelThreads[channelId];
                } else if (existingThread?.id !== thread.id) {
                    channelThreads[channelId] = thread;
                } else {
                    const newMessagesIndex = existingThread.messages.findIndex(m => m.id === thread.messages[0].id);
                    existingThread.messages = [...existingThread.messages.slice(0, newMessagesIndex === -1 ? undefined : newMessagesIndex), ...thread.messages];
                }
            }

            const missingMessages = Object.entries(channelThreads).filter(([_, t]) => t.id !== t.messages[0].id);
            if (missingMessages.length) {
                console.log('missing messages', missingMessages);
                throw '';
            }

            const statusArrayByName = {};
            Object.values(channelThreads).map(t => t.messages).flat().filter(msg => ![reminderMsgPrefix, scriptMsgPrefix].some(prefix => msg.text.startsWith(prefix))).forEach(msg => {
                const newStatus = msg.text.split(' ').reduce(function (playerStatusArray, word, index, words) {
                    let status;
                    if (/^in\W*$/i.test(word)) {
                        status = 'in';
                    } else if (/^(maybe|50\W?50)\W*$/i.test(word)) {
                        status = 'maybe';
                    } else if (/^out\W*$/i.test(word)) {
                        status = 'out';
                    } else {
                        return playerStatusArray;
                    }

                    let isPhraseForOtherPlayer;
                    words.slice(0, index).reverse().some(function (wordInPhrase) {
                        if (/[.!?;]$/.test(wordInPhrase)) {
                            return true;
                        }

                        if (wordInPhrase.startsWith('@')) {
                            isPhraseForOtherPlayer = true;
                            statusArrayByName[wordInPhrase.slice(1).replace(/,$/, '')] = status;
                        }
                    });

                    return playerStatusArray || (!isPhraseForOtherPlayer && status);
                }, null);

                statusArrayByName[msg.from] = newStatus || statusArrayByName[msg.from] || 'unknown';
            });
            console.log(statusArrayByName);
        });
    });

    function executeInSlack(channelUrl, channelId, reminderMsgPrefix) {
        const getMsgCt = msg => msg.closest('.c-virtual_list__item');
        const getMsgFrom = msg => getMsgCt(msg).querySelector('[data-qa="message_sender_name"]').textContent;
        const getMsgId = msg => getMsgCt(msg).getAttribute('data-item-key');
        const querySelectorAll = selector => [...document.querySelectorAll(selector)];

        const selectorMsg = '.c-message_kit__blocks';
        const [threadStarter] = querySelectorAll(`.p-workspace__primary_view ${selectorMsg}`).filter(msg =>
            msg.textContent.startsWith(reminderMsgPrefix) &&
            getMsgFrom(msg) === 'Slackbot' &&
            ['Today', 'Yesterday'].some(day => getMsgCt(msg).querySelector('.c-timestamp').getAttribute('aria-label').startsWith(`${day} at `))
        ).slice(-1);
        if (!threadStarter) {
            return;
        }

        const threadId = getMsgId(threadStarter);
        const threadUrl = `${channelUrl}/thread/${channelId}-${threadId}`;
        if (window.location.href !== threadUrl) {
            window.location.href = threadUrl;
            return;
        }

        return {
            id: threadId,
            messages: querySelectorAll(`.p-workspace__secondary_view ${selectorMsg}`).map(msg => ({
                from: getMsgFrom(msg),
                id: getMsgId(msg),
                text: msg.textContent
            }))
        };
    }
})();
