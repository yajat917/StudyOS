// AI calls are proxied through /api/chat serverless function.
// The API key remains server-side in the Vercel OPENROUTER_API_KEY variable.

const CLIENT_TIMEOUT_MS = 25_000;

class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function callOpenRouter(messages, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let response;

  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 800,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("The AI request timed out. Please try again.", "UPSTREAM_TIMEOUT");
    }
    throw new ApiError("The AI service could not be reached.", "UPSTREAM_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError("The AI service returned an unexpected response.", "UPSTREAM_PROVIDER_ERROR", response.status);
    }
  }

  if (!response.ok) {
    const code = body.code || "UPSTREAM_PROVIDER_ERROR";
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
    throw new ApiError(messagesByCode[code] || "The AI service is temporarily unavailable.", code, response.status);
  }

  if (typeof body.content !== "string" || body.content.length === 0) {
    throw new ApiError("The AI service returned an invalid response.", "UPSTREAM_PROVIDER_ERROR", response.status);
  }
  return body.content;
}

async function generateStudyPlan(examDate, subjects, weakTopics, hours) {
  const weakStr = Object.entries(weakTopics)
    .filter(([, topics]) => topics.length)
    .map(([sub, topics]) => `${sub}: ${topics.join(", ")}`)
    .join("; ") || "None specified";

  const daysUntil = Math.max(1, Math.ceil((new Date(examDate) - Date.now()) / (1000 * 60 * 60 * 24)));
  const planDays = Math.min(daysUntil, 14);

  const prompt = `Create a ${planDays}-day study plan for subjects: ${subjects.join(", ")}.
Exam date: ${examDate}. Daily study hours: ${hours}.
Weak topics to prioritize: ${weakStr}.

You MUST format your output EXACTLY as follows for each day range:

Day 1-3

[Subject 1]:
[Topic/Chapter]
[X] hours

[Subject 2]:
[Topic/Chapter]
[Y] hours

Priority:
[HIGH or MEDIUM or LOW]

---

Day 4-6

...

Classify the priority for each range block based on:
- HIGH: Weak topics or important chapters
- MEDIUM: Average topics
- LOW: Revision topics`;

  return callOpenRouter(
    [
      { role: "system", content: "You are an AI study planner. You format daily study plans strictly matching the requested template, using day ranges, topics, hours, and priority classifications." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.7, maxTokens: 900 }
  );
}

async function analyzeWeakness(marks, studyTime, focusSessionsCount, weakSubjectsList) {
  const marksStr = Object.entries(marks).map(([s, v]) => `${s}: ${v}%`).join(", ");
  const timeStr = Object.entries(studyTime).map(([s, v]) => `${s}: ${v}h`).join(", ") || "Not provided";
  const weakListStr = weakSubjectsList && weakSubjectsList.length ? weakSubjectsList.join(", ") : "None specified";

  const prompt = `Student performance profile:
- Marks by Subject: ${marksStr}
- Study hours completed by Subject: ${timeStr}
- Focus sessions completed: ${focusSessionsCount}
- Weak subjects specified in profile: ${weakListStr}

Please analyze these statistics and output a report formatted EXACTLY like this:

Performance Analysis:

Strong:
[Strongest subject name(s)]

Weak:
[Weakest subject name(s)]

Recommendation:
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]`;

  return callOpenRouter(
    [
      { role: "system", content: "You are an AI academic advisor. Provide analysis strictly formatted as requested, identifying strong and weak subjects and listing actionable tips." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.6, maxTokens: 500 }
  );
}

async function generateRevision(subject, chapter) {
  const text = await callOpenRouter(
    [
      { role: "system", content: 'Return ONLY valid JSON. Format: {"chapter": "Chapter Name", "concepts": ["concept 1", "concept 2", "concept 3"], "formulas": ["formula 1", "formula 2"]}' },
      { role: "user", content: `Generate 3-5 key concepts and important formulas for the chapter "${chapter}" in ${subject}.` },
    ],
    { temperature: 0.5, maxTokens: 600 }
  );

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error("Revision JSON parse failed, using raw fallback", e);
  }

  return {
    chapter,
    concepts: ["Review key textbook concepts.", "Solve chapter-end questions.", "Work on previous year exam problems."],
    formulas: [],
  };
}

async function askDoubt(question, subject) {
  return callOpenRouter(
    [
      { role: "system", content: `Answer as a school teacher. Explain step-by-step with examples. The subject of the doubt is: ${subject || "General academic query"}.` },
      { role: "user", content: question },
    ],
    { temperature: 0.7, maxTokens: 600 }
  );
}

async function generateDashboardInsight(score, weeklyHours, weeklyFocusCount, completedGoals, totalGoals, subjectBreakdown, weakSubjects) {
  const prompt = `Student performance summary for this week:
- AI Study Score: ${score}/100
- Weekly hours studied: ${weeklyHours} hours
- Focus sessions completed: ${weeklyFocusCount}
- Goals completed today: ${completedGoals}/${totalGoals}
- Subject study hours breakdown: ${Object.entries(subjectBreakdown).map(([s, h]) => `${s}: ${h}h`).join(", ")}
- Weak subjects: ${weakSubjects.join(", ") || "None"}

Please provide a short, actionable daily insight and a summary comment.
Format your response as a JSON object with two fields:
{
  "comment": "A brief comment about the study score.",
  "insight": "A detailed daily insight advising what to do next."
}`;

  const responseText = await callOpenRouter([
    { role: "system", content: "You are an AI study mentor. Return ONLY valid JSON." },
    { role: "user", content: prompt },
  ], { temperature: 0.6, maxTokens: 450 });

  try {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.error("Failed to parse AI dashboard response, using fallback", e);
  }
  throw new Error("Invalid AI response format.");
}

function getDemoPlan(subjects, hours) {
  return `Day 1-3\n\n${subjects[0] || "Physics"}:\nMotion in a Plane\n${hours - 1} hours\n\n${subjects[1] || "Math"}:\nTrigonometry\n1 hour\n\nPriority:\nHIGH\n\n---\n\nDay 4-6\n\n${subjects[1] || "Math"}:\nQuadratic Equations\n${hours - 1} hours\n\n${subjects[2] || "Chemistry"}:\nAtomic Structure\n1 hour\n\nPriority:\nMEDIUM`;
}

function getDemoAnalysis(marks, weakSubjects) {
  const sorted = Object.entries(marks).sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0]?.[0] || "Mathematics";
  const strongest = sorted[sorted.length - 1]?.[0] || "Chemistry";
  const extraWeak = weakSubjects && weakSubjects.length ? weakSubjects.filter(w => w !== weakest) : [];
  return `Performance Analysis:\n\nStrong:\n${strongest}\n\nWeak:\n${weakest}${extraWeak.length ? `, ${extraWeak.join(", ")}` : ""}\n\nRecommendation:\n1. Practice 20 ${weakest} questions daily.\n2. Complete at least 2 focus sessions of 25 minutes for ${weakest} each week.\n3. Revise key formulas and concepts before practice sessions.`;
}

