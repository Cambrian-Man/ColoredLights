/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />

var mongoose = require('mongoose');
var Q: QStatic = require('q');
import map = module("./Map");

export class DB {
    private db;

    private schemaBases: Object = {
        Chunk: {
            x: Number,
            y: Number,
            updated: Number,
            generated: Boolean,
            tiles: Buffer,
            chambers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chamber' }]
        },
        Chamber: {
            x: Number,
            y: Number,
            size: Number,
            connections: [mongoose.Schema.Types.ObjectId]
        }
    };

    private schemas: Object = {};
    private models: Object = {};
    private schemaNames: string[] = ['Chunk', 'Chamber'];

    constructor(uri: string, callback?: Function) {
        mongoose.connect(uri);
        this.db = mongoose.connection;
        this.db.on('error', console.error.bind(console, 'connection error:'));
        this.db.once('open', () => {
            this.createSchemas();

            if (callback) {
                callback();
            }
        });
    }

    createSchemas() {
        var name: string;
        for (var i = 0, tot = this.schemaNames.length; i < tot; i++) {
            name = this.schemaNames[i];
            
            this.schemas[name] = new mongoose.Schema(this.schemaBases[name]);
            this.models[name] = mongoose.model(name, this.schemas[name]);
        }
    }

    saveChunk(chunk: map.Chunk) {
        chunk.saved = Date.now();
        chunk.compressTiles().then((tileBuffer: NodeBuffer) => {
            var chunkSave = new this.models['Chunk']({
                _id: chunk.id,
                x: chunk.chunkX,
                y: chunk.chunkY,
                updated: chunk.updated,
                generated: chunk.generated,
                tiles: tileBuffer,
                chambers: chunk.getChamberIds()
            });

            chunkSave.save((err, chunkSave) => {
                if (err) {
                    console.error('Error saving chunk', err);
                }
                else {
                    chunk.saved = Date.now();
                }
            });
        });
    }

    saveChamber(chamber: map.Chamber) {
        var chamberSave = new this.models['Chamber']({
            _id: chamber.id,
            x: chamber.x,
            y: chamber.y,
            size: chamber.size,
            connections: chamber.getConnectionArray()
        });

        chamberSave.save((err, chamberSave) => {
            if (err) {
                console.log('Error saving chamber', err);
            }
        });
    }

    updateChunk(chunk: map.Chunk, update: Object) {
        chunk.saved = Date.now();
        this.models['Chunk'].update({ _id: chunk.id }, { $set: update }, (err, numAffected) => {
            if (err) {
                console.log('Error updating chunk', err);
            }
            console.log("Updated", numAffected);
            if (numAffected == 1) {
                chunk.saved = Date.now();
            }
        });
    }

    getChamber(id: string): Qpromise {
        var deferred: Qdeferred = Q.defer();

        this.models['Chamber'].findOne({ _id: id }, (err, result) => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(result);
            }
        });

        return deferred.promise;
    }

    getChunk(props: { id?: string; x?: number; y?: number; }): Qpromise {
        var deferred: Qdeferred = Q.defer();
        var query: Object;

        if (props.id) {
            query = { _id: props.id };
        }
        else {
            query = { x: props.x, y: props.y };
        }
        
        this.models['Chunk'].findOne(query)
            .populate('chambers')
            .exec((err, result) => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(result);
            }
        });

        return deferred.promise;
    }
}