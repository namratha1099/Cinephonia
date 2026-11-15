/* Cinephonia – Admin Studio. Uploads songs to the GitHub repo through the GitHub REST API.
   The token is kept only in this browser (sessionStorage, or localStorage if "Remember" is ticked). */
const A={songs:[],sha:null,connected:false,queue:[],dirty:false,blobs:{},filter:'all',previewing:null};
const GH={o:'',r:'',b:'main',t:''};
const CLIP=15;
const SKEY='cp-admin';
const catOpts=v=>CAT_ORDER.map(c=>`<option value="${c}" ${c===v?'selected':''}>${CATS[c].label}</option>`).join('');
const diffOpts=v=>Object.keys(DIFF).map(d=>`<option value="${d}" ${d===v?'selected':''}>${DIFF[d].label}</option>`).join('');


/* ---------- GitHub API ---------- */
const encPath=p=>p.split('/').map(encodeURIComponent).join('/');
async function gh(path,opts={},raw=false){
  const headers={'Accept':raw?'application/vnd.github.raw':'application/vnd.github+json','Authorization':`Bearer ${GH.t}`,'X-GitHub-Api-Version':'2022-11-28'};
  if(opts.body)headers['Content-Type']='application/json';
  const res=await fetch(`https://api.github.com/repos/${encodeURIComponent(GH.o)}/${encodeURIComponent(GH.r)}${path}`,{...opts,headers,cache:'no-store'});
  if(!res.ok){let m=`${res.status}`;try{m+=' '+(await res.json()).message;}catch(e){}const er=new Error(m);er.status=res.status;throw er;}
  if(raw)return res.arrayBuffer();
  return res.status===204?null:res.json();
}
async function getFile(p){try{return await gh(`/contents/${encPath(p)}?ref=${encodeURIComponent(GH.b)}`);}catch(e){if(e.status===404)return null;throw e;}}
const putFile=(p,b64,message,sha)=>gh(`/contents/${encPath(p)}`,{method:'PUT',body:JSON.stringify({message,content:b64,branch:GH.b,...(sha?{sha}:{})})});
const delFile=(p,sha,message)=>gh(`/contents/${encPath(p)}`,{method:'DELETE',body:JSON.stringify({message,sha,branch:GH.b})});
function b64enc(str){const bytes=new TextEncoder().encode(str);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin);}
function b64dec(b64){const bin=atob(b64.replace(/\s/g,''));return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));}
const fileB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(f);});

