const STATS_STORAGE_KEY = "one_night_jinro_stats_v4";
const MAX_PLAYERS = 8;
const MANUAL_ROLE_ORDER = ["人狼", "大狼", "狂人", "占い師", "怪盗", "吸血鬼", "狩人", "村長", "モブおじさん", "村人"];

const rolePatterns = {
  3: {
    A: ["大狼", "狂人", "占い師", "吸血鬼", "狩人"],
    B: ["人狼", "狂人", "占い師", "怪盗", "狩人"],
    C: ["人狼", "人狼", "占い師", "怪盗", "村人"],
  },
  4: {
    A: ["大狼", "狂人", "占い師", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "狂人", "占い師", "怪盗", "吸血鬼", "狩人"],
    C: ["人狼", "人狼", "占い師", "怪盗", "村人", "村人"],
  },
  5: {
    A: ["人狼", "人狼", "狂人", "占い師", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "人狼", "狂人", "占い師", "怪盗", "吸血鬼", "狩人"],
    C: ["人狼", "人狼", "狂人", "占い師", "怪盗", "村人", "村人"],
  },
  6: {
    A: ["人狼", "人狼", "狂人", "占い師", "怪盗", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "人狼", "狂人", "占い師", "怪盗", "狩人", "村長", "村人"],
    C: ["人狼", "人狼", "狂人", "占い師", "怪盗", "狩人", "村人", "村人"],
  },
  7: {
    A: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長"],
    B: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "狩人", "村人", "村人"],
  },
  8: {
    A: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "吸血鬼", "狩人", "村長", "村人"],
    B: ["人狼", "人狼", "狂人", "占い師", "占い師", "怪盗", "狩人", "村長", "村人", "村人"],
  },
};

const roleDescriptions = {
  "人狼": "人狼が吊られなければ勝利",
  "大狼": "墓地も確認できる人狼",
  "狂人": "人狼陣営。人狼がいない場合は村陣営",
  "占い師": "夜に誰か1人か墓地2枚を見る",
  "怪盗": "夜に誰か1人と役職を交換する",
  "吸血鬼": "夜に誰か1人または墓地1枚と役職を交換する",
  "狩人": "吊られたら追加で1人吊れる",
  "村長": "投票が2票になる",
  "モブおじさん": "誰かを訪問して熱い夜を過ごす",
  "村人": "夜の行動なし",
};

const playerCount = document.getElementById("playerCount");
const patternSelect = document.getElementById("patternSelect");
const startBtn = document.getElementById("startBtn");

const nameInputGuide = document.getElementById("nameInputGuide");
const nameInputs = document.getElementById("nameInputs");

const manualRoleBox = document.getElementById("manualRoleBox");
const manualRoleInputs = document.getElementById("manualRoleInputs");
const manualRoleCount = document.getElementById("manualRoleCount");

const roleCountLine = document.getElementById("roleCountLine");
const roleDescriptionWrap = document.getElementById("roleDescriptionWrap");

const nightStatus = document.getElementById("nightStatus");
const nightActionArea = document.getElementById("nightActionArea");
const nightRoleText = document.getElementById("nightRoleText");
const nightButtons = document.getElementById("nightButtons");
const nightDetail = document.getElementById("nightDetail");
const nightConfirmBtn = document.getElementById("nightConfirmBtn");

const voteStatus = document.getElementById("voteStatus");
const startVoteBtn = document.getElementById("startVoteBtn");
const voteActionArea = document.getElementById("voteActionArea");
const voteButtons = document.getElementById("voteButtons");
const voteResult = document.getElementById("voteResult");
const voteNextBtn = document.getElementById("voteNextBtn");

const resultHeadline = document.getElementById("resultHeadline");
const resultMeta = document.getElementById("resultMeta");
const resultTableWrap = document.getElementById("resultTableWrap");
const statsTableWrap = document.getElementById("statsTableWrap");
const progressText = document.getElementById("progressText");

let settingsState = {
  count: Number(playerCount.value),
  pattern: "A",
  nameDrafts: Array(MAX_PLAYERS).fill(""),
  manualRoleDrafts: Object.fromEntries(MANUAL_ROLE_ORDER.map((role) => [role, 0])),
};

