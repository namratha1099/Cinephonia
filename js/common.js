/* Cinephonia – shared code for the game (index.html) and the admin studio (admin.html) */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const COLORS=['#d8b46a','#8fb8de','#e58a9b','#9fd4b4','#b9a3e3','#f0a46b'];
const BOT_COLOR='#a19cb0';

const CATS={
  tollywood:{label:'Tollywood',sub:'Telugu cinema'},
  bollywood:{label:'Bollywood',sub:'Hindi cinema'},
  hollywood:{label:'Hollywood',sub:'English films'},
  mixed:{label:'Mixed',sub:'All industries'},
  demo:{label:'Demo Pack',sub:'Original tunes from imaginary films'}
};
const CAT_ORDER=['tollywood','bollywood','hollywood'];
const DIFF={
  easy:{label:'Easy',emoji:'🟢',opts:3,base:100,mult:1},
  medium:{label:'Medium',emoji:'🟡',opts:4,base:150,mult:1.5},
  hard:{label:'Hard',emoji:'🔴',opts:5,base:200,mult:2}
};

/* Wrong-answer pools used when a category has too few songs uploaded */
const DECOYS={
  tollywood:['Baahubali: The Beginning','Baahubali 2: The Conclusion','RRR','Pushpa: The Rise','Pushpa 2: The Rule','Magadheera','Arjun Reddy','Eega','Ala Vaikunthapurramuloo','Rangasthalam','Jersey','Mahanati','Pokiri','Athadu','Geetha Govindam','Sita Ramam','Kalki 2898 AD','Salaar','Devara','Hi Nanna','Bommarillu','Khaleja','Srimanthudu','Jalsa','Arya 2','Fidaa','Majili','Uppena','Akhanda','Waltair Veerayya'],
  bollywood:['Dilwale Dulhania Le Jayenge','Sholay','3 Idiots','Lagaan','Kabhi Khushi Kabhie Gham','Dil Chahta Hai','Zindagi Na Milegi Dobara','Dangal','PK','Jawan','Pathaan','Kal Ho Naa Ho','Rockstar','Aashiqui 2','Yeh Jawaani Hai Deewani','Devdas','Kuch Kuch Hota Hai','Barfi!','Queen','Animal','Om Shanti Om','Chennai Express','Bajrangi Bhaijaan','Gully Boy','Kabir Singh','Rang De Basanti','Dil Se','Jab We Met','Tamasha','Stree'],
  hollywood:['Titanic','Inception','Interstellar','Jurassic Park','The Lion King','Gladiator','The Dark Knight','Avatar','Frozen','Rocky','Jaws','Up','Forrest Gump','The Godfather','Pirates of the Caribbean','Harry Potter','Star Wars','Mission: Impossible','Top Gun','Back to the Future','La La Land','Coco','The Avengers','Spider-Man','Oppenheimer','Dune','The Matrix','E.T.','Ghostbusters','Toy Story'],
  demo:['Midnight in Marrakesh','The Last Lighthouse','Iron Petals','Echoes of Avalon','Paper Tigers','The Glass Comet','Silver Lagoon','Operation Nightjar','Beneath Crimson Skies',"The Clockmaker's Daughter",'Wolves of Winter','Cosmic Carnival']
};

/* ---------- Small helpers ---------- */
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const norm=s=>String(s||'').trim().toLowerCase();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>{s=Math.round(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const slug=s=>norm(s).normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'song';
function cleanName(n){return n.replace(/\.[^.]+$/,'').replace(/[\[(].*?[\])]/g,'').replace(/_+/g,' ').replace(/\s*-\s*(theme|ost|soundtrack|bgm|music|song|score).*$/i,'').replace(/\s+/g,' ').trim()||'Untitled';}
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
let toastT;function toast(m,ms=2800){const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),ms);}

