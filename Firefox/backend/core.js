/**
 * Main background process.
 */
"use strict";

let _options, _state, _timer, _requestSent = false;

browser.runtime.onMessage.addListener((request) => {
    if ("core" !== request.target) {
        return;
    }

    switch (request.command) {
        case "getState":
            return Promise.resolve(_state);

        case "getOptions":
            return getOptions();

        case "getLocale":
            return getLocale();

        case "playSound":
            _playSound(request.type, request.data);
            break; // case "playSound"

        case "reinit":
            getOptions().then((options) => {
                _options = options;

                init();
            });
            break; // case "reinit"

        case "reloadOptions":
            getOptions().then((options) => {
                _options = options;
            });
            break; // case "reloadOptions"

        default:
            console.warn(`Unsupported command "${request.command}"`);
    }
});


function getOptions() {
    return Request.getJSON("/data/options.json").then((options) => {
        return browser.storage.local.get(null).then((storage) => {
            if ("{}" === JSON.stringify(storage)) {
                options.storage =
                    JSON.parse(JSON.stringify(options.defaults));
                options.storage.version =
                    (browser.runtime.getManifest()).version;
                browser.storage.local.set(options.storage);
            } else {
                options.storage = storage;
            }
            options.borders = options.borders[options.storage.environment];

            return Promise.resolve(options);
        });
    });
}

function getLocale() {
    let response = {
        "language": browser.i18n.getUILanguage(),
        "direction": browser.i18n.getMessage("@@bidi_dir")
    };

    return Promise.resolve(response);
}

function _playSound(type, data) {
    if ("" === data) {
        (new Audio(`/data/${type}.mp3`)).play();
    } else {
        (new Audio(data)).play();
    }
}

function _setState(state) {
    if (_state === state) {
        _requestSent = false;
        return;
    }

    // console.log("Changing state to", state);

    let
        current = Date.now(),
        border = current - _options.storage.historyStoragePeriod * 60 * 60 * 1000,
        olderFound = false,
        history = _options.storage.history,
        time = (new Date(current)).toLocaleTimeString(browser.i18n.getUILanguage()),
        stateString = state ? "online" : "offline",
        iconNameTail = state ? "" : "-offline",
        title = browser.i18n.getMessage("notification_title", time);

    _state = state;

    history.push({
        "t": current,
        "s": state
    });
    // Cut history by border
    if (_options.storage.historyStoragePeriod > 0) {
        let i;

        for (i = 0; i < history.length; ++i) {
            if (history[i].t < border) {
                olderFound = true;
            } else {
                break;
            }
        }
        if (olderFound) {
            // console.log(`Found at position ${i} with t = ${history[i].t}`);///
            history = history.slice(i + 1);
        }
    }

    browser.storage.local.set(_options.storage).catch((e) => {
        console.error(e);
    });

    browser.browserAction.setIcon({
        "path": {
            "48": `/frontend/images/icon${iconNameTail}.png`,
            "96": `/frontend/images/icon@2x${iconNameTail}.png`
        }
    });

    if (_options.storage.doNotify[stateString]) {
        browser.notifications.create({
            "type": "basic",
            "iconUrl": browser.extension.getURL(
                (browser.runtime.getManifest()).icons[48]
            ),
            "title": title,
            "message": browser.i18n.getMessage(`state_${stateString}`)
        });

        if (_options.storage.sound.usage[stateString]) {
            _playSound(stateString, _options.storage.sound.data[stateString]);
        }
        _requestSent = false;
    }
    // updateHistoryTab

    browser.runtime.sendMessage({
        "target": "options",
        "command": "updateHistoryTab"
    }).catch((e) => {
    });
}

function _doRequest() {
    if (_requestSent) {
        // console.log("Request sent already");///
        return false;
    }

    _requestSent = true;

    // console.log("Sending request...");///
    XMLHttpRequestAsPromise({
        "method": "GET",
        "url": _options.storage.urls[0],
        "xhrParams": {
            "timeout": _options.storage.responseTimeout * 1000,
            "ontimeout": function (e) {
                _setState(false);
            }
        }
    }).then((xhr) => {
        _setState(true);
    }).catch((xhr) => {
        _setState(false);
    });
}

function _setTimer() {
    if ("undefined" !== typeof (_timer)) {
        clearInterval(_timer);
    }
    let
        scope = _options.storage,
        period = Math.ceil(Math.max(
            _options.borders.requestPeriod.min,
            scope.requestPeriod * (1 + (Math.random() * scope.requestPeriodDeviation * 2 - scope.requestPeriodDeviation / 2) / 100)
        ));

    _timer = setInterval(_doRequest, period * 1000);
}

function init() {
    _setTimer();
    _doRequest();
}

// console.warn("Resetting options!!!");///
// browser.storage.local.clear(); ///

getOptions().then((options) => {
    _options = options;
    init();
}).catch((e) => {
    console.error(e);
});
