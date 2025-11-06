// ===============================
// 🐾 PETSY MINIGAMES.JS — with dynamic re-randomizing on Play Again
// ===============================

const backendUrl = "http://127.0.0.1:5000";
const pet_id = localStorage.getItem("pet_id") || 1;

// short selectors
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Elements
const petCoinsEl = $("#petCoins");
const popupToast = $("#popupMessage");
const gamePanel = $("#gamePanel");
const gameBody = $("#gameBody");
const gameTitle = $("#gameTitle");
const closePanelBtn = $("#closePanel");
const playAgainBtn = $("#playAgain");
const claimRewardBtn = $("#claimReward");
const gameResultEl = $("#gameResult");

let currentGame = null; // 🆕 track which game is active

// ==== Added helpers ====
function disableInteractive() {
  $$(".choice-btn").forEach((b) => {
    b.disabled = true;
    b.classList.add("disabled");
    b.style.opacity = "0.6";
    b.style.cursor = "not-allowed";
  });
  const inputs = gameBody.querySelectorAll("input");
  inputs.forEach((i) => {
    i.disabled = true;
    i.style.opacity = "0.8";
  });
  const inlineBtns = gameBody.querySelectorAll("#guessBtn, #mathBtn");
  inlineBtns.forEach((b) => {
    b.disabled = true;
    b.style.opacity = "0.6";
    b.style.cursor = "not-allowed";
  });
}

function enableInteractive() {
  $$(".choice-btn").forEach((b) => {
    b.disabled = false;
    b.classList.remove("disabled");
    b.style.opacity = "";
    b.style.cursor = "";
  });
  const inputs = gameBody.querySelectorAll("input");
  inputs.forEach((i) => {
    i.disabled = false;
    i.style.opacity = "";
  });
  const inlineBtns = gameBody.querySelectorAll("#guessBtn, #mathBtn");
  inlineBtns.forEach((b) => {
    b.disabled = false;
    b.style.opacity = "";
    b.style.cursor = "";
  });
}
// ========================

// Load coins
async function loadPetCoins() {
  try {
    const res = await fetch(`${backendUrl}/get_pet_by_id/${pet_id}`);
    if (!res.ok) throw new Error(`get_pet_by_id failed: ${res.status}`);
    const data = await res.json();
    if (petCoinsEl) petCoinsEl.textContent = `Your Coins: ${data.coins ?? 0} 🪙`;
    console.log("pet coins loaded:", data.coins);
  } catch (err) {
    console.error("loadPetCoins error:", err);
    if (petCoinsEl) petCoinsEl.textContent = "Your Coins: 0 🪙";
  }
}


// Load game stats
async function loadGameStats() {
  try {
    const res = await fetch(`${backendUrl}/get_game_stats/${pet_id}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`get_game_stats failed: ${res.status}`);
    const data = await res.json();

    const easyRaw = data.easy_wins ?? 0;
    const mediumRaw = data.medium_wins ?? 0;
    const hardRaw = data.hard_wins ?? 0;

    const easy = easyRaw % 10 || (easyRaw === 0 ? 0 : 10);
    const medium = mediumRaw % 10 || (mediumRaw === 0 ? 0 : 10);
    const hard = hardRaw % 10 || (hardRaw === 0 ? 0 : 10);

    $("#easyWins").textContent = `Easy Wins: ${easy} / 10 🎁 Small Treat`;
    $("#mediumWins").textContent = `Medium Wins: ${medium} / 10 🎁 Medium Treat`;
    $("#hardWins").textContent = `Hard Wins: ${hard} / 10 🎁 Large Treat`;

    if (easyRaw > 0 && easyRaw % 10 === 0)
      showToast("🎁 You earned a Small Treat for 10 Easy Wins!");
    if (mediumRaw > 0 && mediumRaw % 10 === 0)
      showToast("🎁 You earned a Medium Treat for 10 Medium Wins!");
    if (hardRaw > 0 && hardRaw % 10 === 0)
      showToast("🎁 You earned a Large Treat for 10 Hard Wins!");

    console.log("Game stats loaded", data);
  } catch (err) {
    console.error("loadGameStats error:", err);
  }
}

// Record win
async function recordWin(difficulty) {
  try {
    const res = await fetch(`${backendUrl}/record_game_win/${pet_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`record_game_win failed: ${res.status} ${txt}`);
    }
    const data = await res.json();
    if (data.success) {
      await new Promise((r) => setTimeout(r, 220));
      await loadGameStats();
      await loadPetCoins();
      if (data.treat) showToast(`🎉 You earned a free ${data.treat} treat!`);
      return data;
    } else {
      showToast("⚠️ Couldn't record win.");
      return data;
    }
  } catch (err) {
    console.error("recordWin error:", err);
    showToast("⚠️ Could not record win. Check console.");
    return { success: false };
  }
}

// Toast
let toastTimer = null;
function showToast(msg, ms = 2200) {
  if (!popupToast) return alert(msg);
  popupToast.textContent = msg;
  popupToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    popupToast.classList.remove("show");
  }, ms);
}

// Panel helpers
function openPanel(title) {
  if (!gamePanel) return;
  gameTitle.textContent = title;
  gamePanel.classList.remove("hidden");
  gameResultEl.textContent = "";
  playAgainBtn.classList.add("hidden");
  claimRewardBtn.classList.remove("hidden");
  enableInteractive();
}

