import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ONLINE_HUNTER_RULE,
  TIME_OPTIONS,
  buildCountSummary,
  getAvailablePatterns,
  getDurationLabel,
  getPatternSpecialNote,
  getRoleDescription,
  getSelectedFixedRoles,
  normalizeOnlineSettings,
} from "../shared/gameLogic.js";

const WORKER_URL_STORAGE_KEY = "one_night_jinro_online_worker_url_v1";
const SESSION_STORAGE_KEY = "one_night_jinro_online_session_v1";

const refs = {
  workerUrlInput: document.getElementById("workerUrlInput"),
  saveWorkerUrlBtn: document.getElementById("saveWorkerUrlBtn"),
  workerUrlStatus: document.getElementById("workerUrlStatus"),

  playerNameInput: document.getElementById("playerNameInput"),

  createRoomBtn: document.getElementById("createRoomBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  reconnectArea: document.getElementById("reconnectArea"),
  reconnectBtn: document.getElementById("reconnectBtn"),
  connectionStatus: document.getElementById("connectionStatus"),

  roomPanel: document.getElementById("roomPanel"),
  roomCodeText: document.getElementById("roomCodeText"),
  copyRoomCodeBtn: document.getElementById("copyRoomCodeBtn"),
  phaseText: document.getElementById("phaseText"),

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
};

const state = {
  socket: null,
  snapshot: null,
  privateGame: null,
  self: null,
  session: null,
};

function loadWorkerUrl() {
  return localStorage.getItem(WORKER_URL_STORAGE_KEY) || "";
}

function saveWorkerUrl(value) {
  localStorage.setItem(WORKER_URL_STORAGE_KEY, value);
}

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

function normalizeWorkerUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function getWorkerUrl() {
  const value = normalizeWorkerUrl(refs.workerUrlInput.value);

  if (!value) {
    throw new Error("Worker URLを入力してください");
  }

  if (!/^https?:\/\//.test(value)) {
    throw new Error("Worker URLは https:// から入力してください");
  }

  return value;
}

function getPlayerName() {
  const name = refs.playerNameInput.value.trim();
  return name || "プレイヤー";
}

function setStatus(message) {
  refs.connectionStatus.textContent = message;
}

function setWorkerStatus(message) {
  refs.workerUrlStatus.textContent = message;
}

function setSettingStatus(message) {
  refs.settingStatus.textContent = message;
}

function setBusy(isBusy) {
  refs.createRoomBtn.disabled = isBusy;
  refs.joinRoomBtn.disabled = isBusy;
  refs.reconnectBtn.disabled = isBusy;
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

function connectSocket(session) {
  closeSocket();

  const socketUrl = buildWebSocketUrl(session.roomId, session.playerId, session.token);
  const socket = new WebSocket(socketUrl);
  state.socket = socket;

  socket.addEventListener("open", () => {
    setStatus("接続しました");
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "snapshot" || message.type === "connected") {
      state.snapshot = message.snapshot;
      state.privateGame = message.privateGame || null;
      state.self = message.self;
      render();
    }

    if (message.type === "error") {
      setStatus(message.error || "エラーが発生しました");
    }

    if (message.type === "settingsSaved") {
      setSettingStatus("設定を保存しました");
    }
  });

  socket.addEventListener("close", () => {
    setStatus("切断されました。再接続できます。");
    renderReconnectArea();
  });

  socket.addEventListener("error", () => {
    setStatus("接続エラーが発生しました");
  });
}

function sendSocket(type, payload = {}) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    setStatus("WebSocketが未接続です");
    return;
  }

  state.socket.send(JSON.stringify({ type, ...payload }));
}

