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
} from "../shared/gameLogic.js?v=0.5.0";

const WORKER_URL = "https://one-night-jinro-online.jnpl3-1415926.workers.dev";
const SESSION_STORAGE_KEY = "one_night_jinro_online_session_v1";
const LOCAL_STATS_KEY = "one_night_jinro_local_stats_v1";
const PROCESSED_RESULTS_KEY = "one_night_jinro_processed_results_v1";

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

  roomPanel: document.getElementById("roomPanel"),
  roomCodeText: document.getElementById("roomCodeText"),
  copyRoomCodeBtn: document.getElementById("copyRoomCodeBtn"),
  inviteUrlInput: document.getElementById("inviteUrlInput"),
  copyInviteUrlBtn: document.getElementById("copyInviteUrlBtn"),
  qrImage: document.getElementById("qrImage"),
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
  resultTableWrap: document.getElementById("resultTableWrap"),
  localStatsPanel: document.getElementById("localStatsPanel"),
  versionText: document.getElementById("versionText"),
};

const state = {
  socket: null,
  socketConnected: false,
  pendingAction: false,
  snapshot: null,
  privateGame: null,
  self: null,
  session: null,
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
  const baseUrl = getWorkerUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error || `通信エラー: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function buildWebSocketUrl(roomId, playerId, token) {
  const baseUrl = getWorkerUrl();
  const wsBase = baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
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

function connectSocket(session) {
  closeSocket();

  const socketUrl = buildWebSocketUrl(session.roomId, session.playerId, session.token);
  const socket = new WebSocket(socketUrl);
  state.socket = socket;
  state.socketConnected = false;
  setStatus("接続中です");

  socket.addEventListener("open", () => {
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
      setOverlayVisible(false);
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
    state.socketConnected = false;
    setStatus("切断されました。再接続してください。");
    setOverlayVisible(true);
    renderReconnectArea();
    render();
  });

  socket.addEventListener("error", () => {
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
  if (!snapshot) {
    return "不明";
  }

  if (snapshot.phase === "lobby") {
    return "ロビー";
  }

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
  const patterns = getAvailablePatterns(playerCount, { includeManual: false });

  refs.settingPattern.innerHTML = "";

  patterns.forEach((pattern) => {
    const option = document.createElement("option");
    option.value = pattern;
    option.textContent = pattern;
    refs.settingPattern.appendChild(option);
  });

  if (patterns.includes(selectedPattern)) {
    refs.settingPattern.value = selectedPattern;
  } else {
    refs.settingPattern.value = patterns[0] || "A";
  }
}

function collectSettingsFromForm() {
  return normalizeOnlineSettings({
    playerCount: Number(refs.settingPlayerCount.value),
    pattern: refs.settingPattern.value,
    nightSeconds: Number(refs.settingNightSeconds.value),
    discussionSeconds: Number(refs.settingDiscussionSeconds.value),
    voteSeconds: Number(refs.settingVoteSeconds.value),
  }, DEFAULT_SETTINGS, {
    includeManual: false,
  });
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
  if (note) {
    lines.push(note);
  }

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
  const settings = normalizeOnlineSettings(state.snapshot?.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
    includeManual: false,
  });
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
  if (!isHost()) {
    return;
  }

  setSettingStatus("");
  const settings = collectSettingsFromForm();
  sendSocket("updateSettings", { settings });
}

function movePlayer(playerId, direction) {
  if (!state.snapshot || !isHost()) {
    return;
  }

  const ids = state.snapshot.players.map((player) => player.id);
  const currentIndex = ids.indexOf(playerId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ids.length) {
    return;
  }

  [ids[currentIndex], ids[nextIndex]] = [ids[nextIndex], ids[currentIndex]];
  sendSocket("reorderPlayers", { playerIds: ids });
}

function removePlayer(playerId) {
  if (!isHost()) {
    return;
  }

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

  if (!state.snapshot) {
    return;
  }

  state.snapshot.players.forEach((player, index) => {
    const tr = document.createElement("tr");

    const orderTd = document.createElement("td");
    orderTd.textContent = String(index + 1);

    const nameTd = document.createElement("td");
    nameTd.textContent = `${player.name}${player.isHost ? "（ホスト）" : ""}`;

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
    tr.appendChild(statusTd);
    tr.appendChild(actionTd);

    refs.playerTableBody.appendChild(tr);
  });
}

function clearGameButtons() {
  refs.nightActionButtons.innerHTML = "";
}

function clearResultTable() {
  refs.resultTableWrap.innerHTML = "";
}

function addGameButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = state.pendingAction;
  button.addEventListener("click", onClick);
  refs.nightActionButtons.appendChild(button);
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

  if (!privateGame || privateGame.phase !== "night" || privateGame.isNightComplete || state.pendingAction) {
    return;
  }

  privateGame.choices.forEach((choice) => {
    addGameButton(choice.label, () => {
      sendNightAction(choice.action);
    });
  });
}

function renderVoteButtons(privateGame) {
  clearGameButtons();

  if (!privateGame || privateGame.phase !== "vote" || privateGame.isVoteComplete || state.pendingAction) {
    return;
  }

  privateGame.choices.forEach((choice) => {
    addGameButton(choice.label, () => {
      sendVoteAction(choice.action);
    });
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
    addGameButton(choice.label, () => {
      sendHunterAction(choice.action);
    });
  });
}

function renderDiscussionButtons() {
  clearGameButtons();

  if (!isHost() || state.pendingAction) {
    return;
  }

  addGameButton("投票フェーズへ進む", () => {
    sendSocket("startVotePhase");
  });
}

function formatRemaining(deadlineAt) {
  if (!deadlineAt) {
    return "無限";
  }

  const ms = Math.max(0, Number(deadlineAt) - Date.now());
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
  }

  return `${seconds}秒`;
}

function getCountdownLine(label, deadlineAt) {
  return `${label} 残り: ${formatRemaining(deadlineAt)}`;
}

function updateLocalStatsFromResult(privateGame) {
  if (!state.snapshot || !privateGame?.result || typeof privateGame.playerIndex !== "number") {
    return;
  }

  const result = privateGame.result;
  const resultKey = `${state.snapshot.roomId}:${result.createdAt}:${privateGame.playerIndex}`;
  const processed = loadProcessedResults();

  if (processed[resultKey]) {
    return;
  }

  const row = result.playerRows[privateGame.playerIndex];

  if (!row) {
    return;
  }

  const stats = loadStats();
  const name = row.name;

  if (!stats[name]) {
    stats[name] = {
      wins: 0,
      games: 0,
    };
  }

  stats[name].games += 1;

  if (row.isWinner) {
    stats[name].wins += 1;
  }

  processed[resultKey] = true;

  saveStats(stats);
  saveProcessedResults(processed);
}

function renderLocalStats() {
  const stats = loadStats();
  const names = Object.keys(stats);

  if (names.length === 0) {
    refs.localStatsPanel.textContent = "ローカル戦績: まだ記録がありません";
    return;
  }

  const lines = ["ローカル戦績"];

  names.sort().forEach((name) => {
    const item = stats[name];
    const rate = item.games > 0 ? Math.round((item.wins / item.games) * 100) : 0;
    lines.push(`${name}: ${item.wins}勝/${item.games}戦 勝率${rate}%`);
  });

  refs.localStatsPanel.textContent = lines.join("\n");
}

function buildResultText(result) {
  if (!result) {
    return "結果を取得中です。";
  }

  return [
    "結果",
    result.headline,
    `勝者: ${result.winnerNames.length > 0 ? result.winnerNames.join("、") : "なし"}`,
    "",
    ...result.metaLines,
  ].join("\n");
}

function renderResultTable(result) {
  clearResultTable();

  if (!result) {
    return;
  }

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  ["名前", "役職履歴", "投票先", "処刑", "勝敗"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  result.playerRows.forEach((row) => {
    const tr = document.createElement("tr");

    const values = [
      row.name,
      row.roleHistory,
      row.voteTarget,
      row.isEliminated ? "処刑" : "",
      row.isWinner ? "勝利" : "敗北",
    ];

    values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  refs.resultTableWrap.appendChild(table);
}

function renderGamePanel() {
  clearGameButtons();
  clearResultTable();

  if (!state.snapshot) {
    refs.gamePanel.classList.add("hidden");
    refs.localStatsPanel.textContent = "";
    return;
  }

  refs.gamePanel.classList.toggle("hidden", state.snapshot.phase !== "started");

  if (state.snapshot.phase !== "started") {
    refs.localStatsPanel.textContent = "";
    return;
  }

  const settings = normalizeOnlineSettings(state.snapshot.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
    includeManual: false,
  });

  const privateGame = state.privateGame;
  const gamePublic = state.snapshot.gamePublic;

  if (!privateGame) {
    refs.gameStatusText.textContent = [
      "ゲーム開始状態です。",
      "役職情報を取得中です。",
    ].join("\n");
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
    refs.localStatsPanel.textContent = "";
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

    refs.localStatsPanel.textContent = "";
    renderDiscussionButtons();
    return;
  }

  if (privateGame.phase === "vote") {
    const lines = [
      "投票フェーズです。",
      `あなたの役職: ${privateGame.initialRole}`,
      getCountdownLine("投票", gamePublic?.voteDeadlineAt),
    ].filter(Boolean);

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
    refs.localStatsPanel.textContent = "";
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
    refs.localStatsPanel.textContent = "";
    renderHunterButtons(privateGame);
    return;
  }

  if (privateGame.phase === "result") {
    updateLocalStatsFromResult(privateGame);
    refs.gameStatusText.textContent = buildResultText(privateGame.result);
    renderResultTable(privateGame.result);
    renderLocalStats();
    return;
  }

  refs.gameStatusText.textContent = [
    "ゲーム進行中です。",
    `現在フェーズ: ${privateGame.phase}`,
  ].join("\n");
}

function renderHostDisconnectWarning() {
  if (!state.snapshot || !isHost()) {
    refs.hostDisconnectWarning.classList.add("hidden");
    return;
  }

  const hasDisconnected = state.snapshot.players.some((player) => !player.connected);
  refs.hostDisconnectWarning.classList.toggle("hidden", !hasDisconnected);
}

function render() {
  const hasSnapshot = Boolean(state.snapshot);

  refs.roomPanel.classList.toggle("hidden", !hasSnapshot);

  if (!hasSnapshot) {
    renderReconnectArea();
    renderGamePanel();
    return;
  }

  const settings = normalizeOnlineSettings(state.snapshot.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
    includeManual: false,
  });
  const playerCount = state.snapshot.players.length;

  refs.roomCodeText.textContent = state.snapshot.roomId;
  refs.phaseText.textContent = getPhaseLabel(state.snapshot);

  renderInvitePanel();
  renderSettings();
  renderPlayerTable();
  renderHostDisconnectWarning();

  refs.hostControls.classList.toggle("hidden", !isHost());

  const canStart = isHost()
    && state.snapshot.phase === "lobby"
    && playerCount === settings.playerCount
    && playerCount >= MIN_PLAYERS
    && playerCount <= MAX_PLAYERS
    && state.snapshot.players.every((player) => player.connected);

  refs.startGameBtn.classList.toggle("hidden", !(isHost() && state.snapshot.phase === "lobby"));
  refs.startGameBtn.disabled = !canStart;
  refs.startGameBtn.textContent = canStart
    ? "開始"
    : `開始（${playerCount}/${settings.playerCount}人）`;

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
  if (!state.snapshot) {
    return;
  }

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

setInterval(() => {
  if (state.snapshot?.phase === "started") {
    renderGamePanel();
  }
}, 1000);