/* ---------- Connection ---------- */
function status(msg,kind=''){const s=$('#ghStatus');s.className='ghstatus '+kind;s.innerHTML=msg;}
function readCreds(){GH.o=$('#ghOwner').value.trim();GH.r=$('#ghRepo').value.trim();GH.b=$('#ghBranch').value.trim()||'main';GH.t=$('#ghToken').value.trim();}
function storeCreds(){
  const data={o:GH.o,r:GH.r,b:GH.b,t:GH.t};
  try{sessionStorage.setItem(SKEY,JSON.stringify(data));}catch(e){}
  if($('#remember').checked)LS.set(SKEY,data);else LS.del(SKEY);
}
async function connect(){
  readCreds();
  if(!GH.o||!GH.r||!GH.t){status('Fill in owner, repository and token first.','err');return;}
  status('Connecting…');$('#connectBtn').disabled=true;
  try{
    const repo=await gh('');
    if(repo.permissions&&!repo.permissions.push)throw new Error('This token can read the repository but cannot write to it. Give it “Contents: Read and write”.');
    await loadManifest();
    A.connected=true;storeCreds();
    status(`✅ Connected to <b>${esc(repo.full_name)}</b> (branch <b>${esc(GH.b)}</b>). ${A.songs.length} song${A.songs.length===1?'':'s'} in the library.`,'ok');
  }catch(e){
    A.connected=false;
    status(`❌ Couldn't connect: ${esc(e.message)}. Check the owner, repository name, branch and token.`,'err');
  }
  $('#connectBtn').disabled=false;render();
}
async function loadManifest(){
  const f=await getFile('songs.json');
  A.sha=f?f.sha:null;
  const j=f&&f.content?JSON.parse(b64dec(f.content)):{songs:[]};
  A.songs=(j.songs||[]).map(s=>({...s,id:s.id||s.file||('yt-'+s.youtube),difficulty:DIFF[s.difficulty]?s.difficulty:'medium',start:+s.start||0}));
  A.dirty=false;
}
const manifestJSON=()=>JSON.stringify({songs:A.songs.map(s=>{const o={id:s.id,title:s.title.trim()||'Untitled',category:s.category,difficulty:s.difficulty,start:+s.start||0};if(s.youtube)o.youtube=s.youtube;else o.file=s.file;return o;})},null,2)+'\n';
async function saveManifest(msg){
  const body=b64enc(manifestJSON());
  try{const r=await putFile('songs.json',body,msg,A.sha);A.sha=r.content.sha;}
  catch(e){
    if(e.status!==409&&e.status!==422)throw e;
    const f=await getFile('songs.json');A.sha=f&&f.sha;const r=await putFile('songs.json',body,msg,A.sha);A.sha=r.content.sha;
  }
  A.dirty=false;
}
$('#connectBtn').onclick=connect;
$('#forgetBtn').onclick=()=>{LS.del(SKEY);try{sessionStorage.removeItem(SKEY);}catch(e){}$('#ghToken').value='';GH.t='';A.connected=false;status('Token removed from this device.');render();};

/* ---------- Queue (new songs) ---------- */
const fileIn=$('#file'),drop=$('#drop');
fileIn.onchange=()=>{addToQueue(fileIn.files);fileIn.value='';};
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>addToQueue(e.dataTransfer.files));
function addToQueue(files){
  const arr=[...files].filter(f=>(f.type||'').startsWith('audio')||/\.(mp3|wav|m4a|ogg|aac)$/i.test(f.name));
  if(!arr.length){toast('Please choose audio files');return;}
  const big=arr.filter(f=>f.size>25*1024*1024);if(big.length)toast(`${big.length} file(s) over 25 MB skipped. Trim them to a short clip first.`,4000);
  const lastCat=LS.get('cp-admin-cat','tollywood');
  arr.filter(f=>f.size<=25*1024*1024).forEach(f=>A.queue.push({id:'q'+Date.now()+Math.random().toString(36).slice(2,6),file:f,title:cleanName(f.name),category:lastCat,difficulty:'medium',start:0}));
  render();
}
async function uploadQueue(){
  if(!A.connected){toast('Connect to GitHub first');return;}
  if(!A.queue.length)return;
  const list=A.queue.slice(),bar=$('#prog'),fill=bar.firstElementChild;bar.hidden=false;fill.style.width='0';
  $('#uploadBtn').disabled=true;let ok=0;
  for(let i=0;i<list.length;i++){
    const q=list[i];status(`⬆ Uploading ${i+1}/${list.length}: <b>${esc(q.title)}</b>…`);
    const ext=((q.file.name.match(/\.([a-z0-9]+)$/i)||[])[1]||'mp3').toLowerCase();
    const path=`songs/${q.category}/${slug(q.title)}-${Math.random().toString(36).slice(2,6)}.${ext}`;
    try{
      await putFile(path,await fileB64(q.file),`Add song: ${q.title} (${CATS[q.category].label})`);
      const s={id:path,title:q.title.trim()||'Untitled',category:q.category,difficulty:q.difficulty,start:+q.start||0,file:path};
      A.songs.push(s);A.blobs[s.id]=q.file;A.queue=A.queue.filter(x=>x!==q);ok++;
    }catch(e){toast(`Upload failed for ${q.title}: ${e.message}`,4500);}
    fill.style.width=((i+1)/list.length*100)+'%';
  }
  if(ok){
    try{await saveManifest(`Add ${ok} song${ok>1?'s':''} to Cinephonia`);
      status(`✅ Published ${ok} song${ok>1?'s':''}. The live game updates in about a minute.`,'ok');}
    catch(e){status(`⚠ Audio uploaded, but saving songs.json failed: ${esc(e.message)}. Press “Save changes” to retry.`,'err');A.dirty=true;}
  }else status('Nothing was uploaded. Check the messages above.','err');
  setTimeout(()=>bar.hidden=true,1200);render();
}
$('#uploadBtn').onclick=uploadQueue;

