/// <reference path="./ts-definitions/DefinitelyTyped/node/node.d.ts" />
/// <reference path="./ts-definitions/DefinitelyTyped/Q/q.d.ts" />
var mongoose = require('mongoose');
var Q = require('q');

var DB = (function () {
    function DB(host, port, callback) {
        var _this = this;
        this.schemaBases = {
            Chunk: {
                id: String,
                x: Number,
                y: Number,
                adjacent: [
                    String
                ],
                tiles: [
                    Number
                ]
            }
        };
        this.schemas = {
        };
        this.models = {
        };
        this.schemaNames = [
            'Chunk'
        ];
        var options = {
            db: 'lights',
            user: 'lights_admin',
            pass: 'royGbivMaxwell'
        };
        mongoose.connect('mongodb://lights_admin:royGbivMaxwell@ds043967.mongolab.com:43967/lights');
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
        var chunkSave = new this.models['Chunk']({
            id: chunk.id,
            x: chunk.chunkX,
            y: chunk.chunkY,
            adjacent: chunk.adjacent,
            tiles: chunk.toArray()
        });
        chunkSave.save(function (err, chunkSave) {
            if(err) {
                console.error('save error', err);
            }
        });
    };
    DB.prototype.getChunk = function (props) {
        var deferred = Q.defer();
        if(props.id) {
        }
        return deferred.promise;
    };
    return DB;
})();
exports.DB = DB;
//@ sourceMappingURL=DB.js.map
