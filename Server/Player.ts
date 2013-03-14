/// <reference path="./ts-definitions/DefinitelyTyped/socket.io/socket.io.d.ts" />

class Player {
    constructor(public id: string, public x: number, public y: number, private socket: Socket) {
    }
}