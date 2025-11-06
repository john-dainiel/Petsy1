import bcrypt
import mysql.connector

db = mysql.connector.connect(
    host="localhost",
    user="root",             # change to your DB user
    password="your_db_pass", # change
    database="your_database" # change
)
cursor = db.cursor()

new_password = "My$tr0ngP@ss!"   # set your new secure password here
hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

cursor.execute(
    "UPDATE users SET password = %s WHERE username = %s",
    (hashed, "admin")
)
db.commit()
cursor.close()
db.close()
print("✅ Admin password updated.")
