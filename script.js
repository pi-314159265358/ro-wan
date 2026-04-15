const roleSets = {
  3: ["人狼", "狂人", "占い師", "怪盗", "狩人"],
  4: ["人狼", "狂人", "占い師", "怪盗", "狩人", "村長"],
  5: ["人狼", "人狼", "狂人", "占い師", "怪盗", "狩人", "村長"],
  6: ["人狼", "人狼", "狂人", "占い師", "怪盗", "狩人", "村人", "村人"],
  7: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "狩人", "村人", "村人"],
  8: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "狩人", "村長", "村人", "村人"],
};

const roleDescriptions = {
  "人狼": "人狼:人狼が吊られなければ勝利",
  "狂人": "狂人:人狼陣営。人狼がいない場合は村陣営",
  "占い師": "占い師:夜に誰か1人か墓地2枚を見る",
  "怪盗": "怪盗:夜に誰か1人と役職を交換する",
  "狩人": "狩人:吊られたら追加で1人吊れる",
  "村長": "村長:投票が2票になる",
  "村人": "村人:夜の行動なし",
};

const playerCount = document.getElementById("playerCount");
const setupBtn = document.getElementById("setupBtn");
const roleList = document.getElementById("roleList");

const nameInputGuide = document.getElementById("nameInputGuide");
const nameInputs = document.getElementById("nameInputs");

const nightStatus = document.getElementById("nightStatus");
const nightActionArea = document.getElementById("nightActionArea");
const nightButtons = document.getElementById("nightButtons");
const nightResult = document.getElementById("nightResult");
const nightConfirmBtn = document.getElementById("nightConfirmBtn");

const voteStatus = document.getElementById("voteStatus");
const startVoteBtn = document.getElementById("startVoteBtn");
const voteActionArea = document.getElementById("voteActionArea");
const voteButtons = document.getElementById("voteButtons");
const voteResult = document.getElementById("voteResult");
const voteNextBtn = document.getElementById("voteNextBtn");

const finalResult = document.getElementById("finalResult");
const progressText = document.getElementById("progressText");

let gameState = {
  count: 0,
  allRoles: [],
  initialRoles: [],
  graveCards: [],
  currentRoles: [],
  playerNames: [],
  phase: "setup",
  nightQueue: [],
  nightIndex: 0,
  votes: [],
  voteIndex: 0,
  eliminatedPlayers: [],
  isPeaceVillage: false,
};

