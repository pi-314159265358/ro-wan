import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ONLINE_HUNTER_RULE,
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

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
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
      state.self = message.self;
      render();
    }

    if (message.type === "error") {
      setStatus(message.error || "エラーが発生しました");
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
  const roomId = refs.roomCodeInput.value.trim().toUpperCase();

  if (!roomId) {
    setStatus("ルームコードを入力してください");
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

  if (state.snapshot.phase === "started") {
    refs.gameStatusText.textContent = [
      "ゲーム開始状態です。",
      "現在はオンライン同期の最小構成です。",
      `次段階で配役・夜行動・投票・狩人追加処刑を実装します。`,
      `狩人追加処刑: ${ONLINE_HUNTER_RULE.timeoutSeconds}秒、未送信時は追加処刑なし。`,
    ].join("\n");
  }
}

function render() {
  const hasSnapshot = Boolean(state.snapshot);

  refs.roomPanel.classList.toggle("hidden", !hasSnapshot);

  if (!hasSnapshot) {
    renderReconnectArea();
    return;
  }

  refs.roomCodeText.textContent = state.snapshot.roomId;
  refs.phaseText.textContent = getPhaseLabel(state.snapshot.phase);

  renderPlayerTable();

  refs.hostControls.classList.toggle("hidden", !isHost());

  const canStart = isHost()
    && state.snapshot.phase === "lobby"
    && state.snapshot.players.length >= MIN_PLAYERS
    && state.snapshot.players.length <= MAX_PLAYERS;

  refs.startGameBtn.classList.toggle("hidden", !canStart);
  refs.startGameBtn.disabled = !canStart;

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

refs.roomCodeInput.addEventListener("input", () => {
  refs.roomCodeInput.value = refs.roomCodeInput.value.toUpperCase();
});

refs.workerUrlInput.value = loadWorkerUrl();
state.session = loadSession();

if (refs.workerUrlInput.value) {
  setWorkerStatus("保存済みです");
} else {
  setWorkerStatus("Worker URLを保存してください");
}

renderReconnectArea();