import {chromium,devices} from 'playwright';import fs from 'fs';
const mode=process.argv[2]||'desktop';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const setups={desktop:{viewport:{width:1600,height:900}},landscape:{...devices['Pixel 7'],viewport:{width:915,height:412}},portrait:{...devices['Pixel 7']}};
for(let lvl=1;lvl<=5;lvl++){const page=await (await browser.newContext(setups[mode])).newPage();const errs=[];
page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('file:///workspace/lem-src/dist/index.html?level='+lvl);await page.waitForFunction(()=>window.__LL);
await page.addScriptTag({content:fs.readFileSync('/tmp/sol.js','utf8')});await page.click('#bBegin');
const r=await page.evaluate(lvl=>{const {G}=__LL;const s=G.sim;const steps=__SOL[lvl]||[];let k=0;G.paused=true;
  while(!s.over){const st=steps[k];if(st){const r=st.when(s);if(r){st.do(s,r===true?null:r);k++;}}s.step();const ev=s.drain();for(const e of ev)if(e.type==='dirty')G.art.rebuild(e.x0-2,e.y0-2,e.x1+2,e.y1+2);}
  G.paused=false;return {saved:s.saved,n:s.L.count||s.L.miners,t:s.t|0};},lvl);
await page.waitForSelector('#result:not(.hidden)',{timeout:15000}).catch(()=>errs.push('no result screen'));await page.waitForTimeout(600);
const txt=await page.evaluate(()=>[...['rTitle','rSaved','rQuota']].map(i=>document.getElementById(i).textContent).join(' / '));
await page.screenshot({path:`/tmp/res${lvl}_${mode}.jpg`,quality:85});
console.log(lvl,JSON.stringify(r),txt,'errs',errs);await page.context().close();}
await browser.close();
