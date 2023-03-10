// @ts-ignore Import module
//import * as PIXI from 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.1.4/pixi.min.mjs';
import * as PIXI from 'pixi.js';

type TCoord = { x: number, y: number }
type TDim = {w: number, h: number}
type TGrid = {step?: number, onlyX?: boolean, onlyY?: boolean}

type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
type HEX = `#${string}`;
type Color = RGB | RGBA | HEX;

type Background = {img?: string, color?: Color}
type Dimension = {unit?: string, w?: number, h?: number, minUnits?: TCoord, maxPx?: {w: number, h: number}}
type WorldParams = {element?: Element | null} & Background & Dimension
type CoordProps = {step: number, color: Color, onlyX: boolean, onlyY: boolean}
let latestWorld: World 

export class World {
    readonly originalParams: WorldParams
    readonly element: HTMLElement
    private img?: string
    private minUnits: TCoord
    private maxPx: TDim
    private color: Color
    private background?: PIXI.Sprite
    actors: Actor[]
    readonly app: PIXI.Application
    private coordProps?: {container: PIXI.Container} & Partial<CoordProps>

    constructor(params: WorldParams) {
        this.originalParams = params        
        this.element = params.element as HTMLElement || document.body
        this.maxPx = params.maxPx || this.getAutoSize()
        // todo default coords middle
        // todo image cover
        this.minUnits = params.minUnits || {x: 0, y: 0}
        this.img = params.img || ""
        this.color = params.color || "#111";
        this.app = new PIXI.Application({background: this.color});
        this.element.appendChild(this.app.view as unknown as HTMLElement)
        this.actors = []
        this.adaptSize()
        this.loadBackground()
        latestWorld = this
        window.addEventListener("resize", ()=>this.onResizeContainer())       
        //add resizeObserver
    }
    private getAutoSize() {
        return {w: Math.min(window.innerWidth, this.element.getBoundingClientRect().width), h: window.innerHeight}
    }
    getAspectRatio() {
        return this.getForcedRatio() || this.getStoredRatio() || window.innerWidth / window.innerHeight
    }
    private getForcedRatio() {
        const {w, h} = this.originalParams
        return w && h ? w / h : null
    }
    private getStoredRatio() {
        return localStorage[this.getAspectKey()] || null
    }
    private getAspectKey() {
        return `simhelpers-ratio-${this.img}`
    }
    adaptSize() {
        const {w, h} = this.dimPx()
        this.app.view.width = w
        this.app.view.height = h
        this.app.resizeTo = this.app.view as HTMLCanvasElement
        this.app.resize()
        for(let actor of this.actors) {
            actor.onResize()
        }
    }
    dimPx() {
        const {w: wMax, h: hMax} = this.maxPx
        const {w: wUnit, h: hUnit} = this.dimUnits()
        const limit = wMax > this.getAspectRatio() * hMax ? "H" : "W"
        const pxPerUnit = limit === "W" ? wMax / wUnit : hMax / hUnit
        return {w: wUnit * pxPerUnit, h: hUnit * pxPerUnit, pxPerUnit}
    }
    dimUnits() {
        const {w, h} = this.originalParams
        return {
            w: w || (h && h * this.getAspectRatio()) || this.maxPx.w,
            h: h || (w && w / this.getAspectRatio()) || this.maxPx.h,
        }
    }
    get wUnits() {
        return this.dimUnits().w
    }
    get hUnits() {
        return this.dimUnits().h
    }
    set wUnits(w: number) {
        this.originalParams.w = w
        this.adaptSize()
    }
    set hUnits(h: number) {
        this.originalParams.h = h
        this.adaptSize()
    }
    loadBackground() {
        const img = this.img
        if (img) {
            this.background = PIXI.Sprite.from(img);
            this.app.stage.addChild(this.background);
            console.log("add bg");
            this.background.texture.baseTexture.on("loaded", () => {
                console.log("bg ready");
                this.resizeBG()
            })
        }
    }
    resizeBG() {
        if(!this.background) return
        const {width, height} = this.background.texture.baseTexture
        const imgRatio = width / height
        if(!this.getForcedRatio()) {
            localStorage[this.getAspectKey()] = imgRatio
        }      
        this.adaptSize()
        const {w, h} = this.dimPx()
        this.background.scale.set(w/width)
        this.render()
    }
    onResizeContainer() {
        if(!this.originalParams.maxPx) {
            this.maxPx = this.getAutoSize()
        }
        this.updateAxis()
        this.resizeBG()
    }
    render() {
        this.app.renderer.render(this.app.stage)
    }
    add(obj: Actor) {
        this.actors.push(obj) 
        console.log("add actor");
        this.app.stage.addChild(obj.sprite)
        this.render()
    }
    xToPx(xUnit: number) {
        return (xUnit - this.minUnits.x) * this.getPxPerUnit()
    }
    yToPx(yUnit: number) {
        return this.dimPx().h - (yUnit - this.minUnits.y) * this.getPxPerUnit()
    }
    unitsToPx(units: TCoord) {
        return { x: this.xToPx(units.x), y: this.yToPx(units.y) }
    }
    xToUnit(xPx: number) {
        return xPx / this.getPxPerUnit() + this.minUnits.x
    }
    yToUnit(yPx: number) {
        return (this.dimPx().h - yPx) / this.getPxPerUnit() + this.minUnits.y
    }
    getPxPerUnit() {
        return this.dimPx().pxPerUnit
    }
    pxToUnits(px: TCoord) {
        return { x: this.xToUnit(px.x), y: this.yToUnit(px.y) }
    }
    update() {
        this.actors.forEach(a => a.draw())
        this.render()
    }
    private updateAxis() {
        if(!this.coordProps) return
        let {container, step, color = "#444", onlyX = false, onlyY = false} = this.coordProps
        container.removeChildren()
        step = step || 10**Math.log10(Math.ceil(this.wUnits) - 1)
        var world = this;
        //  var koordinatenachse = new PIXI.Graphics();
        //  koordinatenachse.lineStyle(4, 0xFFFFFF, 1);
        //  koordinatenachse.moveTo(0, maxHeight);
        //  koordinatenachse.lineTo(0, 0);
        //  stage.addChild(koordinatenachse);
        var createLabel = function (val: number, axis: string) {
            var number = axis == "x" ? world.xToPx(val) : world.yToPx(val)
            var skala = new PIXI.Text(val + " " + world.originalParams.unit, { fontFamily: "Tahoma", fontSize: 13, fill: color });
            skala.position.x = axis == "x" ? number : offset.x;
            skala.position.y = axis == "y" ? number : world.dimPx().h - offset.y;
            skala.anchor.x = axis == "x" ? 0.5 : 0;
            skala.anchor.y = axis == "y" ? 0.5 : 1;
            container!.addChild(skala);
        };
        var offset = { x: 5, y: 2 } //px von Rand;

        if (!onlyX) {
            const maxY = world.minUnits.y + world.dimPx().h
            for (let i = step * Math.ceil((world.minUnits.y + 0.1 * step) / step); i < maxY - 0.1 * step; i += step) { createLabel(i, "y"); }
        }
        if (!onlyY) {
            const maxX = world.minUnits.x + world.dimPx().w
            for (let i = step * Math.ceil((world.minUnits.x + 0.1 * step) / step); i < maxX - 0.1 * step; i += step) { createLabel(i, "x"); }
        }
        this.render();
    }
    createAxis(p: Partial<CoordProps>) {
        const container = new PIXI.Container()
        this.coordProps = {container, ...p}
        this.app.stage.addChild(container)
        this.updateAxis()
    }
}

