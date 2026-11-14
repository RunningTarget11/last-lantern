import {Sim,TPS} from '../src/sim.js';import {LEVELS} from '../src/levels.js';
// Each step: {when(s) -> miner|true, do(s,m)}; executed in order, polled every tick.
const W=(s,f)=>s.miners.find(m=>m.alive&&f(m));
const walkerIn=(x0,x1,ymin=-1e9,ymax=1e9,dir=0)=>s=>W(s,m=>m.state==='walk'&&m.x>=x0&&m.x<=x1&&m.y>=ymin&&m.y<=ymax&&(!dir||m.dir===dir));
export const SOL={
 1:[{when:walkerIn(300,340,0,120),do:(s,m)=>s.assign(m,'digger')},{when:s=>s.t>2,do:s=>s.setRate(70)}],
 2:[{when:s=>s.t>0.1,do:s=>s.setRate(60)},
    ...Array.from({length:20},()=>({when:s=>W(s,m=>m.state!=='exit'&&!m.floater&&m.alive&&m.y<80),do:(s,m)=>{s.assign(m,'floater');s.assign(m,'climber');}}))],
 3:[{when:walkerIn(318,326,0,170,1),do:(s,m)=>s.assign(m,'builder')},
    {when:s=>s.miners.some(m=>m.state==='builder'),do:s=>true},
    {when:walkerIn(270,300,0,170,1),do:(s,m)=>s.assign(m,'blocker')},
    {when:s=>s.miners.some(m=>m.state==='shrug'||(m.state==='walk'&&m.x>340&&m.y<150)),do:s=>{const b=W(s,m=>(m.state==='shrug'||m.state==='walk')&&m.x>340&&m.y<150);if(b){b.state='walk';s.assign(b,'builder');}}},
    {when:s=>s.miners.some(m=>m.state==='walk'&&m.x>420&&m.y<=152),do:s=>{const b=W(s,m=>m.state==='blocker');s.assign(b,'blocker');}}],
 4:[{when:walkerIn(170,186,0,130,1),do:(s,m)=>s.assign(m,'basher')},
    {when:walkerIn(310,326,0,130,1),do:(s,m)=>s.assign(m,'basher')},
    {when:walkerIn(432,446,0,130,1),do:(s,m)=>s.assign(m,'basher')},
    {when:walkerIn(470,480,0,130,1),do:(s,m)=>s.assign(m,'miner')}],
 5:[{when:s=>s.t>0.1,do:s=>{s.placeTorch(360,90);s.placeTorch(500,90);s.placeTorch(640,90);}},
    {when:walkerIn(230,244,0,112,1),do:(s,m)=>s.assign(m,'basher')},
    {when:walkerIn(680,694,0,112,1),do:(s,m)=>s.assign(m,'builder')},
    {when:s=>W(s,m=>m.state==='shrug'&&m.x>700),do:(s,m)=>{m.state='walk';s.assign(m,'builder');}},
    {when:walkerIn(830,850,0,114),do:(s,m)=>s.assign(m,'digger')}],
};
export function run(id,sol,{log=false,maxT=1e9}={}){const L=LEVELS[id-1];const s=new Sim(L);let k=0;const steps=sol||[];
  while(!s.over&&s.t<maxT){const st=steps[k];if(st){const r=st.when(s);if(r){st.do(s,r===true?null:r);if(log)console.log('  t=%s step %d',s.t.toFixed(1),k);k++;}}
    s.step();const ev=s.drain();if(log)for(const e of ev)if(['lost','splat','taken','saved','boom','clink'].includes(e.type)&&(e.type!=='saved'||log>1))console.log('  t=%s %s %s #%s x=%s y=%s',s.t.toFixed(1),e.type,e.how||'',e.m&&e.m.id,e.m&&e.m.x,e.m&&e.m.y);}
  return s;}
if(typeof process!=='undefined'&&(process.argv[1]||'').endsWith('solve.mjs')){const ids=process.argv[2]?[+process.argv[2]]:[1,2,3,4,5];
  for(const id of ids){const L=LEVELS[id-1];const base=run(id,[]);const s=run(id,SOL[id],{log:+(process.argv[3]||0)});
    console.log(`L${id} ${L.name}: no-action ${base.result.saved}/${L.total} | solution ${s.result.saved}/${L.total} quota ${L.quota} stars ${s.result.stars} t=${s.result.time.toFixed(0)} left skills ${JSON.stringify(s.skills)}`);}}
