# reset_admin_password.py
import getpass
import bcrypt
from connection import get_db_connection

def main():
    username = input("Admin username to create/update (default 'admin'): ").strip() or "admin"
    passwd = getpass.getpass("New admin password: ")
    confirm = getpass.getpass("Confirm password: ")
    if passwd != confirm:
        print("Passwords do not match. Exiting.")
        return

    # create bcrypt hash
    hashed = bcrypt.hashpw(passwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE username=%s", (username,))
        row = cursor.fetchone()
        if row:
            cursor.execute("UPDATE users SET password=%s, role=%s WHERE username=%s",
                           (hashed, "admin", username))
            print(f"Updated password and role for existing user '{username}'.")
        else:
            email = input("Email for new admin (default admin@example.com): ").strip() or "admin@example.com"
            cursor.execute("INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)",
                           (username, email, hashed, "admin"))
            print(f"Created new admin user '{username}'.")
        conn.commit()
    except Exception as e:
        print("Error:", e)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
