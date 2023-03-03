import * as PIXI from 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.1.4/pixi.min.mjs';

type A = 7

export class World {
    app: PIXI.Application<PIXI.ICanvas>
    constructor() {
        this.app = new PIXI.Application()
    }
}