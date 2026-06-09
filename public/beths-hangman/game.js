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
const word = (DEV_OVERRIDE.word || getDailyWord(todayKey)).toUpperCase();
const storageKey = `daily-hangman:${todayKey}`;
let state = loadState();

dateLabel.textContent = formatToday();
buildKeyboard();
render();

setInterval(() => {
  if (!DEV_OVERRIDE.date && getTodayKey() !== todayKey) {
    window.location.reload();
  }
}, 60000);

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
    return;
  }

  if (state.status === "lost") {
    message.textContent = "That was the last part. Tomorrow brings another word.";
    message.classList.add("lose");
    answer.textContent = `Today's word was ${word}.`;
    answer.hidden = false;
    return;
  }

  const remaining = MAX_WRONG_GUESSES - state.wrongGuesses;
  message.textContent = `${remaining} wrong ${pluralize("guess", remaining)} left.`;
}

function pluralize(wordToPluralize, count) {
  return count === 1 ? wordToPluralize : `${wordToPluralize}es`;
}

shareButton.addEventListener("click", async () => {
  const resultMark = state.status === "won" ? "Solved" : state.status === "lost" ? "Missed" : "Playing";
  const shareText = [
    `Beth's Hangman ${todayKey}`,
    `${resultMark} with ${state.wrongGuesses}/${MAX_WRONG_GUESSES} wrong guesses`,
    `Guessed letters: ${state.guesses.length ? state.guesses.join(" ") : "none yet"}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(shareText);
    shareStatus.textContent = "Result copied to clipboard.";
  } catch {
    shareStatus.textContent = shareText;
  }
});
