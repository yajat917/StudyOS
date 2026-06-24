# StudyOS — HTML, CSS & JavaScript

A student productivity website built with **pure HTML, CSS, and JavaScript** — no Node.js or build tools required.

## How to open

1. Go to the `studyos-web` folder
2. Double-click **`index.html`** to open in your browser

Or right-click `index.html` → Open with → Chrome / Edge / Firefox.

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Landing page with features |
| Dashboard | `dashboard.html` | Stats, countdown, XP, badges |
| Planner | `planner.html` | AI study plan + revision notes |
| Focus | `focus.html` | Pomodoro timer (25/5) |
| Analytics | `analytics.html` | Charts + weakness analyzer |
| Doubt | `doubt.html` | Ask academic questions |
| Profile | `profile.html` | Save name, subjects, API key |

## AI features

- Works in **demo mode** without any setup (sample responses)
- For **real AI**, add your free OpenRouter API key on the **Profile** page
- Get a key at [openrouter.ai](https://openrouter.ai)

## Folder structure

```
studyos-web/
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
    ├── ai.js         ← OpenRouter API calls
    ├── planner.js
    ├── focus.js
    ├── analytics.js
    ├── doubt.js
    └── profile.js
```

## Technologies

- HTML5
- CSS3 (glassmorphism, responsive grid, dark/light theme)
- JavaScript (ES6+)
- Chart.js (loaded from CDN on Analytics page)
- localStorage for saving profile and progress

## Notes

- All data is stored in your browser (localStorage)
- Dark/light theme toggle in the navbar
- Mobile-friendly responsive design
