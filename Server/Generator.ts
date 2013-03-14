import map = module('./Map');

export class ChunkGen {
    public static majorCavernMin = 10;
    public static majorCavernMax = 15;

    public static minorCavernMin = 4;
    public static minorCavernMax = 6;

    constructor(public chunk: map.Chunk, public chunks:map.ChunkMap) {
    }

    generate() {
        console.log("Chamber ", this.chunk.chunkX, this.chunk.chunkY);
        
        // Fill the map with blanks.
        var c: map.Color;
        var t: map.Tile;

        for (var i = 0; i < Math.pow(map.Map.chunkSize, 2)); i++) {
            var g: number = map.Utils.random(20, 30);
            c = new map.Color(g, g, g);
            t = new map.Tile(1, c);
            this.chunk.tiles[i] = t;
        }
        // Get adjacent chunks and their chambers.
        var fillAdjacent = (chunk: map.Chunk) => {
            var chambers: map.Chamber[] = chunk.chambers;
            for (var i = 0; i < chambers.length; i++) {
                if (chambers[i].overlapsChunk(this.chunks.get(chambers[i].chunkID))) {
                    var p: map.Point = chunk.getRelativePoint({ x: chambers[i].x, y: chambers[i].y }, this.chunk);
                    this.circle(p.x, p.y, chambers[i].size, 0);
                }
            }
        }
        
        var adjacent: string[] = this.chunks.getAdjacent(this.chunk);
        for (var i = 0; i < adjacent.length; i++) {
            if (adjacent[i]) {
                fillAdjacent(this.chunks.get(adjacent[i]));
            }
        }
        // Create chambers in this chunk.
        var fillChamber = (ch: map.Chamber) => {
            this.circle(ch.x, ch.y, ch.size, 0);
        }

        this.generateMainChamber();

        this.branch(3, this.chunk.chambers[0]);

