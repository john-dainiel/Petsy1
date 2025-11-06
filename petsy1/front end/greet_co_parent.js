const backendUrl = "http://127.0.0.1:5000"; // change if your Flask URL differs

document.addEventListener("DOMContentLoaded", async () => {
  const username = localStorage.getItem("username");
  const user_id = localStorage.getItem("user_id");

  const greetEl = document.getElementById("greetMessage");
  const petNameEl = document.getElementById("petName");
  const petImageEl = document.getElementById("petImage");
  const petInfoText = document.getElementById("petInfoText");
  const continueBtn = document.getElementById("continueBtn");

  if (!user_id || !username) {
    greetEl.textContent = "Welcome, Guest!";
    petInfoText.textContent = "Please log in first.";
    continueBtn.textContent = "Go to Login";
    continueBtn.onclick = () => window.location.href = "login.html";
    return;
  }

  greetEl.textContent = `Welcome back, ${username}! 🐾`;

  try {
    // Fetch the pet info for this user (main owner or co-parent)
    const response = await fetch(`${backendUrl}/get_pet/${user_id}`);
    const data = await response.json();

    if (data.error) {
      petInfoText.textContent = "No pet found. You can create or join one!";
      petNameEl.textContent = "";
      petImageEl.src = "static/images/paw.png";
      continueBtn.textContent = "Create a Pet";
      continueBtn.onclick = () => window.location.href = "create_pet.html";
    } else {
      petNameEl.textContent = data.pet_name ? data.pet_name : "Unnamed Pet";
      petImageEl.src = data.photo ? data.photo : "static/images/paw.png";
      petInfoText.textContent = `You’re caring for a ${data.pet_type}! 💖`;

      continueBtn.textContent = "Continue to Pet";
      continueBtn.onclick = () => window.location.href = "main.html";
    }

  } catch (error) {
    console.error("Error fetching pet:", error);
    petInfoText.textContent = "Unable to load pet info right now.";
  }
});
