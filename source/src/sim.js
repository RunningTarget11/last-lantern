// Last Lantern - Lemmings-style simulation on a destructible pixel mask (1 unit = 1 mask px).
// Deterministic, DOM-free (runs in Node for solvability tests).
export const AIR=0,ROCK=1,STEEL=2,PLANK=3;
export const TPS=30;                       // sim ticks per second
export const H=15,STEP=8,SAFE_FALL=96,WALK=26/TPS,FALL=3,FLOAT=1.0,CLIMB=18/TPS;
export const SKILLS=['climber','floater','blaster','blocker','builder','basher','miner','digger','lamp','torch'];
const PERM={climber:1,floater:1,lamp:1};
function rng(seed){let s=seed>>>0||1;return()=>((s=Math.imul(s^(s>>>15),2246822507)^Math.imul(s^(s>>>13),3266489909),(s^=s>>>16)>>>0)/4294967296);}
// ---------------- level rasterizer (pure JS) ----------------
function noise1(x,seed){const i=Math.floor(x),f=x-i;const h=n=>{let v=Math.imul(n+seed*374761393,668265263);v=(v^(v>>>13))*1274126177;return((v^(v>>>16))>>>0)/4294967296-0.5;};const u=f*f*(3-2*f);return h(i)*(1-u)+h(i+1)*u;}
export function roughen(pts,amp=3,seg=6,seed=1){const out=[];let t=0;
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);const n=Math.max(1,Math.round(L/seg));const nx=-dy/(L||1),ny=dx/(L||1);
    for(let k=0;k<n;k++){const s=k/n;const d=(noise1(t*0.25,seed)*1.4+noise1(t*0.9,seed+7)*0.6)*amp*(a[2]===0||b[2]===0?0:1);out.push([a[0]+dx*s+nx*d,a[1]+dy*s+ny*d]);t++;}}
  return out;}
function fillPoly(mask,W,Hh,pts,val){let minY=Infinity,maxY=-Infinity;for(const p of pts){minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
  minY=Math.max(0,Math.floor(minY));maxY=Math.min(Hh-1,Math.ceil(maxY));
  for(let y=minY;y<=maxY;y++){const yc=y+0.5;const xs=[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>yc)!==(b[1]>yc))xs.push(a[0]+(yc-a[1])/(b[1]-a[1])*(b[0]-a[0]));}
    xs.sort((p,q)=>p-q);for(let k=0;k+1<xs.length;k+=2){const x0=Math.max(0,Math.ceil(xs[k]-0.5)),x1=Math.min(W-1,Math.floor(xs[k+1]-0.5));for(let x=x0;x<=x1;x++)val(x,y);}}}
export function rasterize(L){const W=L.w,Hh=L.h;const m=new Uint8Array(W*Hh);
  for(const s of L.shapes){let pts=s.pts;
    if(s.rect){const [x,y,w,h]=s.rect;pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}
    if(s.ell){const [cx,cy,rx,ry]=s.ell;pts=[];for(let k=0;k<48;k++){const a=k/48*Math.PI*2;pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}}
    if(s.rough!==0&&!s.rect)pts=roughen(pts,s.rough??3,6,s.seed||(pts.length*13+7));
    else if(s.rect&&s.rough)pts=roughen(pts,s.rough,6,s.seed||5);
    const v=s.mat==='air'?AIR:s.mat==='steel'?STEEL:s.mat==='plank'?PLANK:ROCK;
    fillPoly(m,W,Hh,pts,(x,y)=>{m[y*W+x]=v;});}
  return m;}
