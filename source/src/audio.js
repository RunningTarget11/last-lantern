// Fully synthesized WebAudio soundscape: rumble bed, timber creaks, drips with stone echo, whispers in the dark.
let ctx=null,master=null,noiseBuf=null,echo=null,whisperG=null,whisperF=null,creakBus=null,muted=false;
export function audioOn(){return !!ctx;}
export function setMuted(m){muted=m;if(master)master.gain.value=m?0:0.6;}
export function initAudio(){
  if(ctx){if(ctx.state==='suspended')ctx.resume();return;}try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  master=ctx.createGain();master.gain.value=muted?0:0.6;const comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const d=noiseBuf.getChannelData(0);let b=0;for(let i=0;i<d.length;i++){d[i]=Math.random()*2-1;}
  // stone echo
  echo=ctx.createDelay(1.5);echo.delayTime.value=0.37;const fb=ctx.createGain();fb.gain.value=0.45;const ef=ctx.createBiquadFilter();ef.type='lowpass';ef.frequency.value=1800;echo.connect(ef);ef.connect(fb);fb.connect(echo);const eo=ctx.createGain();eo.gain.value=0.55;ef.connect(eo);eo.connect(master);
  // deep rumble bed
  const rb=ctx.createBufferSource();rb.buffer=noiseBuf;rb.loop=true;const rl=ctx.createBiquadFilter();rl.type='lowpass';rl.frequency.value=60;const rg=ctx.createGain();rg.gain.value=0.35;rb.connect(rl);rl.connect(rg);rg.connect(master);rb.start();
  // cold air through the drifts
  const wn=ctx.createBufferSource();wn.buffer=noiseBuf;wn.loop=true;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=350;bp.Q.value=0.8;const wg=ctx.createGain();wg.gain.value=0.02;
  const lfo=ctx.createOscillator();lfo.frequency.value=0.05;const lg=ctx.createGain();lg.gain.value=200;lfo.connect(lg);lg.connect(bp.frequency);lfo.start();wn.connect(bp);bp.connect(wg);wg.connect(master);wn.start(0,1);
  // low drone
  const o1=ctx.createOscillator(),o2=ctx.createOscillator();o1.type=o2.type='sawtooth';o1.frequency.value=36.7;o2.frequency.value=55.3;const dl=ctx.createBiquadFilter();dl.type='lowpass';dl.frequency.value=140;const dg=ctx.createGain();dg.gain.value=0.035;o1.connect(dl);o2.connect(dl);dl.connect(dg);dg.connect(master);o1.start();o2.start();
  // whispers: formant-filtered noise, gain driven by how much of the crew stands in darkness
  const ws=ctx.createBufferSource();ws.buffer=noiseBuf;ws.loop=true;whisperF=[];whisperG=ctx.createGain();whisperG.gain.value=0;
  const wmix=ctx.createGain();wmix.gain.value=1;
  for(const [f,q] of [[700,9],[1150,11],[2400,13]]){const bf=ctx.createBiquadFilter();bf.type='bandpass';bf.frequency.value=f;bf.Q.value=q;ws.connect(bf);bf.connect(wmix);whisperF.push(bf);}
  const am=ctx.createGain();am.gain.value=0;const amo=ctx.createOscillator();amo.frequency.value=5.3;const amg=ctx.createGain();amg.gain.value=0.5;amo.connect(amg);amg.connect(am.gain);amo.start();
  wmix.connect(am);am.connect(whisperG);whisperG.connect(master);whisperG.connect(echo);ws.start(0,2);
  creakBus=ctx.createGain();creakBus.gain.value=1;creakBus.connect(master);creakBus.connect(echo);
  const amb=()=>{if(!ctx)return;if(ctx.state==='running'&&!muted){const r=Math.random();if(r<0.55)drip(0.03+Math.random()*0.04);else if(r<0.8)creak(0.05+Math.random()*0.05);else rumble(0.12);}setTimeout(amb,1100+Math.random()*2600);};setTimeout(amb,1200);
}
function drip(vol){const t=ctx.currentTime;const o=ctx.createOscillator();o.type='sine';const f=800+Math.random()*900;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*2.1,t+0.05);
  const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.09);o.connect(g);g.connect(echo);o.start(t);o.stop(t+0.12);}
function noise(dur,f0,f1,q,vol,type='bandpass',delay=0,dest){if(!ctx)return;const t=ctx.currentTime+delay;const s=ctx.createBufferSource();s.buffer=noiseBuf;const f=ctx.createBiquadFilter();f.type=type;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);
  const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+Math.min(0.02,dur*0.2));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(f);f.connect(g);g.connect(dest||master);s.start(t,Math.random()*2);s.stop(t+dur+0.05);return g;}
