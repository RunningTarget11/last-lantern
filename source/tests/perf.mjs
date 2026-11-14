import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1600,height:900}});await p.goto('file:///workspace/lem-src/dist/index.html?level=5');await p.waitForFunction(()=>window.__LL);await p.click('#bBegin');
console.log(await p.evaluate(()=>{const {G}=__LL;G.paused=true;for(let i=0;i<3000;i++){G.sim.step();G.sim.drain();}let t=performance.now();__LL.frameBack(1);const a=performance.now()-t;t=performance.now();for(let i=0;i<3000;i++){G.sim.step();G.sim.drain();}return 'frameBack@3000 '+a.toFixed(0)+'ms; 3000 ticks '+(performance.now()-t).toFixed(0)+'ms';}));await b.close();
