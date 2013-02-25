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
        this.testChunk = new Chunk(0, 0);
        this.stage.addChild(this.testChunk);
        this.testChunk.graphics.rect(10, 10, 100, 100);
        this.socket = io.connect('http://localhost');
    }
    Lights.chunkSize = 64;
    Lights.tileSize = 16;
    Lights.types = {
        empty: 0,
        wall: 1,
        moss: 2
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
        this.data = new ChunkData(0, 0);
        this.data.generate();
        this.generateGraphics();
    }
    Chunk.prototype.generateGraphics = function () {
        this.graphics.beginFill("#000").rect(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
        for(var i = this.data.tiles.length - 1; i > 0; i--) {
            var t = this.data.tiles[i];
            if(t.type == Lights.types.empty) {
                continue;
            }
            this.graphics.beginFill(t.color.toString());
            var p = ChunkData.tilePoint(i);
            this.graphics.rect(p.x * Lights.tileSize, p.y * Lights.tileSize, Lights.tileSize, Lights.tileSize);
        }
        this.cache(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
    };
    return Chunk;
})(createjs.Shape);
var ChunkData = (function () {
    function ChunkData(chunkX, chunkY) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.tiles = new Array();
    }
    ChunkData.prototype.tileAt = function (x, y) {
        return this.tiles[(y * Lights.chunkSize) + x];
    };
    ChunkData.tilePoint = function tilePoint(i) {
        var x = i % Lights.chunkSize;
        var y = Math.floor(i / Lights.chunkSize);
        return {
            x: x,
            y: y
        };
    };
    ChunkData.prototype.generate = function () {
        var c;
        var t;
        for(var i = 0; i < Math.pow(Lights.chunkSize, 2); i++) {
            c = new Color(Math.random() * 255, Math.random() * 255, Math.random() * 255);
            t = new Tile(Math.round(Math.random()), c);
            Tile.fromCode(t.toCode());
            this.tiles[i] = t;
        }
    };
    return ChunkData;
})();
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
