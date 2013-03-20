/// <reference path="./Lights.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var Q: QStatic = require('q');
var uuid = require('node-uuid');
var mongoose = require('mongoose');
import db = module("./DB");
import server = module("./Server");
import generator = module("./Generator");
import zlib = module("zlib");

export class Map {
    private chunks: ChunkMap;
    static chunkSize: number;

    private maxLoaded: number;

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

    static public directionNames: string[] = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

    constructor(config: Object) {
        Map.chunkSize = config['chunkSize'];
        this.maxLoaded = config['maxLoaded'];
        this.chunks = new ChunkMap();

        setInterval(() => {
            this.scanAndClear();
        }, 10000);
    }

    load(x: number, y: number): Qpromise {
        var deferred: Qdeferred = Q.defer();

        var chunk: Chunk = this.chunks.getAt(x, y);

        if (chunk) {
            deferred.resolve(chunk);
        }
        else {
            server.Server.db.getChunk({ x: x, y: y }).then((chunkResult) => {
                if (!chunkResult) {
                    chunk = new Chunk(x, y);
                    var gen: generator.ChunkGen = new generator.ChunkGen(chunk, this.chunks);
                    gen.generate();
                    chunk.save();
                    deferred.resolve(chunk);
                }
                else {
                    chunk = new Chunk(chunkResult['x'], chunkResult['y'], <string> chunkResult['_id']);
                    chunk.updated = chunkResult['updated'];
                    chunk.saved = chunk.updated;
                    chunk.loadTiles(chunkResult['tiles']).then((tiles: Tile[]) => {
                        chunk.tiles = tiles;
                        chunk.adjacent = this.chunks.getAdjacent(chunk);
                        deferred.resolve(chunk);
                    });
                    this.chunks.loadChambers(chunk, chunkResult);
                }

                this.chunks.add(chunk);
            },
            (err) => {
                console.log(err);
            });

        }

        return deferred.promise;
    }

    getChunk(id: string): Chunk {
        return this.chunks.get(id);
    }

