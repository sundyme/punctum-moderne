/* Punctum Moderne — "Five Materials": GLSL sources. */
window.PM_SHADERS = (() => {
  const vsFull = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

  const common = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uT;
uniform float uSS;
uniform vec4 uEnvW;      // key, strips, front, fill
uniform float uEnvRot;
uniform vec4 uEnvW2;    // panel L, panel R, overhead, -
out vec4 oCol;
#define PI 3.14159265359
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=0.5; } return s; }
mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
float softRect(vec3 d, vec3 c, vec2 hs, float soft){
  float cd=dot(d,c); if(cd<=0.0) return 0.0;
  vec3 r=normalize(cross(vec3(0,1,0),c)); vec3 u=cross(c,r);
  vec2 q=vec2(dot(d,r),dot(d,u))/cd;
  vec2 e=abs(q)-hs; float sd=length(max(e,0.0))+min(max(e.x,e.y),0.0);
  return 1.0-smoothstep(-soft,soft,sd);
}
// a photographic studio: big key softbox, two strip lights, a front panel, faint fill
vec3 studio(vec3 d, float rough){
  float c=cos(uEnvRot), s=sin(uEnvRot);
  d=vec3(c*d.x+s*d.z, d.y, -s*d.x+c*d.z);
  float sf=0.012+rough*0.55;
  vec3 col=vec3(0.0);
  vec3 kc=normalize(vec3(-0.55,0.62,0.56));
  float k=softRect(d,kc,vec2(0.42,0.26),sf);
  float kin=softRect(d,kc,vec2(0.30,0.17),sf+0.12);
  col+=uEnvW.x*(0.75*k+0.35*kin)*vec3(1.0,0.965,0.92);
  col+=uEnvW.y*softRect(d,normalize(vec3(0.9,0.12,-0.42)),vec2(0.045,0.75),sf*0.7)*vec3(0.88,0.94,1.0);
  col+=uEnvW.y*0.55*softRect(d,normalize(vec3(-0.92,0.25,-0.32)),vec2(0.035,0.6),sf*0.7)*vec3(1.0,0.95,0.9);
  col+=uEnvW.z*softRect(d,normalize(vec3(0.0,0.35,1.0)),vec2(0.24,0.11),sf)*vec3(1.0,0.98,0.95);
  col+=uEnvW2.x*softRect(d,normalize(vec3(-0.75,0.08,0.66)),vec2(0.16,0.95),sf)*vec3(1.0,0.97,0.93);
  col+=uEnvW2.y*softRect(d,normalize(vec3(0.8,0.05,0.6)),vec2(0.09,0.9),sf)*vec3(0.92,0.95,1.0);
  col+=uEnvW2.z*softRect(d,normalize(vec3(0.0,1.0,0.12)),vec2(0.55,0.55),sf+0.1);
  col+=uEnvW.w*(0.35+0.65*smoothstep(-0.4,1.0,d.y))*vec3(0.9,0.92,1.0);
  return col;
}
float schlick(float f0, float c){ return f0+(1.0-f0)*pow(1.0-clamp(c,0.0,1.0),5.0); }
vec3 schlick3(vec3 f0, float c){ return f0+(1.0-f0)*pow(1.0-clamp(c,0.0,1.0),5.0); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h)-r; }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float sdRoundBox2(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
uniform vec3 uCam; uniform vec3 uTgt; uniform float uF; uniform float uFocus; uniform float uAper;
vec3 camRay(out vec3 fw){
  vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  fw=normalize(uTgt-uCam); vec3 rt=normalize(cross(fw,vec3(0,1,0))); vec3 up=cross(rt,fw);
  return normalize(fw*uF+p.x*rt+p.y*up);
}
float cocOf(float z){ return clamp(uAper*(z-uFocus)/max(z,1e-3), -60.0*uSS, 60.0*uSS); }
`;

  // ------------------------------------------------------------ prologue
  const prologue = `
uniform vec3 uC; uniform vec3 uR; uniform float uGlow;
void main(){
  vec3 fw; vec3 rd=camRay(fw);
  vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec2 g=p-vec2(0.06,0.10);
  vec3 bg=vec3(0.0035,0.0033,0.0038)+vec3(0.022,0.017,0.012)*exp(-dot(g,g)*4.0)*uGlow;
  vec3 oc=(uCam-uC)/uR, d=rd/uR;
  float a=dot(d,d), b=dot(oc,d), c=dot(oc,oc)-1.0;
  float tc=-b/a; vec3 cp=oc+d*tc; float dm=length(cp);
  float ravg=(uR.x+uR.y+uR.z)/3.0;
  float foot=tc/(uRes.y*uF);
  float edge=(dm-1.0)*ravg/foot;
  float cov=clamp(0.5-edge,0.0,1.0);
  vec3 col=bg;
  if(cov>0.0){
    vec3 sp;
    float disc=b*b-a*c;
    if(disc>0.0){ float t=(-b-sqrt(disc))/a; sp=oc+d*t; } else sp=cp/dm;
    vec3 n=normalize(sp/uR);
    vec3 v=-rd; float nv=max(dot(n,v),0.0);
    vec3 R=reflect(rd,n);
    float F=schlick(0.045,nv);
    vec3 L=normalize(vec3(-0.5,0.6,0.6));
    vec3 c2=F*studio(R,0.05)+vec3(0.00012)*max(dot(n,L),0.0)*uEnvW.x;
    col=mix(bg,c2,cov);
  }
  oCol=vec4(col,0.0);
}`;

  // ------------------------------------------------------------ ink
  const ink = `
uniform vec2 uC; uniform float uS;
uniform vec4 uD[48]; uniform vec4 uDB[48]; uniform int uN;
uniform float uHc; uniform float uH0;
const vec3 LD=vec3(-0.5,0.55,0.68);
vec3 inkField(vec2 q, float px){
  float h=0.0, cov=0.0, wet=0.0;
  for(int i=0;i<48;i++){
    if(i>=uN) break;
    vec4 d=uD[i]; float tau=uT-d.w;
    if(tau<0.0) continue;
    vec2 dv=q-d.xy; float dist=length(dv);
    if(dist>d.z*2.3+0.04) continue;
    float s=1.0-exp(-tau*24.0);
    float r=d.z*(s+0.075*exp(-tau*5.0)*sin(tau*32.0)*s);
    vec2 dir=dv/max(dist,1e-5);
    float rag=(vnoise(dir*2.6+d.xy*7.1)-0.5)*0.055+(vnoise(dir*7.0+d.xy*3.3)-0.5)*0.02+(vnoise(q*48.0)-0.5)*0.016;
    float re=r*(1.0+rag*s);
    float x=dist/max(r*1.02,1e-4);
    float w=exp(-tau/2.3);
    float hm=d.z*(0.035+0.17*w);
    float hi=hm*sqrt(max(0.0,1.0-x*x));
    float ed=px*1.1+0.0035*d.z;
    float ci=smoothstep(re+ed,re-ed,dist);
    float u=tau/0.17;
    if(u<1.0 && uDB[i].y<0.5){
      float rc=d.z*(0.95+0.85*u); float rw=0.06*d.z*(1.0-0.5*u)+px*0.5;
      float ring=exp(-pow((dist-rc)/rw,2.0));
      hi=max(hi,0.10*d.z*(1.0-u)*ring); ci=max(ci,smoothstep(0.25,0.6,ring*(1.0-u)));
    }
    if(hi>h){ h=hi; wet=w; }
    cov=max(cov,ci);
  }
  return vec3(h,cov,wet);
}
void main(){
  float px=1.0/uS;
  vec2 q=uC+(gl_FragCoord.xy-0.5*uRes)/uS;
  vec3 L=normalize(LD);
  // paper: warm cotton stock, fibres under raking light
  float e0=max(px*0.8,0.0025);
  float ph=fbm(q*46.0)*0.6+vnoise(rot2(0.7)*q*vec2(160.0,22.0))*0.25+vnoise(rot2(-1.1)*q*vec2(140.0,20.0))*0.25;
  float phx=fbm((q+vec2(e0,0.0))*46.0)*0.6+vnoise(rot2(0.7)*(q+vec2(e0,0.0))*vec2(160.0,22.0))*0.25+vnoise(rot2(-1.1)*(q+vec2(e0,0.0))*vec2(140.0,20.0))*0.25;
  float phy=fbm((q+vec2(0.0,e0))*46.0)*0.6+vnoise(rot2(0.7)*(q+vec2(0.0,e0))*vec2(160.0,22.0))*0.25+vnoise(rot2(-1.1)*(q+vec2(0.0,e0))*vec2(140.0,20.0))*0.25;
  vec3 pn=normalize(vec3(-(phx-ph)/e0*0.0045,-(phy-ph)/e0*0.0045,1.0));
  vec3 alb=vec3(0.95,0.932,0.89)*(0.965+0.06*fbm(q*9.0))*(0.99+0.02*ph);
  vec3 paper=alb*(0.30+0.80*max(dot(pn,L),0.0));
  // ink
  vec3 F=inkField(q,px);
  float e=max(px*0.75,0.002);
  float hx=inkField(q+vec2(e,0.0),px).x, hy=inkField(q+vec2(0.0,e),px).x;
  vec3 n=normalize(vec3(-(hx-F.x)/e,-(hy-F.x)/e,1.0));
  vec3 R=reflect(vec3(0.0,0.0,-1.0),n);
  float Fr=schlick(0.05,n.z);
  vec3 inkAlb=vec3(0.016,0.017,0.025);
  vec3 spec=Fr*studio(R,mix(0.3,0.02,F.z))*mix(0.1,1.0,F.z);
  vec3 inkC=inkAlb*(0.3+0.8*max(dot(n,L),0.0))+spec;
  // a faint capillary halo where ink wicks into the fibres
  vec3 col=mix(paper,inkC,F.y);
  // falling drops + their shadows
  float shadow=0.0, bestH=-1.0, dropA=0.0, dropCoc=0.0; vec3 dropC=vec3(0.0);
  for(int i=0;i<48;i++){
    if(i>=uN) break;
    vec4 d=uD[i]; vec4 b=uDB[i];
    if(b.y>0.5) continue;
    float tau=uT-d.w;
    if(tau>=0.0 || tau< -b.x) continue;
    float fz=1.0+tau/b.x; float hgt=uH0*(1.0-fz*fz);
    float k=uHc/(uHc-hgt);
    vec2 cp=uC+(d.xy-uC)*k; float rp=d.z*0.8*k;
    vec2 sp=d.xy-L.xy/L.z*hgt*0.35; float sr=d.z*0.8*(1.0+hgt*0.15); float soft=0.02+hgt*0.12;
    shadow=max(shadow,(1.0-smoothstep(sr-soft,sr+soft,length(q-sp)))*0.42*exp(-hgt*0.45));
    float dd=length(q-cp);
    float a=smoothstep(rp+px,rp-px,dd);
    if(a>0.0 && hgt>bestH){
      bestH=hgt;
      vec2 lp=(q-cp)/rp; float z=sqrt(max(0.0,1.0-dot(lp,lp)));
      vec3 nn=normalize(vec3(lp,z));
      vec3 R2=reflect(vec3(0.0,0.0,-1.0),nn);
      dropC=vec3(0.012,0.012,0.018)*(0.3+0.7*max(dot(nn,L),0.0))+schlick(0.05,nn.z)*studio(R2,0.02);
      dropA=a; dropCoc=-uAper*(k-1.0);
    }
  }
  col*=1.0-shadow;
  col=mix(col,dropC,dropA);
  oCol=vec4(col,clamp(dropCoc*dropA,-60.0*uSS,0.0));
}`;

  // ------------------------------------------------------------ music box
  const musicbox = `
uniform sampler2D uPin;
uniform float uNCol, uNRow, uA, uRc, uDth, uRot, uThc, uPinLen;
uniform float uDefl[16];
float hH(){ return uNRow*uA*0.5+0.11; }
vec2 map(vec3 p){
  float hh=hH();
  float rho=length(p.xz);
  vec2 dd=abs(vec2(rho,p.y))-vec2(uRc-0.025,hh-0.025);
  float drum=min(max(dd.x,dd.y),0.0)+length(max(dd,0.0))-0.025;
  // engraved rings near the rims
  drum+=0.0016*smoothstep(0.004,0.0,abs(abs(p.y)-(hh-0.05)))*step(uRc-0.01,rho);
  vec2 res=vec2(drum,1.0);
  // pins
  float pinsD;
  float bnd=max(rho-(uRc+uPinLen+0.05),abs(p.y)-hh);
  if(bnd>0.02) pinsD=bnd;
  else{
    pinsD=1e3;
    float th=atan(p.x,p.z);
    float u=(th+uRot)/uDth; float v=p.y/uA+(uNRow-1.0)*0.5;
    float ju=floor(u+0.5), iv=floor(v+0.5);
    for(int dj=-1;dj<=1;dj++) for(int di=-1;di<=1;di++){
      float i=iv+float(di); if(i<0.0||i>uNRow-1.0) continue;
      float j=ju+float(dj);
      float jm=mod(j,uNCol);
      float r=texelFetch(uPin,ivec2(int(jm),int(i)),0).r;
      if(r<=0.0) continue;
      float ang=j*uDth-uRot;
      vec3 dir=vec3(sin(ang),0.0,cos(ang));
      vec3 off=vec3(0.0,(i-(uNRow-1.0)*0.5)*uA,0.0);
      pinsD=min(pinsD,sdCapsule(p,dir*(uRc-0.02)+off,dir*(uRc+uPinLen-r)+off,r));
    }
  }
  if(pinsD<res.x) res=vec2(pinsD,2.0);
  // comb
  vec3 dc=vec3(sin(uThc),0.0,cos(uThc)), tcv=vec3(cos(uThc),0.0,-sin(uThc));
  float s=dot(p,dc), w=dot(p,tcv);
  float r0=uRc+uPinLen*0.45, r1=uRc+0.85;
  float cb=max(max(abs(s-(r0+r1+0.36)*0.5)-(r1-r0+0.36)*0.5,abs(p.y)-hh),abs(w)-0.11);
  float comb;
  if(cb>0.03) comb=cb;
  else{
    comb=1e3;
    float v2=p.y/uA+(uNRow-1.0)*0.5; float iv2=clamp(floor(v2+0.5),0.0,uNRow-1.0);
    for(int di=-1;di<=1;di++){
      float i=iv2+float(di); if(i<0.0||i>uNRow-1.0) continue;
      float yi=(i-(uNRow-1.0)*0.5)*uA;
      float df=uDefl[int(i)];
      float sl=clamp((r1-s)/(r1-r0),0.0,1.0);
      vec3 q=vec3(s-(r0+r1)*0.5,p.y-yi,w-df*sl*sl);
      comb=min(comb,sdBox(q,vec3((r1-r0)*0.5,uA*0.30,0.006))-0.0015);
    }
    comb=min(comb,sdBox(vec3(s-(r1+0.11),p.y,w),vec3(0.12,hh-0.07,0.045))-0.008);
  }
  if(comb<res.x) res=vec2(comb,3.0);
  return res;
}
vec3 calcN(vec3 p, float e){
  vec2 k=vec2(1,-1);
  return normalize(k.xyy*map(p+k.xyy*e).x+k.yyx*map(p+k.yyx*e).x+k.yxy*map(p+k.yxy*e).x+k.xxx*map(p+k.xxx*e).x);
}
float calcAO(vec3 p, vec3 n){
  float o=0.0, sc=1.0;
  for(int i=1;i<=5;i++){ float h=0.006+0.022*float(i); o+=(h-map(p+n*h).x)*sc; sc*=0.72; }
  return clamp(1.0-2.6*o,0.0,1.0);
}
void main(){
  vec3 fw; vec3 rd=camRay(fw);
  vec2 sp=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec3 ro=uCam;
  vec3 bg=vec3(0.0025,0.0023,0.0022)+vec3(0.014,0.010,0.007)*exp(-dot(sp-vec2(0.1,0.05),sp-vec2(0.1,0.05))*3.0);
  // bounding sphere
  float br=uRc+1.6; vec3 oc=ro; float bb=dot(oc,rd); float bc=dot(oc,oc)-br*br; float bh=bb*bb-bc;
  vec3 col=bg; float coc=cocOf(60.0);
  if(bh>0.0){
    float t=max(0.0,-bb-sqrt(bh)), tmax=-bb+sqrt(bh);
    float m=-1.0;
    for(int i=0;i<220;i++){
      vec2 h=map(ro+rd*t);
      if(h.x<0.00025*t+0.00004){ m=h.y; break; }
      t+=h.x*0.85;
      if(t>tmax) break;
    }
    if(m>0.0){
      vec3 p=ro+rd*t;
      vec3 n=calcN(p,0.0003*t+0.00005);
      vec3 v=-rd; float nv=max(dot(n,v),0.0);
      vec3 F0; float rough;
      if(m<1.5){
        // turned brass: lathe lines read as fine bands in the reflections
        float ln=vnoise(vec2(p.y*900.0,0.5))*0.6+vnoise(vec2(p.y*2600.0,3.0))*0.4;
        n=normalize(n+vec3(0.0,(ln-0.5)*0.05,0.0)*step(abs(p.y),hH()-0.03));
        F0=vec3(0.95,0.75,0.40)*(0.9+0.12*ln); rough=0.11+0.1*ln;
        if(n.y>0.9){ float rr=length(p.xz); float rl=vnoise(vec2(rr*700.0,1.5))*0.6+vnoise(vec2(rr*2300.0,7.0))*0.4;
          n=normalize(n+vec3(p.x/rr,0.0,p.z/rr)*(rl-0.5)*0.08); rough=0.1+0.08*rl; }
      } else if(m<2.5){ F0=vec3(0.86,0.86,0.88); rough=0.05; }
      else if(m<3.5){ F0=vec3(0.50,0.56,0.70); rough=0.07; }
      else { F0=vec3(0.80,0.80,0.82); rough=0.18; }
      vec3 R=reflect(rd,n);
      float ao=calcAO(p,n);
      col=schlick3(F0,nv)*studio(R,rough);
      col+=F0*uEnvW.w*0.12*(0.4+0.6*max(n.y,0.0));
      col*=ao;
      coc=cocOf(t*dot(rd,fw));
    }
  }
  oCol=vec4(col,coc);
}`;

  // ------------------------------------------------------------ punch card
  const card = `
uniform sampler2D uHoles; uniform sampler2D uPrint;
uniform vec2 uGrid; uniform vec2 uGrid0; uniform float uP; uniform vec3 uCardB;
uniform float uSlide; uniform float uMorph; uniform float uHaze; uniform float uBack;
const float THICK=0.016;
float holeOne(vec2 g, vec2 id){
  if(id.x<0.0||id.y<0.0||id.x>uGrid.x-1.0||id.y>uGrid.y-1.0) return 1.0;
  vec4 h=texelFetch(uHoles,ivec2(id),0);
  if(h.y<0.5) return 1.0;
  vec2 lc=(g-id)*uP;
  vec2 hsR=vec2(0.19,0.36)*uP; float crR=0.03*uP;
  float rr=h.x*uP;
  float m=clamp(uMorph,0.0,1.25);
  vec2 hs=mix(hsR,vec2(rr),m);
  float cr=min(mix(crR,rr,clamp(m,0.0,1.0)),min(hs.x,hs.y));
  return sdRoundBox2(lc,hs,cr);
}
// the ball holes are wider than their cell, so test the 2×2 nearest cells
float holeSD(vec2 c){
  vec2 g=(c-uGrid0)/uP; vec2 i0=floor(g);
  return min(min(holeOne(g,i0),holeOne(g,i0+vec2(1,0))),min(holeOne(g,i0+vec2(0,1)),holeOne(g,i0+vec2(1,1))));
}
float cardSD(vec2 c){
  float hw=uCardB.x, top=uCardB.y, bot=uCardB.z;
  vec2 cen=vec2(0.0,(top+bot)*0.5), hs=vec2(hw,(top-bot)*0.5);
  float d=sdRoundBox2(c-cen,hs,0.07);
  vec2 n=normalize(vec2(-1.0,1.0));
  return max(d,dot(c-vec2(-hw+0.36,top),n));
}
void main(){
  vec3 fw; vec3 rd=camRay(fw);
  float pixAng=1.0/(uRes.y*uF);
  vec3 backC=vec3(1.0,0.84,0.62);
  vec3 col=vec3(0.003,0.0028,0.0026); float coc=cocOf(40.0);
  float tC=-uCam.z/rd.z;
  bool hit=rd.z<0.0 && tC>0.0;
  float tEnd=12.0;
  if(hit){
    tEnd=tC;
    vec3 P=uCam+rd*tC; vec2 c=P.xy-vec2(uSlide,0.0);
    float pw=tC*pixAng/max(abs(rd.z),0.2);
    float cs=cardSD(c);
    float cardA=smoothstep(pw,-pw,cs);
    float hf=holeSD(c);
    vec3 Pb=P+rd*(THICK/max(abs(rd.z),0.04)); float hb=holeSD(Pb.xy-vec2(uSlide,0.0));
    float inF=smoothstep(pw,-pw,hf), inB=smoothstep(pw,-pw,hb);
    vec2 uvp=vec2((c.x+uCardB.x)/(2.0*uCardB.x),(c.y-uCardB.z)/(uCardB.y-uCardB.z));
    vec4 pr=texture(uPrint,uvp);
    float fib=fbm(c*38.0)*0.7+vnoise(rot2(0.4)*c*vec2(220.0,40.0))*0.3;
    vec3 manila=vec3(0.87,0.78,0.57)*(0.92+0.12*fib);
    float near=exp(-max(hf,0.0)/(0.3*uP));
    vec3 surf=manila*(0.004+0.0085*uBack*(0.55+0.45*fib)+0.03*uBack*near);
    surf+=manila*0.022*smoothstep(-1.0,1.0,dot(fw,vec3(0.0,0.0,-1.0)));
    surf*=1.0-0.78*pr.a;
    vec3 thru=backC*uBack*2.4;
    vec3 wall=manila*backC*uBack*0.20;
    vec3 holeCol=mix(wall,thru,inB);
    vec3 cardCol=mix(surf,holeCol,inF);
    float rim=exp(-max(cs,0.0)/0.035);
    vec3 outside=col+backC*uBack*0.06*rim;
    col=mix(outside,cardCol,cardA);
    coc=cocOf(tC*dot(rd,fw));
  }
  // light shafts through the holes, in a faint haze in front of the card
  vec3 Ld=normalize(vec3(0.20,0.28,1.0));
  float acc=0.0;
  float jit=h12(gl_FragCoord.xy*0.731+3.1);
  float tz=min(tEnd,9.0);
  for(int i=0;i<44;i++){
    float t=(float(i)+jit)/44.0*tz;
    vec3 s=uCam+rd*t;
    if(s.z<0.0||s.z>2.6) continue;
    vec2 qq=s.xy-Ld.xy*(s.z/Ld.z)-vec2(uSlide,0.0);
    float bl=0.004+s.z*0.035;
    acc+=smoothstep(bl,-bl,holeSD(qq))*exp(-s.z*1.1);
  }
  acc*=tz/44.0;
  float cosT=dot(Ld,-rd); float g=0.6;
  float phase=(1.0-g*g)/pow(1.0+g*g-2.0*g*cosT,1.5)/(4.0*PI);
  col+=backC*uBack*uHaze*acc*phase*2.2;
  oCol=vec4(col,coc);
}`;

  // ------------------------------------------------------------ inkjet
  const jet = `
uniform sampler2D uJet; uniform sampler2D uPrim;
uniform vec2 uJGrid; uniform float uPj; uniform float uX0;
uniform int uND; uniform int uNT;
uniform float uTau; uniform float uHead; uniform float uYN; uniform float uStrobe; uniform float uPool;
const vec3 VIO=vec3(0.40,0.24,0.86);
float iSphere(vec3 ro, vec3 rd, vec4 s){ vec3 oc=ro-s.xyz; float b=dot(oc,rd); float c=dot(oc,oc)-s.w*s.w; float h=b*b-c; if(h<0.0) return -1.0; return -b-sqrt(h); }
float iCapsule(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r){
  vec3 ba=pb-pa, oa=ro-pa;
  float baba=dot(ba,ba), bard=dot(ba,rd), baoa=dot(ba,oa), rdoa=dot(rd,oa), oaoa=dot(oa,oa);
  float a=baba-bard*bard, b=baba*rdoa-baoa*bard, c=baba*oaoa-baoa*baoa-r*r*baba;
  float h=b*b-a*c;
  if(h>=0.0){
    float t=(-b-sqrt(h))/a; float y=baoa+t*bard;
    if(y>0.0&&y<baba) return t;
    vec3 oc=(y<=0.0)?oa:ro-pb; b=dot(rd,oc); c=dot(oc,oc)-r*r; h=b*b-c;
    if(h>0.0) return -b-sqrt(h);
  }
  return -1.0;
}
vec2 iBox(vec3 ro, vec3 rd, vec3 c, vec3 hs, out vec3 nrm){
  vec3 m=1.0/rd; vec3 n=m*(ro-c); vec3 k=abs(m)*hs;
  vec3 t1=-n-k, t2=-n+k;
  float tN=max(max(t1.x,t1.y),t1.z), tF=min(min(t2.x,t2.y),t2.z);
  if(tN>tF||tF<0.0) return vec2(-1.0);
  nrm=-sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);
  return vec2(tN,tF);
}
vec3 dropShade(vec3 n, vec3 rd){
  float nv=max(dot(n,-rd),0.0);
  vec3 refl=schlick(0.04,nv)*studio(reflect(rd,n),0.02);
  float rim=pow(1.0-nv,2.2);
  float caust=pow(max(dot(n,normalize(vec3(0.25,-0.45,1.0))),0.0),14.0);
  vec3 body=VIO*(0.035+rim*0.9*uStrobe)+mix(VIO,vec3(1.0),0.35)*caust*2.6;
  return body+refl;
}
void main(){
  vec3 fw; vec3 rd=camRay(fw);
  vec3 ro=uCam;
  float tBest=1e9; vec3 col=vec3(0.0); int kind=0; vec3 nB=vec3(0.0);
  // paper y=0
  if(rd.y<0.0){ float t=-ro.y/rd.y; if(t<tBest){ tBest=t; kind=1; } }
  // print head
  vec3 hn; vec2 hb=iBox(ro,rd,vec3(uHead,0.80,0.0),vec3(0.16,0.18,0.64),hn);
  if(hb.x>0.0 && hb.x<tBest){ tBest=hb.x; kind=2; nB=hn; }
  // carriage rail
  { vec2 o=ro.yz-vec2(0.84,-0.98); vec2 d=rd.yz; float a=dot(d,d), b=dot(o,d), c=dot(o,o)-0.032*0.032; float h=b*b-a*c;
    if(h>0.0){ float t=(-b-sqrt(h))/a; if(t>0.0&&t<tBest){ tBest=t; kind=3; vec3 p=ro+rd*t; nB=normalize(vec3(0.0,p.y-0.84,p.z+0.98)); } } }
  // droplets
  for(int i=0;i<160;i++){
    if(i>=uND) break;
    vec4 s=texelFetch(uPrim,ivec2(i,0),0);
    float t=iSphere(ro,rd,s);
    if(t>0.0&&t<tBest){ tBest=t; kind=4; nB=normalize(ro+rd*t-s.xyz); }
  }
  for(int i=0;i<160;i++){
    if(i>=uNT) break;
    vec4 a=texelFetch(uPrim,ivec2(i,1),0); vec4 b=texelFetch(uPrim,ivec2(i,2),0);
    float t=iCapsule(ro,rd,a.xyz,b.xyz,a.w);
    if(t>0.0&&t<tBest){ tBest=t; kind=4; vec3 p=ro+rd*t; vec3 ba=b.xyz-a.xyz, pa=p-a.xyz; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); nB=normalize(pa-h*ba); }
  }
  vec3 p=ro+rd*tBest;
  float coc=cocOf(60.0);
  if(kind==1){
    vec2 xz=p.xz;
    float pool=exp(-(pow(xz.x-mix(uHead,0.0,smoothstep(0.6,2.4,uPool))-0.1,2.0)/(uPool*uPool*1.1)+pow(xz.y+0.05,2.0)/(0.35+uPool*0.45)));
    float lightI=(0.006+mix(0.95,0.62,smoothstep(1.0,2.6,uPool))*pool)*mix(1.0,uStrobe,0.6);
    vec3 alb=vec3(0.90,0.895,0.885)*(0.97+0.05*fbm(xz*30.0));
    // landed ink
    vec3 n=vec3(0.0,1.0,0.0); float cov=0.0, wet=0.0;
    float pw=tBest/(uRes.y*uF)/max(abs(rd.y),0.15);
    vec2 gq=vec2((xz.x-uX0)/uPj,5.0-xz.y/uPj); vec2 gi=floor(gq);
    for(int k=0;k<4;k++){
    float col_=gi.x+float(k&1), row=gi.y+float(k>>1);
    if(col_>=0.0&&row>=0.0&&col_<uJGrid.x&&row<uJGrid.y){
      vec4 g=texelFetch(uJet,ivec2(int(col_),int(row)),0);
      if(g.w>0.5 && uTau>=g.y){
        float s=uTau-g.y;
        float r=g.x*(1.0-exp(-s*45.0))*(1.0+0.05*exp(-s*8.0)*sin(s*60.0));
        vec2 cc=vec2(uX0+col_*uPj,-(row-5.0)*uPj);
        vec2 dv=xz-cc; float dist=length(dv);
        r*=1.0+(vnoise(xz*400.0)-0.5)*0.05;
        float cv=smoothstep(r+pw,r-pw,dist);
        if(cv>cov){
          cov=cv; wet=exp(-s*1.4);
          float x=clamp(dist/max(r,1e-4),0.0,0.999);
          vec2 sl=dv/max(r,1e-4)*x/sqrt(1.0-x*x)*0.18*(0.3+wet);
          n=normalize(vec3(-sl.x,1.0,-sl.y));
        }
      }
    }
    }
    vec3 base=mix(alb,VIO*vec3(0.62,0.55,0.66),cov);
    col=base*lightI;
    col+=cov*wet*schlick(0.04,dot(n,-rd))*studio(reflect(rd,n),0.04)*0.8;
    coc=cocOf(tBest*dot(rd,fw));
  } else if(kind==2){
    vec3 lp=p-vec3(uHead,0.80,0.0);
    vec3 hs=vec3(0.16,0.18,0.64);
    vec3 dE=hs-abs(lp);
    float e1=min(min(dE.x+dE.y*step(0.5,abs(nB.z))*9.0,1e3),1e3);
    // distance to the nearest edge of the face we hit
    float edge=1e3;
    if(abs(nB.x)>0.5) edge=min(dE.y,dE.z); else if(abs(nB.y)>0.5) edge=min(dE.x,dE.z); else edge=min(dE.x,dE.y);
    float bev=smoothstep(0.012,0.0,edge);
    vec3 n=normalize(nB+(abs(nB.x)>0.5?vec3(0.0,sign(lp.y),sign(lp.z))*0.0:vec3(0.0))*0.0);
    vec3 bc=vec3(0.012,0.012,0.014)+schlick(0.25,dot(n,-rd))*studio(reflect(rd,n),0.3)*0.6;
    vec3 bn=normalize(nB+normalize(vec3(sign(lp.x)*step(dE.x,0.012),sign(lp.y)*step(dE.y,0.012),sign(lp.z)*step(dE.z,0.012))+1e-4)*0.9);
    bc=mix(bc,schlick3(vec3(0.8),dot(bn,-rd))*studio(reflect(rd,bn),0.06),bev);
    if(nB.y<-0.5){
      // nozzle plate: a row of orifices, violet menisci
      float zr=lp.z/uPj+5.0; float zi=floor(zr+0.5);
      float dn=length(vec2(lp.x,(zr-zi)*uPj));
      float noz=smoothstep(0.012,0.008,dn)*step(-0.5,zi)*step(zi,10.5);
      bc=mix(bc,VIO*0.35+studio(reflect(rd,vec3(0,-1,0)),0.02)*0.04,noz);
    }
    // a hairline of violet light along the front lower edge
    if(nB.z>0.5) bc+=VIO*2.2*smoothstep(0.004,0.0,abs(lp.y+0.15))*step(abs(lp.x),0.13);
    col=bc;
    coc=cocOf(tBest*dot(rd,fw));
  } else if(kind==3){
    col=schlick3(vec3(0.85),dot(nB,-rd))*studio(reflect(rd,nB),0.04)*0.9;
    coc=cocOf(tBest*dot(rd,fw));
  } else if(kind==4){
    col=dropShade(nB,rd);
    coc=cocOf(tBest*dot(rd,fw));
  }
  oCol=vec4(col,coc);
}`;

  // ------------------------------------------------------------ light (instanced discs)
  const lightVS = `#version 300 es
