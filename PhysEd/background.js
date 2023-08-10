(() => {
    (() => {
        const statusIn = 'in';
        const statusMaybe = 'maybe';
        const statusOut = 'out';
        const statusUnknown = 'unknown';
        const emptyGameStatusObj = () => ({
            gameOnOff: '',
            players: {
                [statusIn]: [],
                [statusMaybe]: [],
                [statusOut]: [],
                [statusUnknown]: []
            }
        });

        async function executeScript(tabs, func, args) {
            const results = [];
            for (const tab of tabs) {
                await chrome.tabs.update(tab.id, {active: true}); // new messages aren't rendered until Slack has focus
                results.push((await new Promise(resolve => chrome.scripting.executeScript({
                    args,
                    func,
                    target: {tabId: tab.id}
                }, resolve)))[0].result);
            }
            return results;
        }

        const objectsEqual = (o1, o2) => JSON.stringify(o1) === JSON.stringify(o2);

        let state;

        const scriptName = 'PhysEd';
        chrome.alarms.create(scriptName, {
            delayInMinutes: 0,
            periodInMinutes: 1
        });
        chrome.alarms.onAlarm.addListener(async (alarm) => {
            if (alarm.name !== scriptName) {
                return;
            }

            const scriptMsgPrefix = `${scriptName} -`
            const reminderMsgPrefix = `Reminder: ${scriptMsgPrefix}`;
            const selectorThreadPane = '.p-workspace__secondary_view';

            const tabs = await chrome.tabs.query({url: 'https://app.slack.com/*'});
            const threads = await executeScript(tabs, slackGetThread, [{
                reminderMsgPrefix,
                selectorThreadPane
            }]);

            if (threads.some(t => !t)) {
                console.log('not all tabs are ready', threads);
                return;
            }

            if (!state || !objectsEqual(Object.keys(state.threadMsgs).sort(), threads.map(t => t.id).sort())) {
                console.log('navigated to new thread(s)', state?.threadMsgs, threads);
                state = {
                    gameStatus: emptyGameStatusObj(),
                    threadMsgs: {}
                };
            }

            const threadMsgs = threads.map(({id, messages}) => {
                const existingMsgs = state.threadMsgs[id];
                if (existingMsgs) {
                    const newMsgsIndex = existingMsgs.findIndex(m => m.id === messages[0].id);
                    messages = [...existingMsgs.slice(0, newMsgsIndex === -1 ? undefined : newMsgsIndex), ...messages];
                }

                state.threadMsgs[id] = messages;
                return messages;
            });

            const statusArrayByName = {};
            const messages = threadMsgs.flat().filter(msg => ![reminderMsgPrefix, scriptMsgPrefix].some(prefix => msg.text.startsWith(prefix)));
            messages.forEach(msg => {
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

            const gameStatus = emptyGameStatusObj();
            Object.keys(statusArrayByName).sort().forEach(name => gameStatus.players[statusArrayByName[name]].push(name));

            gameStatus.gameOnOff = messages.reduce((gameOnOff, m) => {
                const match = m.text.match(/^game (on|off)/i);
                return match ? `${match[0].toUpperCase()} has been called ${m.timestamp} by ${m.from}!` : gameOnOff;
            }, gameStatus.gameOnOff);

            if (!objectsEqual(state.gameStatus, gameStatus)) {
                console.log('game status changed', threadMsgs, state.gameStatus, gameStatus);

                const statusNamesStrings = Object.entries(gameStatus.players).
                    filter(([_, names]) => names.length).
                    map(([status, names]) => `${status} (${names.length}): ${names.join(', ')}`);
                const statusMsg = [`${scriptMsgPrefix} ${gameStatus.gameOnOff}`, ...statusNamesStrings].map(msgLine => `<p>${msgLine}</p>`).join('');
                await executeScript(tabs, slackSendMsg, [statusMsg, {selectorThreadPane}]);

                state.gameStatus = gameStatus;
            }
        });
    })();

    function slackGetThread(consts) {
        const getMsgCt = msg => msg.closest('.c-virtual_list__item');
        const getMsgFrom = msg => getMsgCt(msg).querySelector('[data-qa="message_sender_name"]').textContent;
        const getMsgId = msg => getMsgCt(msg).getAttribute('data-item-key');
        const querySelectorAll = selector => [...document.querySelectorAll(selector)];

        const selectorMsg = '.c-message_kit__blocks';
        const [threadStarter] = querySelectorAll(`.p-workspace__primary_view ${selectorMsg}`).filter(msg =>
            msg.textContent.startsWith(consts.reminderMsgPrefix) &&
            getMsgFrom(msg) === 'Slackbot'
        ).slice(-1);
        if (!threadStarter) {
            return;
        }

        const id = getMsgId(threadStarter);
        if (!window.location.href.endsWith(id)) {
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
                text: msg.textContent,
                timestamp: getMsgCt(msg).querySelector('.c-timestamp').getAttribute('aria-label')
            }))
        };
    }

    async function slackSendMsg(msg, consts) {
        document.querySelector(`${consts.selectorThreadPane} .ql-editor`).innerHTML = msg;
        await new Promise(resolve => setTimeout(resolve));
        document.querySelector('[aria-label="Send reply"]').click();
    }
})();
