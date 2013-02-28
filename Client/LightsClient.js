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
        this.chunks = {
        };
    }
    Lights.chunkSize = 64;
    Lights.tileSize = 8;
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
    Lights.prototype.connect = function (data) {
        var _this = this;
        window.addEventListener("keydown", function (event) {
            return _this.keyDown(event);
        });
        window.addEventListener("keyup", function (event) {
            return _this.keyUp(event);
        });
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
            this.stage.addChild(this.chunks[data.id]);
        }
    };
    Lights.prototype.addChunk = function (data) {
        var newChunk = new Chunk(data.x, data.y, data.chunk, data.adjacent);
        this.stage.addChild(newChunk);
        if(!this.currentChunk) {
            this.currentChunk = newChunk;
        }
        this.chunks[data.id] = newChunk;
    };
    Lights.prototype.update = function (event) {
        this.stage.update();
        if(Lights.keys.up) {
            this.camera.y -= 10;
        } else if(Lights.keys.down) {
            this.camera.y += 10;
        }
        if(Lights.keys.left) {
            this.camera.x -= 10;
        } else if(Lights.keys.right) {
            this.camera.x += 10;
        }
        if(this.currentChunk) {
            var pixelSize = Lights.chunkSize * Lights.tileSize;
            if((this.camera.x < 0 || this.camera.x > pixelSize) || (this.camera.y < 0 || this.camera.y > pixelSize)) {
                this.changeChunk();
            }
            this.camera.focus(this.currentChunk, this.camera.x, this.camera.y);
        }
    };
    Lights.prototype.changeChunk = function () {
        var pixelSize = Lights.chunkSize * Lights.tileSize;
        console.log(this.currentChunk.adjacent);
        this.currentChunk = this.getChunkByPixel(this.camera.x, this.camera.y);
        this.camera.x %= pixelSize;
        if(this.camera.x < 0) {
            this.camera.x += pixelSize;
        }
        this.camera.y %= pixelSize;
        if(this.camera.y < 0) {
            this.camera.y += pixelSize;
        }
        this.socket.emit("enterChunk", {
            x: this.currentChunk.chunkX,
            y: this.currentChunk.chunkY
        });
        // Remove distant chunks.
        var otherChunk;
        for(var prop in this.chunks) {
            if(this.chunks.hasOwnProperty(prop)) {
                otherChunk = this.chunks[prop];
                if(Math.abs(otherChunk.chunkX - this.currentChunk.chunkX) > 1 || Math.abs(otherChunk.chunkY - this.currentChunk.chunkY) > 1) {
                    this.stage.removeChild(otherChunk);
                }
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
        return this.chunkAt(this.currentChunk.chunkX + p.x, this.currentChunk.chunkY + p.y);
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
        this.data = data;
        this.generateGraphics();
    }
    Chunk.prototype.generateGraphics = function () {
        this.graphics.beginFill("#000").rect(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
        for(var i = this.data.length - 1; i > 0; i--) {
            var t = Tile.fromCode(this.data[i]);
            if(t.type == Lights.types.empty) {
                continue;
            }
            this.graphics.beginFill(t.color.toString());
            var p = this.tilePoint(i);
            this.graphics.rect(p.x * Lights.tileSize, p.y * Lights.tileSize, Lights.tileSize, Lights.tileSize);
        }
        this.cache(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
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
    function Tile(type, color) {
        this.type = type;
        this.color = color;
    }
    Tile.fromCode = function fromCode(code) {
        var type = code % 10;
        var r = Math.floor(code / 10000000);
        var g = Math.floor(code / 10000) % 1000;
        var b = Math.floor(code / 10) % 1000;
        return new Tile(type, new Color(r, g, b));
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
var Camera = (function () {
    function Camera(game, width, height) {
        this.game = game;
        this.width = width;
        this.height = height;
        this.x = 0;
        this.y = 0;
    }
    Camera.prototype.focus = function (chunk, x, y) {
        var chunkX = chunk.chunkX;
        var chunkY = chunk.chunkY;
        var chunkPixels = Lights.chunkSize * Lights.tileSize;
        chunk.x = -x;
        chunk.y = -y;
        for(var i = 0; i < 8; i++) {
            var p = Lights.directions[i];
            var adjChunk = this.game.chunks[chunk.adjacent[i]];
            if(adjChunk) {
                adjChunk.x = p.x * chunkPixels - x;
                adjChunk.y = p.y * chunkPixels - y;
            }
        }
    };
    return Camera;
})();
window.onload = function () {
    var el = document.getElementById("game");
    var game = new Lights(el);
};
//@ sourceMappingURL=LightsClient.js.map
