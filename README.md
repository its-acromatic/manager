# Manager - Personal Life OS Webapp

Minimal starter created from the provided spec. Pages included:

- `index.html` — Dashboard (attendance + upcoming events)
- `calendar.html` — Personal events with add/edit/delete (Firestore)
- `attendance.html` — Attendance calendar to mark present/absent/working day (Firestore)

Firebase is initialized in `js/firebase.js` using the config provided by the user and signs in anonymously. Data is stored under `users/{uid}/attendance` and `users/{uid}/events` in Firestore.

How to run locally:

1. Serve the folder with a static server (recommended) e.g. `npx http-server .` or `python -m http.server 8080`.
2. Open `http://localhost:8080/index.html`.

Notes:
- Attendance is not placeholder data — the dashboard reads real attendance documents from Firestore to compute percentages.
- Calendar events are stored per-user and editable.
