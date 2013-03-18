define(["require", "exports", "./Client"], function(require, exports, __lights__) {
    /// <reference path="./ts-definitions/DefinitelyTyped/requirejs/requirejs.d.ts" />
    var lights = __lights__;

    require([], function () {
        var el = document.getElementById("game");
        el.width = window.innerWidth * 0.75;
        el.height = el.width * 0.5625;
        var game = new lights.Game(el);
    });
})
