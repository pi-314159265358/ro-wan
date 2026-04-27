var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var MIN_PLAYERS = 2;
var MAX_PLAYERS = 10;
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
__name(jsonResponse, "jsonResponse");
function jsonCors(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}
__name(jsonCors, "jsonCors");
function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withCors, "withCors");
function optionResponse() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}
__name(optionResponse, "optionResponse");
function randomString(length, alphabet) {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[values[i] % alphabet.length];
  }
  return result;
}
__name(randomString, "randomString");
function createRoomCode() {
  return randomString(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
}
__name(createRoomCode, "createRoomCode");
function createId(prefix) {
  return `${prefix}_${randomString(20, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}`;
}
__name(createId, "createId");
function normalizeName(value) {
  const name = String(value || "").trim().slice(0, 12);
  return name || "\u30D7\u30EC\u30A4\u30E4\u30FC";
}
__name(normalizeName, "normalizeName");
function now() {
  return Date.now();
}
__name(now, "now");
function getRoomStub(env, roomId) {
  const id = env.ROOMS.idFromName(roomId);
  return env.ROOMS.get(id);
}
__name(getRoomStub, "getRoomStub");
async function readJson(request) {
  return request.json().catch(() => ({}));
}
__name(readJson, "readJson");
var RoomDurableObject = class {
  static {
    __name(this, "RoomDurableObject");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = /* @__PURE__ */ new Map();
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return optionResponse();
    }
    if (url.pathname === "/create" && request.method === "POST") {
      return this.createRoom(request);
    }
    if (url.pathname === "/join" && request.method === "POST") {
      return this.joinRoom(request);
    }
    if (url.pathname === "/socket" && request.method === "GET") {
      return this.connectSocket(request);
    }
    return jsonResponse({ ok: false, error: "Not found" }, 404);
  }
  async getRoom() {
    return this.state.storage.get("room");
  }
  async saveRoom(room) {
    room.updatedAt = now();
    await this.state.storage.put("room", room);
  }
  buildPublicSnapshot(room) {
    return {
      roomId: room.roomId,
      phase: room.phase,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.id === room.hostPlayerId,
        connected: Boolean(player.connected),
        joinedAt: player.joinedAt
      })),
      settings: room.settings
    };
  }
  findPlayerByToken(room, playerId, token) {
    return room.players.find((player) => {
      return player.id === playerId && player.token === token;
    });
  }
  async createRoom(request) {
    const existingRoom = await this.getRoom();
    if (existingRoom) {
      return jsonResponse({ ok: false, error: "Room already exists" }, 409);
    }
    const body = await readJson(request);
    const roomId = String(body.roomId || "").trim().toUpperCase();
    if (!roomId) {
      return jsonResponse({ ok: false, error: "roomId is required" }, 400);
    }
    const player = {
      id: createId("player"),
      token: createId("token"),
      name: normalizeName(body.name),
      connected: false,
      joinedAt: now()
    };
    const room = {
      roomId,
      phase: "lobby",
      createdAt: now(),
      updatedAt: now(),
      hostPlayerId: player.id,
      players: [player],
      settings: {
        minPlayers: MIN_PLAYERS,
        maxPlayers: MAX_PLAYERS
      }
    };
    await this.saveRoom(room);
    return jsonResponse({
      ok: true,
      roomId,
      playerId: player.id,
      token: player.token,
      isHost: true,
      snapshot: this.buildPublicSnapshot(room)
    });
  }
  async joinRoom(request) {
    const room = await this.getRoom();
    if (!room) {
      return jsonResponse({ ok: false, error: "\u90E8\u5C4B\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    }
    const body = await readJson(request);
    const requestedPlayerId = String(body.playerId || "");
    const requestedToken = String(body.token || "");
    const existingPlayer = this.findPlayerByToken(room, requestedPlayerId, requestedToken);
    if (existingPlayer) {
      existingPlayer.name = normalizeName(body.name || existingPlayer.name);
      await this.saveRoom(room);
      return jsonResponse({
        ok: true,
        roomId: room.roomId,
        playerId: existingPlayer.id,
        token: existingPlayer.token,
        isHost: existingPlayer.id === room.hostPlayerId,
        snapshot: this.buildPublicSnapshot(room)
      });
    }
    if (room.phase !== "lobby") {
      return jsonResponse({ ok: false, error: "\u958B\u59CB\u5F8C\u306E\u65B0\u898F\u53C2\u52A0\u306F\u3067\u304D\u307E\u305B\u3093" }, 400);
    }
    if (room.players.length >= MAX_PLAYERS) {
      return jsonResponse({ ok: false, error: "\u90E8\u5C4B\u304C\u6E80\u54E1\u3067\u3059" }, 400);
    }
    const player = {
      id: createId("player"),
      token: createId("token"),
      name: normalizeName(body.name),
      connected: false,
      joinedAt: now()
    };
    room.players.push(player);
    await this.saveRoom(room);
    await this.broadcastSnapshot();
    return jsonResponse({
      ok: true,
      roomId: room.roomId,
      playerId: player.id,
      token: player.token,
      isHost: false,
      snapshot: this.buildPublicSnapshot(room)
    });
  }
  async connectSocket(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return jsonResponse({ ok: false, error: "WebSocket required" }, 426);
    }
    const room = await this.getRoom();
    if (!room) {
      return jsonResponse({ ok: false, error: "\u90E8\u5C4B\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404);
    }
    const playerId = url.searchParams.get("playerId") || "";
    const token = url.searchParams.get("token") || "";
    const player = this.findPlayerByToken(room, playerId, token);
    if (!player) {
      return jsonResponse({ ok: false, error: "\u518D\u63A5\u7D9A\u60C5\u5831\u304C\u4E0D\u6B63\u3067\u3059" }, 401);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const sessionId = createId("session");
    server.accept();
    const oldSession = this.sessions.get(playerId);
    if (oldSession) {
      try {
        oldSession.socket.close(1e3, "replaced");
      } catch {
      }
    }
    this.sessions.set(playerId, {
      socket: server,
      sessionId
    });
    player.connected = true;
    await this.saveRoom(room);
    server.addEventListener("message", (event) => {
      this.handleSocketMessage(playerId, event.data);
    });
    server.addEventListener("close", () => {
      this.closeSession(playerId, sessionId);
    });
    server.addEventListener("error", () => {
      this.closeSession(playerId, sessionId);
    });
    server.send(JSON.stringify({
      type: "connected",
      snapshot: this.buildPublicSnapshot(room),
      self: {
        playerId,
        isHost: playerId === room.hostPlayerId
      }
    }));
    await this.broadcastSnapshot();
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  async handleSocketMessage(playerId, rawData) {
    let message;
    try {
      message = JSON.parse(rawData);
    } catch {
      await this.sendError(playerId, "\u30E1\u30C3\u30BB\u30FC\u30B8\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
      return;
    }
    const room = await this.getRoom();
    if (!room) {
      await this.sendError(playerId, "\u90E8\u5C4B\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    const player = room.players.find((item) => item.id === playerId);
    if (!player) {
      await this.sendError(playerId, "\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    const isHost = playerId === room.hostPlayerId;
    if (message.type === "startGame") {
      await this.handleStartGame(room, playerId, isHost);
      return;
    }
    if (message.type === "backToLobby") {
      await this.handleBackToLobby(room, isHost);
      return;
    }
    if (message.type === "reorderPlayers") {
      await this.handleReorderPlayers(room, message.playerIds, isHost);
      return;
    }
    if (message.type === "removePlayer") {
      await this.handleRemovePlayer(room, message.playerId, isHost);
      return;
    }
    if (message.type === "updateName") {
      await this.handleUpdateName(room, playerId, message);
      return;
    }
    if (message.type === "ping") {
      await this.sendToPlayer(playerId, { type: "pong", time: now() });
    }
  }
  async handleStartGame(room, playerId, isHost) {
    if (!isHost) {
      await this.sendError(playerId, "\u30DB\u30B9\u30C8\u306E\u307F\u958B\u59CB\u3067\u304D\u307E\u3059");
      return;
    }
    if (room.phase !== "lobby") {
      await this.sendError(playerId, "\u30ED\u30D3\u30FC\u4E2D\u306E\u307F\u958B\u59CB\u3067\u304D\u307E\u3059");
      return;
    }
    if (room.players.length < MIN_PLAYERS) {
      await this.sendError(playerId, `${MIN_PLAYERS}\u4EBA\u4EE5\u4E0A\u3067\u958B\u59CB\u3067\u304D\u307E\u3059`);
      return;
    }
    if (room.players.length > MAX_PLAYERS) {
      await this.sendError(playerId, `${MAX_PLAYERS}\u4EBA\u4EE5\u4E0B\u3067\u958B\u59CB\u3067\u304D\u307E\u3059`);
      return;
    }
    room.phase = "started";
    room.startedAt = now();
    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }
  async handleBackToLobby(room, isHost) {
    if (!isHost) {
      return;
    }
    room.phase = "lobby";
    delete room.startedAt;
    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }
  async handleReorderPlayers(room, playerIds, isHost) {
    if (!isHost || room.phase !== "lobby") {
      return;
    }
    if (!Array.isArray(playerIds)) {
      return;
    }
    const currentIds = room.players.map((player) => player.id).sort();
    const nextIds = [...playerIds].sort();
    if (currentIds.length !== nextIds.length) {
      return;
    }
    for (let i = 0; i < currentIds.length; i += 1) {
      if (currentIds[i] !== nextIds[i]) {
        return;
      }
    }
    room.players = playerIds.map((id) => room.players.find((player) => player.id === id));
    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }
  async handleRemovePlayer(room, targetPlayerId, isHost) {
    if (!isHost || room.phase !== "lobby") {
      return;
    }
    if (targetPlayerId === room.hostPlayerId) {
      return;
    }
    const beforeLength = room.players.length;
    room.players = room.players.filter((player) => player.id !== targetPlayerId);
    if (room.players.length === beforeLength) {
      return;
    }
    const targetSession = this.sessions.get(targetPlayerId);
    if (targetSession) {
      try {
        targetSession.socket.close(1e3, "removed");
      } catch {
      }
      this.sessions.delete(targetPlayerId);
    }
    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }
  async handleUpdateName(room, playerId, message) {
    if (room.phase !== "lobby") {
      return;
    }
    const player = room.players.find((item) => item.id === playerId);
    if (!player) {
      return;
    }
    player.name = normalizeName(message.name);
    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }
  async closeSession(playerId, sessionId) {
    const currentSession = this.sessions.get(playerId);
    if (!currentSession || currentSession.sessionId !== sessionId) {
      return;
    }
    this.sessions.delete(playerId);
    const room = await this.getRoom();
    if (!room) {
      return;
    }
    const player = room.players.find((item) => item.id === playerId);
    if (!player) {
      return;
    }
    player.connected = false;
    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }
  async sendToPlayer(playerId, payload) {
    const session = this.sessions.get(playerId);
    if (!session) {
      return;
    }
    try {
      session.socket.send(JSON.stringify(payload));
    } catch {
    }
  }
  async sendError(playerId, error) {
    await this.sendToPlayer(playerId, {
      type: "error",
      error
    });
  }
  async broadcastSnapshot() {
    const room = await this.getRoom();
    if (!room) {
      return;
    }
    const snapshot = this.buildPublicSnapshot(room);
    for (const [playerId, session] of this.sessions.entries()) {
      const payload = {
        type: "snapshot",
        snapshot,
        self: {
          playerId,
          isHost: playerId === room.hostPlayerId
        }
      };
      try {
        session.socket.send(JSON.stringify(payload));
      } catch {
      }
    }
  }
};
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return optionResponse();
    }
    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return jsonCors({
          ok: true,
          service: "one-night-jinro-online"
        });
      }
      if (url.pathname === "/api/rooms" && request.method === "POST") {
        const body = await readJson(request);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const roomId = createRoomCode();
          const stub = getRoomStub(env, roomId);
          const response = await stub.fetch(new Request("https://room/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              roomId,
              name: body.name
            })
          }));
          if (response.status !== 409) {
            return withCors(response);
          }
        }
        return jsonCors({ ok: false, error: "\u90E8\u5C4B\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F" }, 500);
      }
      const roomJoinMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/join$/);
      if (roomJoinMatch && request.method === "POST") {
        const roomId = roomJoinMatch[1];
        const stub = getRoomStub(env, roomId);
        const targetUrl = new URL("https://room/join");
        const response = await stub.fetch(new Request(targetUrl, request));
        return withCors(response);
      }
      const socketMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/socket$/);
      if (socketMatch && request.method === "GET") {
        const roomId = socketMatch[1];
        const stub = getRoomStub(env, roomId);
        const targetUrl = new URL("https://room/socket");
        targetUrl.search = url.search;
        return stub.fetch(new Request(targetUrl, request));
      }
      return jsonCors({ ok: false, error: "Not found" }, 404);
    } catch (error) {
      return jsonCors({
        ok: false,
        error: error instanceof Error ? error.message : "Internal error"
      }, 500);
    }
  }
};
export {
  RoomDurableObject,
  worker_default as default
};
//# sourceMappingURL=worker.js.map
