import {
  APP_VERSION,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIME_OPTIONS,
  buildCountSummary,
  getAvailablePatterns,
  getDurationLabel,
  getPatternSpecialNote,
  getRoleDescription,
  getSelectedFixedRoles,
  normalizeOnlineSettings,
} from "../shared/gameLogic.js?v=0.6.0";

const WORKER_URL = "https://one-night-jinro-online.jnpl3-1415926.workers.dev";
const SESSION_STORAGE_KEY = "one_night_jinro_online_session_v1";
const LOCAL_STATS_KEY = "one_night_jinro_local_stats_v2";
const PROCESSED_RESULTS_KEY = "one_night_jinro_processed_results_v2";
const SOUND_SETTING_KEY = "one_night_jinro_sound_enabled_v1";

const refs = {
  playerNameInput: document.getElementById("playerNameInput"),
  createRoomCodeInput: document.getElementById("createRoomCodeInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  reconnectArea: document.getElementById("reconnectArea"),
  reconnectBtn: document.getElementById("reconnectBtn"),
  connectionStatus: document.getElementById("connectionStatus"),
  connectionOverlay: document.getElementById("connectionOverlay"),
  overlayReconnectBtn: document.getElementById("overlayReconnectBtn"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),

  roomPanel: document.getElementById("roomPanel"),
  roomCodeText: document.getElementById("roomCodeText"),
  copyRoomCodeBtn: document.getElementById("copyRoomCodeBtn"),
  inviteUrlInput: document.getElementById("inviteUrlInput"),
  copyInviteUrlBtn: document.getElementById("copyInviteUrlBtn"),
  qrImage: document.getElementById("qrImage"),
  lobbyNameInput: document.getElementById("lobbyNameInput"),
  changeNameBtn: document.getElementById("changeNameBtn"),
  phaseText: document.getElementById("phaseText"),
  hostDisconnectWarning: document.getElementById("hostDisconnectWarning"),

  settingPlayerCount: document.getElementById("settingPlayerCount"),
  settingPattern: document.getElementById("settingPattern"),
  settingNightSeconds: document.getElementById("settingNightSeconds"),
  settingDiscussionSeconds: document.getElementById("settingDiscussionSeconds"),
  settingVoteSeconds: document.getElementById("settingVoteSeconds"),
  currentSettingsText: document.getElementById("currentSettingsText"),
  settingsActions: document.getElementById("settingsActions"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  settingStatus: document.getElementById("settingStatus"),

  playerTableBody: document.getElementById("playerTableBody"),
  hostControls: document.getElementById("hostControls"),
  startGameBtn: document.getElementById("startGameBtn"),
  backToLobbyBtn: document.getElementById("backToLobbyBtn"),

  gamePanel: document.getElementById("gamePanel"),
  gameStatusText: document.getElementById("gameStatusText"),
  nightActionButtons: document.getElementById("nightActionButtons"),
  resultCardsWrap: document.getElementById("resultCardsWrap"),
  localStatsPanel: document.getElementById("localStatsPanel"),
  versionText: document.getElementById("versionText"),
};

const state = {
  socket: null,
  socketConnected: false,
  connecting: false,
  pendingAction: false,
  snapshot: null,
  privateGame: null,
  self: null,
  session: null,
  lastPhaseKey: "",
  statsMode: "room",
  statsSortByRate: false,
  soundEnabled: localStorage.getItem(SOUND_SETTING_KEY) === "true",
};

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function loadStats() {
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStats(stats) {
  localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
}

function loadProcessedResults() {
  try {
    const raw = localStorage.getItem(PROCESSED_RESULTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProcessedResults(processed) {
  localStorage.setItem(PROCESSED_RESULTS_KEY, JSON.stringify(processed));
}

function getPlayerName() {
  const name = refs.playerNameInput.value.trim();
  return name || "プレイヤー";
}

function setStatus(message) {
  refs.connectionStatus.textContent = message;
}

function setSettingStatus(message) {
  refs.settingStatus.textContent = message;
}

function setBusy(isBusy) {
  refs.createRoomBtn.disabled = isBusy;
  refs.joinRoomBtn.disabled = isBusy;
  refs.reconnectBtn.disabled = isBusy;
}

function getWorkerUrl() {
  return WORKER_URL;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${getWorkerUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `通信エラー: ${response.status}`);
  }

  return payload;
}

function buildWebSocketUrl(roomId, playerId, token) {
  const wsBase = getWorkerUrl().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const query = new URLSearchParams({ playerId, token });
  return `${wsBase}/api/rooms/${encodeURIComponent(roomId)}/socket?${query.toString()}`;
}

function closeSocket() {
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }
}

function setOverlayVisible(visible) {
  refs.connectionOverlay.classList.toggle("hidden", !visible);
}

function connectSocket(session, silent = false) {
  if (!session || state.connecting) return;

  closeSocket();

  state.connecting = true;
  state.socketConnected = false;

  if (!silent) setStatus("接続中です");

  const socket = new WebSocket(buildWebSocketUrl(session.roomId, session.playerId, session.token));
  state.socket = socket;

  socket.addEventListener("open", () => {
    state.connecting = false;
    state.socketConnected = true;
    setOverlayVisible(false);
    setStatus("接続しました");
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "snapshot" || message.type === "connected") {
      state.pendingAction = false;
      state.snapshot = message.snapshot;
      state.privateGame = message.privateGame || null;
      state.self = message.self;
      state.socketConnected = true;
      state.connecting = false;
      setOverlayVisible(false);
      notifyPhaseChange();
      render();
    }

    if (message.type === "error") {
      state.pendingAction = false;
      setStatus(message.error || "エラーが発生しました");
      render();
    }

    if (message.type === "settingsSaved") {
      setSettingStatus("設定を保存しました");
    }
  });

  socket.addEventListener("close", () => {
    state.connecting = false;
    state.socketConnected = false;
    setStatus("切断されました。自動再接続中です。");
    setOverlayVisible(true);
    renderReconnectArea();
    render();
  });

  socket.addEventListener("error", () => {
    state.connecting = false;
    state.socketConnected = false;
    setStatus("接続エラーが発生しました");
    setOverlayVisible(true);
  });
}

function sendSocket(type, payload = {}) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    setStatus("WebSocketが未接続です");
    setOverlayVisible(true);
    return;
  }

  state.pendingAction = true;
  clearGameButtons();
  state.socket.send(JSON.stringify({ type, ...payload }));
  render();
}

function normalizeTwoDigit(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 2);
}

