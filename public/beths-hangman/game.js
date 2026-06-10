(function () {
  "use strict";

  const scriptElement = document.currentScript;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      const replacement = document.createElement("script");
      replacement.src = scriptElement ? scriptElement.src : "game.js";
      document.body.appendChild(replacement);
    });
    return;
  }

  if (window.__bethsHangmanLoaded) {
    return;
  }

  window.__bethsHangmanLoaded = true;

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

  const gameRoot = document.querySelector(".phone-game") || document.body;
  const elements = {
    wordSlots: findOrCreate("#wordSlots", ".word-slots", "div", "wordSlots", "word-slots", ".misses-panel"),
    misses: findOrCreate("#misses", ".misses", "div", "misses", "misses", ".misses-panel"),
    keyboard: findOrCreate("#keyboard", ".keyboard", "div", "keyboard", "keyboard", ".status-panel"),
    message: document.querySelector("#message, .message"),
    answer: findOrCreate("#answer", ".answer", "p", "answer", "answer", ".keyboard"),
    dateLabel: document.querySelector("#dateLabel, .date-label"),
    shareButton: document.querySelector("#shareButton, .share-button"),
    shareStatus: document.querySelector("#shareStatus, .share-status"),
    statsButton: document.querySelector("#statsButton, #openStatsButton, [data-open-stats]"),
    statsModal: document.querySelector("#statsModal, [data-stats-modal]"),
    statsContent: document.querySelector("#statsContent, [data-stats-content]"),
    statsCloseButton: document.querySelector("#statsCloseButton, #closeStatsButton, [data-close-stats]"),
    statsShareButton: document.querySelector("#statsShareButton, #shareStatsButton, [data-stats-share]")
  };

  if (elements.answer) {
    elements.answer.hidden = true;
  }

  let word = "";
  let puzzleNumber = 0;
  let todayKey = "";
  let storageKey = "";
  let state = null;

  init();

  async function init() {
    try {
      const dailyPuzzle = await loadDailyPuzzle();
      word = dailyPuzzle.word;
      puzzleNumber = dailyPuzzle.puzzleNumber;
      todayKey = dailyPuzzle.todayKey;
      storageKey = "beths-hangman:" + todayKey;
      state = loadState();

      if (elements.dateLabel) {
        elements.dateLabel.textContent = formatToday();
      }

      buildKeyboard();
      bindActions();
      render();

      window.setInterval(function () {
        if (!DEV_OVERRIDE.date && getTodayKey() !== todayKey) {
          window.location.reload();
        }
      }, 60000);
    } catch (error) {
      showLoadError(error);
    }
  }

  function findOrCreate(idSelector, classSelector, tagName, id, className, beforeSelector) {
    const found = document.querySelector(idSelector + ", " + classSelector);
    if (found) {
      if (!found.id) {
        found.id = id;
      }
      found.classList.add(className);
      return found;
    }

    const node = document.createElement(tagName);
    node.id = id;
    node.className = className;

    const before = document.querySelector(beforeSelector);
    if (before && before.parentNode) {
      before.parentNode.insertBefore(node, before);
    } else {
      gameRoot.appendChild(node);
    }

    return node;
  }

  async function loadDailyPuzzle() {
    const response = await fetch(new URL("words.json", window.location.href), { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Could not load words.json");
    }

    const data = await response.json();
    const words = normalizeWords(data);
    const dateKey = DEV_OVERRIDE.date || getTodayKey();
    const index = getPuzzleIndex(dateKey, words.length);

    return {
      todayKey: dateKey,
      word: String(DEV_OVERRIDE.word || words[index]).toUpperCase(),
      puzzleNumber: index + 1
    };
  }

  function normalizeWords(data) {
    if (Array.isArray(data)) {
      return data.map(String).filter(Boolean);
    }

    if (data && Array.isArray(data.words)) {
      return data.words.map(String).filter(Boolean);
    }

    throw new Error("words.json must be an array or contain a words array");
  }

  function getPuzzleIndex(dateString, wordCount) {
    const seed = Number(dateString.replace(/-/g, ""));
    return seed % wordCount;
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
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
      status: "playing"
    };

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && saved.date === todayKey && Array.isArray(saved.guesses)) {
        return {
          date: freshState.date,
          guesses: saved.guesses,
          wrongGuesses: Number(saved.wrongGuesses) || 0,
          status: saved.status || "playing"
        };
      }
    } catch (error) {
      try {
        localStorage.removeItem(storageKey);
      } catch (storageError) {
        // Storage can be unavailable in private browsing modes.
      }
    }

    return freshState;
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      // The page-load game still works if localStorage is blocked.
    }
  }

  function buildKeyboard() {
    elements.keyboard.innerHTML = "";

    LETTERS.forEach(function (letter) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.textContent = letter;
      button.setAttribute("aria-label", "Guess " + letter);
      button.addEventListener("click", function () {
        guessLetter(letter);
      });
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
      elements.statsModal.addEventListener("click", function (event) {
        if (event.target === elements.statsModal) {
          closeStatsModal();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeStatsModal();
      }
    });
  }

  function guessLetter(letter) {
    if (state.status !== "playing" || state.guesses.indexOf(letter) !== -1) {
      return;
    }

    state.guesses.push(letter);

    if (word.indexOf(letter) === -1) {
      state.wrongGuesses += 1;
    }

    if (isWordComplete()) {
      state.status = "won";
      updateStats(true);
    } else if (state.wrongGuesses >= MAX_MISSES) {
      state.status = "lost";
      updateStats(false);
    }

    saveState();
    render();
  }

  function isWordComplete() {
    return word.split("").every(function (letter) {
      return state.guesses.indexOf(letter) !== -1;
    });
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

    word.split("").forEach(function (letter) {
      const slot = document.createElement("span");
      slot.className = "slot";
      slot.textContent = state.guesses.indexOf(letter) !== -1 ? letter : "";
      slot.classList.toggle("correct-letter", Boolean(slot.textContent));
      slot.setAttribute("aria-label", slot.textContent || "blank");
      elements.wordSlots.appendChild(slot);
    });
  }

  function renderMisses() {
    const wrongLetters = state.guesses.filter(function (letter) {
      return word.indexOf(letter) === -1;
    });
    elements.misses.textContent = wrongLetters.join(" ");
  }

  function renderKeyboard() {
    elements.keyboard.querySelectorAll(".key").forEach(function (button) {
      const letter = button.textContent;
      const guessed = state.guesses.indexOf(letter) !== -1;

      button.disabled = guessed || state.status !== "playing";
      button.classList.toggle("correct", guessed && word.indexOf(letter) !== -1);
      button.classList.toggle("wrong", guessed && word.indexOf(letter) === -1);
    });
  }

  function renderHangman() {
    PART_CLASSES.forEach(function (className, index) {
      const part = document.querySelector("." + className);
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
    elements.answer.hidden = true;
    elements.answer.textContent = "";

    if (state.status === "won") {
      elements.message.textContent = "You found it in " + state.wrongGuesses + " " + missLabel(state.wrongGuesses) + ". Nicely done.";
      elements.message.classList.add("win");
      return;
    }

    if (state.status === "lost") {
      elements.message.textContent = "That was the last part. Tomorrow brings another word.";
      elements.message.classList.add("lose");
      elements.answer.textContent = "Today's word was " + word + ".";
      elements.answer.hidden = false;
      return;
    }

    const remaining = MAX_MISSES - state.wrongGuesses;
    elements.message.textContent = remaining + " " + missLabel(remaining) + " left.";
  }

  function missLabel(count) {
    return count === 1 ? "miss" : "misses";
  }

  function updateStats(won) {
    const stats = loadStats();

    if (stats.lastCompletedDate === todayKey) {
      return;
    }

    stats.played += 1;
    stats.currentStreak = won ? stats.currentStreak + 1 : 0;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    stats.lastCompletedDate = todayKey;

    if (won) {
      stats.won += 1;
    }

    saveStats(stats);
  }

  function loadStats() {
    const freshStats = {
      played: 0,
      won: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDate: ""
    };

    try {
      const saved = JSON.parse(localStorage.getItem("beths-hangman:stats"));
      if (!saved) {
        return freshStats;
      }

      return {
        played: Number(saved.played) || 0,
        won: Number(saved.won) || 0,
        currentStreak: Number(saved.currentStreak) || 0,
        bestStreak: Number(saved.bestStreak) || 0,
        lastCompletedDate: saved.lastCompletedDate || ""
      };
    } catch (error) {
      return freshStats;
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem("beths-hangman:stats", JSON.stringify(stats));
    } catch (error) {
      // Stats are optional if storage is blocked.
    }
  }

  function renderStatsContent() {
    if (!elements.statsContent) {
      return;
    }

    const stats = loadStats();
    const winPercent = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

    elements.statsContent.innerHTML =
      '<dl class="stats-grid">' +
      "<div><dt>Played</dt><dd>" + stats.played + "</dd></div>" +
      "<div><dt>Won</dt><dd>" + winPercent + "%</dd></div>" +
      "<div><dt>Streak</dt><dd>" + stats.currentStreak + "</dd></div>" +
      "<div><dt>Best</dt><dd>" + stats.bestStreak + "</dd></div>" +
      "</dl>";
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
    } catch (error) {
      setShareStatus(shareText);
    }
  }

  function getShareText() {
    const solved = state.status === "won";
    const result = solved ? "Solved" : "Missed";
    const missesCount = solved ? state.wrongGuesses : MAX_MISSES;
    const greenCount = solved ? MAX_MISSES - missesCount : 0;
    let squares = "";

    for (let index = 0; index < MAX_MISSES; index += 1) {
      squares += index < greenCount ? "🟩" : "🟥";
    }

    return [
      "Beth’s Hangman #" + puzzleNumber,
      result + " with " + missesCount + " " + missLabel(missesCount),
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
      elements.message.textContent = "The puzzle could not load. Please refresh the page.";
      elements.message.classList.add("lose");
    }

    console.error(error);
  }
})();
