/* Cinephonia – the game. Players can only play; songs are managed by the admin in admin.html. */
const CLIP=15, FAST=5;
const G={cfg:{},songs:[],setup:{mode:'bot',bot:'pro',cat:null,diff:'progressive',rounds:5,names:['Player 1','Player 2','Player 3','Player 4','Player 5','Player 6']},game:null};
const bufCache={};
const BOT={
  rookie:{label:'Rookie',acc:.5,min:6,max:13},
  pro:{label:'Pro',acc:.72,min:3.5,max:10},
  maestro:{label:'Maestro',acc:.88,min:1.8,max:6.5}
};
const FUNNY=[
  "Did you just read the composer's mind?","Shazam is calling. They want to hire you.","Faster than the hero's entry scene!",
  "Whistles all over the theatre!","Even the popcorn can't stop dancing.","Quicker than an interval snack run.",
  "Someone get this person a director's chair.","Housefull! The audience is on its feet.","Are you secretly the music director?",
  "That guess deserves a slow-motion replay."
];

const isActive=id=>$('#'+id).classList.contains('active');
const saveSetup=()=>LS.set('cp-setup',G.setup);
const avatarText=p=>p.isBot?'🤖':esc(p.name[0].toUpperCase());
function show(id){
  stopAll();hideCelebration();
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
  window.scrollTo({top:0,behavior:'smooth'});
  if(id==='home')renderSetup();
}
function stopAll(){stopPlayback(.15);ytPause();}

/* ---------- Songs ---------- */
function demoSongs(){return DEMO.map(d=>({id:'demo-'+d.seed,title:d.title,category:'demo',difficulty:d.diff,start:0,def:d}));}
function catSongs(cat){if(cat==='demo')return demoSongs();if(cat==='mixed')return G.songs.slice();return G.songs.filter(s=>s.category===cat);}
function availableCats(){
  const out=CAT_ORDER.map(c=>({id:c,n:G.songs.filter(s=>s.category===c).length}));
  out.push({id:'mixed',n:G.songs.length});
  if(G.cfg.showDemo!==false||!G.songs.length)out.push({id:'demo',n:DEMO.length});
  return out;
}
function loadBuffer(song){
  if(song.def)return demoBuffer(song.def);
  return bufCache[song.file]||(bufCache[song.file]=fetch(song.file).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();}).then(decode).catch(e=>{delete bufCache[song.file];throw e;}));
}

/* ---------- YouTube player (audio is heard; video stays covered until the answer) ---------- */
let ytP=null,ytPReady=null;
function ytPlayer(){
  if(ytPReady)return ytPReady;
  ytPReady=loadYouTubeAPI().then(YT=>new Promise(res=>{
    ytP=new YT.Player('ytPlayer',{width:356,height:200,
      playerVars:{controls:0,disablekb:1,rel:0,playsinline:1,fs:0,iv_load_policy:3,modestbranding:1},
      events:{onReady:()=>res(ytP),onStateChange:onYtState,onError:onYtError}});
  }));
  ytPReady.catch(()=>{ytPReady=null;});
  return ytPReady;
}
function ytPause(){try{if(ytP&&ytP.pauseVideo)ytP.pauseVideo();}catch(e){}}
function onYtState(e){const g=G.game;if(g&&g.ytWaiting&&e.data===1){g.ytWaiting=false;clearTimeout(g.ytTimer);beginClock(g);}}
function onYtError(){const g=G.game;if(g&&g.ytWaiting){g.ytWaiting=false;clearTimeout(g.ytTimer);toast("This YouTube video can't be played here, skipping it");advance();}}