async function createRoom() {
  const desiredRoomId = normalizeTwoDigit(refs.createRoomCodeInput.value);

  if (refs.createRoomCodeInput.value.trim() && !/^\d{2}$/.test(desiredRoomId)) {
    setStatus("希望コードは2桁数字で入力してください");
    return;
  }

  setBusy(true);

  try {
    const payload = await apiFetch("/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: getPlayerName(),
        desiredRoomId: desiredRoomId || "",
      }),
    });

    const session = {
      roomId: payload.roomId,
      playerId: payload.playerId,
      token: payload.token,
    };

    state.session = session;
    state.snapshot = payload.snapshot;
    state.privateGame = null;
    state.self = {
      playerId: payload.playerId,
      isHost: payload.isHost,
    };

    saveSession(session);
    connectSocket(session);
    render();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

async function joinRoom() {
  const roomId = normalizeTwoDigit(refs.roomCodeInput.value);

  if (!/^\d{2}$/.test(roomId)) {
    setStatus("2桁のルームコードを入力してください");
    return;
  }

  setBusy(true);

  try {
    const payload = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: "POST",
      body: JSON.stringify({
        name: getPlayerName(),
      }),
    });

    const session = {
      roomId: payload.roomId,
      playerId: payload.playerId,
      token: payload.token,
    };

    state.session = session;
    state.snapshot = payload.snapshot;
    state.privateGame = null;
    state.self = {
      playerId: payload.playerId,
      isHost: payload.isHost,
    };

    saveSession(session);
    connectSocket(session);
    render();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setBusy(false);
  }
}

function reconnect() {
  const session = loadSession();

  if (!session) {
    setStatus("再接続情報がありません");
    return;
  }

  state.session = session;
  connectSocket(session);
}

function renderReconnectArea() {
  const session = loadSession();
  refs.reconnectArea.classList.toggle("hidden", !session);
}

