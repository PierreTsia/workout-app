# Workout App — Product Requirements Document

## 📋 Overview

**Workout App** is a mobile-first web application for tracking strength training sessions with integrated rest timers, exercise progression, and workout analytics.

**Target User:** Pierre Tsiakkaros (45yo, 72kg, strength training enthusiast)  
**Use Case:** Neoness gym member, 6 days/week training (push/pull/legs/full-body split)

---

## 🎯 Problem Statement

- Current workflow: Using multiple tools (spreadsheet + timer + fitness app)
- Pain points:
  - No integrated rest timer during workouts
  - Manual progress tracking across sessions
  - Static workout plans without real-time adjustment
  - No mobile-first interface for gym use

---

## ✨ Core Features (v1)

### 1. **Workout Selection**
- Pre-configured workouts (Lundi/Mercredi/Vendredi)
- One-tap switch between workout days
- Visual indicator (thumbnail emojis) for quick exercise recognition

### 2. **Exercise Interface**
- Exercise name + muscle group
- Sets table with:
  - Set number
  - Target reps (editable)
  - Reference weight (editable)
  - Checkbox to mark set as done
- Add/remove set buttons for flexibility

### 3. **Rest Timer (MVP)**
- Auto-triggers when set is checked
- Countdown timer (visual circle + numbers)
- Audio/vibration notification on completion
- Skip button for early next set
- Display current exercise + rest duration

### 4. **Workout Tracking**
- Elapsed time counter (top bar)
- Session summary on completion:
  - Total duration
  - Sets completed
  - Exercises done
  - Ability to restart

### 5. **Data Persistence**
- Local storage (localStorage) for current session
- No cloud sync (v1) — data stays on device

---

## 🎨 Design

**Style:**
- Dark theme (#0f0f13 bg, teal accents #00c9b1)
- Mobile-first responsive layout
- Minimalist UI — focus on what matters during workout

**Key Components:**
- Top bar: Menu + timer + manual rest button
- Exercise strip: Horizontal scroll thumbnails
- Main view: Large exercise info + sets table
- Bottom nav: Previous/Next exercise buttons
- Rest overlay: Full-screen timer

---

## 📊 Data Structure

### Workout Schema
```json
{
  "day": "vendredi",
  "label": "🟣 Vendredi — Full Body",
  "exercises": [
    {
      "name": "Développé couché",
      "muscle": "Pectoraux",
      "emoji": "🏋️",
      "sets": 3,
      "reps": "12",
      "weight": "32.5-40",
      "rest": 120,
      "warn": null
    }
  ]
}
```

### Session State
```json
{
  "currentDay": "vendredi",
  "currentExIdx": 0,
  "setsData": {
    "vendredi_0": [
      { "reps": "12", "weight": "32.5-40", "done": false },
      { "reps": "12", "weight": "32.5-40", "done": true }
    ]
  },
  "workoutStart": 1773261600000,
  "totalSetsDone": 5
}
```

---

## 🚀 Roadmap

### v1 (Current) ✅
- [x] 3 pre-configured workouts
- [x] Rest timer with notifications
- [x] Set tracking
- [x] Mobile-responsive UI
- [x] Session summary

### v2 (Planned)
- [ ] Progression tracking (weekly weight/reps trends)
- [ ] Google Sheets auto-sync for historical data
- [ ] Exercise notes/comments per set
- [ ] PRs (Personal Records) badge
- [ ] PWA installable to home screen
- [ ] Dark/light theme toggle
- [ ] Custom workout builder

### v3 (Future)
- [ ] Multi-user support (friends can share programs)
- [ ] Backend API + cloud sync
- [ ] AI-powered rep suggestions based on form analysis (video)
- [ ] Wearable integration (Apple Watch, Wear OS)
- [ ] Social sharing (PR celebrations, leaderboards)

---

## 🛠 Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Storage:** LocalStorage (v1), Firebase/Supabase (v2+)
- **Hosting:** GitHub Pages / Vercel / Netlify
- **No build tool required** (plain HTML file)

---

## 📱 Browser Support

- Modern browsers (Chrome, Safari, Firefox, Edge)
- iOS 12+, Android 9+
- Mobile-first design (400px–480px viewport primary target)

---

## 🔐 Privacy & Security

- **No data collection:** All data stored locally on device
- **No external API calls** (v1)
- **Optional:** User-initiated export to CSV/JSON

---

## 📈 Success Metrics

- Session completion rate (% of users finishing workouts)
- Average rest timer accuracy
- Time to create new workout plan
- User retention (weekly active users)

---

## 🏋️ Difficulty / Experience Tiers

Shared vocabulary used across exercise classification, onboarding user profiles, and program generation. The same three tiers apply to both exercises and users.

| Tier | User Experience | Exercise Characteristics |
|---|---|---|
| **Beginner** | < 6 months regular strength training | Easy to learn, low strength/mobility demands, safe even with imperfect form |
| **Intermediate** | 6 months – 2 years | Moderate form complexity, solid strength base needed, some mobility demands |
| **Advanced** | 2+ years consistent training | High form complexity, significant strength and mobility requirements, injury risk if form breaks down |

---

## 🎓 Known Limitations (v1)

- Single device only (no sync across devices)
- No historical analytics
- No form tracking/video analysis
- No social features
- Hardcoded workout programs

---

## 👤 Author

Designed for **Pierre Tsiakkaros** (Jan 2026)  
Built by **Iris** (OpenClaw Personal Assistant)
