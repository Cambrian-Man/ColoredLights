/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var Q = require('q');
var uuid = require('node-uuid');
var map = require("./Map")
var db = require("./DB")

var Server = (function () {
    function Server() {
        this.players = {
        };
    }
    Server.prototype.start = function (config, io) {
        var _this = this;
        Server.db = new db.DB(config['db'], function () {
            _this.map = new map.Map();
            io.sockets.on("connection", function (socket) {
                return _this.connection(socket);
            });
        });
    };
    Server.prototype.connection = function (socket) {
        var _this = this;
        var id = uuid();
        var player = new Player(id, socket);
        this.players[player.id] = player;
        socket.emit('connection', {
            id: id
        });
        this.enterChunk(socket, 0, 0, function (chunk) {
            socket.emit("addPlayer", {
                id: id,
                chunk: chunk.id,
                x: chunk.chambers[0].x,
                y: chunk.chambers[0].y
            });
        });
        socket.on("enterChunk", function (data) {
            return _this.enterChunk(socket, data.x, data.y);
        });
        socket.on("requestChunk", function (data) {
            return _this.requestChunk(socket, data);
        });
    };
    Server.prototype.enterChunk = function (socket, x, y, callback) {
        var _this = this;
        this.map.load(x, y).then(function (chunk) {
            _this.map.activate(chunk).then(function (adjChunks) {
                _this.offerChunk(socket, chunk);
                for(var i = 0; i < adjChunks.length; i++) {
                    _this.offerChunk(socket, adjChunks[i]);
                }
                socket.emit("entered", {
                    chunk: chunk.id
                });
                if(callback) {
                    callback(chunk);
                }
            });
        });
    };
    Server.prototype.offerChunk = function (socket, chunk) {
        socket.emit('offerChunk', {
            id: chunk.id,
            x: chunk.chunkX,
            y: chunk.chunkY,
            adjacent: chunk.adjacent,
            updated: chunk.updated
        });
    };
    Server.prototype.requestChunk = function (socket, data) {
        var _this = this;
        var x = data.x;
        var y = data.y;
        this.map.load(x, y).then(function (chunk) {
            _this.sendChunk(socket, chunk);
        });
    };
    Server.prototype.sendChunk = function (socket, chunk) {
        var codes = chunk.toArray();
        socket.emit('chunk', {
            chunk: codes,
            x: chunk.chunkX,
            y: chunk.chunkY,
            id: chunk.id,
            adjacent: chunk.adjacent,
            updated: chunk.updated
        });
    };
    return Server;
})();
exports.Server = Server;
var Player = (function () {
    function Player(id, socket) {
        this.id = id;
        this.socket = socket;
    }
    return Player;
})();
exports.Player = Player;
//@ sourceMappingURL=Server.js.map
