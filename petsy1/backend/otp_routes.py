# otp_routes.py
from flask import Blueprint, request, jsonify, session
from flask_mail import Message
from connection import get_db_connection
from datetime import datetime, timedelta
import random, secrets
import bcrypt

otp_bp = Blueprint("otp", __name__)
otp_sessions = {}      # temporary OTP storage
remembered_pcs = {}    # stores PC tokens (username → token)

# --------------------------
# Helper: Send OTP email
# --------------------------
def send_otp_email(mail, recipient_email, otp):
    try:
        msg = Message("Your PETSY Login OTP", recipients=[recipient_email])
        msg.body = (
            f"Hello!\n\nYour PETSY login verification code is: {otp}\n\n"
            f"This code will expire in 5 minutes."
        )
        mail.send(msg)
        print(f"✅ OTP sent to {recipient_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send OTP: {e}")
        return False


# --------------------------
# Step 1: Login validation
# --------------------------
@otp_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, password, role FROM users WHERE username = %s", (username,))
    result = cursor.fetchone()

    if not result:
        cursor.close()
        db.close()
        return jsonify({"error": "User not found."}), 404

    stored_password = result["password"].encode("utf-8")
    if not bcrypt.checkpw(password.encode("utf-8"), stored_password):
        cursor.close()
        db.close()
        return jsonify({"error": "Wrong password."}), 401

    cursor.execute(
        "SELECT id FROM pets WHERE user_id = %s OR co_parent_id = %s LIMIT 1",
        (result["id"], result["id"])
    )
    pet = cursor.fetchone()
    pet_id = pet["id"] if pet else None

    cursor.close()
    db.close()

    return jsonify({
        "message": "Login successful!",
        "user_id": result["id"],
        "role": result["role"],
        "has_pet": pet is not None,
        "pet_id": pet_id
    }), 200


# --------------------------
# Step 2: Request OTP
# --------------------------
@otp_bp.route("/request_otp", methods=["POST"])
def request_otp():
    from login import mail  # import mail from main app

    data = request.json
    username = data.get("username")
    remember_pc = data.get("remember_pc")
    device_token = data.get("device_token")

    if not username:
        return jsonify({"error": "Username required"}), 400

    # If PC is remembered, skip OTP
    if device_token and remembered_pcs.get(username) == device_token:
        print(f"✅ {username} recognized — skipping OTP.")
        return jsonify({
            "message": "Login successful — this PC is remembered.",
            "skip_otp": True
        }), 200

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, email, role FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        return jsonify({"error": "User not found."}), 404

    otp = str(random.randint(100000, 999999))
    otp_sessions[username] = {
        "otp": otp,
        "expires": datetime.now() + timedelta(minutes=5),
        "email": user["email"],
        "role": user["role"],
        "user_id": user["id"]  # ✅ store user id for later
    }

    # If "Remember this PC" checked, generate device token
    if remember_pc:
        token = secrets.token_hex(16)
        remembered_pcs[username] = token
        print(f"💾 Remembered PC for {username}: {token}")

    if send_otp_email(mail, user["email"], otp):
        response = {"message": "OTP sent to your email.", "role": user["role"]}
        if remember_pc:
            response["remember_token"] = remembered_pcs[username]
        return jsonify(response), 200
    else:
        return jsonify({"error": "Failed to send OTP email."}), 500


# --------------------------
# Step 3: Verify OTP
# --------------------------
# --------------------------
# Step 3: Verify OTP
# --------------------------
@otp_bp.route("/verify_otp", methods=["POST"])
def verify_otp():
    data = request.json
    username = data.get("username")
    otp_input = data.get("otp")

    if not username or not otp_input:
        return jsonify({"error": "Missing username or OTP"}), 400

    otp_data = otp_sessions.get(username)
    if not otp_data:
        return jsonify({"error": "No OTP found. Please request a new one."}), 400

    if datetime.now() > otp_data["expires"]:
        otp_sessions.pop(username, None)
        return jsonify({"error": "OTP expired. Please request a new one."}), 400

    if otp_data["otp"] != otp_input:
        return jsonify({"error": "Invalid OTP"}), 400

    # ✅ OTP valid
    role = otp_data["role"]
    user_id = otp_data["user_id"]

    # 🟢 Get pet info for normal users (admins may not have pets)
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT id FROM pets WHERE user_id = %s OR co_parent_id = %s LIMIT 1",
        (user_id, user_id)
    )
    pet = cur.fetchone()
    cur.close()
    conn.close()

    has_pet = pet is not None
    pet_id = pet["id"] if pet else None

    otp_sessions.pop(username, None)

    # 🟢 Decide target after greet
    if role == "admin":
        next_page = "admin.html"
    else:
        next_page = "main.html"

    # 🟢 Always redirect to greet.html first with all data
    greet_page = (
        f"greet.html?"
        f"user_id={user_id}"
        f"&role={role}"
        f"&has_pet={'true' if has_pet else 'false'}"
        f"&pet_id={pet_id if pet_id else ''}"
        f"&next={next_page}"
    )

    return jsonify({
        "message": "OTP verified successfully!",
        "role": role,
        "user_id": user_id,
        "has_pet": has_pet,
        "pet_id": pet_id,
        "redirect": greet_page
    }), 200

