import {Sim} from '../src/sim.js';import {LEVELS} from '../src/levels.js';
export const SOL={
 1:[ // walk the foreman ahead in short hops once everyone is out
   ...Array.from({length:10},(_,k)=>({at:20+k*4,do:new Function('s','return s.moveForeman('+(9+k*4)+')')})),
   {at:62,do:s=>s.moveForeman(46)}],
 3:[
   {when:s=>s.miners.some(m=>m.active&&m.x>8),do:s=>s.assign(s.miners.find(m=>m.active&&m.x>8),'shorer')},
   {at:16,do:s=>s.placeLight('torch',30,6)},{at:17,do:s=>s.placeLight('torch',36.5,4)},
   {at:30,do:s=>s.moveForeman(37)},
   {when:s=>s.miners.some(m=>m.active&&m.x>33),do:s=>s.assign(s.miners.find(m=>m.active&&m.x>33),'shorer')},
   {at:50,do:s=>s.moveForeman(44)},{at:56,do:s=>s.moveForeman(52.5)}],
 4:[
   {at:22,do:s=>s.placeLight('torch',21,7)},
   {at:26,do:s=>s.moveForeman(10)},{after:5,do:s=>s.moveForeman(15)},{after:4,do:s=>s.moveForeman(20)},{after:4,do:s=>s.moveForeman(25)},{after:4,do:s=>s.moveForeman(30)},{after:4,do:s=>s.moveForeman(35)},{after:4,do:s=>s.moveForeman(40)},{after:4,do:s=>s.moveForeman(45)},{after:4,do:s=>s.moveForeman(49)},{after:4,do:s=>s.moveForeman(54)},{after:3,do:s=>s.moveForeman(52.5)}],
 5:[
   {at:26,do:s=>s.moveForeman(7)},...[11,15,19,23,27,31,35,39,42,44].map((x,k)=>({at:31+k*4.5,do:new Function('s','return s.moveForeman('+x+')')})),
   {when:s=>s.t>58&&s.miners.some(m=>m.active&&m.state!=='fall'&&m.x>43.5&&m.x<45&&m.y>6),do:s=>s.assign(s.miners.find(m=>m.active&&m.state!=='fall'&&m.x>43.5&&m.x<45&&m.y>6),'digger')},
   {when:s=>s.miners.filter(m=>m.active&&m.y>5).length===0,do:s=>s.moveForeman(44.6)},
   {after:4,do:s=>s.assign(s.miners.find(m=>m.active&&m.state!=='fall'),'shorer')},
   {after:1,do:s=>s.moveForeman(48)},{after:6,do:s=>s.moveForeman(54.5)}],
 2:[
   {when:s=>s.miners.some(m=>m.active&&m.x>20),do:s=>s.assign(s.miners.find(m=>m.active&&m.x>20),'blocker')},
   {when:s=>s.miners.some(m=>m.active&&m.state==='walk'&&m.x>11&&m.x<12),do:s=>s.assign(s.miners.find(m=>m.active&&m.state==='walk'&&m.x>11&&m.x<12),'digger')},
   {at:1,do:s=>s.moveForeman(11.5)},
   {when:s=>s.spawned>=s.L.total&&s.miners.filter(m=>m.active&&m.y>6&&m.state!=='block').length===0,do:s=>s.assign(s.miners.find(m=>m.state==='block'),'lantern')},
   {when:s=>s.miners.filter(m=>m.active&&m.y>6).length===0&&s.spawned>=s.L.total,do:s=>s.moveForeman(8)},
   {after:4,do:s=>s.moveForeman(4)},{after:4,do:s=>s.moveForeman(2.6)}],
};
export function run(id,sol,{log=false,maxT=1e9}={}){const s=new Sim(LEVELS[id-1]);let k=0,lastT=0;const steps=sol||[];
  while(!s.over&&s.t<maxT){const st=steps[k];if(st){let go=false;if(st.at!=null)go=s.t>=st.at;else if(st.when)go=st.when(s);else if(st.after!=null)go=s.t>=lastT+st.after;
      if(go){const r=st.do(s);if(log)console.log('  t=%s step %d -> %s',s.t.toFixed(1),k,typeof r==='object'?(r?'obj':'null'):r);k++;lastT=s.t;}}
    s.tick();if(log)for(const e of s.drainEvents()){if(['lost','saved','cavein','boom','shored','banish','ignite','digstop'].includes(e.type))console.log('  t=%s %s %s',s.t.toFixed(1),e.type,e.how||'',e.m?('#'+e.m.id+' x='+e.m.x.toFixed(1)+' y='+e.m.y.toFixed(1)):'');}else s.events.length=0;}
  return s;}
if((process.argv[1]||'').endsWith('solve.mjs')){const ids=process.argv[2]?[+process.argv[2]]:[1,2,3,4,5];
  for(const id of ids){const base=run(id,[]);const s=run(id,SOL[id],{log:!!process.argv[3]});
    console.log(`L${id} ${LEVELS[id-1].name}: no-action saved ${base.result.saved}/${LEVELS[id-1].total} | solution saved ${s.result.saved}/${LEVELS[id-1].total} quota ${LEVELS[id-1].quota} stars ${s.result.stars} t=${s.result.time.toFixed(0)} ${s.result.why}`);}}
