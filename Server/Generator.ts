import map = module('./Map');

export class ChunkGen {
    public static majorCavernMin = 8;
    public static majorCavernMax = 12;

    public static minorCavernMin = 3;
    public static minorCavernMax = 6;

    constructor(public chunk: map.Chunk, public chunks:map.ChunkMap) {
    }

    generate() {
        // Fill the map with blanks.
        var c: map.Color;
        var t: map.Tile;

        for (var i = 0; i < Math.pow(map.Map.chunkSize, 2)); i++) {
            var g: number = map.Utils.random(20, 30);
            c = new map.Color(g, g, g);
            t = new map.Tile(1, c);
            this.chunk.tiles[i] = t;
        }

        this.circle(30, 30, 10, 0);

    }

    /*
    generate() {
        var c: map.Color;
        var t: map.Tile;

        for (var i = 0; i < Math.pow(map.Map.chunkSize, 2)); i++) {
            var g: number = (Math.random() * 50) + 30;
            c = new map.Color(g, g, g);
            t = new map.Tile(1, c);
            this.chunk.tiles[i] = t;
        }

        // Generate chambers
        var chambers: map.Chamber[] = new Array();
        for (var i = (Math.random() * 5) + 3; i > 0; i--) {
            var chamber: map.Chamber = new map.Chamber();
            do {
                chamber.x = Math.floor(Math.random() * map.Map.chunkSize);
                chamber.y = Math.floor(Math.random() * map.Map.chunkSize);
                chamber.size = Math.floor(map.Utils.random(3, 7));
            }
            while (chamber.overlapsAny(chambers));
            chambers.push(chamber);
            this.circle(chamber.x, chamber.y, chamber.size, 0);
        }

        this.chunk.chambers = chambers;

        // Link chambers
        for (var i = chambers.length - 1; i > 0; i--) {
            var chamber: Chamber = chambers[i];
            for (var j = chambers.length - 1; j > 0; j--) {
                var otherChamber: map.Chamber = chambers[j];
                if (Math.random() > 0.5 && chamber != otherChamber) {
                    if (!chamber.linked(otherChamber)) {
                        chamber.linkTo(otherChamber);
                    }
                }
            }
        }

        // Tunnel areas
        var connections: map.Connection[] = [];
        for (var i = 0, tot = chambers.length; i < tot; i++) {
            connections = connections.concat(chambers[i].connections);
        }

        var tunnels: map.Connection[] = [];

        var connectionIn = function (array: map.Connection[], connection: map.Connection): Boolean {
            for (var i = 0, tot = array.length; i < tot; i++) {
                if (connection.equals(array[i])) {
                    return true;
                }
            }

            return false;
        }

        for (var i = 0, tot = connections.length; i < tot; i++) {
            if (!connectionIn(tunnels, connections[i])) {
                this.tunnel(connections[i].start, connections[i].end, 2, 5);
                tunnels.push(connections[i]);
            }
        }
    }
    */

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

    tunnel(p1: map.Point, p2: map.Point, minRadius: number, maxRadius: number) {
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
        if (point.x < 0) {
            offset.x = -1;
            point.x = map.Map.chunkSize + (point.x % map.Map.chunkSize);
        }
        else if (point.x >= map.Map.chunkSize) {
            offset.x = 1;
            point.x = point.x % map.Map.chunkSize;
        }

        if (point.y < 0) {
            offset.y = -1;
            point.y = map.Map.chunkSize + (point.y % map.Map.chunkSize);
        }
        else if (point.y >= map.Map.chunkSize) {
            offset.y = 1;
            point.y = point.y % map.Map.chunkSize;
        }
        var chunk: map.Chunk = this.chunk;
        if (offset.x != 0 || offset.y != 0) {
            chunk = this.chunks.getAt(this.chunk.chunkX + offset.x, this.chunk.chunkY + offset.y);
            if (!chunk) {
                return;
            }
        }

        var t: map.Tile = chunk.tileAt(point.x, point.y);
        if (type != undefined) {
            t.type = type;
        }
        else if (color != undefined) {
            t.color = color;
        }
    }
}