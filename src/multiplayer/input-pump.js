// Network input cadence must not depend on GPU/render frame cadence.
export class InputPump{
 constructor(sample,send,interval=50){this.seq=0;this.timer=setInterval(()=>{const input=sample();if(input)send({type:'input',...input,seq:this.seq++});},interval);this.timer.unref?.();}
 stop(){clearInterval(this.timer);}
}