function tone(dur,f0,f1,vol,type='sine',delay=0,dest){if(!ctx)return;const t=ctx.currentTime+delay;const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+dur);
  const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(dest||master);o.start(t);o.stop(t+dur+0.05);}
// a timber creak: a slow, rough, resonant frequency glide (stick-slip friction)
function creak(vol){if(!ctx)return;const t=ctx.currentTime;const dur=0.5+Math.random()*0.9;const o=ctx.createOscillator();o.type='sawtooth';const f=70+Math.random()*90;o.frequency.setValueAtTime(f,t);o.frequency.linearRampToValueAtTime(f*(0.7+Math.random()*0.8),t+dur);
  const tr=ctx.createOscillator();tr.frequency.value=18+Math.random()*25;const tg=ctx.createGain();tg.gain.value=f*0.25;tr.connect(tg);tg.connect(o.frequency);
  const bf=ctx.createBiquadFilter();bf.type='bandpass';bf.frequency.value=500+Math.random()*700;bf.Q.value=4;const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.08);g.gain.setValueAtTime(vol,t+dur*0.7);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(bf);bf.connect(g);g.connect(creakBus);o.start(t);tr.start(t);o.stop(t+dur+0.05);tr.stop(t+dur+0.05);}
function rumble(v=0.2){noise(2.8,110,45,0.7,v,'lowpass');noise(0.7,2200,900,3,v*0.07,'bandpass',0.5+Math.random());}
let wTarget=0;
export function setWhisper(level){if(!ctx||!whisperG)return;wTarget=level;const t=ctx.currentTime;whisperG.gain.setTargetAtTime(Math.min(0.5,level*0.5),t,0.4);
  for(const [k,f] of whisperF.entries())f.frequency.setTargetAtTime([650,1100,2300][k]*(0.85+Math.random()*0.35),t,0.15);}
export const sfx={
  tap(){tone(0.06,1400,900,0.05,'triangle');noise(0.05,3000,2000,3,0.05);},
  select(){tone(0.09,520,500,0.06,'triangle');tone(0.12,780,760,0.04,'sine',0.03);noise(0.06,4000,2500,4,0.05);},
  deny(){tone(0.16,160,120,0.12,'square');tone(0.16,120,90,0.08,'square',0.08);},
  place(){noise(0.18,900,300,1,0.25);tone(0.12,220,140,0.15,'triangle');},
  ignite(){noise(0.5,400,2400,0.8,0.25);noise(0.9,1800,900,0.6,0.08,'bandpass',0.2);},
  flare(){noise(0.25,800,3000,1,0.25);noise(2.5,3000,2600,0.5,0.06,'bandpass',0.2);},
  pick(){tone(0.08,1900+Math.random()*400,1500,0.07,'square');noise(0.1,3500,1500,3,0.12,'bandpass',0,echo);noise(0.15,500,200,1,0.12,'lowpass');},
  hammer(){tone(0.07,300,180,0.15,'triangle');noise(0.08,1200,500,2,0.18,'bandpass',0,echo);},
  creak(v=0.12){creak(v);},
  rumble(v){rumble(v);},
  cavein(){noise(2.8,900,40,0.5,0.9,'lowpass');tone(1.4,60,22,0.6);for(let k=0;k<8;k++)noise(0.12,2500,900,2,0.18,'bandpass',0.1+k*0.17,echo);},
  boom(){noise(1.8,2400,40,0.5,1.0,'lowpass');tone(1.2,80,20,0.9);noise(2.5,600,80,0.7,0.35,'lowpass',0.2,echo);},
  taken(){noise(1.6,300,1400,6,0.22,'bandpass',0,echo);tone(1.5,180,60,0.06,'sine');noise(0.9,5000,2000,9,0.06,'bandpass',0.3,echo);},
  fell(){noise(0.5,1500,400,2,0.18,'bandpass',0.4,echo);tone(0.3,90,40,0.25,'triangle',0.45);},
  saved(){tone(1.6,1046,1040,0.05,'sine');tone(1.8,1568,1560,0.03,'sine',0.02);tone(0.05,2600,2000,0.03,'triangle');},
  win(){[392,523,659,784].forEach((f,k)=>tone(2.4,f,f,0.06,'triangle',k*0.18));noise(3,600,200,0.5,0.15,'lowpass',0.2);},
  lose(){tone(2.6,110,55,0.18,'sawtooth');tone(2.6,113,56,0.14,'sawtooth');noise(3,400,80,0.6,0.25,'lowpass');},
  shriek(){noise(0.6,900,2600,8,0.15,'bandpass',0,echo);tone(0.5,900,1500,0.03,'sawtooth');},
  banish(){noise(0.8,2000,200,3,0.2,'bandpass',0,echo);tone(0.6,700,90,0.06,'sawtooth');},
  land(){noise(0.1,600,250,1,0.12,'lowpass');},
};
