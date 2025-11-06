// ===============================
// 🐾 PETSY GREET.JS — Reliable Pet Greeting System
// ===============================

const backendUrl = "http://localhost:5000"; // ✅ Change to match Flask URL

// 🧩 Helper: Get query parameters from OTP redirect
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    user_id: params.get("user_id"),
    role: params.get("role"),
    has_pet: params.get("has_pet") === "true",
    pet_id: params.get("pet_id"),
    next: params.get("next"),
  };
}

// 🐶 Main Greeting Function
async function greetPet() {
  const greetEl = document.getElementById("greetMessage");
  const params = getQueryParams();

  // 🧠 Pull from localStorage if query params are missing
  const user_id = params.user_id || localStorage.getItem("user_id");
  const role = params.role || localStorage.getItem("role");
  const has_pet =
    params.has_pet ||
    localStorage.getItem("has_pet") === "true" ||
    false;
  const pet_id = params.pet_id || localStorage.getItem("pet_id");

  // ✅ Save login session data
  if (user_id && role) {
    localStorage.setItem("user_id", user_id);
    localStorage.setItem("role", role);
    localStorage.setItem("has_pet", has_pet ? "true" : "false");
    localStorage.setItem("pet_id", pet_id || "");
    localStorage.setItem("isLoggedIn", "true");
  }

  console.log("🐾 Debug Params:", { user_id, role, has_pet, pet_id });

  // 🧭 If admin — greet directly, skip pet fetching
  if (role === "admin") {
    greetEl.textContent = "👋 Welcome back, Admin!";
    return;
  }

  // 🐾 Try loading the user's pet
  try {
    let petData = null;
    let res;

    if (has_pet && pet_id) {
      // ✅ Fetch pet by pet ID
      res = await fetch(`${backendUrl}/get_pet_by_id/${pet_id}`);
    } else if (user_id) {
      // ✅ Fallback: fetch pet by user ID
      res = await fetch(`${backendUrl}/get_pet/${user_id}`);
    } else {
      throw new Error("No user_id or pet_id available");
    }

    if (!res.ok) throw new Error(`Server returned status ${res.status}`);
    petData = await res.json();

    // 🩷 Display greeting message
    if (petData && !petData.error && petData.pet_name) {
      greetEl.textContent = `🐾 Hi there! Your pet ${petData.pet_name} is happy to see you!`;
      console.log("✅ Pet data loaded:", petData);
    } else {
      greetEl.textContent = "🐾 Welcome! You don’t have a pet yet — go adopt one!";
      console.warn("⚠️ No pet found or missing data:", petData);
    }

  } catch (err) {
    console.error("❌ Error loading pet for greeting:", err);
    greetEl.textContent = "⚠️ Server connection error.";
    showServerErrorPopup();
  }
}

// ⚠️ Display “Server connection error” popup
function showServerErrorPopup() {
  const popup = document.getElementById("serverErrorPopup");
  if (popup) popup.style.display = "flex";
}

// 🟢 Handle Continue / Logout Buttons
document.addEventListener("DOMContentLoaded", () => {
  greetPet();

  // Logout → clear session + return to login
  document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });

  // Continue → go to next page (main or admin)
  document.getElementById("continue")?.addEventListener("click", () => {
    const role = localStorage.getItem("role");
    const nextPage = role === "admin" ? "admin.html" : "main.html";
    window.location.href = nextPage;
  });
});
