/// <reference path="./ts-definitions/DefinitelyTyped/easeljs/easeljs.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/* global io */

import player = module("./Player");

declare var io: any;

export class Game {
    element: HTMLElement;
    stage: createjs.Stage;
    socket: SocketNamespace;

    public camera: Camera;

    public chunks: Object;
    public displayChunks: createjs.Container;
    public players: player[];
    public thisPlayer: player.Player;

    static chunkSize: number = 64;
    static tileSize: number;
    static pixelSize: number;
    static simpleGraphics: bool;
    
    static tileCache: Object = {};

    static types = {
        empty: 0,
        wall: 1,
        moss: 2
    };

    static keys = {
        up: false,
        down: false,
        left: false,
        right: false
    };

    static keyCodes = {
        up: 38,
        down: 40,
        left: 37,
        right: 39
    };

    static public directions :Point[] = [
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: 0 },
        { x: -1, y: -1 }
    ];

    private checkUpdateTimer: number;

    static public directionNames: string[] = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

    constructor(public canvas: HTMLCanvasElement) {
        this.stage = new createjs.Stage(canvas);
        this.camera = new Camera(this, canvas.width, canvas.height);

        Game.tileSize = Math.round(canvas.width / 120);
        Game.pixelSize = Game.chunkSize * Game.tileSize;

        this.displayChunks = new createjs.Container();
        this.stage.addChild(this.displayChunks);

        this.socket = <SocketNamespace> io.connect('http://localhost:3300');
        this.socket.on("chunk", (data) => this.addChunk(data));
        this.socket.on("offerChunk", (data) => this.checkChunk(data));
        this.socket.on("connection", (data) => this.connect(data));
        this.socket.on("entered", (data) => {
            var checkLoaded: Function = function ():bool => {
                var chunk: Chunk = this.chunks[data['chunk']];
                if (!chunk) {
                    return false;
                }
                else {
                    for (var i = 0; i < chunk.adjacent.length; i++) {
                        if (!chunk.adjacent[i]) {
                            return false;
                        }
                        else if (!this.chunks[chunk.adjacent[i]]) {
                            return false;
                        }
                    }
                }

                return true;
            }

            var interval: number = setInterval(() => {
                if (checkLoaded()) {
                    console.log("Loaded");
                    this.enterChunk(data.chunk);
                    clearInterval(interval);
                }
            }, 20);
        });

        this.socket.on("addPlayer", (data) => {
            if (data.id == this.thisPlayer.id) {
                this.thisPlayer.x = data.x * Game.tileSize;
                this.thisPlayer.y = data.y * Game.tileSize;
            }
            else {
                var p: player.Player = this.addPlayer(
                    data.x * Game.tileSize,
                    data.y * Game.tileSize,
                    data.id
                    );
                p.chunk = this.chunks[data.chunkID];
            }
        });

        this.socket.on("playerUpdate", (data) => {
            for (var i = 0; i < this.players.length; i++) {
                var p: player.Player = this.players[i];
                if (data.id == p.id) {
                    p.chunk = this.chunks[data.chunkID];

                    // If the chunk isn't loaded, it's probably too far away.
                    if (p.chunk) {
                        this.players[i].update(data);
                    }
                    else {
                        this.stage.removeChild(p.image);
                    }
                }
            }
        });

        this.chunks = {};
        this.players = [];
    }

    addPlayer(x: number, y: number, id: string): player.Player {
        var p: player.Player = new player.Player(id, this);
        this.players.push(p);

        this.stage.addChild(p.image);

        return p;
    }

    connect(data) {
        window.addEventListener("keydown", (event: KeyboardEvent) => this.keyDown(event));
        window.addEventListener("keyup", (event: KeyboardEvent) => this.keyUp(event));

        this.thisPlayer = this.addPlayer(0, 0, data.id);
        this.thisPlayer.image.x = this.stage.canvas.width / 2 - (this.thisPlayer.size.width / 2);
        this.thisPlayer.image.y = this.stage.canvas.height / 2 - (this.thisPlayer.size.width / 2);

        this.thisPlayer.sendUpdates();

        createjs.Ticker.addListener((event) => this.update(event));
    }

    keyDown(event: KeyboardEvent) {
        switch (event.keyCode) {
            case Game.keyCodes.up:
                Game.keys.up = true;
                break;
            case Game.keyCodes.down:
                Game.keys.down = true;
                break;
            case Game.keyCodes.left:
                Game.keys.left = true;
                break;
            case Game.keyCodes.right:
                Game.keys.right = true;
                break;
        }
    }

    keyUp(event: KeyboardEvent) {
        switch (event.keyCode) {
            case Game.keyCodes.up:
                Game.keys.up = false;
                break;
            case Game.keyCodes.down:
                Game.keys.down = false;
                break;
            case Game.keyCodes.left:
                Game.keys.left = false;
                break;
            case Game.keyCodes.right:
                Game.keys.right = false;
                break;
        }
    }

    checkChunk(data) {
        if (!this.chunks[data.id] || this.chunks[data.id].updated < data.updated ) {
            this.socket.emit("requestChunk", { x: data.x, y: data.y });
        }
        else {
            this.chunks[data.id].adjacent = data.adjacent;
        }
    }

    addChunk(data) {
        var newChunk: Chunk = new Chunk(data.x, data.y, data.chunk, data.adjacent, data.updated);
        newChunk.chunkID = data.id;
        if (!this.thisPlayer.chunk) {
            this.thisPlayer.chunk = newChunk;
        }
        
        if (this.chunks[data.id]) {
            this.displayChunks.removeChild(this.chunks[data.id]);
            if (this.thisPlayer.chunk) {
                this.chunks[data.id].setRelativePosition(this.thisPlayer.chunk);
            }
        }

        this.chunks[data.id] = newChunk;
    }

    update(event?: any) {
        this.stage.update();

        if (Game.keys.up) {
            this.thisPlayer.speed.y = -10;
        }
        else if (Game.keys.down) {
            this.thisPlayer.speed.y = 10;
        }
        else {
            this.thisPlayer.speed.y = 0;
        }

        if (Game.keys.left) {
            this.thisPlayer.speed.x = -10;
        }
        else if (Game.keys.right) {
            this.thisPlayer.speed.x = 10;
        }
        else {
            this.thisPlayer.speed.x = 0;
        }

        if (this.thisPlayer.chunk) {
            this.thisPlayer.move(this.thisPlayer.speed);
            if (!this.isInChunk(this.thisPlayer)) {
                this.changeChunk();
            }

            this.camera.focus = this.thisPlayer;
            this.camera.update();
        }
    }

    changeChunk() {
        var roll = this.rollOver(this.thisPlayer);
        this.thisPlayer.x = roll.x;
        this.thisPlayer.y = roll.y;


        this.socket.emit("enterChunk", { x: roll.chunk.chunkX, y: roll.chunk.chunkY });
    }

    enterChunk(id: string) {
        var pixelSize = Game.chunkSize * Game.tileSize;
        this.displayChunks.removeAllChildren();

        this.thisPlayer.chunk = this.chunks[id];
        this.displayChunks.addChild(this.thisPlayer.chunk);

        this.thisPlayer.chunk.x = 0;
        this.thisPlayer.chunk.y = 0;

        for (var i = 0; i < 8; i++) {
            var p: Point = Game.directions[i];
            var adjChunk: Chunk = this.chunks[this.thisPlayer.chunk.adjacent[i]];
            if (adjChunk) {
                this.displayChunks.addChild(adjChunk);
                adjChunk.setRelativePosition(this.thisPlayer.chunk);

                var text: createjs.Text = new createjs.Text(adjChunk.chunkX + ", " + adjChunk.chunkY, "Helvetica", "#FFF");
                text.x = adjChunk.x;
                text.y = adjChunk.y;
                this.displayChunks.addChild(text);
            }
        }

        clearInterval(this.checkUpdateTimer);
        this.checkUpdateTimer = setInterval(() => {
            var chunkIDs: string[] = [];
            var updates: number[] = [];

            for (var id in this.chunks) {
                if (this.chunks.hasOwnProperty(id)) {
                    chunkIDs.push(id);
                    updates.push(this.chunks[id].updated);
                }
            }
            this.socket.emit("checkChunkUpdate", { chunks: chunkIDs, updates: updates });
        }, 3000);
    }

    getChunkByPixel(x: number, y: number): Chunk {
        var p: Point = {
            x: Math.floor(x / Game.pixelSize),
            y: Math.floor(y / Game.pixelSize)
        };

        return this.chunkAt(this.thisPlayer.chunk.chunkX + p.x, this.thisPlayer.chunk.chunkY + p.y);
    }

    isInChunk(p: Point): bool {
        if (p.x < 0 || p.y < 0) {
            return false;
        }
        else if (p.x > Game.pixelSize || p.y > Game.pixelSize) {
            return false;
        }
        
        return true;
    }

    rollOver(p: Point): { x: number; y: number; chunk: Chunk; } {
        var chunk: Chunk = this.getChunkByPixel(p.x, p.y);
        var newPoint = {x: 0, y: 0};
        newPoint.x = p.x % Game.pixelSize;
        if (newPoint.x < 0) { newPoint.x += Game.pixelSize; }
        newPoint.y = p.y % Game.pixelSize;
        if (newPoint.y < 0) { newPoint.y += Game.pixelSize; }

        return {
            x: newPoint.x,
            y: newPoint.y,
            chunk: chunk
        }
    }

    chunkAt(x: number, y: number): Chunk {
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
}