/* ---------- Setup form ---------- */
function renderSetup(){
  const s=G.setup;
  $('#mode').value=s.mode;$('#botLevel').value=s.bot;$('#difficulty').value=s.diff;$('#rounds').value=String(s.rounds);
  $('#botWrap').style.display=s.mode==='bot'?'':'none';
  const cats=availableCats();
  if(!cats.find(c=>c.id===s.cat&&c.n>0))s.cat=(cats.find(c=>c.n>0)||{id:'demo'}).id;
  $('#industry').innerHTML=cats.map(c=>`<option value="${c.id}" ${c.n?'':'disabled'}>${CATS[c.id].label} · ${c.n?c.n+' song'+(c.n>1?'s':''):'no songs yet'}</option>`).join('');
  $('#industry').value=s.cat;
  const humans=s.mode==='bot'?1:+s.mode,box=$('#names');box.innerHTML='';
  for(let i=0;i<humans;i++){
    const d=document.createElement('div');d.className='nm';
    d.innerHTML=`<span class="av" style="--c:${COLORS[i]}"></span><input maxlength="18" aria-label="Player ${i+1} name" placeholder="Player ${i+1}">`;
    const av=d.querySelector('.av'),inp=d.querySelector('input');
    const ini=()=>av.textContent=(inp.value.trim()||'P')[0].toUpperCase();
    inp.value=s.names[i]||'';ini();inp.oninput=()=>{s.names[i]=inp.value;ini();saveSetup();};
    box.appendChild(d);
  }
  if(s.mode==='bot'){const d=document.createElement('div');d.className='nm';d.innerHTML=`<span class="av" style="--c:${BOT_COLOR}">🤖</span><span style="color:var(--muted)">Bot (${BOT[s.bot].label})</span>`;box.appendChild(d);}
}
$('#mode').onchange=e=>{G.setup.mode=e.target.value;saveSetup();renderSetup();};
$('#botLevel').onchange=e=>{G.setup.bot=e.target.value;saveSetup();renderSetup();};
$('#industry').onchange=e=>{G.setup.cat=e.target.value;saveSetup();};
$('#difficulty').onchange=e=>{G.setup.diff=e.target.value;saveSetup();};
$('#rounds').onchange=e=>{G.setup.rounds=+e.target.value;saveSetup();};
$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
$('#startBtn').onclick=()=>startGame();
$('#rematchBtn').onclick=()=>startGame();

/* ---------- Building a game ---------- */
const progDiff=(r,R)=>r<R/3?'easy':r<2*R/3?'medium':'hard';
function pickSong(pool,d,used){
  const by=x=>x.difficulty===d;
  let c=pool.filter(x=>by(x)&&!used.has(x.id));
  if(!c.length)c=pool.filter(x=>!used.has(x.id));
  if(!c.length){used.clear();c=pool.filter(by);if(!c.length)c=pool;}
  const s=c[Math.floor(Math.random()*c.length)];used.add(s.id);return s;
}
function makeOptions(song,pool,n){
  const used=new Set([norm(song.title)]),opts=[song.title];
  const same=shuffle(pool.filter(x=>x.category===song.category).map(x=>x.title));
  for(const t of same.concat(shuffle([...(DECOYS[song.category]||[])]))){if(opts.length>=n)break;if(t&&!used.has(norm(t))){used.add(norm(t));opts.push(t);}}
  return shuffle(opts);
}
function planBot(level,diff,options,answer){
  const B=BOT[level],acc=B.acc-(diff==='hard'?.12:diff==='medium'?.05:0);
  const correct=Math.random()<acc,time=+(B.min+Math.random()*(B.max-B.min)).toFixed(1);
  const wrong=options.filter(o=>o!==answer);
  return {time,correct,pick:correct?answer:wrong[Math.floor(Math.random()*wrong.length)]};
}
function startGame(){
  ctx();
  const s=G.setup,pool=catSongs(s.cat);
  if(!pool.length){toast('No songs in this industry yet');return;}
  const humans=s.mode==='bot'?1:+s.mode;
  const players=Array.from({length:humans},(_,i)=>({name:(s.names[i]||'').trim()||`Player ${i+1}`,color:COLORS[i],score:0,streak:0,correct:0,fast:0,best:null,log:[]}));
  let bot=null;
  if(s.mode==='bot'){bot={name:`Bot (${BOT[s.bot].label})`,isBot:true,color:BOT_COLOR,score:0,streak:0,correct:0,fast:0,best:null,log:[]};players.push(bot);}
  const turns=[],used=new Set();
  for(let r=0;r<s.rounds;r++){
    const d=s.diff==='progressive'?progDiff(r,s.rounds):s.diff;
    for(let p=0;p<humans;p++){
      const song=pickSong(pool,d,used),options=makeOptions(song,pool,DIFF[d].opts);
      turns.push({p,r,diff:d,song,options,bot:bot?planBot(s.bot,d,options,song.title):null});
    }
  }
  if(pool.length<turns.length)toast(`Only ${pool.length} song${pool.length>1?'s':''} here, so some will repeat`);
  G.game={players,bot,turns,i:0,live:false,answered:false,cat:s.cat,rounds:s.rounds,humans};
  if(turns.some(t=>t.song.youtube))ytPlayer().catch(()=>{});
  showTurn();
}

