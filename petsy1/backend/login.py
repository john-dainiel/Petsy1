from flask import Flask, request, jsonify, render_template
import bcrypt
from flask_cors import CORS
import mysql.connector
from datetime import datetime, timedelta
from connection import get_db_connection
from routes.community_routes import community
from flask import request, jsonify
import random
import sqlite3
import re
from flask_mail import Mail, Message
import bcrypt, jwt, mysql.connector
from otp_routes import otp_bp
from flask_mail import Mail


app = Flask(__name__)
CORS(app)

# ------------------------------------------
# 📧 Mail configuration
# ------------------------------------------
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "johndainielnachor@gmail.com"
app.config["MAIL_PASSWORD"] = "cyuc acci porz fjuy"  # Gmail App Password
app.config["MAIL_DEFAULT_SENDER"] = "johndainielnachor@gmail.com"

mail = Mail(app)
app.mail = mail

# Register OTP blueprint
app.register_blueprint(otp_bp)


pets = {
    "1": {
        "id": "1",
        "pet_name": "Buddy",
        "pet_type": "dog",
        "coins": 100,
        "hunger": 70,
        "energy": 80,
        "happiness": 60,
    }
}
app.register_blueprint(community, url_prefix="/community")


@app.route("/rename_pet", methods=["POST"])
def rename_pet():
    try:
        data = request.get_json()
        pet_id = data.get("pet_id")
        new_name = data.get("new_name", "").strip()

        if not pet_id or not new_name:
            return jsonify({"success": False, "message": "Missing pet_id or new_name"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ✅ Check if the pet exists
        cursor.execute("SELECT * FROM pets WHERE id = %s", (pet_id,))
        pet = cursor.fetchone()

        if not pet:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Pet not found"}), 404

        # ✅ Rename the pet
        cursor.execute("UPDATE pets SET pet_name = %s, last_updated = NOW() WHERE id = %s", (new_name, pet_id))
        conn.commit()

        # ✅ Get updated data
        cursor.execute("""
            SELECT id, pet_name, pet_type, hunger, energy, happiness, coins, created_at, last_updated
            FROM pets WHERE id = %s
        """, (pet_id,))
        updated_pet = cursor.fetchone()

        cursor.close()
        conn.close()

        # 🧮 Calculate age (in days)
        age_days = 0
        if updated_pet["created_at"]:
            age_days = (datetime.now() - updated_pet["created_at"]).days

        return jsonify({
            "success": True,
            "message": f"Pet renamed to {new_name}!",
            "pet": {
                "id": updated_pet["id"],
                "pet_name": updated_pet["pet_name"],
                "pet_type": updated_pet["pet_type"],
                "hunger": updated_pet["hunger"],
                "energy": updated_pet["energy"],
                "happiness": updated_pet["happiness"],
                "coins": updated_pet["coins"],
                "age_days": age_days,
                "last_updated": updated_pet["last_updated"].strftime("%Y-%m-%d %H:%M:%S") if updated_pet["last_updated"] else None
            }
        }), 200

    except Exception as e:
        print("❌ rename_pet error:", e)
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500


@app.route("/clean_pet", methods=["POST"])
def clean_pet():
    data = request.json
    pet_id = data.get("pet_id")

    if not pet_id:
        return jsonify({"error": "Missing pet_id"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE pets SET happiness = LEAST(happiness + 10, 100), last_updated = NOW() WHERE id = %s", (pet_id,))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True, "message": "✨ Your pet feels fresh and happy!"}), 200


# ------------------------------------------
# 👑 Auto-create admin account
# ------------------------------------------
def ensure_admin_exists():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    admin = cursor.fetchone()

    if not admin:
        hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute(
            "INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)",
            ("admin", "admin@example.com", hashed, "admin"),
        )
        db.commit()
        print("✅ Default admin created (admin / admin123)")
    else:
        print("ℹ️ Admin already exists")

    cursor.close()
    db.close()


ensure_admin_exists()


# ------------------------------------------
# 🧍 User Registration
# ------------------------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    password_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$"
    if not re.match(password_pattern, password):
        return jsonify({
            "error": "Password must include uppercase, lowercase, number, special char, and be 8+ characters long."
        }), 400

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, 'user')",
            (username, email, hashed),
        )
        db.commit()
        cursor.close()
        db.close()
        return jsonify({"message": "Account created successfully!"}), 201
    except mysql.connector.IntegrityError:
        return jsonify({"error": "Username or email already exists."}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------
# 🐾 Create Pet
# ------------------------------------------
@app.route("/create_pet", methods=["POST"])
def create_pet():
    data = request.json
    user_id = data.get("user_id")
    pet_name = data.get("pet_name")
    pet_type = data.get("pet_type")

    if not user_id or not pet_name or not pet_type:
        return jsonify({"error": "All fields are required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now()
        cursor.execute(
            """
            INSERT INTO pets (user_id, pet_name, pet_type, hunger, energy, happiness, created_at, last_updated)
            VALUES (%s, %s, %s, 100, 100, 100, %s, %s)
            """,
            (user_id, pet_name, pet_type, now, now),
        )
        conn.commit()
        pet_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"message": "Pet created successfully!", "pet_id": pet_id}), 201
    except Exception as e:
        print("❌ Error creating pet:", e)
        return jsonify({"error": str(e)}), 500


# ------------------------------------------
# 🧮 Pet Helpers
# ------------------------------------------
def drain_stats(pet):
    last_updated = pet["last_updated"]
    if isinstance(last_updated, str):
        try:
            last_updated = datetime.fromisoformat(last_updated)
        except Exception:
            last_updated = datetime.strptime(last_updated, "%Y-%m-%d %H:%M:%S")

    now = datetime.now()
    minutes_passed = int((now - last_updated).total_seconds() // 60)

    if minutes_passed > 0:
        pet["hunger"] = max(0, pet["hunger"] - minutes_passed * 2)
        pet["energy"] = max(0, pet["energy"] - minutes_passed * 1)
        pet["happiness"] = max(0, pet["happiness"] - minutes_passed * 1)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE pets SET hunger=%s, energy=%s, happiness=%s, last_updated=%s WHERE id=%s""",
            (pet["hunger"], pet["energy"], pet["happiness"], now, pet["id"]),
        )
        conn.commit()
        cursor.close()
        conn.close()

    return pet


def compute_pet_age_days(created_at):
    if not created_at:
        return 0
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except Exception:
            try:
                created_at = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            except Exception:
                return 0
    return (datetime.now() - created_at).days


# ------------------------------------------
# 🐕 Get Pet by User
# ------------------------------------------
@app.route("/get_pet/<int:user_id>", methods=["GET"])
def get_pet(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM pets WHERE user_id = %s OR co_parent_id = %s", (user_id, user_id))
    pet = cursor.fetchone()
    cursor.close()
    conn.close()

    # ✅ Check first before modifying
    if not pet:
        return jsonify({"error": "No pet found"}), 404

    pet["coins"] = pet.get("coins", 0)
    pet = drain_stats(pet)
    pet["pet_age"] = compute_pet_age_days(pet["created_at"])

    # Convert datetimes to strings
    if isinstance(pet.get("created_at"), datetime):
        pet["created_at"] = pet["created_at"].isoformat()
    if isinstance(pet.get("last_updated"), datetime):
        pet["last_updated"] = pet["last_updated"].isoformat()

    return jsonify(pet)


# ------------------------------------------
# 🐕 Get Pet by Pet ID
# ------------------------------------------
@app.route("/get_pet_by_id/<int:pet_id>", methods=["GET"])
def get_pet_by_id(pet_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM pets WHERE id = %s", (pet_id,))
    pet = cursor.fetchone()
    cursor.close()
    conn.close()

    if not pet:
        return jsonify({"error": "Pet not found"}), 404

    pet = drain_stats(pet)
    pet["pet_age"] = compute_pet_age_days(pet["created_at"])

    # Convert datetime to strings
    if isinstance(pet.get("created_at"), datetime):
        pet["created_at"] = pet["created_at"].isoformat()
    if isinstance(pet.get("last_updated"), datetime):
        pet["last_updated"] = pet["last_updated"].isoformat()

    return jsonify(pet)
@app.route("/pet/add_coins", methods=["POST"])
def add_coins():
    data = request.json
    pet_id = data.get("pet_id")
    amount = data.get("amount", 0)

    if not pet_id or amount <= 0:
        return jsonify({"error": "Invalid pet or amount"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE pets SET coins = coins + %s WHERE id = %s", (amount, pet_id))
    conn.commit()
    cursor.execute("SELECT coins FROM pets WHERE id = %s", (pet_id,))
    coins = cursor.fetchone()[0]
    cursor.close()
    conn.close()

    return jsonify({"message": f"{amount} coins added!", "coins": coins}), 200

@app.route("/pet/spend_coins", methods=["POST"])
def spend_coins():
    data = request.json
    pet_id = data.get("pet_id")
    amount = data.get("amount", 0)

    if not pet_id or amount <= 0:
        return jsonify({"error": "Invalid pet or amount"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT coins FROM pets WHERE id = %s", (pet_id,))
    pet = cursor.fetchone()

    if not pet:
        cursor.close()
        conn.close()
        return jsonify({"error": "Pet not found"}), 404

    if pet["coins"] < amount:
        cursor.close()
        conn.close()
        return jsonify({"error": "Not enough coins"}), 400

    cursor.execute("UPDATE pets SET coins = coins - %s WHERE id = %s", (amount, pet_id))
    conn.commit()
    cursor.execute("SELECT coins FROM pets WHERE id = %s", (pet_id,))
    coins = cursor.fetchone()[0]
    cursor.close()
    conn.close()

    return jsonify({"message": f"{amount} coins spent!", "coins": coins}), 200


# ------------------------------------------
# PET ACTIONS
# ------------------------------------------
@app.route("/feed_pet", methods=["POST"])
def feed_pet():
    data = request.get_json()
    pet_id = data.get("pet_id")
    treat_type = data.get("treatType")

    if not pet_id or not treat_type:
        return jsonify({"error": "Missing pet_id or treatType"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Fetch from pets + treats table (adjust names if yours differ)
    cursor.execute("""
        SELECT p.hunger, t.small_treats, t.medium_treats, t.large_treats
        FROM pets p
        JOIN treats t ON p.id = t.pet_id
        WHERE p.id = %s
    """, (pet_id,))
    pet = cursor.fetchone()

    if not pet:
        conn.close()
        return jsonify({"error": "Pet not found"}), 404

    hunger_boosts = {"small": 10, "medium": 25, "large": 50}
    treat_columns = {"small": "small_treats", "medium": "medium_treats", "large": "large_treats"}

    hunger_boost = hunger_boosts.get(treat_type)
    treat_col = treat_columns.get(treat_type)

    if not hunger_boost or treat_col not in pet:
        conn.close()
        return jsonify({"error": "Invalid treat type"}), 400

    if pet[treat_col] <= 0:
        conn.close()
        return jsonify({"error": f"No {treat_type} treats left!"}), 400

    new_hunger = min(100, pet["hunger"] + hunger_boost)

    # Update hunger in pets table
    cursor.execute("UPDATE pets SET hunger = %s WHERE id = %s", (new_hunger, pet_id))
    # Decrement treat count in treats table
    cursor.execute(f"UPDATE treats SET {treat_col} = {treat_col} - 1 WHERE pet_id = %s", (pet_id,))
    conn.commit()

    # Return updated data
    cursor.execute("""
        SELECT p.hunger, t.small_treats, t.medium_treats, t.large_treats
        FROM pets p
        JOIN treats t ON p.id = t.pet_id
        WHERE p.id = %s
    """, (pet_id,))
    updated_pet = cursor.fetchone()
    cursor.close()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"{treat_type.title()} treat eaten!",
        "data": updated_pet
    }), 200



@app.route("/play_pet", methods=["POST"])
def play_pet():
    data = request.json
    pet_id = data.get("pet_id")

    if not pet_id:
        return jsonify({"error": "Missing pet_id"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT happiness FROM pets WHERE id = %s", (pet_id,))
    pet = cursor.fetchone()

    if not pet:
        cursor.close()
        conn.close()
        return jsonify({"error": "Pet not found"}), 404

    new_happiness = min(100, pet["happiness"] + 25)
    cursor.execute("UPDATE pets SET happiness = %s, last_updated = NOW() WHERE id = %s", (new_happiness, pet_id))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True, "message": "🎾 Pet played happily!", "happiness": new_happiness}), 200



sleep_timers = {}

@app.route("/sleep_pet", methods=["POST"])
def sleep_pet():
    data = request.json
    pet_id = data.get("pet_id")

    if not pet_id:
        return jsonify({"error": "Missing pet_id"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT energy FROM pets WHERE id = %s", (pet_id,))
    pet = cursor.fetchone()

    if not pet:
        cursor.close()
        conn.close()
        return jsonify({"error": "Pet not found"}), 404

    new_energy = min(100, pet["energy"] + 50)
    cursor.execute("UPDATE pets SET energy = %s, last_updated = NOW() WHERE id = %s", (new_energy, pet_id))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True, "message": "💤 Pet took a nap!", "energy": new_energy}), 200




@app.route("/check_sleep_status/<pet_id>")
def check_sleep_status(pet_id):
    now = datetime.now()
    if pet_id not in sleep_timers:
        return jsonify({"sleeping": False})
    if now >= sleep_timers[pet_id]:
        # auto wake up after 8h
        del sleep_timers[pet_id]
        return jsonify({"sleeping": False})
    return jsonify({"sleeping": True, "wake_time": sleep_timers[pet_id].isoformat()})

@app.route('/view_stats/<int:user_id>', methods=['GET'])
def view_stats(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT hunger, energy, happiness FROM pets WHERE user_id = %s", (user_id,))
    stats = cursor.fetchone()
    cursor.close()
    conn.close()
    if stats:
        return jsonify(stats)
    else:
        return jsonify({"error": "Pet not found"}), 404

# -------------------------------
# ADMIN USER MANAGEMENT
# -------------------------------
@app.route("/admin/users", methods=["GET"])
def admin_users():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, email, role FROM users ORDER BY id ASC")
    users = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(users), 200


@app.route("/admin/add_user", methods=["POST"])
def admin_add_user():
    data = request.json
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "user")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)",
        (username, email, hashed, role)
    )
    db.commit()
    cursor.close()
    db.close()
    return jsonify({"message": "User added successfully!"}), 201


@app.route("/admin/update_user/<int:user_id>", methods=["PUT"])
def admin_update_user(user_id):
    data = request.json
    username = data.get("username")
    email = data.get("email")
    role = data.get("role")

    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute(
        "UPDATE users SET username=%s, email=%s, role=%s WHERE id=%s",
        (username, email, role, user_id)
    )
    db.commit()
    cursor.close()
    db.close()
    return jsonify({"message": "User updated successfully!"}), 200


@app.route("/admin/delete_user/<int:user_id>", methods=["DELETE"])
def admin_delete_user(user_id):
    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({"message": "User deleted successfully!"}), 200


# -------------------------------
# ADMIN PET MANAGEMENT
# -------------------------------
@app.route("/admin/pets", methods=["GET"])
def admin_pets():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT p.id, p.user_id, u.username AS owner_name, p.pet_name, p.pet_type,
               p.hunger, p.energy, p.happiness, p.co_parent_id, p.created_at
        FROM pets p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.id ASC
    """)
    pets = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(pets), 200


@app.route("/admin/add_pet", methods=["POST"])
def admin_add_pet():
    data = request.json
    user_id = data.get("user_id")
    pet_name = data.get("pet_name")
    pet_type = data.get("pet_type")
    co_parent_id = data.get("co_parent_id")  # fixed name

    if not user_id or not pet_name or not pet_type:
        return jsonify({"error": "All fields are required"}), 400

    db = get_db_connection()
    cursor = db.cursor()
    now = datetime.now()
    cursor.execute("""
        INSERT INTO pets (user_id, pet_name, pet_type, hunger, energy, happiness, co_parent_id, created_at, last_updated)
        VALUES (%s, %s, %s, 100, 100, 100, %s, %s, %s)
    """, (user_id, pet_name, pet_type, co_parent_id, now, now))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({"message": "Pet added successfully!"}), 201


@app.route("/admin/update_pet/<int:pet_id>", methods=["PUT"])
def admin_update_pet(pet_id):
    data = request.json
    pet_name = data.get("pet_name")
    pet_type = data.get("pet_type")
    hunger = data.get("hunger")
    energy = data.get("energy")
    happiness = data.get("happiness")
    co_parent_id = data.get("co_parent_id")  # fixed name

    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("""
        UPDATE pets
        SET pet_name=%s, pet_type=%s, hunger=%s, energy=%s, happiness=%s, co_parent_id=%s
        WHERE id=%s
    """, (pet_name, pet_type, hunger, energy, happiness, co_parent_id, pet_id))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({"message": "Pet updated successfully!"}), 200


@app.route("/admin/delete_pet/<int:pet_id>", methods=["DELETE"])
def admin_delete_pet(pet_id):
    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("DELETE FROM pets WHERE id=%s", (pet_id,))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({"message": "Pet deleted successfully!"}), 200


# ------------------------------------------
# ADMIN LOGOUT ROUTE
# ------------------------------------------
@app.route("/logout", methods=["POST"])
def logout():
    # You can expand this later if you add sessions
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/join_coparent', methods=['POST'])
def join_coparent():
    data = request.get_json()
    pet_id = data.get("pet_id")
    co_parent_id = data.get("user_id")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE pets SET co_parent_id = %s WHERE id = %s", (co_parent_id, pet_id))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Co-parent added successfully!"})

@app.route("/join_pet", methods=["POST"])
def join_pet():
    data = request.json
    co_parent_id = data.get("user_id")
    pet_id = data.get("pet_id")

    if not co_parent_id or not pet_id:
        return jsonify({"error": "Pet ID and User ID required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # 🔍 Check if the pet exists
    cursor.execute("SELECT * FROM pets WHERE id = %s", (pet_id,))
    pet = cursor.fetchone()

    if not pet:
        cursor.close()
        conn.close()
        return jsonify({"error": "Pet not found"}), 404

    # 🧩 Prevent the same person from being both owner and co-parent
    if pet["user_id"] == int(co_parent_id):
        cursor.close()
        conn.close()
        return jsonify({"error": "You are already this pet's owner!"}), 400

    # 🧩 Prevent overwriting another co-parent
    if pet.get("co_parent_id") and pet["co_parent_id"] != int(co_parent_id):
        cursor.close()
        conn.close()
        return jsonify({"error": "This pet already has a co-parent."}), 400

    # ✅ Update pet record to add co-parent
    cursor.execute("UPDATE pets SET co_parent_id = %s WHERE id = %s", (co_parent_id, pet_id))
    conn.commit()

    # 🔁 Fetch updated pet data
    cursor.execute("SELECT * FROM pets WHERE id = %s", (pet_id,))
    updated_pet = cursor.fetchone()

    cursor.close()
    conn.close()

    return jsonify({
        "message": "You are now co-parenting this pet!",
        "pet_id": updated_pet["id"],
        "pet_name": updated_pet["pet_name"],
        "pet_type": updated_pet["pet_type"],
        "hunger": updated_pet["hunger"],
        "energy": updated_pet["energy"],
        "happiness": updated_pet["happiness"],
        "created_at": updated_pet["created_at"]
    }), 200


@app.route("/get_recent_posts", methods=["GET"])
def get_recent_posts():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        from datetime import datetime, timedelta
        two_minutes_ago = datetime.utcnow() - timedelta(minutes=2)

        # JOIN with your users table to get usernames
        cur.execute("""
            SELECT p.id, u.username, p.content, p.created_at
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.created_at >= %s
            ORDER BY p.created_at DESC
            LIMIT 10
        """, (two_minutes_ago,))

        posts = cur.fetchall()
        cur.close()
        conn.close()

        for post in posts:
            if isinstance(post["created_at"], datetime):
                post["created_at"] = post["created_at"].isoformat()

        return jsonify(posts)

    except Exception as e:
        print("⚠️ Error in get_recent_posts:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/get_treats/<int:pet_id>")
def get_treats(pet_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM treats WHERE pet_id=%s", (pet_id,))
    data = cursor.fetchone()
    cursor.close()
    conn.close()
    return jsonify(data or {"small_treats": 0, "medium_treats": 0, "large_treats": 0})

@app.route("/update_pet_coins/<int:pet_id>", methods=["POST"])
def update_pet_coins(pet_id):
    data = request.get_json()
    amount = data.get("amount", 0)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT coins, games_played FROM pets WHERE id=%s", (pet_id,))
    pet = cursor.fetchone()

    if not pet:
        return jsonify({"error": "Pet not found"}), 404

    new_coins = max(0, pet["coins"] + amount)
    new_games = (pet["games_played"] or 0) + 1
    is_dirty = new_games >= 25

    # 20% chance to earn a random treat
    treat_reward = None
    if random.random() < 0.2:
        treat_type = random.choice(["small_treats", "medium_treats", "large_treats"])
        treat_reward = treat_type
        cursor.execute(f"UPDATE treats SET {treat_type} = {treat_type} + 1 WHERE pet_id=%s", (pet_id,))

    cursor.execute("""
        UPDATE pets SET coins=%s, games_played=%s, is_dirty=%s WHERE id=%s
    """, (new_coins, new_games, is_dirty, pet_id))

    conn.commit()
    cursor.close()
    conn.close()

    response = {
        "message": "Coins updated!",
        "coins": new_coins,
        "games_played": new_games,
        "is_dirty": is_dirty
    }
    if treat_reward:
        response["treat_reward"] = treat_reward

    return jsonify(response), 200

# 🎁 Reward treats (from mini-games)
@app.route("/reward_treats/<int:pet_id>", methods=["POST"])
def reward_treats(pet_id):
    data = request.get_json()
    treat_type = data.get("treat_type")
    treat_amount = data.get("treat_amount", 1)
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    if treat_type in ["small", "medium", "large"]:
        column = f"{treat_type}_treats"
        cur.execute(f"UPDATE treats SET {column} = {column} + %s WHERE pet_id = %s", (treat_amount, pet_id))
        conn.commit()

        cur.execute("SELECT small_treats, medium_treats, large_treats FROM treats WHERE pet_id = %s", (pet_id,))
        treats = cur.fetchone()
        conn.close()
        return jsonify({"success": True, "treats": treats})
    
    conn.close()
    return jsonify({"success": False, "error": "Invalid treat type"}), 400


# 🏪 Buy treat with coins
@app.route("/buy_treat/<int:pet_id>", methods=["POST"])
def buy_treat(pet_id):
    data = request.get_json()
    treat_type = data.get("treat_type")

    treat_prices = {"small": 10, "medium": 25, "large": 50}

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT coins FROM pets WHERE id = %s", (pet_id,))
    pet = cur.fetchone()
    if not pet:
        conn.close()
        return jsonify({"error": "Pet not found"}), 404

    coins = pet["coins"]
    cost = treat_prices.get(treat_type)
    if not cost:
        conn.close()
        return jsonify({"error": "Invalid treat type"}), 400

    if coins < cost:
        conn.close()
        return jsonify({"error": "Not enough coins"}), 400

    # Deduct cost and add treat
    cur.execute("UPDATE pets SET coins = coins - %s WHERE id = %s", (cost, pet_id))
    cur.execute(f"UPDATE treats SET {treat_type}_treats = {treat_type}_treats + 1 WHERE pet_id = %s", (pet_id,))
    conn.commit()

    # Return updated data
    cur.execute("""
        SELECT p.coins, t.small_treats, t.medium_treats, t.large_treats
        FROM pets p
        JOIN treats t ON p.id = t.pet_id
        WHERE p.id = %s
    """, (pet_id,))
    updated = cur.fetchone()
    conn.close()

    return jsonify({"success": True, "data": updated})

@app.route("/game_win/<int:pet_id>", methods=["POST"])
def game_win(pet_id):
    data = request.json
    level = data.get("level")
    if level not in ["easy", "medium", "hard"]:
        return jsonify({"error": "Invalid level"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Get or create stats record
    cursor.execute("SELECT * FROM game_stats WHERE pet_id = %s", (pet_id,))
    stats = cursor.fetchone()
    if not stats:
        cursor.execute("INSERT INTO game_stats (pet_id, easy_wins, medium_wins, hard_wins) VALUES (%s, 0, 0, 0)", (pet_id,))
        conn.commit()
        cursor.execute("SELECT * FROM game_stats WHERE pet_id = %s", (pet_id,))
        stats = cursor.fetchone()

    # Increase the win count
    field = f"{level}_wins"
    cursor.execute(f"UPDATE game_stats SET {field} = {field} + 1 WHERE pet_id = %s", (pet_id,))
    conn.commit()

    # Fetch updated stats
    cursor.execute("SELECT * FROM game_stats WHERE pet_id = %s", (pet_id,))
    stats = cursor.fetchone()

    treat_type = None
    reward_treats = 0
    wins = stats[field]

    # 🎯 Reward logic
    if wins % 10 == 0:
        treat_type = {
            "easy": "small_treats",
            "medium": "medium_treats",
            "hard": "large_treats"
        }[level]

        # Every 100 wins gives 5 total (1 + 4 bonus)
        reward_treats = 5 if wins % 100 == 0 else 1

        cursor.execute(f"UPDATE treats SET {treat_type} = {treat_type} + %s WHERE pet_id = %s", (reward_treats, pet_id))
        conn.commit()

    conn.close()
    return jsonify({
        "success": True,
        "treat_type": treat_type,
        "reward_treats": reward_treats,
        "easy_wins": stats["easy_wins"],
        "medium_wins": stats["medium_wins"],
        "hard_wins": stats["hard_wins"]
    })




@app.route("/get_game_progress")
def get_game_progress():
    # You can associate with logged-in user or pet_id
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT coins, easy_wins, medium_wins, hard_wins FROM game_progress WHERE id = 1")
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"coins": 0, "treatProgress": {"easy": 0, "medium": 0, "hard": 0}})

    return jsonify({
        "coins": row["coins"],
        "treatProgress": {
            "easy": row["easy_wins"],
            "medium": row["medium_wins"],
            "hard": row["hard_wins"]
        }
    })


@app.route("/save_game_progress", methods=["POST"])
def save_game_progress():
    data = request.json
    coins = data.get("coins", 0)
    tp = data.get("treatProgress", {})
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE game_progress
        SET coins = %s, easy_wins = %s, medium_wins = %s, hard_wins = %s
        WHERE id = 1
    """, (coins, tp.get("easy", 0), tp.get("medium", 0), tp.get("hard", 0)))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/get_game_stats/<int:pet_id>", methods=["GET"])
def get_game_stats(pet_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT easy_wins, medium_wins, hard_wins
        FROM game_stats
        WHERE pet_id = %s
    """, (pet_id,))
    stats = cursor.fetchone()
    cursor.close()
    conn.close()

    if not stats:
        return jsonify({"error": "No stats found"}), 404

    return jsonify(stats)

@app.route("/record_game_win/<int:pet_id>", methods=["POST"])
def record_game_win(pet_id):
    data = request.get_json() or {}
    difficulty = data.get("difficulty")
    print(f"🎮 Received win for pet_id={pet_id}, difficulty={difficulty}")

    if difficulty not in ("easy", "medium", "hard"):
        return jsonify({"success": False, "error": "Invalid difficulty"}), 400

    mapping = {
        "easy":   {"gs_col": "easy_wins",   "treat_col": "small_treats",  "coins": 5,  "treat_name": "small"},
        "medium": {"gs_col": "medium_wins", "treat_col": "medium_treats", "coins": 10, "treat_name": "medium"},
        "hard":   {"gs_col": "hard_wins",   "treat_col": "large_treats",  "coins": 20, "treat_name": "large"},
    }
    cfg = mapping[difficulty]
    gs_col = cfg["gs_col"]
    treat_col = cfg["treat_col"]
    coin_reward = cfg["coins"]
    treat_name = cfg["treat_name"]

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        # ensure game_stats exists
        cur.execute("SELECT * FROM game_stats WHERE pet_id = %s", (pet_id,))
        gs = cur.fetchone()
        if not gs:
            cur.execute(
                "INSERT INTO game_stats (pet_id, easy_wins, medium_wins, hard_wins) VALUES (%s, 0, 0, 0)",
                (pet_id,)
            )
            conn.commit()

        # increment win counter
        cur.execute(f"UPDATE game_stats SET {gs_col} = {gs_col} + 1 WHERE pet_id = %s", (pet_id,))
        conn.commit()

        # get updated stats
        cur.execute("SELECT easy_wins, medium_wins, hard_wins FROM game_stats WHERE pet_id = %s", (pet_id,))
        stats = cur.fetchone()
        wins = stats[gs_col]

        treat_given = None
        treat_amount = 0

        # ✅ Reward coins every single win
        cur.execute("UPDATE pets SET coins = COALESCE(coins, 0) + %s WHERE id = %s", (coin_reward, pet_id))
        conn.commit()

        # 🎁 Give extra treat every 10 wins
        if wins % 10 == 0:
            treat_given = treat_name
            treat_amount = 1
            cur.execute("SELECT * FROM treats WHERE pet_id = %s", (pet_id,))
            trow = cur.fetchone()
            if not trow:
                cur.execute(
                    "INSERT INTO treats (pet_id, small_treats, medium_treats, large_treats) VALUES (%s, 0, 0, 0)",
                    (pet_id,)
                )
                conn.commit()
            cur.execute(f"UPDATE treats SET {treat_col} = {treat_col} + %s WHERE pet_id = %s",
                        (treat_amount, pet_id))
            conn.commit()

        response = {
            "success": True,
            "progress": stats,
            "coin_reward": coin_reward
        }

        if treat_given:
            response["treat"] = treat_given
            response["treat_amount"] = treat_amount

        print("✅ Win recorded:", response)
        return jsonify(response)

    except Exception as e:
        conn.rollback()
        print("❌ Error in record_game_win:", e)
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cur.close()
        conn.close()



# ------------------------------------------
# ROUTE REGISTRATION
# ------------------------------------------


@app.route('/')
def home():
    return render_template('login.html')

@app.route('/main')
def main_page():
    return render_template('main.html')

@app.route('/community')
def community_page():
    return render_template('community.html')

@app.route('/minigames')
def minigames_page():
    return render_template('minigames.html')

if __name__ == "__main__":
    app.run(debug=True)