/* ---------- Library edits ---------- */
async function deleteSong(s,btn){
  if(!A.connected){toast('Connect to GitHub first');return;}
  if(!btn.classList.contains('arm')){btn.classList.add('arm');btn.textContent='?';btn.title='Click again to delete';setTimeout(()=>{btn.classList.remove('arm');btn.textContent='✕';},2500);return;}
  btn.disabled=true;status(`Deleting <b>${esc(s.title)}</b>…`);
  try{
    if(s.file){const f=await getFile(s.file);if(f)await delFile(s.file,f.sha,`Remove song: ${s.title}`);}
    A.songs=A.songs.filter(x=>x!==s);await saveManifest(`Remove ${s.title} from Cinephonia`);
    status(`Removed <b>${esc(s.title)}</b>.`,'ok');
  }catch(e){status(`❌ Delete failed: ${esc(e.message)}`,'err');}
  render();
}
$('#saveBtn').onclick=async()=>{
  if(!A.connected){toast('Connect to GitHub first');return;}
  $('#saveBtn').disabled=true;status('Saving changes…');
  try{await saveManifest('Update Cinephonia song details');status('✅ Changes saved. The live game updates in about a minute.','ok');}
  catch(e){status(`❌ Save failed: ${esc(e.message)}`,'err');}
  render();
};
$('#dlBtn').onclick=()=>{
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([manifestJSON()],{type:'application/json'}));a.download='songs.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};
$$('#libFilter button').forEach(b=>b.onclick=()=>{A.filter=b.dataset.f;$$('#libFilter button').forEach(x=>x.classList.toggle('on',x===b));render();});

/* ---------- Preview ---------- */
const prevCache={};
async function previewBuffer(item){
  if(item.file instanceof File)return decode(await item.file.arrayBuffer());
  if(prevCache[item.id])return prevCache[item.id];
  let ab;
  if(A.blobs[item.id])ab=await A.blobs[item.id].arrayBuffer();
  else{
    try{const r=await fetch(item.file,{cache:'no-store'});if(!r.ok)throw new Error(r.status);ab=await r.arrayBuffer();}
    catch(e){if(!A.connected)throw e;ab=await gh(`/contents/${encPath(item.file)}?ref=${encodeURIComponent(GH.b)}`,{},true);}
  }
  return prevCache[item.id]=await decode(ab);
}
async function preview(item){
  if(A.previewing===item.id){stopPlayback();ytPrevStop();A.previewing=null;renderPv();return;}
  if(item.youtube){stopPlayback();ytPreview(item.youtube,+item.start||0,item.id);return;}
  ytPrevStop();
  ctx();
  try{const b=await previewBuffer(item);const me=playBuffer(b,+item.start||0,CLIP);A.previewing=item.id;renderPv();
    setTimeout(()=>{if(A.previewing===item.id&&(cur===me||!cur)){A.previewing=null;renderPv();}},(me.dur+.3)*1000);}
  catch(e){toast("Couldn't load this file for preview yet. GitHub Pages may still be updating.");}
}
function renderPv(){$$('.pv').forEach(b=>{const on=b.dataset.id===A.previewing;b.textContent=on?'■':'▶';b.classList.toggle('on',on);});}

