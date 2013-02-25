/// <reference path="./ts-definitions/DefinitelyTyped/easeljs/easeljs.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />
/* global io */

declare var io: any;

class Lights {
    element: HTMLElement;
    stage: createjs.Stage;
    socket: SocketNamespace;

    static chunkSize: number = 64;
    static tileSize: number = 8;
    
    static types = {
        empty: 0,
        wall: 1,
        moss: 2
    };

    constructor(public canvas: HTMLCanvasElement) {
        this.stage = new createjs.Stage(canvas);
        createjs.Ticker.addListener((event) => this.update(event));

        this.socket = <SocketNamespace> io.connect('http://localhost:3300');
        this.socket.on("connection", (data) => this.connection(data));
        this.socket.on("chunk", (data) => this.getChunk(data));
    }

    connection(data) {
        
    }

    getChunk(data) {
        var newChunk: Chunk = new Chunk(0, 0, data.chunk);
        this.stage.addChild(newChunk);
    }

    update(event?: any) {
        this.stage.update();
    }
}

class Chunk extends createjs.Shape {
    data: number[];

    constructor(public chunkX: number, public chunkY: number, data:number[]) {
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

window.onload = () => {
    var el = <HTMLCanvasElement> document.getElementById("game");
    var game = new Lights(el);
};