export class Chunk extends createjs.Shape {
    data: number[];
    public layer: number = 1;
    public chunkID: string;

    constructor(public chunkX: number, public chunkY: number, data:number[], public adjacent:string[], public updated:number) {
        super();

        this.data = data;
        this.generateGraphics();
    }

    generateGraphics() {
        this.graphics.beginFill("#000").rect(0, 0, Game.chunkSize * Game.tileSize, Game.chunkSize * Game.tileSize);

        for (var i = 0; i < this.data.length; i++) {
            var t: Tile = Tile.fromCode(this.data[i]);
            if (t.type == Game.types.empty) {
                continue;
            }

            t.draw(this.graphics, this.tilePoint(i));
        }

        this.cache(0, 0, Game.chunkSize * Game.tileSize, Game.chunkSize * Game.tileSize);
    }

    isBlocking(p: Point): bool {
        var tilePoint = {
            x: Math.floor(p.x / Game.tileSize),
            y: Math.floor(p.y / Game.tileSize)
        }
        
        var type: number = this.data[(tilePoint.y * Game.chunkSize) + tilePoint.x] % 10;

        if (type == 1) {
            return true;
        }
        else {
            return false;
        }
    }

    tilePoint(i: number): Point {
        var x: number = i % Game.chunkSize;
        var y: number = Math.floor(i / Game.chunkSize);
        return { x: x, y: y };
    }

