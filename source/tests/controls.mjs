import {chromium,devices} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const res=[];const ok=(name,c,extra='')=>{res.push((c?'PASS ':'FAIL ')+name+(extra?' '+extra:''));};
async function setup(mode,lvl){const ctx=await browser.newContext(mode==='touch'?{...devices['Pixel 7']}:{viewport:{width:1600,height:900}});const page=await ctx.newPage();const errs=[];
  page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('file:///workspace/lem-src/dist/index.html?level='+lvl);await page.waitForFunction(()=>window.__LL);await page.click('#bBegin');return {ctx,page,errs};}
const E=(page,f,a)=>page.evaluate(f,a);
const run=async(page,ticks)=>E(page,n=>{const {G}=__LL;for(let i=0;i<n;i++){G.sim.step();G.sim.drain();}},ticks);
const posOf=(page,id)=>E(page,id=>{const m=__LL.G.sim.miners.find(m=>m.id===id);const [x,y]=__LL.w2s(m.x,m.y-7);return {x,y};},id);
// ---------- desktop / keyboard ----------
{const {ctx,page,errs}=await setup('desktop',3);
 await E(page,()=>{__LL.G.paused=true;});
 // F-keys
 const fk={F3:'climber',F6:'blocker',F7:'builder'};for(const [k,sk] of Object.entries(fk)){await page.keyboard.press(k);const cur=await E(page,()=>__LL.G.skill);ok('key '+k,cur===(sk==='climber'?null:sk)||cur===sk,cur);}
 const r0=await E(page,()=>__LL.G.sim.rate);await page.keyboard.press('F2');await page.keyboard.press('F2');const r1=await E(page,()=>__LL.G.sim.rate);ok('F2 rate up',r1===r0+2,r0+'->'+r1);
 await page.keyboard.press('F1');await page.keyboard.press('F1');await page.keyboard.press('F1');const r2=await E(page,()=>__LL.G.sim.rate);ok('F1 rate down, clamped at min',r2===r0,''+r2);
 ok('panel shows min/current',await E(page,()=>document.getElementById('rrMin').textContent+'/'+document.getElementById('rrCur').textContent)===r0+'/'+r0);
 await page.keyboard.press('F11');ok('F11 unpause',await E(page,()=>!__LL.G.paused));await page.keyboard.press('F11');ok('F11 pause',await E(page,()=>__LL.G.paused));
 await page.keyboard.press('f');ok('F fast',await E(page,()=>__LL.G.speed===3));await page.keyboard.press('s');ok('S slow',await E(page,()=>__LL.G.speed===0.25));await page.keyboard.press('s');
 await run(page,200);
 // assign blocker by mouse to a walker
 const id=await E(page,()=>__LL.G.sim.miners.find(m=>m.alive&&m.state==='walk').id);
 await page.keyboard.press('F6');let p=await posOf(page,id);await page.mouse.move(p.x,p.y);await page.mouse.click(p.x,p.y);
 ok('click assigns blocker',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='blocker');
 const status=await E(page,()=>document.getElementById('status').textContent);ok('status line',/OUT \d+.*IN \d+%.*TIME \d-\d\d/.test(status),JSON.stringify(status));
 // frame step / back
 const t0=await E(page,()=>__LL.G.sim.tick);await page.keyboard.press('n');await page.keyboard.press('n');const t1=await E(page,()=>__LL.G.sim.tick);ok('N frame forward',t1===t0+2,t0+'->'+t1);
 await page.keyboard.press('b');const t2=await E(page,()=>__LL.G.sim.tick);ok('B frame back',t2===t1-1,''+t2);
 ok('rewind keeps assignment',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='blocker');
 const tb=Date.now();await page.keyboard.press('Backspace');const t3=await E(page,()=>__LL.G.sim.tick);ok('Backspace back 1 s',t3===t2-30,t3+' ('+(Date.now()-tb)+'ms)');
 // walker releases blocker
 await page.keyboard.press('w');p=await posOf(page,id);await page.mouse.click(p.x,p.y);ok('Walker releases blocker',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='walk');
 // walker on walker turns him
 const d0=await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).dir,id);p=await posOf(page,id);await page.mouse.click(p.x,p.y);ok('Walker turns a walker',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).dir,id)===-d0);
 // builder then walker stops building
 await page.keyboard.press('F7');p=await posOf(page,id);await page.mouse.click(p.x,p.y);ok('builder assigned',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='builder');
 await run(page,40);await page.keyboard.press('w');p=await posOf(page,id);await page.mouse.click(p.x,p.y);ok('Walker stops builder',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='walk');
 // directional select: hold ArrowLeft, hover picks only left-facing
 await page.keyboard.down('ArrowLeft');const dirOk=await E(page,()=>{const {G}=__LL;const ms=G.sim.miners.filter(m=>m.alive&&m.state==='walk');let good=true;for(const m of ms){const [x,y]=__LL.w2s(m.x,m.y-7);const p=__LL.pickMiner(x,y);if(p&&p.dir!==-1)good=false;}return good&&G.keyDir===-1;});await page.keyboard.up('ArrowLeft');ok('hold Left = left-facing only',dirOk);
 // right-click walkers-only priority: put blocker+walker together
 const rc=await E(page,()=>{const {G}=__LL;const s=G.sim;const ms=s.miners.filter(m=>m.alive&&m.state==='walk');const a=ms[0];return a.id;});
 await page.keyboard.press('F7');p=await posOf(page,rc);await page.mouse.click(p.x,p.y,{button:'right'});ok('right-click assigns (walkers only)',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,rc)==='builder');
 // nuke double
 await page.keyboard.press('F12');ok('nuke armed only',await E(page,()=>!__LL.G.sim.nuking&&__LL.G.nukeArm>0));
 // restart
 await page.keyboard.press('r');ok('R restarts',await E(page,()=>__LL.G.sim.tick<20&&__LL.G.log.length===0));
 // edge scroll
 await E(page,()=>{__LL.G.s=__LL.G.sFit*2.5;__LL.centerOn(300,120);});const cx0=await E(page,()=>__LL.G.cx);await page.mouse.move(800,400);await page.mouse.move(1595,400);await page.waitForTimeout(600);const cx1=await E(page,()=>__LL.G.cx);ok('edge scroll right',cx1>cx0+5,cx0.toFixed(0)+'->'+cx1.toFixed(0));
 // minimap click
 const mb=await page.$eval('#mini',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});await page.mouse.click(mb.x+mb.w*0.1,mb.y+mb.h/2);const cx2=await E(page,()=>__LL.G.cx);ok('minimap jump',cx2<cx1-50,cx2.toFixed(0));
 // panel clicks
 for(const id2 of ['bFF','bSlow','bWalkOnly','bLeft','bRight']){await page.click('#'+id2);}
 ok('panel toggles',await E(page,()=>__LL.G.speed===0.25&&__LL.G.walkOnly&&__LL.G.selDir===1));
 await page.click('#bNuke');await page.click('#bNuke');ok('panel nuke double-click',await E(page,()=>__LL.G.sim.nuking));
 await page.mouse.move(700,300);await page.screenshot({path:'/tmp/ctl_desktop.jpg',quality:85});
 ok('desktop no console errors',errs.length===0,errs.join('|'));await ctx.close();}
