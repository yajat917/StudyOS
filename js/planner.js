const SUBJECT_OPTIONS = ["Math", "Physics", "Chemistry", "Biology", "English"];
let selectedSubjects = ["Math", "Physics", "Chemistry"];

document.addEventListener("DOMContentLoaded", () => {
  const data = getData();
  if (data.profile?.subjects?.length) selectedSubjects = [...data.profile.subjects];
  if (data.profile?.examDate) document.getElementById("exam-date").value = data.profile.examDate;
  if (data.profile?.dailyHours) {
    document.getElementById("hours").value = data.profile.dailyHours;
    document.getElementById("hours-val").textContent = data.profile.dailyHours;
  }
  if (data.studyPlan) {
    document.getElementById("plan-output").innerHTML = `<pre class="output-text">${data.studyPlan}</pre>`;
  }

  renderSubjectPills();
  renderWeakTopics();
  renderRevSubjectSelect();

  document.getElementById("hours").addEventListener("input", (e) => {
    document.getElementById("hours-val").textContent = e.target.value;
  });

  document.getElementById("gen-plan").addEventListener("click", generatePlan);
  document.getElementById("gen-revision").addEventListener("click", generateRevisionNotes);
});

function renderSubjectPills() {
  const container = document.getElementById("subject-pills");
  container.innerHTML = SUBJECT_OPTIONS.map((s) =>
    `<button type="button" class="pill ${selectedSubjects.includes(s) ? "active" : ""}" data-subject="${s}">${s}</button>`
  ).join("");

  container.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sub = btn.dataset.subject;
      if (selectedSubjects.includes(sub)) {
        selectedSubjects = selectedSubjects.filter((x) => x !== sub);
      } else {
        selectedSubjects.push(sub);
      }
      renderSubjectPills();
      renderWeakTopics();
      renderRevSubjectSelect();
    });
  });
}

function renderWeakTopics() {
  const container = document.getElementById("weak-topics");
  container.innerHTML = selectedSubjects.map((s) => `
    <div class="form-group">
      <label>Weak topics in ${s} (comma-separated)</label>
      <input type="text" class="input weak-input" data-subject="${s}" placeholder="e.g. Algebra, Geometry">
    </div>`).join("");
}

function renderRevSubjectSelect() {
  const sel = document.getElementById("rev-subject");
  sel.innerHTML = selectedSubjects.map((s) => `<option value="${s}">${s}</option>`).join("");
}

async function generatePlan() {
  const alertEl = document.getElementById("alert");
  const btn = document.getElementById("gen-plan");
  const output = document.getElementById("plan-output");
  hideAlert(alertEl);

  const examDate = document.getElementById("exam-date").value;
  const hours = Number(document.getElementById("hours").value);

  if (!examDate || !selectedSubjects.length) {
    showAlert(alertEl, "Please select an exam date and at least one subject.");
    return;
  }

  const weakTopics = {};
  document.querySelectorAll(".weak-input").forEach((input) => {
    const val = input.value.trim();
    if (val) {
      weakTopics[input.dataset.subject] = val.split(",").map((t) => t.trim()).filter(Boolean);
    }
  });

  btn.disabled = true;
  showSpinner(output, "AI is creating your plan...");

  try {
    const plan = await tryAI(
      () => generateStudyPlan(examDate, selectedSubjects, weakTopics, hours),
      () => getDemoPlan(selectedSubjects, hours)
    );
    output.innerHTML = `<pre class="output-text">${plan}</pre>`;
    updateData({ studyPlan: plan });
    addXP(20); // Generate plan: +20 XP
  } catch (err) {
    showAlert(alertEl, err.message);
    output.innerHTML = `<p style="color:var(--muted)">Failed to generate plan.</p>`;
  } finally {
    btn.disabled = false;
  }
}

async function generateRevisionNotes() {
  const alertEl = document.getElementById("alert");
  const output = document.getElementById("revision-output");
  const btn = document.getElementById("gen-revision");
  const subject = document.getElementById("rev-subject").value;
  const chapter = document.getElementById("rev-chapter").value.trim();

  hideAlert(alertEl);
  if (!chapter) {
    showAlert(alertEl, "Please enter a chapter name.");
    return;
  }

  btn.disabled = true;
  showSpinner(output, "Creating revision notes...");

  try {
    const result = await tryAI(
      () => generateRevision(subject, chapter),
      () => getDemoRevision(subject, chapter)
    );

    output.innerHTML = `
      <div class="glass" style="margin-top: 1.25rem; background: rgba(99, 102, 241, 0.05); text-align: left">
        <h3 class="gradient-text" style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem">Chapter: ${result.chapter || chapter}</h3>
        
        <div class="section-title indigo">Important Concepts:</div>
        <ol class="notes-list" style="margin-left: 1.25rem; margin-bottom: 1.25rem">
          ${result.concepts.map((c) => `<li style="margin-bottom: 0.5rem; font-size: 0.9rem">${c}</li>`).join("")}
        </ol>
        
        ${result.formulas && result.formulas.length ? `
          <div class="section-title green">Important Formulas:</div>
          <div class="formula-list" style="margin-bottom: 1.25rem">
            ${result.formulas.map((f) => `<span class="formula-chip">${f}</span>`).join("")}
          </div>
        ` : ""}
        
        <div class="section-title yellow" style="margin-bottom: 0.5rem">Revision Checklist:</div>
        <div class="revision-checklist" style="display:flex; flex-direction:column; gap:0.5rem">
          <label class="goal-item" style="cursor: pointer">
            <input type="checkbox" class="goal-checkbox">
            <span class="goal-text">Concept revision</span>
          </label>
          <label class="goal-item" style="cursor: pointer">
            <input type="checkbox" class="goal-checkbox">
            <span class="goal-text">Practice questions</span>
          </label>
          <label class="goal-item" style="cursor: pointer">
            <input type="checkbox" class="goal-checkbox">
            <span class="goal-text">Previous year questions</span>
          </label>
        </div>
      </div>`;
    addXP(10); // Generating notes/concepts fallback
  } catch (err) {
    showAlert(alertEl, err.message);
    output.innerHTML = "";
  } finally {
    btn.disabled = false;
  }
}
