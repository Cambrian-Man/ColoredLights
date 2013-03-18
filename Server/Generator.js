var map = require('./Map')
var ChunkGen = (function () {
    function ChunkGen(chunk, chunks) {
        this.chunk = chunk;
        this.chunks = chunks;
    }
    ChunkGen.majorCavernMin = 10;
    ChunkGen.majorCavernMax = 15;
    ChunkGen.minorCavernMin = 4;
    ChunkGen.minorCavernMax = 6;
    ChunkGen.prototype.generate = function () {
        var _this = this;
        console.log("Generating ", this.chunk.chunkX, this.chunk.chunkY);
        // Fill the map with blanks.
        var c;
        var t;
        for(var i = 0; i < Math.pow(map.Map.chunkSize, 2); i++) {
            var g = map.Utils.random(20, 30);
            c = new map.Color(g, g, g);
            t = new map.Tile(1, c);
            this.chunk.tiles[i] = t;
        }
        // Get adjacent chunks and their chambers.
        var fillAdjacent = function (chunk) {
            var chambers = chunk.chambers;
            for(var i = 0; i < chambers.length; i++) {
                if(chambers[i].overlapsChunk(_this.chunks.get(chambers[i].chunkID))) {
                    var p = chunk.getRelativePoint({
                        x: chambers[i].x,
                        y: chambers[i].y
                    }, _this.chunk);
                    _this.circle(p.x, p.y, chambers[i].size, 0);
                }
            }
        };
        var adjacent = this.chunks.getAdjacent(this.chunk);
        for(var i = 0; i < adjacent.length; i++) {
            if(adjacent[i]) {
                fillAdjacent(this.chunks.get(adjacent[i]));
            }
        }
        // Create chambers in this chunk.
        var fillChamber = function (ch) {
            _this.circle(ch.x, ch.y, ch.size, 0);
        };
        this.generateMainChamber();
        this.branch(3, this.chunk.chambers[0]);
        for(i = 0; i < this.chunk.chambers.length; i++) {
            fillChamber(this.chunk.chambers[i]);
        }
    };
    ChunkGen.prototype.generateMainChamber = function () {
        var x = Math.floor(map.Utils.random(ChunkGen.majorCavernMax, map.Map.chunkSize - ChunkGen.majorCavernMax));
        var y = Math.floor(map.Utils.random(ChunkGen.majorCavernMax, map.Map.chunkSize - ChunkGen.majorCavernMax));
        var size = Math.floor(map.Utils.random(ChunkGen.majorCavernMin, ChunkGen.majorCavernMax));
        var chamber = new map.Chamber(this.chunk.id, x, y, size);
        chamber.chunk = this.chunk;
        do {
            var adjChamber = this.getRandomAdjacentChamber(ChunkGen.majorCavernMin, ChunkGen.majorCavernMax);
            if(!adjChamber) {
                break;
            } else {
                this.link(chamber, adjChamber, 6, 9);
            }
        }while(Math.random() > chamber.connections.length * 0.5);
        this.chunk.chambers.push(chamber);
    };
    ChunkGen.prototype.branch = function (levels, node) {
        var mainChamber = this.chunk.chambers[0];
        var satellite;
        var unavailable = 0;
        do {
            var x = Math.floor(map.Utils.random(node.x - (node.size * 3), node.x + (node.size * 3)));
            var y = Math.floor(map.Utils.random(node.x - (node.size * 3), node.x + (node.size * 3)));
            satellite = new map.Chamber(this.chunk.id, x, y, Math.floor(map.Utils.random(ChunkGen.minorCavernMin, ChunkGen.minorCavernMax)));
            satellite.chunk = this.chunk;
            unavailable++;
            if(unavailable > 200) {
                break;
            }
        }while(this.overlapsChambers(node));
        this.link(node, satellite, 3, 5);
        this.chunk.chambers.push(satellite);
        if(levels > 1) {
            this.branch(levels - 1, satellite);
            if(Math.random() < 0.9) {
                this.branch(levels - 1, satellite);
            }
            if(Math.random() < 0.6) {
                this.branch(levels - 1, satellite);
            }
        }
    };
    ChunkGen.prototype.overlapsChambers = function (chamber) {
        for(var i = 0; i < this.chunk.chambers.length; i++) {
            var otherChamber = this.chunk.chambers[i];
            if(chamber == otherChamber) {
                continue;
            } else if(chamber.overlaps(otherChamber)) {
                return true;
            }
        }
        return false;
    };
    ChunkGen.prototype.link = function (chamber1, chamber2, min, max) {
        chamber1.linkTo(chamber2);
        this.tunnel(chamber1.chunk, chamber1, chamber2.chunk, chamber2, min, max);
    };
    ChunkGen.prototype.getRandomAdjacentChamber = function (minSize, maxSize) {
        var adjacent = this.chunks.getAdjacent(this.chunk).filter(function (element, index, array) {
            return !(element == null);
        });
        while(adjacent.length > 0) {
            var i = Math.floor(map.Utils.random(0, adjacent.length));
            var id = adjacent[i];
            adjacent.splice(i, 1);
            var chunk = this.chunks.get(adjacent[i]);
            if(chunk) {
                if(chunk.chambers.length > 0) {
                    var chamber = this.getRandomChamber(chunk, minSize, maxSize);
                    if(chamber) {
                        return chamber;
                    }
                }
            }
        }
        return null;
    };
    ChunkGen.prototype.getRandomChamber = function (chunk, minSize, maxSize) {
        var chambers = chunk.chambers.slice(0);
        while(chambers.length > 0) {
            var i = Math.floor(map.Utils.random(0, chambers.length));
            var chamber = chambers.splice(i, 1)[0];
            if(chamber.size >= minSize && chamber.size <= maxSize) {
                return chamber;
            }
        }
        return null;
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
            for(var row = top; row <= bottom; row++) {
                distance = map.Utils.distance(center, {
                    x: col,
                    y: row
                });
                if(distance < radius) {
                    this.setTile({
                        x: col,
                        y: row
                    }, type, color);
                }
            }
        }
    };
    ChunkGen.prototype.tunnel = function (chunk1, p1, chunk2, p2, minRadius, maxRadius) {
        p2 = chunk1.getRelativePoint(p2, chunk2);
        var step = minRadius / map.Utils.distance(p1, p2);
        for(var f = 0; f < 1; f += step) {
            var radius = Math.floor(map.Utils.random(minRadius, maxRadius));
            var x = Math.round(map.Utils.lerp(p1.x, p2.x, f) + map.Utils.random(0, radius / 2));
            var y = Math.round(map.Utils.lerp(p1.y, p2.y, f) + map.Utils.random(0, radius / 2));
            this.circle(x, y, radius, 0);
        }
    };
    ChunkGen.prototype.setTile = function (point, type, color) {
        var offset = {
            x: 0,
            y: 0
        };
        offset.x = Math.floor(point.x / map.Map.chunkSize);
        offset.y = Math.floor(point.y / map.Map.chunkSize);
        var chunk = this.chunk;
        if(offset.x != 0 || offset.y != 0) {
            point.x = point.x % map.Map.chunkSize;
            if(point.x < 0) {
                point.x += map.Map.chunkSize;
            }
            point.y = point.y % map.Map.chunkSize;
            if(point.y < 0) {
                point.y += map.Map.chunkSize;
            }
            chunk = this.chunks.getAt(this.chunk.chunkX + offset.x, this.chunk.chunkY + offset.y);
            if(!chunk) {
                return;
            }
        }
        chunk.updated = Date.now();
        var t = chunk.tileAt(point.x, point.y);
        if(type != undefined) {
            t.type = type;
        } else if(color != undefined) {
            t.color = color;
        }
    };
    return ChunkGen;
})();
exports.ChunkGen = ChunkGen;
//@ sourceMappingURL=Generator.js.map
