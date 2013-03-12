/// <reference path="./ts-definitions/DefinitelyTyped/easeljs/easeljs.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/* global io */

declare var io: any;

class Lights {
    element: HTMLElement;
    stage: createjs.Stage;
    socket: SocketNamespace;

    public camera: Camera;

    public chunks: Object;
    public displayChunks: createjs.Container;
    public players: Object;
    public thisPlayer: Player;

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

    static public directionNames: string[] = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

    constructor(public canvas: HTMLCanvasElement) {
        this.stage = new createjs.Stage(canvas);
        this.camera = new Camera(this, canvas.width, canvas.height);

        Lights.tileSize = Math.floor(canvas.width / 40);
        Lights.pixelSize = Lights.chunkSize * Lights.tileSize;

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
                    this.enterChunk(data['chunk']);
                    clearInterval(interval);
                }
            }, 500);
        });

        this.chunks = {};
        this.players = {};
    }

    connect(data) {
        window.addEventListener("keydown", (event: KeyboardEvent) => this.keyDown(event));
        window.addEventListener("keyup", (event: KeyboardEvent) => this.keyUp(event));

        this.thisPlayer = new Player(data.id, this);
        this.players[data.id] = this.thisPlayer;
        this.thisPlayer.x = 0;
        this.thisPlayer.y = 0;
        this.stage.addChild(this.thisPlayer.image);
        this.thisPlayer.image.x = this.stage.canvas.width / 2 - (this.thisPlayer.size.width / 2);
        this.thisPlayer.image.y = this.stage.canvas.height / 2 - (this.thisPlayer.size.width / 2);

        createjs.Ticker.addListener((event) => this.update(event));
    }

    keyDown(event: KeyboardEvent) {
        switch (event.keyCode) {
            case Lights.keyCodes.up:
                Lights.keys.up = true;
                break;
            case Lights.keyCodes.down:
                Lights.keys.down = true;
                break;
            case Lights.keyCodes.left:
                Lights.keys.left = true;
                break;
            case Lights.keyCodes.right:
                Lights.keys.right = true;
                break;
        }
    }

    keyUp(event: KeyboardEvent) {
        switch (event.keyCode) {
            case Lights.keyCodes.up:
                Lights.keys.up = false;
                break;
            case Lights.keyCodes.down:
                Lights.keys.down = false;
                break;
            case Lights.keyCodes.left:
                Lights.keys.left = false;
                break;
            case Lights.keyCodes.right:
                Lights.keys.right = false;
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

        if (!this.thisPlayer.chunk) {
            this.thisPlayer.chunk = newChunk;
        }

        this.chunks[data.id] = newChunk;
    }

    update(event?: any) {
        this.stage.update();

        if (Lights.keys.up) {
            this.thisPlayer.speed.y = -10;
        }
        else if (Lights.keys.down) {
            this.thisPlayer.speed.y = 10;
        }
        else {
            this.thisPlayer.speed.y = 0;
        }

        if (Lights.keys.left) {
            this.thisPlayer.speed.x = -10;
        }
        else if (Lights.keys.right) {
            this.thisPlayer.speed.x = 10;
        }
        else {
            this.thisPlayer.speed.x = 0;
        }

        if (this.thisPlayer.chunk) {
            this.thisPlayer.move(this.thisPlayer.speed);
            if ((this.thisPlayer.x < 0 || this.thisPlayer.x > Lights.pixelSize) ||
                (this.thisPlayer.y < 0 || this.thisPlayer.y > Lights.pixelSize)) {
                this.changeChunk();
            }

            this.camera.focus(this.thisPlayer);
        }
    }

    changeChunk() {
        var chunk: Chunk = this.getChunkByPixel(this.thisPlayer.x, this.thisPlayer.y);
        this.thisPlayer.x %= Lights.pixelSize;
        if (this.thisPlayer.x < 0) { this.thisPlayer.x += Lights.pixelSize; }
        this.thisPlayer.y %= Lights.pixelSize;
        if (this.thisPlayer.y < 0) { this.thisPlayer.y += Lights.pixelSize; }

        this.socket.emit("enterChunk", { x: chunk.chunkX, y: chunk.chunkY });
    }

    enterChunk(id: string) {
        var pixelSize = Lights.chunkSize * Lights.tileSize;
        this.displayChunks.removeAllChildren();

        this.thisPlayer.chunk = this.chunks[id];
        this.displayChunks.addChild(this.thisPlayer.chunk);

        this.thisPlayer.chunk.x = 0;
        this.thisPlayer.chunk.y = 0;

        for (var i = 0; i < 8; i++) {
            var p: Point = Lights.directions[i];
            var adjChunk: Chunk = this.chunks[this.thisPlayer.chunk.adjacent[i]];
            this.displayChunks.addChild(adjChunk);
            if (adjChunk) {
                adjChunk.x = p.x * pixelSize;
                adjChunk.y = p.y * pixelSize;
            }
        }
    }

    getChunkByPixel(x: number, y: number): Chunk {
        var pixelSize = Lights.chunkSize * Lights.tileSize;
        var p: Point = { x: 0, y: 0 };
        if (x < 0) {
            p.x = -1;
        }
        else if (x > pixelSize) {
            p.x = 1;
        }

        if (y < 0) {
            p.y = -1;
        }
        else if (y > pixelSize) {
            p.y = 1;
        }

        return this.chunkAt(this.thisPlayer.chunk.chunkX + p.x, this.thisPlayer.chunk.chunkY + p.y);
    }

    isInChunk(p: Point):bool {
        return (p.x >= 0 || p.y >= 0 || p.x < Lights.pixelSize || p.y < Lights.pixelSize);
    }

    rollOver(p: Point): { x: number; y: number; chunk: Chunk; } {
        var chunk: Chunk = this.getChunkByPixel(p.x, p.y);
        var newPoint = {x: 0, y: 0};
        newPoint.x = p.x % Lights.pixelSize;
        if (newPoint.x < 0) { newPoint.x += Lights.pixelSize; }
        newPoint.y = p.y % Lights.pixelSize;
        if (newPoint.y < 0) { newPoint.y += Lights.pixelSize; }

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

class Chunk extends createjs.Shape {
    data: number[];
    public layer: number = 1;

    constructor(public chunkX: number, public chunkY: number, data:number[], public adjacent:string[], public updated:number) {
        super();

        this.data = data;
        this.generateGraphics();
    }

    generateGraphics() {
        this.graphics.beginFill("#000").rect(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);

        for (var i = 0; i < this.data.length; i++) {
            var t: Tile = Tile.fromCode(this.data[i]);
            if (t.type == Lights.types.empty) {
                continue;
            }

            t.draw(this.graphics, this.tilePoint(i));
        }

        this.cache(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
    }

    isBlocking(p: Point): bool {
        var tilePoint = {
            x: Math.floor(p.x / Lights.tileSize),
            y: Math.floor(p.y / Lights.tileSize)
        }
        
        var type: number = this.data[(tilePoint.y * Lights.chunkSize) + tilePoint.x] % 10;

        if (type == 1) {
            return true;
        }
        else {
            return false;
        }
    }

    tilePoint(i: number): Point {
        var x: number = i % Lights.chunkSize;
        var y: number = Math.floor(i / Lights.chunkSize);
        return { x: x, y: y };
    }
}

interface Point {
    x: number;
    y: number;
}

class Tile {
    constructor(public type: number, public color: Color, public code:number) {

    }

    draw(graphics: createjs.Graphics, point: Point) {
        point.x *= Lights.tileSize;
        point.y *= Lights.tileSize;

        var canvas: HTMLCanvasElement;

        if (Lights.tileCache[this.code.toString()]) {
            canvas = <HTMLCanvasElement> Lights.tileCache[this.code.toString()];
        }
        else {
            canvas = <HTMLCanvasElement> document.createElement("canvas");
            canvas.width = Lights.tileSize;
            canvas.height = Lights.tileSize;
            var newGraphic: createjs.Graphics = new createjs.Graphics();
            newGraphic.beginFill(this.colorString());
            newGraphic.rect(0, 0, Lights.tileSize, Lights.tileSize);

            if (Lights.simpleGraphics) {
                return;
            }

            newGraphic.beginFill(this.modColor(new Color(20, 20, 10)));
            newGraphic.moveTo(0, 0)
                .lineTo(0 + Lights.tileSize, 0)
                .lineTo(0 + (Lights.tileSize / 2), 0 + (Lights.tileSize / 2))
                .closePath();

            newGraphic.beginFill(this.modColor(new Color(-20, -20, 0)));
            newGraphic.moveTo(0, 0 + Lights.tileSize)
                .lineTo(0 + Lights.tileSize, 0 + Lights.tileSize)
                .lineTo(0 + (Lights.tileSize / 2), 0 + (Lights.tileSize / 2))
                .closePath();

            var shape: createjs.Shape = new createjs.Shape(newGraphic);
            shape.draw(canvas.getContext("2d"));
            Lights.tileCache[this.code.toString()] = canvas;
            console.log(Lights.tileCache);
        }



        graphics.beginBitmapFill(canvas);
        graphics.rect(point.x, point.y, Lights.tileSize, Lights.tileSize);
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

class Color {
    constructor(public r: number, public g: number, public b: number) {
        this.r = Math.round(r);
        this.g = Math.round(g);
        this.b = Math.round(b);
    }

    toString() {
        return "rgba(" + [this.r, this.g, this.b, 1.0].join(',') + ")";
    }
}

class Player {
    public x: number;
    public y: number;
    public speed: { x: number; y: number; };
    public size: { width: number; height: number; };
    public chunk: Chunk;
    public image: createjs.Shape;

    constructor(public id, public game: Lights) {
        this.speed = {
            x: 10,
            y: 10
        };

        this.size = {
            width: Lights.tileSize,
            height: Lights.tileSize
        };

        var g: createjs.Graphics = new createjs.Graphics();
        g.beginFill("#EEE");
        g.drawRoundRect(0, 0, this.size.width, this.size.height, 2);
        this.image = new createjs.Shape(g);
    }

    collide(p: Point):bool{
        if (this.collidePoint({
            x: p.x,
            y: p.y
        })) {
            return true;
        }
        else if (this.collidePoint({
                x: this.size.width + p.x,
                y: p.y
        })) {
            return true;
        }
        else if (this.collidePoint({
                x: p.x,
                y: this.size.height + p.y
        })) {
            return true;
        }
        else if (this.collidePoint({
                x: this.size.width + p.x,
                y: this.size.height + p.y
        })) {
            return true;
        }

        return false;
    }

    collidePoint(p: Point): bool {
        var chunk: Chunk = this.chunk;
        if (this.game.isInChunk(p)) {
            if (chunk.isBlocking(p)) { return true } else { return false; }
        }
        else {
            var roll: { x: number; y: number; chunk: Chunk; } = this.game.rollOver(p);
            chunk = roll.chunk;
            if (chunk.isBlocking(roll)) {
                return true;
            }
            else {
                return false;
            }
        }
    }

    move(step: Point) {
        var newPoint: { x: number; y: number; chunk: Chunk; } = {
            x: this.x + step.x,
            y: this.y + step.y,
            chunk: this.chunk
        };
        
        if (!this.game.isInChunk(newPoint)) {
            newPoint = this.game.rollOver(newPoint);
            this.chunk = newPoint.chunk;
        }

        if (!this.collide(newPoint)) {
            this.x = newPoint.x;
            this.y = newPoint.y;
        }
        else {
            var newStep = {x : 0, y: 0};
            if (Math.abs(step.x) > 0) {
                newStep['x'] = (step.x > 0) ? step.x -= 1 : step.x += 1;
            }
            if (Math.abs(step.y) > 0) {
                newStep['y'] = (step.y > 0) ? step.y -= 1 : step.y += 1;
            }

            if (Math.abs(newStep.x) > 0 || Math.abs(newStep.y) > 0) {
                this.move(newStep);
            }
        }
    }
}

class Camera {
    public x: number;
    public y: number;

    constructor(public game:Lights, public width: number, public height: number) {
        this.x = 0;
        this.y = 0;
    }

    focus(player: Player) {
        this.game.displayChunks.x = -player.x + (this.game.stage.canvas.width / 2) - (player.size.height / 2)
        this.game.displayChunks.y = -player.y + (this.game.stage.canvas.height / 2) - (player.size.height / 2);
    }
}

window.onload = () => {
    var el = <HTMLCanvasElement> document.getElementById("game");
    el.width = window.innerWidth * 0.75;
    el.height = el.width * 0.5625;
    var game = new Lights(el);
};