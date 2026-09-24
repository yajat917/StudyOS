// AI calls are proxied through the server-side /api/chat function.
const CLIENT_TIMEOUT_MS = 25000;

class ApiError extends Error {
  constructor(message, code, status) { super(message); this.name = "ApiError"; this.code = code; this.status = status; }
}

async function callOpenRouter(messages, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, temperature: options.temperature ?? 0.7, maxTokens: options.maxTokens ?? 800 }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw new ApiError("The AI request timed out. Please try again.", "UPSTREAM_TIMEOUT");
    throw new ApiError("The AI service could not be reached.", "UPSTREAM_NETWORK_ERROR");
  } finally { clearTimeout(timeout); }

  let body = {};
  try { body = await response.json(); } catch {
    if (!response.ok) throw new ApiError("The AI service returned an unexpected response.", "UPSTREAM_PROVIDER_ERROR", response.status);
  }
  if (!response.ok) {
    const messagesByCode = {
      INVALID_REQUEST: "The AI request could not be processed.",
      UPSTREAM_AUTHENTICATION_FAILED: "The AI service is not configured correctly.",
      UPSTREAM_ACCESS_DENIED: "The AI service denied this request.",
      RATE_LIMITED: "The AI service is temporarily busy. Please try again later.",
      CONFIGURATION_ERROR: "The AI service is not available right now.",
      UPSTREAM_NETWORK_ERROR: "The AI service could not be reached.",
      UPSTREAM_TIMEOUT: "The AI request timed out. Please try again.",
      UPSTREAM_PROVIDER_ERROR: "The AI service is temporarily unavailable.",
    };
    const code = body.code || "UPSTREAM_PROVIDER_ERROR";
    throw new ApiError(messagesByCode[code] || messagesByCode.UPSTREAM_PROVIDER_ERROR, code, response.status);
  }
  if (typeof body.content !== "string" || !body.content.length) throw new ApiError("The AI service returned an invalid response.", "UPSTREAM_PROVIDER_ERROR", response.status);
  return body.content;
}

async function generateStudyPlan(examDate, subjects, weakTopics, hours) {
  const weakStr = Object.entries(weakTopics).filter(([, topics]) => topics.length).map(([sub, topics]) => `${sub}: ${topics.join(", ")}`).join("; ") || "None specified";
  const daysUntil = Math.max(1, Math.ceil((new Date(examDate) - Date.now()) / 86400000));
  const planDays = Math.min(daysUntil, 14);
  const prompt = `Create a ${planDays}-day study plan for subjects: ${subjects.join(", ")}.
Exam date: ${examDate}. Daily study hours: ${hours}.
Weak topics to prioritize: ${weakStr}.
Format each range with subjects, topics, hours, and HIGH/MEDIUM/LOW priority.`;
  return callOpenRouter([{ role: "system", content: "You are an AI study planner. Format plans clearly with day ranges, topics, hours, and priorities." }, { role: "user", content: prompt }], { temperature: 0.7, maxTokens: 900 });
}

async function analyzeWeakness(marks, studyTime, focusSessionsCount, weakSubjectsList) {
  const prompt = `Analyze this student performance: Marks: ${Object.entries(marks).map(([s, v]) => `${s}: ${v}%`).join(", ")}; Study hours: ${Object.entries(studyTime).map(([s, v]) => `${s}: ${v}h`).join(", ") || "None"}; Focus sessions: ${focusSessionsCount}; Weak subjects: ${weakSubjectsList?.join(", ") || "None"}. Return Strong, Weak, and three Recommendations.`;
  return callOpenRouter([{ role: "system", content: "You are an AI academic advisor. Provide a concise actionable analysis." }, { role: "user", content: prompt }], { temperature: 0.6, maxTokens: 500 });
}

async function generateRevision(subject, chapter) {
  const text = await callOpenRouter([{ role: "system", content: 'Return ONLY valid JSON: {"chapter":"...","concepts":["..."],"formulas":["..."]}' }, { role: "user", content: `Generate 3-5 concepts and formulas for "${chapter}" in ${subject}.` }], { temperature: 0.5, maxTokens: 600 });
  try { const match = text.match(/\{[\s\S]*\}/); if (match) return JSON.parse(match[0]); } catch (error) { console.error("Revision JSON parse failed", { name: error.name }); }
  return getDemoRevision(subject, chapter);
}

