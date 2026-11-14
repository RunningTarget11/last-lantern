import {chromium,devices} from 'playwright';
const [out,mode]=process.argv.slice(2);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const setups={desktop:{viewport:{width:1600,height:900}},landscape:{...devices['Pixel 7'],viewport:{width:915,height:412}},portrait:{...devices['Pixel 7']}};
const page=await (await browser.newContext(setups[mode])).newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('file:///workspace/lem-src/dist/index.html?level=3');await page.waitForFunction(()=>window.__LL);await page.click('#bBegin');
const pos=await page.evaluate(()=>{const {G}=__LL;const s=G.sim;G.paused=true;
  for(let i=0;i<30*17;i++){s.step();s.drain();
    if(i===30*8){const w=s.miners.filter(m=>m.alive&&m.state==='walk').sort((a,b)=>b.x-a.x);const m=w[0];if(m)__LL.act({a:'assign',id:m.id,sk:'blocker'});}
    if(i===30*9){const m=s.miners.find(m=>m.alive&&m.state==='walk'&&m.dir>0&&m.x>110);if(m)__LL.act({a:'assign',id:m.id,sk:'builder'});}}
  G.s=G.sFit*1.9;const b=s.miners.find(m=>m.alive&&m.state==='blocker');__LL.centerOn(b.x+40,b.y-30);G.skill=null;__LL.updateHud();
  document.getElementById('toast').style.opacity=0;const [x,y]=__LL.w2s(b.x,b.y-7);return {x,y};});
await page.evaluate(()=>{const {G}=__LL;G.skill='walker';});await page.evaluate(()=>__LL.G&&0);
await page.evaluate(()=>{for(const d of document.querySelectorAll('#main .skill'))d.classList.toggle('sel',d.dataset.k==='walker');});
if(mode==='desktop'){await page.mouse.move(pos.x+3,pos.y+2);}else{await page.evaluate(({x,y})=>{__LL.G.hover=__LL.pickMiner(x,y);__LL.updateHud();},pos);}
await page.waitForTimeout(800);await page.screenshot({path:out,quality:88});console.log(errs);await browser.close();
