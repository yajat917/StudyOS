let form = {
  name: "",
  grade: "",
  subjects: ["Math", "Physics", "Chemistry"],
  strengths: [],
  weaknesses: [],
  examDate: "",
  dailyHours: 3,
};

document.addEventListener("DOMContentLoaded", () => {
  const data = getData();
  if (data.profile) form = { ...form, ...data.profile };

  document.getElementById("name").value = form.name;
  document.getElementById("grade").value = form.grade;
  document.getElementById("exam-date").value = form.examDate;
  document.getElementById("daily-hours").value = form.dailyHours;
  document.getElementById("hours-val").textContent = form.dailyHours;

  renderPills("subjects", form.subjects, "");
  renderPills("strengths", form.strengths, "green");
  renderPills("weaknesses", form.weaknesses, "red");

  document.getElementById("daily-hours").addEventListener("input", (e) => {
    form.dailyHours = Number(e.target.value);
    document.getElementById("hours-val").textContent = e.target.value;
  });

  document.getElementById("save-btn").addEventListener("click", saveProfile);
});

function renderPills(id, selected, colorClass) {
  const container = document.getElementById(id);
  container.innerHTML = ALL_SUBJECTS.map((s) => {
    const active = selected.includes(s);
    return `<button type="button" class="pill ${colorClass} ${active ? "active" : ""}" data-subject="${s}">${s}</button>`;
  }).join("");

  const field = id === "subjects" ? "subjects" : id === "strengths" ? "strengths" : "weaknesses";

  container.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sub = btn.dataset.subject;
      if (form[field].includes(sub)) {
        form[field] = form[field].filter((x) => x !== sub);
      } else {
        form[field].push(sub);
      }
      renderPills(id, form[field], colorClass);
    });
  });
}

function saveProfile() {
  form.name = document.getElementById("name").value.trim();
  form.grade = document.getElementById("grade").value.trim();
  form.examDate = document.getElementById("exam-date").value;
  form.dailyHours = Number(document.getElementById("daily-hours").value);

  updateData({ profile: { ...form } });

  const alertEl = document.getElementById("alert");
  showAlert(alertEl, "Profile saved successfully!", "success");
  document.getElementById("save-btn").textContent = "✓ Saved!";
  setTimeout(() => {
    document.getElementById("save-btn").textContent = "Save Profile";
  }, 2000);
}