async function askDoubt(question, subject) {
  return callOpenRouter([{ role: "system", content: `Answer as a school teacher with examples. Subject: ${subject || "General academic query"}.` }, { role: "user", content: question }], { temperature: 0.7, maxTokens: 600 });
}

async function generateDashboardInsight(score, weeklyHours, weeklyFocusCount, completedGoals, totalGoals, subjectBreakdown, weakSubjects) {
  const prompt = `Provide a short actionable insight as JSON with comment and insight fields. Score: ${score}/100; weekly hours: ${weeklyHours}; focus sessions: ${weeklyFocusCount}; goals: ${completedGoals}/${totalGoals}; subjects: ${JSON.stringify(subjectBreakdown)}; weak subjects: ${weakSubjects.join(", ") || "None"}.`;
  const text = await callOpenRouter([{ role: "system", content: "You are an AI study mentor. Return ONLY valid JSON." }, { role: "user", content: prompt }], { temperature: 0.6, maxTokens: 450 });
  try { const match = text.match(/\{[\s\S]*\}/); if (match) return JSON.parse(match[0]); } catch (error) { console.error("Dashboard JSON parse failed", { name: error.name }); }
  throw new Error("Invalid AI response format.");
}

function getDemoPlan(subjects, hours) { return `Day 1-3\n\n${subjects[0] || "Physics"}:\nMotion in a Plane\n${hours - 1} hours\n\n${subjects[1] || "Math"}:\nTrigonometry\n1 hour\n\nPriority:\nHIGH\n\n---\n\nDay 4-6\n\n${subjects[1] || "Math"}:\nQuadratic Equations\n${hours - 1} hours\n\n${subjects[2] || "Chemistry"}:\nAtomic Structure\n1 hour\n\nPriority:\nMEDIUM`; }
function getDemoAnalysis(marks, weakSubjects) { const sorted = Object.entries(marks).sort((a, b) => a[1] - b[1]); const weak = sorted[0]?.[0] || "Mathematics"; const strong = sorted.at(-1)?.[0] || "Chemistry"; return `Performance Analysis:\n\nStrong:\n${strong}\n\nWeak:\n${weak}${weakSubjects?.length ? `, ${weakSubjects.join(", ")}` : ""}\n\nRecommendation:\n1. Practice ${weak} daily.\n2. Complete focus sessions weekly.\n3. Revise key concepts.`; }
function getDemoRevision(subject, chapter) { return { chapter, concepts: ["Review key textbook concepts.", "Solve chapter-end questions.", "Work on previous year problems."], formulas: [] }; }
function getDemoAnswer(question, subject) { return `Demo explanation for "${question}" in ${subject || "general studies"}.\n\nLive AI is unavailable; please try again later.`; }
function getDemoDashboardInsight(score, weeklyHours, weeklyFocusCount, completedGoals, totalGoals, subjectBreakdown) { const subjects = Object.keys(subjectBreakdown); return { comment: score >= 85 ? "Excellent progress!" : "Keep up the consistent effort!", insight: `You studied ${subjects[0] || "your subjects"} ${weeklyHours.toFixed ? weeklyHours.toFixed(1) : weeklyHours} hours this week. Keep balancing practice and revision.` }; }

async function tryAI(fn, demoFn) {
  try { return await fn(); }
  catch (error) {
    const code = error && typeof error === "object" ? (error.code || "UNKNOWN_ERROR") : "UNKNOWN_ERROR";
    const status = error && typeof error === "object" ? error.status : undefined;
    console.error("AI service error", { code, status, message: error && error.message ? error.message : String(error) });
    const demoEligible = ["UPSTREAM_TIMEOUT", "UPSTREAM_NETWORK_ERROR", "CONFIGURATION_ERROR", "UPSTREAM_PROVIDER_ERROR"].includes(code);
    if (demoEligible && typeof demoFn === "function") return demoFn();
    if (error instanceof ApiError) throw error;
    throw new Error("AI service unavailable. Please try again.");
  }
}