function closePanel() {
  if (!gamePanel) return;
  gamePanel.classList.add("hidden");
  gameBody.innerHTML = `<p class="muted">Choose a game on the left to begin — results and actions appear here.</p>`;
  gameResultEl.textContent = "";
  currentGame = null;
}

function renderChoices(html) {
  gameBody.innerHTML = html;
}

// ===============================
// GAME LOGICS
// ===============================
function startEasyGame() {
  currentGame = "easy";
  const correct = Math.random() < 0.5 ? "heads" : "tails";
  openPanel("🪙 Heads or Tails");
  renderChoices(`
    <p>Pick heads or tails — win a small coin reward!</p>
    <div class="choice-row">
      <button class="choice-btn" data-choice="heads">Heads</button>
      <button class="choice-btn" data-choice="tails">Tails</button>
    </div>
  `);

  const choices = gameBody.querySelectorAll(".choice-btn");
  choices.forEach((b) =>
    b.addEventListener(
      "click",
      async () => {
        const choice = b.dataset.choice;
        if (choice === correct) {
          gameResultEl.textContent = "🎉 You won!";
          showToast("🎉 Correct — you won!");
          await recordWin("easy");
        } else {
          gameResultEl.textContent = `😢 You lost — it was ${correct}.`;
          showToast(`😢 It was ${correct}.`);
        }
        disableInteractive();
        playAgainBtn.classList.remove("hidden");
      },
      { once: true }
    )
  );
}

function startMediumGame() {
  currentGame = "medium";
  const number = Math.floor(Math.random() * 3) + 1;
  openPanel("🎯 Guess the Number (1–3)");
  renderChoices(`
    <p>Guess a number from <strong>1</strong> to <strong>3</strong>:</p>
    <div class="input-inline">
      <input id="guessInput" type="number" min="1" max="3" placeholder="1" aria-label="Guess number 1 to 3"/>
      <button id="guessBtn" class="choice-btn">Guess</button>
    </div>
  `);

  const guessBtn = gameBody.querySelector("#guessBtn");
  const guessInput = gameBody.querySelector("#guessInput");
  guessBtn?.addEventListener(
    "click",
    async () => {
      const val = parseInt(guessInput.value, 10);
      if (!Number.isFinite(val) || val < 1 || val > 3) {
        showToast("Enter a number between 1 and 3");
        return;
      }
      if (val === number) {
        gameResultEl.textContent = "🎉 Correct!";
        showToast("🎉 Correct!");
        await recordWin("medium");
      } else {
        gameResultEl.textContent = `😢 Wrong — it was ${number}.`;
        showToast(`😢 It was ${number}.`);
      }
      disableInteractive();
      playAgainBtn.classList.remove("hidden");
    },
    { once: true }
  );
}

function startHardGame() {
  currentGame = "hard";
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const c = Math.floor(Math.random() * 10) + 1;
  const sum = a + b + c;
  openPanel("🧮 Add 3 Numbers");
  renderChoices(`
    <p class="muted">${a} + ${b} + ${c} = ?</p>
    <div class="input-inline">
      <input id="mathInput" type="number" placeholder="0" aria-label="Sum of three numbers"/>
      <button id="mathBtn" class="choice-btn">Submit</button>
    </div>
  `);

  const mathBtn = gameBody.querySelector("#mathBtn");
  const mathInput = gameBody.querySelector("#mathInput");
  mathBtn?.addEventListener(
    "click",
    async () => {
      const val = parseInt(mathInput.value, 10);
      if (!Number.isFinite(val)) {
        showToast("Enter a valid number");
        return;
      }
      if (val === sum) {
        gameResultEl.textContent = "🎉 Correct!";
        showToast("🎉 Correct!");
        await recordWin("hard");
      } else {
        gameResultEl.textContent = `😢 Wrong! It was ${sum}.`;
        showToast(`😢 Wrong! It was ${sum}.`);
      }
      disableInteractive();
      playAgainBtn.classList.remove("hidden");
    },
    { once: true }
  );
}

// ===============================
// DOMContentLoaded
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  loadPetCoins();
  loadGameStats();

  $("#easyGame")?.addEventListener("click", startEasyGame);
  $("#mediumGame")?.addEventListener("click", startMediumGame);
  $("#hardGame")?.addEventListener("click", startHardGame);

  closePanelBtn?.addEventListener("click", closePanel);
  $("#backToPetMenu")?.addEventListener("click", () => (window.location.href = "main.html"));

  // 🆕 Updated play again: restart the same game type fresh
  playAgainBtn?.addEventListener("click", () => {
    enableInteractive();
    gameResultEl.textContent = "";
    playAgainBtn.classList.add("hidden");
    if (currentGame === "easy") startEasyGame();
    else if (currentGame === "medium") startMediumGame();
    else if (currentGame === "hard") startHardGame();
    else showToast("Choose a game first!");
  });

  // claimRewardBtn now acts as cancel
  if (claimRewardBtn) {
    claimRewardBtn.textContent = "Cancel Game";
    claimRewardBtn.addEventListener("click", () => {
      closePanel();
      showToast("Game cancelled.");
    });
  }

  // debug missing element warnings
  if (!$("#easyGame")) console.warn("easyGame button not found");
  if (!$("#mediumGame")) console.warn("mediumGame button not found");
  if (!$("#hardGame")) console.warn("hardGame button not found");
  if (!$("#gamePanel")) console.warn("gamePanel element not found");
  if (!$("#popupMessage")) console.warn("popupMessage element not found");
});
