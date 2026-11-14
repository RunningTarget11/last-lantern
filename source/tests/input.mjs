import {chromium,devices} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const mode of ['desktop','touch']){
const ctx=await browser.newContext(mode==='touch'?{...devices['Pixel 7']}:{viewport:{width:1600,height:900}});const page=await ctx.newPage();const errs=[];
page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('file:///workspace/lem-src/dist/index.html?level=1');await page.waitForFunction(()=>window.__LL);await page.click('#bBegin');
await page.evaluate(()=>{__LL.G.speed=3;});
await page.waitForFunction(()=>__LL.G.sim.miners.some(m=>m.alive&&m.state==='walk'&&m.x>200),null,{timeout:60000});
await page.evaluate(()=>{__LL.G.paused=true;});
const slot=await page.$('#skills .slot[data-k="digger"]');
if(mode==='touch')await slot.tap();else await slot.click();
const pos=await page.evaluate(()=>{const m=__LL.G.sim.miners.find(m=>m.alive&&m.state==='walk'&&m.x>200);const [x,y]=__LL.w2s(m.x,m.y-7);return {x:x+9,y:y+8,id:m.id};});
if(mode==='touch')await page.touchscreen.tap(pos.x,pos.y);else await page.mouse.click(pos.x,pos.y);
console.log(mode,JSON.stringify(pos),await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return (e.id||e.className)+' skill='+__LL.G.skill+' VH='+innerHeight;},[pos.x,pos.y]));const st=await page.evaluate(id=>__LL.G.sim.miners.find(m=>m.id===id).state+' left='+__LL.G.sim.skills.digger,pos.id);
// pinch/drag/zoom smoke
if(mode==='desktop'){await page.mouse.move(800,300);await page.mouse.wheel(0,-400);await page.mouse.move(800,300);await page.mouse.down();await page.mouse.move(600,300,{steps:5});await page.mouse.up();await page.keyboard.press('f');await page.keyboard.press('Space');}
const cam=await page.evaluate(()=>({s:__LL.G.s.toFixed(2),cx:__LL.G.cx|0,speed:__LL.G.speed,paused:__LL.G.paused}));
console.log(mode,'assigned:',st,JSON.stringify(cam),'errs:',errs);await ctx.close();}
await browser.close();