// ---------------- simulation ----------------
export class Sim{
  constructor(L,{seed=1}={}){this.L=L;this.W=L.w;this.Hh=L.h;this.mask=rasterize(L);this.r=rng(seed);
    this.miners=[];this.t=0;this.tick=0;this.spawned=0;this.saved=0;this.lost=0;this.events=[];
    this.rate=L.rate;this.minRate=L.rate;this.spawnAcc=0;this.skills={...L.skills};this.lights=(L.lights||[]).map(l=>({...l,fixed:true}));
    this.hatchOpen=0;this.over=false;this.nuking=false;this.nukeIdx=0;this.timeLeft=L.time;this.result=null;this.nextId=0;}
  at(x,y){x|=0;y|=0;if(x<0||x>=this.W)return STEEL;if(y<0)return AIR;if(y>=this.Hh)return AIR;return this.mask[y*this.W+x];}
  solid(x,y){return this.at(x,y)!==AIR;}
  set(x,y,v){x|=0;y|=0;if(x<0||x>=this.W||y<0||y>=this.Hh)return;this.mask[y*this.W+x]=v;}
  // erase a set of pixels via predicate in bbox; returns {n: erased, steel: hit steel}
  erase(x0,y0,x1,y1,pred){let n=0,steel=0;x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(this.W-1,x1|0);y1=Math.min(this.Hh-1,y1|0);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(!pred(x,y))continue;const i=y*this.W+x,v=this.mask[i];if(v===STEEL){steel++;continue;}if(v!==AIR){this.mask[i]=AIR;n++;}}
    if(n)this.events.push({type:'dirty',x0,y0,x1,y1});return {n,steel};}
  countIn(x0,y0,x1,y1,pred,val){let n=0;for(let y=y0|0;y<=(y1|0);y++)for(let x=x0|0;x<=(x1|0);x++)if(pred(x,y)&&(val===undefined?this.solid(x,y):this.at(x,y)===val))n++;return n;}
  spawnInterval(){return Math.round(TPS*(0.25+(99-this.rate)*0.034));}
  setRate(r){this.rate=Math.max(this.minRate,Math.min(99,r));}
  alive(){return this.miners.filter(m=>m.alive);}
  lightAt(x,y){let best=0;for(const l of this.lights){const d=Math.hypot(l.x-x,l.y-y);if(d<l.r)best=Math.max(best,1-d/l.r);}
    for(const m of this.miners)if(m.alive&&m.lamp){const d=Math.hypot(m.x-x,m.y-8-y);if(d<62)best=Math.max(best,1-d/62);}return best;}
  inDark(x,y){for(const z of this.L.dark||[]){if(x>=z[0]&&x<=z[0]+z[2]&&y>=z[1]&&y<=z[1]+z[3])return true;}return false;}
  // ------------ skills ------------
  // Walker (unlimited, as in NeoLemmix): releases a blocker, stops any task, wakes a shrugging builder, or turns a walker round
  canWalk(m){return !!(m&&m.alive&&['blocker','builder','basher','miner','digger','shrug','walk'].includes(m.state));}
  canAssign(m,sk){if(sk==='walker')return this.canWalk(m);if(m&&m.alive&&sk==='blocker'&&m.state==='blocker')return true;// tapping a blocker again releases him (free)
    if(!m||!m.alive||m.state==='exit'||m.state==='splat'||m.state==='taken'||m.state==='dead')return false;if((this.skills[sk]|0)<=0)return false;
    if(sk==='torch')return false;
    if(PERM[sk])return !m[sk];
    if(sk==='blaster')return m.fuse<0;
    const dig=['walk','builder','basher','miner','digger','shrug'];
    if(sk==='blocker')return dig.includes(m.state);
    if(!dig.includes(m.state))return false;return m.state!==sk;}
  assign(m,sk){if(!this.canAssign(m,sk))return false;
    if(sk==='walker'){const was=m.state;if(was==='walk')m.dir=-m.dir;m.state='walk';m.acc=0;m.st=0;m.n=0;this.events.push({type:'release',m,was});return true;}
    if(sk==='blocker'&&m.state==='blocker'){m.state='walk';m.acc=0;this.events.push({type:'release',m});return true;}
    this.skills[sk]--;
    if(PERM[sk]){m[sk]=true;}
    else if(sk==='blaster'){m.fuse=5*TPS;}
    else{m.state=sk;m.st=0;m.n=0;m.strokes=0;if(sk==='builder')m.n=12;}
    this.events.push({type:'assign',m,skill:sk});return true;}
  placeTorch(x,y){if((this.skills.torch|0)<=0)return false;
    // snap to the nearest floor below within 40px, must be air
    if(this.solid(x,y))return false;let gy=y;while(gy<y+40&&!this.solid(x,gy+1))gy++;if(!this.solid(x,gy+1))return false;
    this.skills.torch--;const l={x,y:gy-14,gy,r:78,kind:'torch'};this.lights.push(l);this.events.push({type:'torch',l});return true;}
  nuke(){if(this.nuking)return;this.nuking=true;this.spawned=this.L.total;}
  // ------------ main tick ------------
  step(){if(this.over)return;this.tick++;this.t=this.tick/TPS;this.timeLeft=Math.max(0,this.L.time-this.t);
    if(this.hatchOpen<1){this.hatchOpen=Math.min(1,this.hatchOpen+1/(TPS*1.2));}
    else if(this.spawned<this.L.total&&!this.nuking){if(--this.spawnAcc<=0){this.spawn();this.spawnAcc=this.spawnInterval();}}
    if(this.nuking&&this.tick%3===0){const a=this.miners.filter(m=>m.alive&&m.fuse<0&&m.state!=='exit');if(a.length)a[0].fuse=5*TPS;}
    for(const m of this.miners)if(m.alive)this.update(m);
    if(this.timeLeft<=0&&!this.over){for(const m of this.miners)if(m.alive&&m.state!=='exit'){m.alive=false;m.state='dead';this.lost++;}}
    if((this.spawned>=this.L.total&&this.miners.every(m=>!m.alive))||this.timeLeft<=0)this.finish();}
  finish(){this.over=true;const L=this.L;const pct=this.saved;const stars=pct>=L.stars[2]?3:pct>=L.stars[1]?2:pct>=L.stars[0]?1:0;
    this.result={saved:this.saved,lost:this.lost,win:this.saved>=L.quota,stars,time:this.t};this.events.push({type:'over',result:this.result});}
  spawn(){const h=this.L.hatch;const m={id:this.nextId++,x:h.x,y:h.y,dir:h.dir||1,state:'fall',fallD:0,st:0,acc:0,alive:true,fuse:-1,climber:false,floater:false,lamp:false,floating:false,dread:0,n:0,anim:0};
    this.miners.push(m);this.spawned++;this.events.push({type:'spawn',m});}
  die(m,how){m.alive=false;m.state=how==='splat'?'splat':how==='taken'?'taken':'dead';m.st=0;this.lost++;this.events.push({type:'lost',m,how});}
  headClear(x,y){for(let k=3;k<H-5;k++)if(this.solid(x,y-k))return false;return true;}
  blockedBy(m,nx){for(const b of this.miners){if(b===m||!b.alive||b.state!=='blocker')continue;if(Math.abs(b.y-m.y)<12&&Math.abs(b.x-nx)<=5&&Math.sign(b.x-m.x)===m.dir&&Math.abs(b.x-m.x)>0.5)return true;}return false;}
  turn(m){m.dir=-m.dir;}
  startFall(m){m.state='fall';m.fallD=0;m.floating=false;m.st=0;}
  walkStep(m){// one pixel forward with step-up / step-down; returns false if it turned or started falling
    const nx=m.x+m.dir;
    if(this.blockedBy(m,nx)){this.turn(m);return false;}
    if(this.solid(nx,m.y)){let up=0;for(let u=1;u<=STEP;u++){if(!this.solid(nx,m.y-u)){up=u;break;}}
      if(up&&this.headClear(nx,m.y-up)){m.x=nx;m.y-=up;return true;}
      if(m.climber&&m.state==='walk'){m.state='climb';m.st=0;return false;}
      this.turn(m);return false;}
    if(!this.headClear(nx,m.y)){if(m.climber&&m.state==='walk'){m.state='climb';m.st=0;return false;}this.turn(m);return false;}
    m.x=nx;
    if(!this.solid(m.x,m.y+1)){let d=0;while(d<4&&!this.solid(m.x,m.y+1+d))d++;if(d<4){m.y+=d;}else{this.startFall(m);return false;}}
    return true;}
  update(m){m.st++;m.anim++;
    if(m.fuse>=0&&m.state!=='exit'){m.fuse--;if(m.fuse<0){this.blast(m);return;}}
    if(m.y>this.Hh+4){this.die(m,'void');return;}
    // darkness: unlit miners in a shadow seam are taken
    if(this.L.dark&&m.state!=='exit'){if(this.inDark(m.x,m.y-6)&&this.lightAt(m.x,m.y-6)<0.08){m.dread+=1/TPS;if(m.dread>2.2){this.die(m,'taken');this.events.push({type:'taken',m});return;}}else m.dread=Math.max(0,m.dread-2/TPS);}
    // exit
    const ex=this.L.exit;if(m.state!=='exit'&&m.state!=='fall'&&Math.abs(m.x-ex.x)<=6&&Math.abs(m.y-ex.y)<=6){m.state='exit';m.st=0;m.fuse=-1;this.events.push({type:'enter',m});}
    switch(m.state){
      case 'walk':{m.acc+=WALK;while(m.acc>=1&&m.state==='walk'){m.acc-=1;this.walkStep(m);}break;}
      case 'fall':{if(m.floater&&m.fallD>22)m.floating=true;const v=m.floating?FLOAT:FALL;let mv=v;
        while(mv>0){const s=Math.min(1,mv);mv-=s;if(this.solid(m.x,m.y+1)){// land
            if(m.fallD>SAFE_FALL&&!m.floating){this.die(m,'splat');this.events.push({type:'splat',m});return;}
            m.state='walk';m.acc=0;m.floating=false;m.fallD=0;this.events.push({type:'land',m});return;}
          m.y+=s;m.fallD+=s;}break;}
      case 'climb':{m.acc+=CLIMB;while(m.acc>=1){m.acc-=1;
          if(this.solid(m.x,m.y-H)){// ceiling: fall back
            this.turn(m);m.x+=m.dir;this.startFall(m);return;}
          m.y-=1;if(!this.solid(m.x+m.dir,m.y)&&!this.solid(m.x+m.dir,m.y-3)&&!this.solid(m.x+m.dir,m.y-7)){// reached the top edge: hop over
            m.state='hoist';m.st=0;return;}}
        break;}
      case 'hoist':{if(m.st>8){m.x+=m.dir;m.y-=1;while(this.solid(m.x,m.y))m.y--;m.state='walk';m.acc=0;}break;}
      case 'blocker':{if(!this.solid(m.x,m.y+1)&&!this.solid(m.x,m.y+2))this.startFall(m);break;}
      case 'shrug':{if(m.st>20){m.state='walk';m.acc=0;}break;}
      case 'exit':{if(m.st>=26){m.alive=false;m.state='saved';this.saved++;this.events.push({type:'saved',m});}break;}
      case 'builder':{if(!this.solid(m.x,m.y+1)&&!this.solid(m.x,m.y+2)){this.startFall(m);break;}
        if(m.st===10){// lay a plank: 10 wide, 2 thick, top at y-1
          for(let i=0;i<11;i++)for(let r=0;r<2;r++){const px=m.x+m.dir*(i-1),py=m.y-r;if(this.at(px,py)===AIR)this.set(px,py,PLANK);}
          this.events.push({type:'plank',x:m.x,y:m.y,dir:m.dir});this.events.push({type:'dirty',x0:Math.min(m.x-m.dir,m.x+m.dir*10)-1,y0:m.y-2,x1:Math.max(m.x-m.dir,m.x+m.dir*10)+1,y1:m.y+1});m.n--;}
        if(m.st>=16){m.st=0;// climb onto the new step
          let ok=true;for(let k=0;k<4;k++){const nx=m.x+m.dir;if(this.solid(nx,m.y-2)&&this.solid(nx,m.y-3)){ok=false;break;}if(!this.headClear(nx,m.y-2)){ok=false;break;}m.x=nx;}
          m.y-=2;
          if(!ok){this.turn(m);m.state='walk';m.acc=0;break;}
          if(m.n<=0){m.state='shrug';m.st=0;this.events.push({type:'shrug',m});}
          else if(m.n<=3)this.events.push({type:'lowplanks',m});}
        break;}
      case 'basher':{if(!this.solid(m.x,m.y+1)&&!this.solid(m.x,m.y+2)&&!this.solid(m.x,m.y+3)){this.startFall(m);break;}
        if(m.st===6){const d=m.dir,x=m.x,y=m.y;
          const ahead=this.countIn(Math.min(x+d,x+d*14),y-H+1,Math.max(x+d,x+d*14),y-1,()=>true);
          if(m.strokes>0&&ahead===0){m.state='walk';m.acc=0;break;}
          const r=this.erase(Math.min(x,x+d*11),y-H-4,Math.max(x,x+d*11),y,(px,py)=>{const dx=(px-x)*d;if(dx<0||dx>11)return false;const top=y-H-3+Math.max(0,(dx-7))*1.2;return py>=top&&py<=y;});
          if(r.steel>2){this.turn(m);m.state='walk';m.acc=0;this.events.push({type:'clink',m});break;}
          if(r.n)this.events.push({type:'dig',kind:'bash',x:x+d*8,y:y-7,n:r.n});m.strokes++;}
        if(m.st>=12){m.st=0;for(let k=0;k<5;k++){const nx=m.x+m.dir;if(this.solid(nx,m.y)&&!this.solid(nx,m.y-1)){m.x=nx;m.y--;continue;}if(this.solid(nx,m.y))break;m.x=nx;if(!this.solid(m.x,m.y+1)&&this.solid(m.x,m.y+2))m.y++;}}
        break;}
      case 'miner':{if(!this.solid(m.x,m.y+1)&&!this.solid(m.x,m.y+2)&&!this.solid(m.x,m.y+3)){this.startFall(m);break;}
        if(m.st===8){const d=m.dir,cx=m.x+d*5,cy=m.y-5;
          const r=this.erase(cx-11,cy-11,cx+11,cy+11,(px,py)=>{const dx=px-cx,dy=py-cy;return dx*dx+dy*dy<=10.5*10.5&&(px-m.x)*d>=-2&&py<=m.y+3&&(py<=m.y||(px-m.x)*d>=2);});
          if(r.steel>2){this.turn(m);m.state='walk';m.acc=0;this.events.push({type:'clink',m});break;}
          if(r.n)this.events.push({type:'dig',kind:'mine',x:cx,y:cy+4,n:r.n});}
        if(m.st>=18){m.st=0;m.x+=m.dir*3;m.y+=3;if(!this.solid(m.x,m.y+1)){let d=0;while(d<3&&!this.solid(m.x,m.y+1))m.y++,d++;if(!this.solid(m.x,m.y+1))this.startFall(m);}}
        break;}
      case 'digger':{if(m.st%5===0){const x=m.x,y=m.y;
          const r=this.erase(x-6,y+1,x+6,y+2,()=>true);
          if(r.steel>3&&r.n===0){m.state='walk';m.acc=0;this.events.push({type:'clink',m});break;}
          if(r.n)this.events.push({type:'dig',kind:'dig',x,y:y+2,n:r.n});
          if(r.n===0&&!this.solid(x,y+1)&&!this.solid(x,y+2)&&!this.solid(x,y+3)){this.startFall(m);break;}
          m.y+=2;}
        break;}
    }
    if(m.alive&&m.y>this.Hh+4)this.die(m,'void');}
  blast(m){const x=m.x,y=m.y-6,R=19;this.erase(x-R,y-R,x+R,y+R,(px,py)=>(px-x)**2+(py-y)**2<=R*R);
    this.events.push({type:'boom',x,y,m});if(m.state==='exit'){return;}this.die(m,'blast');}
  drain(){const e=this.events;this.events=[];return e;}
}
