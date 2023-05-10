(() => {
    const channelThreads = {};

    const alarmName = "PhysEd";
    chrome.alarms.create(alarmName, {
        delayInMinutes: 0,
        periodInMinutes: 1
    });
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name !== alarmName) {
            return;
        }

        chrome.tabs.query({url: 'https://app.slack.com/*'}, async (tabs) => {
            for (const tab of tabs) {
                const channelUrl = tab.url.split('/').slice(0, 6).join('/');
                const channelId = channelUrl.split('/').slice(-1)[0];
                const thread = (await new Promise(resolve => chrome.scripting.executeScript({
                    args: [channelUrl, channelId],
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

            console.log(channelThreads);
        });
    });

    function executeInSlack(channelUrl, channelId) {
        const getMsgCt = msg => msg.closest('.c-virtual_list__item');
        const getMsgFrom = msg => getMsgCt(msg).querySelector('[data-qa="message_sender_name"]').textContent;
        const getMsgId = msg => getMsgCt(msg).getAttribute('data-item-key');
        const querySelectorAll = selector => [...document.querySelectorAll(selector)];

        const selectorMsg = '.c-message_kit__blocks';
        const [threadStarter] = querySelectorAll(`.p-workspace__primary_view ${selectorMsg}`).filter(msg =>
            msg.textContent.startsWith('Reminder: PhysEd - ') &&
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
