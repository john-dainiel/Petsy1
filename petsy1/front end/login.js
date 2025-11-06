const backendUrl = "http://localhost:5000";

const loginForm = document.getElementById("loginForm");
const otpForm = document.getElementById("otpForm");
const message = document.getElementById("message");

let currentUsername = "";
let currentRole = "";

// ==============================
// 🔔 Notification Popup (Bottom)
// ==============================
function showNotification(text, type = "info") {
  let notif = document.createElement("div");
  notif.textContent = text;
  notif.className = `notif ${type}`;
  document.body.appendChild(notif);

  setTimeout(() => notif.classList.add("show"), 100);
  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => notif.remove(), 500);
  }, 4000);
}

// Add notification styles
const style = document.createElement("style");
style.textContent = `
  .notif {
    position: fixed;
    bottom: -50px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 15px;
    opacity: 0;
    transition: all 0.4s ease;
    z-index: 9999;
  }
  .notif.show {
    bottom: 30px;
    opacity: 1;
  }
  .notif.success { background: #28a745; }
  .notif.error { background: #dc3545; }
  .notif.warn { background: #ffc107; color: #222; }
`;
document.head.appendChild(style);

// ==============================
// 🧩 LOGIN FORM
// ==============================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const rememberPC = document.getElementById("rememberPC").checked;

  if (!username || !password) {
    message.textContent = "Please fill in both fields.";
    showNotification("Please fill in both fields.", "warn");
    return;
  }

  currentUsername = username;

  try {
    // Step 1: Login request
    const res = await fetch(`${backendUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.error || "Wrong username or password.";
      showNotification(data.error || "Wrong username or password.", "error");
      return;
    }

    currentRole = data.role || "user";

    // Step 2: Request OTP
    const otpRes = await fetch(`${backendUrl}/request_otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        remember_pc: rememberPC,
        device_token: localStorage.getItem("remember_token"),
      }),
    });

    const otpData = await otpRes.json();

    if (otpRes.ok) {
      // 🟢 Skip OTP if PC remembered
      if (otpData.skip_otp) {
        showNotification("Welcome back! PC recognized.", "success");

        // ✅ Save session info before redirect
        localStorage.setItem("isLoggedIn", "true");  if (data.has_pet && data.pet_id)
        localStorage.setItem("user_id", data.user_id || otpData.user_id || "");

        setTimeout(() => {
          if ((otpData.role || currentRole).toLowerCase() === "admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "main.html";
          }
        }, 1000);
        return;
      }

      // 🟢 Save remember_token if available
      if (otpData.remember_token) {
        localStorage.setItem("remember_token", otpData.remember_token);
      }

      message.textContent = otpData.message;
      showNotification("OTP sent to your email!", "success");
      loginForm.style.display = "none";
      otpForm.style.display = "block";
    } else {
      message.textContent = otpData.error || "Failed to send OTP.";
      showNotification(otpData.error || "Failed to send OTP.", "error");
    }
  } catch (err) {
    console.error("Login error:", err);
    message.textContent = "Server error. Please try again.";
    showNotification("⚠️ Server connection error.", "warn");
  }
});

// ==============================
// 🧩 OTP VERIFICATION
// ==============================
otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const otpCode = document.getElementById("otpCode").value.trim();
  if (!otpCode) {
    message.textContent = "Please enter your OTP.";
    showNotification("Please enter your OTP.", "warn");
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/verify_otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUsername, otp: otpCode }),
    });

    const data = await res.json();

    if (res.ok) {
      message.textContent = "✅ Login complete! Redirecting...";
      showNotification("Login successful!", "success");

      // ✅ Save session info before redirect
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("user_id", data.user_id || "");

      loginForm.style.display = "none";
      otpForm.style.display = "none";

      setTimeout(() => {
        if (currentRole.toLowerCase() === "admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "greet.html";
        }
      }, 1000);
    } else {
      message.textContent = data.error || "Invalid OTP.";
      showNotification(data.error || "Invalid OTP.", "error");
    }
  } catch (err) {
    console.error("OTP verify error:", err);
    message.textContent = "Server error.";
    showNotification("⚠️ Server connection error.", "warn");
  }
});

// 🔙 Back button
const backBtn = document.createElement("button");
backBtn.type = "button";
backBtn.textContent = "Back to Login";
backBtn.classList.add("secondary");
backBtn.onclick = () => {
  otpForm.style.display = "none";
  loginForm.style.display = "block";
  message.textContent = "";
};
otpForm.appendChild(backBtn);
