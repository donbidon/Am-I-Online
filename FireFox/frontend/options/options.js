// " use strict";

const
    requestPeriodNode = document.getElementById("requestPeriod");

let _options;

browser.runtime.onMessage.addListener((request) => {
    // console.log(`Iframe received runtime command "${request.command}"}`);///
    // console.log(request);///
    if ("options" !== request.target) {
        return;
    }

    switch (request.command) {
        case "updateHistoryTab":
            _loadOptions().then(() => {
                _updateHistoryTab(true);
            })
            break;

        default:
            console.error(`Unsupported command "${request.command}"`);
    }
});

// Common functions {

function _loadOptions() {
    return browser.runtime.sendMessage({
        "target": "core",
        "command": "getOptions"
    }).then((options) => {
        _options = options;
    }).catch((e) => {
        console.error(e);
    });
}

function _saveOptions(reinitCore) {
    if ("undefined" === typeof(reinitCore)) {
        reinitCore = true;
    }

    return browser.storage.local.set(_options.storage).then(() => {
        if (reinitCore) {
            return browser.runtime.sendMessage({
                "target": "core",
                "command": "reinit"
            });
        }
    });
}

function _discardFormSubmission(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    return false;
}

// } Common functions

// Tab "History" functions {

function _updateHistoryTab(onInit) {
    $("#historyTableBody").html("");
    if (true === onInit) {
        $("#type").val(-1);
        $("#from").val("");
        $("#to").val("");
    }
    let history = _options.storage.history;
    if (history.length < 1) {
        return;
    }
    let
        kind = parseInt($("#kind").val()),
        from = $("#from").val(),
        to = $("#to").val();
    for (let i = 0; i < history.length; i++) {
        let
            record = history[i],
            dt = (new Date(record.t)).toLocaleString();
        if (
            (true !== onInit) && (
                ((-1 !== kind) && (kind != record.s)) ||
                (("" !== from) && (from > dt)) ||
                (("" !== to) && (dt > to))
            )
        ) {
            continue;
        }
        let
            state = (record.s ? "online" : "offline"),
            scope = {
                "dt": dt,
                "class": state,
                "state": browser.i18n.getMessage(
                    "history_state_" + state
                )
            },
            row = TENgine.r("historyRow", scope);
        $("#historyTableBody").append(row);
        if (true === onInit) {
            if (0 == i) {
                $("#from").val(dt);
            }
            if ((history.length - 1) == i) {
                $("#to").val(dt);
            }
        }
    }
}

// } Tab "History" functions

// Tab "Settings" functions {

function _requestPeriodChanged() {
    let
        v = requestPeriodNode.value,
        h = Math.floor(v / 3600),
        m = Math.floor(v / 60) - h * 60,
        s = v % 60,
        p = [h, m, s],
        options = {"requestPeriod": v};

    for (let i in p) {
        if (p[i] < 10) {
            p[i] = "0" + ("" + p[i]);
        }
    }
    document.getElementById("requestPeriodFormatted").innerText = p.join(":");
}

function _checkboxChanged(evt) {
    let
        target = $(evt.target).attr("data-target"),
        type = $(evt.target).attr("data-type"),
        checked = $(evt.target).prop("checked");
    if ("requestData" === target) {
        _options.storage[target][type] = checked;
    } else {
        _options.storage.sound.usage[type] = checked;
    }
}

function _handleSoundFilePicked(evt) {
    let
        file = this.files[0],
        reader = new FileReader(),
        type = $(evt.target).attr("data-type");

    reader.onload = (progress) => {
        _options.storage.sound.data[type] =
            progress.target.result;
        $("#modalSoundUploaded").modal();
    };
    reader.readAsDataURL(file);
}

function _playSound(evt) {
    let type = $(evt.target).attr("data-type");

    browser.runtime.sendMessage({
        "target": "core",
        "command": "playSound",
        "type": type,
        "data": _options.storage.sound.data[type]
    }).catch((e) => { console.error(e); });
}

function _settingsRestorationConfirmed() {
    browser.storage.local.clear()
        .then(() => {
            _loadOptions().then(() => {
                $("#buttonRestorationCancelled").click();
                $("#modalDefaultsRestored").modal();
                _loadOptions().then(() => {
                    _options.storage.lastOptionsTab = "settings";
                    _saveOptions();
                    _updateSettingsTab();
                    if ("production" !== _options.storage.environment) {
                        $("fieldset.development").show();
                    } else {
                        $("fieldset.development").hide();
                    }
                });
            });
        })
        .catch((e) => {
            console.error(e);
            $("#modalSettingsErrorMessage").html(e);
            $("#modalSettingsError").modal();
        });
}

