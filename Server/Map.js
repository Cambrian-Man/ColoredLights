/// <reference path="./Lights.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var Q = require('q');
var uuid = require('node-uuid');
var mongoose = require('mongoose');

var server = require("./Server")
var generator = require("./Generator")
var zlib = require("zlib")
var Map = (function () {
    function Map(config) {
        var _this = this;
        Map.chunkSize = config['chunkSize'];
        this.maxLoaded = config['maxLoaded'];
        this.chunks = new ChunkMap();
        setInterval(function () {
            _this.scanAndClear();
        }, 10000);
    }
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
                    var gen = new generator.ChunkGen(chunk, _this.chunks);
                    gen.generate();
                    chunk.save();
                    deferred.resolve(chunk);
                } else {
                    chunk = new Chunk(chunkResult['x'], chunkResult['y'], chunkResult['_id']);
                    chunk.updated = chunkResult['updated'];
                    chunk.saved = chunk.updated;
                    chunk.loadTiles(chunkResult['tiles']).then(function (tiles) {
                        chunk.tiles = tiles;
                        chunk.adjacent = _this.chunks.getAdjacent(chunk);
                        deferred.resolve(chunk);
                    });
                    _this.chunks.loadChambers(chunk, chunkResult);
                }
                _this.chunks.add(chunk);
            }, function (err) {
                console.log(err);
            });
        }
        return deferred.promise;
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
    Map.prototype.scanAndClear = function () {
        var ids = this.chunks.keys();
        for(var i = 0; i < ids.length; i++) {
            var chunk = this.chunks.get(ids[i]);
            if(chunk.updated > chunk.saved) {
                chunk.save();
                console.log("Scan: Saving updated chunk ", chunk.id);
            }
        }
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
        this.chambers = new Array();
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
    Chunk.prototype.getChamberIds = function () {
        var ids = [];
        for(var i = 0; i < this.chambers.length; i++) {
            ids.push(this.chambers[i].id.toString());
        }
        return ids;
    };
    Chunk.prototype.save = function () {
        var _this = this;
        if(!this.saved) {
            server.Server.db.saveChunk(this);
            for(var i = 0; i < this.chambers.length; i++) {
                server.Server.db.saveChamber(this.chambers[i]);
            }
        } else {
            this.compressTiles().then(function (tileBuffer) {
                server.Server.db.updateChunk(_this, {
                    tiles: tileBuffer,
                    updated: _this.updated,
                    connections: _this.getChamberIds()
                });
            });
        }
        this.saved = this.updated;
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
    Chunk.prototype.getRelativePoint = // Given a point in this chunk, converts it to a relative point in the other.
    function (p, chunk) {
        var xDist = chunk.chunkX - this.chunkX;
        var yDist = chunk.chunkY - this.chunkY;
        return {
            x: (xDist * Map.chunkSize) + p.x,
            y: (yDist * Map.chunkSize) + p.y
        };
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
        this._size++;
    };
    ChunkMap.prototype.get = function (id) {
        return this.chunks[id];
    };
    ChunkMap.prototype.size = function () {
        return this._size;
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
            this._size--;
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
    ChunkMap.prototype.getAdjacent = function (chunk) {
        var adjacent = [];
        for(var i = 0; i < 8; i++) {
            var p = Map.directions[Map.directionNames[i]];
            var adjChunk = this.getAt(chunk.chunkX + p.x, chunk.chunkY + p.y);
            if(adjChunk === null) {
                adjacent.push(null);
            } else {
                adjacent.push(adjChunk.id);
            }
        }
        return adjacent;
    };
    ChunkMap.prototype.loadChambers = function (chunk, result) {
        var chamberData = result.chambers;
        for(var i = 0; i < chamberData.length; i++) {
            var chamber = new Chamber(chunk.id, chamberData[i].x, chamberData[i].y, chamberData[i].size, chamberData[i]._id);
            for(var j = 0; j < chamberData[i].connections.length; j++) {
                var otherChamber = this.getChamberById(chamberData[i].connections[j].toString());
                if(otherChamber && !chamber.linked(otherChamber)) {
                    chamber.linkTo(otherChamber);
                }
            }
            chunk.chambers.push(chamber);
        }
    };
    ChunkMap.prototype.getChamberById = function (id) {
        for(var cid in this.chunks) {
            for(var i = 0; i < this.chunks[cid].chambers.length; i++) {
                if(this.chunks[cid].chambers[i].id == id) {
                    return this.chunks[cid].chambers[i];
                }
            }
        }
        return null;
    };
    return ChunkMap;
})();
exports.ChunkMap = ChunkMap;
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
exports.Utils = Utils;
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
    function Chamber(chunkID, x, y, size, id) {
        this.chunkID = chunkID;
        this.x = x;
        this.y = y;
        this.size = size;
        this.connections = new Array();
        if(!id) {
            this.id = new mongoose.Types.ObjectId();
        } else {
            this.id = id;
        }
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
    Chamber.prototype.overlapsChunk = function (otherChunk) {
        var points = [];
        points.push(otherChunk.getRelativePoint({
            x: 0,
            y: 0
        }, this.chunk));
        points.push(otherChunk.getRelativePoint({
            x: Map.chunkSize - 1,
            y: 0
        }, this.chunk));
        points.push(otherChunk.getRelativePoint({
            x: 0,
            y: Map.chunkSize - 1
        }, this.chunk));
        points.push(otherChunk.getRelativePoint({
            x: Map.chunkSize - 1,
            y: Map.chunkSize - 1
        }, this.chunk));
        for(var i = 0; i < 4; i++) {
            var p = points[i];
            if(Utils.distance({
                x: this.x,
                y: this.y
            }, p) < this.size) {
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
    Chamber.prototype.getConnectionArray = function () {
        var ids = [];
        for(var i = 0; i < this.connections.length; i++) {
            if(this.connections[i].start == this) {
                ids.push(this.connections[i].end.id.toString());
            }
        }
        return ids;
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
