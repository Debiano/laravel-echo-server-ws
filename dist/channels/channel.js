"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Channel = void 0;
var presence_channel_1 = require("./presence-channel");
var private_channel_1 = require("./private-channel");
var log_1 = require("./../log");
var Redis = require('ioredis');
var Channel = (function () {
    function Channel(io, options) {
        this.io = io;
        this.options = options;
        this._privateChannels = ['private-*', 'presence-*'];
        this._clientEvents = ['client-*'];
        this.private = new private_channel_1.PrivateChannel(options);
        this.presence = new presence_channel_1.PresenceChannel(io, options);
        this._redis = new Redis(options.databaseConfig.redis);
        if (this.options.devMode) {
            log_1.Log.success('Channels are ready.');
        }
    }
    Channel.prototype.join = function (socket, data) {
        if (data.channel) {
            if (this.isPrivate(data.channel)) {
                this.joinPrivate(socket, data);
            }
            else {
                socket.join(data.channel);
                this.onJoin(socket, data.channel);
            }
        }
    };
    Channel.prototype.clientEvent = function (socket, data) {
        try {
            data = JSON.parse(data);
        }
        catch (e) {
            data = data;
        }
        if (data.event && data.channel) {
            if (this.isClientEvent(data.event) &&
                this.isPrivate(data.channel) &&
                this.isInChannel(socket, data.channel)) {
                socket.to(data.channel).emit(data.event, data.channel, data.data);
                if (this.options.additionalPublishes.whisper === true) {
                    log_1.Log.info("Whispering true");
                    if (this.options.additionalPublishes.whisperTyping === true || data.event !== "client-typing") {
                        log_1.Log.info("WhisperingTyping true or client event");
                        this._redis.publish('ClientChannelActions', JSON.stringify({
                            "event": data.event,
                            "channel": data.channel,
                            "data": data.data,
                            "socket": socket.id,
                        }));
                    }
                }
            }
        }
    };
    Channel.prototype.leave = function (socket, channel, reason) {
        if (channel) {
            if (this.isPresence(channel)) {
                this.presence.leave(socket, channel);
            }
            socket.leave(channel);
            if (this.options.devMode) {
                log_1.Log.info("[" + new Date().toISOString() + "] - " + socket.id + " left channel: " + channel + " (" + reason + ")");
            }
            if (this.options.additionalPublishes.leaveChannel === true) {
                this._redis.publish('ClientChannelActions', JSON.stringify({
                    "event": "ClientLeavedChannel",
                    "channel": channel,
                    "socket": socket.id,
                }));
            }
        }
    };
    Channel.prototype.isPrivate = function (channel) {
        var isPrivate = false;
        this._privateChannels.forEach(function (privateChannel) {
            var regex = new RegExp(privateChannel.replace('\*', '.*'));
            if (regex.test(channel))
                isPrivate = true;
        });
        return isPrivate;
    };
    Channel.prototype.joinPrivate = function (socket, data) {
        var _this = this;
        this.private.authenticate(socket, data).then(function (res) {
            socket.join(data.channel);
            if (_this.isPresence(data.channel)) {
                var member = res.channel_data;
                try {
                    member = JSON.parse(res.channel_data);
                }
                catch (e) { }
                _this.presence.join(socket, data.channel, member);
            }
            _this.onJoin(socket, data.channel);
        }, function (error) {
            if (_this.options.devMode) {
                log_1.Log.error(error.reason);
            }
            _this.io.sockets.to(socket.id)
                .emit('subscription_error', data.channel, error.status);
        });
    };
    Channel.prototype.isPresence = function (channel) {
        return channel.lastIndexOf('presence-', 0) === 0;
    };
    Channel.prototype.onJoin = function (socket, channel) {
        if (this.options.devMode) {
            log_1.Log.info("[" + new Date().toISOString() + "] - " + socket.id + " joined channel: " + channel);
        }
        if (this.options.additionalPublishes.joinChannel === true) {
            this._redis.publish('ClientChannelActions', JSON.stringify({
                "event": "ClientJoinedChannel",
                "channel": channel,
                "socket": socket.id,
            }));
        }
    };
    Channel.prototype.isClientEvent = function (event) {
        var isClientEvent = false;
        this._clientEvents.forEach(function (clientEvent) {
            var regex = new RegExp(clientEvent.replace('\*', '.*'));
            if (regex.test(event))
                isClientEvent = true;
        });
        return isClientEvent;
    };
    Channel.prototype.isInChannel = function (socket, channel) {
        return socket.rooms.has(channel);
    };
    return Channel;
}());
exports.Channel = Channel;
