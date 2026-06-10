const WORDS = [
  "anchor",
  "bakery",
  "blanket",
  "breeze",
  "candle",
  "canyon",
  "castle",
  "coffee",
  "copper",
  "daisy",
  "drift",
  "ember",
  "fabric",
  "forest",
  "garden",
  "ginger",
  "harbor",
  "honest",
  "jacket",
  "journal",
  "kettle",
  "lantern",
  "letter",
  "meadow",
  "mellow",
  "mirror",
  "museum",
  "napkin",
  "orchard",
  "parcel",
  "pepper",
  "pillow",
  "pocket",
  "quartz",
  "ribbon",
  "saddle",
  "silver",
  "sketch",
  "sunlit",
  "teapot",
  "thread",
  "velvet",
  "violet",
  "wander",
  "window",
  "winter",
  "yellow",
  "zipper"
];

const MAX_WRONG_GUESSES = 10;
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

const wordSlots = document.querySelector("#wordSlots");
const misses = document.querySelector("#misses");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const answer = document.querySelector("#answer");
const dateLabel = document.querySelector("#dateLabel");
const shareButton = document.querySelector("#shareButton");
const shareStatus = document.querySelector("#shareStatus");

// Developer testing helper:
// Uncomment either value while developing, then comment it again before publishing.
const DEV_OVERRIDE = {
  // date: "2026-06-09",
  // word: "ASTRO"
};

const todayKey = DEV_OVERRIDE.date || getTodayKey();
let word = "";
const storageKey = `daily-hangman:${todayKey}`;
let state;

dateLabel.textContent = formatToday();
buildKeyboard();
initGame();

setInterval(() => {
  if (!DEV_OVERRIDE.date && getTodayKey() !== todayKey) {
    window.location.reload();
  }
}, 60000);

async function initGame() {
  const selectedWord = DEV_OVERRIDE.word
    ? DEV_OVERRIDE.word
    : await fetchDailyWord(todayKey);

  word = (selectedWord || getDailyWord(todayKey)).toUpperCase();
  state = loadState();
  render();
}

async function fetchDailyWord(dateString) {
  try {
    const response = await fetch('./words.json');
    if (!response.ok) {
      console.warn('Could not load words.json; using the internal word list.');
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn('words.json is not a valid array; using the internal word list.');
      return null;
    }

    const entry = data.find(
      (item) => item && item.date === dateString && typeof item.word === 'string'
    );

    return entry ? entry.word : null;
  } catch (error) {
    console.warn('Could not load words.json; using the internal word list.', error);
    return null;
  }
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDailyWord(dateString) {
  const seed = Number(dateString.replace(/-/g, ""));
  return WORDS[seed % WORDS.length].toUpperCase();
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
        ...freshState,
        guesses: saved.guesses,
        wrongGuesses: Number(saved.wrongGuesses) || 0,
        status: saved.status || "playing"
      };
    }
  } catch {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Some private browsing modes block storage access entirely.
    }
  }

  return freshState;
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The game still works for the current page load if storage is unavailable.
  }
}

