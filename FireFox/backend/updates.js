/**
 * Updates storage according to previous add-on version.
 *
 * @since 0.1.3
 */
"use strict";

getOptions().then((options) => {
    let
        actual = (browser.runtime.getManifest()).version,
        stored =
            "undefined" !== typeof(options.storage.version)
                ? options.storage.version
                : "0.1.0";

    if (actual < stored) {
        throw new Error("Code version downgrading detected!");
    } else if (actual === stored) {
        return;
    }
    switch (stored) {
        case "0.1.1":
        case "0.1.2":
            options.storage.history = [];
    }
    options.storage.version = actual;
    options.storage.lastOptionsTab = "about";
    browser.storage.local.set(options.storage).then(() => {
        _options = options;
        // init();
    });
    console.warn(`Storage updated from ${stored} to ${actual} version`);
    browser.runtime.openOptionsPage();
}).catch((e) => {
    console.error(e);
});
