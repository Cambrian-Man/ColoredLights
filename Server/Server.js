/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var Q = require('q');
var uuid = require('node-uuid');
var map = require("./Map")
var db = require("./DB")
var player = require("./Player")

var Server = (function () {
    function Server() {
        this.players = {
        };
    }
    Server.prototype.start = function (config, io) {
        var _this = this;
        this.io = io;
        Server.db = new db.DB(config['db'], function () {
            _this.map = new map.Map();
            _this.io.sockets.on("connection", function (socket) {
                return _this.connection(socket);
            });
        });
    };
    Server.prototype.connection = function (socket) {
        var _this = this;
        var id = uuid();
        var p = new player.Player(id, socket);
        this.players[p.id] = p;
        socket.emit('connection', {
            id: id
        });
        this.enterChunk(socket, 0, 0, function (chunk) {
            _this.io.sockets.emit("addPlayer", {
                id: id,
                chunkID: chunk.id,
                x: chunk.chambers[0].x,
                y: chunk.chambers[0].y
            });
            // Send the connecting player the other players.
            for(var pid in _this.players) {
                var otherPlayer = _this.players[pid];
                if(otherPlayer != p) {
                    socket.emit("addPlayer", {
                        id: otherPlayer.id,
                        chunkID: otherPlayer.chunkID,
                        x: otherPlayer.x,
                        y: otherPlayer.y
                    });
                }
            }
        });
        socket.on("enterChunk", function (data) {
            return _this.enterChunk(socket, data.x, data.y);
        });
        socket.on("requestChunk", function (data) {
            return _this.requestChunk(socket, data);
        });
        socket.on("checkChunkUpdate", function (data) {
            return _this.checkChunkUpdate(socket, data);
        });
        socket.on("playerUpdate", function (data) {
            return p.update(data, function (update) {
                for(var pid in _this.players) {
                    if(_this.players[pid] != p) {
                        _this.players[pid].socket.emit("playerUpdate", update);
                    }
                }
            });
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
    Server.prototype.checkChunkUpdate = function (socket, data) {
        var chunks = data.chunks;
        var updates = data.updates;
        for(var i = 0; i < chunks.length; i++) {
            var chunk = this.map.getChunk(chunks[i]);
            if(chunk) {
                if(chunk.updated > updates[i]) {
                    console.log(chunks[i], " updated, sending");
                    this.sendChunk(socket, chunk);
                }
            }
        }
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
    Server.prototype.scanAndCleanChunks = // Saves updated chunks, clears out unused ones.
    function () {
    };
    return Server;
})();
exports.Server = Server;
//@ sourceMappingURL=Server.js.map