function buildKeyboard() {
  keyboard.innerHTML = "";

  LETTERS.forEach((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key";
    button.textContent = letter;
    button.setAttribute("aria-label", `Guess ${letter}`);
    button.addEventListener("click", () => guessLetter(letter));
    keyboard.appendChild(button);
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
    state.status = "won";
  } else if (state.wrongGuesses >= MAX_WRONG_GUESSES) {
    state.status = "lost";
  }

  saveState();
  render();
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
}

function renderWord() {
  wordSlots.innerHTML = "";

  word.split("").forEach((letter) => {
    const slot = document.createElement("span");
    slot.className = "slot";
    slot.textContent = state.guesses.includes(letter) ? letter : "";
    slot.classList.toggle("correct-letter", Boolean(slot.textContent));
    slot.setAttribute("aria-label", slot.textContent || "blank");
    wordSlots.appendChild(slot);
  });
}

function renderMisses() {
  const wrongLetters = state.guesses.filter((letter) => !word.includes(letter));
  misses.textContent = wrongLetters.join(" ");
}

function renderKeyboard() {
  document.querySelectorAll(".key").forEach((button) => {
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
    part.classList.toggle("visible", index < state.wrongGuesses);
  });
}

function renderMessage() {
  message.className = "message";
  answer.hidden = true;
  answer.textContent = "";

  if (state.status === "won") {
    message.textContent = `You found it in ${state.wrongGuesses} wrong ${pluralize("guess", state.wrongGuesses)}. Nicely done.`;
    message.classList.add("win");
    saveResult(todayKey, "won", state.wrongGuesses);
    setTimeout(() => openStatsModal(), 100);
    return;
  }

  if (state.status === "lost") {
    message.textContent = "That was the last part. Tomorrow brings another word.";
    message.classList.add("lose");
    answer.textContent = `Today's word was ${word}.`;
    answer.hidden = false;
    saveResult(todayKey, "lost", state.wrongGuesses);
    setTimeout(() => openStatsModal(), 100);
    return;
  }

  const remaining = MAX_WRONG_GUESSES - state.wrongGuesses;
  message.textContent = `${remaining} wrong ${pluralize("guess", remaining)} left.`;
}

function pluralize(wordToPluralize, count) {
  return count === 1 ? wordToPluralize : `${wordToPluralize}es`;
}

const STATS_KEY = "hangman-stats";
const PUZZLE_START_DATE = "2026-06-09";
const GAME_URL = "https://olliewritesthings.com/beths-hangman/";
let statsModalOpenedToday = false;

function getStats() {
  const defaultStats = {
    played: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalMisses: 0,
    guessDistribution: {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
      5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0
    },
    recentResults: []
  };

  try {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultStats,
        ...parsed,
        guessDistribution: { ...defaultStats.guessDistribution, ...parsed.guessDistribution }
      };
    }
  } catch (error) {
    console.warn("Could not load stats from localStorage", error);
  }

  return defaultStats;
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn("Could not save stats to localStorage", error);
  }
}

function saveResult(date, status, misses) {
  const stats = getStats();
  
  const existingIndex = stats.recentResults.findIndex(r => r.date === date);
  if (existingIndex !== -1) {
    return;
  }

  const result = { date, status, misses };
  stats.recentResults.unshift(result);
  stats.recentResults = stats.recentResults.slice(0, 10);

  stats.played += 1;
  if (status === "won") {
    stats.wins += 1;
    stats.totalMisses += misses;
    stats.guessDistribution[misses] = (stats.guessDistribution[misses] || 0) + 1;
  } else {
    stats.losses += 1;
    stats.guessDistribution[10] = (stats.guessDistribution[10] || 0) + 1;
  }

  updateStreaks(stats, status, date);
  saveStats(stats);
}

function updateStreaks(stats, status, date) {
  if (status === "won") {
    stats.currentStreak = (stats.currentStreak || 0) + 1;
    if (stats.currentStreak > (stats.bestStreak || 0)) {
      stats.bestStreak = stats.currentStreak;
    }
  } else {
    stats.currentStreak = 0;
  }
}

