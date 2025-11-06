// ===============================
// 🐾 PETSY MAIN.JS — Fixed Shop + Working Community + Treats + Options
// ===============================

const backendUrl = "http://localhost:5000";

let petData = null;
let ageInterval = null;
let communityIntervalId = null;
let lastPopupIds = new Set();
let treatInventory = { small: 0, medium: 0, large: 0 };
let sleepEmojiInterval = null; // 💤 added for continuous emoji

// Utility: safe query
const $ = (sel, root = document) => root.querySelector(sel);

// 🟢 Run after DOM ready
document.addEventListener("DOMContentLoaded", () => {
  // Element references (now safe)
  const playBtn = $("#playBtn");
  const restBtn = $("#restBtn");
  const miniGamesBtn = $("#miniGamesBtn");
  const logoutBtn = $("#logoutBtn");
  const shopBtn = $("#shopBtn");
  const communityBtn = $("#communityBtn");
  const shopModal = $("#shopModal");
  const shopResult = $("#shopResult");
  const closeShopBtn = $("#closeShopBtn");
  const shopOverlay = document.createElement("div");
  shopOverlay.className = "modal-overlay hidden";
  document.body.appendChild(shopOverlay);

  const eatButton = $("#eatButton");
  const treatMenu = $("#treatOptions");
  const eatMenuContainer = document.querySelector(".eat-menu");
  const shopButtons = Array.from(document.querySelectorAll(".shop-btn"));
  const treatOptionEls = Array.from(document.querySelectorAll(".treat-option"));

  // NEW: elements for cleaning & options
  const cleanBtn = $("#cleanBtn");
  const optionsBtn = $("#optionsBtn");
  const optionsModal = $("#optionsModal");
  const closeOptionsBtn = $("#closeOptionsBtn");
  const renameInput = $("#renameInput");
  const saveNameBtn = $("#saveNameBtn");
  const renameResult = $("#renameResult");
  const muteToggle = $("#muteToggle");
  const muteStatus = $("#muteStatus");

  // initialize
  loadMain();

  // Buttons
  playBtn?.addEventListener("click", () => doPatAction());
  restBtn?.addEventListener("click", () => doAction("sleep_pet"));

  // miniGames should go to mingames.com (external)
  miniGamesBtn?.addEventListener("click", () => {
    window.location.href = "minigames.html";
  });

  logoutBtn?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });

  function logout() {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "login.html";
  }

  // Shop - open modal
  shopBtn?.addEventListener("click", async () => {
    // ensure inventory fresh before opening
    await loadTreatInventory();
    updateTreatMenu();

    shopModal.classList.remove("hidden");
    shopOverlay.classList.remove("hidden");
    shopResult.classList.add("hidden");
    shopResult.textContent = "";
    // prevent body scroll while modal open
    document.body.style.overflow = "hidden";
  });

  // Close shop modal (button)
  closeShopBtn?.addEventListener("click", closeShop);

  // Close when clicking overlay (outside modal)
  shopOverlay?.addEventListener("click", closeShop);

  function closeShop() {
    shopModal.classList.add("hidden");
    shopOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  
  
  // Prevent accidental propagation inside modal so clicks inside don't close it
  shopModal?.querySelector(".modal-content")?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Community button should go directly to community.html
  communityBtn?.addEventListener("click", () => {
    window.location.href = "community.html";
  });

  // 🐾 Update pet name in Flask
async function renamePet(newName) {
  try {
    const res = await fetch(`${backendUrl}/rename_pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id, new_name: newName }),
    });

    if (!res.ok) throw new Error(`rename_pet failed: ${res.status}`);
    const data = await res.json();

    if (data.success) {
      showToast(`✅ Pet name changed to ${newName}!`);
      return true;
    } else {
      showToast("⚠️ Couldn't rename pet.");
      return false;
    }
  } catch (err) {
    console.error("renamePet error:", err);
    showToast("❌ Server error while renaming pet.");
    return false;
  }
}

  $("#renameBtn")?.addEventListener("click", async () => {
  const newName = $("#newPetName").value.trim();
  if (!newName) {
    showToast("Please enter a name.");
    return;
  }

  const ok = await renamePet(newName);
  if (ok) {
    localStorage.setItem("pet_name", newName);
    $("#petNameDisplay").textContent = newName; // update name on page if exists
  }
  });


  // Shop buy handlers
  shopButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const treatType = btn.dataset.type;
      const pet_id = localStorage.getItem("pet_id");
      if (!pet_id) {
        shopResult.textContent = "❌ No pet selected.";
        shopResult.classList.remove("hidden");
        return;
      }

      try {
        const res = await fetch(`${backendUrl}/buy_treat/${pet_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treat_type: treatType })
        });

        const data = await res.json();

        if (res.ok && data && data.success) {
          // Refresh treat inventory and coins from server
          await loadTreatInventory();
          updateTreatMenu();
          await updateStats();

          shopResult.textContent = `✅ You bought a ${treatType} treat!`;
          shopResult.classList.remove("hidden");
        } else {
          const errMsg = data && data.error ? data.error : "Purchase failed.";
          shopResult.textContent = `❌ ${errMsg}`;
          shopResult.classList.remove("hidden");
        }
      } catch (err) {
        console.error("Shop error:", err);
        shopResult.textContent = "❌ Network error.";
        shopResult.classList.remove("hidden");
      }
    });
  });

  // Treat menu show/hide behavior
  if (eatButton && treatMenu && eatMenuContainer) {
    eatButton.addEventListener("mouseenter", () => {
      updateTreatMenu();
      treatMenu.classList.remove("hidden");
    });

    // Hide menu when mouse leaves the eat menu container
    eatMenuContainer.addEventListener("mouseleave", () => {
      treatMenu.classList.add("hidden");
    });

    // Click treat options
    treatOptionEls.forEach(option => {
      option.addEventListener("click", async () => {
        const treatType = option.dataset.type;
        // Use feed_pet route which consumes a treat and boosts hunger
        await feedPet(treatType);
        treatMenu.classList.add("hidden");
      });
    });
  }

  // NEW: Clean button handler
  cleanBtn?.addEventListener("click", async () => {
    const pet_id = localStorage.getItem("pet_id");
    if (!pet_id) {
      alert("No pet selected.");
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/clean_pet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet_id })
      });

      const data = await res.json();

      if (res.ok && (data.success || data.cleaned)) {
        // If server returns updated stats, refresh
        await updateStats();
        alert("✨ Your pet has been cleaned!");
      } else {
        // fallback message
        alert((data && data.error) ? (`❌ ${data.error}`) : "❌ Cleaning failed or not supported on server.");
      }
    } catch (err) {
      console.error("Clean error:", err);
      alert("Network error while cleaning the pet.");
    }
  });

  // NEW: Options modal handlers
  optionsBtn?.addEventListener("click", () => {
    optionsModal.classList.remove("hidden");
    shopOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // load mute status
    const muted = localStorage.getItem("muted") === "true";
    updateMuteUI(muted);
  });

  closeOptionsBtn?.addEventListener("click", closeOptions);

  function closeOptions() {
    optionsModal.classList.add("hidden");
    shopOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  // Prevent modal inside options from closing when clicked
  optionsModal?.querySelector(".modal-content")?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Rename pet handler
  saveNameBtn?.addEventListener("click", async () => {
    const newName = (renameInput.value || "").trim();
    const pet_id = localStorage.getItem("pet_id");
    if (!pet_id) {
      renameResult.textContent = "❌ No pet selected.";
      renameResult.classList.remove("hidden");
      return;
    }
    if (!newName) {
      renameResult.textContent = "❌ Name cannot be empty.";
      renameResult.classList.remove("hidden");
      return;
    }

    try {
      // Try server rename first
      const res = await fetch(`${backendUrl}/rename_pet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet_id, new_name: newName })
      });

      const data = await res.json();

      if (res.ok && data && (data.success || data.updated)) {
        // update UI
        $("#petName").textContent = newName;
        renameResult.textContent = "✅ Name updated.";
        renameResult.classList.remove("hidden");
        // update local petData if present
        if (petData) petData.pet_name = newName;
      } else {
        // fallback: update locally and inform user
        $("#petName").textContent = newName;
        if (petData) petData.pet_name = newName;
        renameResult.textContent = "⚠️ Updated locally. Server rename failed or endpoint missing.";
        renameResult.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Rename error:", err);
      $("#petName").textContent = newName;
      if (petData) petData.pet_name = newName;
      renameResult.textContent = "⚠️ Network error — name updated locally.";
      renameResult.classList.remove("hidden");
    }
  });

  // Mute toggle handler
  muteToggle?.addEventListener("click", () => {
    const muted = localStorage.getItem("muted") === "true";
    localStorage.setItem("muted", (!muted).toString());
    updateMuteUI(!muted);

    // If you add audio elements later, you could pause/mute them here:
    // document.querySelectorAll('audio').forEach(a => a.muted = !muted);
  });

  function updateMuteUI(muted) {
    muteStatus.textContent = muted ? "On" : "Off";
    muteToggle.textContent = muted ? "Unmute" : "Mute";
  }

  // Ensure only one community polling interval runs
  if (!communityIntervalId) {
    startCommunityPopups(); // starts the interval and sets communityIntervalId
  }
    const petNameDisplay = $("#petNameDisplay");
  if (petNameDisplay && localStorage.getItem("pet_name")) {
    petNameDisplay.textContent = localStorage.getItem("pet_name");
  }

  }); // end DOMContentLoaded

// =======================
// Core functions
// =======================

async function loadMain() {
  console.log("📦 loadMain() starting...");

  const user_id = localStorage.getItem("user_id");
  const pet_id = localStorage.getItem("pet_id");

  if (!user_id) {
    console.log("❌ No user_id found, redirecting to login...");
    window.location.href = "login.html";
    return;
  }

  const idToLoad = pet_id ? pet_id : user_id;
  const endpoint = pet_id ? "get_pet_by_id" : "get_pet";

  try {
    const res = await fetch(`${backendUrl}/${endpoint}/${idToLoad}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      console.error("Error loading pet:", data.error);
      return;
    }

    petData = data;
    localStorage.setItem("pet_id", data.id);

    // Display Info
    $("#petId").textContent = `#${data.id}`;
    $("#petName").textContent = data.pet_name;
    $("#petType").textContent = data.pet_type;
    $("#petCoins").textContent = data.coins ?? 0;

    // Pet Image
    const img = $("#petImage");
    const type = (data.pet_type || "").toLowerCase();
    const petImages = {
      dog: "static/images/dog.png",
      cat: "static/images/cat.gif",
      dragon: "static/images/dragon.png",
      bird: "static/images/bird.png",
    };
    if (img) img.src = petImages[type] || "static/images/paw.png";

    // NEW: update play/pat button icon based on type
    const playBtn = $("#playBtn");
    if (playBtn) {
      if (type === "cat") playBtn.textContent = "🧶"; // yarn
      else if (type === "dog") playBtn.textContent = "⚽"; // ball
      else playBtn.textContent = "🐾"; // default paw
    }

    updateBackground();
    displayAge();
    updateStats();

    // load treats from server and show
    await loadTreatInventory();
    updateTreatMenu();

    // Auto refresh stats and age
    if (ageInterval) clearInterval(ageInterval);
    ageInterval = setInterval(displayAge, 60000);
    setInterval(updateStats, 30000);
  } catch (err) {
    console.error("Failed to load main:", err);
  }
}

function displayAge() {
  if (!petData || !petData.created_at) return;
  const createdAt = new Date(petData.created_at);
  const now = new Date();
  const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
  const el = $("#petAge");
  if (el) el.textContent = `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
}

async function updateStats() {
  const pet_id = localStorage.getItem("pet_id");
  if (!pet_id) return;

  try {
    const res = await fetch(`${backendUrl}/get_pet_by_id/${pet_id}`);
    const data = await res.json();

    if (!res.ok || data.error) return;

    petData = data;
    // progress elements
    const hunger = $("#hungerBar");
    const energy = $("#energyBar");
    const happiness = $("#happinessBar");

    if (hunger) hunger.value = data.hunger ?? hunger.value;
    if (energy) energy.value = data.energy ?? energy.value;
    if (happiness) happiness.value = data.happiness ?? happiness.value;

    $("#petCoins").textContent = data.coins ?? 0;
    displayAge();

    // sync treatInventory from latest pet data if present
    if (typeof data.small_treats !== "undefined") {
      treatInventory.small = data.small_treats ?? 0;
      treatInventory.medium = data.medium_treats ?? 0;
      treatInventory.large = data.large_treats ?? 0;
      updateTreatMenu();
    }
  } catch (err) {
    console.error("Failed to update stats:", err);
  }
}

function updateBackground() {
  const hour = new Date().getHours();
  const bg = document.querySelector(".background");
  if (!bg) return;
  bg.classList.add("fade-transition");

  if (hour >= 6 && hour < 12) {
    bg.style.backgroundImage = "url('static/images/background/morning.png')";
  } else if (hour >= 12 && hour < 18) {
    bg.style.backgroundImage = "url('static/images/background/afternoon.png')";
  } else {
    bg.style.backgroundImage = "url('static/images/background/night.png')";
  }

  setTimeout(() => bg.classList.remove("fade-transition"), 1500);
}

// 💤 Sleep action (with floating emoji + disable)
async function doAction(endpoint) {
  const pet_id = localStorage.getItem("pet_id");
  if (!pet_id) return;

  const allBtns = document.querySelectorAll("button:not(#logoutBtn):not(#communityBtn):not(#shopBtn)");
  const emoji = document.createElement("div");
  emoji.className = "floating-emoji";
  emoji.textContent = "💤";
  document.body.appendChild(emoji);

  allBtns.forEach(btn => btn.disabled = true);
  emoji.style.position = "fixed";
  emoji.style.fontSize = "4rem";
  emoji.style.top = "40%";
  emoji.style.left = "50%";
  emoji.style.transform = "translate(-50%, -50%)";
  emoji.style.opacity = "0";
  emoji.style.transition = "opacity 0.3s ease";
  setTimeout(() => (emoji.style.opacity = "1"), 50);

  try {
    const res = await fetch(`${backendUrl}/sleep_pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id }),
    });
    const data = await res.json();

    if (data.success) {
      console.log("Sleeping:", data.message);
      await updateStats();
    }
  } catch (err) {
    console.error("Sleep error:", err);
  }

  setTimeout(() => {
    emoji.remove();
    allBtns.forEach(btn => (btn.disabled = false));
  }, 4000); // sleep for 4 seconds
}

