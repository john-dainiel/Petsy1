const backendUrl = "http://localhost:5000";

const isCoParent = document.getElementById("isCoParent");
const coParentSection = document.getElementById("coParentSection");
const submitBtn = document.getElementById("submitBtn");
const petForm = document.getElementById("petForm");
const message = document.getElementById("message");

// 🔙 Back button
document.getElementById("backBtn").addEventListener("click", () => {
  window.location.href = "login.html";
});

// 🟢 Toggle co-parent mode
isCoParent.addEventListener("change", () => {
  const nameField = document.getElementById("petName");
  const typeField = document.getElementById("petType");

  if (isCoParent.checked) {
    coParentSection.style.display = "block";
    nameField.disabled = true;
    typeField.disabled = true;
    nameField.value = "";
    submitBtn.textContent = "Continue Co-Parenting";
  } else {
    coParentSection.style.display = "none";
    nameField.disabled = false;
    typeField.disabled = false;
    submitBtn.textContent = "Create Pet";
  }
});

// 🟢 Form submission
petForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user_id = localStorage.getItem("user_id");
  if (!user_id) {
    message.textContent = "⚠️ User not found. Please log in again.";
    return;
  }

  // --- 🧩 Co-Parent Mode ---
  if (isCoParent.checked) {
    const pet_id = document.getElementById("coParentPetId").value.trim();
    if (!pet_id) {
      message.textContent = "⚠️ Please enter a valid Pet ID.";
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/join_pet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, pet_id }),
      });

      const data = await res.json();

      if (res.ok && data.pet_id) {
        localStorage.setItem("pet_id", data.pet_id);
        message.textContent = "🐾 You are now co-parenting this pet! Loading...";
        setTimeout(() => (window.location.href = "main.html"), 1200);
      } else {
        message.textContent = data.error || "❌ Pet not found or cannot join.";
      }
    } catch (err) {
      console.error("Join pet error:", err);
      message.textContent = "❌ Error connecting to the server.";
    }

    return;
  }

  // --- 🧩 Normal Pet Creation ---
  const pet_name = document.getElementById("petName").value.trim();
  const pet_type = document.getElementById("petType").value;

  if (!pet_name || !pet_type) {
    message.textContent = "⚠️ Please fill out all fields.";
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/create_pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, pet_name, pet_type }),
    });

    const data = await res.json();

    if (res.ok && data.pet_id) {
      localStorage.setItem("pet_id", data.pet_id);
      message.textContent = "✅ Pet created successfully! Greeting your pet...";
      setTimeout(() => (window.location.href = "greet.html"), 1200);
    } else {
      message.textContent = data.error || "❌ Failed to create pet.";
    }
  } catch (err) {
    console.error("Create pet error:", err);
    message.textContent = "❌ Error connecting to the server.";
  }
});
