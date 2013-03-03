
var fs = require('fs')
var socketio = require('socket.io')
var server = require('./Server')
var io = socketio.listen(3300);
io.configure(function () {
    io.set('log level', 1);
});
var game = new server.Server();
fs.readFile('lights-config.json', function (err, data) {
    if(err) {
        throw err;
    }
    var config = JSON.parse(data);
    game.start(config, io);
});
//@ sourceMappingURL=Lights.js.map
