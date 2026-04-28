export const APP_VERSION = "v0.6.0";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export const ROLE_PATTERNS = {
  2: {
    A: ["大狼", "占い師", "吸血鬼", "狩人"],
    B: ["人狼", "占い師", "吸血鬼", "狩人", "村長"],
  },
  3: {
    A: ["大狼", "狂人", "占い師", "吸血鬼", "狩人"],
    B: ["人狼", "狂人", "占い師", "怪盗", "狩人"],
    C: ["人狼", "人狼", "占い師", "怪盗", "村人"],
  },
  4: {
    A: ["大狼", "狂人", "占い師", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "狂人", "占い師", "怪盗", "狩人", "村人"],
    C: ["人狼", "人狼", "占い師", "怪盗", "村人", "村人"],
  },
  5: {
    A: ["人狼", "人狼", "狂人", "占い師", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "人狼", "狂人", "占い師", "怪盗", "狩人", "村人"],
    C: ["人狼", "人狼", "狂人", "占い師", "怪盗", "村人", "村人"],
  },
  6: {
    A: ["人狼", "人狼", "狂人", "占い師", "怪盗", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "人狼", "狂人", "占い師", "怪盗", "狩人", "村人", "村人"],
  },
  7: {
    A: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "狩人", "村人", "村人"],
  },
  8: {
    A: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長", "モブおじさん"],
    B: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村人", "村人"],
  },
  9: {
    A: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長", "モブおじさん", "パン屋"],
    B: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長", "村人", "村人"],
  },
  10: {
    A: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長", "モブおじさん", "パン屋", "魔女っ子"],
    B: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長", "モブおじさん", "村人", "村人"],
  },
};

export const ROLE_DESCRIPTIONS = {
  人狼: "人狼が吊られなければ勝利",
  大狼: "墓地も確認できる人狼",
  狂人: "人狼陣営。人狼がいない場合は村陣営",
  占い師: "夜に誰か1人か墓地2枚を見る",
  怪盗: "夜に誰か1人と役職を交換する",
  吸血鬼: "夜に誰か1人または墓地1枚と役職を交換する",
  狩人: "吊られたら追加で1人吊れる",
  村長: "投票が2票になる",
  モブおじさん: "誰かを訪問して熱い夜を過ごす",
  パン屋: "夜に誰か1人にパンを届ける",
  魔女っ子: "夜に誰か1人の役職を見る",
  村人: "夜の行動なし",
};

export const TIME_OPTIONS = {
  nightSeconds: [
    { value: 20, label: "20秒" },
    { value: 30, label: "30秒" },
    { value: 0, label: "無限" },
  ],
  discussionSeconds: [
    { value: 60, label: "60秒" },
    { value: 120, label: "120秒" },
    { value: 180, label: "180秒" },
    { value: 0, label: "無限" },
  ],
  voteSeconds: [
    { value: 30, label: "30秒" },
    { value: 0, label: "無限" },
  ],
};

export const DEFAULT_SETTINGS = {
  playerCount: 2,
  pattern: "A",
  nightSeconds: 30,
  discussionSeconds: 120,
  voteSeconds: 30,
};

export const ONLINE_HUNTER_RULE = {
  timeoutSeconds: 30,
  timeoutAction: "none",
  description: "オンライン版のみ、狩人の追加処刑は30秒。未送信時は追加処刑なし。",
};

export function isWerewolfRole(role) {
  return role === "人狼" || role === "大狼";
}

export function isTwoPlayerCount(count) {
  return Number(count) === 2;
}

export function isTwoPlayerPatternB(count, pattern) {
  return Number(count) === 2 && pattern === "B";
}

export function getAvailablePatterns(playerCount) {
  return Object.keys(ROLE_PATTERNS[Number(playerCount)] || {});
}

export function getSelectedFixedRoles(playerCount, pattern) {
  const roles = ROLE_PATTERNS[Number(playerCount)]?.[pattern];
  return roles ? [...roles] : [];
}

export function getPatternSpecialNote(playerCount, pattern) {
  const count = Number(playerCount);
  if (count === 2 && pattern === "A") return "A、お互いに投票した場合両方処刑されます";
  if (count === 2 && pattern === "B") return "B、3人目の村人陣営の死体があります";
  return "";
}

export function getRoleDescription(role, playerCount, pattern) {
  const count = Number(playerCount);

  if (count === 2) {
    if (pattern === "B" && role === "人狼") return "夜行動なしの人狼";
    if (role === "大狼") return "墓地をランダム1枚確認できる人狼";
    if (role === "占い師") return "夜に墓地をランダム1枚見る";
    if (role === "吸血鬼") return "夜に相手または墓地1枚とランダムに交換する";
    if (role === "狩人") return "自分が吊られたら相手も吊る";
    if (role === "村長") return "投票が2票になる";
  }

  return ROLE_DESCRIPTIONS[role] || "";
}

