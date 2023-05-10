(() => {
    const scriptUrl = '';

    const alarmName = "PhysEd";
    chrome.alarms.create(alarmName, {
        delayInMinutes: 0,
        periodInMinutes: 1
    });
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === alarmName) {
            chrome.tabs.query({url: 'https://app.slack.com/*'}, tabs => {
                tabs.forEach(tab => {
                    fetch(`${scriptUrl}?slackUrl=${tab.url}`).then(res => res.json()).then(msgs => {
                        chrome.scripting.executeScript({
                            args: [msgs],
                            func: executeInSlack,
                            target: {tabId: tab.id}
                        });
                    });
                });
            });
        }
    });

    async function executeInSlack(outgoingMsgs) {
        const allowBrowserRender = () => new Promise(resolve => setTimeout(resolve));
        const getMsgCt = msg => msg.closest('.c-virtual_list__item');
        const hasCls = (el, cls) => [...el.classList].includes(cls);
        const querySelectorAll = selector => [...document.querySelectorAll(selector)];
        const selectorQa = dataQa => `[data-qa="${dataQa}"]`;

        for (const msg of outgoingMsgs) {
            document.querySelector('.ql-editor p').innerHTML = msg;
            await allowBrowserRender();
            document.querySelector(selectorQa('texty_send_button')).click();
        }

        const clsDivider = 'c-message_list__day_divider__label';
        const selectorMsg = '.c-message_kit__blocks';
        const dividersAndMsgs = querySelectorAll(`${selectorMsg}, .${clsDivider}`);
        const findDividerIndex = text => dividersAndMsgs.findIndex(el => hasCls(el, clsDivider) && el.textContent === text);
        const yesterdayIndex = findDividerIndex('Yesterday');
        if (yesterdayIndex === -1) {
            return;
        }

        const threadMsgs = [];
        const todayIndex = findDividerIndex('Today');
        const threadStarterMsgs = dividersAndMsgs.slice(yesterdayIndex + 1, todayIndex === -1 ? undefined : todayIndex).filter(msg => !hasCls(msg.previousSibling, 'c-message_kit__broadcast_preamble'));
        for (const threadStarterMsg of threadStarterMsgs) {
            threadStarterMsg.dispatchEvent(new MouseEvent('mouseover', {'bubbles': true}));
            getMsgCt(threadStarterMsg).querySelector(selectorQa('start_thread')).click();
            await allowBrowserRender();

            threadMsgs.push(querySelectorAll(`.p-workspace__secondary_view ${selectorMsg}`).map(msg => ({
                from: getMsgCt(msg).querySelector(selectorQa('message_sender_name')).textContent,
                id: getMsgCt(msg).getAttribute('data-item-key'),
                text: msg.textContent
            })));
            document.querySelector(selectorQa('close_flexpane')).click();
            await allowBrowserRender();
        }
        console.log(threadMsgs);
    }
})();
