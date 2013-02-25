
var socketio = require('socket.io')
var map = require("./Map")
var Server = (function () {
    function Server(io) {
        this.players = {
        };
        this.map = new map.Map();
    }
    Server.uuid = require('node-uuid');
    Server.prototype.start = function () {
        var _this = this;
        io.sockets.on("connection", function (socket) {
            return _this.connection(socket);
        });
    };
    Server.prototype.connection = function (socket) {
        var id = Server.uuid();
        var player = new Player(id, socket);
        this.players[player.id] = player;
        var codes = this.map.load(0, 0).toArray();
        socket.emit('chunk', {
            chunk: codes
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
var io = socketio.listen(3300);
io.configure(function () {
    io.set('log level', 1);
});
var server = new Server(io);
server.start();
