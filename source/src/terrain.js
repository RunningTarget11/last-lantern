// Renders the sim's 0.25 m terrain grid as a real 3D mine: marching-squares contours of a smoothed field,
// extruded in depth with a rounded back so tunnels read as bored rock, plus a back wall and a cut-away front
// face. World-projected Poly Haven rock textures with whiteout-blended normal maps.
import * as THREE from 'three';
import {CELL,fbm2} from './sim.js';
import {patchLM} from './lm.js';
const CH=32;// cells per chunk
const RINGS=[[1.7,0],[1.0,0],[0.2,0],[-0.55,0.05],[-1.2,0.24],[-1.7,0.58],[-2.1,1.0]];
export const BACK_Z=-2.2,FRONT_Z=1.7;
const SIDE_FRAG=`
vec3 aw=pow(abs(wN),vec3(4.0));aw/=(aw.x+aw.y+aw.z+1e-5);
vec2 uvA=vLW.xz*uScale,uvB=vLW.zy*uScale;
vec3 rA=texture2D(tRock,uvA).rgb,rB=texture2D(tRock,uvB).rgb,gA=texture2D(tGround,uvA*1.25).rgb;
float fl=smoothstep(0.35,0.8,wN.y);
vec3 col=mix(rA,gA*vec3(0.62,0.6,0.58),fl)*aw.y+rB*(aw.x+aw.z);
float big=texture2D(tRock,vLW.xy*0.045+0.3).g;
col*=0.55+0.8*big*big;
diffuseColor.rgb*=col*vColor.rgb;
`;
const SIDE_NOR=`
{vec3 tA=mix(texture2D(tRockN,uvA).xyz,texture2D(tGroundN,uvA*1.25).xyz,fl)*2.-1.;vec3 tB=texture2D(tRockN,uvB).xyz*2.-1.;
 tA.xy*=uNS;tB.xy*=uNS;
 vec3 nX=vec3(tB.xy+wN.zy,abs(tB.z)*wN.x);vec3 nY=vec3(tA.xy+wN.xz,abs(tA.z)*wN.y);
 vec3 nw=normalize(nX.zyx*(aw.x+aw.z)+nY.xzy*aw.y);
 normal=normalize((viewMatrix*vec4(nw,0.)).xyz);}
`;
const FLAT_FRAG=`
vec2 uvC=vLW.xy*uScale;vec3 col=texture2D(tRock,uvC).rgb;float big=texture2D(tRock,vLW.xy*0.045+0.3).g;col*=(0.75+0.55*big)*uTint;
`;
const FLAT_NOR=`
{vec3 tC=texture2D(tRockN,uvC).xyz*2.-1.;tC.xy*=uNS;vec3 nw=normalize(vec3(tC.xy+wN.xy,abs(tC.z)*wN.z));normal=normalize((viewMatrix*vec4(nw,0.)).xyz);}
`;
function rockMat(T,kind){
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9,metalness:0,vertexColors:kind==='side'});
  const u={tRock:{value:T.rockD},tRockN:{value:T.rockN},tGround:{value:T.groundD},tGroundN:{value:T.groundN},uScale:{value:0.33},uNS:{value:kind==='side'?1.8:1.4},uTint:{value:new THREE.Color(kind==='back'?0.55:0.5,kind==='back'?0.53:0.47,kind==='back'?0.5:0.45)},uMask:{value:T.mask},uMaskSize:{value:T.maskSize},uTime:{value:0}};
  m.userData.u=u;
  const fn=(sh)=>{Object.assign(sh.uniforms,u);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tRock,tRockN,tGround,tGroundN,uMask;uniform float uScale,uNS;uniform vec3 uTint;uniform vec2 uMaskSize;varying vec3 vWN;')
      .replace('#include <map_fragment>','#include <map_fragment>\nvec3 wN=normalize(vWN);\n'+(kind==='side'?SIDE_FRAG:FLAT_FRAG+(kind==='front'?`
        vec4 mk=texture2D(uMask,(vLW.xy+0.125)/uMaskSize);if(mk.r<0.47)discard;
        col*=mix(vec3(1.0),vec3(0.62,0.66,0.78),mk.g)*mix(vec3(1.0),vec3(1.25,1.08,0.9),mk.b);
        float edge=1.0-smoothstep(0.47,0.62,mk.r);col*=0.55+0.6*edge;`:'')+'diffuseColor.rgb*=col;'))
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+(kind==='side'?'{float wet=smoothstep(0.55,0.75,big+0.25*fl)*(1.0-fl*0.4);roughnessFactor=mix(0.92,0.32,wet);}':'roughnessFactor=0.9;'))
      .replace('#include <normal_fragment_maps>',(kind==='side'?SIDE_NOR:FLAT_NOR));};
  fn.key=kind;patchLM(m,fn);return m;}
