import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
await page.goto('file:///workspace/last-lantern/index.html?q=med');await page.waitForFunction(()=>window.__LL,null,{timeout:180000});
await page.evaluate(()=>{const {G}=__LL;const s=G.sim;for(let i=0;i<60*20;i++){s.tick();G.world.handle(s.drainEvents());}document.getElementById('title').style.display='none';});
await page.waitForTimeout(1500);
const r=await page.evaluate(()=>{const w=__LL.G.world;const out=[];w.root.traverse(o=>{if(o.isMesh||o.isPoints||o.isSprite){const p=new o.position.constructor();o.getWorldPosition(p);if(Math.abs(p.x-6.2)<1.5&&o.visible)out.push([o.type,o.name,o.material&&o.material.type,p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2)]);}});return out.slice(0,60);});
console.log(JSON.stringify(r));await browser.close();
