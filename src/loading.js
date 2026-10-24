export class LoadingScreen{
  constructor(root){
    this.root=root;this.percent=0;this.finished=false;
    this.message=root.querySelector('#boot-message');this.number=root.querySelector('#boot-percent');
    this.track=root.querySelector('#boot-progress');this.fill=root.querySelector('#boot-progress-fill');
    root.querySelector('#boot-retry').addEventListener('click',()=>location.reload());
  }
  update(value,message){
    if(this.root.dataset.state==='error'||this.finished)return;
    this.percent=Math.max(this.percent,Math.min(100,Number.isFinite(value)?Math.floor(value):this.percent));
    this.number.textContent=String(this.percent).padStart(3,'0');this.fill.style.width=`${this.percent}%`;
    this.track.setAttribute('aria-valuenow',String(this.percent));this.root.dataset.stage=String(this.percent<65?0:this.percent<92?1:2);
    if(message)this.message.textContent=message;
  }
  finish(){
    if(this.finished)return Promise.resolve();
    this.update(100,'Your drive is ready.');this.root.dataset.state='ready';this.root.setAttribute('aria-busy','false');
    document.body.classList.remove('booting');
    return new Promise(resolve=>{
      let timeout;
      const complete=()=>{clearTimeout(timeout);this.root.removeEventListener('transitionend',ended);this.root.hidden=true;this.finished=true;resolve();};
      const ended=e=>{if(e.target===this.root&&e.propertyName==='opacity')complete();};
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){complete();return;}
      this.root.addEventListener('transitionend',ended);this.root.classList.add('is-leaving');
      // Background tabs may suppress transitionend; never trap the launch page.
      timeout=setTimeout(complete,850);
    });
  }
  fail(message){
    this.root.dataset.state='error';this.root.setAttribute('aria-busy','false');
    this.root.querySelector('#boot-title').textContent='A brief pit stop.';
    this.message.setAttribute('role','alert');this.message.textContent=message;
    const retry=this.root.querySelector('#boot-retry');retry.hidden=false;retry.focus({preventScroll:true});
  }
}
