const DATA_URL = "data/soop_graph_undirected.json";
const SCORE_KEY = "soop-distance-local-top5";

const state = {
  graph: null,
  nodes: [],
  nodesById: {},
  adjacency: {},
  currentRound: null,
  score: 0,
  gameOver: false,
  animating: false,
  supabase: null,
  useSupabase: false
};

const el = {
  score: document.getElementById("score"),
  bestScore: document.getElementById("bestScore"),
  graphStats: document.getElementById("graphStats"),
  leaderboardMode: document.getElementById("leaderboardMode"),
  startImage: document.getElementById("startImage"),
  startName: document.getElementById("startName"),
  startId: document.getElementById("startId"),
  targetImage: document.getElementById("targetImage"),
  targetName: document.getElementById("targetName"),
  targetId: document.getElementById("targetId"),
  guessButtons: document.getElementById("guessButtons"),
  message: document.getElementById("message"),
  pathBox: document.getElementById("pathBox"),
  newGameBtn: document.getElementById("newGameBtn"),
  leaderboard: document.getElementById("leaderboard"),
  clearScoresBtn: document.getElementById("clearScoresBtn"),
  nameDialog: document.getElementById("nameDialog"),
  nameForm: document.getElementById("nameForm"),
  playerName: document.getElementById("playerName")
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function init() {
  setupSupabase();

  const response = await fetch(DATA_URL);
  state.graph = await response.json();

  state.nodes = state.graph.nodes || [];
  state.nodesById = state.graph.nodesById || Object.fromEntries(state.nodes.map(node => [node.id, node]));
  state.adjacency = state.graph.adjacency || {};

  el.graphStats.textContent = `${state.nodes.length}명 / 연결 ${state.graph.edges.length}개`;

  renderGuessButtons();
  await renderLeaderboard();
  startNewGame();
}

function setupSupabase() {
  const url = window.SUPABASE_URL || "";
  const key = window.SUPABASE_ANON_KEY || "";

  if (url && key && window.supabase?.createClient) {
    state.supabase = window.supabase.createClient(url, key);
    state.useSupabase = true;
    el.leaderboardMode.textContent = "리더보드: Supabase 전 세계 기록";
    el.clearScoresBtn.style.display = "none";
  } else {
    state.useSupabase = false;
    el.leaderboardMode.textContent = "리더보드: 이 브라우저에만 저장";
  }
}

function renderGuessButtons() {
  el.guessButtons.innerHTML = "";
  [1, 2, 3, 4, 5, "6+"].forEach(value => {
    const button = document.createElement("button");
    button.textContent = String(value);
    button.addEventListener("click", () => submitGuess(value));
    el.guessButtons.appendChild(button);
  });
}

function startNewGame() {
  state.score = 0;
  state.gameOver = false;
  state.animating = false;
  updateScoreDisplay();
  setMessage("", "");
  hidePath();
  nextRound();
}

function nextRound() {
  const round = makeRound();
  state.currentRound = round;

  renderStreamer("start", round.start);
  renderStreamer("target", round.target);

  setMessage("최단 연결 단계를 맞춰보세요.", "");
  hidePath();
  setGuessButtonsEnabled(true);
}

function makeRound() {
  for (let i = 0; i < 500; i++) {
    const start = randomNode();
    const target = randomNode();

    if (!start || !target || start.id === target.id) continue;

    const path = shortestPath(start.id, target.id);
    if (!path) continue;

    const distance = path.length - 1;
    if (distance >= 1 && distance <= 6) return { start, target, path, distance };
  }

  throw new Error("연결된 스트리머 쌍을 찾지 못했습니다.");
}

function randomNode() {
  return state.nodes[Math.floor(Math.random() * state.nodes.length)];
}

function shortestPath(startId, targetId) {
  if (startId === targetId) return [startId];

  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    for (const next of state.adjacency[current] || []) {
      if (visited.has(next)) continue;

      const newPath = [...path, next];
      if (next === targetId) return newPath;

      visited.add(next);
      queue.push(newPath);
    }
  }

  return null;
}

async function submitGuess(value) {
  if (state.gameOver || state.animating || !state.currentRound) return;

  state.animating = true;
  setGuessButtonsEnabled(false);

  const correctDistance = state.currentRound.distance;
  const guessedDistance = value === "6+" ? 6 : Number(value);
  const isCorrect = value === "6+" ? correctDistance >= 6 : guessedDistance === correctDistance;

  setMessage("연결 경로를 확인하는 중...", "wait");
  await animatePath(state.currentRound.path);

  if (isCorrect) {
    state.score += 1;
    updateScoreDisplay();
    setMessage(`정답입니다! 실제 거리는 ${correctDistance}단계입니다. +1점`, "good");

    await sleep(1200);
    state.animating = false;

    if (!state.gameOver) nextRound();
    return;
  }

  state.gameOver = true;
  state.animating = false;
  setMessage(`틀렸습니다. 정답은 ${correctDistance}단계였습니다. 게임 종료!`, "bad");
  await maybeSaveHighScore(state.score);
}

