/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />

export class Player {
    public x: number;
    public y: number;
    public chunkID;

    constructor(public id: string, private socket: Socket) {
    }

    update(data, callback: (update: { id: string; chunkID: string; x: number; y: number; }) => {}) {
        if (this.id != data.id) {
            return;
        }

        this.x = data.x;
        this.y = data.y;
        this.chunkID = data.chunkID;

        if (callback) {
            callback({
                id: this.id,
                chunkID: this.chunkID,
                x: this.x,
                y: this.y
            });
        }
    }
}