    setRelativePosition(to: Chunk) {
        var relX: number = this.chunkX - to.chunkX;
        var relY: number = this.chunkY - to.chunkY;

        this.x = relX * Game.pixelSize;
        this.y = relY * Game.pixelSize;
    }
}

export interface Point {
    x: number;
    y: number;
}

export class Tile {
    constructor(public type: number, public color: Color, public code:number) {

    }

    draw(graphics: createjs.Graphics, point: Point) {
        point.x *= Game.tileSize;
        point.y *= Game.tileSize;

        var canvas: HTMLCanvasElement;

        if (Game.tileCache[this.code.toString()]) {
            canvas = <HTMLCanvasElement> Game.tileCache[this.code.toString()];
        }
        else {
            canvas = <HTMLCanvasElement> document.createElement("canvas");
            canvas.width = Game.tileSize;
            canvas.height = Game.tileSize;
            var newGraphic: createjs.Graphics = new createjs.Graphics();
            newGraphic.beginFill(this.colorString());
            newGraphic.rect(0, 0, Game.tileSize, Game.tileSize);

            if (Game.simpleGraphics) {
                return;
            }

            newGraphic.beginFill(this.modColor(new Color(20, 20, 10)));
            newGraphic.moveTo(0, 0)
                .lineTo(0 + Game.tileSize, 0)
                .lineTo(0 + (Game.tileSize / 2), 0 + (Game.tileSize / 2))
                .closePath();

            newGraphic.beginFill(this.modColor(new Color(-20, -20, 0)));
            newGraphic.moveTo(0, 0 + Game.tileSize)
                .lineTo(0 + Game.tileSize, 0 + Game.tileSize)
                .lineTo(0 + (Game.tileSize / 2), 0 + (Game.tileSize / 2))
                .closePath();

            var shape: createjs.Shape = new createjs.Shape(newGraphic);
            shape.draw(canvas.getContext("2d"));
            Game.tileCache[this.code.toString()] = canvas;
        }

        graphics.beginBitmapFill(canvas);
        graphics.rect(point.x, point.y, Game.tileSize, Game.tileSize);
    }

    colorString(): string {
        return this.color.toString();
    }

    modColor(mod:Color): string {
        var c: Color = new Color(this.color.r, this.color.g, this.color.b);
        c.r += mod.r;
        c.g += mod.g;
        c.b += mod.b;

        return c.toString();
    }

    static fromCode(code: number):Tile {
        var type: number = code % 10;
        var r: number = Math.floor(code / 10000000);
        var g: number = Math.floor(code / 10000) % 1000;
        var b: number = Math.floor(code / 10) % 1000;
        return new Tile(type, new Color(r, g, b), code);
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

    toString() {
        return "rgba(" + [this.r, this.g, this.b, 1.0].join(',') + ")";
    }
}

export class Camera {
    public x: number;
    public y: number;
    public focus: player.Player;

    constructor(public game:Game, public width: number, public height: number) {
        this.x = 0;
        this.y = 0;
    }

    update() {
        var offsetX: number = (this.game.stage.canvas.width / 2) - (this.focus.size.width / 2);
        var offsetY: number = (this.game.stage.canvas.height / 2) - (this.focus.size.height / 2);

        this.game.displayChunks.x = -this.focus.x + offsetX;
        this.game.displayChunks.y = -this.focus.y + offsetY;

        for (var i = 0; i < this.game.players.length; i++) {
            var p: player.Player = this.game.players[i];
            if (p != this.focus) {
                // Don't update players in unloaded chunks.
                if (!p.chunk) {
                    return;
                }

                p.setRelativePosition(this.focus.chunk);
                p.image.x = -(this.focus.x - p.x) + offsetX;
                p.image.y = -(this.focus.y - p.y) + offsetY;
                
            }
        }
    }
}