async function loadConfig(){try{const r=await fetch('config.json',{cache:'no-store'});if(r.ok)return await r.json();}catch(e){}return {};}
async function loadSongs(){
  try{const r=await fetch('songs.json',{cache:'no-store'});if(!r.ok)return [];const j=await r.json();
    return (j.songs||[]).filter(s=>s&&s.title&&(s.file||s.youtube)&&CATS[s.category]).map(s=>({...s,id:s.id||s.file||('yt-'+s.youtube),difficulty:DIFF[s.difficulty]?s.difficulty:'medium',start:+s.start||0}));
  }catch(e){return [];}
}

/* ---------- Quiet background ---------- */
function injectBackground(){
  const bg=document.createElement('div');bg.id='bg';
  bg.innerHTML='<div class="spot"></div><div class="sunburst"></div><div class="arc"></div><div class="curtain l"></div><div class="curtain r"></div><div class="valance"></div><div class="trim"></div><div class="vignette"></div><div class="grain"></div>';
  document.body.prepend(bg);
  for(let i=0;i<16;i++){const d=document.createElement('i');d.className='dust';d.style.left=(8+Math.random()*84)+'vw';d.style.setProperty('--dx',((Math.random()-.5)*120)+'px');
    d.style.animationDuration=(14+Math.random()*16)+'s';d.style.animationDelay=(-Math.random()*30)+'s';const z=1+Math.random()*2;d.style.width=d.style.height=z+'px';bg.appendChild(d);}
}

/* ---------- YouTube links ---------- */
function parseYouTube(u){
  u=String(u||'').trim();if(/^[\w-]{11}$/.test(u))return {id:u,start:0};
  let url;try{url=new URL(u);}catch(e){return null;}
  const h=url.hostname.replace(/^www\.|^m\.|^music\./,'');let id=null;
  if(h==='youtu.be')id=url.pathname.slice(1,12);
  else if(h==='youtube.com'||h==='youtube-nocookie.com'){
    id=url.searchParams.get('v');
    const m=url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);if(!id&&m)id=m[2];
  }
  if(!id||!/^[\w-]{11}$/.test(id))return null;
  const t=url.searchParams.get('t')||url.searchParams.get('start')||'';
  let start=0;const mm=String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/);
  if(mm)start=(+mm[1]||0)*3600+(+mm[2]||0)*60+(+mm[3]||0);
  return {id,start};
}
let ytApi=null;
function loadYouTubeAPI(){
  if(ytApi)return ytApi;
  ytApi=new Promise((res,rej)=>{
    if(window.YT&&window.YT.Player)return res(window.YT);
    const prev=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{if(prev)prev();res(window.YT);};
    const sc=document.createElement('script');sc.src='https://www.youtube.com/iframe_api';sc.onerror=()=>rej(new Error('YouTube API blocked'));
    document.head.appendChild(sc);setTimeout(()=>rej(new Error('YouTube API timeout')),15000);
  });
  ytApi.catch(()=>{ytApi=null;});
  return ytApi;
}

