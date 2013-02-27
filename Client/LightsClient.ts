/// <reference path="./ts-definitions/DefinitelyTyped/easeljs/easeljs.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/* global io */

declare var io: any;

class Lights {
    element: HTMLElement;
    stage: createjs.Stage;
    socket: SocketNamespace;

    public camera: Camera;
    currentChunk: Chunk;

    public chunks: Object;

    static chunkSize: number = 64;
    static tileSize: number = 4;
    
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

    constructor(public canvas: HTMLCanvasElement) {
        this.stage = new createjs.Stage(canvas);
        this.camera = new Camera(this, canvas.width, canvas.height);

        this.socket = <SocketNamespace> io.connect('http://localhost:3300');
        this.socket.on("chunk", (data) => this.addChunk(data));
        this.socket.on("offerChunk", (data) => this.checkChunk(data));
        this.socket.on("connection", (data) => this.connect(data));

        this.chunks = {};
    }

    connect(data) {
        window.addEventListener("keydown", (event: KeyboardEvent) => this.keyDown(event));
        window.addEventListener("keyup", (event: KeyboardEvent) => this.keyUp(event));

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
        if (!this.chunks[data.id]) {
            this.socket.emit("requestChunk", { x: data.x, y: data.y });
        }
    }

    addChunk(data) {
        var newChunk: Chunk = new Chunk(data.x, data.y, data.chunk, data.adjacent);
        this.stage.addChild(newChunk);

        if (!this.currentChunk) {
            this.currentChunk = newChunk;
        }

        this.chunks[data.id] = newChunk;
    }

    update(event?: any) {
        this.stage.update();

        if (Lights.keys.up) {
            this.camera.y -= 10;
        }
        else if (Lights.keys.down) {
            this.camera.y += 10;
        }

        if (Lights.keys.left) {
            this.camera.x -= 10;
        }
        else if (Lights.keys.right) {
            this.camera.x += 10;
        }

        if (this.currentChunk) {
            if ((this.camera.x < 0 || this.camera.x > Lights.chunkSize * Lights.tileSize) ||
                (this.camera.y < 0 || this.camera.y > Lights.chunkSize * Lights.tileSize)) {
                this.currentChunk = this.getChunkByPixel(this.camera.x, this.camera.y);
                this.socket.emit("enterChunk", { x: this.currentChunk.chunkX, y: this.currentChunk.chunkY });
            }

            this.camera.focus(this.currentChunk, this.camera.x, this.camera.y);
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
        return this.chunkAt(this.currentChunk.chunkX + p.x, this.currentChunk.chunkY + p.y);
    }

    chunkAt(x: number, y: number): Chunk {
        console.log(this.chunks);
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

    constructor(public chunkX: number, public chunkY: number, data:number[], public adjacent:string[]) {
        super();

        this.data = data;
        this.generateGraphics();
    }

    generateGraphics() {
        this.graphics.beginFill("#000").rect(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);

        for (var i = this.data.length - 1; i > 0; i--) {
            var t: Tile = Tile.fromCode(this.data[i]);
            if (t.type == Lights.types.empty) {
                continue;
            }

            this.graphics.beginFill(t.color.toString());
            var p: Point = this.tilePoint(i);
            this.graphics.rect(p.x * Lights.tileSize, p.y * Lights.tileSize, Lights.tileSize, Lights.tileSize);
        }

        this.cache(0, 0, Lights.chunkSize * Lights.tileSize, Lights.chunkSize * Lights.tileSize);
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
    constructor(public type: number, public color: Color) {

    }

    static fromCode(code: number):Tile {
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

class Camera {
    public x: number;
    public y: number;

    constructor(public game:Lights, public width: number, public height: number) {
        this.x = 0;
        this.y = 0;
    }

    focus(chunk: Chunk, x: number, y: number) {
        var chunkX: number = chunk.chunkX;
        var chunkY: number = chunk.chunkY;
        var chunkPixels: number = Lights.chunkSize * Lights.tileSize;

        chunk.x = -x;
        chunk.y = -y;

        for (var i = 0; i < 8; i++) {
            var p: Point = Lights.directions[i];
            var adjChunk: Chunk = this.game.chunks[chunk.adjacent[i]];
            adjChunk.x = p.x * chunkPixels - x;
            adjChunk.y = p.y * chunkPixels - y;
        }
    }
}

window.onload = () => {
    var el = <HTMLCanvasElement> document.getElementById("game");
    var game = new Lights(el);
};