async function createRoom() {
  setBusy(true);

  try {
    const payload = await apiFetch("/api/rooms", {
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

async function joinRoom() {
  const roomId = refs.roomCodeInput.value.trim();

  if (!/^\d{4}$/.test(roomId)) {
    setStatus("4桁のルームコードを入力してください");
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

function getPhaseLabel(phase) {
  if (phase === "lobby") {
    return "ロビー";
  }

  if (phase === "started") {
    return "ゲーム開始";
  }

  return phase || "不明";
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
    statusTd.textContent = player.connected ? "接続中" : "未接続";

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

function renderGamePanel() {
  if (!state.snapshot) {
    refs.gamePanel.classList.add("hidden");
    return;
  }

  refs.gamePanel.classList.toggle("hidden", state.snapshot.phase !== "started");

  if (state.snapshot.phase !== "started") {
    return;
  }

  const settings = normalizeOnlineSettings(state.snapshot.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
    includeManual: false,
  });

  const privateGame = state.privateGame;

  if (!privateGame) {
    refs.gameStatusText.textContent = [
      "ゲーム開始状態です。",
      "役職情報を取得中です。",
    ].join("\n");
    return;
  }

  refs.gameStatusText.textContent = [
    "ゲーム開始状態です。",
    `人数: ${settings.playerCount}人`,
    `パターン: ${settings.pattern}`,
    `あなたの順番: ${privateGame.playerIndex + 1}`,
    `あなたの役職: ${privateGame.initialRole}`,
    `墓地枚数: ${privateGame.graveCount}枚`,
    privateGame.hasDeadPlayer ? "3人目の死体があります" : "",
    "現在はサーバー側で配役作成まで完了しています。",
    "次段階で夜行動・投票・結果表示を実装します。",
    `狩人追加処刑: ${ONLINE_HUNTER_RULE.timeoutSeconds}秒、未送信時は追加処刑なし。`,
  ].filter(Boolean).join("\n");
}

function render() {
  const hasSnapshot = Boolean(state.snapshot);

  refs.roomPanel.classList.toggle("hidden", !hasSnapshot);

  if (!hasSnapshot) {
    renderReconnectArea();
    return;
  }

  const settings = normalizeOnlineSettings(state.snapshot.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
    includeManual: false,
  });
  const playerCount = state.snapshot.players.length;

  refs.roomCodeText.textContent = state.snapshot.roomId;
  refs.phaseText.textContent = getPhaseLabel(state.snapshot.phase);

  renderSettings();
  renderPlayerTable();

  refs.hostControls.classList.toggle("hidden", !isHost());

  const canStart = isHost()
    && state.snapshot.phase === "lobby"
    && playerCount === settings.playerCount
    && playerCount >= MIN_PLAYERS
    && playerCount <= MAX_PLAYERS;

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

refs.saveWorkerUrlBtn.addEventListener("click", () => {
  const value = normalizeWorkerUrl(refs.workerUrlInput.value);
  saveWorkerUrl(value);
  setWorkerStatus(value ? "保存しました" : "未設定です");
});

refs.createRoomBtn.addEventListener("click", createRoom);
refs.joinRoomBtn.addEventListener("click", joinRoom);
refs.reconnectBtn.addEventListener("click", reconnect);

refs.copyRoomCodeBtn.addEventListener("click", async () => {
  if (!state.snapshot) {
    return;
  }

  await navigator.clipboard.writeText(state.snapshot.roomId);
  setStatus("ルームコードをコピーしました");
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
  refs.roomCodeInput.value = refs.roomCodeInput.value.replace(/\D/g, "").slice(0, 4);
});

populatePlayerCountOptions();
populateTimeOptions(refs.settingNightSeconds, "nightSeconds");
populateTimeOptions(refs.settingDiscussionSeconds, "discussionSeconds");
populateTimeOptions(refs.settingVoteSeconds, "voteSeconds");
applySettingsToForm(DEFAULT_SETTINGS);
refs.currentSettingsText.textContent = buildSettingsText(DEFAULT_SETTINGS);

refs.workerUrlInput.value = loadWorkerUrl();
state.session = loadSession();

if (refs.workerUrlInput.value) {
  setWorkerStatus("保存済みです");
} else {
  setWorkerStatus("Worker URLを保存してください");
}

renderReconnectArea();
