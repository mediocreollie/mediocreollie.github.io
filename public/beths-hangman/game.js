(function () {
  "use strict";

  const MAX_MISSES = 10;
  const SITE_URL = "olliewritesthings.com/beths-hangman/";
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

  const DEV_OVERRIDE = {
    // date: "2026-06-09",
    // word: "ASTRO"
  };

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

    if (!elements.wordSlots || !elements.keyboard) {
      return;
    }

    try {
      const puzzle = await loadDailyPuzzle();
      word = puzzle.word;
      puzzleNumber = puzzle.puzzleNumber;
      todayKey = puzzle.todayKey;
      storageKey = `beths-hangman:${todayKey}`;
      state = loadState();

      ensureStatsModal();
      recordLoadedCompletedGame();

      if (elements.dateLabel) {
        elements.dateLabel.textContent = formatToday();
      }

      buildKeyboard();
      bindActions();
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
      statsButton: document.querySelector("#statsButton, #openStatsButton, .stats-button, [data-open-stats]") || findButtonByText("stats"),
      statsModal: document.querySelector("#statsModal, [data-stats-modal]"),
      statsContent: document.querySelector("#statsContent, [data-stats-content]"),
      statsCloseButton: document.querySelector("#statsCloseButton, #closeStatsButton, [data-close-stats]"),
      statsShareButton: document.querySelector("#statsShareButton, #shareStatsButton, [data-stats-share]")
    };
  }

  function findButtonByText(text) {
    const target = text.toLowerCase();
    return Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent.trim().toLowerCase() === target
    );
  }

  async function loadDailyPuzzle() {
    const dateKey = DEV_OVERRIDE.date || getTodayKey();
    const words = await loadWords();
    const index = getPuzzleIndex(dateKey, words.length);
    const entry = words[index];

    return {
      todayKey: dateKey,
      word: cleanWord(DEV_OVERRIDE.word || entry.word),
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
    const rawWords = getRawWords(data);
    const words = rawWords
      .map((entry, index) => {
        if (typeof entry === "string") {
          return { word: entry, number: index + 1 };
        }

        if (entry && typeof entry === "object") {
          return {
            word: getWordFromObject(entry),
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

  function getRawWords(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (!data || typeof data !== "object") {
      return [];
    }

    if (Array.isArray(data.words)) {
      return data.words;
    }

    if (Array.isArray(data.puzzles)) {
      return data.puzzles;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    return Object.values(data);
  }

  function getWordFromObject(entry) {
    return (
      entry.word ||
      entry.answer ||
      entry.solution ||
      entry.value ||
      entry.text ||
      entry.name ||
      Object.values(entry).find((value) => typeof value === "string") ||
      ""
    );
  }

  function cleanWord(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-z]/gi, "")
      .toUpperCase();
  }

  function getPuzzleIndex(dateString, wordCount) {
    return (getPuzzleNumber(dateString) - 1) % wordCount;
  }

  function getPuzzleNumber(dateString) {
    const start = new Date("2026-06-09T00:00:00");
    const current = new Date(`${dateString}T00:00:00`);
    const daysSinceStart = Math.floor((current - start) / 86400000);

    return Math.max(1, daysSinceStart + 1);
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatToday() {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    }).format(new Date());
  }

  function loadState() {
    const freshState = {
      date: todayKey,
      guesses: [],
      wrongGuesses: 0,
      status: "playing",
      statsSaved: false
    };

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
      } catch {
        // Storage can be unavailable in private browsing modes.
      }
    }

    return freshState;
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The current page-load game still works if storage is blocked.
    }
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
    if (elements.shareButton) {
      elements.shareButton.addEventListener("click", shareResult);
    }

    if (elements.statsShareButton) {
      elements.statsShareButton.addEventListener("click", shareResult);
    }

    if (elements.statsButton) {
      elements.statsButton.addEventListener("click", openStatsModal);
    }

    if (elements.statsCloseButton) {
      elements.statsCloseButton.addEventListener("click", closeStatsModal);
    }

    if (elements.statsModal) {
      elements.statsModal.addEventListener("click", (event) => {
        if (event.target === elements.statsModal) {
          closeStatsModal();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeStatsModal();
      }
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }

      if (button.matches("#statsButton, #openStatsButton, .stats-button, [data-open-stats]") || button.textContent.trim().toLowerCase() === "stats") {
        openStatsModal();
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
    }

    saveState();
    render();
  }

  function finishGame(status) {
    state.status = status;

    if (!state.statsSaved) {
      updateStats(status === "won");
      state.statsSaved = true;
    }

    setTimeout(openStatsModal, 120);
  }

  function recordLoadedCompletedGame() {
    if (!state || state.statsSaved || state.status === "playing") {
      return;
    }

    updateStats(state.status === "won");
    state.statsSaved = true;
    saveState();
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
    if (elements.misses) {
      elements.misses.textContent = state.guesses.filter((letter) => !word.includes(letter)).join(" ");
    }
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

  function missLabel(count) {
    return count === 1 ? "miss" : "misses";
  }

  function ensureStatsModal() {
    if (!elements.statsButton) {
      return;
    }

    if (!elements.statsModal) {
      const modal = document.createElement("div");
      modal.id = "statsModal";
      modal.className = "stats-modal";
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `
        <div class="stats-card" role="dialog" aria-modal="true" aria-labelledby="statsTitle">
          <h2 id="statsTitle">Stats</h2>
          <div id="statsContent"></div>
          <div class="stats-actions">
            <button id="statsShareButton" type="button">Share result</button>
            <button id="statsCloseButton" type="button">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    elements.statsModal = document.querySelector("#statsModal, [data-stats-modal]");
    elements.statsContent = document.querySelector("#statsContent, [data-stats-content]");
    elements.statsCloseButton = document.querySelector("#statsCloseButton, #closeStatsButton, [data-close-stats]");
    elements.statsShareButton = document.querySelector("#statsShareButton, #shareStatsButton, [data-stats-share]");
    ensureStatsStyles();
  }

  function ensureStatsStyles() {
    if (document.querySelector("#bethsHangmanStatsStyles")) {
      return;
    }

    const styles = document.createElement("style");
    styles.id = "bethsHangmanStatsStyles";
    styles.textContent = `
      .stats-modal[hidden] { display: none; }
      .stats-modal {
        position: fixed;
        inset: 0;
        z-index: 10;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.72);
      }
      .stats-card {
        width: min(18rem, 92vw);
        padding: 1rem;
        background: #fff;
        border: 4px solid #080808;
        border-radius: 18px;
        box-shadow: 6px 8px 0 #080808;
        text-align: center;
      }
      .stats-card h2 {
        margin: 0 0 0.75rem;
        font-size: 1.25rem;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem;
        margin: 0;
      }
      .stats-grid div {
        border: 3px solid #080808;
        border-radius: 10px;
        padding: 0.45rem;
      }
      .stats-grid dt {
        font-size: 0.75rem;
      }
      .stats-grid dd {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 900;
      }
      .stats-actions {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.85rem;
      }
      .stats-actions button {
        min-height: 40px;
        padding: 0 0.75rem;
        border: 3px solid #080808;
        border-radius: 9px;
        background: #fff;
        font-weight: 900;
        cursor: pointer;
      }
    `;
    document.head.appendChild(styles);
  }

  function loadStats() {
    const freshStats = {
      played: 0,
      won: 0,
      currentStreak: 0,
      bestStreak: 0
    };

    try {
      const saved = JSON.parse(localStorage.getItem("beths-hangman:stats"));
      return {
        played: Number(saved && saved.played) || 0,
        won: Number(saved && saved.won) || 0,
        currentStreak: Number(saved && saved.currentStreak) || 0,
        bestStreak: Number(saved && saved.bestStreak) || 0
      };
    } catch {
      return freshStats;
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem("beths-hangman:stats", JSON.stringify(stats));
    } catch {
      // Stats are optional if storage is blocked.
    }
  }

  function updateStats(won) {
    const stats = loadStats();
    stats.played += 1;

    if (won) {
      stats.won += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    } else {
      stats.currentStreak = 0;
    }

    saveStats(stats);
  }

  function renderStatsContent() {
    if (!elements.statsContent) {
      return;
    }

    const stats = loadStats();
    const winPercent = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

    elements.statsContent.innerHTML = `
      <dl class="stats-grid">
        <div><dt>Played</dt><dd>${stats.played}</dd></div>
        <div><dt>Won</dt><dd>${winPercent}%</dd></div>
        <div><dt>Streak</dt><dd>${stats.currentStreak}</dd></div>
        <div><dt>Best</dt><dd>${stats.bestStreak}</dd></div>
      </dl>
    `;
  }

  function openStatsModal() {
    if (!elements.statsModal) {
      return;
    }

    renderStatsContent();
    elements.statsModal.hidden = false;
    elements.statsModal.setAttribute("aria-hidden", "false");
  }

  function closeStatsModal() {
    if (!elements.statsModal) {
      return;
    }

    elements.statsModal.hidden = true;
    elements.statsModal.setAttribute("aria-hidden", "true");
  }

  async function shareResult() {
    const shareText = getShareText();

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(shareText);
      setShareStatus("Result copied to clipboard.");
    } catch {
      setShareStatus(shareText);
    }
  }

  function getShareText() {
    const solved = state.status === "won";
    const missesCount = solved ? state.wrongGuesses : MAX_MISSES;
    const greenCount = solved ? MAX_MISSES - missesCount : 0;
    const squares = Array.from({ length: MAX_MISSES }, (_, index) =>
      index < greenCount ? "🟩" : "🟥"
    ).join("");

    const resultLine = solved
      ? `Solved with ${missesCount} ${missLabel(missesCount)}`
      : "Missed";

    return [
      `Beth’s Hangman #${puzzleNumber}`,
      resultLine,
      squares,
      "",
      SITE_URL
    ].join("\n");
  }

  function setShareStatus(text) {
    if (elements.shareStatus) {
      elements.shareStatus.textContent = text;
    }
  }

  function showLoadError(error) {
    if (elements.message) {
      elements.message.textContent = "The puzzle could not load words.json. Please check the word list and refresh.";
      elements.message.classList.add("lose");
    }

    console.error(error);
  }
})();
