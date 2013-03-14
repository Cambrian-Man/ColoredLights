/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
var Player = (function () {
    function Player(id, x, y, socket) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.socket = socket;
    }
    return Player;
})();
//@ sourceMappingURL=Player.js.map