function getPhaseLabel(snapshot) {
  if (!snapshot) return "不明";
  if (snapshot.phase === "lobby") return "ロビー";

  if (snapshot.phase === "started") {
    const gamePhase = snapshot.gamePublic?.phase;
    if (gamePhase === "night") return "夜フェーズ";
    if (gamePhase === "discussion") return "議論フェーズ";
    if (gamePhase === "vote") return "投票フェーズ";
    if (gamePhase === "hunterExecution") return "狩人追加処刑";
    if (gamePhase === "result") return "結果";
    return "ゲーム開始";
  }

  return snapshot.phase || "不明";
}

function isHost() {
  return Boolean(state.self?.isHost);
}

function getSelfPlayer() {
  return state.snapshot?.players?.find((player) => player.id === state.self?.playerId) || null;
}

function populatePlayerCountOptions() {
  refs.settingPlayerCount.innerHTML = "";

  for (let count = MIN_PLAYERS; count <= MAX_PLAYERS; count += 1) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = `${count}人`;
    refs.settingPlayerCount.appendChild(option);
  }
}

function populateTimeOptions(selectElement, key) {
  selectElement.innerHTML = "";

  TIME_OPTIONS[key].forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.value);
    option.textContent = item.label;
    selectElement.appendChild(option);
  });
}

function renderPatternOptions(playerCount, selectedPattern) {
  const patterns = getAvailablePatterns(playerCount);
  refs.settingPattern.innerHTML = "";

  patterns.forEach((pattern) => {
    const option = document.createElement("option");
    option.value = pattern;
    option.textContent = pattern;
    refs.settingPattern.appendChild(option);
  });

  refs.settingPattern.value = patterns.includes(selectedPattern) ? selectedPattern : patterns[0] || "A";
}

function collectSettingsFromForm() {
  return normalizeOnlineSettings({
    playerCount: Number(refs.settingPlayerCount.value),
    pattern: refs.settingPattern.value,
    nightSeconds: Number(refs.settingNightSeconds.value),
    discussionSeconds: Number(refs.settingDiscussionSeconds.value),
    voteSeconds: Number(refs.settingVoteSeconds.value),
  }, DEFAULT_SETTINGS);
}

function buildSettingsText(settings) {
  const lines = [
    `人数: ${settings.playerCount}人`,
    `パターン: ${settings.pattern}`,
    `夜行動時間: ${getDurationLabel(settings.nightSeconds)}`,
    `議論時間: ${getDurationLabel(settings.discussionSeconds)}`,
    `投票時間: ${getDurationLabel(settings.voteSeconds)}`,
  ];

  const note = getPatternSpecialNote(settings.playerCount, settings.pattern);
  if (note) lines.push(note);

  const roles = getSelectedFixedRoles(settings.playerCount, settings.pattern);

  if (roles) {
    const summary = buildCountSummary(roles);
    lines.push(`使用役職: ${summary.text}`);

    const roleLines = summary.orderedUniqueRoles.map((role) => {
      return `${role}: ${getRoleDescription(role, settings.playerCount, settings.pattern)}`;
    });

    lines.push(roleLines.join("\n"));
  }

  return lines.join("\n");
}

function applySettingsToForm(settings) {
  refs.settingPlayerCount.value = String(settings.playerCount);
  renderPatternOptions(settings.playerCount, settings.pattern);
  refs.settingNightSeconds.value = String(settings.nightSeconds);
  refs.settingDiscussionSeconds.value = String(settings.discussionSeconds);
  refs.settingVoteSeconds.value = String(settings.voteSeconds);
}

function renderSettings() {
  const settings = normalizeOnlineSettings(state.snapshot?.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS);
  const editable = isHost() && state.snapshot?.phase === "lobby";

  applySettingsToForm(settings);

  refs.settingPlayerCount.disabled = !editable;
  refs.settingPattern.disabled = !editable;
  refs.settingNightSeconds.disabled = !editable;
  refs.settingDiscussionSeconds.disabled = !editable;
  refs.settingVoteSeconds.disabled = !editable;

  refs.settingsActions.classList.toggle("hidden", !editable);
  refs.currentSettingsText.textContent = buildSettingsText(settings);
}

function saveSettings() {
  if (!isHost()) return;
  setSettingStatus("");
  sendSocket("updateSettings", { settings: collectSettingsFromForm() });
}

function changeName() {
  const name = refs.lobbyNameInput.value.trim();
  if (!name) return;
  sendSocket("updateName", { name });
}