// type WorldOptions = {
//     element: HTMLElement
//     wPx: number
//     hPx: number
//     wUnits: number
//     hUnits: number
//     pxPerUnit: number
//     grid: TGrid
//     unit: string
//     minUnits: TCoord
//     maxUnits: TCoord
//     img: string | undefined
//     bgColor: string
//     fontColor: string
// }

// let latestWorldOld: WorldOld

// export class WorldOld {
//     element: HTMLElement
//     hPx: number
//     wPx: number
//     pxPerUnit!: number
//     wUnits!: number
//     hUnits!: number
//     unit: string
//     minUnits!: TCoord
//     maxUnits!: TCoord
//     img?: string
//     bgColor: string
//     fontColor: string
//     app: PIXI.Application<PIXI.ICanvas>
//     stage: PIXI.Container<PIXI.DisplayObject>
//     originalParams: Partial<WorldOptions>
//     actors: Actor[]
//     constructor(params: Partial<WorldOptions> = {}) {
//         this.originalParams = params
//         this.wPx = params.wPx || window.innerWidth;
//         this.hPx = params.hPx || window.innerHeight;
//         this.unit = params.unit || "m";

//         this.img = params.img || undefined
//         this.bgColor = params.bgColor || "#000";
//         this.fontColor = params.fontColor || "#fff";