export class TerrainView{
  constructor(sim,T,parent){this.sim=sim;this.T=T;this.group=new THREE.Group();parent.add(this.group);
    const s=sim;this.fw=s.gw+1;this.fh=s.gh+1;this.F=new Float32Array(this.fw*this.fh);
    // mask texture (corner field) for the front cut face: r=solid field, g=granite, b=rubble
    this.maskData=new Uint8Array(this.fw*this.fh*4);const mt=new THREE.DataTexture(this.maskData,this.fw,this.fh,THREE.RGBAFormat);mt.magFilter=mt.minFilter=THREE.LinearFilter;mt.needsUpdate=true;
    T.mask=mt;T.maskSize=new THREE.Vector2(this.fw*CELL,this.fh*CELL);// texel centres sit on cell corners
    this.mSide=rockMat(T,'side');this.mBack=rockMat(T,'back');this.mFront=rockMat(T,'front');
    this.mFront.userData.u.uMaskSize.value.set(this.fw*CELL,this.fh*CELL);
    const W=s.W,H=s.H;
    const back=new THREE.Mesh(new THREE.PlaneGeometry(W+8,H+8),this.mBack);back.position.set(W/2,H/2,BACK_Z);this.group.add(back);
    // front face uses mask uv = world/maskSize, offset half a texel so texel centres land on corners
    const front=new THREE.Mesh(new THREE.PlaneGeometry(W,H),this.mFront);front.position.set(W/2,H/2,FRONT_Z);this.group.add(front);this.front=front;
    this.mFront.onBeforeCompile2=null;
    this.chunks=new Map();this.computeField(0,0,s.gw,s.gh);this.uploadMask();
    for(let cy=0;cy<Math.ceil(s.gh/CH);cy++)for(let cx=0;cx<Math.ceil(s.gw/CH);cx++)this.buildChunk(cx,cy);
  }
  cellSolid(i,j){const v=this.sim.solid(i,j);return v?1:0;}
  computeField(i0,j0,i1,j1){const s=this.sim,F=this.F,fw=this.fw;
    const raw=(i,j)=>{let a=0;for(let dj=-1;dj<=0;dj++)for(let di=-1;di<=0;di++)a+=this.cellSolid(i+di,j+dj);return a*0.25;};
    for(let j=Math.max(0,j0-2);j<=Math.min(this.fh-1,j1+2);j++)for(let i=Math.max(0,i0-2);i<=Math.min(fw-1,i1+2);i++){
      // 3x3 blur of the 2x2 corner average: smooth, organic contours
      let a=raw(i,j)*4;a+=raw(i-1,j)+raw(i+1,j)+raw(i,j-1)+raw(i,j+1);F[j*fw+i]=a/8;}
  }
  f(i,j){i=Math.max(0,Math.min(this.fw-1,i));j=Math.max(0,Math.min(this.fh-1,j));return this.F[j*this.fw+i];}
  fAt(x,y){const fx=x/CELL,fy=y/CELL,i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;return this.f(i,j)*(1-u)*(1-v)+this.f(i+1,j)*u*(1-v)+this.f(i,j+1)*(1-u)*v+this.f(i+1,j+1)*u*v;}
  uploadMask(i0=0,j0=0,i1=this.fw-1,j1=this.fh-1){const s=this.sim,d=this.maskData,fw=this.fw;
    for(let j=Math.max(0,j0);j<=Math.min(this.fh-1,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(fw-1,i1);i++){const k=(j*fw+i)*4;d[k]=Math.round(this.F[j*fw+i]*255);
      let g=0,b=0;for(let dj=-1;dj<=0;dj++)for(let di=-1;di<=0;di++){const v=s.solid(i+di,j+dj);if(v===2)g++;if(v===3)b++;}d[k+1]=g*63;d[k+2]=b*63;d[k+3]=255;}
    this.T.mask.needsUpdate=true;}
  update(x0,y0,x1,y1){const i0=Math.floor(x0/CELL)-3,j0=Math.floor(y0/CELL)-3,i1=Math.ceil(x1/CELL)+3,j1=Math.ceil(y1/CELL)+3;
    this.computeField(i0,j0,i1,j1);this.uploadMask(i0-2,j0-2,i1+2,j1+2);
    for(let cy=Math.max(0,Math.floor((j0-3)/CH));cy<=Math.floor((j1+3)/CH);cy++)for(let cx=Math.max(0,Math.floor((i0-3)/CH));cx<=Math.floor((i1+3)/CH);cx++)this.buildChunk(cx,cy);}
  buildChunk(cx,cy){const key=cx+','+cy;const old=this.chunks.get(key);if(old){this.group.remove(old);old.geometry.dispose();this.chunks.delete(key);}
    const s=this.sim,fw=this.fw;const i0=cx*CH,j0=cy*CH,i1=Math.min(s.gw,i0+CH),j1=Math.min(s.gh,j0+CH);if(i0>=s.gw||j0>=s.gh)return;
    const pos=[],nor=[],col=[],idx=[];const vmap=new Map();const R=RINGS.length;
    const vert=(eid,x,y,r)=>{const k=eid*R+r;let v=vmap.get(k);if(v!==undefined)return v;
      const e=0.12;let gx=this.fAt(x+e,y)-this.fAt(x-e,y),gy=this.fAt(x,y+e)-this.fAt(x,y-e);let gl=Math.hypot(gx,gy);if(gl<1e-5){gx=0;gy=-1;gl=1;}
      const ax=-gx/gl,ay=-gy/gl;// towards air
      const [z,o]=RINGS[r];const floorness=Math.max(0,ay);
      const n=(fbm2(x*1.1+z*0.7,y*1.1-z*0.5)-0.5)*2;const amp=0.06+0.34*(1-floorness)*(1-floorness)+(z<-0.5?0.12:0);
      const d=o*(1-0.35*floorness)+n*amp*(r===0?0.3:1);
      pos.push(x+ax*d,y+ay*d,z);
      // analytic normal: towards air, tilted to the camera where the tunnel rounds off at the back
      const r2=Math.min(R-1,r+1),r0=Math.max(0,r-1);const dodz=(RINGS[r2][1]-RINGS[r0][1])/(RINGS[r2][0]-RINGS[r0][0]+1e-6);
      let nx=ax,ny=ay,nz=-dodz*(1-0.35*floorness);const nl=Math.hypot(nx,ny,nz);nor.push(nx/nl,ny/nl,nz/nl);
      // tint by material behind the surface
      const ci=Math.floor((x-ax*0.2)/CELL),cj=Math.floor((y-ay*0.2)/CELL);const m=s.solid(ci,cj);
      const sh=0.82+0.3*fbm2(x*0.4+9,y*0.4);
      if(m===2)col.push(0.6*sh,0.64*sh,0.74*sh);else if(m===3)col.push(1.2*sh,1.04*sh,0.86*sh);else col.push(sh,sh*0.97,sh*0.93);
      v=pos.length/3-1;vmap.set(k,v);return v;};
    const E=(i,j,h)=>((j*fw+i)*2+(h?0:1));
    for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){
      const a=this.f(i,j),b=this.f(i+1,j),c=this.f(i+1,j+1),d=this.f(i,j+1);const T=0.5;
      const cs=(a>T?1:0)|(b>T?2:0)|(c>T?4:0)|(d>T?8:0);if(cs===0||cs===15)continue;
      const X=i*CELL,Y=j*CELL;
      const P={// edge points: bottom(h i,j), right(v i+1,j), top(h i,j+1), left(v i,j)
        B:()=>[E(i,j,1),X+CELL*(T-a)/(b-a),Y],Rt:()=>[E(i+1,j,0),X+CELL,Y+CELL*(T-b)/(c-b)],
        Tp:()=>[E(i,j+1,1),X+CELL*(T-d)/(c-d),Y+CELL],L:()=>[E(i,j,0),X,Y+CELL*(T-a)/(d-a)]};
      const segs=[];const ctr=(a+b+c+d)/4;
      switch(cs){case 1:case 14:segs.push(['L','B']);break;case 2:case 13:segs.push(['B','Rt']);break;case 3:case 12:segs.push(['L','Rt']);break;
        case 4:case 11:segs.push(['Rt','Tp']);break;case 6:case 9:segs.push(['B','Tp']);break;case 7:case 8:segs.push(['L','Tp']);break;
        case 5:if(ctr>T){segs.push(['L','Tp'],['B','Rt']);}else{segs.push(['L','B'],['Rt','Tp']);}break;
        case 10:if(ctr>T){segs.push(['L','B'],['Rt','Tp']);}else{segs.push(['L','Tp'],['B','Rt']);}break;}
      for(const [pa,pb] of segs){let p=P[pa](),q=P[pb]();
        const mx=(p[1]+q[1])/2,my=(p[2]+q[2])/2;let dx=q[1]-p[1],dy=q[2]-p[2];const dl=Math.hypot(dx,dy)||1;
        const rx=dy/dl,ry=-dx/dl;if(this.fAt(mx+rx*0.06,my+ry*0.06)>T){const t=p;p=q;q=t;}
        for(let r=0;r<R-1;r++){const A=vert(p[0],p[1],p[2],r),Bv=vert(q[0],q[1],q[2],r),C=vert(q[0],q[1],q[2],r+1),D=vert(p[0],p[1],p[2],r+1);idx.push(A,C,Bv,A,D,C);}}
    }
    if(!idx.length)return;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
    g.computeBoundingSphere();const mesh=new THREE.Mesh(g,this.mSide);mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);this.chunks.set(key,mesh);}
}
