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
                        args: [['a', 'b', 'c'], 0],
                        func: sendMsg,
                        target: {tabId: tab.id}
                    })
                });
            });
        }
    });

    function sendMsg(msgs, index) {
        const msg = msgs[index];
        if (msg) {
            document.querySelector('.ql-editor p').innerHTML = msg;
            setTimeout(() => {
                document.querySelector('.c-wysiwyg_container__button--send').click();
                sendMsg(msgs, index + 1);
            });
        }
    }
})();