/* ---------- Turns ---------- */
function renderBoard(sel,active){
  $(sel).innerHTML=G.game.players.map((p,i)=>`<div class="chip ${i===active?'on':''}" style="--c:${p.color}"><span class="av" style="--c:${p.color}">${avatarText(p)}</span>${esc(p.name)} <b>${p.score}</b></div>`).join('');
}
function showTurn(){
  const g=G.game,t=g.turns[g.i],p=g.players[t.p],D=DIFF[t.diff],multi=g.humans>1;
  $('#tAvatar').textContent=p.name[0].toUpperCase();$('#tAvatar').style.setProperty('--c',p.color);
  $('#tName').textContent=multi?`${p.name}'s turn`:`Round ${t.r+1}`;
  $('#tInfo').innerHTML=`Round ${t.r+1} of ${g.rounds} · <span class="badge ${t.diff}">${D.label}</span> · ${CATS[g.cat].label}`;
  $('#tHint').textContent=(multi?`Pass the device to ${p.name}. `:g.bot?`You against ${g.bot.name}. `:'')+'Answer within 5 seconds for a lightning bonus.';
  renderBoard('#tBoard',multi?t.p:-1);
  show('turn');
  if(!t.song.youtube)loadBuffer(t.song).catch(()=>{});
}
$('#readyBtn').onclick=()=>{ctx();show('game');playTurn();};

function beginClock(g,offsetMs=0){
  g.start=performance.now()+offsetMs;g.live=true;g.answered=false;
  $$('.opt').forEach(b=>{b.disabled=false;b.classList.remove('wait');});
  $('#status').textContent='Listening';
}
async function playTurn(){
  const g=G.game,t=g.turns[g.i],p=g.players[t.p],D=DIFF[t.diff];
  renderBoard('#board',g.humans>1?t.p:-1);
  $('#gPlayer').textContent=g.bot?`${p.name} vs Bot`:p.name;$('#gRound').textContent=`Round ${t.r+1} of ${g.rounds}`;
  $('#gDiff').className='badge '+t.diff;$('#gDiff').textContent=D.label;
  $('#nextBtn').hidden=true;
  const fb=$('#feedback');fb.textContent='';fb.className='feedback';
  $('#botline').textContent='';$('#bottag').textContent=g.bot?`🤖 ${g.bot.name} is listening too…`:'';$('#bottag').className='bottag';
  const box=$('#opts');box.className='opts n'+t.options.length;box.innerHTML='';
  t.options.forEach((o,i)=>{const b=document.createElement('button');b.className='opt wait';b.disabled=true;
    b.innerHTML=`<span class="k">${i+1}</span><span>${esc(o)}</span>`;b.onclick=()=>finish(i);box.appendChild(b);});
  $('#status').textContent='Loading';$('#secs').textContent=CLIP;setRing(0);$('#zonetag').textContent='';
  const yb=$('#ytBox');yb.classList.remove('revealed');yb.hidden=!t.song.youtube;
  g.live=false;g.answered=false;g.isYT=!!t.song.youtube;

  if(t.song.youtube){
    let pl;try{pl=await ytPlayer();}catch(e){toast("YouTube couldn't load, skipping this song");return advance();}
    if(G.game!==g||!isActive('game'))return;
    g.ytWaiting=true;
    g.ytTimer=setTimeout(()=>{if(g.ytWaiting){g.ytWaiting=false;try{pl.stopVideo();}catch(e){}toast("The video didn't start, skipping it");advance();}},12000);
    try{pl.setVolume(100);pl.unMute();pl.loadVideoById({videoId:t.song.youtube,startSeconds:t.song.start||0});}catch(e){g.ytWaiting=false;clearTimeout(g.ytTimer);toast("YouTube couldn't play this song, skipping it");return advance();}
    $('#status').textContent='Buffering';
    const nx=g.turns[g.i+1];if(nx&&!nx.song.youtube)loadBuffer(nx.song).catch(()=>{});
    return;
  }
  let buf;
  try{buf=await loadBuffer(t.song);}catch(e){toast("Couldn't load this song, skipping it");return advance();}
  if(G.game!==g||!isActive('game'))return;
  const nx=g.turns[g.i+1];if(nx&&!nx.song.youtube)loadBuffer(nx.song).catch(()=>{});
  playBuffer(buf,t.song.start||0,CLIP);
  beginClock(g,50);
}
const scoreOf=(D,el,streak)=>D.base+Math.round((CLIP-el)/CLIP*50*D.mult)+(el<=FAST?Math.round(100*D.mult):0)+(streak>1?(streak-1)*25:0);

