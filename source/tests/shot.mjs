// usage: node tests/shot.mjs out level seconds mode [zoom] [cx]
import {chromium,devices} from 'playwright';import fs from 'fs';
const [out,lvl,T,mode='desktop',zoom='',cxs='',cys='']=process.argv.slice(2);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const setups={desktop:{viewport:{width:1600,height:900}},landscape:{...devices['Pixel 7'],viewport:{width:915,height:412}},portrait:{...devices['Pixel 7']}};
const page=await (await browser.newContext(setups[mode])).newPage();const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text());});
await page.goto('file:///workspace/lem-src/dist/index.html'+(lvl==='title'?'':'?level='+lvl));
await page.waitForFunction(()=>window.__LL,null,{timeout:120000});
if(lvl==='title'){await page.waitForTimeout(6000);await page.screenshot({path:out+'.jpg',quality:86});}
else{await page.addScriptTag({content:fs.readFileSync('/tmp/sol.js','utf8')});
  await page.waitForTimeout(400);await page.screenshot({path:out+'_intro.jpg',quality:86});
  await page.click('#bBegin');
  const r=await page.evaluate(({lvl,T,zoom,cxs,cys})=>{const {G}=__LL;const s=G.sim;const steps=__SOL[+lvl]||[];let k=0;G.paused=true;
    while(!s.over&&s.t<+T){const st=steps[k];if(st){const r=st.when(s);if(r){st.do(s,r===true?null:r);k++;}}s.step();__LL.G.parts.length>600&&(G.parts.length=600);
      const ev=s.drain();for(const e of ev)if(e.type==='dirty'){G.art.rebuild(e.x0-2,e.y0-2,e.x1+2,e.y1+2);}}
    G.paused=false;if(zoom)G.s=G.sFit*(+zoom);const xs=s.miners.filter(m=>m.alive).map(m=>m.x);const cx=cxs?+cxs:(xs.length?xs.reduce((a,b)=>a+b)/xs.length:s.L.exit.x);__LL.centerOn(cx,cys?+cys:s.Hh/2);document.getElementById('toast').style.opacity=0;
    const m=s.miners.find(m=>m.alive&&m.state==='walk');if(m){G.hover=m;}G.skill=Object.keys(s.skills).find(k=>s.skills[k]>0)||null;
    return {t:s.t,saved:s.saved,lost:s.lost,over:s.over};},{lvl,T,zoom,cxs,cys});
  console.log(JSON.stringify(r));await page.evaluate(()=>{const {G}=__LL;G.paused=true;__LL.updateHud&&__LL.updateHud();});await page.waitForTimeout(1500);
  await page.screenshot({path:out+'.jpg',quality:86});}
console.log(errs.slice(0,10).join('\n'));await browser.close();