function getDemoRevision(subject, chapter) {
  return { chapter, concepts: ["Concepts of bonds: Covalent and coordinate bond formation", "VSEPR theory and hybridization in elements", "Dipole moments and ionic character in covalent bonds", "Intermolecular forces and hydrogen bonding"], formulas: ["Formal Charge = V - L - S/2", "Bond Order = (Nb - Na) / 2"] };
}

function getDemoAnswer(question, subject) {
  return `This is a demo teacher explanation for: "${question}" in ${subject || "general studies"}:\n\nStep 1: Understand the core concept.\nFor instance, if we look at real-world examples, we see how forces interact.\n\nStep 2: Breakdown of the process.\n- Identify the variable elements in your equation.\n- Check the mathematical relations between elements.\n\nStep 3: Summary and Example.\nA standard school example showing how this resolves step-by-step.\n\n(Demo mode: live AI is unavailable.)`;
}

function getDemoDashboardInsight(score, weeklyHours, weeklyFocusCount, completedGoals, totalGoals, subjectBreakdown, weakSubjects) {
  const active = Object.keys(subjectBreakdown).length ? Object.keys(subjectBreakdown) : ["Math", "Physics", "Chemistry"];
  let leastStudiedSubject = "";
  let leastHours = Infinity;
  active.forEach((s) => { const hrs = subjectBreakdown[s] || 0; if (hrs < leastHours) { leastHours = hrs; leastStudiedSubject = s; } });
  let mostStudiedSubject = "";
  let mostHours = -1;
  active.forEach((s) => { const hrs = subjectBreakdown[s] || 0; if (hrs > mostHours) { mostHours = hrs; mostStudiedSubject = s; } });
  let comment = "Keep up the consistent effort!";
  if (score >= 85) comment = "Excellent progress! Outstanding consistency.";
  else if (score >= 70) comment = `Great job! Try to focus more on ${leastStudiedSubject || "Physics"} practice.`;
  else comment = "Stay focused! Increase your daily study hours to hit your targets.";
  const insight = `You studied ${mostStudiedSubject || "Chemistry"} ${mostHours > 0 ? mostHours.toFixed(1) : "6"} hours this week but ${leastStudiedSubject || "Physics"} only ${leastHours < Infinity ? leastHours.toFixed(1) : "2"} hours. Balance your study time for better results.`;
  return { comment, insight };
}

async function tryAI(fn, demoFn) {
  try {
    return await fn();
  } catch (err) {
    console.error("AI service error", { code: err.code, status: err.status });
    const demoEligible = ["UPSTREAM_TIMEOUT", "UPSTREAM_NETWORK_ERROR", "CONFIGURATION_ERROR", "UPSTREAM_PROVIDER_ERROR"].includes(err.code);
    if (demoEligible && typeof demoFn === "function") {
      return demoFn();
    }
    throw err instanceof ApiError ? err : new Error("AI service unavailable. Please try again.");
  }
}
