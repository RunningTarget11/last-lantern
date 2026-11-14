// Painted-realistic terrain: rock / granite / timber textures drawn through the destructible mask,
// with baked depth shading (cut-face falloff, lit upper rims, dark undersides) and soft AA edges.
import {AIR,ROCK,STEEL,PLANK} from './sim.js';
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c;};
export class TerrainArt{
  constructor(sim,imgs,A){this.s=sim;this.A=A;this.W=sim.W;this.H=sim.Hh;
    this.cv=mk(this.W*A,this.H*A);this.ctx=this.cv.getContext('2d');
    const tile=(img,size)=>{const c=mk(size,size);c.getContext('2d').drawImage(img,0,0,size,size);return c;};
    const T=Math.round(150*A/3);
    this.pat={rock:this.ctx.createPattern(tile(imgs.rock,T*1.4|0),'repeat'),steel:this.ctx.createPattern(tile(imgs.granite,T),'repeat'),plank:this.ctx.createPattern(tile(imgs.wood,Math.round(64*A/3)),'repeat')};
    this.mini=mk(this.W,this.H);this.mctx=this.mini.getContext('2d');
    this.rebuild(0,0,this.W-1,this.H-1);}
  rebuild(x0,y0,x1,y1){const CH=96;for(let y=Math.max(0,y0);y<=Math.min(this.H-1,y1);y+=CH)for(let x=Math.max(0,x0);x<=Math.min(this.W-1,x1);x+=CH)this.region(x,y,Math.min(x1,x+CH-1),Math.min(y1,y+CH-1));}
  region(x0,y0,x1,y1){const s=this.s,A=this.A,P=6;const W=this.W,H=this.H;
    x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W-1,x1|0);y1=Math.min(H-1,y1|0);
    const ex0=Math.max(0,x0-P),ey0=Math.max(0,y0-P),ex1=Math.min(W-1,x1+P),ey1=Math.min(H-1,y1+P);const w=ex1-ex0+1,h=ey1-ey0+1;
    const m=s.mask;const dist=new Uint8Array(w*h);
    // chamfer distance to air (cap 8)
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=m[(ey0+y)*W+ex0+x];dist[y*w+x]=v===AIR?0:8;}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!dist[i])continue;let d=dist[i];if(x>0)d=Math.min(d,dist[i-1]+1);if(y>0)d=Math.min(d,dist[i-w]+1);if(x>0&&y>0)d=Math.min(d,dist[i-w-1]+1);if(x<w-1&&y>0)d=Math.min(d,dist[i-w+1]+1);dist[i]=d;}
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!dist[i])continue;let d=dist[i];if(x<w-1)d=Math.min(d,dist[i+1]+1);if(y<h-1)d=Math.min(d,dist[i+w]+1);if(x<w-1&&y<h-1)d=Math.min(d,dist[i+w+1]+1);if(x>0&&y<h-1)d=Math.min(d,dist[i+w-1]+1);dist[i]=d;}
    const rw=x1-x0+1,rh=y1-y0+1;
    const shade=new ImageData(rw,rh),al=[new ImageData(rw,rh),new ImageData(rw,rh),new ImageData(rw,rh)];const mini=new ImageData(rw,rh);
    for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const gx=x0+x,gy=y0+y;const v=m[gy*W+gx];const o=(y*rw+x)*4;
      const lx=gx-ex0,ly=gy-ey0;const d=dist[ly*w+lx];
      if(v!==AIR){const k=v===STEEL?1:v===PLANK?2:0;al[k].data[o+3]=255;
        // orientation: air above -> lit rim; air below -> dark underside
        const up=gy>0&&m[(gy-1)*W+gx]===AIR||gy>1&&m[(gy-2)*W+gx]===AIR, dn=gy<H-1&&m[(gy+1)*W+gx]===AIR||gy<H-2&&m[(gy+2)*W+gx]===AIR;
        let b=0.42+0.58*Math.pow(1-Math.min(d,8)/8,1.6);
        if(up)b+=0.28;if(dn)b*=0.62;if(v===PLANK)b=Math.max(b,0.85);
        b=Math.min(1.25,b);const c=Math.round(Math.min(255,b*205));
        shade.data[o]=c;shade.data[o+1]=Math.round(c*0.97);shade.data[o+2]=Math.round(c*0.93);shade.data[o+3]=255;
        mini.data[o]=v===STEEL?70:v===PLANK?150:120;mini.data[o+1]=v===STEEL?82:v===PLANK?115:96;mini.data[o+2]=v===STEEL?100:v===PLANK?60:72;mini.data[o+3]=255;}
    }
    this.mctx.clearRect(x0,y0,rw,rh);this.mctx.putImageData(mini,x0,y0);
    const sc=mk(rw,rh),sx=sc.getContext('2d');sx.putImageData(shade,0,0);
    const RW=rw*A,RH=rh*A;const tmp=mk(RW,RH),t=tmp.getContext('2d');t.imageSmoothingEnabled=true;
    const layer=mk(RW,RH),lc=layer.getContext('2d');lc.imageSmoothingEnabled=true;
    const am=mk(rw,rh),ax=am.getContext('2d');
    ['rock','steel','plank'].forEach((name,k)=>{let any=false;const d=al[k].data;for(let i=3;i<d.length;i+=4)if(d[i]){any=true;break;}if(!any)return;
      lc.globalCompositeOperation='source-over';lc.clearRect(0,0,RW,RH);lc.save();lc.translate(-x0*A,-y0*A);lc.fillStyle=this.pat[name];lc.fillRect(x0*A,y0*A,RW,RH);lc.restore();
      ax.clearRect(0,0,rw,rh);ax.putImageData(al[k],0,0);lc.globalCompositeOperation='destination-in';lc.drawImage(am,0,0,RW,RH);
      t.drawImage(layer,0,0);});
    t.globalCompositeOperation='multiply';t.drawImage(sc,0,0,RW,RH);
    // multiply wiped alpha to opaque where shade is; restore alpha from union mask
    t.globalCompositeOperation='destination-in';ax.clearRect(0,0,rw,rh);
    const un=new ImageData(rw,rh);for(let i=3;i<un.data.length;i+=4)un.data[i]=al[0].data[i]|al[1].data[i]|al[2].data[i];ax.putImageData(un,0,0);t.drawImage(am,0,0,RW,RH);
    this.ctx.clearRect(x0*A,y0*A,RW,RH);this.ctx.drawImage(tmp,x0*A,y0*A);}
}
