const backendUrl = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const strengthText = document.getElementById("passwordStrength");
  const togglePassword = document.getElementById("togglePassword");
  const messageEl = document.getElementById("message");
  const matchMessage = document.getElementById("matchMessage");

  // Password rule elements
  const ruleLength = document.getElementById("rule-length");
  const ruleUpper = document.getElementById("rule-upper");
  const ruleLower = document.getElementById("rule-lower");
  const ruleNumber = document.getElementById("rule-number");
  const ruleSpecial = document.getElementById("rule-special");

  // 👁️ Toggle show/hide password
  togglePassword.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    togglePassword.textContent = type === "password" ? "👁️" : "🙈";
  });

  // 🔍 Live password validation
  passwordInput.addEventListener("input", () => {
    const value = passwordInput.value;

    // Rule checks
    ruleLength.className = value.length >= 8 ? "valid" : "invalid";
    ruleUpper.className = /[A-Z]/.test(value) ? "valid" : "invalid";
    ruleLower.className = /[a-z]/.test(value) ? "valid" : "invalid";
    ruleNumber.className = /[0-9]/.test(value) ? "valid" : "invalid";
    ruleSpecial.className = /[^A-Za-z0-9]/.test(value) ? "valid" : "invalid";

    // Strength display
    const strength = getPasswordStrength(value);
    strengthText.textContent = strength.message;
    strengthText.style.color = strength.color;

    // Update match message
    checkPasswordMatch();
  });

  // 🧩 Confirm password live match check
  confirmPasswordInput.addEventListener("input", checkPasswordMatch);

  function checkPasswordMatch() {
    if (!confirmPasswordInput.value) {
      matchMessage.textContent = "";
      return;
    }

    if (confirmPasswordInput.value === passwordInput.value) {
      matchMessage.textContent = "✅ Passwords match";
      matchMessage.style.color = "green";
    } else {
      matchMessage.textContent = "❌ Passwords do not match";
      matchMessage.style.color = "red";
    }
  }

  // 🧾 Handle form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (password !== confirmPassword) {
      messageEl.textContent = "❌ Passwords do not match!";
      messageEl.style.color = "red";
      return;
    }

    // Check password rules
    if (
      ruleLength.className !== "valid" ||
      ruleUpper.className !== "valid" ||
      ruleLower.className !== "valid" ||
      ruleNumber.className !== "valid" ||
      ruleSpecial.className !== "valid"
    ) {
      messageEl.textContent = "❌ Password does not meet all requirements.";
      messageEl.style.color = "red";
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        messageEl.textContent = data.error || "Registration failed.";
        messageEl.style.color = "red";
      } else {
        messageEl.textContent = "✅ Registration successful! Redirecting...";
        messageEl.style.color = "green";
        setTimeout(() => (window.location.href = "login.html"), 1000);
      }
    } catch (err) {
      console.error(err);
      messageEl.textContent = "Server error. Try again later.";
      messageEl.style.color = "red";
    }
  });
});

// 🧮 Password strength helper
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { message: "Weak password 🔴", color: "red" };
  if (score === 3 || score === 4) return { message: "Medium password 🟠", color: "orange" };
  return { message: "Strong password 🟢", color: "green" };
}
