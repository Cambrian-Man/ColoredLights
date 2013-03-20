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
                generated: Boolean,
                tiles: Buffer,
                chambers: [
                    {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'Chamber'
                    }
                ]
            },
            Chamber: {
                x: Number,
                y: Number,
                size: Number,
                connections: [
                    mongoose.Schema.Types.ObjectId
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
        chunk.saved = Date.now();
        return;
        chunk.compressTiles().then(function (tileBuffer) {
            var chunkSave = new _this.models['Chunk']({
                _id: chunk.id,
                x: chunk.chunkX,
                y: chunk.chunkY,
                updated: chunk.updated,
                generated: chunk.generated,
                tiles: tileBuffer,
                chambers: chunk.getChamberIds()
            });
            chunkSave.save(function (err, chunkSave) {
                if(err) {
                    console.error('Error saving chunk', err);
                } else {
                    chunk.saved = Date.now();
                }
            });
        });
    };
    DB.prototype.saveChamber = function (chamber) {
        return;
        var chamberSave = new this.models['Chamber']({
            _id: chamber.id,
            x: chamber.x,
            y: chamber.y,
            size: chamber.size,
            connections: chamber.getConnectionArray()
        });
        chamberSave.save(function (err, chamberSave) {
            if(err) {
                console.log('Error saving chamber', err);
            }
        });
    };
    DB.prototype.updateChunk = function (chunk, update) {
        chunk.saved = Date.now();
        return;
        this.models['Chunk'].update({
            _id: chunk.id
        }, {
            $set: update
        }, function (err, numAffected) {
            if(err) {
                console.log('Error updating chunk', err);
            }
            console.log("Updated", numAffected);
            if(numAffected == 1) {
                chunk.saved = Date.now();
            }
        });
    };
    DB.prototype.getChamber = function (id) {
        var deferred = Q.defer();
        this.models['Chamber'].findOne({
            _id: id
        }, function (err, result) {
            if(err) {
                deferred.reject(err);
            } else {
                deferred.resolve(result);
            }
        });
        return deferred.promise;
    };
    DB.prototype.getChunk = function (props) {
        var deferred = Q.defer();
        var query;
        if(props.id) {
            query = {
                _id: props.id
            };
        } else {
            query = {
                x: props.x,
                y: props.y
            };
        }
        this.models['Chunk'].findOne(query).populate('chambers').exec(function (err, result) {
            if(err) {
                deferred.reject(err);
            } else {
                deferred.resolve(result);
            }
        });
        return deferred.promise;
    };
    return DB;
})();
exports.DB = DB;
//@ sourceMappingURL=DB.js.map