let gameState = {
  count: 0,
  pattern: "A",
  allRoles: [],
  initialRoles: [],
  currentRoles: [],
  roleHistories: [],
  initialGraveCards: [],
  currentGraveCards: [],
  playerNames: [],
  phase: "setup",
  nightQueue: [],
  nightIndex: 0,
  votes: [],
  voteIndex: 0,
  eliminatedPlayers: [],
  isPeaceVillage: false,
  statsRecorded: false,
  mobVisit: null,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  nightRoleText.textContent = "";
  nightDetail.textContent = "";
  nightConfirmBtn.classList.add("hidden");
  nightActionArea.classList.add("hidden");
}

function clearVoteUI() {
  voteButtons.innerHTML = "";
  voteResult.textContent = "";
  voteNextBtn.classList.add("hidden");
  voteActionArea.classList.add("hidden");
}

function appendNightDetail(message) {
  if (nightDetail.textContent.trim() === "") {
    nightDetail.textContent = message;
    return;
  }
  nightDetail.textContent += `\n${message}`;
}

function getDefaultPlayerName(index) {
  return `プレイヤー${index + 1}`;
}

function getPlayerName(index) {
  return gameState.playerNames[index] || getDefaultPlayerName(index);
}

function formatPlayerList(indexes) {
  if (indexes.length === 0) {
    return "なし";
  }
  return indexes.map((index) => getPlayerName(index)).join("、");
}

function formatVoteTarget(target) {
  if (target === "peace") {
    return "平和村を願う";
  }
  return getPlayerName(target);
}

function isWerewolfRole(role) {
  return role === "人狼" || role === "大狼";
}

function getPlayerTeam(role, hasWerewolfSide) {
  if (role === "人狼" || role === "大狼") {
    return "人狼";
  }
  if (role === "狂人") {
    return hasWerewolfSide ? "人狼" : "村";
  }
  return "村";
}

function formatRoleHistory(history) {
  return history.length <= 1 ? history[0] : history.join("→");
}

function formatGraveCard(index) {
  const initialRole = gameState.initialGraveCards[index];
  const currentRole = gameState.currentGraveCards[index];
  return initialRole === currentRole ? initialRole : `${initialRole}→${currentRole}`;
}

function formatGraveSummary() {
  return `${formatGraveCard(0)}、${formatGraveCard(1)}`;
}

function getSelectedRoles() {
  const count = Number(playerCount.value);
  const pattern = patternSelect.value;

  if (pattern === "X") {
    const roles = [];
    MANUAL_ROLE_ORDER.forEach((role) => {
      const countValue = Number(settingsState.manualRoleDrafts[role]) || 0;
      for (let i = 0; i < countValue; i += 1) {
        roles.push(role);
      }
    });
    return roles;
  }

  return [...rolePatterns[count][pattern]];
}

function getRequiredRoleTotal() {
  return Number(playerCount.value) + 2;
}

function getManualRoleTotal() {
  return MANUAL_ROLE_ORDER.reduce((sum, role) => {
    return sum + (Number(settingsState.manualRoleDrafts[role]) || 0);
  }, 0);
}

function updatePatternOptions() {
  const count = Number(playerCount.value);
  const patterns = [...Object.keys(rolePatterns[count]), "X"];

  patternSelect.innerHTML = "";
  patterns.forEach((pattern) => {
    const option = document.createElement("option");
    option.value = pattern;
    option.textContent = pattern;
    patternSelect.appendChild(option);
  });

  if (!patterns.includes(settingsState.pattern)) {
    settingsState.pattern = patterns[0];
  }
  patternSelect.value = settingsState.pattern;
}

