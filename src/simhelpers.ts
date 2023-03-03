// @ts-ignore Import module
//import * as PIXI from 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.1.4/pixi.min.mjs';
import * as PIXI from 'pixi.js';

type A = 7

export class World {
    app: PIXI.Application<PIXI.ICanvas>
    constructor() {
        this.app = new PIXI.Application()
    }
}


const app = new PIXI.Application({ background: '#223366' });
//document.querySelector(".view").appendChild((app.view));

const container = new PIXI.Container();
app.stage.addChild(container);

// Create a 5x5 grid of bunnies
for (let i = 0; i < 25; i++) {
    const bunny = PIXI.Sprite.from('https://c.nau.ch/i/mJZrA/1024/yb-meister-pokal.jpg');
    bunny.anchor.set(0.5);
    bunny.x = (i % 5) * 40;
    bunny.y = Math.floor(i / 5) * 40;
    container.addChild(bunny);
}

// Move container to the center
container.x = app.screen.width / 2;
container.y = app.screen.height / 2;

// Center bunny sprite in local container coordinates
container.pivot.x = container.width / 2;
container.pivot.y = container.height / 2;

// Listen for animate update
app.ticker.add((delta) => {
    // rotate the container!
    // use delta to create frame-independent transform
    container.rotation -= 0.01 * delta;
});
