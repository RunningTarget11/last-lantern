import sharp from 'sharp';import {rasterize} from '../src/sim.js';import {LEVELS} from '../src/levels.js';
for(const L of LEVELS){const m=rasterize(L);const px=Buffer.alloc(L.w*L.h*3);
  for(let i=0;i<m.length;i++){const c=m[i]===0?[20,20,28]:m[i]===1?[140,110,80]:m[i]===2?[90,100,130]:[200,160,90];px.set(c,i*3);}
  for(const p of [L.hatch,L.exit]){for(let k=-3;k<=3;k++)for(let j=-3;j<=3;j++){const i=((p.y+j)*L.w+p.x+k)*3;if(i>=0&&i<px.length)px.set(p===L.hatch?[0,255,0]:[255,0,0],i);}}
  for(const z of L.dark||[])for(let x=z[0];x<z[0]+z[2];x+=3){const i=(z[1]*L.w+x)*3;px.set([200,0,200],i);}
  await sharp(px,{raw:{width:L.w,height:L.h,channels:3}}).resize(L.w*2,L.h*2,{kernel:'nearest'}).png().toFile(`/tmp/lvl${L.id}.png`);}
