/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
var Player = (function () {
    function Player(id, socket) {
        this.id = id;
        this.socket = socket;
    }
    Player.prototype.update = function (data, callback) {
        if(this.id != data.id) {
            return;
        }
        this.x = data.x;
        this.y = data.y;
        this.chunkID = data.chunkID;
        if(callback) {
            callback({
                id: this.id,
                chunkID: this.chunkID,
                x: this.x,
                y: this.y
            });
        }
    };
    return Player;
})();
exports.Player = Player;
//@ sourceMappingURL=Player.js.map
