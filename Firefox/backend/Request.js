"use strict";

/**
 * Sends requests in Promise context.
 */
class Request {
    /**
     * Sends GET-request in Promise context.
     *
     * @param string path
     *
     * @return Promise
     */
    static get(path) {
        return new Promise((resolve, reject) => {
            XMLHttpRequestAsPromise({
                "method": "GET",
                "url": path
            }).then((xhr) => {
                resolve(xhr.response);
            }).catch((xhr) => {
                reject({
                    "status": xhr.status,
                    "statusText": xhr.statusText
                });
            });
        });
    }

    /**
     * Sends GET-request in Promise context and parses JSON-repsonse.
     *
     * @param string path
     *
     * @return Promise
     */
    static getJSON(path, reviver) {
        return new Promise((resolve, reject) => {
            this.get(path).then((raw) => {
                let parsed = "undefined" === typeof(reviver)
                    ? JSON.parse(raw)
                    : JSON.parse(raw, reviver);
                resolve(parsed);
            }).catch((e) => {
                reject(e);
            });
        });
    }
}
