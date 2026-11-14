import sharp from 'sharp';import {run,SOL} from './solve.mjs';
const [id,T,x0,y0,w,h]=process.argv.slice(2).map(Number);const s=run(id,SOL[id],{maxT:T});const px=Buffer.alloc(w*h*3);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=s.at(x0+x,y0+y);px.set(v===0?[20,20,28]:v===1?[140,110,80]:v===2?[90,100,130]:[220,180,90],(y*w+x)*3);}
for(const m of s.miners)if(m.alive){const c=m.state==='walk'?[0,255,0]:[255,0,255];for(let k=0;k<15;k++){const x=m.x-x0,y=m.y-k-y0;if(x>=0&&x<w&&y>=0&&y<h)px.set(c,(y*w+x)*3);}}
await sharp(px,{raw:{width:w,height:h,channels:3}}).resize(w*4,h*4,{kernel:'nearest'}).png().toFile('/tmp/snap.png');
