import * as PIXI from 'pixi.js';

type A = 7

class World {
    app: PIXI.Application<PIXI.ICanvas>
    constructor() {
        this.app = new PIXI.Application()
    }
}