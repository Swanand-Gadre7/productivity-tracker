# Momentum Productivity Tracker

A standalone productivity and exercise tracker that runs fully in the browser with local storage.

## Features

- Create a reusable list of daily tasks
- Tick off the tasks you completed today
- See whether you finished all tasks or still have work left
- View recent completion charts, total task trend charts, and consistency cards
- Log bodyweight over time with a visual trend chart
- Track pull-up, push-up, and max lift personal records
- See streak summaries, motivation quotes, and personalized greetings
- Save a daily reminder time and use browser notifications for nudges

## Run it

### Option 1: Open directly

Open `index.html` in your browser.

### Option 2: Run a local server

From this folder, run:

```powershell
python -m http.server 4173
```

Then visit:

`http://127.0.0.1:4173`

## Publish

This app is a static site and can be published to any static hosting provider.

- Deploy `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, and the `icons/` folder
- GitHub Pages, Netlify, Vercel, or any static web server all work
- For local testing, use the command above

### Phone install

- Open the site on your phone in a browser
- Use the browser menu to "Add to home screen" or "Install app"
- Once installed, Momentum can launch like a native app and stay available on your phone

### Local phone testing

If you want to access it from your phone on the same Wi-Fi network:

1. Start the local server on your computer:

```powershell
python -m http.server 4173
```

2. Find your computer IP address and visit it from your phone, for example:

`http://192.168.1.35:4173`

3. Install the app from the browser menu

## Data storage

All data is stored in your browser using `localStorage`, so nothing is uploaded anywhere.

## Reminder notes

- Browser notifications require permission to be allowed
- Reminder notifications work best while the app is open in the browser
