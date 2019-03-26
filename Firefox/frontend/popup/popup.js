browser.runtime.openOptionsPage();

browser.runtime.sendMessage({
    "target": "core",
    "command": "getState"
}).then((state) => {
    let
        stateString = state ? "online" : "offline",
        node = document.getElementById("state");

    node.innerText = browser.i18n.getMessage(`popup_state_${stateString}`);
    node.style.color = state ? "green" : "gray";
});
