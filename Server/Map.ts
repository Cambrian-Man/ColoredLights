/// <reference path="./Lights.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var Q: QStatic = require('q');
var uuid = require('node-uuid');
import db = module("./DB");
import server = module("./Server");

export class Map {
    private chunks: ChunkMap;
    static chunkSize: number = 64;

    static public directions = {
        north: { x: 0, y: -1 },
        northeast: { x: 1, y: -1 },
        east: { x: 1, y: 0 },
        southeast: { x: 1, y: 1 },
        south: { x: 0, y: 1 },
        southwest: { x: -1, y: 1 },
        west: { x: -1, y: 0 },
        northwest: { x: -1, y: -1 }
    }

    static public directionNames:string[] = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

    constructor() {
        this.chunks = new ChunkMap();
    }

    load(x: number, y: number):Qpromise {
        var deferred: Qdeferred = Q.defer();

        var chunk: Chunk = this.chunks.getAt(x, y);

        if (chunk) {
            deferred.resolve(chunk);
        }
        else {
            chunk = new Chunk(x, y);
            var generator: ChunkGen = new ChunkGen(chunk);
            generator.generate();
            server.Server.db.saveChunk(chunk);

            for (var i = 0; i < 8; i++) {
                var p: Point = <Point> Map.directions[Map.directionNames[i]];
                var adjChunk: Chunk = this.chunks.getAt(chunk.chunkX + p.x, chunk.chunkY + p.y);

                if (adjChunk === null) {
                    chunk.adjacent.push(null);
                }
                else {
                    chunk.adjacent.push(adjChunk.id);
                }
            }

            deferred.resolve(chunk);
            this.chunks.add(chunk);
        }

        return deferred.promise;
    }

    getChunk(id: string):Chunk {
        return this.chunks.get(id);
    }

    activate(chunk: Chunk):Qpromise {
        var collect: Function = function (i:number): Qpromise => {
            var deferred :Qdeferred = Q.defer();
            var p: Point = Map.directions[Map.directionNames[i]];

            this.load(chunk.chunkX + p.x, chunk.chunkY + p.y).then((adjChunk:Chunk) => {
                chunk.adjacent[i] = adjChunk.id;
                deferred.resolve(adjChunk);
            });

            return deferred.promise;
        }

        return Q.all([
            collect(0), collect(1), collect(2), collect(3),
            collect(4), collect(5), collect(6), collect(7)
        ]);
    }
}

export class Chunk {
    public tiles: Tile[];
    public chambers: Chamber[];
    public active: bool;

    constructor(public chunkX: number, public chunkY: number, public id?:string, public adjacent?:string[]) {
        this.tiles = new Array();


        if (!id) {
            this.id = uuid();
        }

        if (!adjacent) {
            this.adjacent = [];
        }
    }

    activate() {
        this.active = true;
    }

    tileAt(x: number, y: number): Tile {
        return this.tiles[(y * Map.chunkSize) + x];
    }
    
    toArray(): number[] {
        var codes: number[] = [];
        for (var i = 0, tot = this.tiles.length; i < tot; i++) {
            codes.push(this.tiles[i].toCode());
        }

        return codes;
    }
}

class ChunkMap {
    private chunks: Object = {};

    add(chunk: Chunk) {
        this.chunks[chunk.id] = chunk;
    }

    get (id: string): Chunk {
        return <Chunk> this.chunks[id];
    }

    // Returns the chunk at a given position
    // or null.
    // May return null because a chunk is nonexistant or
    // because it is unloaded!
    getAt(x: number, y: number): Chunk {
        var chunk: Chunk;
        for (var prop in this.chunks) {
            if (this.chunks.hasOwnProperty(prop)) {
                chunk = <Chunk> this.chunks[prop];
                if (chunk.chunkX == x && chunk.chunkY == y) {
                    return chunk;
                }
            }
        }

        return null;
    }

    remove(chunk: Chunk) {
        if (this.chunks[chunk.id]) {
            delete this.chunks[chunk.id];
        }
    }

    contains(chunk: Chunk): bool {
        if (this.chunks[chunk.id]) {
            return true;
        }
        else {
            return false;
        }
    }