function renderStreamer(side, streamer) {
  const image = side === "start" ? el.startImage : el.targetImage;
  const name = side === "start" ? el.startName : el.targetName;
  const id = side === "start" ? el.startId : el.targetId;

  image.src = streamer.profileImage || "";
  image.onerror = () => image.removeAttribute("src");

  name.textContent = streamer.nick || streamer.id;
  id.textContent = streamer.id;
}

async function animatePath(path) {
  el.pathBox.innerHTML = "";
  el.pathBox.classList.remove("hidden");

  const title = document.createElement("div");
  title.className = "path-title";
  title.textContent = `실제 연결 경로: ${path.length - 1}단계`;
  el.pathBox.appendChild(title);

  const track = document.createElement("div");
  track.className = "path-track";
  el.pathBox.appendChild(track);

  path.forEach((id, index) => {
    const node = state.nodesById[id] || { id, nick: id };

    const item = document.createElement("div");
    item.className = "path-node";
    item.dataset.index = String(index);

    const img = document.createElement("img");
    img.src = node.profileImage || "";
    img.alt = `${node.nick || node.id} 프로필 이미지`;
    img.onerror = () => img.removeAttribute("src");

    const name = document.createElement("strong");
    name.textContent = node.nick || node.id;

    const step = document.createElement("small");
    step.textContent = index === 0 ? "시작" : `${index}단계`;

    item.appendChild(img);
    item.appendChild(name);
    item.appendChild(step);
    track.appendChild(item);

    if (index < path.length - 1) {
      const arrow = document.createElement("div");
      arrow.className = "path-arrow";
      arrow.dataset.index = String(index);
      arrow.textContent = "→";
      track.appendChild(arrow);
    }
  });

  const nodes = [...track.querySelectorAll(".path-node")];
  const arrows = [...track.querySelectorAll(".path-arrow")];

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].classList.add("active");
    await sleep(380);

    if (arrows[i]) {
      arrows[i].classList.add("active");
      await sleep(260);
    }
  }
}

function hidePath() {
  el.pathBox.innerHTML = "";
  el.pathBox.classList.add("hidden");
}

function setMessage(text, type) {
  el.message.textContent = text;
  el.message.className = "message";
  if (type) el.message.classList.add(type);
}

function setGuessButtonsEnabled(enabled) {
  [...el.guessButtons.querySelectorAll("button")].forEach(button => {
    button.disabled = !enabled;
  });
}

async function maybeSaveHighScore(score) {
  if (score <= 0) return;

  const scores = await getScores();
  const qualifies = scores.length < 5 || score > scores[scores.length - 1].score;
  if (!qualifies) return;

  el.playerName.value = "";
  el.nameDialog.showModal();

  el.nameForm.onsubmit = async event => {
    event.preventDefault();

    const name = el.playerName.value.trim() || "익명";
    await addScore(name, score);

    el.nameDialog.close();
    await renderLeaderboard();
    updateScoreDisplay();
  };
}

async function getScores() {
  if (state.useSupabase) {
    const { data, error } = await state.supabase
      .from("leaderboard")
      .select("player_name, score, created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(5);

    if (error) {
      console.error("Supabase 조회 실패:", error);
      return [];
    }

    return data.map(row => ({
      name: row.player_name,
      score: row.score,
      date: row.created_at
    }));
  }

  try {
    return JSON.parse(localStorage.getItem(SCORE_KEY)) || [];
  } catch {
    return [];
  }
}

async function addScore(name, score) {
  if (state.useSupabase) {
    const cleanName = name.slice(0, 20);

    const { error } = await state.supabase
      .from("leaderboard")
      .insert({ player_name: cleanName, score });

    if (error) {
      console.error("Supabase 저장 실패:", error);
      setMessage("점수 저장에 실패했습니다. Supabase 설정을 확인하세요.", "bad");
    }

    return;
  }

  const scores = await getScores();
  scores.push({ name, score, date: new Date().toISOString() });
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(SCORE_KEY, JSON.stringify(scores.slice(0, 5)));
}

async function renderLeaderboard() {
  const scores = await getScores();
  el.leaderboard.innerHTML = "";

  if (scores.length === 0) {
    const li = document.createElement("li");
    li.textContent = "아직 기록이 없습니다.";
    el.leaderboard.appendChild(li);
    updateScoreDisplay(scores);
    return;
  }

  for (const item of scores) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(item.name)}</strong> — ${item.score}점`;
    el.leaderboard.appendChild(li);
  }

  updateScoreDisplay(scores);
}

async function updateScoreDisplay(existingScores) {
  el.score.textContent = state.score;

  const scores = existingScores || await getScores();
  el.bestScore.textContent = scores[0]?.score || 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

el.newGameBtn.addEventListener("click", startNewGame);

el.clearScoresBtn.addEventListener("click", async () => {
  localStorage.removeItem(SCORE_KEY);
  await renderLeaderboard();
});

init().catch(error => {
  console.error(error);
  setMessage("게임 데이터를 불러오지 못했습니다. 콘솔을 확인하세요.", "bad");
});
