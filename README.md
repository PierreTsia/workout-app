# Workout App 💪

A mobile-first web app for tracking strength training with integrated rest timers, set tracking, and workout analytics.

**Live version:** [Download index.html and open in browser]

---

## 🚀 Features

✅ **Pre-configured workouts** — 3 workout templates (Push/Pull/Full Body)  
✅ **Rest timer** — Auto-starts when you check off a set, with audio/vibration alert  
✅ **Set tracking** — Editable reps, weight, and completion checkboxes  
✅ **Workout timer** — Total elapsed time for session  
✅ **Mobile-first** — Optimized for gym use on your phone  
✅ **No login required** — Works offline, data stored locally  

---

## 📖 How to Use

### 1. Download & Open
```bash
# Clone this repo
git clone https://github.com/PierreTsia/workout-app.git
cd workout-app

# Open in browser
open index.html
# or just double-click the file
```

### 2. Start a Workout
- Select your day (🔴 Lundi, 🔵 Mercredi, 🟣 Vendredi)
- Exercises load automatically with sets, target reps, and rest time

### 3. Track Sets
- Check the ✓ checkbox when you finish a set
- Rest timer starts automatically
- Edit reps/weight on the fly if needed

### 4. Next Exercise
- Click "Exercice suivant →" to move to next exercise
- Last exercise button becomes "🏁 Terminer la séance"

### 5. Finish
- See your workout summary (duration, sets, exercises)
- "🔁 Recommencer" to start a new session

---

## ⚙️ Configuration

### Adding Your Own Workouts

Edit the `WORKOUTS` object in `index.html`:

```javascript
const WORKOUTS = {
  monDay: {
    label: "🔴 My Workout",
    exercises: [
      {
        name: "Exercise Name",
        muscle: "Muscle Group",
        emoji: "💪",
        sets: 3,
        reps: "8-10",
        weight: "50",
        rest: 90,
        warn: null  // optional warning
      }
    ]
  }
};
```

### Changing the Rest Timer

Modify `rest` seconds per exercise (in milliseconds / 1000):
- 90 = 1:30 rest
- 120 = 2:00 rest
- 60 = 1:00 rest

---

## 💾 Data Storage

- **Where:** Browser LocalStorage
- **Backup:** Data persists until you clear browser cache
- **Export:** Currently manual (copy-paste from console)
- **Sync:** v2 will include Google Sheets auto-sync

---

## 🎨 Customization

### Colors
Edit the `:root` CSS variables:
```css
:root {
  --bg: #0f0f13;           /* Dark background */
  --teal: #00c9b1;         /* Accent color */
  --text: #e8e8f0;         /* Text color */
}
```

### Fonts
Default: Segoe UI / system font stack. Change in CSS `body { font-family: ... }`

### Layout
Responsive breakpoint: 430px max-width. Adjust for tablet if needed.

---

## 📱 Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome  | ✅      | Full support |
| Safari  | ✅      | Full support (iOS 12+) |
| Firefox | ✅      | Full support |
| Edge    | ✅      | Full support |

---

## 🤝 Contributing

To iterate on this project:

1. **Fork & clone** the repo
2. **Edit `index.html`** (all code is in one file for simplicity)
3. **Test locally** — open in browser
4. **Push to GitHub** and request review

### Common Changes
- Add exercises: Edit `WORKOUTS` object
- Adjust layout: Modify CSS grid/flexbox
- Change colors: Update `:root` variables
- Add features: Extend JavaScript in `<script>` section

---

## 🐛 Known Issues

- **localStorage limit:** ~5MB per origin (won't hit this limit with normal use)
- **Cross-device sync:** Not supported yet (v2 feature)
- **Offline:** Works fully offline after first load

---

## 📋 Roadmap

### v1 (Current)
- [x] Basic workout tracking
- [x] Rest timer
- [x] Set checkboxes
- [x] Mobile UI

### v2 (Next)
- [ ] Google Sheets sync
- [ ] Progression charts
- [ ] PWA installable
- [ ] Custom workouts

### v3 (Future)
- [ ] Video form analysis
- [ ] Multi-user sharing
- [ ] Wearable support
- [ ] Social features

See [PRD.md](PRD.md) for detailed roadmap.

---

## 📞 Support

Issues? Feature requests? Open an [GitHub issue](https://github.com/PierreTsia/workout-app/issues).

---

## 📄 License

MIT — Use freely, modify as you like, credit appreciated.

---

**Built for gym warriors** 🏋️ by Iris (OpenClaw)  
**Last updated:** March 11, 2026
