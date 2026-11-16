/* Cinephonia – Party mode: play online on separate devices with a room code.
   Uses PeerJS (free public signalling server). The host's browser runs the game and
   everyone else connects to it directly. No account or server setup needed. */
const Party=(()=>{
  const PREFIX='cinephonia-v1-',CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',MAX=8;
  const PEER_SRC=['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js','https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  let P=null;      // party state
  let peerLib=null;

  /* ---------- helpers ---------- */
  function loadPeer(){
    if(window.Peer)return Promise.resolve();
    if(peerLib)return peerLib;
    peerLib=new Promise((res,rej)=>{
      let i=0;const next=()=>{if(i>=PEER_SRC.length)return rej(new Error('Could not load the party service'));
        const s=document.createElement('script');s.src=PEER_SRC[i++];s.onload=()=>window.Peer?res():next();s.onerror=next;document.head.appendChild(s);};
      next();
    });
    peerLib.catch(()=>{peerLib=null;});
    return peerLib;
  }
  const newCode=()=>Array.from({length:5},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join('');
  const me=()=>P&&P.players.find(p=>p.id===P.myId);
  const msg=t=>{$('#partyMsg').textContent=t||'';};
  function send(conn,data){try{if(conn&&conn.open)conn.send(data);}catch(e){}}
  function broadcast(data){if(!P||!P.host)return;P.conns.forEach(c=>send(c,data));handle(data,null,true);}
  function toHost(data){if(!P)return;if(P.host)hostHandle(data,P.myId);else send(P.hostConn,data);}

  /* ---------- entry: host / join screens ---------- */
  function openScreen(mode){
    $('#pName').value=LS.get('cp-party-name','');
    $('#joinBox').style.display=mode==='join'?'':'none';
    $('#partyGo').textContent=mode==='join'?'Join party':'Create room';
    $('#partyGo').dataset.mode=mode;msg('');
    show('party');
    setTimeout(()=>{(mode==='join'&&$('#pName').value?$$('#codeIn input')[0]:$('#pName')).focus();},50);
  }
  $('#hostBtn').onclick=()=>openScreen('host');
  $('#joinBtn').onclick=()=>openScreen('join');
  // code boxes: auto-advance, paste a whole code
  $$('#codeIn input').forEach((inp,i,all)=>{
    inp.addEventListener('input',()=>{inp.value=inp.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(-1);if(inp.value&&all[i+1])all[i+1].focus();});
    inp.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!inp.value&&all[i-1])all[i-1].focus();if(e.key==='Enter')$('#partyGo').click();});
    inp.addEventListener('paste',e=>{const t=(e.clipboardData.getData('text')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);if(t){e.preventDefault();all.forEach((x,k)=>x.value=t[k]||'');all[Math.min(t.length,4)].focus();}});
  });
  $('#partyGo').onclick=async()=>{
    const name=$('#pName').value.trim();
    if(!name){msg('Please enter your name first.');$('#pName').focus();return;}
    LS.set('cp-party-name',name);ctx();
    const b=$('#partyGo');b.disabled=true;msg('Connecting to the party service…');
    try{await loadPeer();}catch(e){msg('Could not reach the party service. Check your internet connection.');b.disabled=false;return;}
    if(b.dataset.mode==='join'){
      const code=$$('#codeIn input').map(x=>x.value).join('');
      if(code.length<5){msg('Enter the 5-character room code.');b.disabled=false;return;}
      join(code,name);
    }else host(name);
    b.disabled=false;
  };

  /* ---------- host ---------- */
  function host(name,tries=0){
    const code=newCode(),peer=new Peer(PREFIX+code,{debug:0});
    peer.on('open',id=>{
      P={host:true,peer,code,myId:id,conns:new Map(),players:[{id,name,color:COLORS[0],score:0,streak:0,correct:0,fast:0,best:null,online:true,isHost:true}],
        settings:{cat:G.setup.cat||'demo',diff:G.setup.diff||'progressive',scenes:5},phase:'lobby'};
      if(!availableCats().find(c=>c.id===P.settings.cat&&c.n>0))P.settings.cat=(availableCats().find(c=>c.n>0)||{id:'demo'}).id;
      enterLobby(true);
    });
    peer.on('connection',conn=>{
      conn.on('data',d=>hostHandle(d,conn.peer,conn));
      conn.on('close',()=>dropGuest(conn.peer));
      conn.on('error',()=>dropGuest(conn.peer));
    });
    peer.on('disconnected',()=>{try{peer.reconnect();}catch(e){}});
    peer.on('error',err=>{
      if(err.type==='unavailable-id'&&tries<4){peer.destroy();host(name,tries+1);return;}
      if(!P){msg('Could not create a room: '+(err.type||err.message));}
      else toast('Connection problem: '+(err.type||'network'));
    });
  }
  function dropGuest(id){
    if(!P||!P.host)return;const c=P.conns.get(id);P.conns.delete(id);
    const p=P.players.find(x=>x.id===id);if(!p)return;
    if(P.phase==='lobby')P.players=P.players.filter(x=>x!==p);else p.online=false;
    toast(`${p.name} left the party`);syncLobby();
    if(P.phase==='round')maybeReveal();
    if(P.phase==='loading')maybeGo();
  }
  function hostHandle(d,from,conn){
    if(!P||!P.host||!d||!d.t)return;
    if(d.t==='join'){
      if(P.phase!=='lobby'){send(conn,{t:'denied',why:'The film has already started. Ask the host to let you in next time.'});setTimeout(()=>conn.close(),300);return;}
      if(P.players.length>=MAX){send(conn,{t:'denied',why:'This party is full.'});setTimeout(()=>conn.close(),300);return;}
      let name=String(d.name||'Guest').slice(0,18);if(P.players.some(p=>norm(p.name)===norm(name)))name+=` ${P.players.length+1}`;
      P.conns.set(from,conn);
      P.players.push({id:from,name,color:COLORS[P.players.length%COLORS.length],score:0,streak:0,correct:0,fast:0,best:null,online:true});
      send(conn,{t:'welcome',id:from,code:P.code});
      toast(`🎟 ${name} joined the party`);syncLobby();return;
    }
    if(d.t==='ready'&&P.phase==='loading'){P.ready.add(from);maybeGo();return;}
    if(d.t==='answer'&&P.phase==='round'){
      if(P.answers.has(from))return;
      P.answers.set(from,{idx:d.idx==null?null:+d.idx,el:Math.min(CLIP,Math.max(0,+d.el||CLIP))});
      broadcast({t:'answered',id:from});
      maybeReveal();
    }
  }
  function syncLobby(){
    if(!P||!P.host)return;
    if(P.phase==='lobby')broadcast({t:'lobby',players:pub(),settings:P.settings,code:P.code});
    else broadcast({t:'players',players:pub()});
  }
  const pub=()=>P.players.map(p=>({id:p.id,name:p.name,color:p.color,score:p.score,online:p.online,isHost:!!p.isHost,correct:p.correct,fast:p.fast,best:p.best}));

  /* host: settings + start */
  $('#pIndustry').onchange=e=>{P.settings.cat=e.target.value;syncLobby();};
  $('#pDifficulty').onchange=e=>{P.settings.diff=e.target.value;syncLobby();};
  $('#pScenes').onchange=e=>{P.settings.scenes=+e.target.value;syncLobby();};
  $('#pStart').onclick=()=>{
    if(!P||!P.host)return;
    if(P.players.filter(p=>p.online).length<2){toast('Share the code. You need at least one friend to start a party.');return;}
    const pool=catSongs(P.settings.cat);if(!pool.length){toast('No songs in that industry yet');return;}
    const used=new Set(),S=P.settings;
    P.scenes=Array.from({length:S.scenes},(_,r)=>{
      const d=S.diff==='progressive'?progDiff(r,S.scenes):S.diff,song=pickSong(pool,d,used);
      return {r,diff:d,song:{title:song.title,category:song.category,start:song.start||0,file:song.file||null,youtube:song.youtube||null,demo:song.def?DEMO.indexOf(song.def):null},options:makeOptions(song,pool,DIFF[d].opts)};
    });
    P.players.forEach(p=>{p.score=0;p.streak=0;p.correct=0;p.fast=0;p.best=null;});
    P.idx=-1;P.log=[];hostNextScene();
  };
  function hostNextScene(){
    P.idx++;
    if(P.idx>=P.scenes.length){P.phase='final';broadcast({t:'final',players:pub(),log:P.log});return;}
    P.phase='loading';P.ready=new Set();P.answers=new Map();
    const sc=P.scenes[P.idx];
    broadcast({t:'scene',i:P.idx,n:P.scenes.length,diff:sc.diff,song:sc.song,options:sc.options,cat:P.settings.cat,players:pub()});
    clearTimeout(P.loadT);P.loadT=setTimeout(()=>{if(P.phase==='loading')go();},8000);
  }
  function maybeGo(){if(P.phase!=='loading')return;const need=P.players.filter(p=>p.online).every(p=>P.ready.has(p.id));if(need)go();}
  function go(){clearTimeout(P.loadT);P.phase='round';broadcast({t:'go'});clearTimeout(P.roundT);P.roundT=setTimeout(()=>{if(P.phase==='round')reveal();},(CLIP+6.5)*1000);}
  function maybeReveal(){if(P.phase!=='round')return;if(P.players.filter(p=>p.online).every(p=>P.answers.has(p.id)))reveal();}
  function reveal(){
    clearTimeout(P.roundT);P.phase='reveal';
    const sc=P.scenes[P.idx],D=DIFF[sc.diff],results=[];
    P.players.forEach(p=>{
      const a=P.answers.get(p.id)||{idx:null,el:CLIP},pick=a.idx==null?null:sc.options[a.idx],ok=pick===sc.song.title;let pts=0;
      if(ok){p.streak++;p.correct++;pts=scoreOf(D,a.el,p.streak);p.score+=pts;if(a.el<=FAST)p.fast++;p.best=p.best==null?a.el:Math.min(p.best,a.el);}else p.streak=0;
      results.push({id:p.id,pick,ok,el:a.el,pts,fast:ok&&a.el<=FAST,streak:p.streak,answered:a.idx!=null});
    });
    P.log.push({title:sc.song.title,diff:sc.diff,results});
    broadcast({t:'reveal',answer:sc.song.title,results,players:pub(),last:P.idx>=P.scenes.length-1});
  }

  /* ---------- guest ---------- */
  function join(code,name){
    const peer=new Peer(undefined,{debug:0});let opened=false;
    peer.on('open',id=>{
      const conn=peer.connect(PREFIX+code,{reliable:true});
      const t=setTimeout(()=>{if(!opened){msg(`No party found with code ${code}. Check the code and that the host's page is still open.`);try{peer.destroy();}catch(e){}}},9000);
      conn.on('open',()=>{opened=true;clearTimeout(t);P={host:false,peer,hostConn:conn,code,myId:id,players:[],phase:'lobby'};send(conn,{t:'join',name});});
      conn.on('data',d=>handle(d,conn,false));
      conn.on('close',()=>{if(P&&!P.leaving){toast('The host closed the party');cleanup();show('home');}});
    });
    peer.on('error',err=>{
      if(err.type==='peer-unavailable')msg(`No party found with code ${code}. Check the code and that the host's page is still open.`);
      else if(!P)msg('Could not join: '+(err.type||err.message));
      else toast('Connection problem: '+(err.type||'network'));
    });
  }

  /* ---------- messages every player handles (the host handles its own broadcasts too) ---------- */
  function handle(d,conn,local){
    if(!P||!d)return;
    switch(d.t){
      case 'welcome':P.myId=d.id;break;
      case 'denied':msg(d.why);toast(d.why,4000);cleanup();break;
      case 'lobby':
        if(!P.host){P.players=d.players;P.settings=d.settings;P.code=d.code;}
        if(!isActive('lobby')){P.phase='lobby';enterLobby(P.host);}else renderLobby();break;
      case 'players':if(G.game&&G.game.party){G.game.players=d.players;renderPartyBoard();}break;
      case 'scene':P.phase='loading';onScene(d);break;
      case 'go':onGo();break;
      case 'answered':markAnswered(d.id);break;
      case 'reveal':onReveal(d);break;
      case 'final':onFinal(d);break;
    }
  }

  /* ---------- lobby UI ---------- */
  function enterLobby(isHost){
    if(isHost){P.players.forEach(p=>{p.score=0;});}
    $('#hostSettings').style.display=isHost?'':'none';$('#guestWait').style.display=isHost?'none':'';
    $('#pIndustry').innerHTML=industryOptions();
    show('lobby');renderLobby(true);
    if(isHost)syncLobby();
  }
  function renderLobby(flip){
    if(!P)return;
    const tiles=$('#codeTiles');
    if(flip||tiles.dataset.code!==P.code){tiles.dataset.code=P.code;tiles.innerHTML=[...P.code].map((c,i)=>`<span class="tile" style="animation-delay:${i*.12}s">${c}</span>`).join('');}
    const n=P.players.length;
    $('#lobbyCount').textContent=`${n} of ${MAX} seats taken`;$('#stubCount').textContent=`${n} / ${MAX}`;
    $('#lobbyHint').textContent=P.host?'Share this code. Friends open the game, tap “Join with a code” and enter it.':`You're in! Hosted by ${(P.players.find(p=>p.isHost)||{}).name||'the host'}.`;
    $('#guests').innerHTML=P.players.map(p=>`<div class="guest ${p.id===P.myId?'me':''}"><span class="av" style="--c:${p.color}">${esc(p.name[0].toUpperCase())}</span><span>${esc(p.name)}${p.isHost?' <em>host</em>':''}${p.id===P.myId?' <em>you</em>':''}</span></div>`).join('');
    if(P.settings){
      if(P.host){$('#pIndustry').value=P.settings.cat;$('#pDifficulty').value=P.settings.diff;$('#pScenes').value=String(P.settings.scenes);}
      $('#guestProg').textContent=`Tonight: ${CATS[P.settings.cat]?CATS[P.settings.cat].label:''} · ${P.settings.diff==='progressive'?'Progressive':DIFF[P.settings.diff].label} · ${P.settings.scenes} scenes`;
    }
  }
  $('#copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(P.code);toast('Code copied');}catch(e){toast(`Your code is ${P.code}`);}};
  $('#copyLink').onclick=async()=>{const link=`${location.origin}${location.pathname}?room=${P.code}`;try{await navigator.clipboard.writeText(link);toast('Invite link copied');}catch(e){toast(link,5000);}};
  $('#leaveBtn').onclick=()=>leave();

  /* ---------- scenes ---------- */
  function sceneSong(s){
    if(s.demo!=null&&s.demo>=0){const d=DEMO[s.demo];return {id:'demo-'+d.seed,title:d.title,category:'demo',start:0,def:d};}
    return {id:s.file||('yt-'+s.youtube),title:s.title,category:s.category,start:s.start||0,file:s.file,youtube:s.youtube};
  }
  async function onScene(d){
    stopAll();hideCelebration();
    const song=sceneSong(d.song);
    const players=d.players.map(p=>({...p}));
    G.game={party:true,players,turns:[{p:-1,r:d.i,diff:d.diff,song,options:d.options}],i:0,live:false,answered:false,cat:d.cat,rounds:d.n,humans:players.length,isYT:!!song.youtube};
    const g=G.game,D=DIFF[d.diff];
    $('#gPlayer').textContent='Party';$('#gRound').textContent=`Scene ${d.i+1} of ${d.n}`;
    $('#gDiff').className='badge '+d.diff;$('#gDiff').textContent=D.label;
    $('#quitBtn').textContent='Leave';
    $('#nextBtn').hidden=true;$('#feedback').textContent='';$('#feedback').className='feedback';$('#botline').textContent='';$('#bottag').textContent='';$('#partyres').innerHTML='';
    P.answeredIds=new Set();renderPartyBoard();
    const box=$('#opts');box.className='opts n'+d.options.length;box.innerHTML='';
    d.options.forEach((o,i)=>{const b=document.createElement('button');b.className='opt wait';b.disabled=true;b.innerHTML=`<span class="k">${i+1}</span><span>${esc(o)}</span>`;b.onclick=()=>finish(i);box.appendChild(b);});
    $('#status').textContent='Loading';$('#secs').textContent=CLIP;setRing(0);$('#zonetag').textContent='';
    const yb=$('#ytBox');yb.classList.remove('revealed');yb.hidden=!song.youtube;
    $('#ytBox .veil').innerHTML='<div><b>Listening…</b>The video is revealed after everyone answers.</div>';
    if(!isActive('game'))show('game');
    // preload, then tell the host we're ready
    try{if(song.youtube)await ytPlayer();else g.buf=await loadBuffer(song);}catch(e){g.failed=true;}
    if(G.game!==g)return;
    $('#status').textContent='Ready';
    toHost({t:'ready'});if(!P.host)return;
  }
  function onGo(){
    const g=G.game;if(!g||!g.party)return;
    countdown(g.turns[0].r,g.rounds,()=>{
      if(G.game!==g)return;
      const song=g.turns[0].song;
      if(g.failed){toast("This song couldn't load on your device");g.live=true;g.start=performance.now();finish(null);return;}
      if(song.youtube){
        g.ytWaiting=true;
        try{ytP.setVolume(100);ytP.unMute();ytP.loadVideoById({videoId:song.youtube,startSeconds:song.start||0});}catch(e){mediaFailed();return;}
        $('#status').textContent='Buffering';
        g.tapT=setTimeout(()=>{if(g.ytWaiting){$('#ytBox .veil').innerHTML='<div><b>Tap to hear the song</b><button class="btn primary sm" id="ytTap" style="margin-top:8px">▶ Play</button></div>';$('#ytTap').onclick=()=>{try{ytP.playVideo();}catch(e){}};}},2500);
        g.ytTimer=setTimeout(()=>{if(g.ytWaiting)mediaFailed();},14000);
      }else{playBuffer(g.buf,song.start||0,CLIP);beginClock(g,50);}
    });
  }
  function countdown(i,n,done){
    const ov=$('#countdown'),num=$('#cdNum');$('#cdSub').textContent=`Scene ${i+1} of ${n}`;ov.hidden=false;
    let k=3;const tick=()=>{if(k===0){ov.hidden=true;done();return;}num.textContent=k;num.classList.remove('pop');void num.offsetWidth;num.classList.add('pop');tickSound(k);k--;setTimeout(tick,650);};tick();
  }
  function tickSound(k){try{const c=ctx(),o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type='sine';o.frequency.value=k===1?880:660;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.2);}catch(e){}}
  function mediaFailed(){
    const g=G.game;if(!g||!g.party)return;g.ytWaiting=false;clearTimeout(g.ytTimer);clearTimeout(g.tapT);
    toast("This song can't play on your device. Your answer is skipped.");
    if(!g.answered){g.live=true;g.start=performance.now()-CLIP*1000;finish(null);}
  }
  function localAnswer(idx,el){
    const g=G.game;clearTimeout(g.tapT);
    $$('.opt').forEach((b,i)=>{b.disabled=true;if(i===idx)b.classList.add('picked');});
    $('#status').textContent='Locked in';$('#secs').textContent=idx==null?'–':el.toFixed(1);$('#zonetag').textContent='';
    $('#feedback').className='feedback';$('#feedback').textContent=idx==null?'Time’s up. Waiting for the others…':`Locked in at ${el.toFixed(1)}s. Waiting for the others…`;
    g.myEl=el;
    toHost({t:'answer',idx,el});
  }
  function markAnswered(id){if(!P)return;P.answeredIds=P.answeredIds||new Set();P.answeredIds.add(id);renderPartyBoard();}
  function renderPartyBoard(){
    const g=G.game;if(!g||!g.party)return;
    $('#board').innerHTML=g.players.map(p=>`<div class="chip ${p.id===P.myId?'on':''} ${P.answeredIds&&P.answeredIds.has(p.id)?'done':''} ${p.online===false?'off':''}" style="--c:${p.color}"><span class="av" style="--c:${p.color}">${esc(p.name[0].toUpperCase())}</span>${esc(p.name)} <b>${p.score}</b></div>`).join('');
  }
  function onReveal(d){
    const g=G.game;if(!g||!g.party)return;
    g.live=false;g.answered=true;clearTimeout(g.tapT);
    if(g.isYT)$('#ytBox').classList.add('revealed');else stopPlayback(.4);
    g.players=d.players;P.answeredIds=new Set();renderPartyBoard();
    const t=g.turns[0];
    $$('.opt').forEach((b,i)=>{b.disabled=true;const o=t.options[i],was=b.classList.contains('picked');b.classList.remove('picked');if(o===d.answer)b.classList.add('good');else if(was)b.classList.add('bad');else b.classList.add('dim');});
    const mine=d.results.find(r=>r.id===P.myId)||{};
    const fb=$('#feedback');
    if(mine.ok){fb.className='feedback ok';fb.textContent=`${mine.fast?'⚡ Lightning!':'Correct!'} ${d.answer}, ${mine.el.toFixed(1)}s · +${mine.pts}`;floatPts('+'+mine.pts);}
    else{fb.className='feedback no';fb.textContent=`It was ${d.answer}.`;}
    $('#status').textContent=mine.ok?'Correct':'Answer';$('#secs').textContent=mine.ok?'✓':'✕';
    const byId=Object.fromEntries(d.players.map(p=>[p.id,p]));
    const sorted=d.results.slice().sort((a,b)=>(b.ok-a.ok)||(a.el-b.el));
    $('#partyres').innerHTML=sorted.map((r,k)=>{const p=byId[r.id]||{name:'?',color:'#999'};
      return `<div class="pr ${r.ok?'ok':'no'}" style="animation-delay:${k*.08}s"><span class="av" style="--c:${p.color}">${esc(p.name[0].toUpperCase())}</span><span class="pn">${esc(p.name)}${r.id===P.myId?' <em>you</em>':''}</span><span class="pp">${r.ok?`✓ ${r.el.toFixed(1)}s${r.fast?' ⚡':''}`:r.answered?'✕ '+esc(r.pick||''):'no answer'}</span><b>${r.ok?'+'+r.pts:''}</b></div>`;}).join('');
    const nb=$('#nextBtn');
    if(P.host){nb.textContent=d.last?'Show the final scores':'Next scene';nb.hidden=false;}
    else{nb.hidden=true;fb.textContent+=' · Waiting for the host…';}
    if(mine.fast)celebrate(mine.pts);else sfx(!!mine.ok);
  }
  function next(){if(P&&P.host&&P.phase==='reveal')hostNextScene();}
  function onFinal(d){
    stopAll();hideCelebration();P.phase='final';
    const ranked=d.players.slice().sort((a,b)=>b.score-a.score),top=ranked[0],tie=ranked.length>1&&ranked[1].score===top.score;
    const meP=ranked.find(p=>p.id===P.myId);
    $('#winner').textContent=tie?"It's a tie":top.id===P.myId?'You win the night':`${top.name} wins`;
    const order=[ranked[1],ranked[0],ranked[2]].filter(Boolean);
    $('#podium').innerHTML=order.map(p=>{const r=ranked.indexOf(p);return `<div class="pod p${r+1}"><span class="av" style="--c:${p.color}">${esc(p.name[0].toUpperCase())}</span><div class="nm">${esc(p.name)}</div><div class="sc">${p.score}</div><div class="blk">${['I','II','III'][r]}</div></div>`;}).join('');
    $('#ranking').innerHTML=`<tr><th>#</th><th>Player</th><th>Score</th><th>Correct</th><th class="hide-sm">Lightning</th><th class="hide-sm">Fastest</th></tr>`+
      ranked.map((p,i)=>`<tr><td>${i+1}</td><td class="n"><span class="av" style="--c:${p.color}">${esc(p.name[0].toUpperCase())}</span>${esc(p.name)}${p.id===P.myId?' <small style="color:var(--muted)">(you)</small>':''}</td><td><b>${p.score}</b></td><td>${p.correct}/${d.log.length}</td><td class="hide-sm">${p.fast}</td><td class="hide-sm">${p.best==null?'–':p.best.toFixed(1)+'s'}</td></tr>`).join('');
    $('#bestLine').textContent=`· party ${P.code}`;
    const byId=Object.fromEntries(d.players.map(p=>[p.id,p]));
    $('#review').innerHTML=d.log.map(l=>{const w=l.results.filter(r=>r.ok).sort((a,b)=>a.el-b.el)[0],mine=l.results.find(r=>r.id===P.myId)||{};
      return `<div class="rv ${mine.ok?'ok':'no'}"><span class="m">${mine.ok?'✓':'✕'}</span><div class="tt"><b>${esc(l.title)}</b> <small>· ${DIFF[l.diff].label}${w?` · fastest: ${esc((byId[w.id]||{}).name||'?')} ${w.el.toFixed(1)}s`:' · nobody got it'}</small></div><span class="pt">${mine.ok?'+'+mine.pts:''}</span></div>`;}).join('');
    $('#rematchBtn').textContent=P.host?'Back to the lobby':'Waiting for the host…';$('#rematchBtn').disabled=!P.host;
    show('results');if(meP&&meP===top)confetti();
  }
  function rematch(){if(P&&P.host){P.phase='lobby';P.players=P.players.filter(p=>p.online);P.players.forEach(p=>{p.score=0;});enterLobby(true);}}
  function cleanup(){
    if(!P)return;P.leaving=true;
    try{P.conns&&P.conns.forEach(c=>c.close());}catch(e){}
    try{P.hostConn&&P.hostConn.close();}catch(e){}
    try{P.peer&&P.peer.destroy();}catch(e){}
    clearTimeout(P.loadT);clearTimeout(P.roundT);
    P=null;$('#quitBtn').textContent='Quit';$('#rematchBtn').textContent='Rematch';$('#rematchBtn').disabled=false;
    if(G.game&&G.game.party)G.game=null;
  }
  function leave(){const wasHost=P&&P.host;cleanup();if(wasHost)toast('You closed the party');show('home');}

  // results buttons behave differently during a party
  $('#rematchBtn').addEventListener('click',e=>{if(P){e.stopImmediatePropagation();rematch();}},true);
  $$('#results [data-go="home"]').forEach(b=>b.addEventListener('click',e=>{if(P){e.stopImmediatePropagation();leave();}},true));
  window.addEventListener('beforeunload',()=>{if(P)cleanup();});

  // invite link: ?room=CODE opens the join screen with the code filled in
  const room=new URLSearchParams(location.search).get('room');
  if(room&&/^[A-Z0-9]{5}$/i.test(room)){
    setTimeout(()=>{openScreen('join');[...room.toUpperCase()].forEach((c,i)=>$$('#codeIn input')[i].value=c);},300);
  }

  return {localAnswer,next,leave,mediaFailed,get active(){return !!P;}};
})();
