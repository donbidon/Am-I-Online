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

        default:
            console.warn(`Unsupported command "${request.command}"`);
    }
});


function getOptions() {
    return Request.getJSON("/data/options.json").then((options) => {
        let response = options;
        return browser.storage.local.get(null).then((storage) => {
            if ("{}" === JSON.stringify(storage)) {
                response["storage"] =
                    JSON.parse(JSON.stringify(options.defaults));
                response["storage"]["version"] =
                    (browser.runtime.getManifest()).version;
                browser.storage.local.set(response["storage"]);
            } else {
                response["storage"] = storage;
            }

            return Promise.resolve(response);
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
    _requestSent = false;
    if (_state === state) {
        return;
    }

    let
        time = (new Date).toLocaleTimeString(browser.i18n.getUILanguage()),
        stateString = state ? "online" : "offline",
        iconNameTail = state ? "" : "-offline",
        title = browser.i18n.getMessage("notification_title", time);

    _state = state;

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
    }
}

function _doRequest() {
    if (_requestSent) {
        return false;
    }

    _requestSent = true;

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
            _options.requestPeriodBorders.min,
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
