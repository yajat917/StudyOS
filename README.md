# StudyOS — HTML, CSS & JavaScript

A student productivity website built with pure HTML, CSS, and JavaScript. It uses a Vercel serverless function to keep the OpenRouter API key server-side.

## Run locally

Because AI requests use the same-origin `/api/chat` route, do not open `index.html` with `file://`. Use a Vercel-compatible local server or the deployed site instead.

With Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

Configure `OPENROUTER_API_KEY` in the local Vercel environment without committing it. The API key must never be placed in browser code, localStorage, or committed files.

For a static-only preview, serve the files with any HTTP server, but AI features require a running `/api/chat` serverless function.

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Landing page with features |
| Dashboard | `dashboard.html` | Stats, countdown, XP, badges |
| Planner | `planner.html` | AI study plan + revision notes |
| Focus | `focus.html` | Pomodoro timer (25/5) |
| Analytics | `analytics.html` | Charts + weakness analyzer |
| Doubt | `doubt.html` | Ask academic questions |
| Profile | `profile.html` | Save name, subjects, and study preferences |

## AI features

- Uses `/api/chat` for live AI requests.
- Shows local demo responses when the live AI service is unavailable for transient configuration, network, timeout, or provider failures.
- Rate-limit, authentication, access, and invalid-request errors are shown without being silently replaced by demo output.
- Configure the server-side `OPENROUTER_API_KEY` in Vercel or the local Vercel environment. There is no Profile-page API-key setting.

## Folder structure

```
StudyOS/
├── api/
│   └── chat.js       ← Vercel proxy to OpenRouter
├── index.html
├── dashboard.html
├── planner.html
├── focus.html
├── analytics.html
├── doubt.html
├── profile.html
├── css/
│   └── style.css
└── js/
    ├── storage.js    ← localStorage, theme, navbar
    ├── ai.js         ← API calls and demo fallback
    ├── planner.js
    ├── focus.js
    ├── analytics.js
    └── doubt.js
```

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Chart.js from CDN
- localStorage for non-secret profile and progress data

## Notes

- All user data is stored in the browser's localStorage.
- Provider credentials remain server-side.
- The public API applies bounded request validation, but persistent distributed rate limiting requires an external service/configuration not currently included in this project.