function finish(idx){
  const g=G.game;if(!g||!g.live||g.answered)return;
  g.answered=true;g.live=false;
  const t=g.turns[g.i],p=g.players[t.p],D=DIFF[t.diff];
  const el=Math.min(CLIP,Math.max(0,(performance.now()-g.start)/1000));
  const pick=idx==null?null:t.options[idx],ok=pick===t.song.title,fast=ok&&el<=FAST;
  if(g.isYT)$('#ytBox').classList.add('revealed');else stopPlayback(.4);
  $$('.opt').forEach((b,i)=>{b.disabled=true;const o=t.options[i];
    if(o===t.song.title)b.classList.add('good');else if(i===idx)b.classList.add('bad');else b.classList.add('dim');});
  const fb=$('#feedback');let pts=0;
  if(ok){
    p.streak++;p.correct++;pts=scoreOf(D,el,p.streak);p.score+=pts;if(fast)p.fast++;p.best=p.best==null?el:Math.min(p.best,el);
    floatPts('+'+pts);fb.className='feedback ok';
    fb.textContent=`${fast?'⚡ Lightning!':'Correct!'} ${t.song.title}, in ${el.toFixed(1)}s${p.streak>1?` · streak ×${p.streak}`:''}`;
  }else{
    p.streak=0;fb.className='feedback no';
    fb.textContent=idx==null?`Time's up. It was ${t.song.title}.`:`Not quite. It was ${t.song.title}.`;
  }
  t.log={title:t.song.title,ok,pick,el,diff:t.diff,pts,fast};p.log.push(t.log);
  if(t.bot){
    const b=g.bot,bp=t.bot;let bpts=0;
    if(bp.correct){b.streak++;b.correct++;bpts=scoreOf(D,bp.time,b.streak);b.score+=bpts;if(bp.time<=FAST)b.fast++;b.best=b.best==null?bp.time:Math.min(b.best,bp.time);}else b.streak=0;
    bp.pts=bpts;b.log.push({title:t.song.title,ok:bp.correct,pick:bp.pick,el:bp.time,diff:t.diff,pts:bpts,fast:bp.correct&&bp.time<=FAST});
    const bi=t.options.indexOf(bp.pick),btn=$$('.opt')[bi];
    if(btn){const tag=document.createElement('span');tag.className='botpick';tag.textContent='🤖 bot';btn.appendChild(tag);}
    $('#bottag').textContent='';
    $('#botline').textContent=`🤖 Bot picked “${bp.pick}” at ${bp.time.toFixed(1)}s, ${bp.correct?`correct (+${bpts})`:'wrong'}`;
  }
  renderBoard('#board',g.humans>1?t.p:-1);
  $('#status').textContent=ok?'Correct':'Answer';$('#secs').textContent=ok?'✓':'✕';$('#zonetag').textContent='';
  const nxt=g.turns[g.i+1],nb=$('#nextBtn');
  nb.textContent=!nxt?'See results':g.humans>1?`Next: ${g.players[nxt.p].name}`:'Next song';
  nb.hidden=false;
  if(fast)celebrate(pts);else{sfx(ok);nb.focus({preventScroll:true});}
}
function advance(){const g=G.game;stopAll();g.i++;if(g.i>=g.turns.length)results();else showTurn();}
$('#nextBtn').onclick=()=>{$('#nextBtn').hidden=true;advance();};
$('#quitBtn').onclick=()=>{if(G.game){G.game.live=false;G.game.ytWaiting=false;clearTimeout(G.game.ytTimer);}show('home');};
function floatPts(t){const s=document.createElement('div');s.className='pts';s.textContent=t;$('#floaty').appendChild(s);setTimeout(()=>s.remove(),1400);}
function setRing(frac){$('#prog').style.strokeDashoffset=(578.05*frac).toFixed(1);$('#ring').classList.toggle('low',frac>.8&&frac<1);}

