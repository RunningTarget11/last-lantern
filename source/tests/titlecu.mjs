import {chromium} from 'playwright';
const q=process.argv[2]||'';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
await page.goto('file:///workspace/last-lantern/index.html'+q);await page.waitForFunction(()=>window.__LL,null,{timeout:180000});
const info=await page.evaluate(()=>{const {G}=__LL;const s=G.sim;for(let i=0;i<60*20;i++){s.tick();G.world.handle(s.drainEvents());}document.getElementById('title').style.display='none';G.viewH=4;
 return {q:G.quality, ms:s.miners.map(m=>[m.state,+m.x.toFixed(1),+(m.fear||0).toFixed(2),m.active])};});
console.log(JSON.stringify(info));
await page.waitForTimeout(2500);await page.screenshot({path:'/tmp/tcu.jpg',quality:88});await browser.close();
