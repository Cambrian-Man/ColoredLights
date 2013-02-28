/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />

import http = module('http');
import socketio = module('socket.io');
var Q:QStatic = require('q');
import map = module("./Map");

export class Server {
    private map: map.Map;
    static uuid = require('node-uuid');
    private players: Object = {};

    constructor(io: SocketManager) {
        this.map = new map.Map();
    }

    start() {
        
        io.sockets.on("connection", (socket: Socket) => this.connection(socket));
    }

    connection(socket: Socket) {
        var id: string = <string> Server.uuid();
        var player: Player = new Player(id, socket);
        this.players[player.id] = player;
        socket.emit('connection', { id: id });
            
        this.enterChunk(socket, 0, 0);

        socket.on("enterChunk", (data) => this.enterChunk(socket, data.x, data.y));
        socket.on("requestChunk", (data) => this.requestChunk(socket, data));
    }

    enterChunk(socket: Socket, x: number, y: number) {
        this.map.load(x, y).then((chunk: map.Chunk) => {
            this.map.activate(chunk).then((adjChunks: map.Chunk[]) => {
                this.offerChunk(socket, chunk);
                for (var i = 0, tot = adjChunks.length; i < tot; i++) {
                    this.offerChunk(socket, adjChunks[i]);
                }
            });
        });
    }

    offerChunk(socket: Socket, chunk: map.Chunk) {
        socket.emit('offerChunk', { id: chunk.id, x: chunk.chunkX, y: chunk.chunkY, adjacent: chunk.adjacent });
    }

    requestChunk(socket:Socket, data) {
        var x: number = data.x;
        var y: number = data.y;

        this.map.load(x, y).then((chunk: map.Chunk) => {
            this.sendChunk(socket, chunk);
        });
    }

    sendChunk(socket: Socket, chunk: map.Chunk) {
        var codes: number[] = chunk.toArray();
        socket.emit('chunk', { chunk: codes, x: chunk.chunkX, y: chunk.chunkY, id: chunk.id, adjacent: chunk.adjacent });
    }
}

export class Player {
    constructor(public id: string, public socket: Socket) { };
}

var io = socketio.listen(3300);
io.configure(function () {
    io.set('log level', 1);
});

var server: Server = new Server(io);
server.start();