/// <reference path="./ts-definitions/DefinitelyTyped/easeljs/easeljs.d.ts" />
/// <reference path="./Client.ts" />

import client = module("./Client");

export class Player {
    public x: number;
    public y: number;
    public speed: { x: number; y: number; };
    public size: { width: number; height: number; };
    public chunk: client.Chunk;
    public image: createjs.Shape;
    private updateTimer: number;
    
    constructor(public id, public game: client.Game) {
        this.speed = {
            x: 0,
            y: 0
        };

        this.speed.x = Math.round(client.Game.tileSize / 4);
        this.speed.y = Math.round(client.Game.tileSize / 4);

        this.size = {
            width: client.Game.tileSize,
            height: client.Game.tileSize
        };

        var g: createjs.Graphics = new createjs.Graphics();
        g.beginFill("#EEE");
        g.drawRoundRect(0, 0, this.size.width, this.size.height, 2);
        this.image = new createjs.Shape(g);
    }

    update(data) {
        this.x = data.x * client.Game.tileSize;
        this.y = data.y * client.Game.tileSize;
    }

    sendUpdates() {
        this.updateTimer = setInterval(() => {
            if (!this.chunk) {
                return;
            }
            this.game.socket.emit("playerUpdate", {
                chunkID: this.chunk.chunkID,
                id: this.id,
                x: this.x / client.Game.tileSize,
                y: this.y / client.Game.tileSize
            });
        }, 50);
    }

    setRelativePosition(to: client.Chunk) {
        var relX: number = this.chunk.chunkX - to.chunkX;
        var relY: number = this.chunk.chunkY - to.chunkY;

        this.image.x = relX * client.Game.pixelSize;
        this.image.y = relY * client.Game.pixelSize;
    }

    collide(p: client.Point): bool {
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

    collidePoint(p: client.Point): bool {
        var chunk: client.Chunk = this.chunk;

        if (this.game.isInChunk(p)) {
            if (chunk.isBlocking(p)) {
                return true;
            } else {
                return false;
            }
        }
        else {
            var roll = this.game.rollOver(p);
            chunk = roll.chunk;
            if (chunk.isBlocking(roll)) {
                return true;
            }
            else {
                return false;
            }
        }
    }

    move(step: client.Point) {
        var newPoint = {
            x: this.x + step.x,
            y: this.y + step.y
        };

        if (!this.collide(newPoint)) {
            this.x = newPoint.x;
            this.y = newPoint.y;
        }
        else {
            var newStep = { x: 0, y: 0 };
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