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
        createjs.Ticker.addListener(function (event) {
            return _this.update(event);
        });
        this.socket = io.connect('http://localhost:3300');
        this.socket.on("connection", function (data) {
            return _this.connection(data);
        });
        this.socket.on("chunk", function (data) {
            return _this.getChunk(data);
        });
    }
    Lights.chunkSize = 64;
    Lights.tileSize = 8;
    Lights.types = {
        empty: 0,
        wall: 1,
        moss: 2
    };
    Lights.prototype.connection = function (data) {
    };
    Lights.prototype.getChunk = function (data) {
        var newChunk = new Chunk(0, 0, data.chunk);
        this.stage.addChild(newChunk);
    };
    Lights.prototype.update = function (event) {
        this.stage.update();
    };
    return Lights;
})();
var Chunk = (function (_super) {
    __extends(Chunk, _super);
    function Chunk(chunkX, chunkY, data) {
        _super.call(this);
        this.chunkX = chunkX;
        this.chunkY = chunkY;
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
window.onload = function () {
    var el = document.getElementById("game");
    var game = new Lights(el);
};
//@ sourceMappingURL=LightsClient.js.map
