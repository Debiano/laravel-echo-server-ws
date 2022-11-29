"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpApi = void 0;
var log_1 = require("./../log");
var url = require('url');
var HttpApi = (function () {
    function HttpApi(io, channel, express, options) {
        this.io = io;
        this.channel = channel;
        this.express = express;
        this.options = options;
    }
    HttpApi.prototype.init = function () {
        var _this = this;
        this.corsMiddleware();
        this.express.get('/', function (req, res) { return _this.getRoot(req, res); });
        this.express.get('/apps/:appId/status', function (req, res) { return _this.getStatus(req, res); });
        this.express.get('/apps/:appId/channels', function (req, res) { return _this.getChannels(req, res); });
        this.express.get('/apps/:appId/channels/:channelName', function (req, res) { return _this.getChannel(req, res); });
        this.express.get('/apps/:appId/channels/:channelName/users', function (req, res) { return _this.getChannelUsers(req, res); });
    };
    HttpApi.prototype.corsMiddleware = function () {
        var _this = this;
        if (this.options.allowCors) {
            this.express.use(function (req, res, next) {
                res.header('Access-Control-Allow-Origin', _this.options.allowOrigin);
                res.header('Access-Control-Allow-Methods', _this.options.allowMethods);
                res.header('Access-Control-Allow-Headers', _this.options.allowHeaders);
                next();
            });
        }
    };
    HttpApi.prototype.getRoot = function (req, res) {
        res.send('OK');
    };
    HttpApi.prototype.getStatus = function (req, res) {
        res.json({
            subscription_count: this.io.engine.clientsCount,
            uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
        });
    };
    HttpApi.prototype.getChannels = function (req, res) {
        var prefix = url.parse(req.url, true).query.filter_by_prefix;
        var rooms = this.io.sockets.adapter.rooms;
        var channels = {};
        Object.keys(rooms).forEach(function (channelName) {
            if (rooms[channelName].sockets[channelName]) {
                return;
            }
            if (prefix && !channelName.startsWith(prefix)) {
                return;
            }
            channels[channelName] = {
                subscription_count: rooms[channelName].length,
                occupied: true
            };
        });
        res.json({ channels: channels });
    };
    HttpApi.prototype.getChannel = function (req, res) {
        var channelName = req.params.channelName;
        var room = this.io.sockets.adapter.rooms[channelName];
        var subscriptionCount = room ? room.length : 0;
        var result = {
            subscription_count: subscriptionCount,
            occupied: !!subscriptionCount
        };
        if (this.channel.isPresence(channelName)) {
            this.channel.presence.getMembers(channelName).then(function (members) {
                result['user_count'] = members.reduce(function (map, member) { return map.set(member.user_id, member); }, new Map()).size;
                res.json(result);
            });
        }
        else {
            res.json(result);
        }
    };
    HttpApi.prototype.getChannelUsers = function (req, res) {
        var channelName = req.params.channelName;
        if (!this.channel.isPresence(channelName)) {
            return this.badResponse(req, res, 'User list is only possible for Presence Channels');
        }
        this.channel.presence.getMembers(channelName).then(function (members) {
            var users = __spreadArrays(members.reduce(function (map, member) { return map.set(member.user_id, {
                id: member.user_id,
                user_info: member.user_info
            }); }, new Map()));
            res.json({ users: users });
        }, function (error) { return log_1.Log.error(error); });
    };
    HttpApi.prototype.badResponse = function (req, res, message) {
        res.statusCode = 400;
        res.json({ error: message });
        return false;
    };
    return HttpApi;
}());
exports.HttpApi = HttpApi;