/* ---------- Lightning celebration ---------- */
let celT=null;
function celebrate(pts){
  const ov=$('#celebrate'),vid=$('#celVideo'),svg=$('#celSvg');
  $('#celLine').textContent=FUNNY[Math.floor(Math.random()*FUNNY.length)];
  $('#celPts').textContent=`+${pts} points`;
  const vids=(G.cfg.celebrationVideos||[]).filter(Boolean),useVideo=vids.length>0&&Math.random()<.6;
  vid.hidden=!useVideo;svg.style.display=useVideo?'none':'';
  ov.hidden=false;confetti(90);
  if(G.game&&G.game.isYT)ytPause();
  const fallback=()=>{vid.hidden=true;svg.style.display='';sfxFunny();};
  if(useVideo){
    vid.src=vids[Math.floor(Math.random()*vids.length)];vid.onerror=fallback;
    vid.onloadedmetadata=()=>{clearTimeout(celT);celT=setTimeout(hideCelebration,Math.min(8000,Math.max(2500,vid.duration*1000+300)));};
    vid.play().catch(fallback);
  }else sfxFunny();
  clearTimeout(celT);celT=setTimeout(hideCelebration,3600);
}
function hideCelebration(){
  const ov=$('#celebrate');if(ov.hidden)return;
  ov.hidden=true;clearTimeout(celT);try{$('#celVideo').pause();}catch(e){}
  if(G.game&&G.game.isYT&&isActive('game')&&ytP)try{ytP.playVideo();}catch(e){}
  if(!$('#nextBtn').hidden)$('#nextBtn').focus({preventScroll:true});
}
$('#celebrate').onclick=hideCelebration;

/* ---------- Results ---------- */
function results(){
  stopAll();
  const g=G.game,ranked=g.players.slice().sort((a,b)=>b.score-a.score),top=ranked[0];
  const tie=ranked.length>1&&ranked[1].score===top.score;
  $('#winner').textContent=g.players.length===1?`${top.score} points`:tie?"It's a tie":top.isBot?'The bot wins this time':`${top.name} wins`;
  const order=[ranked[1],ranked[0],ranked[2]].filter(Boolean);
  $('#podium').innerHTML=order.map(p=>{const r=ranked.indexOf(p);return `<div class="pod p${r+1}"><span class="av" style="--c:${p.color}">${avatarText(p)}</span><div class="nm">${esc(p.name)}</div><div class="sc">${p.score}</div><div class="blk">${['I','II','III'][r]}</div></div>`;}).join('');
  $('#ranking').innerHTML=`<tr><th>#</th><th>Player</th><th>Score</th><th>Correct</th><th class="hide-sm">Lightning</th><th class="hide-sm">Fastest</th></tr>`+
    ranked.map((p,i)=>`<tr><td>${i+1}</td><td class="n"><span class="av" style="--c:${p.color}">${avatarText(p)}</span>${esc(p.name)}</td><td><b>${p.score}</b></td><td>${p.correct}/${p.log.length}</td><td class="hide-sm">${p.fast}</td><td class="hide-sm">${p.best==null?'–':p.best.toFixed(1)+'s'}</td></tr>`).join('');
  const humanTop=ranked.find(p=>!p.isBot),key='cp-best-'+g.cat,best=Math.max(LS.get(key,0),humanTop?humanTop.score:0);LS.set(key,best);
  $('#bestLine').textContent=`· best in ${CATS[g.cat].label} on this device: ${best}`;
  $('#review').innerHTML=g.turns.map(t=>{const p=g.players[t.p],l=t.log;if(!l)return '';
    const botTxt=t.bot&&t.bot.pts!==undefined?` · bot ${t.bot.correct?'✓':'✕'}`:'';
    return `<div class="rv ${l.ok?'ok':'no'}"><span class="m">${l.ok?'✓':'✕'}</span><div class="tt"><b>${esc(l.title)}</b> <small>· ${esc(p.name)} · ${DIFF[l.diff].label}${l.ok?` · ${l.el.toFixed(1)}s${l.fast?' ⚡':''}`:l.pick?` · picked ${esc(l.pick)}`:' · time ran out'}${botTxt}</small></div><span class="pt">${l.ok?'+'+l.pts:''}</span></div>`;}).join('');
  show('results');
  if(!top.isBot)confetti();
}

