(function () {
  "use strict";

  const MAX_MISSES = 10;
  const SITE_URL = "olliewritesthings.com/beths-hangman/";
  const STATS_KEY = "beths-hangman:stats";
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const PART_CLASSES = ["part-head", "part-neck", "part-left-arm", "part-right-arm", "part-body", "part-left-leg", "part-right-leg", "part-left-eye", "part-right-eye", "part-sad-mouth"];
  const DEV_OVERRIDE = {};

  let elements = {};
  let word = "";
  let puzzleNumber = 0;
  let todayKey = "";
  let storageKey = "";
  let state = null;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  async function init() {
    collectElements();

    try {
      const puzzle = await loadDailyPuzzle();
      word = puzzle.word;
      puzzleNumber = puzzle.puzzleNumber;
      todayKey = puzzle.todayKey;
      storageKey = `beths-hangman:${todayKey}`;
      state = loadState();

      if (elements.dateLabel) {
        elements.dateLabel.textContent = formatToday();
      }

      buildKeyboard();
      bindActions();
      recordLoadedCompletedGame();
      render();

      setInterval(() => {
        if (!DEV_OVERRIDE.date && getTodayKey() !== todayKey) {
          window.location.reload();
        }
      }, 60000);
    } catch (error) {
      showLoadError(error);
    }
  }

  function collectElements() {
    elements = {
      wordSlots: document.querySelector("#wordSlots"),
      misses: document.querySelector("#misses"),
      keyboard: document.querySelector("#keyboard"),
      message: document.querySelector("#message"),
      answer: document.querySelector("#answer"),
      dateLabel: document.querySelector("#dateLabel"),
      shareButton: document.querySelector("#shareButton"),
      shareStatus: document.querySelector("#shareStatus"),
      statsButton: document.querySelector("#statsButton"),
      statsModal: document.querySelector("#statsModal"),
      statsCloseButton: document.querySelector("#statsCloseButton"),
      statsResult: document.querySelector("#statsResult"),
      statsTiles: document.querySelector("#statsTiles"),
      guessDistribution: document.querySelector("#guessDistribution"),
      recentResults: document.querySelector("#recentResults"),
      statsShareButton: document.querySelector("#statsShareButton"),
      statsShareStatus: document.querySelector("#statsShareStatus"),
      resetStatsButton: document.querySelector("#resetStatsButton")
    };
  }

  async function loadDailyPuzzle() {
    const dateKey = DEV_OVERRIDE.date || getTodayKey();
    const words = await loadWords();
    const index = getPuzzleIndex(dateKey, words.length);

    return {
      todayKey: dateKey,
      word: cleanWord(DEV_OVERRIDE.word || words[index].word),
      puzzleNumber: getPuzzleNumber(dateKey)
    };
  }

  async function loadWords() {
    const response = await fetch(new URL("./words.json", window.location.href), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load words.json (${response.status})`);
    }

    const text = await response.text();
    return normalizeWords(JSON.parse(text.replace(/^\uFEFF/, "")));
  }

  function normalizeWords(data) {
    const rawWords = Array.isArray(data) ? data : data && Array.isArray(data.words) ? data.words : data && Array.isArray(data.puzzles) ? data.puzzles : data && Array.isArray(data.items) ? data.items : data && typeof data === "object" ? Object.values(data) : [];
    const words = rawWords
      .map((entry, index) => {
        if (typeof entry === "string") {
          return { word: entry, number: index + 1 };
        }

        if (entry && typeof entry === "object") {
          return {
            word: entry.word || entry.answer || entry.solution || entry.value || entry.text || entry.name || Object.values(entry).find((value) => typeof value === "string") || "",
            number: entry.number || entry.id || index + 1
          };
        }

        return { word: "", number: index + 1 };
      })
      .filter((entry) => cleanWord(entry.word));

    if (!words.length) {
      throw new Error("words.json does not contain any usable words");
    }

    return words;
  }

  function cleanWord(value) {
    return String(value || "").trim().replace(/[^a-z]/gi, "").toUpperCase();
  }

  function getPuzzleIndex(dateString, wordCount) {
    return (getPuzzleNumber(dateString) - 1) % wordCount;
  }

  function getPuzzleNumber(dateString) {
    const start = new Date("2026-06-09T00:00:00");
    const current = new Date(`${dateString}T00:00:00`);
    return Math.max(1, Math.floor((current - start) / 86400000) + 1);
  }

  function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function formatToday() {
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  }

  function loadState() {
    const freshState = { date: todayKey, guesses: [], wrongGuesses: 0, status: "playing", statsSaved: false };

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && saved.date === todayKey && Array.isArray(saved.guesses)) {
        return {
          ...freshState,
          guesses: saved.guesses.map(cleanWord).filter(Boolean),
          wrongGuesses: Number(saved.wrongGuesses) || 0,
          status: saved.status || "playing",
          statsSaved: Boolean(saved.statsSaved)
        };
      }
    } catch {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }

    return freshState;
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }

  function buildKeyboard() {
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
    elements.shareButton.addEventListener("click", () => shareResult(elements.shareStatus));
    elements.statsShareButton.addEventListener("click", () => shareResult(elements.statsShareStatus));
    elements.statsButton.addEventListener("click", openStatsModal);
    elements.statsCloseButton.addEventListener("click", closeStatsModal);
    elements.resetStatsButton.addEventListener("click", resetStats);
    elements.statsModal.addEventListener("click", (event) => {
      if (event.target === elements.statsModal) {
        closeStatsModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeStatsModal();
      }
    });
  }

  function guessLetter(letter) {
    if (state.status !== "playing" || state.guesses.includes(letter)) {
      return;
    }

    state.guesses.push(letter);

    if (!word.includes(letter)) {
      state.wrongGuesses += 1;
    }

    if (isWordComplete()) {
      finishGame("won");
    } else if (state.wrongGuesses >= MAX_MISSES) {
      finishGame("lost");
    } else {
      saveState();
      render();
    }
  }

  function finishGame(status) {
    state.status = status;
    recordCompletion();
    saveState();
    render();
    setTimeout(openStatsModal, 180);
  }

  function recordLoadedCompletedGame() {
    if (state.status !== "playing") {
      const stats = loadStats();
      if (state.statsSaved && !stats.completedDates[todayKey]) {
        state.statsSaved = false;
      }
      recordCompletion();
      saveState();
    }
  }

  function recordCompletion() {
    if (state.status === "playing" || state.statsSaved) {
      return;
    }

    const stats = loadStats();
    if (stats.completedDates[todayKey]) {
      rebuildStatsFromResults(stats);
      saveStats(stats);
      state.statsSaved = true;
      return;
    }

    const won = state.status === "won";
    const result = {
      date: todayKey,
      puzzleNumber,
      status: state.status,
      misses: won ? state.wrongGuesses : MAX_MISSES,
      label: won ? `Solved with ${state.wrongGuesses} ${missLabel(state.wrongGuesses)}` : "Missed"
    };

    stats.played += 1;
    stats.completedDates[todayKey] = result;
    stats.recentResults.unshift(result);
    stats.recentResults = stats.recentResults.slice(0, 20);
    rebuildStatsFromResults(stats);

    state.statsSaved = true;
    saveStats(stats);
  }

  function isWordComplete() {
    return word.split("").every((letter) => state.guesses.includes(letter));
  }

  function render() {
    renderWord();
    renderMisses();
    renderKeyboard();
    renderHangman();
    renderMessage();
    renderStatsContent();
  }

  function renderWord() {
    elements.wordSlots.innerHTML = "";

    word.split("").forEach((letter) => {
      const slot = document.createElement("span");
      slot.className = "slot";
      slot.textContent = state.guesses.includes(letter) ? letter : "";
      slot.classList.toggle("correct-letter", Boolean(slot.textContent));
      slot.setAttribute("aria-label", slot.textContent || "blank");
      elements.wordSlots.appendChild(slot);
    });
  }

  function renderMisses() {
    elements.misses.textContent = state.guesses.filter((letter) => !word.includes(letter)).join(" ");
  }

  function renderKeyboard() {
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
    elements.message.className = "message";
    elements.answer.hidden = true;
    elements.answer.textContent = "";

    if (state.status === "won") {
      elements.message.textContent = `You found it in ${state.wrongGuesses} ${missLabel(state.wrongGuesses)}. Nicely done.`;
      elements.message.classList.add("win");
      return;
    }

    if (state.status === "lost") {
      elements.message.textContent = "That was the last part. Tomorrow brings another word.";
      elements.message.classList.add("lose");
      elements.answer.textContent = `Today's word was ${word}.`;
      elements.answer.hidden = false;
      return;
    }

    const remaining = MAX_MISSES - state.wrongGuesses;
    elements.message.textContent = `${remaining} ${missLabel(remaining)} left.`;
  }

  function missLabel(count) {
    return count === 1 ? "miss" : "misses";
  }

  function loadStats() {
    const freshStats = {
      played: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: createEmptyDistribution(),
      recentResults: [],
      completedDates: {}
    };

    try {
      const saved = JSON.parse(localStorage.getItem(STATS_KEY));
      const stats = {
        ...freshStats,
        ...saved,
        recentResults: Array.isArray(saved && saved.recentResults) ? saved.recentResults : Array.isArray(saved && saved.recent) ? saved.recent : [],
        completedDates: saved && saved.completedDates && typeof saved.completedDates === "object" ? saved.completedDates : {}
      };

      stats.recentResults = normalizeResultList(stats.recentResults);
      stats.completedDates = normalizeCompletedDates(stats.completedDates, stats.recentResults);
      rebuildStatsFromResults(stats);
      return stats;
    } catch {
      return freshStats;
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {}
  }

  function createEmptyDistribution() {
    return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, X: 0 };
  }

  function normalizeResultList(results) {
    return results
      .filter((result) => result && typeof result === "object")
      .map((result) => {
        const status = result.status === "won" ? "won" : result.status === "lost" ? "lost" : "playing";
        const misses = status === "won" ? Math.max(0, Math.min(9, Number(result.misses) || 0)) : MAX_MISSES;

        return {
          date: result.date || "",
          puzzleNumber: Number(result.puzzleNumber) || 0,
          status,
          misses,
          label: status === "won" ? `Solved with ${misses} ${missLabel(misses)}` : "Missed"
        };
      })
      .filter((result) => result.date && result.status !== "playing");
  }

  function normalizeCompletedDates(completedDates, recentResults) {
    const normalized = {};

    Object.keys(completedDates || {}).forEach((date) => {
      const result = normalizeResultList([{ ...completedDates[date], date }])[0];
      if (result) {
        normalized[date] = result;
      }
    });

    recentResults.forEach((result) => {
      if (!normalized[result.date]) {
        normalized[result.date] = result;
      }
    });

    return normalized;
  }

  function rebuildStatsFromResults(stats) {
    const results = Object.values(stats.completedDates || {})
      .filter((result) => result && result.status !== "playing")
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    stats.played = results.length;
    stats.wins = results.filter((result) => result.status === "won").length;
    stats.losses = results.filter((result) => result.status === "lost").length;
    stats.distribution = createEmptyDistribution();
    stats.currentStreak = 0;
    stats.bestStreak = 0;

    results
      .slice()
      .reverse()
      .forEach((result) => {
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
    const stats = loadStats();
    const currentResult = getCurrentResult();
    const winPercent = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

    elements.statsResult.textContent = currentResult.label;
    elements.statsResult.classList.toggle("win", currentResult.status === "won");
    elements.statsTiles.innerHTML = [
      createStatTile("Played", stats.played),
      createStatTile("Win %", winPercent),
      createStatTile("Streak", stats.currentStreak),
      createStatTile("Best", stats.bestStreak)
    ].join("");

    renderDistribution(stats, currentResult);
    renderRecentResults(stats);
  }

  function createStatTile(label, value) {
    return `<div class="stat-tile"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
  }

  function getCurrentResult() {
    if (state.status === "won") {
      return { status: "won", key: String(state.wrongGuesses), label: `Solved with ${state.wrongGuesses} ${missLabel(state.wrongGuesses)}` };
    }

    if (state.status === "lost") {
      return { status: "lost", key: "X", label: "Missed" };
    }

    return { status: "playing", key: "", label: "Finish today’s puzzle to add a result." };
  }

  function renderDistribution(stats, currentResult) {
    const labels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "X"];
    const highest = Math.max(1, ...labels.map((label) => Number(stats.distribution[label]) || 0));

    elements.guessDistribution.innerHTML = labels
      .map((label) => {
        const count = Number(stats.distribution[label]) || 0;
        const width = Math.max(7, Math.round((count / highest) * 100));
        return `<div class="distribution-row${currentResult.key === label ? " today" : ""}${label === "X" ? " missed" : ""}"><span class="distribution-label">${label}</span><div class="bar-track" aria-label="${label === "X" ? "Missed" : `${label} misses`}: ${count}"><div class="bar-fill" style="width:${width}%"></div></div><span class="distribution-count">${count}</span></div>`;
      })
      .join("");
  }

  function renderRecentResults(stats) {
    if (!stats.recentResults.length) {
      elements.recentResults.innerHTML = '<p class="share-status">No finished games yet.</p>';
      return;
    }

    elements.recentResults.innerHTML = stats.recentResults
      .slice(0, 12)
      .map((result) => {
        const won = result.status === "won";
        const compact = won ? `✓${result.misses}` : "✕";
        const helper = result.label || (won ? `Solved with ${result.misses} ${missLabel(result.misses)}` : "Missed");
        return `<span class="recent-result ${won ? "win" : "loss"}" title="${helper}">${compact} <span class="recent-text">${helper}</span><span class="recent-helper">${helper}</span></span>`;
      })
      .join("");
  }

  function openStatsModal() {
    renderStatsContent();
    elements.statsModal.hidden = false;
    elements.statsModal.setAttribute("aria-hidden", "false");
  }

  function closeStatsModal() {
    elements.statsModal.hidden = true;
    elements.statsModal.setAttribute("aria-hidden", "true");
  }

  function resetStats() {
    if (!window.confirm("Reset all Hangman stats on this browser?")) {
      return;
    }

    try {
      localStorage.removeItem(STATS_KEY);
      state.statsSaved = false;
      saveState();
    } catch {}

    renderStatsContent();
  }

  async function shareResult(statusElement) {
    const shareText = getShareText();

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(shareText);
      statusElement.textContent = "Result copied to clipboard.";
    } catch {
      statusElement.textContent = shareText;
    }
  }

  function getShareText() {
    const solved = state.status === "won";
    const missesCount = solved ? state.wrongGuesses : MAX_MISSES;
    const greenCount = solved ? MAX_MISSES - missesCount : 0;
    const squares = Array.from({ length: MAX_MISSES }, (_, index) => index < greenCount ? "🟩" : "🟥").join("");
    const resultLine = solved ? `Solved with ${missesCount} ${missLabel(missesCount)}` : "Missed";

    return [`Beth’s Hangman #${puzzleNumber}`, resultLine, squares, "", SITE_URL].join("\n");
  }

  function showLoadError(error) {
    elements.message.textContent = "The puzzle could not load words.json. Please check the word list and refresh.";
    elements.message.classList.add("lose");
    console.error(error);
  }
})();
