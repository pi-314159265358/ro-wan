export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export const LIMITED_MANUAL_ROLES = new Set(["狩人", "村長", "パン屋"]);

export const MANUAL_ROLE_ORDER = [
  "人狼",
  "大狼",
  "狂人",
  "占い師",
  "怪盗",
  "吸血鬼",
  "狩人",
  "村長",
  "モブおじさん",
  "パン屋",
  "魔女っ子",
  "村人",
];

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
  timeoutSeconds: 60,
  timeoutAction: "none",
  description: "オンライン版のみ、狩人の追加処刑は60秒。未送信時は追加処刑なし。",
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

export function getRequiredRoleTotal(playerCount) {
  return Number(playerCount) + 2;
}

export function getManualRoleMax(role) {
  return LIMITED_MANUAL_ROLES.has(role) ? 1 : Infinity;
}

export function getAvailablePatterns(playerCount, options = {}) {
  const { includeManual = false } = options;
  const count = Number(playerCount);
  const fixedPatterns = Object.keys(ROLE_PATTERNS[count] || {});

  if (count === 2) {
    return fixedPatterns;
  }

  return includeManual ? [...fixedPatterns, "X"] : fixedPatterns;
}

export function getSelectedFixedRoles(playerCount, pattern) {
  const count = Number(playerCount);

  if (pattern === "X") {
    return null;
  }

  const roles = ROLE_PATTERNS[count]?.[pattern];

  if (!roles) {
    return [];
  }

  return [...roles];
}

export function getPatternSpecialNote(playerCount, pattern) {
  const count = Number(playerCount);

  if (count === 2 && pattern === "A") {
    return "A、お互いに投票した場合両方処刑されます";
  }

  if (count === 2 && pattern === "B") {
    return "B、3人目の村人陣営の死体があります";
  }

  return "";
}

export function getRoleDescription(role, playerCount, pattern) {
  const count = Number(playerCount);

  if (count === 2) {
    if (pattern === "B" && role === "人狼") {
      return "夜行動なしの人狼";
    }

    if (role === "大狼") {
      return "墓地をランダム1枚確認できる人狼";
    }

    if (role === "占い師") {
      return "夜に墓地をランダム1枚見る";
    }

    if (role === "吸血鬼") {
      return "夜に相手または墓地1枚とランダムに交換する";
    }

    if (role === "狩人") {
      return "自分が吊られたら相手も吊る";
    }

    if (role === "村長") {
      return "投票が2票になる";
    }
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

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function normalizeDuration(value, key, fallback) {
  const numberValue = Number(value);
  const availableValues = TIME_OPTIONS[key].map((item) => item.value);

  if (availableValues.includes(numberValue)) {
    return numberValue;
  }

  return fallback;
}

export function normalizeOnlineSettings(input = {}, fallback = DEFAULT_SETTINGS, options = {}) {
  const { includeManual = false } = options;

  const playerCount = clampNumber(
    input.playerCount ?? fallback.playerCount,
    MIN_PLAYERS,
    MAX_PLAYERS,
    fallback.playerCount
  );

  const availablePatterns = getAvailablePatterns(playerCount, { includeManual });
  let pattern = String(input.pattern ?? fallback.pattern ?? "A");

  if (!availablePatterns.includes(pattern)) {
    pattern = availablePatterns[0] || "A";
  }

  return {
    playerCount,
    pattern,
    nightSeconds: normalizeDuration(
      input.nightSeconds ?? fallback.nightSeconds,
      "nightSeconds",
      fallback.nightSeconds
    ),
    discussionSeconds: normalizeDuration(
      input.discussionSeconds ?? fallback.discussionSeconds,
      "discussionSeconds",
      fallback.discussionSeconds
    ),
    voteSeconds: normalizeDuration(
      input.voteSeconds ?? fallback.voteSeconds,
      "voteSeconds",
      fallback.voteSeconds
    ),
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
  if (actorIndexes.length === 0) {
    return [];
  }

  const assignments = [];
  const usedTargets = new Set();
  const actorOrder = shuffleArray(actorIndexes, random);

  function dfs(position) {
    if (position >= actorOrder.length) {
      return true;
    }

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

      if (dfs(position + 1)) {
        return true;
      }

      assignments.pop();
      usedTargets.delete(targetIndex);
    }

    return false;
  }

  if (!dfs(0)) {
    return [];
  }

  return actorIndexes.map((actorIndex) => {
    return assignments.find((item) => item.actorIndex === actorIndex);
  }).filter(Boolean);
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

  if (actorIndex === -1) {
    return null;
  }

  const targets = Array.from({ length: count }, (_, index) => index)
    .filter((index) => index !== actorIndex);

  const targetIndex = targets[Math.floor(random() * targets.length)];

  return { actorIndex, targetIndex };
}

export function createInitialGameSetup(playerNames, settings, random = Math.random) {
  const normalizedSettings = normalizeOnlineSettings(settings, DEFAULT_SETTINGS, {
    includeManual: false,
  });

  const { playerCount, pattern } = normalizedSettings;
  const roles = getSelectedFixedRoles(playerCount, pattern);

  if (!roles) {
    throw new Error("X配役はまだオンライン版の開始処理に未対応です");
  }

  if (roles.length === 0) {
    throw new Error("配役が見つかりません");
  }

  if (playerNames.length !== playerCount) {
    throw new Error(`${playerCount}人ちょうどで開始できます`);
  }

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
    allRoles: [...roles],
    initialRoles: [...initialRoles],
    currentRoles: [...initialRoles],
    roleHistories: initialRoles.map((role) => [role]),
    initialGraveCards: [...graveCards],
    currentGraveCards: [...graveCards],
    playerNames: playerNames.slice(0, playerCount),
    nightQueue: initialRoles.map((role, index) => ({
      playerIndex: index,
      initialRole: role,
    })),
    nightActions: Array(playerCount).fill(null),
    nightResults: Array(playerCount).fill(null),
    votes: Array(playerCount).fill(null),
    eliminatedPlayers: [],
    isPeaceVillage: false,
    mobVisits,
    breadDelivery,
    deadPlayer,
    createdAt: Date.now(),
  };
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

  if (isTwoPlayerPatternB(playerCount, pattern)) {
    return allPeace || everyoneOneVote;
  }

  if (isTwoPlayerCount(playerCount)) {
    return allPeace;
  }

  return allPeace || everyoneOneVote;
}