/// <reference path="./ts-definitions/DefinitelyTyped/requirejs/requirejs.d.ts" />

import lights = module("./Client");

require([], () => {
    var el = <HTMLCanvasElement> document.getElementById("game");
    el.width = window.innerWidth * 0.75;
    el.height = el.width * 0.5625;
    var game = new lights.Game(el);
});