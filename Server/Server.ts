/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />

var Q: QStatic = require('q');
var uuid = require('node-uuid');
import map = module("./Map");
import db = module("./DB");
import socketio = module('socket.io');

export class Server {
    private map: map.Map;
    static db: db.DB;
    private players: Object = {};

    constructor() {

    }

    start(config:Object, io: SocketManager) {
        Server.db = new db.DB(config['db'], () => {
            this.map = new map.Map();
            io.sockets.on("connection", (socket: Socket) => this.connection(socket));
        });
    }

    connection(socket: Socket) {
        var id: string = <string> uuid();
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
                for (var i = 0; i < adjChunks.length; i++) {
                    this.offerChunk(socket, adjChunks[i]);
                }

                socket.emit("entered", { chunk: chunk.id });
            });
        });
    }

    offerChunk(socket: Socket, chunk: map.Chunk) {
        socket.emit('offerChunk', { id: chunk.id, x: chunk.chunkX, y: chunk.chunkY, adjacent: chunk.adjacent });
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
        socket.emit('chunk', { chunk: codes, x: chunk.chunkX, y: chunk.chunkY, id: chunk.id, adjacent: chunk.adjacent });
    }
}

export class Player {
    constructor(public id: string, public socket: Socket) { };
}