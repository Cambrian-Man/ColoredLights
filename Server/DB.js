/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var mongoose = require('mongoose');
var Q = require('q');

var DB = (function () {
    function DB(uri, callback) {
        var _this = this;
        this.schemaBases = {
            Chunk: {
                x: Number,
                y: Number,
                updated: Number,
                tiles: Buffer,
                chambers: [
                    mongoose.Types.ObjectId
                ]
            },
            Chamber: {
                x: Number,
                y: Number,
                size: Number,
                connections: [
                    mongoose.Types.ObjectId
                ]
            }
        };
        this.schemas = {
        };
        this.models = {
        };
        this.schemaNames = [
            'Chunk', 
            'Chamber'
        ];
        mongoose.connect(uri);
        this.db = mongoose.connection;
        this.db.on('error', console.error.bind(console, 'connection error:'));
        this.db.once('open', function () {
            _this.createSchemas();
            if(callback) {
                callback();
            }
        });
    }
    DB.prototype.createSchemas = function () {
        var name;
        for(var i = 0, tot = this.schemaNames.length; i < tot; i++) {
            name = this.schemaNames[i];
            this.schemas[name] = new mongoose.Schema(this.schemaBases[name]);
            this.models[name] = mongoose.model(name, this.schemas[name]);
        }
    };
    DB.prototype.saveChunk = function (chunk) {
        var _this = this;
        return;
        chunk.compressTiles().then(function (tileBuffer) {
            var chunkSave = new _this.models['Chunk']({
                _id: chunk.id,
                x: chunk.chunkX,
                y: chunk.chunkY,
                updated: chunk.updated,
                tiles: tileBuffer,
                chambers: chunk.getChamberIds()
            });
            chunkSave.save(function (err, chunkSave) {
                if(err) {
                    console.error('save error', err);
                }
            });
        });
    };
    DB.prototype.saveChamber = function (chamber) {
        var chamberSave = new this.models['Chamber']({
            _id: chamber.id,
            x: chamber.x,
            y: chamber.y,
            size: chamber.size,
            connections: chamber.getConnectionArray()
        });
    };
    DB.prototype.updateChunk = function (chunk, update) {
        this.models['Chunk'].findOneAndUpdate({
            _id: chunk.id
        }, {
            $set: update
        });
    };
    DB.prototype.getChunk = function (props) {
        var deferred = Q.defer();
        var query;
        /*
        if (props.id) {
        query = { _id: props.id };
        }
        else {
        query = { x: props.x, y: props.y };
        }
        this.models['Chunk'].count(query, (err, count) => {
        if (count == 0) {
        deferred.resolve(null);
        }
        else {
        this.models['Chunk'].findOne(query, (err, result) => {
        if (err) {
        deferred.reject(err);
        }
        else if (result) {
        deferred.resolve(result);
        }
        });
        }
        });
        */
        deferred.resolve(null);
        return deferred.promise;
    };
    return DB;
})();
exports.DB = DB;
//@ sourceMappingURL=DB.js.map