function _applySettings() {
    let urls = _options.storage.urls;
    for (let i in urls) {
        let node = document.getElementById(`url[${i}]`);
        if (!node.checkValidity()) {
            node.focus();
            $("#modalSettingsErrorMessage").html(browser.i18n.getMessage(
                "message_enter_valid_url"
            ));
            $("#modalSettingsError").modal();

            return false;
        }
        urls[i] = node.value;
    }

    browser.storage.local.get(null)
        .then((storage) => {
            for (let option of
                ["requestPeriod", "requestPeriodDeviation", "responseTimeout", "historyStoragePeriod"]
            ) {
                storage[option] = document.getElementById(option).value;
            }
            storage.doNotify = _options.storage.doNotify;
            storage.sound = _options.storage.sound;
            storage.urls = urls;

            _options.storage = storage;
            _saveOptions().then(() => {
                $("#modalSettingsApplied").modal();
            });
        })
        .catch((e) => {
            console.error(e);
            $("#modalSettingsErrorMessage").html(e);
            $("#modalSettingsError").modal();
        });
}

function _updateSettingsTab() {
    for (let option of
        ["requestPeriod", "requestPeriodDeviation", "responseTimeout", "historyStoragePeriod"]
    ) {
        let node = document.getElementById(option);
        node.value = _options.storage[option];
        node.min = _options.borders[option].min;
        let max = _options.borders[option].max;
        if (max >= node.min) {
            node.max = max;
        }
    }
    _requestPeriodChanged();

    $("input[data-target]").each((i, node) => {
        let
            target = $(node).attr("data-target"),
            type = $(node).attr("data-type");

        $(node).prop(
            "checked",
            "doNotify" === target
                ? _options.storage[target][type]
                : _options.storage.sound.usage[type]
        );
    });

    let urls = _options.storage.urls;
    for (let i in urls) {
        document.getElementById(`url[${i}]`).value = urls[i];

    }

    /*
    if ("production" !== _options.storage.environment) {
        $("fieldset.development").show();
    }
    */
}

// } Tab "Settings" functions


$(document).ready(() => {

    // Cancels click at temporary disabled tabs
    $("li.disabled a").click((event) => {
        event.stopPropagation();
        event.preventDefault();
    });

    /*
    // Fills "title" attribute for tooltips using locales
    $('[data-toggle="tooltip"]').each((i, node) => {
        node.title = browser.i18n.getMessage(
            `tab_${node.title}_tooltip`
        );
    });

    // From tooltips docs
    $(() => { $("[data-toggle=tooltip]").tooltip(); });
    */

    // Tab "History" {

    $("#buttonClear").click(() => {
        _options.storage.history = [];
        browser.storage.local.set(_options.storage).then(() => {
            browser.runtime.sendMessage({
                "target": "core",
                "command": "reloadOptions"
            }).then(() => {
                $("#historyTableBody").html("");
            });
        }).catch((e) => {
            console.error(e);
        });
    });
    $("#applyHistoryFilter").click(_updateHistoryTab);
    $("#formHistory").submit(_discardFormSubmission);
    $("#formHistory").change(_updateHistoryTab);

    // } Tab "History"
    // Tab "Settings" {

    $(requestPeriodNode).change(_requestPeriodChanged);

    $("input[data-target]").click(_checkboxChanged);
    $("button.i18n_button_upload_sound").click((evt) => {
        let type = $(evt.target).attr("data-type");
        $(`input[type=file][data-type=${type}]`).click();
    });
    $("input[type=file]").change(_handleSoundFilePicked);
    $("button.i18n_button_play").click(_playSound);

    $("#buttonApply").click(_applySettings);

    $("#buttonRestoreDefaults").click(() => {
        $("#modalRestoreDefaults").modal();

        return false;
    });
    $("#buttonRestorationConfirmed").click(_settingsRestorationConfirmed);

    $("#formSettings").submit(_discardFormSubmission);

    // } Tab "Settings"
    // Tab "About" {

    // Fills Yandex.Toloka URL using locales
    $("#version").html((browser.runtime.getManifest()).version);

    // } Tab "About"

    _loadOptions().then(() => {

        $().alert();

        _updateSettingsTab();

        // Opens last tab saved to storage
        $(`[aria-controls="${_options.storage.lastOptionsTab}"]`).trigger("click");

        $("li.nav-item a:not(.disabled)").click((event) => {
            _options.storage.lastOptionsTab =
                $(event.target).attr("aria-controls");
            _saveOptions(false);
        });

        _updateHistoryTab(true);

        // Hides spinner, shows content
        $("#loader").fadeOut(() => {
            $("#globalLoader").css("display", "none");
        });
        $(".content").fadeIn();
    }).catch((e) => {
        console.error(e);
    });
});
