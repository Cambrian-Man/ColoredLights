define(["require", "exports", "./Client"], function(require, exports, __client__) {
    /// <reference path="./ts-definitions/DefinitelyTyped/easeljs/easeljs.d.ts" />
    /// <reference path="./Client.ts" />
    var client = __client__;

    var Player = (function () {
        function Player(id, game) {
            this.id = id;
            this.game = game;
            this.speed = {
                x: 0,
                y: 0
            };
            this.speed.x = Math.round(client.Game.tileSize / 4);
            this.speed.y = Math.round(client.Game.tileSize / 4);
            this.size = {
                width: client.Game.tileSize,
                height: client.Game.tileSize
            };
            var g = new createjs.Graphics();
            g.beginFill("#EEE");
            g.drawRoundRect(0, 0, this.size.width, this.size.height, 2);
            this.image = new createjs.Shape(g);
        }
        Player.prototype.update = function (data) {
            this.x = data.x * client.Game.tileSize;
            this.y = data.y * client.Game.tileSize;
        };
        Player.prototype.sendUpdates = function () {
            var _this = this;
            this.updateTimer = setInterval(function () {
                if(!_this.chunk) {
                    return;
                }
                _this.game.socket.emit("playerUpdate", {
                    chunkID: _this.chunk.chunkID,
                    id: _this.id,
                    x: _this.x / client.Game.tileSize,
                    y: _this.y / client.Game.tileSize
                });
            }, 50);
        };
        Player.prototype.setRelativePosition = function (to) {
            var relX = this.chunk.chunkX - to.chunkX;
            var relY = this.chunk.chunkY - to.chunkY;
            this.image.x = relX * client.Game.pixelSize;
            this.image.y = relY * client.Game.pixelSize;
        };
        Player.prototype.collide = function (p) {
            if(this.collidePoint({
                x: p.x,
                y: p.y
            })) {
                return true;
            } else if(this.collidePoint({
                x: this.size.width + p.x,
                y: p.y
            })) {
                return true;
            } else if(this.collidePoint({
                x: p.x,
                y: this.size.height + p.y
            })) {
                return true;
            } else if(this.collidePoint({
                x: this.size.width + p.x,
                y: this.size.height + p.y
            })) {
                return true;
            }
            return false;
        };
        Player.prototype.collidePoint = function (p) {
            var chunk = this.chunk;
            if(this.game.isInChunk(p)) {
                if(chunk.isBlocking(p)) {
                    return true;
                } else {
                    return false;
                }
            } else {
                var roll = this.game.rollOver(p);
                chunk = roll.chunk;
                if(chunk.isBlocking(roll)) {
                    return true;
                } else {
                    return false;
                }
            }
        };
        Player.prototype.move = function (step) {
            var newPoint = {
                x: this.x + step.x,
                y: this.y + step.y
            };
            if(!this.collide(newPoint)) {
                this.x = newPoint.x;
                this.y = newPoint.y;
            } else {
                var newStep = {
                    x: 0,
                    y: 0
                };
                if(Math.abs(step.x) > 0) {
                    newStep['x'] = (step.x > 0) ? step.x -= 1 : step.x += 1;
                }
                if(Math.abs(step.y) > 0) {
                    newStep['y'] = (step.y > 0) ? step.y -= 1 : step.y += 1;
                }
                if(Math.abs(newStep.x) > 0 || Math.abs(newStep.y) > 0) {
                    this.move(newStep);
                }
            }
        };
        return Player;
    })();
    exports.Player = Player;    
})
