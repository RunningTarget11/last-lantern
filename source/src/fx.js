// Particles, volumetric haze + creeping darkness overlay, firedamp gas, shadow creatures.
import * as THREE from 'three';
import {LMU,LM_GLSL} from './lm.js';
const NOISE=`float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}`;
// ---------- particles ----------
export class Particles{
  constructor(n,additive,parent,lit=false){this.n=n;this.add=additive;
    const g=new THREE.BufferGeometry();this.p=new Float32Array(n*3);this.c=new Float32Array(n*4);this.s=new Float32Array(n);
    g.setAttribute('position',new THREE.BufferAttribute(this.p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(this.c,4).setUsage(THREE.DynamicDrawUsage));g.setAttribute('size',new THREE.BufferAttribute(this.s,1).setUsage(THREE.DynamicDrawUsage));
    this.m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
      uniforms:{...LMU,uPR:{value:1}},
      vertexShader:`attribute vec4 color;attribute float size;varying vec4 vC;varying vec3 vLW2;uniform float uPR;void main(){vC=color;vLW2=position;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=size*uPR*420./-mv.z;}`,
      fragmentShader:`uniform sampler2D uLM;uniform vec2 uLMSize;uniform float uLMExpo;varying vec4 vC;varying vec3 vLW2;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5)discard;float a=smoothstep(.5,0.,r);a*=a;
        vec3 col=vC.rgb;${lit?'':''}
        if(vC.a<0.){vec3 L=texture2D(uLM,vLW2.xy/uLMSize).rgb*uLMExpo*0.35+vec3(0.006);col*=L;}
        gl_FragColor=vec4(col,abs(vC.a)*a);}`});
    this.pts=new THREE.Points(g,this.m);this.pts.frustumCulled=false;this.pts.renderOrder=additive?6:3;parent.add(this.pts);
    this.list=[];this.geo=g;}
  // o: {x,y,z,vx,vy,vz,life,size,size1,col:[r,g,b],a,a1,grav,drag,lit}
  emit(o){if(this.list.length>=this.n)this.list.shift();o.t=0;o.size1??=o.size;o.a1??=0;o.grav??=0;o.drag??=0;o.vz??=0;o.z??=0;this.list.push(o);}
  update(dt){const L=this.list;let k=0;
    for(let i=0;i<L.length;i++){const o=L[i];o.t+=dt;if(o.t>=o.life)continue;o.vy-=o.grav*dt;const dr=Math.exp(-o.drag*dt);o.vx*=dr;o.vy*=dr;o.vz*=dr;o.x+=o.vx*dt;o.y+=o.vy*dt;o.z+=o.vz*dt;
      if(o.floor!=null&&o.y<o.floor){o.y=o.floor;o.vy*=-0.25;o.vx*=0.5;}
      L[k++]=o;}
    L.length=k;const p=this.p,c=this.c,s=this.s;
    for(let i=0;i<this.n;i++){if(i<k){const o=L[i];const f=o.t/o.life;p[i*3]=o.x;p[i*3+1]=o.y;p[i*3+2]=o.z;const a=o.a+(o.a1-o.a)*f;const fade=Math.min(1,o.t*8)*(o.fadeIn?Math.min(1,o.t/o.fadeIn):1);
        c[i*4]=o.col[0];c[i*4+1]=o.col[1];c[i*4+2]=o.col[2];c[i*4+3]=(o.lit?-1:1)*Math.max(0.0001,a*fade);s[i]=o.size+(o.size1-o.size)*f;}
      else{s[i]=0;c[i*4+3]=0;}}
    this.geo.attributes.position.needsUpdate=true;this.geo.attributes.color.needsUpdate=true;this.geo.attributes.size.needsUpdate=true;this.geo.setDrawRange(0,Math.max(k,1));}
}
// ---------- haze + creeping darkness (one premultiplied full-level plane) ----------
export function makeAtmosphere(W,H,parent){
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
    uniforms:{...LMU,uHaze:{value:1},uDark:{value:1}},
    vertexShader:`varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`,
    fragmentShader:`uniform sampler2D uLM;uniform vec2 uLMSize;uniform float uLMExpo,uTime,uHaze,uDark;varying vec3 vW;${NOISE}
    void main(){vec2 uv=vW.xy/uLMSize;vec3 L=texture2D(uLM,uv).rgb;float lum=dot(L,vec3(.4,.45,.15));
      float t=uTime;vec2 p=vW.xy*0.42;
      float n1=fbm(p+vec2(t*0.05,-t*0.03));float n2=fbm(p*2.3+vec2(-t*0.11,t*0.07)+n1*1.5);
      // drifting lit haze
      float haze=(0.2+1.1*n2*n1*n1)*uHaze;vec3 glow=L*haze*0.11;
      // creeping darkness: writhing smoke that eats the edge of every light pool
      float edge=lum+(n2-0.5)*0.22+(n1-0.5)*0.12;float dark=1.0-smoothstep(0.0,0.34,edge);
      float tend=smoothstep(0.45,0.75,fbm(vec2(p.x*3.,p.y*1.2-t*0.18)+n1*2.));dark=clamp(dark*(0.5+0.28*tend),0.,0.58)*uDark;
      gl_FragColor=vec4(glow*(1.0-dark*0.8),dark);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(W+8,H+8),m);mesh.position.set(W/2,H/2,0.75);mesh.renderOrder=2;parent.add(mesh);return mesh;}
// ---------- firedamp gas ----------
export function makeGas(g,parent){const w=g.x1-g.x0+1.2,h=g.y1-g.y0+0.8;
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{...LMU,uA:{value:1},uIgn:{value:0},uSeed:{value:Math.random()*10}},
    vertexShader:`varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`,
    fragmentShader:`uniform sampler2D uLM;uniform vec2 uLMSize;uniform float uTime,uA,uIgn,uSeed;varying vec2 vUv;varying vec3 vW;${NOISE}
    void main(){vec2 c=vUv-.5;float e=smoothstep(.5,.15,abs(c.x))*smoothstep(.5,.1,abs(c.y));
      float n=fbm(vW.xy*1.1+vec2(uTime*0.12+uSeed,uTime*0.05));float n2=fbm(vW.xy*2.6-vec2(uTime*0.2,uTime*0.08)+n);
      float d=e*smoothstep(0.35,0.8,n*0.6+n2*0.6);vec3 L=texture2D(uLM,vW.xy/uLMSize).rgb;
      vec3 col=vec3(0.55,0.62,0.18)*(0.05+dot(L,vec3(.33))*0.55)+vec3(0.9,0.5,0.1)*uIgn*2.;
      gl_FragColor=vec4(col*d*uA,1.);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.position.set((g.x0+g.x1)/2,(g.y0+g.y1)/2,0.4);mesh.renderOrder=3;parent.add(mesh);
  const back=mesh.clone();back.material=m;back.position.z=-1.0;back.scale.set(1.1,1.05,1);parent.add(back);return [mesh,back];}
// ---------- shadow creatures ----------
export function makeCreature(parent){
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uSeed:{value:Math.random()*20},uBurn:{value:0},uA:{value:1},uDir:{value:1}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime,uSeed,uBurn,uA,uDir;varying vec2 vUv;${NOISE}
    void main(){vec2 p=(vUv-.5)*vec2(2.,2.);p.x*=uDir;float t=uTime+uSeed;
      float n=fbm(p*2.2+vec2(t*0.4,-t*0.9));float n2=fbm(p*4.5+vec2(-t*0.7,-t*1.3)+n);
      // hunched wraith: head blob + trailing tatters
      float body=1.0-length((p-vec2(0.,0.05))*vec2(1.25,0.9));body+=(n-0.5)*0.9+(n2-0.5)*0.5;
      float tail=smoothstep(0.2,-0.9,p.y)*(n2-0.35)*1.2;body=max(body,tail);
      float a=smoothstep(0.0,0.35,body);
      vec2 e1=p-vec2(0.16,0.28),e2=p-vec2(0.36,0.25);float eye=exp(-dot(e1,e1)*900.)+exp(-dot(e2,e2)*1100.);
      float blink=step(0.06,fract(t*0.21+uSeed));
      vec3 col=vec3(0.0)+vec3(0.12,0.04,0.16)*smoothstep(0.35,0.0,body)*a;
      col+=vec3(2.6,2.3,1.9)*eye*blink;col+=vec3(3.,0.9,0.2)*uBurn*smoothstep(0.25,0.0,abs(body-0.15))*a;
      float al=max(a*0.92,eye*blink)*uA*(1.0-uBurn*0.5);
      gl_FragColor=vec4(col,al);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.8),m);mesh.position.z=0.95;mesh.renderOrder=7;parent.add(mesh);return mesh;}