layout(location=0) in vec4 aI;
layout(location=1) in vec4 aC;
uniform vec2 uRes;
out vec4 vI; out vec4 vC;
void main(){
  vec2 corner=vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1))*2.0-1.0;
  float ext=aI.z+2.5;
  vec2 pos=aI.xy+corner*ext;
  vI=aI; vC=aC;
  vec2 ndc=pos/uRes*2.0-1.0; ndc.y=-ndc.y;
  gl_Position=vec4(ndc,0.0,1.0);
}`;
  const lightFS = `#version 300 es
precision highp float;
in vec4 vI; in vec4 vC;
uniform vec2 uRes;
out vec4 o;
float disc(vec2 d, float R, float e){ return smoothstep(R+e,R-e,length(d)); }
void main(){
  vec2 fc=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 d=fc-vI.xy; float R=vI.z; float L=length(d);
  float e=max(0.65,R*0.03);
  vec2 off=-(vI.xy-0.5*uRes)/(0.5*uRes.x)*R*0.6*vC.a;
  float big=step(6.0,R);
  float mr=disc(d,R*mix(1.0,1.012,big),e)*mix(1.0,disc(d-off,R*1.012,e),big);
  float mg=disc(d,R,e)*mix(1.0,disc(d-off,R,e),big);
  float mb=disc(d,R*mix(1.0,0.988,big),e)*mix(1.0,disc(d-off,R*0.988,e),big);
  float rim=1.0+0.6*smoothstep(R*0.6,R,L)*big;
  float onion=1.0+0.05*sin(L/max(R,1.0)*36.0)*step(10.0,R);
  vec3 col=vC.rgb*vI.w*rim*onion*vec3(mr,mg,mb);
  o=vec4(col,0.0);
}`;

  // ------------------------------------------------------------ post
  const postHead = `#version 300 es