function movePlayer(playerId, direction) {
  if (!state.snapshot || !isHost()) return;

  const ids = state.snapshot.players.map((player) => player.id);
  const currentIndex = ids.indexOf(playerId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ids.length) return;

  [ids[currentIndex], ids[nextIndex]] = [ids[nextIndex], ids[currentIndex]];
  sendSocket("reorderPlayers", { playerIds: ids });
}

function removePlayer(playerId) {
  if (!isHost()) return;
  sendSocket("removePlayer", { playerId });
}

function renderInvitePanel() {
  if (!state.snapshot) {
    refs.inviteUrlInput.value = "";
    refs.qrImage.src = "";
    return;
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", state.snapshot.roomId);

  const inviteUrl = url.toString();
  refs.inviteUrlInput.value = inviteUrl;
  refs.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteUrl)}`;
}

function renderPlayerTable() {
  refs.playerTableBody.innerHTML = "";
  if (!state.snapshot) return;

  const settings = normalizeOnlineSettings(state.snapshot.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS);

  state.snapshot.players.forEach((player, index) => {
    const tr = document.createElement("tr");

    const orderTd = document.createElement("td");
    orderTd.textContent = String(index + 1);

    const nameTd = document.createElement("td");
    nameTd.textContent = `${player.name}${player.isHost ? "（ホスト）" : ""}`;

    const slotTd = document.createElement("td");
    const isEntry = index < settings.playerCount;
    slotTd.textContent = isEntry ? "参加" : "待機";
    slotTd.className = isEntry ? "entry-slot" : "wait-slot";

    const statusTd = document.createElement("td");
    statusTd.textContent = player.connected ? "接続中" : "切断中";
    statusTd.className = player.connected ? "connected" : "disconnected";

    const actionTd = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "player-actions";

    if (isHost() && state.snapshot.phase === "lobby") {
      const upButton = document.createElement("button");
      upButton.type = "button";
      upButton.textContent = "↑";
      upButton.disabled = index === 0;
      upButton.addEventListener("click", () => movePlayer(player.id, -1));

      const downButton = document.createElement("button");
      downButton.type = "button";
      downButton.textContent = "↓";
      downButton.disabled = index === state.snapshot.players.length - 1;
      downButton.addEventListener("click", () => movePlayer(player.id, 1));

      actions.appendChild(upButton);
      actions.appendChild(downButton);

      if (!player.isHost) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "danger";
        removeButton.textContent = "退出";
        removeButton.addEventListener("click", () => removePlayer(player.id));
        actions.appendChild(removeButton);
      }
    }

    actionTd.appendChild(actions);

    tr.appendChild(orderTd);
    tr.appendChild(nameTd);
    tr.appendChild(slotTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionTd);

    refs.playerTableBody.appendChild(tr);
  });
}

function clearGameButtons() {
  refs.nightActionButtons.innerHTML = "";
}

function clearResultCards() {
  refs.resultCardsWrap.innerHTML = "";
}

function addGameButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = state.pendingAction;
  button.addEventListener("click", onClick);
  refs.nightActionButtons.appendChild(button);
}

function formatRemaining(deadlineAt) {
  if (!deadlineAt) return "無限";

  const ms = Math.max(0, Number(deadlineAt) - Date.now());
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
  return `${seconds}秒`;
}

function getCountdownLine(label, deadlineAt) {
  return `${label} 残り: ${formatRemaining(deadlineAt)}`;
}

function sendNightAction(action) {
  sendSocket("submitNightAction", { action });
}

function sendVoteAction(action) {
  sendSocket("submitVote", { action });
}

function sendHunterAction(action) {
  sendSocket("submitHunterAction", { action });
}

function renderNightButtons(privateGame) {
  clearGameButtons();
  if (!privateGame || privateGame.phase !== "night" || privateGame.isNightComplete || state.pendingAction) return;

  privateGame.choices.forEach((choice) => {
    addGameButton(choice.label, () => sendNightAction(choice.action));
  });
}

function renderVoteButtons(privateGame) {
  clearGameButtons();
  if (!privateGame || privateGame.phase !== "vote" || privateGame.isVoteComplete || state.pendingAction) return;

  privateGame.choices.forEach((choice) => {
    addGameButton(choice.label, () => sendVoteAction(choice.action));
  });
}

function renderHunterButtons(privateGame) {
  clearGameButtons();

  if (
    !privateGame
    || privateGame.phase !== "hunterExecution"
    || !privateGame.isHunter
    || privateGame.isHunterExecutionComplete
    || state.pendingAction
  ) {
    return;
  }

  privateGame.choices.forEach((choice) => {
    addGameButton(choice.label, () => sendHunterAction(choice.action));
  });
}

function renderDiscussionButtons() {
  clearGameButtons();
  if (!isHost() || state.pendingAction) return;

  addGameButton("投票フェーズへ進む", () => {
    sendSocket("startVotePhase");
  });
}

function renderResultButtons() {
  clearGameButtons();
  if (!isHost() || state.pendingAction) return;

  addGameButton("同じ設定で再戦", () => {
    sendSocket("replaySameSettings");
  });
}

function updateLocalStatsFromResult(privateGame) {
  if (!state.snapshot || !privateGame?.result || typeof privateGame.playerIndex !== "number") return;

  const result = privateGame.result;
  const resultKey = `${state.snapshot.roomId}:${result.createdAt}:${privateGame.playerIndex}`;
  const processed = loadProcessedResults();

  if (processed[resultKey]) return;

  const row = result.playerRows[privateGame.playerIndex];
  if (!row) return;

  const stats = loadStats();
  const name = row.name;

  if (!stats[name]) {
    stats[name] = { wins: 0, games: 0 };
  }

  stats[name].games += 1;
  if (row.isWinner) stats[name].wins += 1;

  processed[resultKey] = true;
  saveStats(stats);
  saveProcessedResults(processed);
}

function createStatsButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderLocalStats(result = null) {
  refs.localStatsPanel.innerHTML = "";

  const actions = document.createElement("div");
  actions.className = "stats-actions";

  actions.appendChild(createStatsButton("今回の部屋", () => {
    state.statsMode = "room";
    renderLocalStats(state.privateGame?.result);
  }));

  actions.appendChild(createStatsButton("自分だけ", () => {
    state.statsMode = "mine";
    renderLocalStats(state.privateGame?.result);
  }));

  actions.appendChild(createStatsButton("全員分", () => {
    state.statsMode = "all";
    renderLocalStats(state.privateGame?.result);
  }));

  actions.appendChild(createStatsButton("勝率順", () => {
    state.statsSortByRate = !state.statsSortByRate;
    renderLocalStats(state.privateGame?.result);
  }));

  actions.appendChild(createStatsButton("戦績リセット", () => {
    if (confirm("この端末のローカル戦績をリセットしますか？")) {
      localStorage.removeItem(LOCAL_STATS_KEY);
      localStorage.removeItem(PROCESSED_RESULTS_KEY);
      renderLocalStats(state.privateGame?.result);
    }
  }));

  refs.localStatsPanel.appendChild(actions);

  const text = document.createElement("div");

  if (state.statsMode === "room" && result) {
    const lines = ["今回の部屋の結果"];
    result.playerRows.forEach((row) => {
      if (row.name === "死体") return;
      lines.push(`${row.name}: ${row.isWinner ? "勝利" : "敗北"}`);
    });
    text.textContent = lines.join("\n");
    refs.localStatsPanel.appendChild(text);
    return;
  }

  const stats = loadStats();
  let names = Object.keys(stats);

  if (state.statsMode === "mine") {
    const selfPlayer = getSelfPlayer();
    names = selfPlayer ? names.filter((name) => name === selfPlayer.name) : [];
  }

  if (state.statsSortByRate) {
    names.sort((a, b) => {
      const rateA = stats[a].games > 0 ? stats[a].wins / stats[a].games : 0;
      const rateB = stats[b].games > 0 ? stats[b].wins / stats[b].games : 0;
      return rateB - rateA;
    });
  } else {
    names.sort();
  }

  if (names.length === 0) {
    text.textContent = "ローカル戦績: まだ記録がありません";
    refs.localStatsPanel.appendChild(text);
    return;
  }

  const lines = ["ローカル戦績"];

  names.forEach((name) => {
    const item = stats[name];
    const rate = item.games > 0 ? Math.round((item.wins / item.games) * 100) : 0;
    lines.push(`${name}: ${item.wins}勝/${item.games}戦 勝率${rate}%`);
  });

  text.textContent = lines.join("\n");
  refs.localStatsPanel.appendChild(text);
}

function buildResultText(result) {
  if (!result) return "結果を取得中です。";

  return [
    "結果",
    result.headline,
    `勝者: ${result.winnerNames.length > 0 ? result.winnerNames.join("、") : "なし"}`,
    "",
    ...result.metaLines,
  ].join("\n");
}

function renderResultCards(result, selfIndex) {
  clearResultCards();
  if (!result) return;

  const headline = document.createElement("div");
  headline.className = `result-headline ${result.resultType === "village" ? "result-blue" : "result-red"}`;
  headline.textContent = result.headline;
  refs.resultCardsWrap.appendChild(headline);

  const meta = document.createElement("div");
  meta.className = "result-meta";
  meta.textContent = [
    `勝者: ${result.winnerNames.length > 0 ? result.winnerNames.join("、") : "なし"}`,
    ...result.metaLines,
  ].join("\n");
  refs.resultCardsWrap.appendChild(meta);

  result.playerRows.forEach((row, index) => {
    const card = document.createElement("div");
    card.className = `result-card ${index === selfIndex ? "self" : ""}`;

    const title = document.createElement("div");
    title.className = "result-card-title";
    title.textContent = row.name;

    const body = document.createElement("div");
    body.className = "result-card-line";
    body.textContent = [
      `役職: ${row.roleHistory}`,
      `投票先: ${row.voteTarget}`,
      `処刑: ${row.isEliminated ? "あり" : "なし"}`,
      `勝敗: ${row.isWinner ? "勝利" : "敗北"}`,
    ].join("\n");

    card.appendChild(title);
    card.appendChild(body);
    refs.resultCardsWrap.appendChild(card);
  });
}

function renderGamePanel() {
  clearGameButtons();
  clearResultCards();

  if (!state.snapshot) {
    refs.gamePanel.classList.add("hidden");
    refs.localStatsPanel.innerHTML = "";
    return;
  }

  refs.gamePanel.classList.toggle("hidden", state.snapshot.phase !== "started");

  if (state.snapshot.phase !== "started") {
    refs.localStatsPanel.innerHTML = "";
    return;
  }

  const settings = normalizeOnlineSettings(state.snapshot.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS);
  const privateGame = state.privateGame;
  const gamePublic = state.snapshot.gamePublic;

  if (!privateGame) {
    refs.gameStatusText.textContent = "ゲーム開始状態です。\n役職情報を取得中です。";
    return;
  }

  if (privateGame.phase === "waiting") {
    refs.gameStatusText.textContent = privateGame.message || "待機枠です。";
    return;
  }

  if (privateGame.phase === "night") {
    const lines = [
      "夜フェーズです。",
      `人数: ${settings.playerCount}人`,
      `パターン: ${settings.pattern}`,
      `あなたの順番: ${privateGame.playerIndex + 1}`,
      `あなたの役職: ${privateGame.initialRole}`,
      `墓地枚数: ${privateGame.graveCount}枚`,
      privateGame.hasDeadPlayer ? "3人目の死体があります" : "",
      getCountdownLine("夜行動", privateGame.nightDeadlineAt),
    ].filter(Boolean);

    if (privateGame.notifications?.length > 0) {
      lines.push("");
      lines.push(privateGame.notifications.join("\n"));
    }

    if (privateGame.preInfo) {
      lines.push("");
      lines.push(privateGame.preInfo);
    }

    if (privateGame.isNightComplete) {
      lines.push("");
      lines.push("夜行動完了");
      lines.push(privateGame.nightResult?.text || "");
      lines.push("全員の夜行動完了を待っています。");
    } else {
      lines.push("");
      lines.push("夜行動を選択してください。");
    }

    refs.gameStatusText.textContent = lines.join("\n");
    refs.localStatsPanel.innerHTML = "";
    renderNightButtons(privateGame);
    return;
  }

  if (privateGame.phase === "discussion") {
    refs.gameStatusText.textContent = [
      "議論フェーズです。",
      `あなたの役職: ${privateGame.initialRole}`,
      privateGame.nightResult?.text ? `夜行動結果: ${privateGame.nightResult.text}` : "夜行動結果: なし",
      getCountdownLine("議論", gamePublic?.discussionDeadlineAt),
      isHost() ? "ホストは任意で投票フェーズへ進めます。" : "ホストが投票フェーズへ進めるまで待機します。",
    ].filter(Boolean).join("\n");

    refs.localStatsPanel.innerHTML = "";
    renderDiscussionButtons();
    return;
  }

  if (privateGame.phase === "vote") {
    const lines = [
      "投票フェーズです。",
      `あなたの役職: ${privateGame.initialRole}`,
      getCountdownLine("投票", gamePublic?.voteDeadlineAt),
    ];

    if (privateGame.isVoteComplete) {
      lines.push("");
      lines.push("投票完了");
      lines.push(privateGame.voteResult?.text || "");
      lines.push("全員の投票完了を待っています。");
    } else {
      lines.push("");
      lines.push("投票先を選択してください。");
    }

    refs.gameStatusText.textContent = lines.join("\n");
    refs.localStatsPanel.innerHTML = "";
    renderVoteButtons(privateGame);
    return;
  }

  if (privateGame.phase === "hunterExecution") {
    const lines = [
      "狩人追加処刑フェーズです。",
      `${privateGame.hunterName}は狩人でした。`,
      getCountdownLine("狩人追加処刑", privateGame.hunterDeadlineAt),
    ];

    if (privateGame.isHunter) {
      if (privateGame.isHunterExecutionComplete) {
        lines.push("追加処刑は完了しています。");
        lines.push(privateGame.hunterResult?.text || "");
      } else {
        lines.push("追加で処刑する対象を選んでください。");
      }
    } else {
      lines.push("狩人の追加処刑を待っています。");
    }

    refs.gameStatusText.textContent = lines.join("\n");
    refs.localStatsPanel.innerHTML = "";
    renderHunterButtons(privateGame);
    return;
  }

  if (privateGame.phase === "result") {
    updateLocalStatsFromResult(privateGame);
    refs.gameStatusText.textContent = buildResultText(privateGame.result);
    renderResultCards(privateGame.result, privateGame.playerIndex);
    renderLocalStats(privateGame.result);
    renderResultButtons();
    return;
  }

  refs.gameStatusText.textContent = `ゲーム進行中です。\n現在フェーズ: ${privateGame.phase}`;
}

function renderHostDisconnectWarning() {
  if (!state.snapshot || !isHost()) {
    refs.hostDisconnectWarning.classList.add("hidden");
    return;
  }

  const disconnectedPlayers = state.snapshot.players.filter((player) => !player.connected);

  if (disconnectedPlayers.length === 0) {
    refs.hostDisconnectWarning.classList.add("hidden");
    return;
  }

  refs.hostDisconnectWarning.textContent = `${disconnectedPlayers.map((player) => player.name).join("、")}が切断中です。`;
  refs.hostDisconnectWarning.classList.remove("hidden");
}

function renderSoundToggle() {
  refs.soundToggleBtn.textContent = state.soundEnabled ? "効果音・バイブ ON" : "効果音・バイブ OFF";
}

function playNotify() {
  if (!state.soundEnabled) return;

  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch {
    // ignore
  }

  if (navigator.vibrate) {
    navigator.vibrate([80]);
  }
}

function notifyPhaseChange() {
  const phaseKey = `${state.snapshot?.roomId || ""}:${state.snapshot?.gamePublic?.phase || state.snapshot?.phase || ""}`;

  if (!state.lastPhaseKey) {
    state.lastPhaseKey = phaseKey;
    return;
  }

  if (state.lastPhaseKey !== phaseKey) {
    state.lastPhaseKey = phaseKey;
    playNotify();
  }
}

function render() {
  const hasSnapshot = Boolean(state.snapshot);

  refs.roomPanel.classList.toggle("hidden", !hasSnapshot);

  if (!hasSnapshot) {
    renderReconnectArea();
    renderGamePanel();
    renderSoundToggle();
    return;
  }

  const settings = normalizeOnlineSettings(state.snapshot.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS);
  const playerCount = state.snapshot.players.length;
  const entryPlayers = state.snapshot.players.slice(0, settings.playerCount);

  refs.roomCodeText.textContent = state.snapshot.roomId;
  refs.phaseText.textContent = getPhaseLabel(state.snapshot);

  renderInvitePanel();
  renderSettings();
  renderPlayerTable();
  renderHostDisconnectWarning();
  renderSoundToggle();

  refs.lobbyNameInput.value = getSelfPlayer()?.name || "";

  refs.hostControls.classList.toggle("hidden", !isHost());

  const canStart = isHost()
    && state.snapshot.phase === "lobby"
    && playerCount >= settings.playerCount
    && entryPlayers.every((player) => player.connected);

  refs.startGameBtn.classList.toggle("hidden", !(isHost() && state.snapshot.phase === "lobby"));
  refs.startGameBtn.disabled = !canStart;

  if (playerCount < settings.playerCount) {
    refs.startGameBtn.textContent = `開始（${playerCount}/${settings.playerCount}人）`;
  } else if (!entryPlayers.every((player) => player.connected)) {
    refs.startGameBtn.textContent = "開始（参加枠に切断者あり）";
  } else {
    refs.startGameBtn.textContent = "開始";
  }

  refs.backToLobbyBtn.classList.toggle(
    "hidden",
    !(isHost() && state.snapshot.phase === "started")
  );

  renderGamePanel();
  renderReconnectArea();
}

refs.createRoomBtn.addEventListener("click", createRoom);
refs.joinRoomBtn.addEventListener("click", joinRoom);
refs.reconnectBtn.addEventListener("click", reconnect);
refs.overlayReconnectBtn.addEventListener("click", reconnect);

refs.copyRoomCodeBtn.addEventListener("click", async () => {
  if (!state.snapshot) return;
  await navigator.clipboard.writeText(state.snapshot.roomId);
  setStatus("ルームコードをコピーしました");
});

refs.copyInviteUrlBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(refs.inviteUrlInput.value);
  setStatus("招待URLをコピーしました");
});

refs.startGameBtn.addEventListener("click", () => {
  sendSocket("startGame");
});

refs.backToLobbyBtn.addEventListener("click", () => {
  sendSocket("backToLobby");
});

refs.saveSettingsBtn.addEventListener("click", saveSettings);
refs.changeNameBtn.addEventListener("click", changeName);

refs.soundToggleBtn.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem(SOUND_SETTING_KEY, String(state.soundEnabled));
  renderSoundToggle();
  if (state.soundEnabled) playNotify();
});

refs.settingPlayerCount.addEventListener("change", () => {
  const settings = collectSettingsFromForm();
  renderPatternOptions(settings.playerCount, settings.pattern);
  refs.currentSettingsText.textContent = buildSettingsText(collectSettingsFromForm());
});

refs.settingPattern.addEventListener("change", () => {
  refs.currentSettingsText.textContent = buildSettingsText(collectSettingsFromForm());
});

refs.settingNightSeconds.addEventListener("change", () => {
  refs.currentSettingsText.textContent = buildSettingsText(collectSettingsFromForm());
});

refs.settingDiscussionSeconds.addEventListener("change", () => {
  refs.currentSettingsText.textContent = buildSettingsText(collectSettingsFromForm());
});

refs.settingVoteSeconds.addEventListener("change", () => {
  refs.currentSettingsText.textContent = buildSettingsText(collectSettingsFromForm());
});

refs.roomCodeInput.addEventListener("input", () => {
  refs.roomCodeInput.value = normalizeTwoDigit(refs.roomCodeInput.value);
});

refs.createRoomCodeInput.addEventListener("input", () => {
  refs.createRoomCodeInput.value = normalizeTwoDigit(refs.createRoomCodeInput.value);
});

populatePlayerCountOptions();
populateTimeOptions(refs.settingNightSeconds, "nightSeconds");
populateTimeOptions(refs.settingDiscussionSeconds, "discussionSeconds");
populateTimeOptions(refs.settingVoteSeconds, "voteSeconds");
applySettingsToForm(DEFAULT_SETTINGS);
refs.currentSettingsText.textContent = buildSettingsText(DEFAULT_SETTINGS);

refs.versionText.textContent = APP_VERSION;

const roomParam = new URLSearchParams(window.location.search).get("room");
if (roomParam) {
  refs.roomCodeInput.value = normalizeTwoDigit(roomParam);
}

state.session = loadSession();
renderReconnectArea();
renderLocalStats();
renderSoundToggle();

setInterval(() => {
  if (state.snapshot?.phase === "started") {
    renderGamePanel();
  }

  if (!state.socketConnected && !state.connecting && state.session) {
    connectSocket(state.session, true);
  }
}, 1000);