/* ---------- YouTube links ---------- */
let ytPrevP=null,ytPrevTimer=null;
async function ytPreview(id,start,itemId){
  const box=$('#ytPreview');box.hidden=false;
  try{
    const YT=await loadYouTubeAPI();
    if(!ytPrevP)ytPrevP=await new Promise(res=>{const p=new YT.Player('ytPrev',{width:320,height:180,playerVars:{playsinline:1,rel:0,modestbranding:1},
      events:{onReady:()=>res(p),onError:e=>toast(e.data===101||e.data===150?'The owner of this video does not allow it to be played on other sites. Choose another upload of the song.':'YouTube could not play this video.',5000)}});});
    ytPrevP.loadVideoById({videoId:id,startSeconds:start});
    A.previewing=itemId||null;renderPv();
    clearTimeout(ytPrevTimer);ytPrevTimer=setTimeout(()=>{try{ytPrevP.pauseVideo();}catch(e){}if(A.previewing===itemId){A.previewing=null;renderPv();}},(CLIP+1)*1000);
  }catch(e){box.hidden=true;toast('YouTube could not load. Check your connection or ad-blocker.');}
}
function ytPrevStop(){clearTimeout(ytPrevTimer);try{ytPrevP&&ytPrevP.pauseVideo();}catch(e){}$('#ytPreview').hidden=true;}
$('#ytPrevClose').onclick=()=>{ytPrevStop();A.previewing=null;renderPv();};
$('#ytCat').innerHTML=catOpts(LS.get('cp-admin-cat','tollywood'));
$('#ytDiff').innerHTML=diffOpts('medium');
$('#ytCat').onchange=e=>LS.set('cp-admin-cat',e.target.value);
$('#ytUrl').oninput=()=>{const p=parseYouTube($('#ytUrl').value);if(p&&p.start)$('#ytStart').value=p.start;};
$('#ytPrevBtn').onclick=()=>{const p=parseYouTube($('#ytUrl').value);if(!p){toast('Paste a valid YouTube link first');return;}stopPlayback();ytPreview(p.id,+$('#ytStart').value||0,null);};
$('#ytAddBtn').onclick=async()=>{
  const p=parseYouTube($('#ytUrl').value),title=$('#ytTitle').value.trim();
  if(!p){toast('That does not look like a YouTube link');return;}
  if(!title){toast('Add the movie title');$('#ytTitle').focus();return;}
  if(A.songs.some(s=>s.youtube===p.id&&(+s.start||0)===(+$('#ytStart').value||0))){toast('This clip is already in the library');return;}
  const s={id:`yt-${p.id}-${Math.random().toString(36).slice(2,6)}`,title,category:$('#ytCat').value,difficulty:$('#ytDiff').value,start:Math.max(0,+$('#ytStart').value||0),youtube:p.id};
  A.songs.push(s);ytPrevStop();
  $('#ytUrl').value='';$('#ytTitle').value='';$('#ytStart').value=0;
  if(A.connected){
    const b=$('#ytAddBtn');b.disabled=true;status(`Publishing <b>${esc(title)}</b>…`);
    try{await saveManifest(`Add YouTube song: ${title}`);status(`Added <b>${esc(title)}</b>. The live game updates in about a minute.`,'ok');}
    catch(e){A.dirty=true;status(`Couldn't save: ${esc(e.message)}. Press “Save changes” to retry.`,'err');}
    b.disabled=false;
  }else{A.dirty=true;toast('Added to the list. Connect to GitHub and press “Save changes” to publish, or download songs.json.',4500);}
  render();
};
$$('#addTabs button').forEach(b=>b.onclick=()=>{$$('#addTabs button').forEach(x=>x.classList.toggle('on',x===b));$('#tab-yt').hidden=b.dataset.t!=='yt';$('#tab-file').hidden=b.dataset.t!=='file';});

