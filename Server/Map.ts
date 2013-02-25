/// <reference path="./Lights.ts" />
export class Map {
    private chunks: Chunk[];
    static chunkSize:number = 64;

    constructor() {
        this.chunks = new Array();
    }

    load(x: number, y: number): Chunk {
        var chunk: Chunk = new Chunk(x, y);

        if (chunk.tiles.length == 0) {
            chunk.generate();
        }

        return chunk;
    }
}

export class Chunk {
    public tiles: Tile[];

    constructor(public chunkX: number, public chunkY: number) {
        this.tiles = new Array();
    }

    tileAt(x: number, y: number): Tile {
        return this.tiles[(y * Map.chunkSize) + x];
    }

    generate() {
        var c: Color;
        var t: Tile;

        for (var i = 0; i < Math.pow(Map.chunkSize, 2)); i++) {
            var g:number = (Math.random() * 50) + 30;
            c = new Color(g, g, g);
            t = new Tile(1, c);
            this.tiles[i] = t;
        }

        var chambers: Chamber[] = new Array();
        for (var i = (Math.random() * 5) + 1; i > 0; i--) {
            var chamber: Chamber = new Chamber();
            do {
                chamber.x = Math.floor(Math.random() * Map.chunkSize);
                chamber.y = Math.floor(Math.random() * Map.chunkSize);
                chamber.size = Math.floor(Math.random() * 10) + 4;
                console.log("x: " + chamber.x + "y: " + chamber.y);
            }
            while (chamber.overlapsAny(chambers));
            chambers.push(chamber);
            this.circle(chamber.x, chamber.y, chamber.size, 0);
        }
        
    }
    
    toArray(): number[] {
        var codes: number[] = [];
        for (var i = this.tiles.length - 1; i > 0; i--) {
            codes[i] = this.tiles[i].toCode();
        }

        return codes;
    }

    circle(x: number, y: number, radius: number, type?:number, color?: Color) {
        var top: number = y - radius;
        var bottom: number = y + radius;
        var left: number = x - radius;
        var right: number = x + radius;
        var center = { x: x, y: y };

        var distance: number;
        for (var col = left; col <= right; col++) {
            if (col < 0 || row >= Map.chunkSize) { continue; }
            for (var row = top; row <= bottom; row++) {
                var t: Tile = this.tileAt(col, row);
                if (row < 0 || row >= Map.chunkSize) {
                    continue;
                }
                else if (type != undefined && t.type == type) {
                    continue;
                }
                distance = Utils.distance(center, {x: col, y: row});
                if (distance < radius) {
                    if (type != undefined) {
                        t.type = type;
                    }
                    else if (color) {
                        t.color = color;
                    }
                }
            }
        }
    }

    tunnel(p1: Point, p2: Point, minRadius: number, maxRadius: number) {
        for (var f = 0; f < 1; f += 0.1) {
            var radius = Math.floor(Math.random() * maxRadius + (maxRadius - minRadius));
            var x: number = Math.round(Utils.lerp(p1.x, p2.x, f));
            var y: number = Math.round(Utils.lerp(p1.y, p2.y, f));
            this.circle(x, y, radius, 0);
        }
    }

    
}

export interface Point {
    x: number;
    y: number;
}

class Utils {
    static distance(p1: Point, p2: Point): number {
        return Math.sqrt(Math.pow((p1.x - p2.x), 2) + Math.pow((p1.y - p2.y), 2));
    }

    static lerp(a: number, b: number, f: number): number {
        return a + f * (b - a);
    }
}

export class Tile {
    constructor(public type: number, public color: Color) { }

    static fromCode(code: number): Tile {
        var type: number = code % 10;
        var r: number = Math.floor(code / 10000000);
        var g: number = Math.floor(code / 10000) % 1000;
        var b: number = Math.floor(code / 10) % 1000;
        return new Tile(type, new Color(r, g, b));
    }

    toCode(): number {
        var code: number = this.color.r * 10000000;
        code += this.color.g * 10000;
        code += this.color.b * 10;
        code += this.type;

        return code;
    }
}

export class Color {
    constructor(public r: number, public g: number, public b: number) {
        this.r = Math.round(r);
        this.g = Math.round(g);
        this.b = Math.round(b);
    }
}

export class Chamber {
    public connections: Connection[];

    constructor(public x?: number, public y?: number, public size?: number) {
        this.connections = new Array();
    }

    linkTo(chamber: Chamber) {
        this.connections.push(new Connection(this, chamber));
        chamber.connections.push(new Connection(chamber, this));
    }

    overlaps(chamber: Chamber): Boolean {
        return (Utils.distance(this, chamber) < this.size + chamber.size);
    }

    overlapsAny(chambers: Chamber[]): Boolean {
        for (var i = chambers.length - 1; i > 0; i--) {
            if (this.overlaps(chambers[i])) {
                return true;
            }
        }

        return false;
    }
}

export class Connection {
    constructor(public start: Chamber, public end: Chamber) {
    }
}