function openStatsModal() {
 function openStatsModal() {
  const modal = document.querySelector(".stats-modal-overlay");
  if (!modal) return;

  renderStatsContent();
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  statsModalOpenedToday = true;
}

function closeStatsModal() {
  const modal = document.querySelector(".stats-modal-overlay");
  if (!modal) return;

  modal.classList.remove("open");
  document.body.style.overflow = "";
}

function renderStatsContent() {
  const stats = getStats();
  const container = document.querySelector(".stats-content");
  if (!container) return;

  const winPercent = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;

  const resultMessage = state.status === "won"
    ? `Solved with ${state.wrongGuesses} ${pluralize("miss", state.wrongGuesses)}`
    : state.status === "lost"
      ? "Missed with 10 misses"
      : "Today’s puzzle is still in progress.";

  const maxCount = Math.max(...Object.values(stats.guessDistribution), 1);

  const distributionHtml = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((missCount) => {
    const count = stats.guessDistribution[missCount] || 0;
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
    const label = missCount === 10 ? "X" : missCount;
    const isToday =
      stats.recentResults[0] &&
      stats.recentResults[0].date === todayKey &&
      stats.recentResults[0].misses === missCount;

    const highlightClass = isToday ? " highlight-today" : "";

    return `
      <div class="dist-row${highlightClass}">
        <span class="dist-label">${label}</span>
        <div class="dist-bar-container">
          <div class="dist-bar" style="width: ${percentage}%"></div>
        </div>
        <span class="dist-count">${count}</span>
      </div>
    `;
  }).join("");

  const recentHtml = stats.recentResults.slice(0, 3).map((result) => {
    const icon = result.status === "won" ? "✓" : "✗";
    const label = result.status === "won" ? result.misses : "X";
    const text = result.status === "won"
      ? `Solved with ${result.misses} ${pluralize("miss", result.misses)}`
      : "Missed with 10 misses";

    return `
      <div class="recent-result-wrap">
        <span class="recent-result recent-${result.status}" aria-label="${text}">${icon}${label}</span>
        <span class="recent-result-text">${text}</span>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="stats-header">
      <h2>Stats</h2>
      <button class="stats-close" type="button" aria-label="Close stats">✕</button>
    </div>

    <div class="stats-result-message">
      ${resultMessage}
    </div>

    <div class="stats-tiles">
      <div class="stat-tile">
        <div class="stat-value">${stats.played}</div>
        <div class="stat-label">Played</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${winPercent}%</div>
        <div class="stat-label">Win %</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${stats.currentStreak}</div>
        <div class="stat-label">Streak</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${stats.bestStreak}</div>
        <div class="stat-label">Best</div>
      </div>
    </div>

    <div class="stats-section">
      <h3>Guess Distribution</h3>
      <div class="distribution">
        ${distributionHtml}
      </div>
    </div>

    ${recentHtml ? `
      <div class="stats-section">
        <h3>Recent</h3>
        <div class="recent-results">
          ${recentHtml}
        </div>
      </div>
    ` : ""}

    <div class="stats-footer">
      <button class="share-button stats-share" type="button">Share result</button>
      <p class="share-status stats-share-status" role="status" aria-live="polite"></p>
      <button class="stats-button stats-reset" type="button">Reset stats</button>
    </div>
  `;

  const closeBtn = container.querySelector(".stats-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeStatsModal);
  }

  const modalShareBtn = container.querySelector(".stats-share");
  const modalShareStatus = container.querySelector(".stats-share-status");

  if (modalShareBtn && modalShareStatus) {
    modalShareBtn.addEventListener("click", () => {
      shareResult(modalShareStatus);
    });
  }

  const resetBtn = container.querySelector(".stats-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Are you sure? This will permanently delete all your stats.")) {
        try {
          localStorage.removeItem(STATS_KEY);
          location.reload();
        } catch (error) {
          console.warn("Could not reset stats", error);
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const statsButton = document.querySelector(".actions .stats-button");

  if (statsButton) {
    statsButton.addEventListener("click", () => {
      openStatsModal();
    });
  }

  const modal = document.querySelector(".stats-modal-overlay");

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeStatsModal();
      }
    });
  }
});

shareButton.addEventListener("click", () => {
 shareButton.addEventListener("click", () => {
  shareResult(shareStatus);
});

async function shareResult(statusElement) {
  if (!state || state.status === "playing") {
    statusElement.textContent = "Finish today’s puzzle to share your result.";
    return;
  }

  const shareText = buildShareText();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareText);
      statusElement.textContent = "Result copied to clipboard.";
    } else {
      fallbackCopyShareText(shareText, statusElement);
    }
  } catch {
    fallbackCopyShareText(shareText, statusElement);
  }
}

function buildShareText() {
  const puzzleNumber = getPuzzleNumber(todayKey);
  const resultLine = state.status === "won"
    ? `Solved with ${state.wrongGuesses} ${pluralize("miss", state.wrongGuesses)}`
    : "Missed with 10 misses";

  return [
    `Beth’s Hangman #${puzzleNumber}`,
    resultLine,
    buildShareSquares(),
    "",
    "olliewritesthings.com/beths-hangman/"
  ].join("\n");
}

function buildShareSquares() {
  if (state.status === "lost") {
    return "🟥".repeat(MAX_WRONG_GUESSES);
  }

  const savedParts = MAX_WRONG_GUESSES - state.wrongGuesses;
  return "🟩".repeat(savedParts) + "🟥".repeat(state.wrongGuesses);
}

function getPuzzleNumber(dateString) {
  const start = new Date("2026-06-09T00:00:00");
  const current = new Date(`${dateString}T00:00:00`);
  const daysSinceStart = Math.floor((current - start) / 86400000);

  return Math.max(1, daysSinceStart + 1);
}

function fallbackCopyShareText(text, statusElement) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
    statusElement.textContent = "Result copied to clipboard.";
  } catch {
    statusElement.textContent = text;
  }

  document.body.removeChild(textarea);
}