// 🐾 Play / pat action — random happy emoji + disable 1 minute
async function doPatAction() {
  const pet_id = localStorage.getItem("pet_id");
  if (!pet_id) return;

  const allBtns = document.querySelectorAll("button:not(#logoutBtn):not(#communityBtn):not(#shopBtn)");
  allBtns.forEach(btn => (btn.disabled = true));

  const emojis = ["😄", "🐾", "🎾", "🎉", "🦴", "🧶"];
  const emoji = document.createElement("div");
  emoji.className = "floating-emoji";
  emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  document.body.appendChild(emoji);

  emoji.style.position = "fixed";
  emoji.style.fontSize = "4rem";
  emoji.style.top = "40%";
  emoji.style.left = "50%";
  emoji.style.transform = "translate(-50%, -50%)";
  emoji.style.opacity = "0";
  emoji.style.transition = "opacity 0.3s ease";
  setTimeout(() => (emoji.style.opacity = "1"), 50);

  try {
    const res = await fetch(`${backendUrl}/play_pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id }),
    });
    const data = await res.json();

    if (data.success) {
      console.log(data.message);
      await updateStats();
    }
  } catch (err) {
    console.error("Play error:", err);
  }

  setTimeout(() => {
    emoji.remove();
    allBtns.forEach(btn => (btn.disabled = false));
  }, 60000); // 1 minute cooldown
}


// =======================
// COMMUNITY POPUPS
// =======================
async function fetchRecentPosts() {
  try {
    const res = await fetch(`${backendUrl}/get_recent_posts`);
    if (!res.ok) return [];
    const posts = await res.json();
    return Array.isArray(posts) ? posts : [];
  } catch (err) {
    console.error("Error fetching posts:", err);
    return [];
  }
}

function showPostPopup(post) {
  if (!post || !post.id) return;
  if (lastPopupIds.has(post.id)) return;
  lastPopupIds.add(post.id);

  const popup = document.createElement("div");
  popup.className = "post-popup";
  popup.innerHTML = `<strong>💬 ${post.username || "Someone"}</strong><br>${post.content || ""}`;
  document.body.appendChild(popup);
  // show animation
  setTimeout(() => popup.classList.add("show"), 50);

  // stays visible for 7 seconds
  setTimeout(() => {
    popup.classList.remove("show");
    popup.remove();
  }, 7000);
}

function startCommunityPopups() {
  // avoid starting multiple intervals
  if (communityIntervalId) return;

  // fetch immediately, then every 10s
  (async () => {
    const posts = await fetchRecentPosts();
    posts.forEach(p => showPostPopup(p));
  })();

  communityIntervalId = setInterval(async () => {
    const posts = await fetchRecentPosts();
    posts.forEach(p => showPostPopup(p));
  }, 10000);
}

// =======================
// FEED/TREAT SYSTEM
// =======================

/**
 * Load treats for current pet from server and populate treatInventory.
 * Endpoint used: GET /get_treats/<pet_id>
 */
async function loadTreatInventory() {
  const pet_id = localStorage.getItem("pet_id");
  if (!pet_id) return;

  try {
    const res = await fetch(`${backendUrl}/get_treats/${pet_id}`);
    if (!res.ok) {
      console.warn("get_treats returned non-ok:", res.status);
      return;
    }
    const data = await res.json();
    // API returns { small_treats, medium_treats, large_treats } or defaults
    treatInventory.small = data.small_treats ?? 0;
    treatInventory.medium = data.medium_treats ?? 0;
    treatInventory.large = data.large_treats ?? 0;

    // Update visible counts
    updateTreatMenu();
  } catch (err) {
    console.error("Failed to load treats:", err);
  }
}

/**
 * Use a treat (feed pet).
 * Calls /feed_pet which expects { pet_id, treatType } and handles decrement + pet stat change.
 */
async function feedPet(treatType) {
  const pet_id = localStorage.getItem("pet_id");
  if (!pet_id) return;

  // local guard
  if (!treatInventory[treatType] || treatInventory[treatType] <= 0) {
    alert("❌ You’re out of this treat!");
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/feed_pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id, treatType })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to feed pet.");
      return;
    }

    if (data.success) {
      // Decrement local inventory and refresh UI & stats from server
      treatInventory[treatType] = Math.max(0, (treatInventory[treatType] || 0) - 1);

      // server returns updated pet stats in data.data in your backend; refresh from server to be safe
      await loadTreatInventory();
      updateTreatMenu();
      await updateStats();

      const hungerBoost = { small: 10, medium: 25, large: 50 }[treatType] || 0;
      alert(`🍗 ${capitalize(treatType)} treat eaten! Hunger +${hungerBoost}`);
    } else {
      alert(data.error || "Failed to feed pet.");
    }
  } catch (err) {
    console.error("Feeding failed:", err);
    alert("Network error while feeding pet.");
  }
}

/**
 * Update treat option elements and numeric counters.
 */
function updateTreatMenu() {
  // update each .treat-option text + disabled states + the small/medium/large span counters
  document.querySelectorAll(".treat-option").forEach(option => {
    const type = option.dataset.type;
    const count = treatInventory[type] || 0;
    const emoji = type === "small" ? "🍪" : type === "medium" ? "🥩" : "🍗";
    option.innerHTML = `${emoji} ${capitalize(type)} Treat ×${count}`;
    if (count <= 0) {
      option.classList.add("disabled");
    } else {
      option.classList.remove("disabled");
    }
  });

  // update numeric counters if those spans exist
  const smallCountSpan = $("#smallCount");
  const mediumCountSpan = $("#mediumCount");
  const largeCountSpan = $("#largeCount");
  if (smallCountSpan) smallCountSpan.textContent = treatInventory.small || 0;
  if (mediumCountSpan) mediumCountSpan.textContent = treatInventory.medium || 0;
  if (largeCountSpan) largeCountSpan.textContent = treatInventory.large || 0;

  // also update smallTreats/mediumTreats/largeTreats display if present
  const smallTreats = $("#smallTreats");
  const mediumTreats = $("#mediumTreats");
  const largeTreats = $("#largeTreats");
  if (smallTreats) smallTreats.textContent = `Small Treats: ${treatInventory.small || 0}`;
  if (mediumTreats) mediumTreats.textContent = `Medium Treats: ${treatInventory.medium || 0}`;
  if (largeTreats) largeTreats.textContent = `Large Treats: ${treatInventory.large || 0}`;
}

function capitalize(s = "") {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Optional helper to explicitly fetch pet & treat view for some UI parts.
 */
async function loadPetData() {
  const pet_id = localStorage.getItem("pet_id");
  if (!pet_id) return;

  try {
    const res = await fetch(`${backendUrl}/get_pet_by_id/${pet_id}`);
    if (!res.ok) return;
    const pet = await res.json();

    const pn = $("#petName");
    const pc = $("#petCoins");
    if (pn) pn.textContent = pet.pet_name || pet.name || "Pet";
    if (pc) pc.textContent = `Coins: ${pet.coins ?? 0} 🪙`;

    // 🦴 Show treat inventory
    if (typeof pet.small_treats !== "undefined") {
      treatInventory.small = pet.small_treats ?? 0;
      treatInventory.medium = pet.medium_treats ?? 0;
      treatInventory.large = pet.large_treats ?? 0;
    } else {
      // fallback to /get_treats if not present in payload
      await loadTreatInventory();
    }
    updateTreatMenu();
  } catch (err) {
    console.error("Failed to load pet data:", err);
  }
}

/* Helper that safely applies a hunger boost locally (not invoked automatically).
   This replaces the previous broken code block and avoids runtime errors.
*/
function applyHungerBoostLocal(treatType) {
  const hungerBar = document.querySelector("#hungerBar");
  if (!hungerBar) return;
  const boost = { small: 10, medium: 25, large: 50 }[treatType] || 0;
  hungerBar.value = Math.min(100, (parseInt(hungerBar.value) || 0) + boost);
}

const pet_id = localStorage.getItem("pet_id") || "1";
const actionButtons = document.querySelectorAll(".pet-action-btn"); // all your pet buttons

async function handleSleep() {
  try {
    const res = await fetch(`${backendUrl}/sleep_pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id }),
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message);

      if (data.sleeping) {
        disableAllActions(true);
      } else if (data.awake) {
        disableAllActions(false);
      }
    }
  } catch (err) {
    console.error("Sleep error:", err);
    showToast("⚠️ Could not update sleep status.");
  }
}