export function buildCountSummary(roles) {
  const counts = {};
  const orderedUniqueRoles = [];

  roles.forEach((role) => {
    if (!counts[role]) {
      counts[role] = 0;
      orderedUniqueRoles.push(role);
    }
    counts[role] += 1;
  });

  return {
    counts,
    orderedUniqueRoles,
    text: orderedUniqueRoles.map((role) => `${role}×${counts[role]}`).join("、"),
  };
}

export function getDurationLabel(value) {
  const numberValue = Number(value);
  return numberValue === 0 ? "無限" : `${numberValue}秒`;
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function normalizeDuration(value, key, fallback) {
  const numberValue = Number(value);
  const availableValues = TIME_OPTIONS[key].map((item) => item.value);
  return availableValues.includes(numberValue) ? numberValue : fallback;
}

export function normalizeOnlineSettings(input = {}, fallback = DEFAULT_SETTINGS) {
  const playerCount = clampNumber(
    input.playerCount ?? fallback.playerCount,
    MIN_PLAYERS,
    MAX_PLAYERS,
    fallback.playerCount
  );

  const availablePatterns = getAvailablePatterns(playerCount);
  let pattern = String(input.pattern ?? fallback.pattern ?? "A");

  if (!availablePatterns.includes(pattern)) {
    pattern = availablePatterns[0] || "A";
  }

  return {
    playerCount,
    pattern,
    nightSeconds: normalizeDuration(input.nightSeconds ?? fallback.nightSeconds, "nightSeconds", fallback.nightSeconds),
    discussionSeconds: normalizeDuration(input.discussionSeconds ?? fallback.discussionSeconds, "discussionSeconds", fallback.discussionSeconds),
    voteSeconds: normalizeDuration(input.voteSeconds ?? fallback.voteSeconds, "voteSeconds", fallback.voteSeconds),
  };
}

export function shuffleArray(array, random = Math.random) {
  const copied = [...array];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function assignUniqueTargetsWithBacktracking(actorIndexes, count, random = Math.random) {
  if (actorIndexes.length === 0) return [];

  const assignments = [];
  const usedTargets = new Set();
  const actorOrder = shuffleArray(actorIndexes, random);

  function dfs(position) {
    if (position >= actorOrder.length) return true;

    const actorIndex = actorOrder[position];
    const candidates = shuffleArray(
      Array.from({ length: count }, (_, index) => index).filter(
        (index) => index !== actorIndex && !usedTargets.has(index)
      ),
      random
    );

    for (const targetIndex of candidates) {
      assignments.push({ actorIndex, targetIndex });
      usedTargets.add(targetIndex);

      if (dfs(position + 1)) return true;

      assignments.pop();
      usedTargets.delete(targetIndex);
    }

    return false;
  }

  if (!dfs(0)) return [];

  return actorIndexes
    .map((actorIndex) => assignments.find((item) => item.actorIndex === actorIndex))
    .filter(Boolean);
}

export function decideMobVisits(initialRoles, count, random = Math.random) {
  const actorIndexes = initialRoles
    .map((role, index) => ({ role, index }))
    .filter((item) => item.role === "モブおじさん")
    .map((item) => item.index);

  return assignUniqueTargetsWithBacktracking(actorIndexes, count, random);
}

export function decideBreadDelivery(initialRoles, count, random = Math.random) {
  const actorIndex = initialRoles.findIndex((role) => role === "パン屋");
  if (actorIndex === -1) return null;

  const targets = Array.from({ length: count }, (_, index) => index).filter((index) => index !== actorIndex);
  const targetIndex = targets[Math.floor(random() * targets.length)];

  return { actorIndex, targetIndex };
}

export function createInitialGameSetup(playerNames, settings, random = Math.random) {
  const normalizedSettings = normalizeOnlineSettings(settings, DEFAULT_SETTINGS);
  const { playerCount, pattern } = normalizedSettings;
  const roles = getSelectedFixedRoles(playerCount, pattern);

  if (roles.length === 0) throw new Error("配役が見つかりません");
  if (playerNames.length !== playerCount) throw new Error(`${playerCount}人ちょうどで開始できます`);

  let distributedRoles = [...roles];
  let deadPlayer = null;

  if (isTwoPlayerPatternB(playerCount, pattern)) {
    const deadCandidates = roles.filter((role) => !isWerewolfRole(role));
    const deadRole = deadCandidates[Math.floor(random() * deadCandidates.length)];
    const remaining = [...roles];
    remaining.splice(remaining.indexOf(deadRole), 1);

    distributedRoles = remaining;
    deadPlayer = {
      name: "死体",
      role: deadRole,
    };
  }

  const shuffled = shuffleArray(distributedRoles, random);
  const initialRoles = shuffled.slice(0, playerCount);
  const graveCards = shuffled.slice(playerCount);
  const mobVisits = decideMobVisits(initialRoles, playerCount, random);
  const breadDelivery = decideBreadDelivery(initialRoles, playerCount, random);

  return {
    phase: "night",
    count: playerCount,
    pattern,
    settings: normalizedSettings,
    activePlayerIds: [],
    allRoles: [...roles],
    initialRoles: [...initialRoles],
    currentRoles: [...initialRoles],
    roleHistories: initialRoles.map((role) => [role]),
    initialGraveCards: [...graveCards],
    currentGraveCards: [...graveCards],
    playerNames: playerNames.slice(0, playerCount),
    nightActions: Array(playerCount).fill(null),
    nightResults: Array(playerCount).fill(null),
    votes: Array(playerCount).fill(null),
    voteResults: Array(playerCount).fill(null),
    voteTotals: Array(playerCount).fill(0),
    eliminatedPlayers: [],
    isPeaceVillage: false,
    mobVisits,
    breadDelivery,
    deadPlayer,
    hunterIndex: null,
    hunterDeadlineAt: null,
    hunterExtraTarget: null,
    hunterResult: null,
    result: null,
    createdAt: Date.now(),
    nightStartedAt: Date.now(),
    nightDeadlineAt: null,
    discussionStartedAt: null,
    discussionDeadlineAt: null,
    voteStartedAt: null,
    voteDeadlineAt: null,
    resultCreatedAt: null,
  };
}

function formatPlayerName(game, index) {
  return game.playerNames[index] || `プレイヤー${index + 1}`;
}

function formatPlayerList(game, indexes) {
  if (!indexes || indexes.length === 0) return "なし";
  return indexes.map((index) => formatPlayerName(game, index)).join("、");
}

function formatVoteTarget(game, target) {
  if (target === "peace") return "平和村を願う";
  if (typeof target === "number" && game.playerNames[target]) return formatPlayerName(game, target);
  return "未投票";
}

function formatRoleHistory(history) {
  if (!history || history.length === 0) return "";
  return history.length <= 1 ? history[0] : history.join("→");
}

function formatGraveCard(game, index) {
  const initialRole = game.initialGraveCards[index];
  const currentRole = game.currentGraveCards[index];
  if (!initialRole) return "";
  return initialRole === currentRole ? initialRole : `${initialRole}→${currentRole}`;
}

function formatGraveSummary(game) {
  return game.initialGraveCards
    .map((_, index) => formatGraveCard(game, index))
    .filter(Boolean)
    .join("、");
}

function getPlayerTeam(role, hasWerewolfSide) {
  if (isWerewolfRole(role)) return "人狼";
  if (role === "狂人") return hasWerewolfSide ? "人狼" : "村";
  return "村";
}

function getInitialWerewolfPartners(game, playerIndex) {
  return game.initialRoles
    .map((role, index) => ({ role, index }))
    .filter((item) => isWerewolfRole(item.role) && item.index !== playerIndex);
}

function addRoleHistory(game, index, newRole) {
  const history = game.roleHistories[index];
  if (history[history.length - 1] !== newRole) {
    history.push(newRole);
  }
}

function swapPlayerRoles(game, indexA, indexB) {
  const roleA = game.currentRoles[indexA];
  const roleB = game.currentRoles[indexB];

  game.currentRoles[indexA] = roleB;
  game.currentRoles[indexB] = roleA;

  addRoleHistory(game, indexA, roleB);
  addRoleHistory(game, indexB, roleA);
}

function swapPlayerWithGrave(game, playerIndex, graveIndex) {
  const playerRole = game.currentRoles[playerIndex];
  const graveRole = game.currentGraveCards[graveIndex];

  game.currentRoles[playerIndex] = graveRole;
  game.currentGraveCards[graveIndex] = playerRole;

  addRoleHistory(game, playerIndex, graveRole);
}

function getOtherPlayerIndexes(game, playerIndex) {
  return Array.from({ length: game.count }, (_, index) => index).filter((index) => index !== playerIndex);
}

function pickRandomPlayerIndex(game, playerIndex, random = Math.random) {
  const candidates = getOtherPlayerIndexes(game, playerIndex);
  return candidates[Math.floor(random() * candidates.length)];
}

function pickRandomGraveIndex(game, random = Math.random) {
  return Math.floor(random() * game.currentGraveCards.length);
}

function getMobVisitForActor(game, actorIndex) {
  return game.mobVisits.find((item) => item.actorIndex === actorIndex) || null;
}

function getMobVisitForTarget(game, targetIndex) {
  return game.mobVisits.find((item) => item.targetIndex === targetIndex) || null;
}

function buildPlayerChoice(game, targetIndex, kind, suffix = "") {
  return {
    action: { kind, targetIndex },
    label: `${formatPlayerName(game, targetIndex)}${suffix}`,
  };
}

function buildBasePlayerView(game, playerIndex) {
  return {
    phase: game.phase,
    playerIndex,
    initialRole: game.initialRoles[playerIndex],
    nightResult: game.nightResults[playerIndex],
    voteResult: game.voteResults[playerIndex],
    voteTarget: game.votes[playerIndex],
    graveCount: game.initialGraveCards.length,
    hasDeadPlayer: Boolean(game.deadPlayer),
    nightDeadlineAt: game.nightDeadlineAt || null,
    discussionDeadlineAt: game.discussionDeadlineAt || null,
    voteDeadlineAt: game.voteDeadlineAt || null,
    hunterDeadlineAt: game.hunterDeadlineAt || null,
    result: game.result,
  };
}

export function getNightActionView(game, playerIndex) {
  if (!game || game.phase !== "night") {
    return { phase: game?.phase || "unknown", choices: [], notifications: [], preInfo: "", isNightComplete: true };
  }

  const role = game.initialRoles[playerIndex];
  const choices = [];
  const notifications = [];
  const completed = Boolean(game.nightResults[playerIndex]);

  if (game.breadDelivery && game.breadDelivery.targetIndex === playerIndex) {
    notifications.push("パンが届きました");
  }

  const mobVisit = getMobVisitForTarget(game, playerIndex);
  if (mobVisit) {
    notifications.push(`${formatPlayerName(game, mobVisit.actorIndex)}が訪問してきました`);
  }

  if (completed) {
    return {
      ...buildBasePlayerView(game, playerIndex),
      notifications,
      preInfo: "",
      choices: [],
      isNightComplete: true,
    };
  }

  let preInfo = "";

  if (role === "人狼") {
    if (isTwoPlayerPatternB(game.count, game.pattern)) {
      preInfo = "人狼は夜の行動がありません";
    } else {
      const partners = getInitialWerewolfPartners(game, playerIndex);
      preInfo = partners.length === 0
        ? "仲間はいません"
        : `仲間は ${partners.map((item) => formatPlayerName(game, item.index)).join("、")} です`;
    }
    choices.push({ action: { kind: "none" }, label: "確認" });
  } else if (role === "大狼") {
    const partners = getInitialWerewolfPartners(game, playerIndex);
    preInfo = partners.length === 0
      ? "仲間はいません"
      : `仲間は ${partners.map((item) => formatPlayerName(game, item.index)).join("、")} です`;
    choices.push({ action: { kind: "lookGrave" }, label: "墓地を見る" });
  } else if (role === "狂人") {
    preInfo = "狂人は夜の行動がありません";
    choices.push({ action: { kind: "none" }, label: "確認" });
  } else if (role === "占い師") {
    if (isTwoPlayerCount(game.count)) {
      choices.push({ action: { kind: "lookGrave" }, label: "墓地を見る" });
    } else {
      getOtherPlayerIndexes(game, playerIndex).forEach((targetIndex) => {
        choices.push(buildPlayerChoice(game, targetIndex, "lookPlayer"));
      });
      choices.push({ action: { kind: "lookGrave" }, label: "墓地を見る" });
    }
  } else if (role === "怪盗") {
    getOtherPlayerIndexes(game, playerIndex).forEach((targetIndex) => {
      choices.push(buildPlayerChoice(game, targetIndex, "swapPlayer", "と交換"));
    });
  } else if (role === "吸血鬼") {
    if (isTwoPlayerCount(game.count)) {
      choices.push({ action: { kind: "randomExchange" }, label: "交換する" });
    } else {
      getOtherPlayerIndexes(game, playerIndex).forEach((targetIndex) => {
        choices.push(buildPlayerChoice(game, targetIndex, "swapPlayer", "と交換"));
      });
      choices.push({ action: { kind: "swapGrave" }, label: "墓地と交換" });
    }
  } else if (role === "モブおじさん") {
    choices.push({ action: { kind: "visit" }, label: "誰かを訪問する" });
  } else if (role === "パン屋") {
    preInfo = "誰かにパンを届けました";
    choices.push({ action: { kind: "none" }, label: "確認" });
  } else if (role === "魔女っ子") {
    getOtherPlayerIndexes(game, playerIndex).forEach((targetIndex) => {
      choices.push(buildPlayerChoice(game, targetIndex, "lookPlayer"));
    });
  } else {
    preInfo = `${role}は夜の行動がありません`;
    choices.push({ action: { kind: "none" }, label: "確認" });
  }

  return {
    ...buildBasePlayerView(game, playerIndex),
    notifications,
    preInfo,
    choices,
    isNightComplete: false,
  };
}

export function getVoteActionView(game, playerIndex) {
  const completed = game.votes[playerIndex] !== null;
  const choices = [];

  if (!completed) {
    getOtherPlayerIndexes(game, playerIndex).forEach((targetIndex) => {
      choices.push({
        action: { kind: "vote", targetIndex },
        label: `${formatPlayerName(game, targetIndex)}に投票`,
      });
    });

    choices.push({
      action: { kind: "peace" },
      label: "平和村を願う",
    });
  }

  return {
    ...buildBasePlayerView(game, playerIndex),
    choices,
    isVoteComplete: completed,
  };
}

export function getHunterActionView(game, playerIndex) {
  const isHunter = playerIndex === game.hunterIndex;
  const completed = Boolean(game.hunterResult);
  const choices = [];

  if (isHunter && !completed) {
    const targets = Array.from({ length: game.count }, (_, index) => index)
      .filter((index) => !game.eliminatedPlayers.includes(index));

    targets.forEach((targetIndex) => {
      choices.push({
        action: { kind: "execute", targetIndex },
        label: `${formatPlayerName(game, targetIndex)}を追加で吊る`,
      });
    });

    choices.push({
      action: { kind: "none" },
      label: "誰も吊らない",
    });
  }

  return {
    ...buildBasePlayerView(game, playerIndex),
    choices,
    isHunter,
    isHunterExecutionComplete: completed,
    hunterIndex: game.hunterIndex,
    hunterName: game.hunterIndex === null ? "" : formatPlayerName(game, game.hunterIndex),
    hunterResult: game.hunterResult,
  };
}

export function getPlayerGameView(game, playerIndex) {
  if (!game) return null;

  if (playerIndex < 0 || playerIndex >= game.count) {
    return {
      phase: "waiting",
      message: "このゲームでは待機枠です。次のゲームまで待機してください。",
      result: game.phase === "result" ? game.result : null,
    };
  }

  if (game.phase === "night") return getNightActionView(game, playerIndex);
  if (game.phase === "vote") return getVoteActionView(game, playerIndex);
  if (game.phase === "hunterExecution") return getHunterActionView(game, playerIndex);

  return {
    ...buildBasePlayerView(game, playerIndex),
    choices: [],
    isNightComplete: game.nightResults[playerIndex] !== null,
    isVoteComplete: game.votes[playerIndex] !== null,
  };
}

export function createAutoNightAction(game, playerIndex, random = Math.random) {
  const role = game.initialRoles[playerIndex];

  if (role === "占い師") {
    if (isTwoPlayerCount(game.count)) return { kind: "lookGrave" };

    const choices = [
      ...getOtherPlayerIndexes(game, playerIndex).map((targetIndex) => ({ kind: "lookPlayer", targetIndex })),
      { kind: "lookGrave" },
    ];

    return choices[Math.floor(random() * choices.length)];
  }

  if (role === "怪盗") {
    return { kind: "swapPlayer", targetIndex: pickRandomPlayerIndex(game, playerIndex, random) };
  }

  if (role === "吸血鬼") {
    if (isTwoPlayerCount(game.count)) return { kind: "randomExchange" };

    const choices = [
      ...getOtherPlayerIndexes(game, playerIndex).map((targetIndex) => ({ kind: "swapPlayer", targetIndex })),
      { kind: "swapGrave" },
    ];

    return choices[Math.floor(random() * choices.length)];
  }

  if (role === "魔女っ子") return { kind: "lookPlayer", targetIndex: pickRandomPlayerIndex(game, playerIndex, random) };
  if (role === "大狼") return { kind: "lookGrave" };
  if (role === "モブおじさん") return { kind: "visit" };

  return { kind: "none" };
}

export function resolveNightAction(game, playerIndex, actionInput = {}, random = Math.random) {
  if (!game || game.phase !== "night") throw new Error("夜フェーズではありません");
  if (game.nightResults[playerIndex]) return game.nightResults[playerIndex];

  const role = game.initialRoles[playerIndex];
  const action = actionInput && typeof actionInput === "object" ? actionInput : {};
  let text = "";

  if (role === "人狼") {
    if (isTwoPlayerPatternB(game.count, game.pattern)) {
      text = "人狼は夜の行動がありません";
    } else {
      const partners = getInitialWerewolfPartners(game, playerIndex);
      text = partners.length === 0
        ? "仲間はいません"
        : `仲間は ${partners.map((item) => formatPlayerName(game, item.index)).join("、")} です`;
    }
  } else if (role === "大狼") {
    if (isTwoPlayerCount(game.count)) {
      const graveIndex = pickRandomGraveIndex(game, random);
      text = `墓地の1枚は ${game.initialGraveCards[graveIndex]} です`;
    } else {
      text = `墓地は ${game.initialGraveCards.join("、")} です`;
    }
  } else if (role === "狂人") {
    text = "狂人は夜の行動がありません";
  } else if (role === "占い師") {
    if (isTwoPlayerCount(game.count) || action.kind === "lookGrave") {
      if (isTwoPlayerCount(game.count)) {
        const graveIndex = pickRandomGraveIndex(game, random);
        text = `墓地の1枚は ${game.initialGraveCards[graveIndex]} です`;
      } else {
        text = `墓地は ${game.initialGraveCards.join("、")} です`;
      }
    } else {
      const targetIndex = Number(action.targetIndex);
      const safeTargetIndex = targetIndex !== playerIndex && game.initialRoles[targetIndex] !== undefined
        ? targetIndex
        : pickRandomPlayerIndex(game, playerIndex, random);
      text = `${formatPlayerName(game, safeTargetIndex)}の役職は ${game.initialRoles[safeTargetIndex]} です`;
    }
  } else if (role === "怪盗") {
    const targetIndex = Number(action.targetIndex);
    const safeTargetIndex = targetIndex !== playerIndex && game.currentRoles[targetIndex] !== undefined
      ? targetIndex
      : pickRandomPlayerIndex(game, playerIndex, random);

    swapPlayerRoles(game, playerIndex, safeTargetIndex);
    text = `${formatPlayerName(game, safeTargetIndex)}と交換しました。あなたの新しい役職は ${game.currentRoles[playerIndex]} です`;
  } else if (role === "吸血鬼") {
    if (isTwoPlayerCount(game.count)) {
      const otherPlayerIndex = getOtherPlayerIndexes(game, playerIndex)[0];
      const choices = [
        { type: "player", index: otherPlayerIndex, label: formatPlayerName(game, otherPlayerIndex) },
        { type: "grave", index: 0, label: "墓地" },
        { type: "grave", index: 1, label: "墓地" },
      ];
      const choice = choices[Math.floor(random() * choices.length)];

      if (choice.type === "player") {
        swapPlayerRoles(game, playerIndex, choice.index);
      } else {
        swapPlayerWithGrave(game, playerIndex, choice.index);
      }

      text = `${choice.label}と交換して、新しい役職は ${game.currentRoles[playerIndex]} です`;
    } else if (action.kind === "swapGrave") {
      const graveIndex = pickRandomGraveIndex(game, random);
      swapPlayerWithGrave(game, playerIndex, graveIndex);
      text = `墓地${graveIndex + 1}と交換しました。あなたの新しい役職は ${game.currentRoles[playerIndex]} です`;
    } else {
      const targetIndex = Number(action.targetIndex);
      const safeTargetIndex = targetIndex !== playerIndex && game.currentRoles[targetIndex] !== undefined
        ? targetIndex
        : pickRandomPlayerIndex(game, playerIndex, random);

      swapPlayerRoles(game, playerIndex, safeTargetIndex);
      text = `${formatPlayerName(game, safeTargetIndex)}と交換しました。あなたの新しい役職は ${game.currentRoles[playerIndex]} です`;
    }
  } else if (role === "モブおじさん") {
    const visit = getMobVisitForActor(game, playerIndex);
    text = visit ? `${formatPlayerName(game, visit.targetIndex)}を訪問し熱い夜を過ごしました` : "訪問相手がいません";
  } else if (role === "パン屋") {
    text = "誰かにパンを届けました";
  } else if (role === "魔女っ子") {
    const targetIndex = Number(action.targetIndex);
    const safeTargetIndex = targetIndex !== playerIndex && game.initialRoles[targetIndex] !== undefined
      ? targetIndex
      : pickRandomPlayerIndex(game, playerIndex, random);
    text = `${formatPlayerName(game, safeTargetIndex)}の役職は ${game.initialRoles[safeTargetIndex]} です`;
  } else {
    text = `${role}は夜の行動がありません`;
  }

  const result = { text, action, completedAt: Date.now() };
  game.nightActions[playerIndex] = action;
  game.nightResults[playerIndex] = result;

  return result;
}

export function isNightComplete(game) {
  return Boolean(game?.nightResults?.every((result) => result !== null));
}

export function moveGameToDiscussion(game, nowValue = Date.now()) {
  game.phase = "discussion";
  game.discussionStartedAt = nowValue;
  game.discussionDeadlineAt = game.settings.discussionSeconds > 0
    ? nowValue + game.settings.discussionSeconds * 1000
    : null;
}

export function moveGameToVote(game, nowValue = Date.now()) {
  game.phase = "vote";
  game.voteStartedAt = nowValue;
  game.voteDeadlineAt = game.settings.voteSeconds > 0
    ? nowValue + game.settings.voteSeconds * 1000
    : null;
}

export function createAutoVoteAction() {
  return { kind: "peace" };
}

export function resolveVoteAction(game, playerIndex, actionInput = {}) {
  if (!game || game.phase !== "vote") throw new Error("投票フェーズではありません");
  if (game.votes[playerIndex] !== null) return game.voteResults[playerIndex];

  const action = actionInput && typeof actionInput === "object" ? actionInput : {};
  let target = "peace";

  if (action.kind === "vote") {
    const targetIndex = Number(action.targetIndex);
    if (
      Number.isInteger(targetIndex)
      && targetIndex >= 0
      && targetIndex < game.count
      && targetIndex !== playerIndex
    ) {
      target = targetIndex;
    }
  }

  if (action.kind === "peace") {
    target = "peace";
  }

  const result = {
    target,
    text: `投票先: ${formatVoteTarget(game, target)}`,
    completedAt: Date.now(),
  };

  game.votes[playerIndex] = target;
  game.voteResults[playerIndex] = result;

  return result;
}

export function isVoteComplete(game) {
  return Boolean(game?.votes?.every((vote) => vote !== null));
}

export function computeVoteTotals(votes, currentRoles) {
  const voteTotals = Array(currentRoles.length).fill(0);

  votes.forEach((target, voterIndex) => {
    const weight = currentRoles[voterIndex] === "村長" ? 2 : 1;
    if (target !== "peace" && target !== null && target !== undefined) {
      voteTotals[target] += weight;
    }
  });

  return voteTotals;
}

export function computeIsPeaceVillage(votes, currentRoles, playerCount, pattern) {
  const voteTotals = computeVoteTotals(votes, currentRoles);
  const allPeace = votes.every((target) => target === "peace");
  const everyoneOneVote = voteTotals.every((total) => total === 1);

  if (isTwoPlayerPatternB(playerCount, pattern)) return allPeace || everyoneOneVote;
  if (isTwoPlayerCount(playerCount)) return allPeace;

  return allPeace || everyoneOneVote;
}

function decideEliminatedPlayers(game) {
  const voteTotals = computeVoteTotals(game.votes, game.currentRoles);
  const isPeaceVillage = computeIsPeaceVillage(game.votes, game.currentRoles, game.count, game.pattern);

  game.voteTotals = voteTotals;
  game.isPeaceVillage = isPeaceVillage;

  if (isPeaceVillage) {
    game.eliminatedPlayers = [];
    return;
  }

  const maxVote = Math.max(...voteTotals);

  game.eliminatedPlayers = voteTotals
    .map((total, index) => ({ total, index }))
    .filter((item) => item.total === maxVote && item.total > 0)
    .map((item) => item.index);
}

function buildGameResult(game, nowValue = Date.now()) {
  const hasWerewolfSide = game.currentRoles.some((role) => isWerewolfRole(role));
  const hasExecutedWerewolf = game.eliminatedPlayers.some((index) => isWerewolfRole(game.currentRoles[index]));

  let headline = "";
  let winnerIndexes = [];
  let resultType = "";

  if (!hasWerewolfSide) {
    if (game.eliminatedPlayers.length === 0) {
      headline = "平和村で全員勝利";
      resultType = "village";
      winnerIndexes = game.playerNames.map((_, index) => index);
    } else {
      headline = "平和崩れで全員負け";
      resultType = "werewolf";
      winnerIndexes = [];
    }
  } else if (hasExecutedWerewolf) {
    winnerIndexes = game.currentRoles
      .map((role, index) => ({ role, index }))
      .filter((item) => getPlayerTeam(item.role, hasWerewolfSide) === "村")
      .map((item) => item.index);
    headline = "村陣営勝利";
    resultType = "village";
  } else {
    winnerIndexes = game.currentRoles
      .map((role, index) => ({ role, index }))
      .filter((item) => getPlayerTeam(item.role, hasWerewolfSide) === "人狼")
      .map((item) => item.index);
    headline = "人狼陣営勝利";
    resultType = "werewolf";
  }

  const playerRows = game.playerNames.map((name, index) => ({
    name,
    roleHistory: formatRoleHistory(game.roleHistories[index]),
    initialRole: game.initialRoles[index],
    finalRole: game.currentRoles[index],
    voteTarget: formatVoteTarget(game, game.votes[index]),
    isEliminated: game.eliminatedPlayers.includes(index),
    isWinner: winnerIndexes.includes(index),
  }));

  if (game.deadPlayer) {
    playerRows.push({
      name: game.deadPlayer.name,
      roleHistory: game.deadPlayer.role,
      initialRole: game.deadPlayer.role,
      finalRole: game.deadPlayer.role,
      voteTarget: "投票なし",
      isEliminated: false,
      isWinner: false,
    });
  }

  const metaLines = [
    `処刑プレイヤー: ${formatPlayerList(game, game.eliminatedPlayers)}`,
    `墓地: ${formatGraveSummary(game)}`,
  ];

  if (game.deadPlayer) metaLines.push(`死体の役職: ${game.deadPlayer.role}`);

  game.mobVisits.forEach((visit) => {
    metaLines.push(`${formatPlayerName(game, visit.actorIndex)}が${formatPlayerName(game, visit.targetIndex)}を訪問`);
  });

  if (game.breadDelivery) {
    metaLines.push(`${formatPlayerName(game, game.breadDelivery.actorIndex)}が${formatPlayerName(game, game.breadDelivery.targetIndex)}にパンを配達`);
  }

  if (game.hunterResult) metaLines.push(game.hunterResult.text);

  return {
    headline,
    resultType,
    winnerIndexes,
    winnerNames: winnerIndexes.map((index) => formatPlayerName(game, index)),
    eliminatedPlayers: [...game.eliminatedPlayers],
    eliminatedNames: game.eliminatedPlayers.map((index) => formatPlayerName(game, index)),
    isPeaceVillage: game.isPeaceVillage,
    voteTotals: [...game.voteTotals],
    graveSummary: formatGraveSummary(game),
    deadPlayer: game.deadPlayer,
    playerRows,
    metaLines,
    createdAt: nowValue,
  };
}

export function finalizeGame(game, nowValue = Date.now()) {
  game.phase = "result";
  game.resultCreatedAt = nowValue;
  game.result = buildGameResult(game, nowValue);
}

export function completeVotesAndAdvance(game, nowValue = Date.now()) {
  if (!game || game.phase !== "vote") throw new Error("投票フェーズではありません");

  decideEliminatedPlayers(game);

  const hunterIndex = game.eliminatedPlayers.find((index) => game.currentRoles[index] === "狩人");

  if (hunterIndex !== undefined) {
    if (isTwoPlayerCount(game.count)) {
      const remainingTargets = Array.from({ length: game.count }, (_, index) => index)
        .filter((index) => !game.eliminatedPlayers.includes(index));

      if (remainingTargets.length > 0) {
        const targetIndex = remainingTargets[0];
        game.eliminatedPlayers.push(targetIndex);
        game.eliminatedPlayers = [...new Set(game.eliminatedPlayers)];
        game.hunterIndex = hunterIndex;
        game.hunterExtraTarget = targetIndex;
        game.hunterResult = {
          targetIndex,
          text: `${formatPlayerName(game, hunterIndex)}は狩人でした。狩人の効果で${formatPlayerName(game, targetIndex)}も追加で吊られました`,
          completedAt: nowValue,
          auto: true,
        };
      }

      finalizeGame(game, nowValue);
      return;
    }

    game.phase = "hunterExecution";
    game.hunterIndex = hunterIndex;
    game.hunterDeadlineAt = nowValue + ONLINE_HUNTER_RULE.timeoutSeconds * 1000;
    game.hunterExtraTarget = null;
    game.hunterResult = null;
    return;
  }

  finalizeGame(game, nowValue);
}

export function resolveHunterAction(game, playerIndex, actionInput = {}, nowValue = Date.now()) {
  if (!game || game.phase !== "hunterExecution") throw new Error("狩人追加処刑フェーズではありません");
  if (playerIndex !== game.hunterIndex) throw new Error("狩人のみ追加処刑できます");

  if (game.hunterResult) return game.hunterResult;

  const action = actionInput && typeof actionInput === "object" ? actionInput : {};
  let targetIndex = null;

  if (action.kind === "execute") {
    const requestedTargetIndex = Number(action.targetIndex);
    if (
      Number.isInteger(requestedTargetIndex)
      && requestedTargetIndex >= 0
      && requestedTargetIndex < game.count
      && !game.eliminatedPlayers.includes(requestedTargetIndex)
    ) {
      targetIndex = requestedTargetIndex;
    }
  }

  if (targetIndex !== null) {
    game.eliminatedPlayers.push(targetIndex);
    game.eliminatedPlayers = [...new Set(game.eliminatedPlayers)];
    game.hunterExtraTarget = targetIndex;
    game.hunterResult = {
      targetIndex,
      text: `狩人の効果で${formatPlayerName(game, targetIndex)}が追加で吊られました`,
      completedAt: nowValue,
      auto: false,
    };
  } else {
    game.hunterExtraTarget = null;
    game.hunterResult = {
      targetIndex: null,
      text: "狩人は誰も追加で吊りませんでした",
      completedAt: nowValue,
      auto: false,
    };
  }

  finalizeGame(game, nowValue);
  return game.hunterResult;
}

export function resolveHunterTimeout(game, nowValue = Date.now()) {
  if (!game || game.phase !== "hunterExecution") return;
  if (game.hunterResult) return;

  game.hunterExtraTarget = null;
  game.hunterResult = {
    targetIndex: null,
    text: "狩人は時間切れのため、誰も追加で吊りませんでした",
    completedAt: nowValue,
    auto: true,
  };

  finalizeGame(game, nowValue);
}