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
    actors: Drawable[]
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
        this.app = new PIXI.Application({
            background: this.color,
            antialias: true,
        });
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
    add(drawable: Drawable) {
        this.actors.push(drawable) 
        this.app.stage.addChild(drawable.obj)
        this.render()
    }
    remove(drawable: Drawable) {
        this.actors.splice(this.actors.indexOf(drawable), 1);
        this.app.stage.removeChild(drawable.obj)
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
            var skala = new PIXI.Text(val + " " + world.originalParams.unit, { fontFamily: "Tahoma", fontSize: world.dimPx().w / 40, fill: color });
            skala.position.x = axis == "x" ? number : offset.x;
            skala.position.y = axis == "y" ? number : world.dimPx().h - offset.y;
            skala.anchor.x = axis == "x" ? 0.5 : 0;
            skala.anchor.y = axis == "y" ? 0.5 : 1;
            container!.addChild(skala);
        };
        var offset = { x: 5, y: 2 } //px von Rand;

        if (!onlyX) {
            const maxY = world.minUnits.y + world.dimUnits().h
            for (let i = step * Math.ceil((world.minUnits.y + 0.1 * step) / step); i < maxY - 0.1 * step; i += step) { createLabel(i, "y"); }
        }
        if (!onlyY) {
            const maxX = world.minUnits.x + world.dimUnits().w
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

//   // Listen for animate update
//   app.ticker.add((delta) => {
//       // rotate the container!
//       // use delta to create frame-independent transform
//       container.rotation -= 0.01 * delta;
//   });

interface IDrawable {
    obj: PIXI.DisplayObject,
    x: number,
    y: number,
    wUnits?: number,
    hUnits?: number,
    rotation: number,
    anchor: TCoord,
    alpha: number,
    world: World,
}

abstract class Drawable implements IDrawable {
    forceUnits: Partial<TDim>
    constructor(
        public obj: PIXI.DisplayObject,
        public x: number,
        public y: number,
        public wUnits?: number,
        public hUnits?: number,
        public rotation: number = 0,
        public anchor: TCoord = { x: 0.5, y: 0.5 },
        public alpha: number = 1,
        public world: World = latestWorld,
    ) {
        const w = wUnits
        const h = hUnits
        this.forceUnits = {...w && {w}, ...h && {h}}
        this.obj.alpha = this.alpha
    }
    destroy() {
        this.world.remove(this);
    }
    abstract onResize(): void
    draw() {
        this.obj.position = this.world.unitsToPx(this);
    }
}

type ActorParams = {
    img: string
    x?: number
    y?: number
    wUnits?: number
    hUnits?: number
    world?: World
    autorotate?: boolean
    rotation?: number
    anchor?: TCoord
    alpha?: number
}
export class Actor extends Drawable {
    vx = 0
    vy = 0
    img: string
    // x: number
    // y: number
    // forceUnits: Partial<TDim>
    // world: World
    autorotate: boolean
    // rotation: number
    // anchor: TCoord
    // alpha: number
    obj: PIXI.Sprite
    constructor(params: ActorParams) {
        const {alpha = 1, x = 0, y = 0, wUnits, hUnits, rotation = 0, anchor, world, img} = params
        const obj = PIXI.Sprite.from(img)
        super(obj, x, y, wUnits, hUnits, rotation, anchor, alpha, world)
        this.obj = obj
        this.img = img
        this.obj.texture.baseTexture.on("loaded", () => {            
            this.onResize()
        })
        this.autorotate = params.autorotate || true;
        this.onResize()
        this.anchor = params.anchor || { x: 0.5, y: 0.5 };
        this.obj.anchor.set(this.anchor.x, this.anchor.y)
        this.world.add(this);
    }
    onResize() {
        const {w, h} = this.forceUnits
        const {width, height} = this.obj.texture.baseTexture
        if(w) {
            this.obj.scale.x = w * this.world.getPxPerUnit() / width;
            this.obj.scale.y = this.obj.scale.x;
        }
        if(h) {
            this.obj.scale.y = h * this.world.getPxPerUnit() / height;
            if (!w) this.obj.scale.x = this.obj.scale.y; // allow distortion
        }
        this.obj.position = this.world.unitsToPx(this); 
    }
    resize(dim: Partial<TDim>) {
        this.forceUnits = dim
        this.onResize()
    }
    draw() {
        this.obj.position = this.world.unitsToPx(this);
        this.obj.rotation = -this.rotation || 0;
        if (this.autorotate) { this.obj.rotation = Math.atan2(-this.vy, this.vx); }
    }
}

abstract class GraphicsSprite extends Drawable {
    obj: PIXI.Graphics
    color: number
    constructor(props: Partial<IDrawable> & {color: number}) {
        const {x = 0, y = 0, wUnits, hUnits, alpha, anchor, rotation, world, color} = props
        const obj = new PIXI.Graphics()
        super(obj, x, y, wUnits, hUnits, alpha, anchor, rotation, world)
        this.obj = obj
        this.color = color
    }
    abstract resetGraphic(): void
    onResize() {
        this.resetGraphic()
    }
    setColor(value: number) {
        this.color = value
        this.resetGraphic()
    }
}

type LinePos = {from: TCoord, to: TCoord} | {x1: number, y1: number, x2: number, y2: number}
type LineParams = LinePos & {
    color?: number
    thickness?: number
    alpha?: number
    world?: World
}
export class Line extends GraphicsSprite {
    thickness: number
    from: TCoord
    to: TCoord
    constructor(params: LineParams) {
        const from = "from" in params ? params.from : {x: params.x1, y: params.y1}
        const to = "to" in params ? params.to : {x: params.x2, y: params.y2}
        const {alpha = 1, color = 0x112233, thickness = 3, world} = params
        const x = 0 //(from.x + to.x) / 2
        const y = 0 //(from.y + to.y) / 2
        super({x, y, wUnits: Math.abs(to.x - from.x), hUnits: Math.abs(to.y - from.y), alpha, world, color})
        this.thickness = params.thickness || 3
        this.from = from
        this.to = to
        this.resetGraphic()
        this.draw()
        this.world.add(this)
    }
    resetGraphic() {
        this.obj.clear()
        this.obj.lineStyle(this.thickness * this.world.getPxPerUnit(), this.color, this.alpha);
        const fromPx = this.world.unitsToPx(this.from)
        const toPx = this.world.unitsToPx(this.to)
        this.obj.moveTo(fromPx.x, fromPx.y);
        this.obj.lineTo(toPx.x, toPx.y);
    }
    draw() {
        this.obj.position = {x: 0, y: 0};
        this.resetGraphic()
    }
}

type CircleParams = TCoord & {
    color?: number
    alpha?: number
    world?: World
    r?: number
}
export class Circle extends GraphicsSprite {
    constructor(params: CircleParams) {
        const {x = 0, y = 0, alpha = 1, color = 0xaabbcc, r = 1, world} = params
        super({x, y, wUnits: 2 * r, hUnits: 2 * r, alpha, world, color})
        this.resetGraphic()
        this.draw()
        this.world.add(this)
    }
    setRadius(value: number) {
        this.wUnits = this.hUnits = 2 * value
        this.resetGraphic()
    }
    resetGraphic() {
        this.obj.clear()
        this.obj.beginFill(this.color);
        this.obj.drawCircle(0, 0, this.world.getPxPerUnit() * this.wUnits! / 2);
        this.obj.endFill();
    }
}
  
//   function PassiveSprite(params) {
//     var params = params || {};
//     this.world = params.world || world;
//     var texture = params.texture || new PIXI.Texture.fromImage(params.img);
//       this.sprite = new PIXI.Sprite(texture);
//     this.x = params.x || 0;
//     this.y = params.y || 0;
//     this.sprite.position = this.world.unitsToPx(this);
//     this.sprite.rotation = params.rotation || 0;
//     this.sprite.scale = params.scale || {x:1, y:1};
//     if(params.wUnits) {
//       this.sprite.scale.x = params.wUnits * this.world.pxPerUnit / texture.width;
//       this.sprite.scale.y = this.sprite.scale.x;
//     }
//     if(params.hUnits) {
//       this.sprite.scale.y = params.hUnits * this.world.pxPerUnit / texture.height;
//       if(!params.wUnits) this.sprite.scale.x = this.sprite.scale.y; //Verzerren möglich, falls erwünscht
//     }
//     this.sprite.anchor = params.anchor || {x:0.5, y:0.5};
//     this.sprite.alpha = params.alpha || 1;
//     this.world.stage.addChildAt(this.sprite, params.background ? 0 : this.world.stage.children.length);
//     this.world.render();
//     return this;
//   }
  