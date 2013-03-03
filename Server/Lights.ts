/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />

import http = module('http');
import fs = module('fs');
import socketio = module('socket.io');
import server = module('./Server');

var io = socketio.listen(3300);
io.configure(function () {
    io.set('log level', 1);
});

var game: server.Server = new server.Server();
fs.readFile('lights-config.json', (err: Error, data: NodeBuffer) => {
    if (err) { throw err; }
    var config = JSON.parse(<any> data);
    game.start(config, io);
});

