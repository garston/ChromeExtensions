(() => {
    const channelThreads = {};

    const statusIn = 'in';
    const statusMaybe = 'maybe';
    const statusOut = 'out';
    const statusUnknown = 'unknown';
    const emptyStatusNamesObj = () => ({
        [statusIn]: [],
        [statusMaybe]: [],
        [statusOut]: [],
        [statusUnknown]: []
    });
    let statusNames = emptyStatusNamesObj();

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
            const scriptMsgPrefix = `${scriptName} -`
            const reminderMsgPrefix = `Reminder: ${scriptMsgPrefix}`;
            const selectorThreadPane = '.p-workspace__secondary_view';

            for (const tab of tabs) {
                const channelUrl = tab.url.split('/').slice(0, 6).join('/');
                const thread = await executeScript(tab, slackGetThread, [channelUrl, {
                    reminderMsgPrefix,
                    selectorThreadPane
                }]);

                const existingThread = channelThreads[channelUrl];
                if (!thread) {
                    delete channelThreads[channelUrl];
                } else if (existingThread?.id !== thread.id) {
                    channelThreads[channelUrl] = thread;
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
                const newStatus = msg.text.trim().replace(/\s|&nbsp;/gi, ' ').replace(/\u200B/g, '').split(' ').reduce((playerStatusArray, word, index, words) => {
                    let status;
                    if (/^in\W*$/i.test(word)) {
                        status = statusIn;
                    } else if (/^(maybe|50\W?50)\W*$/i.test(word)) {
                        status = statusMaybe;
                    } else if (/^out\W*$/i.test(word)) {
                        status = statusOut;
                    } else {
                        return playerStatusArray;
                    }

                    let isPhraseForOtherPlayer;
                    words.slice(0, index).reverse().some(wordInPhrase => {
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

                statusArrayByName[msg.from] = newStatus || statusArrayByName[msg.from] || statusUnknown;
            });

            const newStatusNames = emptyStatusNamesObj();
            Object.keys(statusArrayByName).sort().forEach(name => newStatusNames[statusArrayByName[name]].push(name));

            if (JSON.stringify(statusNames) !== JSON.stringify(newStatusNames)) {
                for (const tab of tabs) {
                    const statusNamesStrings = Object.entries(newStatusNames).
                        filter(([_, names]) => names.length).
                        map(([status, names]) => `${status} (${names.length}): ${names.join(', ')}`);
                    const statusMsg = [scriptMsgPrefix, ...statusNamesStrings].map(msgLine => `<p>${msgLine}</p>`).join('');

                    await executeScript(tab, slackSendMsg, [statusMsg, {selectorThreadPane}]);
                }

                statusNames = newStatusNames;
            }
        });
    });

    async function executeScript(tab, func, args) {
        await chrome.tabs.update(tab.id, {active: true}); // new messages aren't rendered until Slack has focus
        return (await new Promise(resolve => chrome.scripting.executeScript({
            args,
            func,
            target: {tabId: tab.id}
        }, resolve)))[0].result;
    }

    function slackGetThread(channelUrl, consts) {
        const getMsgCt = msg => msg.closest('.c-virtual_list__item');
        const getMsgFrom = msg => getMsgCt(msg).querySelector('[data-qa="message_sender_name"]').textContent;
        const getMsgId = msg => getMsgCt(msg).getAttribute('data-item-key');
        const querySelectorAll = selector => [...document.querySelectorAll(selector)];

        const selectorMsg = '.c-message_kit__blocks';
        const [threadStarter] = querySelectorAll(`.p-workspace__primary_view ${selectorMsg}`).filter(msg =>
            msg.textContent.startsWith(consts.reminderMsgPrefix) &&
            getMsgFrom(msg) === 'Slackbot' &&
            ['Today', 'Yesterday'].some(day => getMsgCt(msg).querySelector('.c-timestamp').getAttribute('aria-label').startsWith(`${day} at `))
        ).slice(-1);
        if (!threadStarter) {
            return;
        }

        const id = getMsgId(threadStarter);
        if (window.location.href !== `${channelUrl}/thread/${channelUrl.split('/').slice(-1)[0]}-${id}`) {
            // need to navigate to thread by clicking b/c setting window.location.href will cause Slack to redirect to channel URL when thread has no messages
            threadStarter.dispatchEvent(new MouseEvent('mouseover', {'bubbles': true}));
            getMsgCt(threadStarter).querySelector('[data-qa="start_thread"]').click();
            return;
        }

        return {
            id,
            messages: querySelectorAll(`${consts.selectorThreadPane} ${selectorMsg}`).map(msg => ({
                from: getMsgFrom(msg),
                id: getMsgId(msg),
                text: msg.textContent
            }))
        };
    }

    async function slackSendMsg(msg, consts) {
        document.querySelector(`${consts.selectorThreadPane} .ql-editor`).innerHTML = msg;
        await new Promise(resolve => setTimeout(resolve));
        document.querySelector('[aria-label="Send reply"]').click();
    }
})();
