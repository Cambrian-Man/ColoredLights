/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />

var mongoose = require('mongoose');
var Q: QStatic = require('q');
import map = module("./Map");

export class DB {
    private db;

    private schemaBases: Object = {
        Chunk: {
            id: String,
            x: Number,
            y: Number,
            adjacent: [String],
            tiles: [Number]
        }
    };

    private schemas: Object = {};
    private models: Object = {};
    private schemaNames: string[] = ['Chunk'];

    constructor(host: string, port: number, callback?: Function) {
        var options = {
            db: 'lights',
            user: 'lights_admin',
            pass: 'royGbivMaxwell'
        }

        mongoose.connect('mongodb://lights_admin:royGbivMaxwell@ds043967.mongolab.com:43967/lights');
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
        var chunkSave = new this.models['Chunk']({
            id: chunk.id,
            x: chunk.chunkX,
            y: chunk.chunkY,
            adjacent: chunk.adjacent,
            tiles: chunk.toArray()
        });

        chunkSave.save((err, chunkSave) => {
            if (err) {
                console.error('save error', err);
            }
        });
    }

    getChunk(props: { id?: string; x?: number; y?: number; }): Qpromise {
        var deferred: Qdeferred = Q.defer();
        if (props.id) {
        }

        return deferred.promise;
    }
}