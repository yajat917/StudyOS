# StudyOS — HTML, CSS & JavaScript

A student productivity website built with pure HTML, CSS, and JavaScript. AI requests use a Vercel serverless function so the OpenRouter credential remains server-side.

## Run locally

Do not double-click `index.html` for AI functionality: `file://` pages cannot reach the `/api/chat` serverless route. Use the deployed site or a Vercel-compatible local server:

```bash
npm install -g vercel
vercel dev
```

Configure `OPENROUTER_API_KEY` in the Vercel project or local Vercel environment only. Never put it in browser code, localStorage, or committed files.

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Landing page with features |
| Dashboard | `dashboard.html` | Stats and AI insight |
| Planner | `planner.html` | AI study plan and revision notes |
| Focus | `focus.html` | Pomodoro timer |
| Analytics | `analytics.html` | Charts and weakness analyzer |
| Doubt | `doubt.html` | Ask academic questions |
| Profile | `profile.html` | Study preferences |

## AI features

Live AI requests use `/api/chat`. Transient configuration, network, timeout, and provider failures may use local demo responses. Invalid requests, authentication/access failures, and rate limits are shown to the user rather than silently replaced. There is no Profile-page API-key setting.

The endpoint applies strict bounded validation. Persistent distributed rate limiting requires an external service and configuration not included in this repository.

## Technologies

- HTML5, CSS3, JavaScript (ES6+)
- Chart.js from CDN
- localStorage for non-secret profile and progress data