//         this.app = new PIXI.Application({ background: this.bgColor });
//         this.stage = this.app.stage;
//         this.rescale()

//         //this.renderer = new PIXI.autoDetectRenderer(this.wPx, this.hPx);

//         this.element = params.element || document.body
//         this.element.appendChild(this.app.view as unknown as HTMLElement);

//         if (params.img) {
//             var background = PIXI.Sprite.from(params.img);
//             this.stage.addChild(background);            
//             background.texture.baseTexture.on("loaded", () => {
//                 this.resizeBG(background)
//                 this.createAxis(params.grid);
//             })
//             window.addEventListener("resize", ()=>this.resizeBG(background))
//         }
//         else {
//             this.createAxis(params.grid);
//         }
//         this.app.renderer.render(this.stage)
//         this.actors = [];
//         latestWorldOld = this
//     }
//     resizeBG(background: PIXI.Sprite) {
//         this.wPx = this.originalParams.wPx || this.element.getBoundingClientRect().width;
//         this.hPx = this.originalParams.hPx || window.innerHeight;
//         const {width, height} = background.texture.baseTexture
//         console.log({wPx: this.wPx, hPx: this.hPx, width, height});
//         var bgScale = Math.min(this.wPx / width, this.hPx / height)
//         background.width = width * bgScale
//         background.height = height * bgScale
//         this.wPx = width * bgScale;
//         this.hPx = height * bgScale;
//         this.app.view.width = this.wPx
//         this.app.view.height = this.hPx
//         this.app.resize()
//         console.log({wPx: this.wPx, hPx: this.hPx, width, height, bgScale});
//         this.rescale()
//         this.render()
//     }
//     rescale() {
//         const params = this.originalParams
//         if (params.pxPerUnit) {
//             this.pxPerUnit = params.pxPerUnit
//             this.wUnits = this.wPx / this.pxPerUnit
//             this.hUnits = this.hPx / this.pxPerUnit
//         }
//         else if (params.wUnits) {
//             this.wUnits = params.wUnits
//             this.pxPerUnit = this.wPx / this.wUnits
//             this.hUnits = this.hPx / this.pxPerUnit
//         }
//         else if (params.hUnits) {
//             this.hUnits = params.hUnits
//             this.pxPerUnit = this.hPx / this.hUnits
//             this.wUnits = this.wPx / this.pxPerUnit
//         }
//         else {
//             this.pxPerUnit = 1
//             this.wUnits = this.wPx / this.pxPerUnit
//             this.hUnits = this.hPx / this.pxPerUnit
//         }
//         this.minUnits = params.minUnits || { x: -this.wUnits / 2, y: -this.hUnits / 2 };
//         this.maxUnits = params.maxUnits || { x: this.minUnits.x + this.wUnits, y: this.minUnits.y + this.hUnits };
//     }

//     render() {
//         this.app.renderer.render(this.stage)
//     }
//     add(obj: Actor) {
//         this.actors.push(obj)
//         console.log({obj});
        
