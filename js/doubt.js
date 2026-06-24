let hasMessages = false;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("question").value.trim();
    const subject = document.getElementById("doubt-subject").value;
    if (q) ask(q, subject);
  });

  document.querySelectorAll(".suggestion-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const subject = document.getElementById("doubt-subject").value;
      ask(btn.dataset.q, subject);
    });
  });
});

function addMessage(role, content) {
  const box = document.getElementById("chat-box");
  if (!hasMessages) {
    box.innerHTML = "";
    hasMessages = true;
  }

  const div = document.createElement("div");
  div.className = `chat-msg ${role === "user" ? "user" : "ai"}`;
  if (role === "assistant") {
    div.innerHTML = `<div class="sender">StudyOS AI</div><div class="msg-text"></div>`;
    div.querySelector(".msg-text").textContent = content;
  } else {
    div.textContent = content;
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function ask(question, subject) {
  const alertEl = document.getElementById("alert");
  const input = document.getElementById("question");
  const btn = document.querySelector("#chat-form button");
  hideAlert(alertEl);

  addMessage("user", `[${subject}] ${question}`);
  input.value = "";
  btn.disabled = true;
  input.disabled = true;

  const loading = document.createElement("div");
  loading.className = "spinner-wrap";
  loading.innerHTML = `
    <div class="loading-container" style="padding: 1rem 0">
      <div class="ai-loader-icon" style="font-size: 2rem; margin-bottom: 0.5rem">🤖</div>
      <h4 class="loading-title" style="font-size: 1rem">StudyOS AI is thinking...</h4>
    </div>`;
  document.getElementById("chat-box").appendChild(loading);

  try {
    const answer = await tryAI(
      () => askDoubt(question, subject),
      () => getDemoAnswer(question, subject)
    );
    loading.remove();
    addMessage("assistant", answer);
    addXP(10);
  } catch (err) {
    loading.remove();
    showAlert(alertEl, err.message);
  } finally {
    btn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}
