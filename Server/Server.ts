/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />

var Q: QStatic = require('q');
var uuid = require('node-uuid');
import map = module("./Map");
import db = module("./DB");
import player = module("./Player");
import socketio = module('socket.io');

export class Server {
    private map: map.Map;
    static db: db.DB;
    private players: Object = {};
    private io;

    constructor() {

    }

    start(config: Object, io: SocketManager) {
        this.io = io;
        Server.db = new db.DB(config['db'], () => {
            this.map = new map.Map(config['map']);
            this.io.sockets.on("connection", (socket: Socket) => this.connection(socket));
        });
    }

    connection(socket: Socket) {
        var id: string = <string> uuid();
        var p: player.Player = new player.Player(id, socket);
        this.players[p.id] = p;
        socket.emit('connection', { id: id });

        this.enterChunk(socket, 0, 0, (chunk: map.Chunk) => {
            this.io.sockets.emit("addPlayer", { id: id, chunkID: chunk.id, x: chunk.chambers[0].x, y: chunk.chambers[0].y });

            // Send the connecting player the other players.
            for (var pid in this.players) {
                var otherPlayer: player.Player = this.players[pid];
                if (otherPlayer != p) {
                    socket.emit("addPlayer", { id: otherPlayer.id, chunkID: otherPlayer.chunkID, x: otherPlayer.x, y: otherPlayer.y});
                }
            }
        });

        socket.on("enterChunk", (data) => this.enterChunk(socket, data.x, data.y));
        socket.on("requestChunk", (data) => this.requestChunk(socket, data));
        socket.on("checkChunkUpdate", (data) => this.checkChunkUpdate(socket, data));
        socket.on("playerUpdate", (data) => p.update(data, (update) => {
            for (var pid in this.players) {
                if (this.players[pid] != p) {
                    this.players[pid].socket.emit("playerUpdate", update);
                }
            }
        }));
    }

    enterChunk(socket: Socket, x: number, y: number, callback?:(chunk: map.Chunk) => any) {
        this.map.load(x, y).then((chunk: map.Chunk) => {
            this.map.activate(chunk).then((adjChunks: map.Chunk[]) => {
                this.offerChunk(socket, chunk);
                for (var i = 0; i < adjChunks.length; i++) {
                    this.offerChunk(socket, adjChunks[i]);
                }
                
                socket.emit("entered", { chunk: chunk.id });

                if (callback) {
                    callback(chunk);
                }
            });
        });
    }
    
    checkChunkUpdate(socket: Socket, data) {
        var chunks: string[] = data.chunks;
        var updates: number[] = data.updates;

        for (var i = 0; i < chunks.length; i++) {
            var chunk: map.Chunk = this.map.getChunk(chunks[i]);
            if (chunk) {
                if (chunk.updated > updates[i]) {
                    console.log(chunks[i], " updated, sending");
                    this.sendChunk(socket, chunk);
                }
            }
        }
    }

    offerChunk(socket: Socket, chunk: map.Chunk) {
        socket.emit('offerChunk', { id: chunk.id, x: chunk.chunkX, y: chunk.chunkY, adjacent: chunk.adjacent, updated: chunk.updated });
    }

    requestChunk(socket: Socket, data) {
        var x: number = data.x;
        var y: number = data.y;

        this.map.load(x, y).then((chunk: map.Chunk) => {
            this.sendChunk(socket, chunk);
        });
    }

    sendChunk(socket: Socket, chunk: map.Chunk) {
        var codes: number[] = chunk.toArray();
        socket.emit('chunk', { chunk: codes, x: chunk.chunkX, y: chunk.chunkY, id: chunk.id, adjacent: chunk.adjacent, updated: chunk.updated });
    }
}