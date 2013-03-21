var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", "./Player"], function(require, exports, __player__) {
    /// <reference path="./ts-definitions/DefinitelyTyped/easeljs/easeljs.d.ts" />
    /// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
    /* global io */
    var player = __player__;

    var Game = (function () {
        function Game(canvas) {
            this.canvas = canvas;
            var _this = this;
            this.stage = new createjs.Stage(canvas);
            this.camera = new Camera(this, canvas.width, canvas.height);
            Game.tileSize = Math.round(canvas.width / 120);
            Game.pixelSize = Game.chunkSize * Game.tileSize;
            this.displayChunks = new createjs.Container();
            this.stage.addChild(this.displayChunks);
            this.socket = io.connect('http://localhost:3300');
            this.socket.on("chunk", function (data) {
                return _this.addChunk(data);
            });
            this.socket.on("offerChunk", function (data) {
                return _this.checkChunk(data);
            });
            this.socket.on("connection", function (data) {
                return _this.connect(data);
            });
            this.socket.on("entered", function (data) {
                var checkLoaded = function () {
                    var chunk = _this.chunks[data['chunk']];
                    if(!chunk) {
                        return false;
                    } else {
                        for(var i = 0; i < chunk.adjacent.length; i++) {
                            if(!chunk.adjacent[i]) {
                                return false;
                            } else if(!_this.chunks[chunk.adjacent[i]]) {
                                return false;
                            }
                        }
                    }
                    return true;
                };
                var interval = setInterval(function () {
                    if(checkLoaded()) {
                        _this.enterChunk(data.chunk);
                        clearInterval(interval);
                    }
                }, 20);
            });
            this.socket.on("addPlayer", function (data) {
                if(data.id == _this.thisPlayer.id) {
                    _this.thisPlayer.x = data.x * Game.tileSize;
                    _this.thisPlayer.y = data.y * Game.tileSize;
                } else {
                    var p = _this.addPlayer(data.x * Game.tileSize, data.y * Game.tileSize, data.id);
                    p.chunk = _this.chunks[data.chunkID];
                }
            });
            this.socket.on("playerUpdate", function (data) {
                for(var i = 0; i < _this.players.length; i++) {
                    var p = _this.players[i];
                    if(data.id == p.id) {
                        p.chunk = _this.chunks[data.chunkID];
                        // If the chunk isn't loaded, it's probably too far away.
                        if(p.chunk) {
                            _this.players[i].update(data);
                        } else {
                            _this.stage.removeChild(p.image);
                        }
                    }
                }
            });
            this.chunks = {
            };
            this.players = [];
        }
        Game.chunkSize = 64;
        Game.tileCache = {
        };
        Game.types = {
            empty: 0,
            wall: 1,
            moss: 2
        };
        Game.keys = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        Game.keyCodes = {
            up: 38,
            down: 40,
            left: 37,
            right: 39
        };
        Game.directions = [
            {
                x: 0,
                y: -1
            }, 
            {
                x: 1,
                y: -1
            }, 
            {
                x: 1,
                y: 0
            }, 
            {
                x: 1,
                y: 1
            }, 
            {
                x: 0,
                y: 1
            }, 
            {
                x: -1,
                y: 1
            }, 
            {
                x: -1,
                y: 0
            }, 
            {
                x: -1,
                y: -1
            }
        ];
        Game.directionNames = [
            "north", 
            "northeast", 
            "east", 
            "southeast", 
            "south", 
            "southwest", 
            "west", 
            "northwest"
        ];
        Game.prototype.addPlayer = function (x, y, id) {
            var p = new player.Player(id, this);
            this.players.push(p);
            this.stage.addChild(p.image);
            return p;
        };
        Game.prototype.connect = function (data) {
            var _this = this;
            window.addEventListener("keydown", function (event) {
                return _this.keyDown(event);
            });
            window.addEventListener("keyup", function (event) {
                return _this.keyUp(event);
            });
            this.thisPlayer = this.addPlayer(0, 0, data.id);
            this.thisPlayer.image.x = this.stage.canvas.width / 2 - (this.thisPlayer.size.width / 2);
            this.thisPlayer.image.y = this.stage.canvas.height / 2 - (this.thisPlayer.size.width / 2);
            this.thisPlayer.sendUpdates();
            createjs.Ticker.addListener(function (event) {
                return _this.update(event);
            });
        };
        Game.prototype.keyDown = function (event) {
            switch(event.keyCode) {
                case Game.keyCodes.up:
                    Game.keys.up = true;
                    break;
                case Game.keyCodes.down:
                    Game.keys.down = true;
                    break;
                case Game.keyCodes.left:
                    Game.keys.left = true;
                    break;
                case Game.keyCodes.right:
                    Game.keys.right = true;
                    break;
            }
        };
        Game.prototype.keyUp = function (event) {
            switch(event.keyCode) {
                case Game.keyCodes.up:
                    Game.keys.up = false;
                    break;
                case Game.keyCodes.down:
                    Game.keys.down = false;
                    break;
                case Game.keyCodes.left:
                    Game.keys.left = false;
                    break;
                case Game.keyCodes.right:
                    Game.keys.right = false;
                    break;
            }
        };
        Game.prototype.checkChunk = function (data) {
            if(!this.chunks[data.id] || this.chunks[data.id].updated < data.updated) {
                this.socket.emit("requestChunk", {
                    x: data.x,
                    y: data.y
                });
            } else {
                this.chunks[data.id].adjacent = data.adjacent;
            }
        };
        Game.prototype.addChunk = function (data) {
            var newChunk = new Chunk(data.x, data.y, data.chunk, data.adjacent, data.updated);
            newChunk.chunkID = data.id;
            if(!this.thisPlayer.chunk) {
                this.thisPlayer.chunk = newChunk;
            }
            if(this.chunks[data.id]) {
                this.displayChunks.removeChild(this.chunks[data.id]);
                if(this.thisPlayer.chunk) {
                    this.chunks[data.id].setRelativePosition(this.thisPlayer.chunk);
                }
            }
            this.chunks[data.id] = newChunk;
        };
        Game.prototype.update = function (event) {
            this.stage.update();
            if(Game.keys.up) {
                this.thisPlayer.speed.y = -10;
            } else if(Game.keys.down) {
                this.thisPlayer.speed.y = 10;
            } else {
                this.thisPlayer.speed.y = 0;
            }
            if(Game.keys.left) {
                this.thisPlayer.speed.x = -10;
            } else if(Game.keys.right) {
                this.thisPlayer.speed.x = 10;
            } else {
                this.thisPlayer.speed.x = 0;
            }
            if(this.thisPlayer.chunk) {
                this.thisPlayer.move(this.thisPlayer.speed);
                if(!this.isInChunk(this.thisPlayer)) {
                    this.changeChunk();
                }
                this.camera.focus = this.thisPlayer;
                this.camera.update();
            }
        };
        Game.prototype.changeChunk = function () {
            var roll = this.rollOver(this.thisPlayer);
            this.thisPlayer.x = roll.x;
            this.thisPlayer.y = roll.y;
            this.socket.emit("enterChunk", {
                x: roll.chunk.chunkX,
                y: roll.chunk.chunkY
            });
        };
        Game.prototype.enterChunk = function (id) {
            var _this = this;
            var pixelSize = Game.chunkSize * Game.tileSize;
            this.displayChunks.removeAllChildren();
            this.thisPlayer.chunk = this.chunks[id];
            this.displayChunks.addChild(this.thisPlayer.chunk);
            this.thisPlayer.chunk.x = 0;
            this.thisPlayer.chunk.y = 0;
            for(var i = 0; i < 8; i++) {
                var p = Game.directions[i];
                var adjChunk = this.chunks[this.thisPlayer.chunk.adjacent[i]];
                if(adjChunk) {
                    this.displayChunks.addChild(adjChunk);
                    adjChunk.setRelativePosition(this.thisPlayer.chunk);
                    var text = new createjs.Text(adjChunk.chunkX + ", " + adjChunk.chunkY, "Helvetica", "#FFF");
                    text.x = adjChunk.x;
                    text.y = adjChunk.y;
                    this.displayChunks.addChild(text);
                }
            }
            clearInterval(this.checkUpdateTimer);
            this.checkUpdateTimer = setInterval(function () {
                var chunkIDs = [];
                var updates = [];
                for(var id in _this.chunks) {
                    if(_this.chunks.hasOwnProperty(id)) {
                        chunkIDs.push(id);
                        updates.push(_this.chunks[id].updated);
                    }
                }
                _this.socket.emit("checkChunkUpdate", {
                    chunks: chunkIDs,
                    updates: updates
                });
            }, 3000);
        };
        Game.prototype.getChunkByPixel = function (x, y) {
            var p = {
                x: Math.floor(x / Game.pixelSize),
                y: Math.floor(y / Game.pixelSize)
            };
            return this.chunkAt(this.thisPlayer.chunk.chunkX + p.x, this.thisPlayer.chunk.chunkY + p.y);
        };
        Game.prototype.isInChunk = function (p) {
            if(p.x < 0 || p.y < 0) {
                return false;
            } else if(p.x > Game.pixelSize || p.y > Game.pixelSize) {
                return false;
            }
            return true;
        };
        Game.prototype.rollOver = function (p) {
            var chunk = this.getChunkByPixel(p.x, p.y);
            var newPoint = {
                x: 0,
                y: 0
            };
            newPoint.x = p.x % Game.pixelSize;
            if(newPoint.x < 0) {
                newPoint.x += Game.pixelSize;
            }
            newPoint.y = p.y % Game.pixelSize;
            if(newPoint.y < 0) {
                newPoint.y += Game.pixelSize;
            }
            return {
                x: newPoint.x,
                y: newPoint.y,
                chunk: chunk
            };
        };
        Game.prototype.chunkAt = function (x, y) {
            var chunk;
            for(var prop in this.chunks) {
                if(this.chunks.hasOwnProperty(prop)) {
                    chunk = this.chunks[prop];
                    if(chunk.chunkX == x && chunk.chunkY == y) {
                        return chunk;
                    }
                }
            }
            return null;
        };
        return Game;
    })();
    exports.Game = Game;    
    var Chunk = (function (_super) {
        __extends(Chunk, _super);
        function Chunk(chunkX, chunkY, data, adjacent, updated) {
                _super.call(this);
            this.chunkX = chunkX;
            this.chunkY = chunkY;
            this.adjacent = adjacent;
            this.updated = updated;
            this.layer = 1;
            this.data = data;
            this.generateGraphics();
        }
        Chunk.prototype.generateGraphics = function () {
            this.graphics.beginFill("#000").rect(0, 0, Game.chunkSize * Game.tileSize, Game.chunkSize * Game.tileSize);
            for(var i = 0; i < this.data.length; i++) {
                var t = Tile.fromCode(this.data[i]);
                if(t.type == Game.types.empty) {
                    continue;
                }
                t.draw(this.graphics, this.tilePoint(i));
            }
            this.cache(0, 0, Game.chunkSize * Game.tileSize, Game.chunkSize * Game.tileSize);
        };
        Chunk.prototype.isBlocking = function (p) {
            var tilePoint = {
                x: Math.floor(p.x / Game.tileSize),
                y: Math.floor(p.y / Game.tileSize)
            };
            var type = this.data[(tilePoint.y * Game.chunkSize) + tilePoint.x] % 10;
            if(type == 1) {
                return true;
            } else {
                return false;
            }
        };
        Chunk.prototype.tilePoint = function (i) {
            var x = i % Game.chunkSize;
            var y = Math.floor(i / Game.chunkSize);
            return {
                x: x,
                y: y
            };
        };
        Chunk.prototype.setRelativePosition = function (to) {
            var relX = this.chunkX - to.chunkX;
            var relY = this.chunkY - to.chunkY;
            this.x = relX * Game.pixelSize;
            this.y = relY * Game.pixelSize;
        };
        return Chunk;
    })(createjs.Shape);
    exports.Chunk = Chunk;    
    var Tile = (function () {
        function Tile(type, color, code) {
            this.type = type;
            this.color = color;
            this.code = code;
        }
        Tile.prototype.draw = function (graphics, point) {
            point.x *= Game.tileSize;
            point.y *= Game.tileSize;
            var canvas;
            if(Game.tileCache[this.code.toString()]) {
                canvas = Game.tileCache[this.code.toString()];
            } else {
                canvas = document.createElement("canvas");
                canvas.width = Game.tileSize;
                canvas.height = Game.tileSize;
                var newGraphic = new createjs.Graphics();
                newGraphic.beginFill(this.colorString());
                newGraphic.rect(0, 0, Game.tileSize, Game.tileSize);
                if(Game.simpleGraphics) {
                    return;
                }
                newGraphic.beginFill(this.modColor(new Color(20, 20, 10)));
                newGraphic.moveTo(0, 0).lineTo(0 + Game.tileSize, 0).lineTo(0 + (Game.tileSize / 2), 0 + (Game.tileSize / 2)).closePath();
                newGraphic.beginFill(this.modColor(new Color(-20, -20, 0)));
                newGraphic.moveTo(0, 0 + Game.tileSize).lineTo(0 + Game.tileSize, 0 + Game.tileSize).lineTo(0 + (Game.tileSize / 2), 0 + (Game.tileSize / 2)).closePath();
                var shape = new createjs.Shape(newGraphic);
                shape.draw(canvas.getContext("2d"));
                Game.tileCache[this.code.toString()] = canvas;
            }
            graphics.beginBitmapFill(canvas);
            graphics.rect(point.x, point.y, Game.tileSize, Game.tileSize);
        };
        Tile.prototype.colorString = function () {
            return this.color.toString();
        };
        Tile.prototype.modColor = function (mod) {
            var c = new Color(this.color.r, this.color.g, this.color.b);
            c.r += mod.r;
            c.g += mod.g;
            c.b += mod.b;
            return c.toString();
        };
        Tile.fromCode = function fromCode(code) {
            var type = code % 10;
            var r = Math.floor(code / 10000000);
            var g = Math.floor(code / 10000) % 1000;
            var b = Math.floor(code / 10) % 1000;
            return new Tile(type, new Color(r, g, b), code);
        };
        Tile.prototype.toCode = function () {
            var code = this.color.r * 10000000;
            code += this.color.g * 10000;
            code += this.color.b * 10;
            code += this.type;
            return code;
        };
        return Tile;
    })();
    exports.Tile = Tile;    
    var Color = (function () {
        function Color(r, g, b) {
            this.r = r;
            this.g = g;
            this.b = b;
            this.r = Math.round(r);
            this.g = Math.round(g);
            this.b = Math.round(b);
        }
        Color.prototype.toString = function () {
            return "rgba(" + [
                this.r, 
                this.g, 
                this.b, 
                1.0
            ].join(',') + ")";
        };
        return Color;
    })();
    exports.Color = Color;    
    var Camera = (function () {
        function Camera(game, width, height) {
            this.game = game;
            this.width = width;
            this.height = height;
            this.x = 0;
            this.y = 0;
        }
        Camera.prototype.update = function () {
            var offsetX = (this.game.stage.canvas.width / 2) - (this.focus.size.width / 2);
            var offsetY = (this.game.stage.canvas.height / 2) - (this.focus.size.height / 2);
            this.game.displayChunks.x = -this.focus.x + offsetX;
            this.game.displayChunks.y = -this.focus.y + offsetY;
            for(var i = 0; i < this.game.players.length; i++) {
                var p = this.game.players[i];
                if(p != this.focus) {
                    // Don't update players in unloaded chunks.
                    if(!p.chunk) {
                        return;
                    }
                    p.setRelativePosition(this.focus.chunk);
                    p.image.x = -(this.focus.x - p.x) + offsetX;
                    p.image.y = -(this.focus.y - p.y) + offsetY;
                }
            }
        };
        return Camera;
    })();
    exports.Camera = Camera;    
})