/* ---------- Audio core ---------- */
let AC=null,master=null,analyser=null,cur=null;
const freq=new Uint8Array(128);
const mtof=m=>440*Math.pow(2,(m-69)/12);
function ctx(){
  if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();analyser=AC.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.75;master.connect(analyser);analyser.connect(AC.destination);}
  if(AC.state==='suspended')AC.resume().catch(()=>{});
  return AC;
}
function decode(ab){return new Promise((res,rej)=>ctx().decodeAudioData(ab,res,rej));}
function playBuffer(buf,start=0,len=15){
  stopPlayback(0);
  const c=ctx();
  const off=buf.duration<=len?0:Math.min(Math.max(0,start),buf.duration-len);
  const dur=Math.min(len,buf.duration-off);
  const src=c.createBufferSource();src.buffer=buf;
  const g=c.createGain(),t=c.currentTime+.05;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+.25);
  g.gain.setValueAtTime(1,Math.max(t+.26,t+dur-.45));g.gain.linearRampToValueAtTime(0,t+dur);
  src.connect(g);g.connect(master);src.start(t,off,dur);
  const me={src,g,t0:t,dur};cur=me;src.onended=()=>{if(cur===me)cur=null;};
  return me;
}
function stopPlayback(fade=.3){
  if(!cur)return;const {src,g}=cur;cur=null;
  try{const n=AC.currentTime;g.gain.cancelScheduledValues(n);g.gain.setValueAtTime(g.gain.value,n);g.gain.linearRampToValueAtTime(0,n+fade+.01);src.stop(n+fade+.03);}catch(e){}
}
function sfx(ok){
  const c=ctx(),t=c.currentTime,notes=ok?[72,76,79,84]:[47,43];
  notes.forEach((m,i)=>{const o=c.createOscillator(),g=c.createGain();o.type=ok?'triangle':'sawtooth';o.frequency.value=mtof(m);
    const st=t+i*(ok?.07:.16);g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(ok?.16:.09,st+.01);g.gain.exponentialRampToValueAtTime(.001,st+(ok?.35:.3));
    o.connect(g);g.connect(c.destination);o.start(st);o.stop(st+.4);});
}
/* silly slide-whistle + boing + kazoo "ta-da" for lightning guesses */
function sfxFunny(){
  const c=ctx(),t=c.currentTime,d=c.destination;
  const o=c.createOscillator(),g=c.createGain();o.type='sine';
  o.frequency.setValueAtTime(380,t);o.frequency.exponentialRampToValueAtTime(1700,t+.35);o.frequency.exponentialRampToValueAtTime(650,t+.6);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+.03);g.gain.linearRampToValueAtTime(0,t+.62);o.connect(g);g.connect(d);o.start(t);o.stop(t+.65);
  for(let i=0;i<3;i++){const b=c.createOscillator(),bg=c.createGain(),st=t+.7+i*.16;b.type='sine';b.frequency.setValueAtTime(220-i*30,st);b.frequency.exponentialRampToValueAtTime(70,st+.14);
    bg.gain.setValueAtTime(.25,st);bg.gain.exponentialRampToValueAtTime(.001,st+.15);b.connect(bg);bg.connect(d);b.start(st);b.stop(st+.16);}
  [[67,.18],[72,.5]].forEach(([m,len],i)=>{const st=t+1.25+i*.2,k=c.createOscillator(),kg=c.createGain(),f=c.createBiquadFilter(),l=c.createOscillator(),lg=c.createGain();
    k.type='sawtooth';k.frequency.value=mtof(m);f.type='bandpass';f.frequency.value=1200;f.Q.value=2;l.frequency.value=7;lg.gain.value=25;l.connect(lg);lg.connect(k.detune);
    kg.gain.setValueAtTime(0,st);kg.gain.linearRampToValueAtTime(.2,st+.02);kg.gain.setValueAtTime(.2,st+len-.05);kg.gain.linearRampToValueAtTime(0,st+len);
    k.connect(f);f.connect(kg);kg.connect(d);k.start(st);k.stop(st+len+.02);l.start(st);l.stop(st+len+.02);});
}

