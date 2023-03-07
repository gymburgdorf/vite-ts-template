import {World, Actor} from "./simhelpers"

const world = await World.create({
    element: document.querySelector(".app"),
    h: 200,
    unit: "m",
    minUnits: {x: 0, y:0},
    img: "https://gymburgdorf.github.io/simhelpers/img/oceanSky.jpg", 
});

const world2 = await World.create({
    element: document.querySelector(".app2"),
    w: 100,
    h: 100,
    unit: "m",
    color: "#999", 
});
//    grid: {step: 50},
//fontColor: "#ffffff"

const flugi = new Actor({img: "https://gymburgdorf.github.io/simhelpers/img/flugi50.png", x: -40, y: 60, wUnits: 14});
const glider = new Actor({img: "https://gymburgdorf.github.io/simhelpers/img/Segelflieger50.png", x: 0, y: 100, wUnits: 14});

let t = 0;
const dt = 0.016;       // Zeitschritt in Sekunden
flugi.vx = 35;
flugi.vy = 0;
glider.vx = 25;
glider.vy = 0;

window.addEventListener("keydown", taste);

function taste(event: { key: string; }) {
	console.log("Eine Taste wurde gedrückt:", event.key)
} 

function loop() {
	flugi.x += flugi.vx * dt
	glider.x += glider.vx * dt
	world.update();
}

function raf() {
    loop()
    requestAnimationFrame(raf)
}

requestAnimationFrame(raf)


