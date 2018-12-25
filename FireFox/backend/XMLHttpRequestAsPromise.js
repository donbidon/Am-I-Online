"use strict";

/**
 * Sends request in Promise context.
 *
 * Calls resolve/reject Promise methods passing XMLHttpRequest object.
 *
 * @param Object args
 * - string method
 * - string url
 * - Object params
 * - Object headers (optionally)
 * - Object xhrParams (optionally, onload/onerror callbacks can't be overloaded)
 *
 * @return Promise
 */
function XMLHttpRequestAsPromise(args) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(args.method, args.url);

        if (args.headers) {
            Object.keys(args.headers).forEach((key) => {
                xhr.setRequestHeader(key, args.headers[key]);
            });
        }

        if (args.xhrParams) {
            Object.keys(args.xhrParams).forEach((key) => {
                xhr[key] = args.xhrParams[key];
            });
        }

        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(this);
            } else {
                reject(this);
            }
        };
        xhr.onerror = function () {
            reject(this);
        };

        let params = args.params;
        if (params && "object" === typeof(params)) {
            params = Object.keys(params).map((key) => {
                return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            }).join('&');
        }

        xhr.send(params);
    });
}
