var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Lights = (function () {
    function Lights(canvas) {
        this.canvas = canvas;
        var _this = this;
        this.stage = new createjs.Stage(canvas);
        this.camera = new Camera(this, canvas.width, canvas.height);
        Lights.tileSize = Math.floor(canvas.width / 40);
        Lights.pixelSize = Lights.chunkSize * Lights.tileSize;
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
                    _this.enterChunk(data['chunk']);
                    clearInterval(interval);
                }
            }, 500);
        });
        this.chunks = {
        };
        this.players = {
        };
    }
    Lights.chunkSize = 64;
    Lights.tileCache = {
    };
    Lights.types = {
        empty: 0,
        wall: 1,
        moss: 2
    };
    Lights.keys = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    Lights.keyCodes = {
        up: 38,
        down: 40,
        left: 37,
        right: 39
    };
    Lights.directions = [
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
    Lights.directionNames = [
        "north", 
        "northeast", 
        "east", 
        "southeast", 
        "south", 
        "southwest", 
        "west", 
        "northwest"
    ];
    Lights.prototype.connect = function (data) {
        var _this = this;
        window.addEventListener("keydown", function (event) {
            return _this.keyDown(event);
        });
        window.addEventListener("keyup", function (event) {
            return _this.keyUp(event);
        });
        this.thisPlayer = new Player(data.id, this);
        this.players[data.id] = this.thisPlayer;
        this.thisPlayer.x = 0;
        this.thisPlayer.y = 0;
        this.stage.addChild(this.thisPlayer.image);
        this.thisPlayer.image.x = this.stage.canvas.width / 2 - (this.thisPlayer.size.width / 2);
        this.thisPlayer.image.y = this.stage.canvas.height / 2 - (this.thisPlayer.size.width / 2);
        createjs.Ticker.addListener(function (event) {
            return _this.update(event);
        });
    };
    Lights.prototype.keyDown = function (event) {
        switch(event.keyCode) {
            case Lights.keyCodes.up:
                Lights.keys.up = true;
                break;
            case Lights.keyCodes.down:
                Lights.keys.down = true;
                break;
            case Lights.keyCodes.left:
                Lights.keys.left = true;
                break;
            case Lights.keyCodes.right:
                Lights.keys.right = true;
                break;
        }
    };
    Lights.prototype.keyUp = function (event) {
        switch(event.keyCode) {
            case Lights.keyCodes.up:
                Lights.keys.up = false;
                break;
            case Lights.keyCodes.down:
                Lights.keys.down = false;
                break;
            case Lights.keyCodes.left:
                Lights.keys.left = false;
                break;
            case Lights.keyCodes.right:
                Lights.keys.right = false;
                break;
        }
    };
    Lights.prototype.checkChunk = function (data) {
        if(!this.chunks[data.id]) {
            this.socket.emit("requestChunk", {
                x: data.x,
                y: data.y
            });
        } else {
            this.chunks[data.id].adjacent = data.adjacent;
        }
    };
    Lights.prototype.addChunk = function (data) {
        var newChunk = new Chunk(data.x, data.y, data.chunk, data.adjacent);
        if(!this.thisPlayer.chunk) {
            this.thisPlayer.chunk = newChunk;
        }
        this.chunks[data.id] = newChunk;
    };
    Lights.prototype.update = function (event) {
        this.stage.update();
        if(Lights.keys.up) {
            this.thisPlayer.speed.y = -10;
        } else if(Lights.keys.down) {
            this.thisPlayer.speed.y = 10;
        } else {
            this.thisPlayer.speed.y = 0;
        }
        if(Lights.keys.left) {
            this.thisPlayer.speed.x = -10;
        } else if(Lights.keys.right) {
            this.thisPlayer.speed.x = 10;
        } else {
            this.thisPlayer.speed.x = 0;
        }
        if(this.thisPlayer.chunk) {
            this.thisPlayer.move(this.thisPlayer.speed);
            if((this.thisPlayer.x < 0 || this.thisPlayer.x > Lights.pixelSize) || (this.thisPlayer.y < 0 || this.thisPlayer.y > Lights.pixelSize)) {
                this.changeChunk();
            }
            this.camera.focus(this.thisPlayer);
        }
    };
    Lights.prototype.changeChunk = function () {
        var chunk = this.getChunkByPixel(this.thisPlayer.x, this.thisPlayer.y);
        this.thisPlayer.x %= Lights.pixelSize;
        if(this.thisPlayer.x < 0) {
            this.thisPlayer.x += Lights.pixelSize;
        }
        this.thisPlayer.y %= Lights.pixelSize;
        if(this.thisPlayer.y < 0) {
            this.thisPlayer.y += Lights.pixelSize;
        }
        this.socket.emit("enterChunk", {
            x: chunk.chunkX,
            y: chunk.chunkY
        });
    };
    Lights.prototype.enterChunk = function (id) {
        var pixelSize = Lights.chunkSize * Lights.tileSize;
        this.displayChunks.removeAllChildren();
        this.thisPlayer.chunk = this.chunks[id];
        this.displayChunks.addChild(this.thisPlayer.chunk);
        this.thisPlayer.chunk.x = 0;
        this.thisPlayer.chunk.y = 0;
        for(var i = 0; i < 8; i++) {
            var p = Lights.directions[i];
            var adjChunk = this.chunks[this.thisPlayer.chunk.adjacent[i]];
            this.displayChunks.addChild(adjChunk);
            if(adjChunk) {
                adjChunk.x = p.x * pixelSize;
                adjChunk.y = p.y * pixelSize;
            }
        }
    };
    Lights.prototype.getChunkByPixel = function (x, y) {
        var pixelSize = Lights.chunkSize * Lights.tileSize;
        var p = {
            x: 0,
            y: 0
        };
        if(x < 0) {
            p.x = -1;
        } else if(x > pixelSize) {
            p.x = 1;
        }
        if(y < 0) {
            p.y = -1;
        } else if(y > pixelSize) {
            p.y = 1;
        }
        return this.chunkAt(this.thisPlayer.chunk.chunkX + p.x, this.thisPlayer.chunk.chunkY + p.y);
    };
    Lights.prototype.isInChunk = function (p) {
        return (p.x >= 0 || p.y >= 0 || p.x < Lights.pixelSize || p.y < Lights.pixelSize);
    };
    Lights.prototype.rollOver = function (p) {
        var chunk = this.getChunkByPixel(p.x, p.y);
        var newPoint = {
            x: 0,
            y: 0
        };
        newPoint.x = p.x % Lights.pixelSize;
        if(newPoint.x < 0) {
            newPoint.x += Lights.pixelSize;
        }
        newPoint.y = p.y % Lights.pixelSize;
        if(newPoint.y < 0) {
            newPoint.y += Lights.pixelSize;
        }
        return {
            x: newPoint.x,
            y: newPoint.y,
            chunk: chunk
        };
    };
    Lights.prototype.chunkAt = function (x, y) {
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
    return Lights;
})();
var Chunk = (function (_super) {
    __extends(Chunk, _super);
    function Chunk(chunkX, chunkY, data, adjacent) {
        _super.call(this);
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.adjacent = adjacent;
        this.layer = 1;
        this.data = data;
        this.generateGraphics();
    }
    Chunk.prototype.generateGraphics = function () {
        this.graphics.beginFill("#000").rect(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
        for(var i = 0; i < this.data.length; i++) {
            var t = Tile.fromCode(this.data[i]);
            if(t.type == Lights.types.empty) {
                continue;
            }
            t.draw(this.graphics, this.tilePoint(i));
        }
        this.cache(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
    };
    Chunk.prototype.isBlocking = function (p) {
        var tilePoint = {
            x: Math.floor(p.x / Lights.tileSize),
            y: Math.floor(p.y / Lights.tileSize)
        };
        var type = this.data[(tilePoint.y * Lights.chunkSize) + tilePoint.x] % 10;
        if(type == 1) {
            return true;
        } else {
            return false;
        }
    };
    Chunk.prototype.tilePoint = function (i) {
        var x = i % Lights.chunkSize;
        var y = Math.floor(i / Lights.chunkSize);
        return {
            x: x,
            y: y
        };
    };
    return Chunk;
})(createjs.Shape);
var Tile = (function () {
    function Tile(type, color, code) {
        this.type = type;
        this.color = color;
        this.code = code;
    }
    Tile.prototype.draw = function (graphics, point) {
        point.x *= Lights.tileSize;
        point.y *= Lights.tileSize;
        var canvas;
        if(Lights.tileCache[this.code.toString()]) {
            canvas = Lights.tileCache[this.code.toString()];
        } else {
            canvas = document.createElement("canvas");
            canvas.width = Lights.tileSize;
            canvas.height = Lights.tileSize;
            var newGraphic = new createjs.Graphics();
            newGraphic.beginFill(this.colorString());
            newGraphic.rect(0, 0, Lights.tileSize, Lights.tileSize);
            if(Lights.simpleGraphics) {
                return;
            }
            newGraphic.beginFill(this.modColor(new Color(20, 20, 10)));
            newGraphic.moveTo(0, 0).lineTo(0 + Lights.tileSize, 0).lineTo(0 + (Lights.tileSize / 2), 0 + (Lights.tileSize / 2)).closePath();
            newGraphic.beginFill(this.modColor(new Color(-20, -20, 0)));
            newGraphic.moveTo(0, 0 + Lights.tileSize).lineTo(0 + Lights.tileSize, 0 + Lights.tileSize).lineTo(0 + (Lights.tileSize / 2), 0 + (Lights.tileSize / 2)).closePath();
            var shape = new createjs.Shape(newGraphic);
            shape.draw(canvas.getContext("2d"));
            Lights.tileCache[this.code.toString()] = canvas;
            console.log(Lights.tileCache);
        }
        graphics.beginBitmapFill(canvas);
        graphics.rect(point.x, point.y, Lights.tileSize, Lights.tileSize);
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
var Player = (function () {
    function Player(id, game) {
        this.id = id;
        this.game = game;
        this.speed = {
            x: 10,
            y: 10
        };
        this.size = {
            width: Lights.tileSize,
            height: Lights.tileSize
        };
        var g = new createjs.Graphics();
        g.beginFill("#EEE");
        g.drawRoundRect(0, 0, this.size.width, this.size.height, 2);
        this.image = new createjs.Shape(g);
    }
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
            y: this.y + step.y,
            chunk: this.chunk
        };
        if(!this.game.isInChunk(newPoint)) {
            newPoint = this.game.rollOver(newPoint);
            this.chunk = newPoint.chunk;
        }
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
var Camera = (function () {
    function Camera(game, width, height) {
        this.game = game;
        this.width = width;
        this.height = height;
        this.x = 0;
        this.y = 0;
    }
    Camera.prototype.focus = function (player) {
        this.game.displayChunks.x = -player.x + (this.game.stage.canvas.width / 2) - (player.size.height / 2);
        this.game.displayChunks.y = -player.y + (this.game.stage.canvas.height / 2) - (player.size.height / 2);
    };
    return Camera;
})();
window.onload = function () {
    var el = document.getElementById("game");
    el.width = window.innerWidth * 0.75;
    el.height = el.width * 0.5625;
    var game = new Lights(el);
};
//@ sourceMappingURL=LightsClient.js.map
