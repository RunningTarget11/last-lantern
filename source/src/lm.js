// Occlusion-correct 2D light field (from the sim's per-light ray-cast visibility) uploaded as textures and
// shaded into every material: soft rock-cast shadows, coloured falloff, a dominant light direction for
// normal-mapped PBR response. Unlimited lights at a fixed cost - the core of the look on mobile GPUs.
import * as THREE from 'three';
export const LMU={uLM:{value:null},uLD:{value:null},uLMSize:{value:new THREE.Vector2(1,1)},uLMExpo:{value:3.4},uAmb:{value:new THREE.Color(0.11,0.12,0.16)},uTime:{value:0}};
export class LightField{
  constructor(sim){this.sim=sim;this.w=sim.lw;this.h=sim.lh;const n=this.w*this.h;
    this.c=new Float32Array(n*3);this.d=new Float32Array(n*3);
    this.cd=new Uint16Array(n*4);this.dd=new Uint16Array(n*4);
    const mk=(arr)=>{const t=new THREE.DataTexture(arr,this.w,this.h,THREE.RGBAFormat,THREE.HalfFloatType);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.needsUpdate=true;return t;};
    this.tc=mk(this.cd);this.td=mk(this.dd);LMU.uLM.value=this.tc;LMU.uLD.value=this.td;LMU.uLMSize.value.set(sim.W,sim.H);this.extra=[];}
  flash(x,y,r,i,c,life){this.extra.push({x,y,r,i,c,life,max:life,vis:null,key:''});}
  update(t,dt,{skipForeman=false,mult=1}={}){
    const s=this.sim,C=this.c,D=this.d;C.fill(0);D.fill(0);const W=this.w;
    const add=(l,f)=>{if(f<=0.001)return;const v=s.visOf(l);const [i0,j0,w,h]=l.box;const cr=l.c[0]*f,cg=l.c[1]*f,cb=l.c[2]*f;const dx=l.dirx,dy=l.diry;
      for(let y=0;y<h;y++){let k=(j0+y)*W+i0,vk=y*w;for(let x=0;x<w;x++,k++,vk++){const a=v[vk];if(!a)continue;const k3=k*3;C[k3]+=a*cr;C[k3+1]+=a*cg;C[k3+2]+=a*cb;const af=a*f;D[k3]+=dx[vk]*af;D[k3+1]+=dy[vk]*af;D[k3+2]+=af;}}};
    for(const l of s.lights){if(!l.on)continue;if(skipForeman&&l.kind==='foreman')continue;
      const ph=l.id*1.37;let f=1;
      if(l.kind==='torch'||l.kind==='fixedTorch')f=0.86+0.07*Math.sin(t*11+ph)+0.05*Math.sin(t*23.7+ph*2)+0.03*Math.sin(t*41+ph*5);
      else if(l.kind==='flare')f=0.8+0.12*Math.sin(t*19+ph)+0.08*Math.sin(t*37+ph*3)+0.1*Math.sin(t*7+ph);
      else if(l.kind==='lamp'||l.kind==='fixedLamp'||l.kind==='foreman')f=0.97+0.025*Math.sin(t*6+ph)+0.012*Math.sin(t*17+ph);
      else if(l.kind==='exit')f=0.95+0.05*Math.sin(t*2.3);
      const age=t-(l.renderBorn??(l.renderBorn=t));f*=Math.min(1,age*2.5);
      if(l.kind==='flare'){const fl=s.flares.find(q=>q.light===l);if(fl&&fl.life<3)f*=fl.life/3;}
      add(l,f*mult);}
    this.extra=this.extra.filter(e=>{e.life-=dt;if(e.life<=0)return false;const k=e.life/e.max;add(e,k*k);return true;});
    const cd=this.cd,dd=this.dd,h2=THREE.DataUtils.toHalfFloat;const n=this.w*this.h;
    for(let k=0;k<n;k++){const k3=k*3,k4=k*4;cd[k4]=h2(C[k3]);cd[k4+1]=h2(C[k3+1]);cd[k4+2]=h2(C[k3+2]);dd[k4]=h2(D[k3]);dd[k4+1]=h2(D[k3+1]);dd[k4+2]=h2(D[k3+2]);}
    this.tc.needsUpdate=true;this.td.needsUpdate=true;}
}
const LM_PARS=`
uniform sampler2D uLM;uniform sampler2D uLD;uniform vec2 uLMSize;uniform float uLMExpo;uniform vec3 uAmb;
varying vec3 vLW;
vec3 lmLight(vec3 wp,out vec3 Ld){vec2 uv=wp.xy/uLMSize;vec3 c=texture2D(uLM,uv).rgb;vec3 d=texture2D(uLD,uv).rgb;
  float coh=clamp(length(d.xy)/max(d.z,1e-4),0.,1.);vec2 dn=length(d.xy)>1e-5?normalize(d.xy):vec2(0.,1.);
  float zf=0.35-wp.z;Ld=normalize(vec3(dn*(0.35+1.4*coh),zf*0.8+0.25));
  return c/(1.0+0.07*zf*zf);}
`;
// Patch any MeshStandardMaterial so its direct light comes from the light field.
export function patchLM(m,extra){
  const prev=m.onBeforeCompile;
  m.onBeforeCompile=(sh,r)=>{
    Object.assign(sh.uniforms,LMU);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLW;\n')
      .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      {vec4 lw=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      lw=instanceMatrix*lw;
      #endif
      vLW=(modelMatrix*lw).xyz;}`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+LM_PARS)
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      {vec3 Ld;vec3 lc=lmLight(vLW,Ld)*uLMExpo;IncidentLight il;il.color=lc;il.direction=normalize((viewMatrix*vec4(Ld,0.)).xyz);il.visible=true;
       RE_Direct(il,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
       reflectedLight.indirectDiffuse+=lc*0.08*BRDF_Lambert(material.diffuseColor)+uAmb*material.diffuseColor*0.5;}`);
    if(extra)extra(sh,r);if(prev)prev(sh,r);
  };
  const key=m.customProgramCacheKey?m.customProgramCacheKey():'';m.customProgramCacheKey=()=>key+'|lm'+(extra?extra.key||'x':'');
  return m;
}
export const LM_GLSL=LM_PARS;