function shuffleArray(array) {
  const copied = [...array];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function createChoiceButton(label, onClick) {
  const button = document.createElement("button");
  button.className = "choice-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function clearNightUI() {
  nightButtons.innerHTML = "";
  nightResult.textContent = "";
  nightConfirmBtn.classList.add("hidden");
  nightActionArea.classList.add("hidden");
}

function clearVoteUI() {
  voteButtons.innerHTML = "";
  voteResult.textContent = "";
  voteNextBtn.classList.add("hidden");
  voteActionArea.classList.add("hidden");
}

function appendNightMessage(message) {
  if (nightResult.textContent.trim() === "") {
    nightResult.textContent = message;
    return;
  }

  nightResult.textContent += `\n${message}`;
}

function appendVoteMessage(message) {
  if (voteResult.textContent.trim() === "") {
    voteResult.textContent = message;
    return;
  }

  voteResult.textContent += `\n${message}`;
}

function formatPlayerList(playerIndexes) {
  if (playerIndexes.length === 0) {
    return "なし";
  }

  return playerIndexes.map((index) => getPlayerName(index)).join("、");
}

function formatVoteTarget(target) {
  if (target === "peace") {
    return "平和村を願う";
  }

  return getPlayerName(target);
}

function getPlayerTeam(role, hasWerewolf) {
  if (role === "人狼") {
    return "人狼";
  }

  if (role === "狂人") {
    return hasWerewolf ? "人狼" : "村";
  }

  return "村";
}

function buildRoleListText(roles) {
  const counts = {};
  const orderedUniqueRoles = [];

  roles.forEach((role) => {
    if (!counts[role]) {
      counts[role] = 0;
      orderedUniqueRoles.push(role);
    }
    counts[role] += 1;
  });

  const countLine = orderedUniqueRoles
    .map((role) => `${role}×${counts[role]}`)
    .join("、");

  const descriptionLines = orderedUniqueRoles
    .map((role) => roleDescriptions[role]);

  return [countLine, "", ...descriptionLines].join("\n");
}

function getDefaultPlayerName(index) {
  return `プレイヤー${index + 1}`;
}

function getPlayerName(index) {
  return gameState.playerNames[index] || getDefaultPlayerName(index);
}

function renderNameInputs(count) {
  nameInputs.innerHTML = "";

  for (let i = 0; i < count; i += 1) {
    const row = document.createElement("div");
    row.className = "name-input-row";

    const label = document.createElement("label");
    label.setAttribute("for", `playerName${i}`);
    label.textContent = `プレイヤー${i + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `playerName${i}`;
    input.maxLength = 8;
    input.placeholder = `未入力なら ${getDefaultPlayerName(i)}`;

    row.appendChild(label);
    row.appendChild(input);
    nameInputs.appendChild(row);
  }

  nameInputGuide.textContent = "名前を入力してください。未入力は自動でプレイヤー名になります。重複した場合は 2、3 を付けて区別します";
}

function normalizePlayerNames(count) {
  const rawNames = [];

  for (let i = 0; i < count; i += 1) {
    const input = document.getElementById(`playerName${i}`);
    const value = input ? input.value.trim() : "";
    rawNames.push(value === "" ? getDefaultPlayerName(i) : value);
  }

  const usedCounts = {};
  const normalized = [];

  rawNames.forEach((name) => {
    if (!usedCounts[name]) {
      usedCounts[name] = 1;
      normalized.push(name);
    } else {
      usedCounts[name] += 1;
      normalized.push(`${name}${usedCounts[name]}`);
    }
  });

  return normalized;
}

function buildNightQueue() {
  return gameState.initialRoles.map((role, index) => ({
    playerIndex: index,
    initialRole: role,
  }));
}

function startNightPhase() {
  gameState.phase = "night";
  gameState.nightQueue = buildNightQueue();
  gameState.nightIndex = 0;
  progressText.textContent = "夜フェーズ";
  showNightWaitingScreen();
}

function finishNightAction(message) {
  nightButtons.innerHTML = "";
  appendNightMessage(message);
  nightConfirmBtn.classList.remove("hidden");
  nightActionArea.classList.remove("hidden");
}

function showNightWaitingScreen() {
  clearNightUI();

  if (gameState.nightIndex >= gameState.nightQueue.length) {
    gameState.phase = "discussion";
    nightStatus.textContent = "夜が明けました。議論を開始してください";
    voteStatus.textContent = "議論が終わったら投票フェーズを開始してください";
    startVoteBtn.classList.remove("hidden");
    progressText.textContent = "議論フェーズ";
    return;
  }

  const action = gameState.nightQueue[gameState.nightIndex];
  const playerName = getPlayerName(action.playerIndex);

  nightStatus.textContent = `${playerName}が画面を確認してください`;
  progressText.textContent = `夜行動 ${gameState.nightIndex + 1} / ${gameState.nightQueue.length}`;
  nightActionArea.classList.remove("hidden");

  const startButton = createChoiceButton("夜行動を開始", () => {
    runNightAction();
  });

  nightButtons.appendChild(startButton);
}

function runNightAction() {
  nightButtons.innerHTML = "";
  nightResult.textContent = "";
  nightConfirmBtn.classList.add("hidden");
  nightActionArea.classList.remove("hidden");

  const action = gameState.nightQueue[gameState.nightIndex];
  const playerName = getPlayerName(action.playerIndex);
  const role = action.initialRole;

  nightStatus.textContent = `${playerName}の夜行動です`;
  progressText.textContent = `夜行動 ${gameState.nightIndex + 1} / ${gameState.nightQueue.length}`;
  appendNightMessage(`あなたの初期役職は ${role} です`);

  if (role === "人狼") {
    handleWerewolfAction(action.playerIndex);
    return;
  }

  if (role === "狂人") {
    finishNightAction("狂人は夜の行動がありません");
    return;
  }

  if (role === "占い師") {
    handleSeerAction(action.playerIndex);
    return;
  }

  if (role === "怪盗") {
    handleRobberAction(action.playerIndex);
    return;
  }

  if (role === "狩人" || role === "村長" || role === "村人") {
    finishNightAction(`${role}は夜の行動がありません`);
  }
}

function handleWerewolfAction(playerIndex) {
  const otherWerewolves = gameState.initialRoles
    .map((role, index) => ({ role, index }))
    .filter((item) => item.role === "人狼" && item.index !== playerIndex);

  if (otherWerewolves.length === 0) {
    finishNightAction("他の人狼はいません");
    return;
  }

  const names = otherWerewolves
    .map((item) => getPlayerName(item.index))
    .join("、");

  finishNightAction(`仲間の人狼は ${names} です`);
}

function handleSeerAction(playerIndex) {
  const lookPlayerButton = createChoiceButton("プレイヤー1人を見る", () => {
    showSeerPlayerChoices(playerIndex);
  });

  const lookGraveButton = createChoiceButton("墓地2枚を見る", () => {
    finishNightAction(`墓地は ${gameState.graveCards.join("、")} です`);
  });

  nightButtons.appendChild(lookPlayerButton);
  nightButtons.appendChild(lookGraveButton);
}

function showSeerPlayerChoices(playerIndex) {
  nightButtons.innerHTML = "";

  for (let i = 0; i < gameState.count; i += 1) {
    if (i === playerIndex) {
      continue;
    }

    const button = createChoiceButton(`${getPlayerName(i)}`, () => {
      finishNightAction(`${getPlayerName(i)}の役職は ${gameState.initialRoles[i]} です`);
    });

    nightButtons.appendChild(button);
  }
}

function handleRobberAction(playerIndex) {
  for (let i = 0; i < gameState.count; i += 1) {
    if (i === playerIndex) {
      continue;
    }

    const button = createChoiceButton(`${getPlayerName(i)}と交換`, () => {
      const myRoleBefore = gameState.currentRoles[playerIndex];
      const targetRoleBefore = gameState.currentRoles[i];

      gameState.currentRoles[playerIndex] = targetRoleBefore;
      gameState.currentRoles[i] = myRoleBefore;

      finishNightAction(`${getPlayerName(i)}と交換しました。あなたの新しい役職は ${gameState.currentRoles[playerIndex]} です`);
    });

    nightButtons.appendChild(button);
  }
}

function startVotePhase() {
  gameState.phase = "vote";
  gameState.voteIndex = 0;
  gameState.votes = Array(gameState.count).fill(null);
  gameState.eliminatedPlayers = [];
  gameState.isPeaceVillage = false;
  startVoteBtn.classList.add("hidden");
  finalResult.textContent = "集計中です";
  showVoteWaitingScreen();
}

function showVoteWaitingScreen() {
  clearVoteUI();

  if (gameState.voteIndex >= gameState.count) {
    finalizeVotes();
    return;
  }

  const playerName = getPlayerName(gameState.voteIndex);
  voteStatus.textContent = `${playerName}が画面を確認してください`;
  progressText.textContent = `投票 ${gameState.voteIndex + 1} / ${gameState.count}`;
  voteActionArea.classList.remove("hidden");

  const startButton = createChoiceButton("投票を開始", () => {
    runVoteAction();
  });

  voteButtons.appendChild(startButton);
}

function runVoteAction() {
  voteButtons.innerHTML = "";
  voteResult.textContent = "";
  voteNextBtn.classList.add("hidden");
  voteActionArea.classList.remove("hidden");

  const voterIndex = gameState.voteIndex;
  const playerName = getPlayerName(voterIndex);

  voteStatus.textContent = `${playerName}の投票です`;
  progressText.textContent = `投票 ${voterIndex + 1} / ${gameState.count}`;

  for (let i = 0; i < gameState.count; i += 1) {
    if (i === voterIndex) {
      continue;
    }

    const button = createChoiceButton(`${getPlayerName(i)}に投票`, () => {
      recordVote(i);
    });

    voteButtons.appendChild(button);
  }

  const peaceButton = createChoiceButton("平和村を願う", () => {
    recordVote("peace");
  });

  voteButtons.appendChild(peaceButton);
}

function recordVote(target) {
  const voterIndex = gameState.voteIndex;
  gameState.votes[voterIndex] = target;
  voteButtons.innerHTML = "";

  appendVoteMessage(`投票先: ${formatVoteTarget(target)}`);

  voteNextBtn.classList.remove("hidden");
}

function finalizeVotes() {
  const voteTotals = Array(gameState.count).fill(0);
  const voteSummary = [];

  gameState.votes.forEach((target, voterIndex) => {
    const weight = gameState.currentRoles[voterIndex] === "村長" ? 2 : 1;

    if (target === "peace") {
      voteSummary.push(`${getPlayerName(voterIndex)} → 平和村を願う`);
      return;
    }

    voteTotals[target] += weight;
    voteSummary.push(`${getPlayerName(voterIndex)} → ${getPlayerName(target)}${weight === 2 ? "（2票）" : ""}`);
  });

  const allPeace = gameState.votes.every((target) => target === "peace");
  const everyoneOneVote = voteTotals.every((total) => total === 1);
  gameState.isPeaceVillage = allPeace || everyoneOneVote;

  if (gameState.isPeaceVillage) {
    gameState.eliminatedPlayers = [];
  } else {
    const maxVote = Math.max(...voteTotals);
    gameState.eliminatedPlayers = voteTotals
      .map((total, index) => ({ total, index }))
      .filter((item) => item.total === maxVote && item.total > 0)
      .map((item) => item.index);
  }

  voteStatus.textContent = "投票結果";
  voteActionArea.classList.remove("hidden");
  voteButtons.innerHTML = "";

  const hunterIndex = gameState.eliminatedPlayers.find(
    (index) => gameState.currentRoles[index] === "狩人"
  );

  if (hunterIndex !== undefined) {
    voteResult.textContent = [
      `処刑対象:${formatPlayerList(gameState.eliminatedPlayers)}`,
      `${getPlayerName(hunterIndex)}は狩人でした`,
    ].join("\n");

    const hunterButton = createChoiceButton("狩人の追加処刑へ", () => {
      startHunterExecution(hunterIndex);
    });

    voteButtons.appendChild(hunterButton);
    return;
  }

  voteResult.textContent = [
    "投票が終了しました",
    ...voteSummary,
    `集計結果: ${voteTotals.map((total, index) => `${getPlayerName(index)}=${total}`).join(" / ")}`,
    `処刑対象:${formatPlayerList(gameState.eliminatedPlayers)}`,
  ].join("\n");

  finalizeGame();
}

function startHunterExecution(hunterIndex) {
  const hunterTargets = Array.from({ length: gameState.count }, (_, index) => index)
    .filter((index) => !gameState.eliminatedPlayers.includes(index));

  voteButtons.innerHTML = "";
  voteResult.textContent = [
    `処刑対象:${formatPlayerList(gameState.eliminatedPlayers)}`,
    `${getPlayerName(hunterIndex)}は狩人でした`,
  ].join("\n");

  voteStatus.textContent = `${getPlayerName(hunterIndex)}の追加処刑です`;
  progressText.textContent = "狩人の追加処刑";
  voteActionArea.classList.remove("hidden");

  hunterTargets.forEach((targetIndex) => {
    const button = createChoiceButton(`${getPlayerName(targetIndex)}を吊る`, () => {
      gameState.eliminatedPlayers.push(targetIndex);
      gameState.eliminatedPlayers = [...new Set(gameState.eliminatedPlayers)];
      voteButtons.innerHTML = "";
      voteResult.textContent = [
        `処刑対象:${formatPlayerList(gameState.eliminatedPlayers)}`,
        "",
        `狩人の効果で${getPlayerName(targetIndex)}が追加で吊られました`,
      ].join("\n");
      finalizeGame();
    });

    voteButtons.appendChild(button);
  });

  const nobodyButton = createChoiceButton("誰も吊らない", () => {
    voteButtons.innerHTML = "";
    voteResult.textContent = [
      `処刑対象:${formatPlayerList(gameState.eliminatedPlayers)}`,
      "",
      "狩人は誰も追加で吊りませんでした",
    ].join("\n");
    finalizeGame();
  });

  voteButtons.appendChild(nobodyButton);
}

function finalizeGame() {
  gameState.phase = "result";
  progressText.textContent = "ゲーム終了";

  const werewolfIndexes = gameState.currentRoles
    .map((role, index) => ({ role, index }))
    .filter((item) => item.role === "人狼")
    .map((item) => item.index);

  const hasWerewolf = werewolfIndexes.length > 0;
  const hasExecutedWerewolf = gameState.eliminatedPlayers.some(
    (index) => gameState.currentRoles[index] === "人狼"
  );

  let headline = "";

  if (!hasWerewolf) {
    if (gameState.eliminatedPlayers.length === 0) {
      headline = "平和村で全員勝利！よかったね！！！";
    } else {
      headline = "平和崩れ全員負け、ナイストライ！";
    }
  } else if (hasExecutedWerewolf) {
    const winningPlayers = gameState.currentRoles
      .map((role, index) => ({ role, index }))
      .filter((item) => getPlayerTeam(item.role, hasWerewolf) === "村")
      .map((item) => item.index);

    headline = `村陣営勝利！勝者:${formatPlayerList(winningPlayers)}`;
  } else {
    const winningPlayers = gameState.currentRoles
      .map((role, index) => ({ role, index }))
      .filter((item) => getPlayerTeam(item.role, hasWerewolf) === "人狼")
      .map((item) => item.index);

    headline = `人狼陣営勝利！勝者:${formatPlayerList(winningPlayers)}`;
  }

  const playerLines = gameState.currentRoles.map((role, index) => {
    return `${getPlayerName(index)}: ${role}、投票先:${formatVoteTarget(gameState.votes[index])}`;
  });

  const resultLines = [
    headline,
    `処刑プレイヤーは${formatPlayerList(gameState.eliminatedPlayers)}`,
    ...playerLines,
    `墓地:${gameState.graveCards[0]}、${gameState.graveCards[1]}`,
  ];

  finalResult.textContent = resultLines.join("\n");
  voteStatus.textContent = "ゲーム結果";
}

setupBtn.addEventListener("click", () => {
  const count = Number(playerCount.value);
  const roles = roleSets[count];
  const shuffledRoles = shuffleArray(roles);
  const initialRoles = shuffledRoles.slice(0, count);
  const graveCards = shuffledRoles.slice(count);
  const playerNames = normalizePlayerNames(count);

  gameState = {
    count,
    allRoles: [...roles],
    initialRoles: [...initialRoles],
    graveCards: [...graveCards],
    currentRoles: [...initialRoles],
    playerNames: [...playerNames],
    phase: "night",
    nightQueue: [],
    nightIndex: 0,
    votes: [],
    voteIndex: 0,
    eliminatedPlayers: [],
    isPeaceVillage: false,
  };

  roleList.textContent = buildRoleListText(roles);
  nameInputGuide.textContent = `登録名: ${playerNames.join("、")}`;
  nightStatus.textContent = "まだ開始していません";
  voteStatus.textContent = "まだ開始していません";
  finalResult.textContent = "まだ終了していません";
  startVoteBtn.classList.add("hidden");
  clearNightUI();
  clearVoteUI();
  startNightPhase();
});

playerCount.addEventListener("change", () => {
  renderNameInputs(Number(playerCount.value));
});

nightConfirmBtn.addEventListener("click", () => {
  gameState.nightIndex += 1;
  showNightWaitingScreen();
});

startVoteBtn.addEventListener("click", () => {
  startVotePhase();
});

voteNextBtn.addEventListener("click", () => {
  gameState.voteIndex += 1;
  showVoteWaitingScreen();
});

renderNameInputs(Number(playerCount.value));
