(function () {
  "use strict";

  const MAX_MISSES = 10;
  const GAME_KEY = "beths-hangman-test:game";
  const STATS_KEY = "beths-hangman-test:stats";
  const SITE_URL = "olliewritesthings.com/beths-hangman-test/";
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const PART_CLASSES = [
    "part-head",
    "part-neck",
    "part-left-arm",
    "part-right-arm",
    "part-body",
    "part-left-leg",
    "part-right-leg",
    "part-left-eye",
    "part-right-eye",
    "part-sad-mouth"
  ];

  let elements = {};
  let word = "BAKERY";
  let todayKey = "";
  let puzzleNumber = 1;
  let state = null;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  async function init() {
    collectElements();
    setControlsVisible(true);

    todayKey = getTodayKey();
    puzzleNumber = getPuzzleNumber(todayKey);

    try {
      const saved = loadSavedGame();
      const urlWord = cleanWord(new URLSearchParams(window.location.search).get("word"));
      word = urlWord || (saved && saved.word) || await getStartingWord();
      state = urlWord ? freshState(word) : saved || freshState(word);
      word = state.word;

      applyUrlState();
      updateDemoWordField();
      setText(elements.dateLabel, formatToday());
      buildKeyboard();
      bindActions();
      saveGame();
      render();
    } catch (error) {
      showLoadError(error);
    }
  }

  function collectElements() {
    [
      "wordSlots",
      "misses",
      "keyboard",
      "message",
      "answer",
      "dateLabel",
      "shareButton",
      "shareStatus",
      "statsButton",
      "statsModal",
      "statsCloseButton",
      "statsResult",
      "statsTiles",
      "guessDistribution",
      "recentResults",
      "statsShareButton",
      "statsShareStatus",
      "resetStatsButton",
      "demoPanel",
      "demoWord",
      "demoMisses",
      "demoMissesValue",
      "applyWord",
      "resetGame",
      "forceWin",
      "forceLose",
      "showStats",
      "clearStats",
      "recordMode",
      "editModeButton"
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function setControlsVisible(visible) {
    document.body.classList.toggle("controls-enabled", visible);
    document.body.classList.toggle("recording-mode", !visible);

    if (elements.demoPanel) {
      elements.demoPanel.hidden = !visible;
      elements.demoPanel.open = visible;
    }

    if (elements.editModeButton) {
      elements.editModeButton.hidden = visible;
    }
  }

  async function getStartingWord() {
    const typedWord = cleanWord(elements.demoWord && elements.demoWord.value);
    if (typedWord) {
      return typedWord;
    }

    const response = await fetch(new URL("./words.json", window.location.href), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load words.json (${response.status})`);
    }

    const words = normalizeWords(await response.json());
    return words[(puzzleNumber - 1) % words.length] || "BAKERY";
  }

  function normalizeWords(data) {
    const entries = Array.isArray(data) ? data : data && Array.isArray(data.words) ? data.words : [];
    const words = entries.map((entry) => cleanWord(typeof entry === "string" ? entry : entry && entry.word)).filter(Boolean);
    if (!words.length) {
      throw new Error("words.json does not contain any usable words");
    }
    return words;
  }

  function freshState(nextWord) {
    return {
      date: todayKey,
      word: cleanWord(nextWord) || "BAKERY",
      guesses: [],
      wrongGuesses: 0,
      status: "playing",
      statsSaved: false
    };
  }

  function loadSavedGame() {
    try {
      const saved = JSON.parse(storageGet(GAME_KEY));
      if (!saved || !Array.isArray(saved.guesses)) {
        return null;
      }

      return {
        ...freshState(saved.word),
        ...saved,
        word: cleanWord(saved.word) || "BAKERY",
        guesses: saved.guesses.map(cleanWord).filter(Boolean),
        wrongGuesses: clampMisses(saved.wrongGuesses),
        status: ["playing", "won", "lost"].includes(saved.status) ? saved.status : "playing",
        statsSaved: Boolean(saved.statsSaved)
      };
    } catch {
      storageRemove(GAME_KEY);
      return null;
    }
  }

  function saveGame() {
    storageSet(GAME_KEY, JSON.stringify(state));
  }

  function applyUrlState() {
    const params = new URLSearchParams(window.location.search);
    const misses = params.get("misses");

    if (misses !== null) {
      setMissesWithoutRender(misses);
    }

    if (params.get("win") === "1") {
      solveWithoutRender();
    }

    if (params.get("lose") === "1") {
      loseWithoutRender();
    }
  }

  function buildKeyboard() {
    if (!elements.keyboard) {
      return;
    }

    elements.keyboard.innerHTML = "";
    LETTERS.forEach((letter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.textContent = letter;
      button.setAttribute("aria-label", `Guess ${letter}`);
      button.addEventListener("click", () => guessLetter(letter));
      elements.keyboard.appendChild(button);
    });
  }

  function bindActions() {
    on(elements.shareButton, "click", () => shareResult(elements.shareStatus));
    on(elements.statsShareButton, "click", () => shareResult(elements.statsShareStatus));
    on(elements.statsButton, "click", openStatsModal);
    on(elements.showStats, "click", openStatsModal);
    on(elements.statsCloseButton, "click", closeStatsModal);
    on(elements.resetStatsButton, "click", () => resetStats(true));
    on(elements.clearStats, "click", () => resetStats(false));
    on(elements.applyWord, "click", applyWord);
    on(elements.resetGame, "click", resetGame);
    on(elements.forceWin, "click", forceWin);
    on(elements.forceLose, "click", forceLose);
    on(elements.recordMode, "click", () => setControlsVisible(false));
    on(elements.editModeButton, "click", () => setControlsVisible(true));
    on(elements.demoMisses, "input", () => setDemoMisses(elements.demoMisses.value));
    on(elements.demoWord, "keydown", (event) => {
      if (event.key === "Enter") {
        applyWord();
      }
    });
    on(elements.statsModal, "click", (event) => {
      if (event.target === elements.statsModal) {
        closeStatsModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (event.key === "Escape") {
        closeStatsModal();
        setControlsVisible(true);
      }

      if (!isTyping && event.key.toLowerCase() === "e") {
        setControlsVisible(true);
      }
    });
  }

  function on(element, eventName, handler) {
    if (element) {
      element.addEventListener(eventName, handler);
    }
  }

  function guessLetter(letter) {
    if (state.status !== "playing" || state.guesses.includes(letter)) {
      return;
    }

    state.guesses.push(letter);
    if (!word.includes(letter)) {
      state.wrongGuesses += 1;
    }

    if (isSolved()) {
      finishGame("won", true);
    } else if (state.wrongGuesses >= MAX_MISSES) {
      finishGame("lost", true);
    } else {
      saveGame();
      render();
    }
  }

  function finishGame(status, showStatsAfter) {
    state.status = status;
    recordCompletion();
    saveGame();
    render();
    if (showStatsAfter) {
      setTimeout(openStatsModal, 180);
    }
  }

  function render() {
    if (!state) {
      return;
    }

    renderWord();
    renderMisses();
    renderKeyboard();
    renderHangman();
    renderMessage();
    renderStatsContent();
    syncDemoControls();
  }

  function renderWord() {
    if (!elements.wordSlots) {
      return;
    }

    elements.wordSlots.innerHTML = "";
    word.split("").forEach((letter) => {
      const slot = document.createElement("span");
      slot.className = "slot";
      slot.textContent = state.guesses.includes(letter) ? letter : "";
      slot.setAttribute("aria-label", slot.textContent || "blank");
      elements.wordSlots.appendChild(slot);
    });
  }

  function renderMisses() {
    setText(elements.misses, state.guesses.filter((letter) => !word.includes(letter)).join(" "));
  }

  function renderKeyboard() {
    if (!elements.keyboard) {
      return;
    }

    elements.keyboard.querySelectorAll(".key").forEach((button) => {
      const letter = button.textContent;
      const guessed = state.guesses.includes(letter);
      button.disabled = guessed || state.status !== "playing";
      button.classList.toggle("correct", guessed && word.includes(letter));
      button.classList.toggle("wrong", guessed && !word.includes(letter));
    });
  }

  function renderHangman() {
    PART_CLASSES.forEach((className, index) => {
      const part = document.querySelector(`.${className}`);
      if (part) {
        part.classList.toggle("visible", index < state.wrongGuesses);
      }
    });
  }

  function renderMessage() {
    if (!elements.message) {
      return;
    }

    elements.message.className = "message";
    if (elements.answer) {
      elements.answer.hidden = true;
      elements.answer.textContent = "";
    }

    if (state.status === "won") {
      elements.message.textContent = `You found it in ${state.wrongGuesses} ${missLabel(state.wrongGuesses)}. Nicely done.`;
      elements.message.classList.add("win");
      return;
    }

    if (state.status === "lost") {
      elements.message.textContent = "That was the last part. Tomorrow brings another word.";
      elements.message.classList.add("lose");
      if (elements.answer) {
        elements.answer.textContent = `Today's word was ${word}.`;
        elements.answer.hidden = false;
      }
      return;
    }

    const remaining = MAX_MISSES - state.wrongGuesses;
    elements.message.textContent = `${remaining} ${missLabel(remaining)} left.`;
  }

  function applyWord() {
    word = cleanWord(elements.demoWord && elements.demoWord.value) || "BAKERY";
    state = freshState(word);
    saveGame();
    closeStatsModal();
    updateDemoWordField();
    render();
  }

  function resetGame() {
    state = freshState(word);
    saveGame();
    closeStatsModal();
    render();
  }

  function setDemoMisses(value) {
    setMissesWithoutRender(value);
    saveGame();
    render();
  }

  function setMissesWithoutRender(value) {
    const count = clampMisses(value);
    const correctGuesses = state.guesses.filter((letter) => word.includes(letter));
    const wrongGuesses = availableWrongLetters().slice(0, count);

    state.guesses = [...new Set([...correctGuesses, ...wrongGuesses])];
    state.wrongGuesses = count;
    state.statsSaved = false;
    state.status = count >= MAX_MISSES ? "lost" : isSolved() ? "won" : "playing";

    if (state.status !== "playing") {
      recordCompletion();
    }
  }

  function forceWin() {
    solveWithoutRender();
    finishGame("won", false);
  }

  function solveWithoutRender() {
    state.guesses = [...new Set([...state.guesses, ...word.split("")])];
    state.status = "won";
    state.statsSaved = false;
    state.wrongGuesses = clampMisses(state.wrongGuesses);
  }

  function forceLose() {
    loseWithoutRender();
    finishGame("lost", false);
  }

  function loseWithoutRender() {
    state.guesses = [...new Set([...state.guesses.filter((letter) => word.includes(letter)), ...availableWrongLetters().slice(0, MAX_MISSES)])];
    state.wrongGuesses = MAX_MISSES;
    state.status = "lost";
    state.statsSaved = false;
  }

  function availableWrongLetters() {
    return LETTERS.filter((letter) => !word.includes(letter));
  }

  function syncDemoControls() {
    if (elements.demoMisses) {
      elements.demoMisses.value = String(state.wrongGuesses);
    }
    setText(elements.demoMissesValue, String(state.wrongGuesses));
  }

  function updateDemoWordField() {
    if (elements.demoWord) {
      elements.demoWord.value = word;
    }
  }

  function loadStats() {
    const freshStats = {
      played: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: createDistribution(),
      recentResults: [],
      completedDates: {}
    };

    try {
      const saved = JSON.parse(storageGet(STATS_KEY));
      const stats = { ...freshStats, ...saved };
      stats.recentResults = Array.isArray(stats.recentResults) ? stats.recentResults : [];
      stats.completedDates = stats.completedDates && typeof stats.completedDates === "object" ? stats.completedDates : {};
      rebuildStats(stats);
      return stats;
    } catch {
      return freshStats;
    }
  }

  function saveStats(stats) {
    storageSet(STATS_KEY, JSON.stringify(stats));
  }

  function recordCompletion() {
    if (state.status === "playing" || state.statsSaved) {
      return;
    }

    const stats = loadStats();
    const key = `${todayKey}:${word}`;
    if (stats.completedDates[key]) {
      state.statsSaved = true;
      return;
    }

    const won = state.status === "won";
    const result = {
      date: todayKey,
      puzzleNumber,
      word,
      status: state.status,
      misses: won ? state.wrongGuesses : MAX_MISSES,
      label: won ? `Solved with ${state.wrongGuesses} ${missLabel(state.wrongGuesses)}` : "Missed"
    };

    stats.completedDates[key] = result;
    stats.recentResults.unshift(result);
    rebuildStats(stats);
    saveStats(stats);
    state.statsSaved = true;
  }

  function rebuildStats(stats) {
    const results = Object.values(stats.completedDates || {}).filter((result) => result && result.status !== "playing");
    results.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    stats.played = results.length;
    stats.wins = results.filter((result) => result.status === "won").length;
    stats.losses = results.filter((result) => result.status === "lost").length;
    stats.currentStreak = 0;
    stats.bestStreak = 0;
    stats.distribution = createDistribution();

    results.slice().reverse().forEach((result) => {
      if (result.status === "won") {
        const key = String(Math.max(0, Math.min(9, Number(result.misses) || 0)));
        stats.distribution[key] += 1;
        stats.currentStreak += 1;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      } else {
        stats.distribution.X += 1;
        stats.currentStreak = 0;
      }
    });

    stats.recentResults = results.slice(0, 20);
  }

  function renderStatsContent() {
    if (!elements.statsResult || !elements.statsTiles || !elements.guessDistribution || !elements.recentResults) {
      return;
    }

    const stats = loadStats();
    const current = getCurrentResult();
    const winPercent = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

    elements.statsResult.textContent = current.label;
    elements.statsResult.classList.toggle("win", current.status === "won");
    elements.statsTiles.innerHTML = [
      statTile("Played", stats.played),
      statTile("Win %", winPercent),
      statTile("Streak", stats.currentStreak),
      statTile("Best", stats.bestStreak)
    ].join("");

    renderDistribution(stats, current);
    renderRecentResults(stats);
  }

  function statTile(label, value) {
    return `<div class="stat-tile"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
  }

  function getCurrentResult() {
    if (state.status === "won") {
      return { status: "won", key: String(state.wrongGuesses), label: `Solved with ${state.wrongGuesses} ${missLabel(state.wrongGuesses)}` };
    }
    if (state.status === "lost") {
      return { status: "lost", key: "X", label: "Missed" };
    }
    return { status: "playing", key: "", label: "Finish the demo puzzle to add a result." };
  }

  function renderDistribution(stats, current) {
    const labels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "X"];
    const highest = Math.max(1, ...labels.map((label) => Number(stats.distribution[label]) || 0));

    elements.guessDistribution.innerHTML = labels.map((label) => {
      const count = Number(stats.distribution[label]) || 0;
      const width = Math.max(7, Math.round((count / highest) * 100));
      const barLabel = label === "X" ? "Missed" : `${label} misses`;
      return `<div class="distribution-row${current.key === label ? " today" : ""}${label === "X" ? " missed" : ""}"><span class="distribution-label">${label}</span><div class="bar-track" aria-label="${barLabel}: ${count}"><div class="bar-fill" style="width:${width}%"></div></div><span class="distribution-count">${count}</span></div>`;
    }).join("");
  }

  function renderRecentResults(stats) {
    if (!stats.recentResults.length) {
      elements.recentResults.innerHTML = '<p class="share-status">No finished demo games yet.</p>';
      return;
    }

    elements.recentResults.innerHTML = stats.recentResults.slice(0, 12).map((result) => {
      const won = result.status === "won";
      const compact = won ? `✓${result.misses}` : "✕";
      const helper = result.label || (won ? `Solved with ${result.misses} ${missLabel(result.misses)}` : "Missed");
      return `<span class="recent-result ${won ? "win" : "loss"}" title="${helper}">${compact} <span class="recent-text">${helper}</span><span class="recent-helper">${helper}</span></span>`;
    }).join("");
  }

  function openStatsModal() {
    renderStatsContent();
    if (elements.statsModal) {
      elements.statsModal.hidden = false;
      elements.statsModal.setAttribute("aria-hidden", "false");
    }
  }

  function closeStatsModal() {
    if (elements.statsModal) {
      elements.statsModal.hidden = true;
      elements.statsModal.setAttribute("aria-hidden", "true");
    }
  }

  function resetStats(confirmFirst) {
    if (confirmFirst && !window.confirm("Reset all demo Hangman stats on this browser?")) {
      return;
    }
    storageRemove(STATS_KEY);
    state.statsSaved = false;
    saveGame();
    renderStatsContent();
  }

  async function shareResult(statusElement) {
    const shareText = getShareText();
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(shareText);
      setText(statusElement, "Result copied to clipboard.");
    } catch {
      setText(statusElement, shareText);
    }
  }

  function getShareText() {
    const solved = state.status === "won";
    const lost = state.status === "lost";
    const misses = solved ? state.wrongGuesses : lost ? MAX_MISSES : state.wrongGuesses;
    const green = solved ? MAX_MISSES - misses : 0;
    const squares = Array.from({ length: MAX_MISSES }, (_, index) => index < green ? "🟩" : "🟥").join("");
    const resultLine = solved ? `Solved with ${misses} ${missLabel(misses)}` : lost ? "Missed" : "Demo in progress";
    return [`Beth’s Hangman Demo #${puzzleNumber}`, resultLine, squares, "", SITE_URL].join("\n");
  }

  function createDistribution() {
    return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, X: 0 };
  }

  function isSolved() {
    return word.split("").every((letter) => state.guesses.includes(letter));
  }

  function missLabel(count) {
    return count === 1 ? "miss" : "misses";
  }

  function cleanWord(value) {
    return String(value || "").trim().replace(/[^a-z]/gi, "").toUpperCase();
  }

  function clampMisses(value) {
    return Math.max(0, Math.min(MAX_MISSES, Number(value) || 0));
  }

  function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function getPuzzleNumber(dateString) {
    const start = new Date("2026-06-09T00:00:00");
    const current = new Date(`${dateString}T00:00:00`);
    return Math.max(1, Math.floor((current - start) / 86400000) + 1);
  }

  function formatToday() {
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  function showLoadError(error) {
    setText(elements.message, "The demo puzzle could not load. Please refresh and try again.");
    if (elements.message) {
      elements.message.classList.add("lose");
    }
    console.error(error);
  }
})();
