from flask import Blueprint, request, jsonify
from datetime import datetime
from connection import get_db_connection
import mysql.connector

community = Blueprint("community", __name__)

# 🐾 Create Post
@community.route("/create_post", methods=["POST"])
def create_post():
    data = request.get_json()
    user_id = data.get("user_id")
    content = data.get("content")
    image_url = data.get("image_url", "")

    if not user_id or not content:
        return jsonify({"error": "Missing user_id or content"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO posts (user_id, content, image_url, created_at) VALUES (%s, %s, %s, NOW())",
            (user_id, content, image_url),
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Post created successfully!"}), 201
    except mysql.connector.Error as err:
        print("❌ create_post error:", err)
        return jsonify({"error": str(err)}), 500


# 🐾 Get Posts with username, like count, and comment count
@community.route("/posts", methods=["GET"])
def get_posts():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT 
                p.id,
                p.user_id,
                u.username,
                p.content,
                p.image_url,
                p.created_at,
                (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count
            FROM posts p
            INNER JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        """)
        posts = cur.fetchall()
        cur.close()
        conn.close()

        # Ensure correct JSON formatting
        for post in posts:
            if isinstance(post["created_at"], datetime):
                post["created_at"] = post["created_at"].isoformat()
            post["likes_count"] = int(post["likes_count"])
            post["comments_count"] = int(post["comments_count"])

        return jsonify(posts)
    except mysql.connector.Error as err:
        print("❌ get_posts error:", err)
        return jsonify({"error": str(err)}), 500


# 🐾 Like or Unlike Post
@community.route("/like", methods=["POST"])
def like_post():
    data = request.get_json()
    post_id = data.get("post_id")
    user_id = data.get("user_id")

    if not post_id or not user_id:
        return jsonify({"error": "Missing post_id or user_id"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Check if user already liked post
        cur.execute("SELECT id FROM likes WHERE post_id=%s AND user_id=%s", (post_id, user_id))
        existing = cur.fetchone()

        if existing:
            cur.execute("DELETE FROM likes WHERE post_id=%s AND user_id=%s", (post_id, user_id))
            message = "Unliked"
        else:
            cur.execute(
                "INSERT INTO likes (post_id, user_id, created_at) VALUES (%s, %s, NOW())",
                (post_id, user_id),
            )
            message = "Liked"

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": message}), 200
    except mysql.connector.Error as err:
        print("❌ like_post error:", err)
        return jsonify({"error": str(err)}), 500


# 🐾 Get Comments
@community.route("/comments/<int:post_id>", methods=["GET"])
def get_comments(post_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT 
                c.id,
                c.comment,
                c.created_at,
                u.username
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = %s
            ORDER BY c.created_at ASC
        """, (post_id,))
        comments = cur.fetchall()
        cur.close()
        conn.close()

        for c in comments:
            if isinstance(c["created_at"], datetime):
                c["created_at"] = c["created_at"].isoformat()

        return jsonify(comments)
    except mysql.connector.Error as err:
        print("❌ get_comments error:", err)
        return jsonify({"error": str(err)}), 500


# 🐾 Add Comment
@community.route("/comment", methods=["POST"])
def add_comment():
    data = request.get_json()
    post_id = data.get("post_id")
    user_id = data.get("user_id")
    comment = data.get("comment")

    if not post_id or not user_id or not comment:
        return jsonify({"error": "Missing required fields"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO comments (post_id, user_id, comment, created_at) VALUES (%s, %s, %s, NOW())",
            (post_id, user_id, comment),
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Comment added successfully!"}), 201
    except mysql.connector.Error as err:
        print("❌ add_comment error:", err)
        return jsonify({"error": str(err)}), 500