precision highp float;
out vec4 o;
`;
  const dof = postHead + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uMaxR; uniform float uStep;
void main(){
  vec2 uv=gl_FragCoord.xy*uTexel;
  vec4 c0=texture(uSrc,uv);
  float cs=abs(c0.a);
  vec3 col=c0.rgb; float tot=1.0;
  float radius=1.0, ang=0.0;
  for(int i=0;i<640;i++){
    if(radius>=uMaxR) break;
    vec2 tc=uv+vec2(cos(ang),sin(ang))*uTexel*radius;
    vec4 s=texture(uSrc,tc);
    float ss=abs(s.a);
    if(s.a>c0.a) ss=clamp(ss,0.0,cs*2.0);
    float m=smoothstep(radius-0.5,radius+0.5,ss);
    col+=mix(col/tot,s.rgb,m);
    tot+=1.0;
    radius+=uStep/radius;
    ang+=2.39996323;
  }
  o=vec4(col/tot,c0.a);
}`;
  const down = postHead + `
uniform sampler2D uSrc; uniform vec2 uTexel;
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0)*uTexel;
  vec2 t=uTexel;
  vec3 a=texture(uSrc,uv+t*vec2(-2,2)).rgb, b=texture(uSrc,uv+t*vec2(0,2)).rgb, c=texture(uSrc,uv+t*vec2(2,2)).rgb;
  vec3 d=texture(uSrc,uv+t*vec2(-2,0)).rgb, e=texture(uSrc,uv).rgb, f=texture(uSrc,uv+t*vec2(2,0)).rgb;
  vec3 g=texture(uSrc,uv+t*vec2(-2,-2)).rgb, h=texture(uSrc,uv+t*vec2(0,-2)).rgb, i=texture(uSrc,uv+t*vec2(2,-2)).rgb;
  vec3 j=texture(uSrc,uv+t*vec2(-1,1)).rgb, k=texture(uSrc,uv+t*vec2(1,1)).rgb, l=texture(uSrc,uv+t*vec2(-1,-1)).rgb, m=texture(uSrc,uv+t*vec2(1,-1)).rgb;
  vec3 r=e*0.125+(a+c+g+i)*0.03125+(b+d+f+h)*0.0625+(j+k+l+m)*0.125;
  o=vec4(min(r,vec3(64.0)),1.0);
}`;
  const up = postHead + `
uniform sampler2D uSrc; uniform vec2 uTexel;
void main(){
  vec2 uv=(gl_FragCoord.xy*0.5)*uTexel;
  vec2 t=uTexel;
  vec3 s=texture(uSrc,uv).rgb*4.0;
  s+=(texture(uSrc,uv+vec2(t.x,0)).rgb+texture(uSrc,uv-vec2(t.x,0)).rgb+texture(uSrc,uv+vec2(0,t.y)).rgb+texture(uSrc,uv-vec2(0,t.y)).rgb)*2.0;
  s+=texture(uSrc,uv+t).rgb+texture(uSrc,uv-t).rgb+texture(uSrc,uv+vec2(t.x,-t.y)).rgb+texture(uSrc,uv+vec2(-t.x,t.y)).rgb;
  o=vec4(s/16.0,1.0);
}`;
  const mix = postHead + `
uniform sampler2D uA; uniform sampler2D uB; uniform float uW;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); o=mix(texelFetch(uA,p,0),texelFetch(uB,p,0),uW); }`;
  const scale = postHead + `
uniform sampler2D uSrc; uniform float uW;
void main(){ o=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0)*uW; }`;
  const comp = postHead + `
uniform sampler2D uImg; uniform sampler2D uBloom;
uniform vec2 uRes; uniform float uSS;
uniform float uExpo, uBloomK, uVig, uGrain, uFade, uFrame; uniform vec3 uFadeCol;
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec3 c;
  if(uSS>1.5){ vec2 t=0.25/uRes; c=0.25*(texture(uImg,uv+vec2(-t.x,-t.y)).rgb+texture(uImg,uv+vec2(t.x,-t.y)).rgb+texture(uImg,uv+vec2(-t.x,t.y)).rgb+texture(uImg,uv+vec2(t.x,t.y)).rgb); }
  else c=texture(uImg,uv).rgb;
  c+=texture(uBloom,uv).rgb*uBloomK;
  c*=uExpo;
  vec2 q=(uv-0.5)*vec2(1.0,0.5625)*2.0;
  float v=1.0-dot(q,q)*0.42;
  c*=mix(1.0,clamp(v,0.0,1.0),uVig);
  c=aces(c);
  c=pow(c,vec3(1.0/2.2));
  float n=h12(gl_FragCoord.xy+vec2(uFrame*13.13,uFrame*7.77))+h12(gl_FragCoord.xy*1.37+vec2(uFrame*3.1,uFrame*11.9))-1.0;
  c+=n*uGrain*(0.6+0.4*(1.0-c));
  c=mix(c,uFadeCol,uFade);
  o=vec4(c,1.0);
}`;

  return { vsFull, common, prologue, ink, musicbox, card, jet, lightVS, lightFS, dof, down, up, mix, scale, comp };
})();
