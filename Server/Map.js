/// <reference path="./Lights.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var Q = require('q');
var uuid = require('node-uuid');
var mongoose = require('mongoose');

var server = require("./Server")
var zlib = require("zlib")
var Map = (function () {
    function Map() {
        this.chunks = new ChunkMap();
    }
    Map.chunkSize = 64;
    Map.directions = {
        north: {
            x: 0,
            y: -1
        },
        northeast: {
            x: 1,
            y: -1
        },
        east: {
            x: 1,
            y: 0
        },
        southeast: {
            x: 1,
            y: 1
        },
        south: {
            x: 0,
            y: 1
        },
        southwest: {
            x: -1,
            y: 1
        },
        west: {
            x: -1,
            y: 0
        },
        northwest: {
            x: -1,
            y: -1
        }
    };
    Map.directionNames = [
        "north", 
        "northeast", 
        "east", 
        "southeast", 
        "south", 
        "southwest", 
        "west", 
        "northwest"
    ];
    Map.prototype.load = function (x, y) {
        var _this = this;
        var deferred = Q.defer();
        var chunk = this.chunks.getAt(x, y);
        if(chunk) {
            deferred.resolve(chunk);
        } else {
            server.Server.db.getChunk({
                x: x,
                y: y
            }).then(function (chunkResult) {
                if(!chunkResult) {
                    chunk = new Chunk(x, y);
                    var generator = new ChunkGen(chunk);
                    generator.generate();
                    chunk.save();
                    chunk.adjacent = _this.getAdjacent(chunk);
                    deferred.resolve(chunk);
                } else {
                    chunk = new Chunk(chunkResult['x'], chunkResult['y'], chunkResult['_id']);
                    chunk.loadTiles(chunkResult['tiles']).then(function (tiles) {
                        chunk.tiles = tiles;
                        chunk.adjacent = _this.getAdjacent(chunk);
                        deferred.resolve(chunk);
                    });
                }
                _this.chunks.add(chunk);
            }, function (err) {
                console.log(err);
            });
        }
        return deferred.promise;
    };
    Map.prototype.getAdjacent = function (chunk) {
        var adjacent = [];
        for(var i = 0; i < 8; i++) {
            var p = Map.directions[Map.directionNames[i]];
            var adjChunk = this.chunks.getAt(chunk.chunkX + p.x, chunk.chunkY + p.y);
            if(adjChunk === null) {
                adjacent.push(null);
            } else {
                adjacent.push(adjChunk.id);
            }
        }
        return adjacent;
    };
    Map.prototype.getChunk = function (id) {
        return this.chunks.get(id);
    };
    Map.prototype.activate = function (chunk) {
        var _this = this;
        var collect = function (i) {
            var deferred = Q.defer();
            var p = Map.directions[Map.directionNames[i]];
            _this.load(chunk.chunkX + p.x, chunk.chunkY + p.y).then(function (adjChunk) {
                chunk.adjacent[i] = adjChunk.id;
                deferred.resolve(adjChunk);
            });
            return deferred.promise;
        };
        return Q.all([
            collect(0), 
            collect(1), 
            collect(2), 
            collect(3), 
            collect(4), 
            collect(5), 
            collect(6), 
            collect(7)
        ]);
    };
    return Map;
})();
exports.Map = Map;
var Chunk = (function () {
    function Chunk(chunkX, chunkY, id) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.id = id;
        this.tiles = new Array();
        if(!id) {
            this.id = new mongoose.Types.ObjectId();
        }
        this.adjacent = [];
    }
    Chunk.prototype.activate = function () {
        this.active = true;
    };
    Chunk.prototype.tileAt = function (x, y) {
        return this.tiles[(y * Map.chunkSize) + x];
    };
    Chunk.prototype.toArray = function () {
        var codes = [];
        for(var i = 0; i < this.tiles.length; i++) {
            codes.push(this.tiles[i].toCode());
        }
        return codes;
    };
    Chunk.prototype.save = function () {
        server.Server.db.saveChunk(this);
    };
    Chunk.prototype.compressTiles = function () {
        var deferred = Q.defer();
        var tileNumbers = this.toArray();
        var tileBuf = new Buffer(tileNumbers.length * 4);
        for(var i = 0; i < tileNumbers.length; i++) {
            tileBuf.writeUInt32BE(tileNumbers[i], i * 4);
        }
        zlib.deflate(tileBuf, function (err, buffer) {
            if(!err) {
                deferred.resolve(buffer);
            }
        });
        return deferred.promise;
    };
    Chunk.prototype.loadTiles = function (tileBuffer) {
        var deferred = Q.defer();
        var tiles = [];
        zlib.inflate(tileBuffer, function (error, result) {
            var totalTiles = Math.pow(Map.chunkSize, 2);
            for(var i = 0; i < totalTiles; i++) {
                tiles.push(Tile.fromCode(result.readUInt32BE(i * 4)));
            }
            deferred.resolve(tiles);
        });
        return deferred.promise;
    };
    return Chunk;
})();
exports.Chunk = Chunk;
var ChunkMap = (function () {
    function ChunkMap() {
        this.chunks = {
        };
    }
    ChunkMap.prototype.add = function (chunk) {
        this.chunks[chunk.id] = chunk;
    };
    ChunkMap.prototype.get = function (id) {
        return this.chunks[id];
    };
    ChunkMap.prototype.getAt = // Returns the chunk at a given position
    // or null.
    // May return null because a chunk is nonexistant or
    // because it is unloaded!
    function (x, y) {
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
    ChunkMap.prototype.remove = function (chunk) {
        if(this.chunks[chunk.id]) {
            delete this.chunks[chunk.id];
        }
    };
    ChunkMap.prototype.contains = function (chunk) {
        if(this.chunks[chunk.id]) {
            return true;
        } else {
            return false;
        }
    };
    ChunkMap.prototype.keys = function () {
        var keys = [];
        for(var prop in this.chunks) {
            if(this.chunks.hasOwnProperty(prop)) {
                keys.push(prop);
            }
        }
        return keys;
    };
    return ChunkMap;
})();
var ChunkGen = (function () {
    function ChunkGen(chunk) {
        this.chunk = chunk;
    }
    ChunkGen.prototype.generate = function () {
        var c;
        var t;
        for(var i = 0; i < Math.pow(Map.chunkSize, 2); i++) {
            var g = (Math.random() * 50) + 30;
            c = new Color(g, g, g);
            t = new Tile(1, c);
            this.chunk.tiles[i] = t;
        }
        // Generate chambers
        var chambers = new Array();
        for(var i = (Math.random() * 5) + 3; i > 0; i--) {
            var chamber = new Chamber();
            do {
                chamber.x = Math.floor(Math.random() * Map.chunkSize);
                chamber.y = Math.floor(Math.random() * Map.chunkSize);
                chamber.size = Math.floor(Utils.random(3, 7));
            }while(chamber.overlapsAny(chambers));
            chambers.push(chamber);
            this.circle(chamber.x, chamber.y, chamber.size, 0);
        }
        this.chunk.chambers = chambers;
        // Link chambers
        for(var i = chambers.length - 1; i > 0; i--) {
            var chamber = chambers[i];
            for(var j = chambers.length - 1; j > 0; j--) {
                var otherChamber = chambers[j];
                if(Math.random() > 0.5 && chamber != otherChamber) {
                    if(!chamber.linked(otherChamber)) {
                        chamber.linkTo(otherChamber);
                    }
                }
            }
        }
        // Tunnel areas
        var connections = [];
        for(var i = 0, tot = chambers.length; i < tot; i++) {
            connections = connections.concat(chambers[i].connections);
        }
        var tunnels = [];
        var connectionIn = function (array, connection) {
            for(var i = 0, tot = array.length; i < tot; i++) {
                if(connection.equals(array[i])) {
                    return true;
                }
            }
            return false;
        };
        for(var i = 0, tot = connections.length; i < tot; i++) {
            if(!connectionIn(tunnels, connections[i])) {
                this.tunnel(connections[i].start, connections[i].end, 2, 5);
                tunnels.push(connections[i]);
            }
        }
    };
    ChunkGen.prototype.circle = function (x, y, radius, type, color) {
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
                var t = this.chunk.tileAt(col, row);
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
    ChunkGen.prototype.tunnel = function (p1, p2, minRadius, maxRadius) {
        var step = minRadius / Utils.distance(p1, p2);
        for(var f = 0; f < 1; f += step) {
            var radius = Math.floor(Utils.random(minRadius, maxRadius));
            var x = Math.round(Utils.lerp(p1.x, p2.x, f) + Utils.random(0, radius / 2));
            var y = Math.round(Utils.lerp(p1.y, p2.y, f) + Utils.random(0, radius / 2));
            this.circle(x, y, radius, 0);
        }
    };
    return ChunkGen;
})();
var Utils = (function () {
    function Utils() { }
    Utils.distance = function distance(p1, p2) {
        return Math.sqrt(Math.pow((p1.x - p2.x), 2) + Math.pow((p1.y - p2.y), 2));
    };
    Utils.lerp = function lerp(a, b, f) {
        return a + f * (b - a);
    };
    Utils.random = function random(min, max) {
        return (Math.random() * (max - min)) + min;
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
        this.id = uuid();
    }
    Chamber.prototype.linkTo = function (chamber) {
        this.connections.push(new Connection(this, chamber));
        chamber.connections.push(new Connection(chamber, this));
    };
    Chamber.prototype.overlaps = function (chamber) {
        return (Utils.distance(this, chamber) < this.size + chamber.size);
    };
    Chamber.prototype.overlapsAny = function (chambers) {
        for(var i = 0; i < chambers.length; i++) {
            if(this.overlaps(chambers[i])) {
                return true;
            }
        }
        return false;
    };
    Chamber.prototype.linked = function (chamber) {
        for(var i = 0; i < this.connections.length; i++) {
            if(this.connections[i].end == chamber) {
                return true;
            }
        }
        return false;
    };
    Chamber.prototype.hasLink = function (connection) {
        for(var i = 0; i < this.connections.length; i++) {
            if(this.connections[i].equals(connection)) {
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
        Utils.distance(start, end);
    }
    Connection.prototype.equals = function (other) {
        if(this.start == other.start && this.end == other.end) {
            return true;
        } else if(this.start == other.end && this.end == other.start) {
            return true;
        } else {
            return false;
        }
    };
    return Connection;
})();
exports.Connection = Connection;
//@ sourceMappingURL=Map.js.map