/* ---------- Rendering ---------- */
function rowEl(item,isQueue){
  const row=document.createElement('div');row.className='srow';
  row.innerHTML=`<button class="ic pv" data-id="${esc(item.id)}" title="Preview 15 seconds">▶</button>
    <label class="fl t">Movie title<input class="ti" maxlength="80"></label>
    <label class="fl c">Category<select class="ca">${catOpts(item.category)}</select></label>
    <label class="fl d">Difficulty<select class="di">${diffOpts(item.difficulty)}</select></label>
    <label class="fl s">Start at (s)<input class="st" type="number" min="0" step="1"></label>
    <button class="ic del" title="${isQueue?'Remove from list':'Delete song'}" ${!isQueue&&!A.connected?'disabled':''}>✕</button>
    <div class="fname">${isQueue?esc(`${item.file.name} · ${(item.file.size/1048576).toFixed(1)} MB`):item.youtube?`<span class="src">YouTube</span>youtu.be/${esc(item.youtube)}`:`<span class="src">Audio</span>${esc(item.file)}`}</div>`;
  const ti=row.querySelector('.ti'),st=row.querySelector('.st');ti.value=item.title;st.value=item.start||0;
  const changed=()=>{if(!isQueue){A.dirty=true;$('#saveBtn').disabled=!A.connected;}};
  ti.oninput=()=>{item.title=ti.value;changed();};
  st.oninput=()=>{item.start=Math.max(0,+st.value||0);changed();};
  row.querySelector('.ca').onchange=e=>{item.category=e.target.value;if(isQueue)LS.set('cp-admin-cat',item.category);changed();};
  row.querySelector('.di').onchange=e=>{item.difficulty=e.target.value;changed();};
  row.querySelector('.pv').onclick=()=>preview(item);
  row.querySelector('.del').onclick=e=>{if(isQueue){A.queue=A.queue.filter(x=>x!==item);render();}else deleteSong(item,e.currentTarget);};
  return row;
}
function render(){
  const q=$('#queue');q.innerHTML='';A.queue.forEach(it=>q.appendChild(rowEl(it,true)));
  const ub=$('#uploadBtn');ub.disabled=!A.queue.length||!A.connected;
  ub.textContent=A.queue.length?`⬆ Upload & publish ${A.queue.length} song${A.queue.length>1?'s':''}`:'⬆ Upload & publish';
  if(A.queue.length&&!A.connected)ub.title='Connect to GitHub first';
  const lib=$('#library');lib.innerHTML='';
  const list=A.songs.filter(s=>A.filter==='all'||s.category===A.filter);
  if(!list.length)lib.innerHTML=`<div class="empty">${A.songs.length?'No songs in this category yet.':'No songs yet. Add your first ones above.'}</div>`;
  list.forEach(s=>lib.appendChild(rowEl(s,false)));
  const c=CAT_ORDER.map(k=>`${CATS[k].label} ${A.songs.filter(s=>s.category===k).length}`).join(' · ');
  $('#ytAddBtn').textContent=A.connected?'Add & publish':'Add to list';
  $('#libCount').textContent=`(${A.songs.length} total · ${c})`;
  $('#saveBtn').disabled=!A.dirty||!A.connected;
  renderPv();
}

/* ---------- Boot ---------- */
(async()=>{
  injectBackground();eqLoop();
  const cfg=await loadConfig(),g=cfg.github||{};
  let o=g.owner||'',r=g.repo||'',b=g.branch||'main';
  if(!o&&/\.github\.io$/i.test(location.hostname)){o=location.hostname.split('.')[0];r=r||location.pathname.split('/').filter(Boolean)[0]||`${o}.github.io`;if(/\.html$/i.test(r))r=`${o}.github.io`;}
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem(SKEY)||'null');}catch(e){}
  const remembered=LS.get(SKEY,null);saved=saved||remembered;
  $('#ghOwner').value=(saved&&saved.o)||o;$('#ghRepo').value=(saved&&saved.r)||r;$('#ghBranch').value=(saved&&saved.b)||b;
  $('#remember').checked=!!remembered;
  if(saved&&saved.t){$('#ghToken').value=saved.t;}
  A.songs=await loadSongs();render();
  if(saved&&saved.t)connect();
})();
