const marks = { Math: 65, Physics: 75, Chemistry: 90 };

document.addEventListener("DOMContentLoaded", () => {
  const data = getData();
  const logs = data.studyLogs;

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  document.getElementById("total-hours").textContent = totalHours.toFixed(1) + "h";
  document.getElementById("xp").textContent = data.gamification.xp + " XP";

  const subjectTotals = {};
  logs.forEach((l) => {
    subjectTotals[l.subject] = (subjectTotals[l.subject] || 0) + l.hours;
  });
  const subjects = Object.keys(subjectTotals);
  document.getElementById("subject-count").textContent = subjects.length;

  const labels = logs.map((l) => {
    const d = new Date(l.date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const hours = logs.map((l) => l.hours);

  new Chart(document.getElementById("line-chart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Hours Studied",
        data: hours,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.15)",
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
      },
    },
  });

  new Chart(document.getElementById("pie-chart"), {
    type: "pie",
    data: {
      labels: subjects,
      datasets: [{
        data: Object.values(subjectTotals),
        backgroundColor: ["#6366f1", "#4ade80", "#fbbf24", "#f472b6", "#38bdf8"],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#94a3b8" } } },
    },
  });

  renderMarksInputs();
  document.getElementById("analyze-btn").addEventListener("click", runAnalysis);
});

function renderMarksInputs() {
  const data = getData();
  const activeSubjects = data.profile?.subjects || ["Math", "Physics", "Chemistry"];
  
  const marksMap = {};
  activeSubjects.forEach(s => {
    marksMap[s] = marks[s] !== undefined ? marks[s] : 75;
  });

  document.getElementById("marks-inputs").innerHTML = Object.entries(marksMap).map(([subject, score]) => `
    <div class="form-group">
      <label>${subject} (%)</label>
      <input type="number" class="input mark-input" data-subject="${subject}" min="0" max="100" value="${score}">
    </div>`).join("");
}

async function runAnalysis() {
  const alertEl = document.getElementById("alert");
  const output = document.getElementById("analysis-output");
  const btn = document.getElementById("analyze-btn");
  hideAlert(alertEl);

  const currentMarks = {};
  document.querySelectorAll(".mark-input").forEach((input) => {
    currentMarks[input.dataset.subject] = Number(input.value);
  });

  const data = getData();
  const studyTime = {};
  data.studyLogs.forEach((l) => {
    studyTime[l.subject] = (studyTime[l.subject] || 0) + l.hours;
  });

  const focusCount = data.gamification.focusSessions || 0;
  const weakList = data.profile?.weaknesses || [];

  btn.disabled = true;
  showSpinner(output, "AI is analyzing your performance...");

  try {
    const analysis = await tryAI(
      () => analyzeWeakness(currentMarks, studyTime, focusCount, weakList),
      () => getDemoAnalysis(currentMarks, weakList)
    );
    output.innerHTML = `<div class="glass" style="background:rgba(99,102,241,0.08); text-align:left"><pre class="output-text">${analysis}</pre></div>`;
  } catch (err) {
    showAlert(alertEl, err.message);
    output.innerHTML = "";
  } finally {
    btn.disabled = false;
  }
}