    activate(chunk: Chunk): Qpromise {
        var collect: Function = function (i: number): Qpromise => {
            var deferred: Qdeferred = Q.defer();
            var p: Point = Map.directions[Map.directionNames[i]];

            this.load(chunk.chunkX + p.x, chunk.chunkY + p.y).then((adjChunk: Chunk) => {
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

    scanAndClear() {
        var ids = this.chunks.keys();
        for (var i = 0; i < ids.length; i++) {
            var chunk: Chunk = this.chunks.get(ids[i]);
            if (chunk.updated > chunk.saved) {
                chunk.save();
                console.log("Scan: Saving updated chunk ", chunk.id);
            }
        }
    }
}

export class Chunk {
    public tiles: Tile[];
    public chambers: Chamber[];
    public active: bool;
    public adjacent: string[];

    public updated: number;
    public saved: number;

    constructor(public chunkX: number, public chunkY: number, public id?: string) {
        this.tiles = new Array();
        this.chambers = new Array();

        if (!id) {
            this.id = new mongoose.Types.ObjectId();
        }

        this.adjacent = [];
    }

    activate() {
        this.active = true;
    }

    tileAt(x: number, y: number): Tile {
        return this.tiles[(y * Map.chunkSize) + x];
    }

    toArray(): number[] {
        var codes: number[] = [];
        for (var i = 0; i < this.tiles.length; i++) {
            codes.push(this.tiles[i].toCode());
        }

        return codes;
    }

    getChamberIds(): string[]{
        var ids = [];
        for (var i = 0; i < this.chambers.length; i++) {
            ids.push(this.chambers[i].id.toString());
        }
        
        return ids;
    }

    save() {
        if (!this.saved) {
            server.Server.db.saveChunk(this);
            for (var i = 0; i < this.chambers.length; i++) {
                server.Server.db.saveChamber(this.chambers[i]);
            }
        }
        else {
            this.compressTiles().then((tileBuffer: NodeBuffer) => {
                server.Server.db.updateChunk(this, {
                    tiles: tileBuffer,
                    updated: this.updated,
                    connections: this.getChamberIds()
                });
            });
        }
        this.saved = this.updated;
    }

    compressTiles(): Qpromise {
        var deferred = Q.defer();
        var tileNumbers = this.toArray();
        var tileBuf = new Buffer(tileNumbers.length * 4);
        for (var i = 0; i < tileNumbers.length; i++) {
            tileBuf.writeUInt32BE(tileNumbers[i], i * 4);
        }

        zlib.deflate(tileBuf, (err: Error, buffer: NodeBuffer) => {
            if (!err) {
                deferred.resolve(buffer);
            }
        });

        return deferred.promise;
    }

    loadTiles(tileBuffer: NodeBuffer): Qpromise {
        var deferred = Q.defer();
        var tiles: Tile[] = [];

        zlib.inflate(tileBuffer, (error: Error, result: NodeBuffer) => {
            var totalTiles = Math.pow(Map.chunkSize, 2);
            for (var i = 0; i < totalTiles; i++) {
                tiles.push(Tile.fromCode(result.readUInt32BE(i * 4)));
            }
            deferred.resolve(tiles);
        });

        return deferred.promise;
    }
    
    // Given a point in this chunk, converts it to a relative point in the other.
    getRelativePoint(p: Point, chunk: Chunk): Point {
        var xDist = chunk.chunkX - this.chunkX;
        var yDist = chunk.chunkY - this.chunkY;

        return {
            x: (xDist * Map.chunkSize) + p.x,
            y: (yDist * Map.chunkSize) + p.y
        };
    }
}

export class ChunkMap {
    private chunks: Object = {};
    private _size: number;

    add(chunk: Chunk) {
        this.chunks[chunk.id] = chunk;
        this._size++;
    }

    get (id: string): Chunk {
        return <Chunk> this.chunks[id];
    }

    size(): number {
        return this._size;
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
            this._size--;
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

    getAdjacent(chunk: Chunk): string[] {
        var adjacent: string[] = [];
        for (var i = 0; i < 8; i++) {
            var p: Point = <Point> Map.directions[Map.directionNames[i]];
            var adjChunk: Chunk = this.getAt(chunk.chunkX + p.x, chunk.chunkY + p.y);

            if (adjChunk === null) {
                adjacent.push(null);
            }
            else {
                adjacent.push(adjChunk.id);
            }
        }

        return adjacent;
    }

    loadChambers(chunk:Chunk, result:any) {
        var chamberData: any[] = result.chambers;
        for (var i = 0; i < chamberData.length; i++) {
            var chamber: Chamber = new Chamber(chunk.id,
                chamberData[i].x,
                chamberData[i].y,
                chamberData[i].size,
                chamberData[i]._id);

            for (var j = 0; j < chamberData[i].connections.length; j++) {
                var otherChamber = this.getChamberById(chamberData[i].connections[j].toString());
                if (otherChamber && !chamber.linked(otherChamber)) {
                    chamber.linkTo(otherChamber);
                }
            }

            chunk.chambers.push(chamber);
        }
    }

    getChamberById(id: string): Chamber {
        for (var cid in this.chunks) {
            for (var i = 0; i < this.chunks[cid].chambers.length; i++) {
                if (this.chunks[cid].chambers[i].id == id) {
                    return this.chunks[cid].chambers[i];
                }
            }
        }
        return null;
    }
}

export interface Point {
    x: number;
    y: number;
}

export class Utils {
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
    public chunk: Chunk;

    constructor(public chunkID:string, public x?: number, public y?: number, public size?: number, id?:string) {
        this.connections = new Array();

        if (!id) {
            this.id = new mongoose.Types.ObjectId();
        }
        else {
            this.id = id;
        }
    }

    linkTo(chamber: any) {
        this.connections.push(new Connection(this, chamber));
        chamber.connections.push(new Connection(chamber, this));
    }

    overlaps(chamber: Chamber): bool {
        return (Utils.distance(this, chamber) < this.size + chamber.size);
    }

    overlapsAny(chambers: Chamber[]): bool {
        for (var i = 0; i < chambers.length; i++) {
            if (this.overlaps(chambers[i])) {
                return true;
            }
        }

        return false;
    }

    overlapsChunk(otherChunk: Chunk): bool {
        var points: Point[] = [];
        points.push(otherChunk.getRelativePoint({ x: 0, y: 0 }, this.chunk));
        points.push(otherChunk.getRelativePoint({ x: Map.chunkSize - 1, y: 0 }, this.chunk));
        points.push(otherChunk.getRelativePoint({ x: 0, y: Map.chunkSize - 1 }, this.chunk));
        points.push(otherChunk.getRelativePoint({ x: Map.chunkSize - 1, y: Map.chunkSize - 1 }, this.chunk));

        for (var i = 0; i < 4; i++) {
            var p: Point = points[i];
            if (Utils.distance({ x: this.x, y: this.y }, p) < this.size) {
                return true;
            }
        }

        return false;
    }

    linked(chamber: Chamber): bool {
        for (var i = 0; i < this.connections.length; i++) {
            if (this.connections[i].end == chamber) {
                return true;
            }
        }

        return false;
    }

    hasLink(connection: Connection): bool {
        for (var i = 0; i < this.connections.length; i++) {
            if (this.connections[i].equals(connection)) {
                return true;
            }
        }

        return false;
    }

    getConnectionArray(): string[]{
        var ids: string[] = [];
        for (var i = 0; i < this.connections.length; i++) {
            if (this.connections[i].start == this) {
                ids.push(this.connections[i].end.id.toString());
            }
        }

        return ids;
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