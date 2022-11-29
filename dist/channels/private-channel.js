"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateChannel = void 0;
var request = require('request');
var url = require('url');
var log_1 = require("./../log");
var Bottleneck = require('bottleneck');
var PrivateChannel = (function () {
    function PrivateChannel(options) {
        this.options = options;
        this.request = request;
        this.limiter = new Bottleneck({
            maxConcurrent: options.maxConcurrentAuthRequests
        });
    }
    PrivateChannel.prototype.authenticate = function (socket, data) {
        var _this = this;
        var options = {
            url: this.clientAuthUri(data) || (this.authHost(socket) + this.options.authEndpoint),
            form: { channel_name: data.channel, socket_id: socket.id },
            headers: (data.auth && data.auth.headers) ? data.auth.headers : {},
            rejectUnauthorized: false
        };
        if (this.options.devMode) {
            log_1.Log.info("[" + new Date().toISOString() + "] - Sending auth request to: " + options.url + "\n");
        }
        return this.limiter.schedule(function () { return _this.serverRequest(socket, options); });
    };
    PrivateChannel.prototype.clientAuthUri = function (data) {
        var client = this.appClients(data)[0];
        return ((client === null || client === void 0 ? void 0 : client.host) || '') + ((client === null || client === void 0 ? void 0 : client.authEndpoint) || '');
    };
    PrivateChannel.prototype.appClients = function (data) {
        var _a;
        var clients = [];
        var app = (_a = data === null || data === void 0 ? void 0 : data.auth) === null || _a === void 0 ? void 0 : _a.app;
        if (app === undefined)
            return clients;
        for (var _i = 0, _b = this.options.clients; _i < _b.length; _i++) {
            var client = _b[_i];
            if ((client === null || client === void 0 ? void 0 : client.appId) === app) {
                clients.push(client);
            }
        }
        ;
        return clients;
    };
    PrivateChannel.prototype.authHost = function (socket) {
        var authHosts = (this.options.authHost) ?
            this.options.authHost : this.options.host;
        if (typeof authHosts === "string") {
            authHosts = [authHosts];
        }
        var authHostSelected = authHosts[0] || 'http://localhost';
        if (socket.request.headers.referer) {
            var referer = url.parse(socket.request.headers.referer);
            for (var _i = 0, authHosts_1 = authHosts; _i < authHosts_1.length; _i++) {
                var authHost = authHosts_1[_i];
                authHostSelected = authHost;
                if (this.hasMatchingHost(referer, authHost)) {
                    authHostSelected = referer.protocol + "//" + referer.host;
                    break;
                }
            }
            ;
        }
        if (this.options.devMode) {
            log_1.Log.error("[" + new Date().toISOString() + "] - Preparing authentication request to: " + authHostSelected);
        }
        return authHostSelected;
    };
    PrivateChannel.prototype.hasMatchingHost = function (referer, host) {
        return (referer.hostname && referer.hostname.substr(referer.hostname.indexOf('.')) === host) ||
            referer.protocol + "//" + referer.host === host ||
            referer.host === host;
    };
    PrivateChannel.prototype.serverRequest = function (socket, options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            options.headers = _this.prepareHeaders(socket, options);
            var body;
            _this.request.post(options, function (error, response, body, next) {
                if (error) {
                    if (_this.options.devMode) {
                        log_1.Log.error("[" + new Date().toISOString() + "] - Error authenticating " + socket.id + " for " + options.form.channel_name);
                        log_1.Log.error(error);
                    }
                    reject({ reason: 'Error sending authentication request.', status: 0 });
                }
                else if (response.statusCode !== 200) {
                    if (_this.options.devMode) {
                        log_1.Log.warning("[" + new Date().toISOString() + "] - " + socket.id + " could not be authenticated to " + options.form.channel_name);
                        log_1.Log.error(response.body);
                    }
                    reject({ reason: 'Client can not be authenticated, got HTTP status ' + response.statusCode, status: response.statusCode });
                }
                else {
                    if (_this.options.devMode) {
                        log_1.Log.info("[" + new Date().toISOString() + "] - " + socket.id + " authenticated for: " + options.form.channel_name);
                    }
                    try {
                        body = JSON.parse(response.body);
                    }
                    catch (e) {
                        body = response.body;
                    }
                    resolve(body);
                }
            });
        });
    };
    PrivateChannel.prototype.prepareHeaders = function (socket, options) {
        options.headers['Cookie'] = options.headers['Cookie'] || socket.request.headers.cookie;
        options.headers['X-Requested-With'] = 'XMLHttpRequest';
        options.headers["User-Agent"] = socket.request.headers["user-agent"];
        options.headers["X-Forwarded-For"] = socket.request.headers["x-forwarded-for"] || socket.conn.remoteAddress;
        return options.headers;
    };
    return PrivateChannel;
}());
exports.PrivateChannel = PrivateChannel;