// Automatically check every minute if pet should wake up
setInterval(checkSleepStatus, 60000);

async function checkSleepStatus() {
  try {
    const res = await fetch(`${backendUrl}/check_sleep_status/${pet_id}`);
    const data = await res.json();

    if (data.sleeping) {
      disableAllActions(true);
    } else {
      disableAllActions(false);
    }
  } catch (err) {
    console.error("Check sleep error:", err);
  }
}

function disableAllActions(disabled) {
  // only disable play, clean, and eat buttons
  const limitedBtns = [
    document.getElementById("playBtn"),
    document.getElementById("cleanBtn"),
    document.getElementById("eatButton")
  ].filter(Boolean);

  limitedBtns.forEach(btn => {
    btn.disabled = disabled;
    btn.style.opacity = disabled ? "0.5" : "1";
    btn.style.cursor = disabled ? "not-allowed" : "pointer";
  });
}



// (keep all your other code here untouched)

async function doPatAction() {
  const pet_id = localStorage.getItem("pet_id");
  if (!pet_id) return;

  const allBtns = document.querySelectorAll("button:not(#logoutBtn):not(#communityBtn):not(#shopBtn)");
  allBtns.forEach(btn => (btn.disabled = true));

  const emojis = ["😄", "🐾", "🎾", "🎉", "🦴", "🧶"];
  const emoji = document.createElement("div");
  emoji.className = "floating-emoji";
  emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  document.body.appendChild(emoji);

  emoji.style.position = "fixed";
  emoji.style.fontSize = "4rem";
  emoji.style.top = "40%";
  emoji.style.left = "50%";
  emoji.style.transform = "translate(-50%, -50%)";
  emoji.style.opacity = "0";
  emoji.style.transition = "opacity 0.3s ease";
  setTimeout(() => (emoji.style.opacity = "1"), 50);

  try {
    // ✅ play_pet now gives +25 happiness
    const res = await fetch(`${backendUrl}/play_pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pet_id }),
    });
    const data = await res.json();

    if (data.success) {
      console.log(data.message);
      await updateStats();
    }
  } catch (err) {
    console.error("Play error:", err);
  }

  setTimeout(() => {
    emoji.remove();
    allBtns.forEach(btn => (btn.disabled = false));
  }, 60000); // 1 minute cooldown
}

// (keep everything else, unchanged...)

// =======================
// 💤 Sleep/Wake Persistent Behavior (add-on) — ENHANCED
// =======================

function startSleepTimer() {
  const now = Date.now();
  localStorage.setItem("pet_sleep_start", now.toString());
  disableAllActions(true);
  startSleepEmoji(); // 💤 start continuous emoji
}

function checkAutoWake() {
  const sleepStart = parseInt(localStorage.getItem("pet_sleep_start") || "0", 10);
  if (!sleepStart) return;

  const restBtn = document.getElementById("restBtn");
  if (restBtn) restBtn.textContent = "💤 Sleep";

  const now = Date.now();
  const eightHours = 8 * 60 * 60 * 1000;
  if (now - sleepStart >= eightHours) {
    localStorage.removeItem("pet_sleep_start");
    disableAllActions(false);
    stopSleepEmoji();
    showToast("☀️ Your pet woke up after 8 hours of rest!");
  }
}

// 💤 Continuous sleep emoji animation every 5s
function startSleepEmoji() {
  stopSleepEmoji(); // ensure no duplicates
  sleepEmojiInterval = setInterval(() => {
    const emoji = document.createElement("div");
    emoji.className = "floating-emoji";
    emoji.textContent = "💤";
    document.body.appendChild(emoji);
    emoji.style.position = "fixed";
    emoji.style.fontSize = "4rem";
    emoji.style.top = "40%";
    emoji.style.left = "50%";
    emoji.style.transform = "translate(-50%, -50%)";
    emoji.style.opacity = "0";
    emoji.style.transition = "opacity 1s ease";
    setTimeout(() => (emoji.style.opacity = "1"), 50);
    setTimeout(() => emoji.remove(), 2000);
  }, 5000); // every 5 seconds
}

function stopSleepEmoji() {
  if (sleepEmojiInterval) {
    clearInterval(sleepEmojiInterval);
    sleepEmojiInterval = null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const restBtn = document.getElementById("restBtn");
  if (!restBtn) return;

  restBtn.addEventListener("click", async () => {
  const sleeping = !!localStorage.getItem("pet_sleep_start");

  if (!sleeping) {
    await handleSleep();
    startSleepTimer();
    restBtn.textContent = "🌞 Wake Up";
    showToast("💤 Your pet is now sleeping...");
  } else {
    localStorage.removeItem("pet_sleep_start");
    disableAllActions(false);
    stopSleepEmoji();
    restBtn.textContent = "💤 Sleep";
    showToast("☀️ Your pet woke up!");
  }
});
  

  const stillSleeping = !!localStorage.getItem("pet_sleep_start");
  if (stillSleeping) {
    disableAllActions(true);
    startSleepEmoji();
    const restBtn = document.getElementById("restBtn");
    if (restBtn) restBtn.textContent = "🌞 Wake Up";
  }

  setInterval(checkAutoWake, 60000);
});

if (now - sleepStart >= eightHours) {
  localStorage.removeItem("pet_sleep_start");
  disableAllActions(false);
  stopSleepEmoji();
  showToast("☀️ Your pet woke up after 8 hours of rest!");
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.className = "toast";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}