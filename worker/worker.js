import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  completeVotesAndAdvance,
  createAutoNightAction,
  createAutoVoteAction,
  createInitialGameSetup,
  getPlayerGameView,
  isNightComplete,
  isVoteComplete,
  moveGameToDiscussion,
  moveGameToVote,
  normalizeOnlineSettings,
  resolveHunterAction,
  resolveHunterTimeout,
  resolveNightAction,
  resolveVoteAction,
} from "../shared/gameLogic.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function jsonCors(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function optionResponse() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function randomString(length, alphabet) {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);

  let result = "";

  for (let i = 0; i < length; i += 1) {
    result += alphabet[values[i] % alphabet.length];
  }

  return result;
}

function createRoomCode() {
  return randomString(4, "0123456789");
}

function createId(prefix) {
  return `${prefix}_${randomString(20, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}`;
}

function normalizeName(value) {
  const name = String(value || "").trim().slice(0, 12);
  return name || "プレイヤー";
}

function now() {
  return Date.now();
}

function getRoomStub(env, roomId) {
  const id = env.ROOMS.idFromName(roomId);
  return env.ROOMS.get(id);
}

async function readJson(request) {
  return request.json().catch(() => ({}));
}

export class RoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
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

  async alarm() {
    const room = await this.getRoom();

    if (!room || room.phase !== "started" || !room.game) {
      return;
    }

    const currentTime = now();

    if (room.game.phase === "night") {
      const deadlineAt = room.game.nightDeadlineAt;

      if (!deadlineAt || currentTime < deadlineAt) {
        return;
      }

      for (let i = 0; i < room.game.nightResults.length; i += 1) {
        if (!room.game.nightResults[i]) {
          const action = createAutoNightAction(room.game, i);
          resolveNightAction(room.game, i, action);
        }
      }

      if (isNightComplete(room.game)) {
        moveGameToDiscussion(room.game, currentTime);
        await this.saveRoom(room);
        await this.setGameAlarmIfNeeded(room);
        await this.broadcastSnapshot();
      }

      return;
    }

    if (room.game.phase === "discussion") {
      const deadlineAt = room.game.discussionDeadlineAt;

      if (!deadlineAt || currentTime < deadlineAt) {
        return;
      }

      moveGameToVote(room.game, currentTime);
      await this.saveRoom(room);
      await this.setGameAlarmIfNeeded(room);
      await this.broadcastSnapshot();
      return;
    }

    if (room.game.phase === "vote") {
      const deadlineAt = room.game.voteDeadlineAt;

      if (!deadlineAt || currentTime < deadlineAt) {
        return;
      }

      for (let i = 0; i < room.game.votes.length; i += 1) {
        if (room.game.votes[i] === null) {
          resolveVoteAction(room.game, i, createAutoVoteAction());
        }
      }

      if (isVoteComplete(room.game)) {
        completeVotesAndAdvance(room.game, currentTime);
      }

      await this.saveRoom(room);
      await this.setGameAlarmIfNeeded(room);
      await this.broadcastSnapshot();
      return;
    }

    if (room.game.phase === "hunterExecution") {
      const deadlineAt = room.game.hunterDeadlineAt;

      if (!deadlineAt || currentTime < deadlineAt) {
        return;
      }

      resolveHunterTimeout(room.game, currentTime);

      await this.saveRoom(room);
      await this.broadcastSnapshot();
    }
  }

  async getRoom() {
    return this.state.storage.get("room");
  }

  async saveRoom(room) {
    room.updatedAt = now();
    await this.state.storage.put("room", room);
  }

  async setGameAlarmIfNeeded(room) {
    if (!room.game) {
      return;
    }

    if (room.game.phase === "night" && room.game.nightDeadlineAt) {
      await this.state.storage.setAlarm(room.game.nightDeadlineAt + 250);
      return;
    }

    if (room.game.phase === "discussion" && room.game.discussionDeadlineAt) {
      await this.state.storage.setAlarm(room.game.discussionDeadlineAt + 250);
      return;
    }

    if (room.game.phase === "vote" && room.game.voteDeadlineAt) {
      await this.state.storage.setAlarm(room.game.voteDeadlineAt + 250);
      return;
    }

    if (room.game.phase === "hunterExecution" && room.game.hunterDeadlineAt) {
      await this.state.storage.setAlarm(room.game.hunterDeadlineAt + 250);
    }
  }

  buildPublicSnapshot(room) {
    return {
      roomId: room.roomId,
      phase: room.phase,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      startedAt: room.startedAt || null,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.id === room.hostPlayerId,
        connected: Boolean(player.connected),
        joinedAt: player.joinedAt,
      })),
      settings: normalizeOnlineSettings(room.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
        includeManual: false,
      }),
      gamePublic: room.game ? {
        phase: room.game.phase,
        count: room.game.count,
        pattern: room.game.pattern,
        graveCount: room.game.initialGraveCards.length,
        hasDeadPlayer: Boolean(room.game.deadPlayer),
        nightDeadlineAt: room.game.nightDeadlineAt || null,
        discussionDeadlineAt: room.game.discussionDeadlineAt || null,
        voteDeadlineAt: room.game.voteDeadlineAt || null,
        hunterDeadlineAt: room.game.hunterDeadlineAt || null,
      } : null,
    };
  }

  buildPrivateGame(room, playerId) {
    if (!room.game || room.phase !== "started") {
      return null;
    }

    const playerIndex = room.players.findIndex((player) => player.id === playerId);

    if (playerIndex < 0) {
      return null;
    }

    return getPlayerGameView(room.game, playerIndex);
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
    const roomId = String(body.roomId || "").trim();

    if (!/^\d{4}$/.test(roomId)) {
      return jsonResponse({ ok: false, error: "roomId is required" }, 400);
    }

    const player = {
      id: createId("player"),
      token: createId("token"),
      name: normalizeName(body.name),
      connected: false,
      joinedAt: now(),
    };

    const room = {
      roomId,
      phase: "lobby",
      createdAt: now(),
      updatedAt: now(),
      startedAt: null,
      hostPlayerId: player.id,
      players: [player],
      settings: normalizeOnlineSettings(body.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
        includeManual: false,
      }),
      game: null,
    };

    await this.saveRoom(room);

    return jsonResponse({
      ok: true,
      roomId,
      playerId: player.id,
      token: player.token,
      isHost: true,
      snapshot: this.buildPublicSnapshot(room),
    });
  }

  async joinRoom(request) {
    const room = await this.getRoom();

    if (!room) {
      return jsonResponse({ ok: false, error: "部屋が見つかりません" }, 404);
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
        snapshot: this.buildPublicSnapshot(room),
      });
    }

    if (room.phase !== "lobby") {
      return jsonResponse({ ok: false, error: "開始後の新規参加はできません" }, 400);
    }

    const settings = normalizeOnlineSettings(room.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
      includeManual: false,
    });

    if (room.players.length >= settings.playerCount) {
      return jsonResponse({ ok: false, error: "設定人数が満員です" }, 400);
    }

    if (room.players.length >= MAX_PLAYERS) {
      return jsonResponse({ ok: false, error: "部屋が満員です" }, 400);
    }

    const player = {
      id: createId("player"),
      token: createId("token"),
      name: normalizeName(body.name),
      connected: false,
      joinedAt: now(),
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
      snapshot: this.buildPublicSnapshot(room),
    });
  }

  async connectSocket(request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return jsonResponse({ ok: false, error: "WebSocket required" }, 426);
    }

    const room = await this.getRoom();

    if (!room) {
      return jsonResponse({ ok: false, error: "部屋が見つかりません" }, 404);
    }

    const playerId = url.searchParams.get("playerId") || "";
    const token = url.searchParams.get("token") || "";
    const player = this.findPlayerByToken(room, playerId, token);

    if (!player) {
      return jsonResponse({ ok: false, error: "再接続情報が不正です" }, 401);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const sessionId = createId("session");

    server.accept();

    const oldSession = this.sessions.get(playerId);
    if (oldSession) {
      try {
        oldSession.socket.close(1000, "replaced");
      } catch {
        // ignore
      }
    }

    this.sessions.set(playerId, {
      socket: server,
      sessionId,
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
      privateGame: this.buildPrivateGame(room, playerId),
      self: {
        playerId,
        isHost: playerId === room.hostPlayerId,
      },
    }));

    await this.broadcastSnapshot();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSocketMessage(playerId, rawData) {
    let message;

    try {
      message = JSON.parse(rawData);
    } catch {
      await this.sendError(playerId, "メッセージ形式が不正です");
      return;
    }

    const room = await this.getRoom();

    if (!room) {
      await this.sendError(playerId, "部屋が見つかりません");
      return;
    }

    const player = room.players.find((item) => item.id === playerId);

    if (!player) {
      await this.sendError(playerId, "プレイヤーが見つかりません");
      return;
    }

    const isHost = playerId === room.hostPlayerId;

    if (message.type === "updateSettings") {
      await this.handleUpdateSettings(room, playerId, message.settings, isHost);
      return;
    }

    if (message.type === "startGame") {
      await this.handleStartGame(room, playerId, isHost);
      return;
    }

    if (message.type === "submitNightAction") {
      await this.handleSubmitNightAction(room, playerId, message.action);
      return;
    }

    if (message.type === "startVotePhase") {
      await this.handleStartVotePhase(room, playerId, isHost);
      return;
    }

    if (message.type === "submitVote") {
      await this.handleSubmitVote(room, playerId, message.action);
      return;
    }

    if (message.type === "submitHunterAction") {
      await this.handleSubmitHunterAction(room, playerId, message.action);
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

  async handleUpdateSettings(room, playerId, settingsInput, isHost) {
    if (!isHost) {
      await this.sendError(playerId, "ホストのみ設定を変更できます");
      return;
    }

    if (room.phase !== "lobby") {
      await this.sendError(playerId, "ロビー中のみ設定を変更できます");
      return;
    }

    const currentSettings = normalizeOnlineSettings(room.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
      includeManual: false,
    });

    const nextSettings = normalizeOnlineSettings(settingsInput || {}, currentSettings, {
      includeManual: false,
    });

    if (nextSettings.playerCount < room.players.length) {
      await this.sendError(playerId, "現在の参加者数より少ない人数にはできません");
      return;
    }

    room.settings = nextSettings;

    await this.saveRoom(room);
    await this.sendToPlayer(playerId, {
      type: "settingsSaved",
    });
    await this.broadcastSnapshot();
  }

  async handleStartGame(room, playerId, isHost) {
    if (!isHost) {
      await this.sendError(playerId, "ホストのみ開始できます");
      return;
    }

    if (room.phase !== "lobby") {
      await this.sendError(playerId, "ロビー中のみ開始できます");
      return;
    }

    const settings = normalizeOnlineSettings(room.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS, {
      includeManual: false,
    });

    if (room.players.length !== settings.playerCount) {
      await this.sendError(playerId, `${settings.playerCount}人ちょうどで開始できます`);
      return;
    }

    if (room.players.length < MIN_PLAYERS) {
      await this.sendError(playerId, `${MIN_PLAYERS}人以上で開始できます`);
      return;
    }

    if (room.players.length > MAX_PLAYERS) {
      await this.sendError(playerId, `${MAX_PLAYERS}人以下で開始できます`);
      return;
    }

    try {
      room.game = createInitialGameSetup(
        room.players.map((player) => player.name),
        settings
      );
    } catch (error) {
      await this.sendError(
        playerId,
        error instanceof Error ? error.message : "配役作成に失敗しました"
      );
      return;
    }

    room.phase = "started";
    room.startedAt = now();

    room.game.nightStartedAt = now();

    if (settings.nightSeconds > 0) {
      room.game.nightDeadlineAt = room.game.nightStartedAt + settings.nightSeconds * 1000;
    } else {
      room.game.nightDeadlineAt = null;
    }

    await this.saveRoom(room);
    await this.setGameAlarmIfNeeded(room);
    await this.broadcastSnapshot();
  }

  async handleSubmitNightAction(room, playerId, action) {
    if (room.phase !== "started" || !room.game || room.game.phase !== "night") {
      await this.sendError(playerId, "夜フェーズではありません");
      return;
    }

    const playerIndex = room.players.findIndex((player) => player.id === playerId);

    if (playerIndex < 0) {
      await this.sendError(playerId, "プレイヤーが見つかりません");
      return;
    }

    try {
      resolveNightAction(room.game, playerIndex, action);
    } catch (error) {
      await this.sendError(
        playerId,
        error instanceof Error ? error.message : "夜行動の処理に失敗しました"
      );
      return;
    }

    if (isNightComplete(room.game)) {
      moveGameToDiscussion(room.game, now());
      await this.setGameAlarmIfNeeded(room);
    }

    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }

  async handleStartVotePhase(room, playerId, isHost) {
    if (!isHost) {
      await this.sendError(playerId, "ホストのみ投票フェーズへ進めます");
      return;
    }

    if (room.phase !== "started" || !room.game || room.game.phase !== "discussion") {
      await this.sendError(playerId, "議論フェーズではありません");
      return;
    }

    moveGameToVote(room.game, now());

    await this.saveRoom(room);
    await this.setGameAlarmIfNeeded(room);
    await this.broadcastSnapshot();
  }

  async handleSubmitVote(room, playerId, action) {
    if (room.phase !== "started" || !room.game || room.game.phase !== "vote") {
      await this.sendError(playerId, "投票フェーズではありません");
      return;
    }

    const playerIndex = room.players.findIndex((player) => player.id === playerId);

    if (playerIndex < 0) {
      await this.sendError(playerId, "プレイヤーが見つかりません");
      return;
    }

    try {
      resolveVoteAction(room.game, playerIndex, action);
    } catch (error) {
      await this.sendError(
        playerId,
        error instanceof Error ? error.message : "投票処理に失敗しました"
      );
      return;
    }

    if (isVoteComplete(room.game)) {
      completeVotesAndAdvance(room.game, now());
      await this.setGameAlarmIfNeeded(room);
    }

    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }

  async handleSubmitHunterAction(room, playerId, action) {
    if (room.phase !== "started" || !room.game || room.game.phase !== "hunterExecution") {
      await this.sendError(playerId, "狩人追加処刑フェーズではありません");
      return;
    }

    const playerIndex = room.players.findIndex((player) => player.id === playerId);

    if (playerIndex < 0) {
      await this.sendError(playerId, "プレイヤーが見つかりません");
      return;
    }

    try {
      resolveHunterAction(room.game, playerIndex, action, now());
    } catch (error) {
      await this.sendError(
        playerId,
        error instanceof Error ? error.message : "狩人追加処刑の処理に失敗しました"
      );
      return;
    }

    await this.saveRoom(room);
    await this.broadcastSnapshot();
  }

  async handleBackToLobby(room, isHost) {
    if (!isHost) {
      return;
    }

    room.phase = "lobby";
    room.startedAt = null;
    room.game = null;

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
        targetSession.socket.close(1000, "removed");
      } catch {
        // ignore
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
      // ignore
    }
  }

  async sendError(playerId, error) {
    await this.sendToPlayer(playerId, {
      type: "error",
      error,
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
        privateGame: this.buildPrivateGame(room, playerId),
        self: {
          playerId,
          isHost: playerId === room.hostPlayerId,
        },
      };

      try {
        session.socket.send(JSON.stringify(payload));
      } catch {
        // ignore
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return optionResponse();
    }

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return jsonCors({
          ok: true,
          service: "one-night-jinro-online",
        });
      }

      if (url.pathname === "/api/rooms" && request.method === "POST") {
        const body = await readJson(request);

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const roomId = createRoomCode();
          const stub = getRoomStub(env, roomId);

          const response = await stub.fetch(new Request("https://room/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              roomId,
              name: body.name,
              settings: body.settings,
            }),
          }));

          if (response.status !== 409) {
            return withCors(response);
          }
        }

        return jsonCors({ ok: false, error: "部屋作成に失敗しました" }, 500);
      }

      const roomJoinMatch = url.pathname.match(/^\/api\/rooms\/(\d{4})\/join$/);
      if (roomJoinMatch && request.method === "POST") {
        const roomId = roomJoinMatch[1];
        const stub = getRoomStub(env, roomId);

        const response = await stub.fetch(new Request("https://room/join", request));

        return withCors(response);
      }

      const socketMatch = url.pathname.match(/^\/api\/rooms\/(\d{4})\/socket$/);
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
        error: error instanceof Error ? error.message : "Internal error",
      }, 500);
    }
  },
};