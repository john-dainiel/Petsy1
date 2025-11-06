const backendUrl = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", async () => {
  // Load default
  await loadUsers();
  setupSidebar();

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", logout);
});

// ==================== SIDEBAR TOGGLE ====================
function setupSidebar() {
  const tabUsers = document.getElementById("tabUsers");
  const tabPets = document.getElementById("tabPets");
  const usersSection = document.getElementById("usersSection");
  const petsSection = document.getElementById("petsSection");

  tabUsers.addEventListener("click", async () => {
    tabUsers.classList.add("active");
    tabPets.classList.remove("active");
    usersSection.classList.remove("hidden");
    petsSection.classList.add("hidden");
    await loadUsers();
  });

  tabPets.addEventListener("click", async () => {
    tabPets.classList.add("active");
    tabUsers.classList.remove("active");
    petsSection.classList.remove("hidden");
    usersSection.classList.add("hidden");
    await loadPets();
  });
}

// ==================== USERS ====================
async function loadUsers() {
  try {
    const res = await fetch(`${backendUrl}/admin/users`);
    const users = await res.json();
    const tbody = document.querySelector("#usersTable tbody");
    tbody.innerHTML = "";

    users.forEach(u => {
      tbody.innerHTML += `
        <tr>
          <td>${u.id}</td>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>${u.role}</td>
          <td class="actions">
            <button class="edit" onclick="editUser(${u.id}, '${u.username}', '${u.email}', '${u.role}')">✏️</button>
            <button class="delete" onclick="deleteUser(${u.id})">🗑️</button>
          </td>
        </tr>`;
    });
  } catch {
    alert("⚠️ Failed to load users");
  }
}

function addUser() {
  const username = prompt("Enter username:");
  const email = prompt("Enter email:");
  const password = prompt("Enter password:");
  const role = prompt("Role (admin/user):", "user");

  fetch(`${backendUrl}/admin/add_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, role })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadUsers();
    });
}

function editUser(id, username, email, role) {
  const newUsername = prompt("New username:", username);
  const newEmail = prompt("New email:", email);
  const newRole = prompt("Role (admin/user):", role);

  fetch(`${backendUrl}/admin/update_user/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: newUsername, email: newEmail, role: newRole })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadUsers();
    });
}

function deleteUser(id) {
  if (!confirm("Delete this user?")) return;
  fetch(`${backendUrl}/admin/delete_user/${id}`, { method: "DELETE" })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadUsers();
    });
}

// ==================== PETS ====================
async function loadPets() {
  try {
    const res = await fetch(`${backendUrl}/admin/pets`);
    const pets = await res.json();
    const tbody = document.querySelector("#petsTable tbody");
    tbody.innerHTML = "";

    pets.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td>${p.id}</td>
          <td>${p.user_id} (${p.owner_name || "User"})</td>
          <td>${p.pet_name}</td>
          <td>${p.pet_type}</td>
          <td>${p.hunger}</td>
          <td>${p.energy}</td>
          <td>${p.happiness}</td>
          <td>${p.co_parent_id || "—"}</td>
          <td>${p.coins || 0} 🪙</td>
          <td>${new Date(p.created_at).toLocaleDateString()}</td>
          <td class="actions">
            <button onclick="rewardCoins(${p.id})">💰</button>
            <button onclick="spendCoins(${p.id})">💸</button>
            <button class="edit" onclick="editPet(${p.id}, '${p.pet_name}', '${p.pet_type}', ${p.hunger}, ${p.energy}, ${p.happiness}, '${p.co_parent_id ?? ""}', ${p.coins ?? 0})">✏️</button>
            <button class="delete" onclick="deletePet(${p.id})">🗑️</button>
          </td>
        </tr>`;
    });
  } catch {
    alert("⚠️ Failed to load pets");
  }
}

function addPet() {
  const user_id = prompt("User ID:");
  const pet_name = prompt("Pet Name:");
  const pet_type = prompt("Pet Type:");
  const co_parent_id = prompt("Co-Parent ID (optional):");

  fetch(`${backendUrl}/admin/add_pet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, pet_name, pet_type, co_parent_id: co_parent_id || null })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadPets();
    });
}

function editPet(id, pet_name, pet_type, hunger, energy, happiness, co_parent_id, coins) {
  const newName = prompt("Pet name:", pet_name);
  const newType = prompt("Pet type:", pet_type);
  const newHunger = prompt("Hunger (0–100):", hunger);
  const newEnergy = prompt("Energy (0–100):", energy);
  const newHappiness = prompt("Happiness (0–100):", happiness);
  const newCoParent = prompt("Co-Parent ID:", co_parent_id);
  const newCoins = prompt("Coins:", coins);

  fetch(`${backendUrl}/admin/update_pet/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pet_name: newName,
      pet_type: newType,
      hunger: Number(newHunger),
      energy: Number(newEnergy),
      happiness: Number(newHappiness),
      co_parent_id: newCoParent || null,
      coins: Number(newCoins)
    })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadPets();
    });
}

function deletePet(id) {
  if (!confirm("Delete this pet?")) return;
  fetch(`${backendUrl}/admin/delete_pet/${id}`, { method: "DELETE" })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadPets();
    });
}

function rewardCoins(pet_id) {
  const amount = Number(prompt("Coins to add:"));
  if (isNaN(amount) || amount <= 0) return;
  fetch(`${backendUrl}/admin/update_pet_coins/${pet_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadPets();
    });
}

function spendCoins(pet_id) {
  const amount = Number(prompt("Coins to spend:"));
  if (isNaN(amount) || amount <= 0) return;
  fetch(`${backendUrl}/admin/update_pet_coins/${pet_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: -amount })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadPets();
    });
}

// ==================== LOGOUT ====================
function logout() {
  fetch(`${backendUrl}/logout`, { method: "POST" })
    .then(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "login.html";
    });
}
