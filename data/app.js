const DATA_URL = "data/soop_graph_undirected.json";
const SCORE_KEY = "soop-distance-local-top5";
const MIN_FOLLOWERS_TO_SHOW = 10000;
const BLOCKED_IDS = new Set(["2omong"]);
const BLOCKED_NICKS = new Set(["이오몽", "이오몽_"]);

const state = { graph:null, nodes:[], nodesById:{}, adjacency:{}, currentRound:null, score:0, gameOver:false, animating:false, mode:"random", supabase:null, useSupabase:false };
const el = {
  score:document.getElementById("score"), bestScore:document.getElementById("bestScore"), graphStats:document.getElementById("graphStats"), leaderboardMode:document.getElementById("leaderboardMode"),
  randomModeBtn:document.getElementById("randomModeBtn"), selectModeBtn:document.getElementById("selectModeBtn"), selectControls:document.getElementById("selectControls"), selectStart:document.getElementById("selectStart"), selectTarget:document.getElementById("selectTarget"), startSelectedBtn:document.getElementById("startSelectedBtn"),
  startImage:document.getElementById("startImage"), startName:document.getElementById("startName"), startId:document.getElementById("startId"), targetImage:document.getElementById("targetImage"), targetName:document.getElementById("targetName"), targetId:document.getElementById("targetId"),
  guessButtons:document.getElementById("guessButtons"), message:document.getElementById("message"), pathBox:document.getElementById("pathBox"), newGameBtn:document.getElementById("newGameBtn"), leaderboard:document.getElementById("leaderboard"), clearScoresBtn:document.getElementById("clearScoresBtn"), leaderboardNote:document.querySelector(".leaderboard-panel .note"), nameDialog:document.getElementById("nameDialog"), nameForm:document.getElementById("nameForm"), playerName:document.getElementById("playerName")
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function init(){
  document.body.dataset.mode="random";
  if(el.selectControls){ el.selectControls.hidden=true; el.selectControls.classList.add("hidden"); el.selectControls.style.display="none"; }
  setupSupabase();
  const res = await fetch(DATA_URL);
  state.graph = cleanGraph(await res.json());
  state.nodes = state.graph.nodes; state.nodesById = state.graph.nodesById; state.adjacency = state.graph.adjacency;
  el.graphStats.textContent = `스트리머 총 ${state.nodes.length}명`;
  renderGuessButtons(); renderStreamerSelects(); await renderLeaderboard(); setMode("random");
}
function cleanGraph(raw){
  const nodes = (raw.nodes||[]).filter(isAllowedNode);
  const by = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const ids = new Set(nodes.map(n=>n.id));

  const edges=[];
  const seen=new Set();

  for(const e of raw.edges||[]){
    const a=e.a||e.from, b=e.b||e.to;
    if(!a||!b||a===b||!ids.has(a)||!ids.has(b)) continue;

    const key=[a,b].sort().join("__");
    if(seen.has(key)) continue;

    seen.add(key);
    edges.push({a,b,aNick:by[a]?.nick,bNick:by[b]?.nick});
  }

  // 선택 모드에서는 연결이 없는 스트리머도 보여야 하므로 nodes를 제거하지 않습니다.
  // 랜덤 모드는 makeRandomRound()에서 실제 연결 가능한 조합만 골라냅니다.
  return {
    nodes,
    nodesById:by,
    edges,
    adjacency:buildAdj(edges)
  };
}
function isAllowedNode(n){ if(!n) return false; if(BLOCKED_IDS.has(n.id)||BLOCKED_NICKS.has(n.nick)) return false; if(typeof n.followers==="number" && n.followers>0) return n.followers>=MIN_FOLLOWERS_TO_SHOW; return true; }
function buildAdj(edges){ const a={}; for(const e of edges){ (a[e.a]??=[]).push(e.b); (a[e.b]??=[]).push(e.a); } for(const k of Object.keys(a)) a[k]=[...new Set(a[k])]; return a; }
function setupSupabase(){ const url=String(window.SUPABASE_URL||"").trim(), key=String(window.SUPABASE_ANON_KEY||"").trim(); if(url&&key&&window.supabase?.createClient){ state.supabase=window.supabase.createClient(url,key); state.useSupabase=true; if(el.leaderboardMode) el.leaderboardMode.textContent="세계 기록 연동 완료"; if(el.clearScoresBtn) el.clearScoresBtn.style.display="none"; } }
function setMode(mode){
  state.mode=mode;
  state.score=0;
  state.gameOver=false;
  state.animating=false;

  document.body.dataset.mode=mode;

  updateScoreDisplay();
  hidePath();

  el.randomModeBtn.classList.toggle("secondary", mode!=="random");
  el.selectModeBtn.classList.toggle("secondary", mode!=="select");

  const isSelectMode = mode==="select";

  // 랜덤 모드에서는 선택창이 절대 보이지 않게 hidden/class/style을 모두 같이 제어합니다.
  if(el.selectControls){
    el.selectControls.hidden = !isSelectMode;
    el.selectControls.classList.toggle("hidden", !isSelectMode);
    el.selectControls.style.display = isSelectMode ? "grid" : "none";
  }

  if(el.leaderboardNote){
    el.leaderboardNote.textContent = isSelectMode
      ? "선택 모드는 연습용이며 점수와 TOP 5 기록에 반영되지 않습니다."
      : "랜덤 모드 점수만 TOP 5 기록으로 저장됩니다.";
  }

  if(isSelectMode){
    setMessage("선택 모드는 점수와 랭킹에 반영되지 않습니다. 두 스트리머를 선택한 뒤 ‘이 조합으로 시작’을 누르세요.","");
    setGuessButtonsEnabled(false);
    renderPlaceholderStreamers();
  } else {
    nextRandomRound();
  }
}
function renderGuessButtons(){ el.guessButtons.innerHTML=""; [1,2,3,4,5,"6+"].forEach(v=>{ const b=document.createElement("button"); b.textContent=String(v); b.onclick=()=>submitGuess(v); el.guessButtons.appendChild(b); }); }
function renderStreamerSelects(){ const sorted=[...state.nodes].sort((a,b)=>(a.nick||a.id).localeCompare(b.nick||b.id,"ko")); for(const s of [el.selectStart,el.selectTarget]){ s.innerHTML=""; for(const n of sorted){ const o=document.createElement("option"); o.value=n.id; o.textContent=`${n.nick||n.id} (${n.id})`; s.appendChild(o); } } if(sorted.length>=2){ el.selectStart.value=sorted[0].id; el.selectTarget.value=sorted[1].id; } }
function startNewGame(){
  state.score=0;
  state.gameOver=false;
  state.animating=false;
  updateScoreDisplay();
  hidePath();

  if(state.mode==="random"){
    nextRandomRound();
  } else {
    setMessage("선택 모드는 점수와 랭킹에 반영되지 않습니다. 두 스트리머를 선택한 뒤 ‘이 조합으로 시작’을 누르세요.","");
    setGuessButtonsEnabled(false);
    renderPlaceholderStreamers();
  }
}
function nextRandomRound(){ setRound(makeRandomRound()); setMessage("몇 명을 통해야 닿을지 골라보세요.",""); }
function startSelectedRound(){
  const s=el.selectStart.value, t=el.selectTarget.value;

  if(!s||!t||s===t){
    setMessage("서로 다른 두 스트리머를 선택하세요.","bad");
    setGuessButtonsEnabled(false);
    return;
  }

  const path=shortestPath(s,t);

  if(!path){
    setMessage("선택한 두 스트리머는 만날 수 없습니다.","bad");
    setGuessButtonsEnabled(false);
    return;
  }

  state.score=0;
  updateScoreDisplay();
  setRound({start:state.nodesById[s],target:state.nodesById[t],path,distance:path.length-1});
  setMessage("선택 모드는 연습용입니다. 점수와 TOP 5 기록에 반영되지 않습니다.","");
}
function setRound(r){ state.currentRound=r; state.gameOver=false; state.animating=false; renderStreamer("start",r.start); renderStreamer("target",r.target); hidePath(); setGuessButtonsEnabled(true); }
function renderPlaceholderStreamers(){ const a=state.nodesById[el.selectStart.value]||state.nodes[0], b=state.nodesById[el.selectTarget.value]||state.nodes[1]||a; if(a) renderStreamer("start",a); if(b) renderStreamer("target",b); }
function makeRandomRound(){ for(let i=0;i<500;i++){ const start=randomNode(), target=randomNode(); if(!start||!target||start.id===target.id) continue; const path=shortestPath(start.id,target.id); if(!path) continue; const d=path.length-1; if(d>=1&&d<=6) return {start,target,path,distance:d}; } throw new Error("연결된 스트리머 쌍을 찾지 못했습니다."); }
function randomNode(){ return state.nodes[Math.floor(Math.random()*state.nodes.length)]; }
function shortestPath(startId,targetId){ if(startId===targetId) return [startId]; const q=[[startId]], visited=new Set([startId]); while(q.length){ const path=q.shift(), cur=path[path.length-1]; for(const next of state.adjacency[cur]||[]){ if(visited.has(next)) continue; const np=[...path,next]; if(next===targetId) return np; visited.add(next); q.push(np); } } return null; }
async function submitGuess(value){
  if(state.gameOver||state.animating||!state.currentRound) return;

  state.animating=true;
  setGuessButtonsEnabled(false);

  const correct=state.currentRound.distance;
  const isCorrect=value==="6+" ? correct>=6 : Number(value)===correct;

  setMessage("연결 경로를 확인하는 중...","wait");
  await animatePath(state.currentRound.path);

  if(state.mode==="select"){
    state.gameOver=true;
    state.animating=false;

    if(isCorrect){
      setMessage(`정답입니다! 실제 거리는 ${correct}단계입니다. 선택 모드는 점수와 랭킹에 반영되지 않습니다.`,"good");
    } else {
      setMessage(`틀렸습니다. 정답은 ${correct}단계입니다. 선택 모드는 점수와 랭킹에 반영되지 않습니다.`,"bad");
    }

    return;
  }

  if(isCorrect){
    state.score++;
    updateScoreDisplay();
    setMessage(`정답입니다! 실제 거리는 ${correct}단계입니다. +1점`,"good");
    await sleep(1200);
    state.animating=false;
    if(!state.gameOver) nextRandomRound();
    return;
  }

  state.gameOver=true;
  state.animating=false;
  setMessage(`틀렸습니다. 정답은 ${correct}단계였습니다. 게임 종료!`,"bad");
  await maybeSaveHighScore(state.score);
}
function renderStreamer(side,s){ const img=side==="start"?el.startImage:el.targetImage, name=side==="start"?el.startName:el.targetName, id=side==="start"?el.startId:el.targetId; img.src=s.profileImage||""; img.onerror=()=>img.removeAttribute("src"); name.textContent=s.nick||s.id; id.textContent=s.id; }
async function animatePath(path){
  el.pathBox.innerHTML="";
  el.pathBox.classList.remove("hidden");
  el.pathBox.classList.add("dynamic-path","progressive-path");

  const title=document.createElement("div");
  title.className="path-title";
  title.innerHTML=`<span>연결 추적 중</span><strong>???</strong>`;
  el.pathBox.appendChild(title);

  const track=document.createElement("div");
  track.className="path-track dynamic-track progressive-track";
  el.pathBox.appendChild(track);

  function createNode(id,i){
    const n=state.nodesById[id]||{id,nick:id};

    const item=document.createElement("div");
    item.className="path-node dynamic-node progressive-node";

    const ring=document.createElement("div");
    ring.className="node-ring";

    const img=document.createElement("img");
    img.src=n.profileImage||"";
    img.alt=`${n.nick||n.id} 프로필 이미지`;
    img.onerror=()=>img.removeAttribute("src");

    ring.appendChild(img);

    const nm=document.createElement("strong");
    nm.textContent=n.nick||n.id;

    const st=document.createElement("small");
    st.textContent=i===0?"START":`${i} LINK`;

    item.append(ring,nm,st);
    return item;
  }

  function createLink(){
    const link=document.createElement("div");
    link.className="path-link progressive-link";
    link.innerHTML=`<span class="link-line"></span><span class="link-runner"></span><span class="link-spark"></span>`;
    return link;
  }

  const firstNode=createNode(path[0],0);
  track.appendChild(firstNode);
  await sleep(40);
  firstNode.classList.add("active","current");
  title.innerHTML=`<span>시작점 확인</span><strong>START</strong>`;
  await sleep(220);

  for(let i=1;i<path.length;i++){
    const prev=[...track.querySelectorAll(".path-node")].at(-1);
    if(prev){
      prev.classList.remove("current");
      prev.classList.add("passed");
    }

    title.innerHTML=`<span>다음 연결 찾는 중</span><strong>${i}번째</strong>`;

    const link=createLink();
    track.appendChild(link);
    await sleep(40);
    link.classList.add("active");

    await sleep(390);

    const node=createNode(path[i],i);
    track.appendChild(node);
    await sleep(30);
    node.classList.add("active","current");

    

    await sleep(250);
  }

  const nodes=[...track.querySelectorAll(".path-node")];
  nodes.forEach(n=>n.classList.remove("current"));
  nodes[nodes.length-1]?.classList.add("finish");

  title.innerHTML=`<span>연결 완료</span><strong>${path.length-1}단계</strong>`;

  await sleep(220);
}
function hidePath(){ el.pathBox.innerHTML=""; el.pathBox.classList.add("hidden"); }
function setMessage(text,type){ el.message.textContent=text; el.message.className="message"; if(type) el.message.classList.add(type); }
function setGuessButtonsEnabled(enabled){ [...el.guessButtons.querySelectorAll("button")].forEach(b=>b.disabled=!enabled); }
async function maybeSaveHighScore(score){
  if(state.mode!=="random") return;
  if(score<=0) return;

  const scores=await getScores();

  if(!(scores.length<5||score>scores[scores.length-1].score)) return;

  el.playerName.value="";
  el.nameDialog.showModal();

  el.nameForm.onsubmit=async ev=>{
    ev.preventDefault();
    await addScore(el.playerName.value.trim()||"익명",score);
    el.nameDialog.close();
    await renderLeaderboard();
    updateScoreDisplay();
  };
}
async function getScores(){ if(state.useSupabase){ const {data,error}=await state.supabase.from("leaderboard").select("player_name, score, created_at").order("score",{ascending:false}).order("created_at",{ascending:true}).limit(5); if(error){ console.error("Supabase 조회 실패:",error); return []; } return data.map(r=>({name:r.player_name,score:r.score,date:r.created_at})); } try{return JSON.parse(localStorage.getItem(SCORE_KEY))||[]}catch{return[]} }
async function addScore(name,score){ if(state.useSupabase){ const {error}=await state.supabase.from("leaderboard").insert({player_name:name.slice(0,20),score}); if(error){ console.error("Supabase 저장 실패:",error); setMessage("점수 저장에 실패했습니다. Supabase 설정을 확인하세요.","bad"); } return; } const scores=await getScores(); scores.push({name,score,date:new Date().toISOString()}); scores.sort((a,b)=>b.score-a.score); localStorage.setItem(SCORE_KEY,JSON.stringify(scores.slice(0,5))); }
async function renderLeaderboard(){ const scores=await getScores(); el.leaderboard.innerHTML=""; if(scores.length===0){ const li=document.createElement("li"); li.textContent="아직 기록이 없습니다."; el.leaderboard.appendChild(li); updateScoreDisplay(scores); return; } for(const item of scores){ const li=document.createElement("li"); li.innerHTML=`<strong>${escapeHtml(item.name)}</strong> — ${item.score}점`; el.leaderboard.appendChild(li); } updateScoreDisplay(scores); }
async function updateScoreDisplay(existingScores){
  el.score.textContent = state.mode==="select" ? "-" : state.score;
  const scores=existingScores||await getScores();
  el.bestScore.textContent=scores[0]?.score||0;
}
function escapeHtml(v){ return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
el.randomModeBtn.onclick=()=>setMode("random"); el.selectModeBtn.onclick=()=>setMode("select"); el.startSelectedBtn.onclick=startSelectedRound; el.selectStart.onchange=renderPlaceholderStreamers; el.selectTarget.onchange=renderPlaceholderStreamers; el.newGameBtn.onclick=startNewGame; el.clearScoresBtn.onclick=async()=>{ localStorage.removeItem(SCORE_KEY); await renderLeaderboard(); };
init().catch(err=>{ console.error(err); setMessage("불러오기에 실패했습니다. 콘솔을 확인하세요.","bad"); });