function buildCountSummary(roles) {
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

function buildRoleDescriptionTable(roles) {
  const { orderedUniqueRoles } = buildCountSummary(roles);

  if (orderedUniqueRoles.length === 0) {
    roleDescriptionWrap.innerHTML = "";
    roleDescriptionWrap.classList.add("hidden");
    return;
  }

  const rows = orderedUniqueRoles.map((role) => {
    return `
      <tr>
        <td>${escapeHtml(role)}</td>
        <td>${escapeHtml(roleDescriptions[role])}</td>
      </tr>
    `;
  }).join("");

  roleDescriptionWrap.innerHTML = `
    <table class="role-table">
      <thead>
        <tr>
          <th>役職</th>
          <th>説明</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
  roleDescriptionWrap.classList.remove("hidden");
}

function updateRoleListPreview() {
  const roles = getSelectedRoles();
  const summary = buildCountSummary(roles);

  roleCountLine.textContent = summary.text === "" ? "まだ決定していません" : summary.text;
  buildRoleDescriptionTable(roles);
}

function swapNameDrafts(indexA, indexB) {
  const temp = settingsState.nameDrafts[indexA];
  settingsState.nameDrafts[indexA] = settingsState.nameDrafts[indexB];
  settingsState.nameDrafts[indexB] = temp;
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
    input.maxLength = 12;
    input.value = settingsState.nameDrafts[i];
    input.placeholder = getDefaultPlayerName(i);
    input.addEventListener("input", (event) => {
      settingsState.nameDrafts[i] = event.target.value;
    });

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.className = "name-move-btn";
    upButton.textContent = "↑";
    upButton.disabled = i === 0;
    upButton.addEventListener("click", () => {
      swapNameDrafts(i, i - 1);
      renderNameInputs(Number(playerCount.value));
    });

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.className = "name-move-btn";
    downButton.textContent = "↓";
    downButton.disabled = i === count - 1;
    downButton.addEventListener("click", () => {
      swapNameDrafts(i, i + 1);
      renderNameInputs(Number(playerCount.value));
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(upButton);
    row.appendChild(downButton);
    nameInputs.appendChild(row);
  }
}

function renderManualRoleInputs() {
  manualRoleInputs.innerHTML = "";

  MANUAL_ROLE_ORDER.forEach((role) => {
    const row = document.createElement("div");
    row.className = "manual-role-row";

    const label = document.createElement("label");
    label.setAttribute("for", `manualRole_${role}`);
    label.textContent = role;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.id = `manualRole_${role}`;
    input.value = settingsState.manualRoleDrafts[role];
    input.addEventListener("input", (event) => {
      const rawValue = event.target.value;
      const numericValue = Math.max(0, Number(rawValue) || 0);
      settingsState.manualRoleDrafts[role] = numericValue;
      event.target.value = String(numericValue);
      updateManualRoleState();
    });

    row.appendChild(label);
    row.appendChild(input);
    manualRoleInputs.appendChild(row);
  });
}

function updateManualRoleState() {
  const current = getManualRoleTotal();
  const required = getRequiredRoleTotal();

  manualRoleCount.textContent = `${current} / ${required}`;
  manualRoleCount.classList.toggle("invalid", current !== required);

  const isPatternX = patternSelect.value === "X";
  manualRoleBox.classList.toggle("hidden", !isPatternX);

  startBtn.disabled = isPatternX && current !== required;
  updateRoleListPreview();
}

function normalizePlayerNames(count) {
  const result = [];

  for (let i = 0; i < count; i += 1) {
    const raw = settingsState.nameDrafts[i].trim();
    result.push(raw === "" ? getDefaultPlayerName(i) : raw);
  }

  return result;
}

function decideMobVisit(initialRoles, count) {
  const visitorIndex = initialRoles.findIndex((role) => role === "モブおじさん");
  if (visitorIndex === -1) {
    return null;
  }

  const targets = [];
  for (let i = 0; i < count; i += 1) {
    if (i !== visitorIndex) {
      targets.push(i);
    }
  }

  const targetIndex = targets[Math.floor(Math.random() * targets.length)];
  return { visitorIndex, targetIndex };
}

function buildNightQueue() {
  return gameState.initialRoles.map((role, index) => ({
    playerIndex: index,
    initialRole: role,
  }));
}

function addRoleHistory(index, newRole) {
  const history = gameState.roleHistories[index];
  if (history[history.length - 1] !== newRole) {
    history.push(newRole);
  }
}

function swapPlayerRoles(indexA, indexB) {
  const roleA = gameState.currentRoles[indexA];
  const roleB = gameState.currentRoles[indexB];

  gameState.currentRoles[indexA] = roleB;
  gameState.currentRoles[indexB] = roleA;

  addRoleHistory(indexA, roleB);
  addRoleHistory(indexB, roleA);
}

function swapPlayerWithGrave(playerIndex, graveIndex) {
  const playerRole = gameState.currentRoles[playerIndex];
  const graveRole = gameState.currentGraveCards[graveIndex];

  gameState.currentRoles[playerIndex] = graveRole;
  gameState.currentGraveCards[graveIndex] = playerRole;
  addRoleHistory(playerIndex, graveRole);
}

function createNewGameFromSettings() {
  const count = Number(playerCount.value);
  const pattern = patternSelect.value;
  const roles = getSelectedRoles();

  if (pattern === "X" && roles.length !== getRequiredRoleTotal()) {
    return;
  }

  const shuffled = shuffleArray(roles);
  const initialRoles = shuffled.slice(0, count);
  const graveCards = shuffled.slice(count);
  const playerNames = normalizePlayerNames(count);
  const mobVisit = decideMobVisit(initialRoles, count);

  settingsState.count = count;
  settingsState.pattern = pattern;

  gameState = {
    count,
    pattern,
    allRoles: [...roles],
    initialRoles: [...initialRoles],
    currentRoles: [...initialRoles],
    roleHistories: initialRoles.map((role) => [role]),
    initialGraveCards: [...graveCards],
    currentGraveCards: [...graveCards],
    playerNames: [...playerNames],
    phase: "night",
    nightQueue: [],
    nightIndex: 0,
    votes: [],
    voteIndex: 0,
    eliminatedPlayers: [],
    isPeaceVillage: false,
    statsRecorded: false,
    mobVisit,
  };

  startBtn.textContent = "再スタート";
  nameInputGuide.textContent = `登録名: ${playerNames.join("、")}`;
  resultHeadline.textContent = "まだ終了していません";
  resultMeta.textContent = "";
  resultTableWrap.innerHTML = "";
  resultTableWrap.classList.add("hidden");
  statsTableWrap.innerHTML = "";
  statsTableWrap.classList.add("hidden");

  nightStatus.textContent = "まだ開始していません";
  voteStatus.textContent = "まだ開始していません";
  startVoteBtn.classList.add("hidden");
  clearNightUI();
  clearVoteUI();

  startNightPhase();
}

function startNightPhase() {
  gameState.phase = "night";
  gameState.nightQueue = buildNightQueue();
  gameState.nightIndex = 0;
  progressText.textContent = "夜フェーズ";
  showNightWaitingScreen();
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
  nightActionArea.classList.remove("hidden");

  const startButton = createChoiceButton("夜行動を開始", () => {
    runNightAction();
  });

  nightButtons.appendChild(startButton);
}

function finishNightAction(message) {
  nightButtons.innerHTML = "";
  appendNightDetail(message);
  nightConfirmBtn.classList.remove("hidden");
  nightActionArea.classList.remove("hidden");
}

function getInitialWerewolfPartners(playerIndex) {
  return gameState.initialRoles
    .map((role, index) => ({ role, index }))
    .filter((item) => isWerewolfRole(item.role) && item.index !== playerIndex);
}

function startRoleAction(action) {
  const playerIndex = action.playerIndex;
  const playerName = getPlayerName(playerIndex);
  const role = action.initialRole;

  nightButtons.innerHTML = "";
  nightDetail.textContent = "";
  nightConfirmBtn.classList.add("hidden");
  nightActionArea.classList.remove("hidden");

  nightStatus.textContent = `${playerName}の夜行動です`;
  nightRoleText.textContent = `あなたの役職は ${role} です`;
  progressText.textContent = `夜行動 ${gameState.nightIndex + 1} / ${gameState.nightQueue.length}`;

  if (role === "人狼") {
    handleWerewolfAction(playerIndex);
    return;
  }

  if (role === "大狼") {
    handleBigWerewolfAction(playerIndex);
    return;
  }

  if (role === "狂人") {
    finishNightAction("狂人は夜の行動がありません");
    return;
  }

  if (role === "占い師") {
    handleSeerAction(playerIndex);
    return;
  }

  if (role === "怪盗") {
    handleRobberAction(playerIndex);
    return;
  }

  if (role === "吸血鬼") {
    handleVampireAction(playerIndex);
    return;
  }

  if (role === "モブおじさん") {
    handleMobOjisanAction(playerIndex);
    return;
  }

  if (role === "狩人" || role === "村長" || role === "村人") {
    finishNightAction(`${role}は夜の行動がありません`);
  }
}

function runNightAction() {
  const action = gameState.nightQueue[gameState.nightIndex];
  const playerIndex = action.playerIndex;

  nightButtons.innerHTML = "";
  nightDetail.textContent = "";
  nightConfirmBtn.classList.add("hidden");
  nightActionArea.classList.remove("hidden");

  if (gameState.mobVisit && gameState.mobVisit.targetIndex === playerIndex) {
    const visitorName = getPlayerName(gameState.mobVisit.visitorIndex);
    const playerName = getPlayerName(playerIndex);

    nightStatus.textContent = `${playerName}の夜行動です`;
    nightRoleText.textContent = "";
    nightDetail.textContent = `${visitorName}が訪問してきました`;

    const heatButton = createChoiceButton("熱い夜を過ごす", () => {
      startRoleAction(action);
    });

    nightButtons.appendChild(heatButton);
    return;
  }

  startRoleAction(action);
}

function handleWerewolfAction(playerIndex) {
  const partners = getInitialWerewolfPartners(playerIndex);

  if (partners.length === 0) {
    finishNightAction("仲間はいません");
    return;
  }

  finishNightAction(`仲間は ${partners.map((item) => getPlayerName(item.index)).join("、")} です`);
}

function handleBigWerewolfAction(playerIndex) {
  const partners = getInitialWerewolfPartners(playerIndex);
  const partnerText = partners.length === 0
    ? "仲間はいません"
    : `仲間は ${partners.map((item) => getPlayerName(item.index)).join("、")} です`;

  finishNightAction(`${partnerText}\n墓地は ${gameState.initialGraveCards.join("、")} です`);
}

function handleSeerAction(playerIndex) {
  nightButtons.innerHTML = "";

  for (let i = 0; i < gameState.count; i += 1) {
    if (i === playerIndex) {
      continue;
    }

    const button = createChoiceButton(getPlayerName(i), () => {
      finishNightAction(`${getPlayerName(i)}の役職は ${gameState.initialRoles[i]} です`);
    });

    nightButtons.appendChild(button);
  }

  const lookGraveButton = createChoiceButton("墓地を見る", () => {
    finishNightAction(`墓地は ${gameState.initialGraveCards.join("、")} です`);
  });

  nightButtons.appendChild(lookGraveButton);
}

function handleRobberAction(playerIndex) {
  nightButtons.innerHTML = "";

  for (let i = 0; i < gameState.count; i += 1) {
    if (i === playerIndex) {
      continue;
    }

    const button = createChoiceButton(`${getPlayerName(i)}と交換`, () => {
      swapPlayerRoles(playerIndex, i);
      finishNightAction(`${getPlayerName(i)}と交換しました。あなたの新しい役職は ${gameState.currentRoles[playerIndex]} です`);
    });

    nightButtons.appendChild(button);
  }
}

function handleVampireAction(playerIndex) {
  nightButtons.innerHTML = "";

  for (let i = 0; i < gameState.count; i += 1) {
    if (i === playerIndex) {
      continue;
    }

    const button = createChoiceButton(`${getPlayerName(i)}と交換`, () => {
      swapPlayerRoles(playerIndex, i);
      finishNightAction(`${getPlayerName(i)}と交換しました。あなたの新しい役職は ${gameState.currentRoles[playerIndex]} です`);
    });

    nightButtons.appendChild(button);
  }

  const graveButton = createChoiceButton("墓地と交換", () => {
    const graveIndex = Math.floor(Math.random() * 2);
    swapPlayerWithGrave(playerIndex, graveIndex);
    finishNightAction(`墓地${graveIndex + 1}と交換しました。あなたの新しい役職は ${gameState.currentRoles[playerIndex]} です`);
  });

  nightButtons.appendChild(graveButton);
}

function handleMobOjisanAction(playerIndex) {
  nightButtons.innerHTML = "";

  const visitButton = createChoiceButton("誰かを訪問する", () => {
    if (!gameState.mobVisit) {
      finishNightAction("訪問相手がいません");
      return;
    }

    const targetName = getPlayerName(gameState.mobVisit.targetIndex);
    finishNightAction(`${targetName}を訪問し熱い夜を過ごしました`);
  });

  nightButtons.appendChild(visitButton);
}

function startVotePhase() {
  gameState.phase = "vote";
  gameState.voteIndex = 0;
  gameState.votes = Array(gameState.count).fill(null);
  gameState.eliminatedPlayers = [];
  gameState.isPeaceVillage = false;
  startVoteBtn.classList.add("hidden");
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
  gameState.votes[gameState.voteIndex] = target;
  voteButtons.innerHTML = "";
  voteResult.textContent = `投票先: ${formatVoteTarget(target)}`;
  voteNextBtn.classList.remove("hidden");
}

function hasWerewolfInFinal() {
  return gameState.currentRoles.some((role) => isWerewolfRole(role));
}

function finalizeVotes() {
  const voteTotals = Array(gameState.count).fill(0);

  gameState.votes.forEach((target, voterIndex) => {
    const weight = gameState.currentRoles[voterIndex] === "村長" ? 2 : 1;
    if (target !== "peace") {
      voteTotals[target] += weight;
    }
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

  voteResult.textContent = `処刑対象:${formatPlayerList(gameState.eliminatedPlayers)}`;
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

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

function updateStatsForCurrentGame(winnerNames) {
  const stats = loadStats();

  gameState.playerNames.forEach((name) => {
    if (!stats[name]) {
      stats[name] = { wins: 0, games: 0 };
    }

    stats[name].games += 1;
    if (winnerNames.includes(name)) {
      stats[name].wins += 1;
    }
  });

  saveStats(stats);
  return stats;
}

function buildResultTableHtml() {
  const rows = gameState.playerNames.map((name, index) => {
    return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(formatRoleHistory(gameState.roleHistories[index]))}</td>
        <td>${escapeHtml(formatVoteTarget(gameState.votes[index]))}</td>
      </tr>
    `;
  }).join("");

  return `
    <table class="result-table">
      <thead>
        <tr>
          <th>名前</th>
          <th>役職</th>
          <th>投票先</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function buildStatsTableHtml(stats) {
  const rows = gameState.playerNames.map((name) => {
    const record = stats[name] || { wins: 0, games: 0 };
    const rate = record.games === 0 ? 0 : Math.round((record.wins / record.games) * 100);

    return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${record.wins}/${record.games}</td>
        <td>${rate}%</td>
      </tr>
    `;
  }).join("");

  return `
    <table class="stats-table">
      <thead>
        <tr>
          <th>名前</th>
          <th>勝利数/試合数</th>
          <th>勝率</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function finalizeGame() {
  gameState.phase = "result";
  progressText.textContent = "ゲーム終了";

  const hasWerewolfSide = hasWerewolfInFinal();
  const hasExecutedWerewolf = gameState.eliminatedPlayers.some(
    (index) => isWerewolfRole(gameState.currentRoles[index])
  );

  let headline = "";
  let winnerIndexes = [];

  if (!hasWerewolfSide) {
    if (gameState.eliminatedPlayers.length === 0) {
      headline = "平和村で全員勝利！よかったね！！！";
      winnerIndexes = gameState.playerNames.map((_, index) => index);
    } else {
      headline = "平和崩れで全員負け......";
      winnerIndexes = [];
    }
  } else if (hasExecutedWerewolf) {
    winnerIndexes = gameState.currentRoles
      .map((role, index) => ({ role, index }))
      .filter((item) => getPlayerTeam(item.role, hasWerewolfSide) === "村")
      .map((item) => item.index);
    headline = `村陣営勝利！勝者:${formatPlayerList(winnerIndexes)}`;
  } else {
    winnerIndexes = gameState.currentRoles
      .map((role, index) => ({ role, index }))
      .filter((item) => getPlayerTeam(item.role, hasWerewolfSide) === "人狼")
      .map((item) => item.index);
    headline = `人狼陣営勝利！勝者:${formatPlayerList(winnerIndexes)}`;
  }

  const winnerNames = winnerIndexes.map((index) => gameState.playerNames[index]);

  let stats = loadStats();
  if (!gameState.statsRecorded) {
    stats = updateStatsForCurrentGame(winnerNames);
    gameState.statsRecorded = true;
  }

  const metaLines = [
    `処刑プレイヤーは${formatPlayerList(gameState.eliminatedPlayers)}`,
    `墓地: ${formatGraveSummary()}`,
  ];

  if (gameState.mobVisit) {
    metaLines.push(`${getPlayerName(gameState.mobVisit.visitorIndex)}が${getPlayerName(gameState.mobVisit.targetIndex)}を訪問`);
  }

  resultHeadline.textContent = headline;
  resultMeta.textContent = metaLines.join("\n");

  resultTableWrap.innerHTML = buildResultTableHtml();
  resultTableWrap.classList.remove("hidden");

  statsTableWrap.innerHTML = buildStatsTableHtml(stats);
  statsTableWrap.classList.remove("hidden");

  voteStatus.textContent = "ゲーム結果";
}

function refreshConfigUI() {
  updatePatternOptions();
  renderNameInputs(Number(playerCount.value));
  updateManualRoleState();
}

playerCount.addEventListener("change", () => {
  settingsState.count = Number(playerCount.value);
  refreshConfigUI();
});

patternSelect.addEventListener("change", () => {
  settingsState.pattern = patternSelect.value;
  updateManualRoleState();
});

startBtn.addEventListener("click", () => {
  createNewGameFromSettings();
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

renderManualRoleInputs();
refreshConfigUI();
