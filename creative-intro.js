/* Clear liquid-glass WebGL mesh: local, procedural, with no external dependencies. */
(()=>{
'use strict';
const root=document.documentElement,intro=document.getElementById('creative-intro'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const details=document.querySelector('.education details');
details?.querySelectorAll('.study-list li').forEach((li,i)=>{li.style.setProperty('--study-index',i);li.addEventListener('pointermove',e=>{if(!reduced.matches)li.style.setProperty('--study-x',`${e.clientX-li.getBoundingClientRect().left}px`);},{passive:true});});
details?.addEventListener('toggle',()=>{const content=details.querySelector('.skills');content.classList.remove('reveal-studies');if(details.open)requestAnimationFrame(()=>content.classList.add('reveal-studies'));});
// Preserve deep links. The introduction appears when opening the home view.
if(!intro||(location.hash&&location.hash!=='#space'))return;
const orb=document.getElementById('liquid-orb'),canvas=document.getElementById('orb-canvas'),skip=document.getElementById('skip-intro'),hint=document.getElementById('orb-hint');
let holding=false,progress=0,opening=false,finished=false,frame=0,last=0,time=0;
let pointer=[0,0],target=[0,0],hover=0,hoverTarget=0,activePointer=null,holdStart=null;
let touch=[0,0,1],trail=[0,0,1],energy=0,impulse=0,pointerStamp=0,pointerInside=false;
// Project the cursor onto the visible sphere so ripples start under the pointer.
function surfacePoint(x,y){
 const aspect=orb.offsetWidth/Math.max(1,orb.offsetHeight),cx=3.8;
 let dx=x*aspect/(.72*cx),dy=y/(.72*cx),dz=-1;
 const length=Math.hypot(dx,dy,dz);dx/=length;dy/=length;dz/=length;
 const b=cx*dz,discriminant=b*b-(cx*cx-1);
 const hit=discriminant>=0,distance=-b-Math.sqrt(Math.max(0,discriminant));
 const point=[dx*distance,dy*distance,cx+dz*distance];
 const radius=Math.hypot(...point)||1;
 return {normal:point.map(value=>value/radius),hit};
}
const siblings=[...document.body.children].filter(el=>el!==intro&&el.tagName!=='SCRIPT');
const inertBefore=siblings.map(el=>el.inert);
intro.hidden=false;root.classList.add('creative-intro-active');siblings.forEach(el=>el.inert=true);
requestAnimationFrame(()=>orb.focus({preventScroll:true}));
let gl=null,program=null,uniforms={},indexCount=0,buffers=[],entryTimer=0;
const vertex=`
precision highp float;
attribute vec3 position;
uniform float uTime,uHold,uHover,uAspect,uScale,uEnergy;
uniform vec3 uTouch,uTrail;
uniform vec2 uPointer;
varying vec3 vNormal,vPosition;
// Smooth spatial noise produces capillary ripples with no pulsing lobes.
float hash3(vec3 p){
 p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
                mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.;
}
// Travelling surface waves, layered over the approved fine glass texture.
// The smooth limit keeps the silhouette spherical even during fast interaction.
float shape(vec3 n){
 float t=uTime*.48;
 vec3 q=n+vec3(sin(n.y*2.1+t*.6),sin(n.z*2.7-t*.4),cos(n.x*2.3+t*.5))*.11;
 vec3 flow=vec3(t*.35,-t*.25,t*.18);
 float texture=noise3(q*7.5+flow)*.008+noise3(q*16.-flow*.85)*.0035
              +noise3(q*29.+flow*.6)*.0015;
 vec3 direction=normalize(vec3(.72+sin(t*.24)*.22,.62,cos(t*.19)*.4));
 float phase=dot(q,direction)*12.5+sin(q.z*3.+t*.45)*1.1-uTime*1.65;
 float travelling=sin(phase)*.022+sin(dot(q,vec3(-4.,9.,5.))+uTime*.95)*.006;
 float d=acos(clamp(dot(n,normalize(uTouch)),-.9999,.9999));
 float lag=acos(clamp(dot(n,normalize(uTrail)),-.9999,.9999));
 float touchWave=sin(d*19.-uTime*4.8)*exp(-d*1.6);
 float wake=sin(lag*16.-uTime*3.7)*exp(-lag*1.9);
 float dent=-exp(-d*d*13.)*uEnergy*.006;
 float interaction=touchWave*(.018+uEnergy*.014)+wake*uEnergy*.010+dent;
 float displacement=texture+travelling*(1.+uHold*.18)+interaction*uHover;
 float softLimit=exp(2.*displacement/.05);
 return 1.+.05*(softLimit-1.)/(softLimit+1.);
}
vec3 surface(vec3 n){return n*shape(n);}
void main(){
 vec3 n=normalize(position);
 vec3 tangent=normalize(cross(abs(n.y)>.95?vec3(1,0,0):vec3(0,1,0),n));
 vec3 bitangent=cross(n,tangent),p=surface(n);
 vec3 a=surface(normalize(n+tangent*.003))-surface(normalize(n-tangent*.003));
 vec3 b=surface(normalize(n+bitangent*.003))-surface(normalize(n-bitangent*.003));
 vNormal=normalize(cross(a,b));vPosition=p;
 p.xy+=uPointer*.009*uHover;
 float perspective=3.8/(3.8-p.z);
 gl_Position=vec4(p.x*perspective*uScale/uAspect,p.y*perspective*uScale,p.z*-.15,1.);
}`;
const fragment=`
precision highp float;
varying vec3 vNormal,vPosition;
uniform float uDark,uTime;
// Analytic studio radiance, sampled by both reflected and transmitted rays.
// There is no diffuse/pearl lobe: colour comes from light through clear glass.
vec3 studio(vec3 r){
 float sky=smoothstep(-.65,.7,r.y);
 vec3 day=mix(vec3(.16,.22,.32),vec3(.83,.88,.95),sky);
 vec3 night=mix(vec3(.025,.033,.046),vec3(.19,.23,.29),sky);
 vec3 c=mix(day,night,uDark);
 // Soft variations in the distant studio are distorted through the volume.
 float cloud=smoothstep(.12,.75,sin(r.x*4.1+r.z*2.7)*.32+cos(r.y*6.3-r.z*3.2)*.28+.25);
 c=mix(c,mix(vec3(.94,.955,.98),vec3(.29,.34,.41),uDark),cloud*.45);
 // A wide seamless backdrop behind the object keeps the centre clear.
 float backdrop=smoothstep(.35,.84,-r.z);
 c=mix(c,mix(vec3(.98),vec3(.025,.03,.039),uDark),backdrop*.48);
 float card=exp(-pow((r.x-.58+r.y*.17)*7.,2.))*(1.-smoothstep(-.25,.45,r.z));
 c*=1.-card*.66;
 // Broad reflection, a thin light strip, and a small bright light source.
 float panel=exp(-pow((r.x+.56+r.z*.12)*12.,2.))*smoothstep(-.7,-.12,r.y)*(1.-smoothstep(.65,.95,r.y));
 float strip=exp(-pow((r.y+.47+r.x*.18)*34.,2.));
 float sun=pow(max(0.,dot(r,normalize(vec3(-.85,.22,1.)))),400.);
 return c+vec3(1.35,1.4,1.5)*panel+vec3(.55,.59,.65)*strip+vec3(22.)*sun;
}
vec3 exitRay(vec3 incident,vec3 normal,float ior,out float distanceInGlass){
 vec3 inside=refract(incident,normal,1./ior);
 // Intersect the rear boundary of the almost perfectly spherical volume.
 distanceInGlass=max(.001,-2.*dot(vPosition,inside));
 vec3 back=normalize(vPosition+inside*distanceInGlass);
 // A subtle rear-surface ripple adds the second optical interface.
 float t=uTime*.42;
 vec3 wobble=vec3(sin(dot(back,vec3(8.1,5.7,4.3))+t),
                 sin(dot(back,vec3(-5.9,9.2,7.1))-t*.8),
                 sin(dot(back,vec3(12.8,-7.4,10.6))+t*.6));
 back=normalize(back+wobble*.025);
 vec3 outgoing=refract(inside,-back,ior);
 if(dot(outgoing,outgoing)<.01)outgoing=reflect(inside,-back);
 return normalize(outgoing);
}
void main(){
 vec3 n=normalize(vNormal),incident=normalize(vPosition-vec3(0.,0.,3.8));
 float facing=clamp(dot(n,-incident),0.,1.);
 float fresnel=.035+.965*pow(1.-facing,5.);
 float distanceInGlass;
 // Small wavelength separation creates restrained dispersion at the edge.
 vec3 rr=exitRay(incident,n,1.445,distanceInGlass);
 vec3 rg=exitRay(incident,n,1.450,distanceInGlass);
 vec3 rb=exitRay(incident,n,1.457,distanceInGlass);
 vec3 transmission=vec3(studio(rr).r,studio(rg).g,studio(rb).b);
 transmission*=exp(-vec3(.018,.009,.004)*distanceInGlass);
 vec3 reflection=studio(reflect(incident,n));
 float filmPhase=(1.-facing)*11.+dot(n,vec3(1.1,1.7,.6));
 vec3 film=.5+.5*cos(filmPhase+vec3(0.,2.094,4.188));
 reflection*=mix(vec3(1.),.84+film*.26,pow(1.-facing,1.4)*.22);
 vec3 colour=transmission*(1.-fresnel)+reflection*fresnel;
 // Additional white light catches only the polished surface.
 vec3 light=normalize(vec3(-.85,.22,1.));
 float spec=pow(max(0.,dot(n,normalize(-incident+light))),380.);
 colour+=vec3(2.8)*spec;
 // Transparent volume rendered via refraction, not faded surface opacity.
 colour=pow(max(colour,vec3(0.)),vec3(.4545));
 gl_FragColor=vec4(min(colour,vec3(1.)),1.);
}`;
function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(msg);}return s;}
try{
 gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});
 if(gl){
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Liquid shader link failed');gl.useProgram(program);
  const points=[],indices=[],cols=192,rows=128;
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const a=y/rows*Math.PI,b=x/cols*Math.PI*2;points.push(Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b));}
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const positions=gl.createBuffer();buffers.push(positions);gl.bindBuffer(gl.ARRAY_BUFFER,positions);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);
  const elements=gl.createBuffer();buffers.push(elements);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);indexCount=indices.length;
  ['uTime','uHold','uHover','uAspect','uScale','uPointer','uDark','uTouch','uTrail','uEnergy'].forEach(n=>uniforms[n]=gl.getUniformLocation(program,n));
  gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);orb.classList.add('orb-webgl');
 }
}catch(error){console.warn('Liquid entry: using the CSS fallback.',error);gl=null;orb.classList.remove('orb-webgl');}
function resize(){if(gl){const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(orb.offsetWidth*dpr));canvas.height=Math.max(1,Math.round(orb.offsetHeight*dpr));gl.viewport(0,0,canvas.width,canvas.height);}wake();}
function draw(){
 if(!gl){orb.style.setProperty('--orb-x',`${pointer[0]*10}deg`);orb.style.setProperty('--orb-y',`${-pointer[1]*10}deg`);return;}
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
 gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uHold,reduced.matches?0:progress);gl.uniform1f(uniforms.uHover,reduced.matches?0:hover);gl.uniform2f(uniforms.uPointer,...pointer);
 gl.uniform3f(uniforms.uTouch,...touch);gl.uniform3f(uniforms.uTrail,...trail);gl.uniform1f(uniforms.uEnergy,reduced.matches?0:energy);
 gl.uniform1f(uniforms.uAspect,canvas.width/canvas.height);gl.uniform1f(uniforms.uScale,.72);gl.uniform1f(uniforms.uDark,root.dataset.theme==='dark'?1:0);
 gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
}
function wake(){if(!frame&&!finished&&!document.hidden)frame=requestAnimationFrame(tick);}
function tick(now){
 frame=0;if(finished||document.hidden)return;
 const dt=Math.min(.1,last?(now-last)/1000:1/60);last=now;if(!reduced.matches)time+=dt;
 const blend=1-Math.exp(-dt*12);pointer=pointer.map((v,i)=>v+(target[i]-v)*blend);
 touch=surfacePoint(...pointer).normal;
 const trailBlend=1-Math.exp(-dt*3.2);
 trail=trail.map((v,i)=>v+(touch[i]-v)*trailBlend);
 const radius=Math.hypot(...trail)||1;trail=trail.map(v=>v/radius);
 hover+=(hoverTarget-hover)*(1-Math.exp(-dt*(hoverTarget>hover?11:2.8)));
 energy+=(impulse-energy)*(1-Math.exp(-dt*10));impulse*=Math.exp(-dt*3.6);
 if(!opening)progress=holding?Math.min(1,(now-holdStart)/2000):Math.max(0,progress-dt*1.5);
 intro.style.setProperty('--hold',progress);draw();if(progress>=1&&!opening)enter();
 if(!reduced.matches||holding||progress>0)wake();
}
function release(){hoverTarget=pointerInside&&!reduced.matches?1:0;holding=false;holdStart=null;activePointer=null;if(!opening)hint.textContent='Move to shape. Hold to explore.';wake();}
function begin(){if(opening||holding)return;holding=true;holdStart=performance.now();hoverTarget=reduced.matches?0:1;hint.textContent='Keep holding — let it take shape.';wake();}
function cleanup(){
 if(finished)return;finished=true;clearTimeout(entryTimer);cancelAnimationFrame(frame);
 intro.hidden=true;root.classList.remove('creative-reveal-active','creative-intro-active');
 siblings.forEach((el,i)=>el.inert=inertBefore[i]);
 window.removeEventListener('resize',resize);themeObserver.disconnect();
 if(gl){buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteProgram(program);}
 document.dispatchEvent(new CustomEvent('creative:entered'));
 if(!location.hash||location.hash==='#space')document.querySelector('#sphere')?.focus({preventScroll:true});
}
function enter(immediate=false){
 if(opening){if(immediate)cleanup();return;}
 const r=orb.getBoundingClientRect(),animate=!immediate&&!reduced.matches;
 opening=true;holding=false;
 // Prepare the actual work sphere behind the glass, at the same screen centre.
 root.classList.remove('creative-intro-active');
 if(animate)root.classList.add('creative-reveal-active');
 document.dispatchEvent(new CustomEvent('creative:enter',{detail:{animate,originX:r.left+r.width/2,originY:r.top+r.height/2}}));
 intro.classList.add('is-opening');intro.inert=true;intro.setAttribute('aria-hidden','true');
 if(!animate)cleanup();else entryTimer=setTimeout(cleanup,1850);
}
function movePointer(e){
 if(reduced.matches)return;
 const r=orb.getBoundingClientRect(),now=performance.now();
 const next=[Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)),Math.max(-1,Math.min(1,1-(e.clientY-r.top)/r.height*2))];
 const speed=Math.hypot(next[0]-target[0],next[1]-target[1])/Math.max(.016,(now-pointerStamp)/1000);
 const hit=surfacePoint(...next).hit;pointerInside=hit;
 if(hit)impulse=Math.max(impulse,Math.min(1,.18+speed*.22));
 target=next;pointerStamp=now;hoverTarget=hit||holding?1:0;wake();
}
orb.addEventListener('pointerenter',movePointer,{passive:true});
orb.addEventListener('pointermove',movePointer,{passive:true});
orb.addEventListener('pointerleave',()=>{pointerInside=false;hoverTarget=holding?1:0;pointerStamp=0;wake();});
orb.addEventListener('pointerdown',e=>{if(e.button!==0||opening||holding)return;e.preventDefault();activePointer=e.pointerId;orb.setPointerCapture(e.pointerId);begin();});
orb.addEventListener('pointerup',e=>{if(e.pointerId===activePointer)release();});orb.addEventListener('pointercancel',release);orb.addEventListener('lostpointercapture',release);
orb.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)begin();}});
orb.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();release();}});
orb.addEventListener('click',e=>{if(e.detail===0&&!holding&&!opening)enter();});orb.addEventListener('blur',release);
skip.addEventListener('click',()=>enter());
intro.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();enter();}if(e.key==='Tab'){e.preventDefault();(document.activeElement===orb?skip:orb).focus();}});
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{release();last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
window.addEventListener('hashchange',()=>{if(!finished)enter(true);});window.addEventListener('resize',resize);
const themeObserver=new MutationObserver(wake);themeObserver.observe(root,{attributes:true,attributeFilter:['data-theme']});
reduced.addEventListener('change',()=>{target=[0,0];hoverTarget=0;hover=0;energy=0;impulse=0;if(reduced.matches&&opening)cleanup();else wake();});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gl=null;orb.classList.remove('orb-webgl');});
resize();wake();
})();
