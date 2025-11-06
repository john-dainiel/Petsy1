const backendUrl = "http://localhost:5000";

async function createPost() {
  const user_id = localStorage.getItem("user_id");
  const content = document.getElementById("postContent").value.trim();
  const image_url = document.getElementById("postImage").value.trim();

  if (!user_id) return alert("Please log in first.");
  if (!content) return alert("Post cannot be empty!");

  await fetch(`${backendUrl}/community/create_post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, content, image_url }),
  });

  document.getElementById("postContent").value = "";
  document.getElementById("postImage").value = "";
  loadFeed();
}

async function loadFeed() {
  const res = await fetch(`${backendUrl}/community/posts`);
  const posts = await res.json();

  const feed = document.getElementById("feed");
  feed.innerHTML = "";

  posts.forEach((p) => {
    const postEl = document.createElement("div");
    postEl.className = "post";
    postEl.innerHTML = `
      <div class="post-header">
        <img src="https://cdn-icons-png.flaticon.com/512/616/616408.png" alt="profile" />
        <div>
          <div class="username">@${p.username}</div>
          <div class="time">${new Date(p.created_at).toLocaleString()}</div>
        </div>
      </div>

      <div class="post-body">${p.content}</div>

      ${p.image_url ? `<img src="${p.image_url}" class="post-img" alt="pet image" />` : ""}

      <div class="post-footer">
        <span>❤️ ${p.likes_count} Likes | 💬 ${p.comments_count} Comments</span>
        <div>
          <button onclick="likePost(${p.id})">Like</button>
          <button onclick="viewComments(${p.id})">Comments</button>
        </div>
      </div>

      <div id="comments-${p.id}" class="comments"></div>
    `;
    feed.appendChild(postEl);
  });
}

async function likePost(post_id) {
  const user_id = localStorage.getItem("user_id");
  if (!user_id) return alert("Please log in first.");

  await fetch(`${backendUrl}/community/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id, user_id }),
  });

  loadFeed();
}

async function viewComments(post_id) {
  const res = await fetch(`${backendUrl}/community/comments/${post_id}`);
  const comments = await res.json();

  const commentsDiv = document.getElementById(`comments-${post_id}`);
  const user_id = localStorage.getItem("user_id");
  const commentBox = `
    <textarea id="comment-input-${post_id}" placeholder="Write a comment..."></textarea>
    <button onclick="addComment(${post_id})">Send</button>
  `;

  commentsDiv.innerHTML = `
    ${comments.map(c => `<div class="comment"><b>@${c.username}</b>: ${c.comment}</div>`).join("")}
    ${user_id ? commentBox : "<p>Login to comment</p>"}
  `;
}

async function addComment(post_id) {
  const user_id = localStorage.getItem("user_id");
  const comment = document.getElementById(`comment-input-${post_id}`).value.trim();
  if (!comment) return;

  await fetch(`${backendUrl}/community/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id, user_id, comment }),
  });

  viewComments(post_id);
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", loadFeed);