//         this.stage.addChild(obj.sprite)
//         this.render()
//     }
//     xToPx(xUnit: number) {
//         return (xUnit - this.minUnits.x) * this.pxPerUnit
//     }
//     yToPx(yUnit: number) {
//         return this.hPx - (yUnit - this.minUnits.y) * this.pxPerUnit
//     }
//     unitsToPx(units: TCoord) {
//         return { x: this.xToPx(units.x), y: this.yToPx(units.y) }
//     }
//     xToUnit(xPx: number) {
//         return xPx / this.pxPerUnit + this.minUnits.x
//     }
//     yToUnit(yPx: number) {
//         return (this.hPx - yPx) / this.pxPerUnit + this.minUnits.y
//     }
//     pxToUnits(px: TCoord) {
//         return { x: this.xToUnit(px.x), y: this.yToUnit(px.y) }
//     }
//     createAxis(grid?: TGrid) {
//         if(!grid) return
//         var step = grid.step || 100;
//         var world = this;
//         //  var koordinatenachse = new PIXI.Graphics();
//         //  koordinatenachse.lineStyle(4, 0xFFFFFF, 1);
//         //  koordinatenachse.moveTo(0, maxHeight);
//         //  koordinatenachse.lineTo(0, 0);
//         //  stage.addChild(koordinatenachse);
//         var createLabel = function (val: number, axis: string) {
//             var number = axis == "x" ? world.xToPx(val) : world.yToPx(val)
//             var skala = new PIXI.Text(val + " " + world.unit, { fontFamily: "Tahoma", fontSize: 13, fill: world.fontColor });
//             skala.position.x = axis == "x" ? number : offset.x;
//             skala.position.y = axis == "y" ? number : world.hPx - offset.y;
//             skala.anchor.x = axis == "x" ? 0.5 : 0;
//             skala.anchor.y = axis == "y" ? 0.5 : 1;
//             world.stage.addChild(skala);
//         };

//         var offset = { x: 5, y: 2 } //px von Rand;

//         if (!grid.onlyX) {
//             for (var i = step * Math.ceil((world.minUnits.y + 0.1 * step) / step); i < this.maxUnits.y - 0.1 * step; i += step) { createLabel(i, "y"); }
//         }
//         if (!grid.onlyY) {
//             for (var i = step * Math.ceil((world.minUnits.x + 0.1 * step) / step); i < this.maxUnits.x - 0.1 * step; i += step) { createLabel(i, "x"); }
//         }
//         this.render();
//     }
//     update() {
//         this.actors.forEach(a => a.draw())
//         this.render()
//     }
// }

//   // Listen for animate update
//   app.ticker.add((delta) => {
//       // rotate the container!
//       // use delta to create frame-independent transform
//       container.rotation -= 0.01 * delta;
//   });


type ActorOptions = {
    img: string
    x: number
    y: number
    wUnits: number
    hUnits: number
    world: World
    autorotate: boolean
    rotation: number
    anchor: TCoord
    alpha: number
}
export class Actor {
    vx = 0
    vy = 0
    img?: string
    x: number
    y: number
    forceUnits: Partial<TDim>
    world: World
    autorotate: boolean
    rotation: number
    anchor: TCoord
    alpha: number
    sprite!: PIXI.Sprite
    constructor(options: Partial<ActorOptions> = {}) {
        this.x = options.x || 0
        this.y = options.y || 0
        const {wUnits: w, hUnits: h} = options
        this.forceUnits = {...w && {w}, ...h && {h}}
        this.img = options.img || ""
        if (this.img) this.sprite = PIXI.Sprite.from(options.img!)
        this.sprite.texture.baseTexture.on("loaded", () => {            
            this.onResize()
        })
        this.world = options.world || latestWorld
        this.autorotate = options.autorotate || true;
        this.rotation = options.rotation || 0
        this.onResize()
        this.anchor = options.anchor || { x: 0.5, y: 0.5 };
        this.sprite.anchor.set(this.anchor.x, this.anchor.y)
        this.sprite.alpha = this.alpha = options.alpha || 1;
        this.world.add(this);
        this.world.render();
    }
    onResize() {
        const {w, h} = this.forceUnits
        const {width, height} = this.sprite.texture.baseTexture
        if(w) {
            this.sprite.scale.x = w * this.world.getPxPerUnit() / width;
            this.sprite.scale.y = this.sprite.scale.x;
        }
        if(h) {
            this.sprite.scale.y = h * this.world.getPxPerUnit() / height;
            if (!w) this.sprite.scale.x = this.sprite.scale.y; //Verzerren möglich, falls erwünscht
        }
        this.sprite.position = this.world.unitsToPx(this); 
    }
    resize(dim: Partial<TDim>) {
        this.forceUnits = dim
        this.onResize()
    }
    draw() {
        this.sprite.position = this.world.unitsToPx(this);
        this.sprite.rotation = -this.rotation || 0;
        if (this.autorotate) { this.sprite.rotation = Math.atan2(-this.vy, this.vx); }
    }
    destroy() {
        this.world.actors.splice(this.world.actors.indexOf(this), 1);
        this.world.app.stage.removeChild(this.sprite);
    }
}