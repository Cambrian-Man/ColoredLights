
var socketio = require('socket.io')
var server = require('./Server')
var io = socketio.listen(3300);
io.configure(function () {
    io.set('log level', 1);
});
var game = new server.Server();
game.start(io);
//@ sourceMappingURL=Lights.js.map