        for (i = 0; i < this.chunk.chambers.length; i++) {
            fillChamber(this.chunk.chambers[i]);
        }
    }

    private generateMainChamber() {
        var x = Math.floor(map.Utils.random(ChunkGen.majorCavernMax, map.Map.chunkSize - ChunkGen.majorCavernMax));
        var y = Math.floor(map.Utils.random(ChunkGen.majorCavernMax, map.Map.chunkSize - ChunkGen.majorCavernMax));
        var size = Math.floor(map.Utils.random(ChunkGen.majorCavernMin, ChunkGen.majorCavernMax));
        var chamber: map.Chamber = new map.Chamber(this.chunk.id, x, y, size);
        chamber.chunk = this.chunk;

        do {
            var adjChamber: map.Chamber = this.getRandomAdjacentChamber(ChunkGen.majorCavernMin, ChunkGen.majorCavernMax);
            if (!adjChamber) {
                break;
            }
            else {
                this.link(chamber, adjChamber, 6, 9);
            }
        }
        while (Math.random() > chamber.connections.length * 0.5);

        this.chunk.chambers.push(chamber);
    }

    private branch(levels: number, node:map.Chamber) {
        var mainChamber: map.Chamber = this.chunk.chambers[0];
        var satellite: map.Chamber;
        var unavailable = 0;
        do {
            var x = Math.floor(map.Utils.random(node.x - (node.size * 3), node.x + (node.size * 3)));
            var y = Math.floor(map.Utils.random(node.x - (node.size * 3), node.x + (node.size * 3)));
            satellite = new map.Chamber(this.chunk.id, x, y, Math.floor(map.Utils.random(ChunkGen.minorCavernMin, ChunkGen.minorCavernMax)));
            satellite.chunk = this.chunk;

            unavailable++;
            if (unavailable > 200) {
                break;
            }
        }
        while (this.overlapsChambers(node));
        this.link(node, satellite, 3, 5);
        this.chunk.chambers.push(satellite);

        if (levels > 1) {
            this.branch(levels - 1, satellite);
            if (Math.random() < 0.9) {
                this.branch(levels - 1, satellite);
            }
            if (Math.random() < 0.6) {
                this.branch(levels - 1, satellite);
            }
        }
    }

    private overlapsChambers(chamber: map.Chamber): bool {
        for (var i = 0; i < this.chunk.chambers.length; i++) {
            var otherChamber: map.Chamber = this.chunk.chambers[i];
            if (chamber == otherChamber) {
                continue;
            }
            else if (chamber.overlaps(otherChamber)) {
                return true;
            }
        }

        return false;
    }

    link(chamber1: map.Chamber, chamber2: map.Chamber, min:number, max:number) {
        chamber1.linkTo(chamber2);
        this.tunnel(chamber1.chunk, chamber1, chamber2.chunk, chamber2, min, max);
    }

    getRandomAdjacentChamber(minSize:number, maxSize:number): map.Chamber {
        var adjacent: string[] = this.chunks.getAdjacent(this.chunk).filter((element: any, index:number, array: any) => {
            return !(element == null);
        });

        while (adjacent.length > 0) {
            var i = Math.floor(map.Utils.random(0, adjacent.length));
            var id = adjacent[i];

            adjacent.splice(i, 1);

            var chunk: map.Chunk = this.chunks.get(adjacent[i]);
            
            if (chunk) {
                console.log(chunk.chunkX, chunk.chunkY);

                if (chunk.chambers.length > 0) {
                    var chamber: map.Chamber = this.getRandomChamber(chunk, minSize, maxSize);
                    if (chamber) {
                        return chamber;
                    }
                }
            }
        }

        return null;
    }

    getRandomChamber(chunk: map.Chunk, minSize: number, maxSize: number): map.Chamber {
        var chambers: map.Chamber[] = chunk.chambers.slice(0);

        while (chambers.length > 0) {
            var i = Math.floor(map.Utils.random(0, chambers.length));
            var chamber: map.Chamber = chambers.splice(i, 1)[0];

            if (chamber.size >= minSize && chamber.size <= maxSize) {
                return chamber;
            }
        }
        
        return null;
    }

    circle(x: number, y: number, radius: number, type?: number, color?: map.Color) {
        var top: number = y - radius;
        var bottom: number = y + radius;
        var left: number = x - radius;
        var right: number = x + radius;
        var center = { x: x, y: y };

        var distance: number;
        for (var col = left; col <= right; col++) {
            for (var row = top; row <= bottom; row++) {
                distance = map.Utils.distance(center, { x: col, y: row });
                if (distance < radius) {
                    this.setTile({ x: col, y: row }, type, color);
                }
            }
        }
    }

    tunnel(chunk1: map.Chunk, p1: map.Point, chunk2: map.Chunk, p2: map.Point, minRadius: number, maxRadius: number) {
        p2 = chunk1.getRelativePoint(p2, chunk2);
        var step: number = minRadius / map.Utils.distance(p1, p2);
        for (var f = 0; f < 1; f += step) {
            var radius = Math.floor(map.Utils.random(minRadius, maxRadius));
            var x: number = Math.round(map.Utils.lerp(p1.x, p2.x, f) + map.Utils.random(0, radius / 2));
            var y: number = Math.round(map.Utils.lerp(p1.y, p2.y, f) + map.Utils.random(0, radius / 2));
            this.circle(x, y, radius, 0);
        }
    }

    setTile(point: map.Point, type?: number, color?: map.Color) {
        var offset = { x: 0, y: 0 };

        offset.x = Math.floor(point.x / map.Map.chunkSize);
        offset.y = Math.floor(point.y / map.Map.chunkSize);
        
        var chunk: map.Chunk = this.chunk;
        if (offset.x != 0 || offset.y != 0) {
            point.x = point.x % map.Map.chunkSize;
            if (point.x < 0) { point.x += map.Map.chunkSize; }

            point.y = point.y % map.Map.chunkSize;
            if (point.y < 0) { point.y += map.Map.chunkSize; }

            chunk = this.chunks.getAt(this.chunk.chunkX + offset.x, this.chunk.chunkY + offset.y);
            if (!chunk) {
                return;
            }
        }

        chunk.updated = Date.now();
        var t: map.Tile = chunk.tileAt(point.x, point.y);
        if (type != undefined) {
            t.type = type;
        }
        else if (color != undefined) {
            t.color = color;
        }
    }
}