import {World} from "./simhelpers"

const w = new World()

console.log(w);

document.querySelector(".app")!.appendChild((w.app.view as unknown as HTMLElement));