    keys(): string[]{
        var keys: string[] = [];
        for (var prop in this.chunks) {
            if (this.chunks.hasOwnProperty(prop)) {
                keys.push(prop);
            }
        }

        return keys;
    }
}

class ChunkGen {
    constructor(public chunk: Chunk) {
    }

    generate() {
        var c: Color;
        var t: Tile;

        for (var i = 0; i < Math.pow(Map.chunkSize, 2)); i++) {
            var g: number = (Math.random() * 50) + 30;
            c = new Color(g, g, g);
            t = new Tile(1, c);
            this.chunk.tiles[i] = t;
        }

        // Generate chambers
        var chambers: Chamber[] = new Array();
        for (var i = (Math.random() * 5) + 3; i > 0; i--) {
            var chamber: Chamber = new Chamber();
            do {
                chamber.x = Math.floor(Math.random() * Map.chunkSize);
                chamber.y = Math.floor(Math.random() * Map.chunkSize);
                chamber.size = Math.floor(Utils.random(3, 7));
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
                var otherChamber: Chamber = chambers[j];
                if (Math.random() > 0.5 && chamber != otherChamber) {
                    if (!chamber.linked(otherChamber)) {
                        chamber.linkTo(otherChamber);
                    }
                }
            }
        }

        // Tunnel areas
        var connections: Connection[] = [];
        for (var i = 0, tot = chambers.length; i < tot; i++) {
            connections = connections.concat(chambers[i].connections);
        }

        var tunnels: Connection[] = [];

        var connectionIn = function (array: Connection[], connection: Connection): Boolean {
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

    circle(x: number, y: number, radius: number, type?: number, color?: Color) {
        var top: number = y - radius;
        var bottom: number = y + radius;
        var left: number = x - radius;
        var right: number = x + radius;
        var center = { x: x, y: y };

        var distance: number;
        for (var col = left; col <= right; col++) {
            if (col < 0 || row >= Map.chunkSize) { continue; }
            for (var row = top; row <= bottom; row++) {
                var t: Tile = this.chunk.tileAt(col, row);
                if (row < 0 || row >= Map.chunkSize) {
                    continue;
                }
                else if (type != undefined && t.type == type) {
                    continue;
                }
                distance = Utils.distance(center, { x: col, y: row });
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
        var step: number = minRadius / Utils.distance(p1, p2);
        for (var f = 0; f < 1; f += step) {
            var radius = Math.floor(Utils.random(minRadius, maxRadius));
            var x: number = Math.round(Utils.lerp(p1.x, p2.x, f) + Utils.random(0, radius / 2));
            var y: number = Math.round(Utils.lerp(p1.y, p2.y, f) + Utils.random(0, radius / 2));
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

    static random(min: number, max: number): number {
        return (Math.random() * (max - min)) + min;
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
    public id: string;

    constructor(public x?: number, public y?: number, public size?: number) {
        this.connections = new Array();
        this.id = uuid();
    }

    linkTo(chamber: Chamber) {
        this.connections.push(new Connection(this, chamber));
        chamber.connections.push(new Connection(chamber, this));
    }

    overlaps(chamber: Chamber): bool {
        return (Utils.distance(this, chamber) < this.size + chamber.size);
    }

    overlapsAny(chambers: Chamber[]): bool {
        for (var i = chambers.length - 1; i > 0; i--) {
            if (this.overlaps(chambers[i])) {
                return true;
            }
        }

        return false;
    }

    linked(chamber: Chamber): bool {
        for (var i = this.connections.length - 1; i > 0; i--) {
            if (this.connections[i].end == chamber) {
                return true;
            }
        }

        return false;
    }

    hasLink(connection: Connection): bool {
        for (var i = this.connections.length - 1; i > 0; i--) {
            if (this.connections[i].equals(connection)) {
                return true;
            }
        }

        return false;
    }
}

export class Connection {
    public distance: number;
    constructor(public start: Chamber, public end: Chamber) {
        Utils.distance(start, end);
    }

    equals(other: Connection): bool {
        if (this.start == other.start && this.end == other.end) {
            return true;
        }
        else if (this.start == other.end && this.end == other.start) {
            return true;
        }
        else {
            return false;
        }
    }
}