/* ---------- Original demo tunes (composed procedurally – no copyrighted music) ---------- */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeNoise(c){const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;}
function tone(c,dest,t,m,d,o={}){
  const osc=c.createOscillator();osc.type=o.type||'sine';osc.frequency.setValueAtTime(mtof(m),t);
  const g=c.createGain(),a=Math.min(o.a??.01,d*.5),r=Math.min(o.r??.08,d*.5),v=o.v??.15;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.setValueAtTime(v,t+d-r);g.gain.linearRampToValueAtTime(.0001,t+d);
  let node=osc;if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;f.Q.value=o.q||.7;osc.connect(f);node=f;}
  node.connect(g);g.connect(dest);
  if(o.vib){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=5.5;lg.gain.value=o.vib;l.connect(lg);lg.connect(osc.detune);l.start(t);l.stop(t+d+.05);}
  osc.start(t);osc.stop(t+d+.05);
}
function hit(c,dest,nb,t,d,v,type,f0){const s=c.createBufferSource();s.buffer=nb;const f=c.createBiquadFilter();f.type=type;f.frequency.value=f0;const g=c.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f);f.connect(g);g.connect(dest);s.start(t);s.stop(t+d+.02);}
function kick(c,dest,t,v=.7,f0=150){const o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(40,t+.15);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(dest);o.start(t);o.stop(t+.32);}
function drums(c,out,nb,t0,B,style,b){
  const H=(t,v=.06)=>hit(c,out,nb,t,.04,v,'highpass',7000),Sn=(t,v=.22)=>hit(c,out,nb,t,.16,v,'bandpass',1800);
  if(style==='four'){for(let i=0;i<4;i++){kick(c,out,t0+i*B,.75);H(t0+i*B+B/2,.08);}[1,3].forEach(i=>Sn(t0+i*B,.18));}
  if(style==='swing'){for(let i=0;i<4;i++){H(t0+i*B,.07);if(i%2)H(t0+i*B+B*2/3,.05);}kick(c,out,t0,.4);[1,3].forEach(i=>hit(c,out,nb,t0+i*B,.12,.08,'bandpass',3000));}
  if(style==='tom'){kick(c,out,t0,.7,120);kick(c,out,t0+1.5*B,.45,200);kick(c,out,t0+2*B,.6,140);if(b%2){kick(c,out,t0+3*B,.4,240);kick(c,out,t0+3.5*B,.4,200);}Sn(t0+3*B,.08);}
  if(style==='trot'){for(let i=0;i<4;i++){kick(c,out,t0+i*B,.35,110);hit(c,out,nb,t0+i*B+B/2,.06,.09,'bandpass',2500);hit(c,out,nb,t0+i*B+B*.75,.05,.06,'bandpass',3500);}}
}
const SC={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],hminor:[0,2,3,5,7,8,11]};
async function renderTrack(p,L=15){
  const sr=44100,c=new OfflineAudioContext(2,Math.ceil(sr*(L+.5)),sr);
  const out=c.createGain();out.gain.setValueAtTime(.9,0);out.gain.setValueAtTime(.9,L-.8);out.gain.linearRampToValueAtTime(0,L+.3);
  const comp=c.createDynamicsCompressor();out.connect(comp);comp.connect(c.destination);
  const nb=makeNoise(c),r=rng(p.seed),sc=SC[p.scale],n=sc.length;
  const dm=(deg,oct=0)=>p.root+sc[((deg%n)+n)%n]+12*Math.floor(deg/n)+12*oct;
  const B=60/p.bpm,bar=4*B,rh=p.rhythms||[.5,.5,1,1,1.5,2],motif=[];
  let acc=0,deg=7+Math.floor(r()*3);
  while(acc<8){let len=rh[Math.floor(r()*rh.length)];if(acc+len>8)len=8-acc;
    deg=Math.max(4,Math.min(13,deg+[-2,-1,-1,1,1,2,3,-3,0][Math.floor(r()*9)]));motif.push({deg,len,rest:acc>0&&r()<.12});acc+=len;}
  const motif2=motif.map((x,i)=>({...x,deg:i>=motif.length-2?x.deg+(r()<.5?-2:2):x.deg}));
  motif2[motif2.length-1].deg=7;motif2[motif2.length-1].rest=false;
  for(let b=0;;b++){
    const t0=.05+b*bar;if(t0>L)break;
    const cd=p.prog[b%p.prog.length];
    if(p.pad)[cd,cd+2,cd+4].forEach(d=>tone(c,out,t0,dm(d),bar,{type:p.pad,a:.4,r:.5,v:p.padV||.05,lp:p.padLp}));
    if(p.bassPat==='walk')[cd,cd+2,cd+4,cd+5].forEach((d,i)=>tone(c,out,t0+i*B,dm(d,-1),B*.9,{type:p.bassType,v:.22,lp:p.bassLp}));
    else if(p.bassPat==='pulse'){for(let i=0;i<8;i++)tone(c,out,t0+i*B/2,dm(cd,-1),B/2*.8,{type:p.bassType,v:.18,lp:p.bassLp});}
    else for(let i=0;i<4;i++)tone(c,out,t0+i*B,dm(cd,-1)+(i===2&&p.bassFifth?7:0),B*.85,{type:p.bassType,v:.22,lp:p.bassLp});
    if(p.arp){const st=p.arpRate||4;for(let i=0;i<4*st;i++)tone(c,out,t0+i*B/st,dm([0,2,4,2][i%4]+cd,1),B/st*.9,{type:p.arp,v:p.arpV||.05,lp:p.arpLp});}
    if(p.drums)drums(c,out,nb,t0,B,p.drums,b);
  }
  let lt=.05+bar,k=0;
  while(lt<L-.2){const m=k%2?motif2:motif;let tt=lt;
    for(const x of m){if(tt>L-.1)break;if(!x.rest)tone(c,out,tt,dm(x.deg,p.leadOct||0),x.len*B*.92,{type:p.lead,v:p.leadV||.13,lp:p.leadLp,a:p.leadA||.02,r:.08,vib:p.vib});tt+=x.len*B;}
    lt+=8*B;k++;}
  return c.startRendering();
}
const DEMO=[
 {title:'Starfall Odyssey',diff:'easy',seed:11,bpm:108,root:57,scale:'minor',prog:[0,5,2,6],pad:'sine',padV:.05,bassType:'sawtooth',bassLp:500,arp:'sawtooth',arpLp:1600,arpV:.04,lead:'triangle',leadV:.14,drums:'tom',vib:8},
 {title:'Dust & Thunder',diff:'easy',seed:23,bpm:100,root:52,scale:'minor',prog:[0,0,6,4],bassType:'triangle',bassFifth:1,lead:'square',leadLp:2200,leadV:.08,drums:'trot',vib:12},
 {title:'The Velvet Heist',diff:'medium',seed:37,bpm:128,root:50,scale:'dorian',prog:[0,3,0,4],pad:'sine',padV:.035,bassType:'triangle',bassPat:'walk',lead:'square',leadLp:1300,leadV:.1,drums:'swing',rhythms:[.5,.5,.5,1,1.5]},
 {title:'Whispers of Hollow Manor',diff:'medium',seed:41,bpm:72,root:53,scale:'hminor',prog:[0,5,3,4],pad:'triangle',padV:.05,bassType:'sine',arp:'sine',arpRate:2,arpV:.06,lead:'sine',leadV:.12,leadOct:1,vib:18,leadA:.08,rhythms:[1,1,2,1.5,.5]},
 {title:'Crown of Embers',diff:'hard',seed:59,bpm:96,root:55,scale:'major',prog:[0,4,5,3],pad:'sawtooth',padLp:900,padV:.04,bassType:'sawtooth',bassLp:400,lead:'sawtooth',leadLp:2400,leadV:.09,drums:'tom',rhythms:[.5,.5,1,1,2]},
 {title:'Neon Rush',diff:'hard',seed:73,bpm:124,root:48,scale:'minor',prog:[0,6,5,6],bassType:'sawtooth',bassLp:700,bassPat:'pulse',arp:'square',arpLp:3000,arpV:.03,lead:'sawtooth',leadLp:3000,leadV:.08,drums:'four'}
];
const demoCache={};
function demoBuffer(d){return demoCache[d.title]||(demoCache[d.title]=renderTrack(d,15));}

/* ---------- Confetti ---------- */
function confetti(count=170){
  const cv=$('#confetti');if(!cv)return;const x=cv.getContext('2d');cv.width=innerWidth;cv.height=innerHeight;
  const P=Array.from({length:count},()=>({x:Math.random()*cv.width,y:-20-Math.random()*cv.height*.6,vx:(Math.random()-.5)*3,vy:2+Math.random()*3.5,r:5+Math.random()*6,c:COLORS[Math.floor(Math.random()*COLORS.length)],a:Math.random()*6,va:(Math.random()-.5)*.3}));
  const end=performance.now()+4500;
  (function f(now){x.clearRect(0,0,cv.width,cv.height);P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.a+=p.va;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);x.restore();});
    if(now<end)requestAnimationFrame(f);else x.clearRect(0,0,cv.width,cv.height);})(performance.now());
}

function eqLoop(){}
