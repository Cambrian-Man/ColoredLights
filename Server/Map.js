/// <reference path="./Lights.ts" />
var Map = (function () {
    function Map() {
        this.chunks = new Array();
    }
    Map.chunkSize = 64;
    Map.prototype.load = function (x, y) {
        var chunk = new Chunk(x, y);
        if(chunk.tiles.length == 0) {
            chunk.generate();
        }
        return chunk;
    };
    return Map;
})();
exports.Map = Map;
var Chunk = (function () {
    function Chunk(chunkX, chunkY) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.tiles = new Array();
    }
    Chunk.prototype.tileAt = function (x, y) {
        return this.tiles[(y * Map.chunkSize) + x];
    };
    Chunk.prototype.generate = function () {
        var c;
        var t;
        for(var i = 0; i < Math.pow(Map.chunkSize, 2); i++) {
            var g = (Math.random() * 50) + 30;
            c = new Color(g, g, g);
            t = new Tile(1, c);
            this.tiles[i] = t;
        }
        var chambers = new Array();
        for(var i = (Math.random() * 5) + 1; i > 0; i--) {
            var chamber = new Chamber();
            do {
                chamber.x = Math.floor(Math.random() * Map.chunkSize);
                chamber.y = Math.floor(Math.random() * Map.chunkSize);
                chamber.size = Math.floor(Math.random() * 14) + 6;
            }while(chamber.overlapsAny(chambers));
            chambers.push(chamber);
            this.circle(chamber.x, chamber.y, chamber.size, 0);
        }
        for(var i = chambers.length - 1; i > 0; i--) {
        }
    };
    Chunk.prototype.toArray = function () {
        var codes = [];
        for(var i = this.tiles.length - 1; i > 0; i--) {
            codes[i] = this.tiles[i].toCode();
        }
        return codes;
    };
    Chunk.prototype.circle = function (x, y, radius, type, color) {
        var top = y - radius;
        var bottom = y + radius;
        var left = x - radius;
        var right = x + radius;
        var center = {
            x: x,
            y: y
        };
        var distance;
        for(var col = left; col <= right; col++) {
            if(col < 0 || row >= Map.chunkSize) {
                continue;
            }
            for(var row = top; row <= bottom; row++) {
                var t = this.tileAt(col, row);
                if(row < 0 || row >= Map.chunkSize) {
                    continue;
                } else if(type != undefined && t.type == type) {
                    continue;
                }
                distance = Utils.distance(center, {
                    x: col,
                    y: row
                });
                if(distance < radius) {
                    if(type != undefined) {
                        t.type = type;
                    } else if(color) {
                        t.color = color;
                    }
                }
            }
        }
    };
    Chunk.prototype.tunnel = function (p1, p2, minRadius, maxRadius) {
        for(var f = 0; f < 1; f += 0.1) {
            var radius = Math.floor(Math.random() * maxRadius + (maxRadius - minRadius));
            var x = Math.round(Utils.lerp(p1.x, p2.x, f));
            var y = Math.round(Utils.lerp(p1.y, p2.y, f));
            this.circle(x, y, radius, 0);
        }
    };
    return Chunk;
})();
exports.Chunk = Chunk;
var Utils = (function () {
    function Utils() { }
    Utils.distance = function distance(p1, p2) {
        return Math.sqrt(Math.pow((p1.x - p2.x), 2) + Math.pow((p1.y - p2.y), 2));
    };
    Utils.lerp = function lerp(a, b, f) {
        return a + f * (b - a);
    };
    return Utils;
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
    return Color;
})();
exports.Color = Color;
var Chamber = (function () {
    function Chamber(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.connections = new Array();
    }
    Chamber.prototype.linkTo = function (chamber) {
        this.connections.push(new Connection(this, chamber));
        chamber.connections.push(new Connection(chamber, this));
    };
    Chamber.prototype.overlaps = function (chamber) {
        return (Utils.distance(this, chamber) < this.size + chamber.size);
    };
    Chamber.prototype.overlapsAny = function (chambers) {
        for(var i = chambers.length - 1; i > 0; i--) {
            if(this.overlaps(chambers[i])) {
                return true;
            }
        }
        return false;
    };
    return Chamber;
})();
exports.Chamber = Chamber;
var Connection = (function () {
    function Connection(start, end) {
        this.start = start;
        this.end = end;
    }
    return Connection;
})();
exports.Connection = Connection;
//@ sourceMappingURL=Map.js.map