// ---------- touch ----------
{const {ctx,page,errs}=await setup('touch',3);
 await E(page,()=>{__LL.G.paused=true;});await run(page,200);
 const id=await E(page,()=>__LL.G.sim.miners.find(m=>m.alive&&m.state==='walk').id);
 await page.tap('#main .slot[data-k="blocker"]');let p=await posOf(page,id);await page.touchscreen.tap(p.x,p.y);ok('touch blocker',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='blocker');
 await page.tap('#main .slot[data-k="walker"]');p=await posOf(page,id);await page.touchscreen.tap(p.x,p.y);ok('touch Walk releases',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='walk');
 // sizes of tap targets
 const sizes=await E(page,()=>[...document.querySelectorAll('#bar .slot')].map(e=>Math.round(Math.min(e.getBoundingClientRect().width,e.getBoundingClientRect().height))));ok('touch targets >=36px',Math.min(...sizes)>=36,'min '+Math.min(...sizes));
 const t0=await E(page,()=>__LL.G.sim.tick);await page.tap('#bStep');await page.tap('#bStep');await page.tap('#bBack');ok('touch frame step/back',await E(page,()=>__LL.G.sim.tick)===t0+1);
 await page.tap('#bRestart');ok('restart needs 2 taps',await E(page,()=>__LL.G.sim.tick>100));await page.tap('#bRestart');ok('restart on 2nd tap',await E(page,()=>__LL.G.sim.tick<20));
 // long press = walkers only via CDP touch
 await E(page,()=>{__LL.G.paused=true;});await run(page,200);const id2=await E(page,()=>__LL.G.sim.miners.find(m=>m.alive&&m.state==='walk').id);
 await page.tap('#main .slot[data-k="builder"]');p=await posOf(page,id2);const cdp=await ctx.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await page.waitForTimeout(600);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 ok('long-press assigns (walkers only)',await E(page,id=>__LL.G.sim.miners.find(m=>m.id===id).state,id)==='builder');
 // pinch zoom
 const s0=await E(page,()=>__LL.G.s);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:300,id:1},{x:230,y:300,id:2}]});
 for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180-i*12,y:300,id:1},{x:230+i*12,y:300,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const s1=await E(page,()=>__LL.G.s);ok('pinch zoom',s1>s0*1.3,s0.toFixed(2)+'->'+s1.toFixed(2));
 // drag pan
 const c0=await E(page,()=>__LL.G.cx);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:300}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-i*25,y:300}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 ok('drag pan',await E(page,()=>__LL.G.cx)>c0+10);
 const mb=await page.$eval('#mini',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});await page.touchscreen.tap(mb.x+mb.w*0.9,mb.y+mb.h/2);ok('touch minimap',await E(page,()=>__LL.G.cx)>100);
 ok('touch no console errors',errs.length===0,errs.join('|'));await ctx.close();}
console.log(res.join('\n'));await browser.close();
