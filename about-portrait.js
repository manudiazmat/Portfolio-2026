/* Original image with transparent vector cutouts, CSS perspective and subtle float. */
(()=>{
'use strict';
  class PortraitInteraction {
    constructor(){
      this.page=document.querySelector('#about-page');this.image=this.page.querySelector('#about-portrait');this.stage=this.page.querySelector('.portrait-stage');this.card=this.page.querySelector('.portrait-card');this.tablet=this.page.querySelector('.portrait-tablet');
      this.layer=this.page.querySelector('.portrait-layer');this.finale=this.page.querySelector('.about-finale');this.anchor=this.page.querySelector('.finale-portrait-anchor');
      this.frame=0;this.time=0;this.last=0;this.reveal=0;this.rotation=[0,0,0];this.target=[0,0,0];this.offset={x:0,y:0};this.pointer={x:0,y:0};this.lines=[];
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.motionButton=document.querySelector('#motion-toggle');
      this.page.addEventListener('pointermove',e=>this.pointerMove(e),{passive:true});this.page.addEventListener('pointerleave',()=>{this.target=[0,0,0];this.pointer={x:0,y:0};this.wake();});
      this.page.addEventListener('scroll',()=>this.wake(),{passive:true});
      this.motionButton?.addEventListener('click',()=>this.wake());this.reduced.addEventListener?.('change',()=>this.wake());
      document.addEventListener('visibilitychange',()=>this.wake());
      this.observer=new MutationObserver(()=>this.wake());this.observer.observe(this.page,{attributes:true,attributeFilter:['hidden']});this.observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
      window.addEventListener('resize',()=>this.measure());document.fonts?.ready.then(()=>this.measure());
      this.finale?.querySelector('details')?.addEventListener('toggle',()=>this.wake());
      this.finale?.addEventListener('pointermove',e=>{
        if(!this.moving())return;
        const row=e.target.closest('.education-row,.contact-list a');if(!row)return;
        const r=row.getBoundingClientRect();row.style.setProperty('--pointer-x',`${e.clientX-r.left+12}px`);row.style.setProperty('--pointer-y',`${e.clientY-r.top}px`);
      },{passive:true});
      if(this.finale&&typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(()=>this.wake());this.resizeObserver.observe(this.finale);}

      this.measure();
    }
    moving(){return !this.reduced.matches&&this.motionButton?.getAttribute('aria-pressed')!=='true';}
    pointerMove(e){const r=this.page.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width/2))),y=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/(r.height/2)));this.target=[-y*3,x*4,x*.3];this.pointer={x:innerWidth<640?0:x*4,y:innerWidth<640?0:y*2};this.wake();}
    measure(){
      if(this.page.hidden){this.needsMeasure=true;return;}
      this.needsMeasure=false;this.lines=[];
      this.page.querySelectorAll('[data-head-wrap]').forEach(p=>{
        if(!p.dataset.original){
          p.dataset.original=[...p.childNodes].map(node=>node.nodeName==='BR'?'\uE000':node.textContent).join('').trim().replace(/\s+/g,' ').replace(/\uE000/g,'\n');
        }
        p.textContent='';p.dataset.original.split('\n').forEach((line,row)=>{
          if(row)p.append(document.createElement('br'));
          line.trim().split(' ').filter(Boolean).forEach((word,i)=>{if(i)p.append(' ');const span=document.createElement('span');span.textContent=word;span.className='about-word';p.append(span);});
        });
        const groups=[];let top=null;
        [...p.querySelectorAll('.about-word')].forEach(w=>{if(top===null||Math.abs(w.offsetTop-top)>3){groups.push([]);top=w.offsetTop;}groups.at(-1).push(w.textContent);});
        p.replaceChildren();groups.forEach(words=>{const row=document.createElement('span');row.className='about-text-line';const span=document.createElement('span');span.textContent=words.join(' ');row.append(span);p.append(row);this.lines.push({row,span,x:0});});
      });
      this.wake();
    }
    wake(){if(!this.frame&&!this.page.hidden&&!document.hidden)this.frame=requestAnimationFrame(t=>this.tick(t));}
    dock(){
      if(!this.finale||!this.anchor)return {x:0,y:0,scale:1,progress:0};
      const page=this.page.getBoundingClientRect(),height=this.page.clientHeight||innerHeight,top=this.finale.getBoundingClientRect().top-page.top;
      const progress=Math.max(0,Math.min(1,(height*1.15-top)/(height*.65))),blend=progress*progress*(3-2*progress);
      if(!blend)return {x:0,y:0,scale:1,progress:0};
      const slot=this.anchor.getBoundingClientRect(),layer=this.layer.getBoundingClientRect();
      const size=this.stage.offsetWidth||360;
      const cx=layer.left+this.stage.offsetLeft+size/2,cy=layer.top+this.stage.offsetTop+size/2;
      return {x:(slot.left+slot.width/2-cx)*blend,y:(slot.top+slot.height/2-cy)*blend,scale:1+(slot.width/size-1)*blend,progress:blend};
    }
    tick(t){
      this.frame=0;if(this.page.hidden||document.hidden){this.last=0;return;}
      if(this.needsMeasure)this.measure();const dt=Math.min(.04,this.last?(t-this.last)/1000:1/60);this.last=t;
      const moving=this.moving(),ease=1-Math.exp(-dt*8);this.time+=moving?dt:0;this.reveal=moving?Math.min(1,this.reveal+dt/.95):1;
      this.rotation=moving?this.rotation.map((v,i)=>v+(this.target[i]-v)*ease):[0,0,0];
      this.offset.x=moving?this.offset.x+(this.pointer.x-this.offset.x)*ease:0;this.offset.y=moving?this.offset.y+(this.pointer.y-this.offset.y)*ease:0;
      const dock=this.dock(),bob=moving?Math.sin(this.time*1.12)*7:0;
      this.stage.style.transform=`translate3d(${dock.x+this.offset.x}px,${dock.y+this.offset.y+bob}px,0) scale(${dock.scale})`;
      this.page.classList.toggle('finale-reduced',!moving);
      this.card.style.transform=`perspective(1000px) rotateX(${this.rotation[0].toFixed(3)}deg) rotateY(${this.rotation[1].toFixed(3)}deg) rotateZ(${this.rotation[2].toFixed(3)}deg)`;
      this.tablet.style.transform=moving?`translate3d(${Math.sin(this.time*.8)*1.5}px,${Math.sin(this.time*1.12+.8)*3}px,14px)`:'none';
      const r=this.image.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,small=innerWidth<640;
      const rx=small?58:135,ry=small?95:160;let unsettled=false;
      this.lines.forEach(line=>{const b=line.row.getBoundingClientRect();let target=0;const y=(b.top+b.height/2-cy)/ry;
        if(Math.abs(y)<1&&b.bottom>0&&b.top<innerHeight){const half=rx*Math.sqrt(1-y*y);const left=line.row.closest('[data-side="left"]');const edge=left?b.right:b.left;target=left?Math.min(0,cx-half-14-edge):Math.max(0,cx+half+14-edge);const room=left?Math.max(0,b.left-18):Math.max(0,innerWidth-b.right-18);target=Math.max(-room,Math.min(room,target));}
        line.x=moving?line.x+(target-line.x)*(1-Math.exp(-dt*10)):target;if(Math.abs(line.x-target)>.1)unsettled=true;line.span.style.transform=`translate3d(${line.x.toFixed(2)}px,0,0)`;
      });
      if(moving||unsettled)this.wake();
    }
  }

window.portraitInteraction=new PortraitInteraction();
})();
