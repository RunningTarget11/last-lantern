import {chromium,devices} from 'playwright';import {SOL} from './solve.mjs';
const [out,lvl,T,mode='desktop',extra='',viewH='']=process.argv.slice(2);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const setups={desktop:{viewport:{width:1600,height:900}},landscape:{...devices['Pixel 7'],viewport:{width:915,height:412}},portrait:{...devices['Pixel 7']}};
const page=await (await browser.newContext(setups[mode])).newPage();const errs=[];
page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text());});
await page.goto('file:///workspace/last-lantern/index.html?level='+lvl);await page.waitForFunction(()=>window.__LL,null,{timeout:180000});
await page.click('#bBegin');
const steps=(SOL[+lvl]||[]).map(st=>({at:st.at,after:st.after,when:st.when&&st.when.toString(),do:st.do.toString()}));
const res=await page.evaluate(({steps,T,extra,viewH})=>{const {G}=__LL;const s=G.sim;const st2=steps.map(st=>({...st,when:st.when&&eval('('+st.when+')'),do:eval('('+st.do+')')}));let k=0,lastT=0;
  const ex=extra?eval(extra):null;
  while(!s.over&&s.t<T){const st=st2[k];if(st){let go=false;if(st.at!=null)go=s.t>=st.at;else if(st.when)go=st.when(s);else if(st.after!=null)go=s.t>=lastT+st.after;if(go){st.do(s);k++;lastT=s.t;}}
    if(ex)ex(s,G);s.tick();G.world.handle(s.drainEvents());if(((s.t*60)|0)%6===0)G.world.update(0.1,G.t,null);}
  G.lastPan=-99;const fm=s.foreman;G.tcx=G.camX=fm.x;G.tcy=G.camY=fm.y+1;if(viewH){G.viewH=+viewH.split(',')[0];G.tcx=G.camX=+(viewH.split(',')[1]||fm.x);}
  return {t:s.t,over:s.over,saved:s.saved,lost:s.lost};},{steps,T:+T,extra,viewH});
console.log(JSON.stringify(res));
await page.waitForTimeout(res.over?4500:2500);await page.screenshot({path:out+'.jpg',quality:86});
console.log(errs.slice(0,15).join('\n'));await browser.close();
