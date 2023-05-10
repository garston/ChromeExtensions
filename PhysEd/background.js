(() => {
    const alarmName = "PhysEd";
    chrome.alarms.create(alarmName, {
        delayInMinutes: 0,
        periodInMinutes: 1
    });
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === alarmName) {
            chrome.tabs.query({url: 'https://app.slack.com/*'}, tabs => {
                tabs.forEach(tab => {
                    chrome.scripting.executeScript({
                        func: executeInSlack,
                        target: {tabId: tab.id}
                    });
                });
            });
        }
    });

    async function executeInSlack() {
        const allowBrowserRender = (seconds = 0) => new Promise(resolve => setTimeout(resolve, seconds * 1000));
        const getMsgCt = msg => msg.closest('.c-virtual_list__item');
        const getMsgFrom = msg => getMsgCt(msg).querySelector(selectorQa('message_sender_name')).textContent;
        const querySelectorAll = selector => [...document.querySelectorAll(selector)];
        const selectorQa = dataQa => `[data-qa="${dataQa}"]`;

        const selectorMsg = '.c-message_kit__blocks';
        const [threadStarter] = querySelectorAll(selectorMsg).filter(msg =>
            msg.textContent.startsWith('Reminder: PhysEd - ') &&
            getMsgFrom(msg) === 'Slackbot' &&
            ['Today', 'Yesterday'].some(day => getMsgCt(msg).querySelector('.c-timestamp').getAttribute('aria-label').startsWith(`${day} at `))
        ).slice(-1);
        if (!threadStarter) {
            return;
        }

        threadStarter.dispatchEvent(new MouseEvent('mouseover', {'bubbles': true}));
        getMsgCt(threadStarter).querySelector(selectorQa('start_thread')).click();
        await allowBrowserRender(4);

        const threadMsgs = querySelectorAll(`.p-workspace__secondary_view ${selectorMsg}`).map(msg => ({
            from: getMsgFrom(msg),
            id: getMsgCt(msg).getAttribute('data-item-key'),
            text: msg.textContent
        }));
        document.querySelector(selectorQa('close_flexpane')).click();
        console.log(threadMsgs);
    }
})();