/* ---------- Render loop: countdown + minimal radial visualizer ---------- */
const viz=$('#viz'),vx=viz.getContext('2d');
function loop(){
  requestAnimationFrame(loop);
  if(!isActive('game'))return;
  const g=G.game,tt=performance.now()/1000,live=g&&g.live;
  const real=!!cur&&!!analyser;
  if(real)analyser.getByteFrequencyData(freq);
  if(live){
    const el=(performance.now()-g.start)/1000;
    if(el>=0){
      setRing(Math.min(1,el/CLIP));$('#secs').textContent=Math.max(0,Math.ceil(CLIP-el));
      const z=$('#zonetag');if(el<FAST){z.className='zonetag';z.textContent=`⚡ Lightning bonus: ${(FAST-el).toFixed(1)}s`;}else{z.className='zonetag off';z.textContent='Keep listening';}
      const t=g.turns[g.i];
      if(t.bot&&!t.botShown&&el>=t.bot.time){t.botShown=true;const bt=$('#bottag');bt.className='bottag on';bt.textContent=`🤖 Bot has locked in an answer (${t.bot.time.toFixed(1)}s)`;}
      if(el>=CLIP)finish(null);
    }
  }
  const W=viz.width,cx=W/2,R=W*.32,N=96;vx.clearRect(0,0,W,W);vx.lineCap='round';vx.lineWidth=3;
  for(let i=0;i<N;i++){
    let v;
    if(real)v=freq[Math.floor((i<N/2?i:N-i)/(N/2)*80)]/255;
    else if(live&&g.isYT)v=.25+.22*Math.sin(tt*6+i*.7)*Math.sin(tt*2.3+i*.23)+.12*Math.sin(tt*11+i);
    else v=.03+.02*Math.sin(tt*1.5+i*.4);
    v=Math.max(0,v);
    const a=i/N*Math.PI*2-Math.PI/2,len=4+v*W*.14;
    vx.strokeStyle=`rgba(216,180,106,${(.18+v*.7).toFixed(3)})`;
    vx.beginPath();vx.moveTo(cx+Math.cos(a)*R,cx+Math.sin(a)*R);vx.lineTo(cx+Math.cos(a)*(R+len),cx+Math.sin(a)*(R+len));vx.stroke();
  }
}

/* ---------- Keyboard ---------- */
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT'].includes(e.target.tagName))return;
  if(!$('#celebrate').hidden){hideCelebration();e.preventDefault();return;}
  if(isActive('turn')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('#readyBtn').click();return;}
  if(!isActive('game'))return;
  let k='12345'.indexOf(e.key);if(k<0)k='abcde'.indexOf(e.key.toLowerCase());
  if(k>=0&&G.game&&G.game.live&&k<$$('.opt').length){finish(k);return;}
  if((e.key==='Enter'||e.key===' ')&&!$('#nextBtn').hidden){e.preventDefault();$('#nextBtn').click();}
});

/* ---------- Boot ---------- */
(async()=>{
  injectBackground();requestAnimationFrame(loop);
  const saved=LS.get('cp-setup',null);
  if(saved&&typeof saved==='object'){Object.assign(G.setup,saved);if(!Array.isArray(G.setup.names)||G.setup.names.length<6)G.setup.names=['Player 1','Player 2','Player 3','Player 4','Player 5','Player 6'];}
  [G.cfg,G.songs]=await Promise.all([loadConfig(),loadSongs()]);
  if(G.cfg.siteTitle&&G.cfg.siteTitle!=='Cinephonia'){document.title=`${G.cfg.siteTitle} – Guess the Film by Its Music`;$$('.logo').forEach(l=>l.textContent=G.cfg.siteTitle);}
  renderSetup();
  if(G.songs.some(s=>s.youtube))ytPlayer().catch(()=>{});
})();
