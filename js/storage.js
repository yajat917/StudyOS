const STORAGE_KEY = "studyos-data";
const DEFAULT_GAMIFICATION = { xp: 0, streak: 0, lastStudyDate: "", badges: [], focusSessions: 0 };
const SAMPLE_LOGS = [
  { date: "2026-06-18", subject: "Math", hours: 2 }, { date: "2026-06-19", subject: "Physics", hours: 1.5 },
  { date: "2026-06-20", subject: "Chemistry", hours: 2.5 }, { date: "2026-06-21", subject: "Math", hours: 1 },
  { date: "2026-06-22", subject: "Physics", hours: 2 }, { date: "2026-06-23", subject: "Chemistry", hours: 1.5 },
  { date: "2026-06-24", subject: "Math", hours: 2 },
];
const BADGES = [
  { id: "first-session", name: "First Focus", xpRequired: 25 }, { id: "plan-master", name: "Plan Master", xpRequired: 50 },
  { id: "streak-3", name: "3-Day Streak", xpRequired: 75 }, { id: "week-warrior", name: "Week Warrior", xpRequired: 100 },
  { id: "scholar", name: "Scholar", xpRequired: 200 },
];
const ALL_SUBJECTS = ["Math", "Physics", "Chemistry", "Biology", "English", "History"];
function getData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed) return { profile: parsed.profile || null, studyLogs: parsed.studyLogs?.length ? parsed.studyLogs : SAMPLE_LOGS, studyPlan: parsed.studyPlan || "", gamification: { ...DEFAULT_GAMIFICATION, ...parsed.gamification }, goals: parsed.goals || [], focusHistory: parsed.focusHistory || [], aiScoreCached: parsed.aiScoreCached || null };
  } catch (error) { console.error(error); }
  return { profile: null, studyLogs: SAMPLE_LOGS, studyPlan: "", gamification: { ...DEFAULT_GAMIFICATION }, goals: [], focusHistory: [], aiScoreCached: null };
}
function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function updateData(partial) { const next = { ...getData(), ...partial }; saveData(next); return next; }
function getLevelInfo(xp) { const level = Math.floor(xp / 100) + 1; return { level, title: level >= 10 ? "Study Master" : level >= 5 ? "Focused Learner" : "Beginner" }; }
function addXP(amount) { const data = getData(); const today = new Date().toISOString().split("T")[0]; let streak = data.gamification.streak; if (data.gamification.lastStudyDate) { const diff = Math.floor((new Date(today) - new Date(data.gamification.lastStudyDate)) / 86400000); if (diff === 1) streak += 1; else if (diff > 1) streak = 1; } else streak = 1; const xp = data.gamification.xp + amount; const badges = [...data.gamification.badges]; BADGES.forEach((b) => { if (xp >= b.xpRequired && !badges.includes(b.id)) badges.push(b.id); }); return updateData({ gamification: { ...data.gamification, xp, streak, lastStudyDate: today, badges } }); }
function getWeeklyHours(logs) { const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); return logs.filter((l) => new Date(l.date) >= weekAgo).reduce((sum, l) => sum + l.hours, 0); }
function getExamCountdown(examDate) { if (!examDate) return null; return Math.max(0, Math.ceil((new Date(examDate) - Date.now()) / 86400000)); }
function showAlert(el, message, type = "error") { if (!el) return; el.textContent = message; el.className = `alert alert-${type}`; el.classList.remove("hidden"); }
function hideAlert(el) { if (el) el.classList.add("hidden"); }
function showSpinner(container, text = "Creating your personalized plan...") { container.innerHTML = `<div class="spinner-wrap loading-container"><div class="ai-loader-icon">🤖</div><h3 class="loading-title">StudyOS AI is analyzing...</h3><p class="loading-subtitle">${text}</p><div class="loading-bar-wrap"><div class="loading-bar-fill"></div></div></div>`; }
function renderBadges(container, earnedIds) { container.innerHTML = BADGES.map((b) => `<span class="badge ${earnedIds.includes(b.id) ? "earned" : "locked"}">${earnedIds.includes(b.id) ? "✓" : "○"} ${b.name}</span>`).join(""); }
function initTheme() { const saved = localStorage.getItem("studyos-theme") || "dark"; document.documentElement.setAttribute("data-theme", saved); document.querySelectorAll(".theme-btn").forEach((btn) => { btn.textContent = saved === "dark" ? "🌙" : "☀️"; btn.addEventListener("click", () => { const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", next); localStorage.setItem("studyos-theme", next); document.querySelectorAll(".theme-btn").forEach((b) => { b.textContent = next === "dark" ? "🌙" : "☀️"; }); }); }); }
function initNavbar() { const current = location.pathname.split("/").pop() || "index.html"; document.querySelectorAll(".nav-links a, .mobile-menu a").forEach((link) => { if (link.getAttribute("href") === current || (current === "" && link.getAttribute("href") === "index.html")) link.classList.add("active"); }); const menuBtn = document.querySelector(".menu-btn"); const mobileMenu = document.querySelector(".mobile-menu"); if (menuBtn && mobileMenu) menuBtn.addEventListener("click", () => { mobileMenu.classList.toggle("open"); menuBtn.textContent = mobileMenu.classList.contains("open") ? "✕" : "☰"; }); }
document.addEventListener("DOMContentLoaded", () => { initTheme(); initNavbar(); });
