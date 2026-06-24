const WORK = 25 * 60;
const BREAK = 5 * 60;
const CIRCUMFERENCE = 2 * Math.PI * 100;

let phase = "idle";
let secondsLeft = WORK;
let running = false;
let interval = null;
let sessions = 0;

document.addEventListener("DOMContentLoaded", () => {
  sessions = getData().gamification.focusSessions || 0;
  renderFocusStats();
  updateDisplay();

  document.getElementById("start-btn").addEventListener("click", start);
  document.getElementById("pause-btn").addEventListener("click", pause);
  document.getElementById("reset-btn").addEventListener("click", reset);
});

function renderFocusStats() {
  const data = getData();
  const today = new Date().toISOString().split("T")[0];
  const todaySessions = (data.focusHistory || []).filter(h => h.date === today);
  const count = todaySessions.length;
  const time = todaySessions.reduce((sum, h) => sum + h.duration, 0);

  document.getElementById("today-sessions").textContent = count;
  document.getElementById("today-time").textContent = time + "m";
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateDisplay() {
  document.getElementById("timer").textContent = formatTime(secondsLeft);
  const total = phase === "break" ? BREAK : WORK;
  const progress = phase === "idle" ? 0 : (total - secondsLeft) / total;
  const ring = document.getElementById("progress-ring");
  ring.setAttribute("stroke-dashoffset", CIRCUMFERENCE * (1 - progress));
  ring.setAttribute("stroke", phase === "break" ? "#4ade80" : "#6366f1");

  const labels = { idle: "Ready", work: "Focus Time", break: "Break Time" };
  document.getElementById("phase-label").textContent = labels[phase] || "Ready";
}

function tick() {
  if (secondsLeft <= 1) {
    onComplete();
    return;
  }
  secondsLeft--;
  updateDisplay();
}

function onComplete() {
  if (phase === "work") {
    sessions++;
    const data = getData();
    const today = new Date().toISOString().split("T")[0];
    const newHistory = [...(data.focusHistory || [])];
    newHistory.push({ date: today, duration: 25 }); // 25 min session

    updateData({
      gamification: { ...data.gamification, focusSessions: sessions },
      focusHistory: newHistory
    });

    addXP(25); // Focus session completed: +25 XP

    phase = "break";
    secondsLeft = BREAK;
  } else if (phase === "break") {
    phase = "work";
    secondsLeft = WORK;
  }
  updateDisplay();
  renderFocusStats();
}

function start() {
  if (phase === "idle") {
    phase = "work";
    secondsLeft = WORK;
    updateDisplay();
  }
  running = true;
  document.getElementById("start-btn").classList.add("hidden");
  document.getElementById("pause-btn").classList.remove("hidden");
  interval = setInterval(tick, 1000);
}

function pause() {
  running = false;
  clearInterval(interval);
  document.getElementById("start-btn").classList.remove("hidden");
  document.getElementById("start-btn").textContent = "Resume";
  document.getElementById("pause-btn").classList.add("hidden");
}

function reset() {
  clearInterval(interval);
  running = false;
  phase = "idle";
  secondsLeft = WORK;
  document.getElementById("start-btn").classList.remove("hidden");
  document.getElementById("start-btn").textContent = "Start";
  document.getElementById("pause-btn").classList.add("hidden");
  updateDisplay();
}
