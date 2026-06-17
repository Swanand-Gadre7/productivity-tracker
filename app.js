const storageKey = "momentum-tracker-v2";
const defaultReminderTime = "20:00";
const motivationalQuotes = [
  "Small wins repeated daily become the life you wanted.",
  "Discipline is remembering what you want most, Swanand.",
  "Momentum loves consistency more than intensity.",
  "A strong day starts with one completed promise to yourself.",
  "Progress looks ordinary while you are building it."
];
const taskColors = ["coral", "mint", "gold", "teal", "berry", "slate"];

const state = loadState();
const todayKey = formatDateKey(new Date());
let toastTimeoutId = null;
let deferredInstallPrompt = null;
let reminderIntervalId = null;
let selectedCalendarDate = todayKey;

const els = {
  greetingTitle: document.querySelector("#greeting-title"),
  sectionTabs: [...document.querySelectorAll(".section-tab")],
  appSections: [...document.querySelectorAll(".app-section")],
  taskForm: document.querySelector("#task-form"),
  taskInput: document.querySelector("#task-input"),
  templateList: document.querySelector("#template-list"),
  taskCountChip: document.querySelector("#task-count-chip"),
  todayDate: document.querySelector("#today-date"),
  todayList: document.querySelector("#today-list"),
  todayProgressChip: document.querySelector("#today-progress-chip"),
  todayScore: document.querySelector("#today-score"),
  currentStreak: document.querySelector("#current-streak"),
  currentWeight: document.querySelector("#current-weight"),
  allTimeTotal: document.querySelector("#all-time-total"),
  bestStreakBadge: document.querySelector("#best-streak-badge"),
  focusBadge: document.querySelector("#focus-badge"),
  statusTitle: document.querySelector("#status-title"),
  statusMessage: document.querySelector("#status-message"),
  streakGrid: document.querySelector("#streak-grid"),
  quoteText: document.querySelector("#quote-text"),
  quoteNote: document.querySelector("#quote-note"),
  completionChart: document.querySelector("#completion-chart"),
  aggregateChart: document.querySelector("#aggregate-chart"),
  calendarMonthLabel: document.querySelector("#calendar-month-label"),
  calendarGrid: document.querySelector("#calendar-grid"),
  calendarDetail: document.querySelector("#calendar-detail"),
  reminderForm: document.querySelector("#reminder-form"),
  reminderTimeInput: document.querySelector("#reminder-time-input"),
  notificationButton: document.querySelector("#notification-button"),
  testReminderButton: document.querySelector("#test-reminder-button"),
  reminderSummary: document.querySelector("#reminder-summary"),
  weightForm: document.querySelector("#weight-form"),
  weightInput: document.querySelector("#weight-input"),
  weightDateInput: document.querySelector("#weight-date-input"),
  weightChart: document.querySelector("#weight-chart"),
  strengthForm: document.querySelector("#strength-form"),
  pullupsInput: document.querySelector("#pullups-input"),
  pushupsInput: document.querySelector("#pushups-input"),
  liftInput: document.querySelector("#lift-input"),
  strengthCards: document.querySelector("#strength-cards"),
  strengthChart: document.querySelector("#strength-chart"),
  toast: document.querySelector("#toast")
};

bootstrap();

function bootstrap() {
  els.greetingTitle.textContent = getGreetingText();
  els.todayDate.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());
  els.weightDateInput.value = todayKey;
  els.reminderTimeInput.value = state.reminders.dailyTime;

  els.taskForm.addEventListener("submit", handleTaskCreate);
  els.weightForm.addEventListener("submit", handleWeightSave);
  els.strengthForm.addEventListener("submit", handleStrengthSave);
  els.reminderForm.addEventListener("submit", handleReminderSave);
  els.notificationButton.addEventListener("click", enableNotifications);
  els.testReminderButton.addEventListener("click", () => sendReminder("Momentum check-in for Swanand", "Time to review today's tasks and training."));
  els.sectionTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateSection(tab.dataset.sectionTarget));
  });

  render();
  startReminderLoop();
  registerServiceWorker();
  showToast(`Hi Swanand. ${getShortWelcomeMessage()}`);
}

function loadState() {
  const fallback = {
    profile: {
      name: "Swanand"
    },
    taskTemplates: [],
    taskHistory: {},
    weights: [],
    strength: {
      pullups: 0,
      pushups: 0,
      lift: 0
    },
    strengthHistory: [],
    reminders: {
      dailyTime: defaultReminderTime,
      permissionRequested: false,
      lastSentDate: ""
    }
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || JSON.parse(localStorage.getItem("momentum-tracker-v1"));
    if (!saved) {
      return fallback;
    }

    const migratedStrength = {
      pullups: Number(saved?.strength?.pullups) || 0,
      pushups: Number(saved?.strength?.pushups) || 0,
      lift: Number(saved?.strength?.lift) || 0
    };
    const migratedStrengthHistory = Array.isArray(saved.strengthHistory) ? saved.strengthHistory : fallback.strengthHistory;

    if (!migratedStrengthHistory.length && (migratedStrength.pullups || migratedStrength.pushups || migratedStrength.lift)) {
      migratedStrengthHistory.push({
        date: todayKey,
        pullups: migratedStrength.pullups,
        pushups: migratedStrength.pushups,
        lift: migratedStrength.lift
      });
    }

    return {
      profile: {
        name: saved?.profile?.name || "Swanand"
      },
      taskTemplates: Array.isArray(saved.taskTemplates) ? saved.taskTemplates : fallback.taskTemplates,
      taskHistory: saved.taskHistory && typeof saved.taskHistory === "object" ? saved.taskHistory : fallback.taskHistory,
      weights: Array.isArray(saved.weights) ? saved.weights : fallback.weights,
      strength: migratedStrength,
      strengthHistory: migratedStrengthHistory,
      reminders: {
        dailyTime: saved?.reminders?.dailyTime || defaultReminderTime,
        permissionRequested: Boolean(saved?.reminders?.permissionRequested),
        lastSentDate: saved?.reminders?.lastSentDate || ""
      }
    };
  } catch (error) {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function handleTaskCreate(event) {
  event.preventDefault();
  const title = els.taskInput.value.trim();

  if (!title) {
    return;
  }

  state.taskTemplates.push({
    id: crypto.randomUUID(),
    title
  });

  els.taskInput.value = "";
  persistAndRender();
  showToast(`Added "${title}" to your daily system.`);
}

function handleTaskToggle(taskId, checked) {
  const doneIds = new Set(state.taskHistory[todayKey] || []);
  if (checked) {
    doneIds.add(taskId);
  } else {
    doneIds.delete(taskId);
  }

  state.taskHistory[todayKey] = [...doneIds];
  persistAndRender();

  const metrics = getTaskMetrics();
  if (metrics.today.allDone && metrics.today.total > 0) {
    sendReminder("All tasks complete", "Amazing work, Swanand. You completed every daily task today.");
    showToast("Congrats! You completed all tasks today.");
  }
}

function handleTaskDelete(taskId) {
  state.taskTemplates = state.taskTemplates.filter((task) => task.id !== taskId);

  Object.keys(state.taskHistory).forEach((dateKey) => {
    state.taskHistory[dateKey] = (state.taskHistory[dateKey] || []).filter((id) => id !== taskId);
  });

  persistAndRender();
}

function handleWeightSave(event) {
  event.preventDefault();
  const value = Number(els.weightInput.value);
  const date = els.weightDateInput.value;

  if (!value || !date) {
    return;
  }

  const existing = state.weights.find((entry) => entry.date === date);
  if (existing) {
    existing.weight = value;
  } else {
    state.weights.push({ date, weight: value });
  }

  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  els.weightInput.value = "";
  persistAndRender();
  showToast(`Saved your weight entry for ${formatCalendarDay(date)}.`);
}

function handleStrengthSave(event) {
  event.preventDefault();

  state.strength = {
    pullups: Number(els.pullupsInput.value) || 0,
    pushups: Number(els.pushupsInput.value) || 0,
    lift: Number(els.liftInput.value) || 0
  };

  const existing = state.strengthHistory.find((entry) => entry.date === todayKey);
  if (existing) {
    existing.pullups = state.strength.pullups;
    existing.pushups = state.strength.pushups;
    existing.lift = state.strength.lift;
  } else {
    state.strengthHistory.push({
      date: todayKey,
      pullups: state.strength.pullups,
      pushups: state.strength.pushups,
      lift: state.strength.lift
    });
  }

  state.strengthHistory.sort((a, b) => a.date.localeCompare(b.date));
  persistAndRender();
  showToast("Strength records updated.");
}

function handleReminderSave(event) {
  event.preventDefault();
  state.reminders.dailyTime = els.reminderTimeInput.value;
  persistAndRender();
  startReminderLoop();
  showToast(`Daily reminder saved for ${formatTime(state.reminders.dailyTime)}.`);
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    showToast("This browser does not support notifications.");
    return;
  }

  const permission = await Notification.requestPermission();
  state.reminders.permissionRequested = true;
  persistAndRender();

  if (permission === "granted") {
    showToast("Notifications enabled.");
  } else {
    showToast("Notification permission was not granted.");
  }
}

function persistAndRender() {
  saveState();
  render();
}

function render() {
  renderTemplates();
  renderTodayChecklist();
  renderSummary();
  renderStreaks();
  renderMotivation();
  renderCompletionChart();
  renderAggregateChart();
  renderCalendar();
  renderReminderSummary();
  renderWeightChart();
  renderStrength();
  renderStrengthChart();
}

function activateSection(sectionId) {
  els.sectionTabs.forEach((tab) => {
    const isActive = tab.dataset.sectionTarget === sectionId;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
  });
  els.appSections.forEach((section) => {
    const isActive = section.id === sectionId;
    section.classList.toggle("is-active", isActive);
    section.hidden = !isActive;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTemplates() {
  els.taskCountChip.textContent = `${state.taskTemplates.length} task${state.taskTemplates.length === 1 ? "" : "s"}`;

  if (!state.taskTemplates.length) {
    els.templateList.className = "card-list empty-state";
    els.templateList.textContent = "Your daily task list will appear here.";
    return;
  }

  els.templateList.className = "card-list";
  els.templateList.innerHTML = "";

  state.taskTemplates.forEach((task, index) => {
    const card = document.createElement("article");
    card.className = "task-card";
    card.dataset.color = getTaskColor(index);
    card.innerHTML = `
      <div class="task-meta">
        <div class="task-index">${index + 1}</div>
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <div class="helper-text">Daily task</div>
        </div>
      </div>
      <button class="delete-button" type="button" aria-label="Remove task ${escapeHtml(task.title)}">Remove</button>
    `;

    card.querySelector("button").addEventListener("click", () => handleTaskDelete(task.id));
    els.templateList.appendChild(card);
  });
}

function renderTodayChecklist() {
  const doneIds = new Set(state.taskHistory[todayKey] || []);
  const total = state.taskTemplates.length;
  const completed = state.taskTemplates.filter((task) => doneIds.has(task.id)).length;

  els.todayProgressChip.textContent = `${completed} / ${total} done`;

  if (!total) {
    els.todayList.className = "checklist empty-state";
    els.todayList.textContent = "Add some daily tasks to create today's checklist.";
    return;
  }

  els.todayList.className = "checklist";
  els.todayList.innerHTML = "";

  state.taskTemplates.forEach((task, index) => {
    const item = document.createElement("article");
    const isDone = doneIds.has(task.id);
    item.className = `check-item ${isDone ? "done" : "pending"}`;
    item.dataset.color = getTaskColor(index);
    item.innerHTML = `
      <label>
        <input type="checkbox" ${isDone ? "checked" : ""} aria-label="${escapeHtml(task.title)}">
        <div class="check-meta">
          <div class="day-badge">${index + 1}</div>
          <div>
            <strong>${escapeHtml(task.title)}</strong>
            <div>${isDone ? "Completed today" : "Still waiting for today's checkmark"}</div>
          </div>
        </div>
      </label>
      <div class="check-actions">
        <span class="status-pill ${isDone ? "done" : "pending"}">${isDone ? "done" : "pending"}</span>
        <button class="delete-button small" type="button" aria-label="Remove task ${escapeHtml(task.title)}">Remove</button>
      </div>
    `;

    item.querySelector("input").addEventListener("change", (event) => {
      handleTaskToggle(task.id, event.target.checked);
    });
    item.querySelector("button").addEventListener("click", () => handleTaskDelete(task.id));

    els.todayList.appendChild(item);
  });
}

function renderSummary() {
  const metrics = getTaskMetrics();
  const latestWeight = state.weights[state.weights.length - 1];

  els.todayScore.textContent = `${metrics.today.percent}%`;
  els.currentStreak.textContent = String(metrics.currentStreak);
  els.currentWeight.textContent = latestWeight ? `${latestWeight.weight} kg` : "--";
  els.allTimeTotal.textContent = String(metrics.totalDoneAllTime);
  els.bestStreakBadge.textContent = `Best streak: ${metrics.bestStreak} day${metrics.bestStreak === 1 ? "" : "s"}`;
  els.focusBadge.textContent = metrics.today.allDone
    ? "Focus mode: crushed it"
    : metrics.today.done === 0
      ? "Focus mode: wake-up call"
      : "Focus mode: still in motion";

  if (!metrics.today.total) {
    els.statusTitle.textContent = "Let's get started.";
    els.statusMessage.textContent = "Add your daily tasks and begin checking them off.";
    return;
  }

  if (metrics.today.allDone) {
    els.statusTitle.textContent = "Congrats — you completed everything today.";
    els.statusMessage.textContent = `Amazing job, Swanand. That makes ${metrics.currentStreak} day${metrics.currentStreak === 1 ? "" : "s"} in your current streak.`;
    return;
  }

  els.statusTitle.textContent = `You finished ${metrics.today.done} of ${metrics.today.total} tasks today.`;
  els.statusMessage.textContent = metrics.today.done === 0
    ? "No checkmarks yet. Do better today and start with the easiest win."
    : `You are moving. Finish the remaining ${metrics.today.total - metrics.today.done} task${metrics.today.total - metrics.today.done === 1 ? "" : "s"} and protect the streak.`;
}

function renderStreaks() {
  const metrics = getTaskMetrics();
  const cards = [
    { label: "Current streak", value: metrics.currentStreak, note: "Consecutive days with all tasks done" },
    { label: "Best streak", value: metrics.bestStreak, note: "Strongest run so far" },
    { label: "Weekly total", value: metrics.weeklyDone, note: "Tasks completed in the last 7 days" }
  ];

  els.streakGrid.innerHTML = cards.map((card) => `
    <article class="streak-card">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <span>${card.note}</span>
    </article>
  `).join("");
}

function renderMotivation() {
  const metrics = getTaskMetrics();
  const quoteIndex = (todayKey.split("-").join("").split("").reduce((sum, digit) => sum + Number(digit), 0)) % motivationalQuotes.length;
  els.quoteText.textContent = `"${motivationalQuotes[quoteIndex]}"`;
  els.quoteNote.textContent = metrics.today.allDone
    ? "You already finished the day strong. Enjoy the win and reset for tomorrow."
    : metrics.currentStreak > 0
      ? `You have a ${metrics.currentStreak}-day streak alive. Protect it today.`
      : "Today is the easiest day to start a new streak.";
}

function renderCompletionChart() {
  const points = getRecentTaskSeries(7).reverse().map((point) => ({
    label: formatTinyDate(point.date),
    value: point.done
  }));

  if (!state.taskTemplates.length) {
    els.completionChart.innerHTML = '<div class="chart-empty">Add tasks to see your completion chart.</div>';
    return;
  }

  const maxDone = Math.max(...points.map((point) => point.value), 1);
  els.completionChart.innerHTML = createLineChart({
    title: "Tasks completed over the last 7 days",
    series: [
      {
        name: "Tasks done",
        color: "#d96c3f",
        values: points
      }
    ],
    maxValue: maxDone
  });
}

function renderAggregateChart() {
  const points = getRecentTaskSeries(10).reverse();

  if (!state.taskTemplates.length) {
    els.aggregateChart.innerHTML = '<div class="chart-empty">Complete tasks over a few days to see your total-done trend.</div>';
    return;
  }

  const maxDone = Math.max(...points.map((point) => point.done), 1);
  els.aggregateChart.innerHTML = createLineChart({
    title: "Daily total tasks completed",
    series: [
      {
        name: "Tasks done",
        color: "#d96c3f",
        values: points.map((point) => ({ label: formatTinyDate(point.date), value: point.done }))
      }
    ],
    maxValue: maxDone
  });
}

function renderCalendar() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  els.calendarMonthLabel.textContent = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric"
  }).format(today);

  els.calendarGrid.innerHTML = "";

  for (let offset = 0; offset < 42; offset += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);
    const dateKey = formatDateKey(date);
    const total = state.taskTemplates.length;
    const done = getDoneCountForDate(dateKey);
    const ratio = total ? done / total : 0;
    const level = ratio === 0 ? 0 : ratio < 0.5 ? 1 : ratio < 1 ? 2 : 3;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `calendar-cell calendar-level-${level}${date.getMonth() !== today.getMonth() ? " is-outside" : ""}${dateKey === todayKey ? " is-today" : ""}${dateKey === selectedCalendarDate ? " is-selected" : ""}`;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-selected", String(dateKey === selectedCalendarDate));
    cell.setAttribute("aria-label", `${formatLongDate(dateKey)}. ${done} of ${total} tasks done. ${Math.round(ratio * 100) || 0} percent completed.`);
    cell.innerHTML = `
      <span class="calendar-day-number">${date.getDate()}</span>
      <span class="calendar-meta">${done}/${total} tasks</span>
      <span class="calendar-meta">${Math.round(ratio * 100) || 0}% done</span>
    `;
    cell.addEventListener("click", () => {
      selectedCalendarDate = dateKey;
      renderCalendar();
    });
    els.calendarGrid.appendChild(cell);
  }

  const selectedTotal = state.taskTemplates.length;
  const selectedDone = getDoneCountForDate(selectedCalendarDate);
  const weightEntry = state.weights.find((entry) => entry.date === selectedCalendarDate);
  const strengthEntry = state.strengthHistory.find((entry) => entry.date === selectedCalendarDate);
  els.calendarDetail.innerHTML = `
    <span>${formatLongDate(selectedCalendarDate)}</span>
    <strong>${selectedDone} / ${selectedTotal}</strong>
    <span>Tasks completed on this date</span>
    <span>Weight: ${weightEntry ? `${weightEntry.weight} kg` : "No entry"}</span>
    <span>Strength: ${strengthEntry ? `${strengthEntry.pullups} pull-ups, ${strengthEntry.pushups} push-ups, ${strengthEntry.lift} kg lift` : "No strength update"}</span>
  `;
}

function renderReminderSummary() {
  const permission = getNotificationStatus();
  els.reminderSummary.innerHTML = `
    <span>Daily reminder</span>
    <strong>${formatTime(state.reminders.dailyTime)}</strong>
    <span>Notification status: ${permission}</span>
  `;
  els.notificationButton.textContent = permission === "granted" ? "Notifications enabled" : "Enable notifications";
}

function renderWeightChart() {
  if (!state.weights.length) {
    els.weightChart.innerHTML = '<div class="chart-empty">Log your weight to visualize progress over time.</div>';
    return;
  }

  const entries = state.weights.slice(-10);
  const weights = entries.map((entry) => ({ label: formatTinyDate(entry.date), value: entry.weight }));
  const maxWeight = Math.max(...weights.map((entry) => entry.value), 1);

  els.weightChart.innerHTML = createLineChart({
    title: "Latest weight entries",
    series: [
      {
        name: "Weight",
        color: "#7db59a",
        values: weights
      }
    ],
    maxValue: maxWeight
  });
}

function renderStrength() {
  els.pullupsInput.value = state.strength.pullups || "";
  els.pushupsInput.value = state.strength.pushups || "";
  els.liftInput.value = state.strength.lift || "";

  const cards = [
    { label: "Pull-ups", value: state.strength.pullups, suffix: "reps" },
    { label: "Push-ups", value: state.strength.pushups, suffix: "reps" },
    { label: "Max lift", value: state.strength.lift, suffix: "kg" }
  ];

  els.strengthCards.innerHTML = cards.map((card) => `
    <article class="metric-card">
      <span>${card.label}</span>
      <strong>${card.value || 0}</strong>
      <span>${card.suffix}</span>
    </article>
  `).join("");
}

function renderStrengthChart() {
  if (!state.strengthHistory.length) {
    els.strengthChart.innerHTML = '<div class="chart-empty">Update your strength records over time to unlock a progress chart.</div>';
    return;
  }

  const entries = state.strengthHistory.slice(-8);
  const maxValue = Math.max(
    ...entries.flatMap((entry) => [entry.pullups, entry.pushups, entry.lift]),
    1
  );

  els.strengthChart.innerHTML = createLineChart({
    title: "Progress for pull-ups, push-ups, and max lift",
    series: [
      {
        name: "Pull-ups",
        color: "#d96c3f",
        values: entries.map((entry) => ({ label: formatTinyDate(entry.date), value: entry.pullups }))
      },
      {
        name: "Push-ups",
        color: "#4ea7a0",
        values: entries.map((entry) => ({ label: formatTinyDate(entry.date), value: entry.pushups }))
      },
      {
        name: "Max lift",
        color: "#f2b94b",
        values: entries.map((entry) => ({ label: formatTinyDate(entry.date), value: entry.lift }))
      }
    ],
    maxValue
  });
}

function createLineChart({ title, series, maxValue }) {
  const width = 620;
  const height = 240;
  const padding = 30;
  const safeMax = Math.max(maxValue, 1);
  const pointCount = series[0]?.values.length || 0;

  if (!pointCount) {
    return '<div class="chart-empty">Not enough data yet.</div>';
  }

  const labels = series[0].values.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(pointCount - 1, 1);
    return `<text x="${x}" y="${height - 6}" text-anchor="middle" fill="#6b7181" font-size="11">${point.label}</text>`;
  }).join("");

  const lines = series.map((entry) => {
    const points = entry.values.map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(pointCount - 1, 1);
      const y = height - padding - (point.value / safeMax) * (height - padding * 2);
      return { x, y, value: point.value };
    });

    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
    const areaPath = [
      `${points[0].x},${height - padding}`,
      ...points.map((point) => `${point.x},${point.y}`),
      `${points[points.length - 1].x},${height - padding}`
    ].join(" ");
    const dots = points.map((point) => `
      <circle cx="${point.x}" cy="${point.y}" r="4" fill="${entry.color}"></circle>
    `).join("");

    return `
      <polyline fill="${entry.color}" fill-opacity="0.14" stroke="none" points="${areaPath}"></polyline>
      <polyline fill="none" stroke="${entry.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${polyline}"></polyline>
      ${dots}
    `;
  }).join("");

  const legend = series.map((entry, index) => `
    <div style="display:inline-flex;align-items:center;gap:8px;margin-right:14px;">
      <span style="width:12px;height:12px;border-radius:999px;background:${entry.color};display:inline-block;"></span>
      <span>${entry.name}</span>
    </div>
  `).join("");

  return `
    <p class="chart-title">${title}</p>
    <div class="chart-title">${legend}</div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}. Line chart with ${pointCount} data points.">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(30,36,48,0.12)" stroke-width="2"></line>
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(30,36,48,0.12)" stroke-width="2"></line>
      ${lines}
      ${labels}
    </svg>
  `;
}

function getTaskMetrics() {
  const total = state.taskTemplates.length;
  const todayDone = getDoneCountForDate(todayKey);
  const weeklyDone = getRecentDays(7).reduce((sum, date) => sum + getDoneCountForDate(date), 0);
  const totalDoneAllTime = Object.keys(state.taskHistory).reduce((sum, date) => sum + getDoneCountForDate(date), 0);
  const streaks = calculateStreaks();

  return {
    today: {
      done: todayDone,
      total,
      percent: total ? Math.round((todayDone / total) * 100) : 0,
      allDone: total > 0 && todayDone === total
    },
    weeklyDone,
    totalDoneAllTime,
    currentStreak: streaks.current,
    bestStreak: streaks.best
  };
}

function calculateStreaks() {
  const chronologicalDays = getRecentDays(180).reverse();
  const reverseDays = getRecentDays(180);
  const total = state.taskTemplates.length;
  let current = 0;
  let best = 0;
  let running = 0;

  chronologicalDays.forEach((date) => {
    const completedAll = total > 0 && getDoneCountForDate(date) === total;
    if (completedAll) {
      running += 1;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  });

  for (let index = 0; index < reverseDays.length; index += 1) {
    const date = reverseDays[index];
    const completedAll = total > 0 && getDoneCountForDate(date) === total;
    if (completedAll) {
      current += 1;
    } else {
      break;
    }
  }

  return { current, best };
}

function getRecentTaskSeries(count) {
  return getRecentDays(count).map((date) => ({
    date,
    done: getDoneCountForDate(date),
    total: state.taskTemplates.length
  }));
}

function getDoneCountForDate(date) {
  return (state.taskHistory[date] || []).filter((taskId) =>
    state.taskTemplates.some((task) => task.id === taskId)
  ).length;
}

function startReminderLoop() {
  if (reminderIntervalId) {
    window.clearInterval(reminderIntervalId);
  }

  checkReminder();
  reminderIntervalId = window.setInterval(checkReminder, 30000);
}

function checkReminder() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (currentTime === state.reminders.dailyTime && state.reminders.lastSentDate !== todayKey) {
    sendReminder(
      "Daily productivity reminder",
      "Swanand, open Momentum and check off what you have finished today."
    );
    state.reminders.lastSentDate = todayKey;
    saveState();
    renderReminderSummary();
  }
}

function sendReminder(title, message) {
  showToast(message);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message });
  }
}

function getNotificationStatus() {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 3200);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.register('sw.js').then((registration) => {
    console.log('Service worker registered:', registration.scope);
  }).catch((error) => {
    console.warn('Service worker registration failed:', error);
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  showToast('Install Momentum to your home screen from your browser menu.');
});

function getRecentDays(count) {
  const days = [];
  const today = new Date();
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    days.push(formatDateKey(date));
  }
  return days;
}

function getGreetingText() {
  const hour = new Date().getHours();
  const name = state.profile.name || "Swanand";
  if (hour < 12) {
    return `Hi ${name}, good morning. Ready to build momentum?`;
  }
  if (hour < 18) {
    return `Hi ${name}, good afternoon. Ready to build momentum?`;
  }
  return `Hi ${name}, good evening. Ready to build momentum?`;
}

function getTaskColor(index) {
  return taskColors[index % taskColors.length];
}

function getShortWelcomeMessage() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Start with one easy win this morning.";
  }
  if (hour < 18) {
    return "Keep the day moving with your next task.";
  }
  return "Close the day strong and protect the streak.";
}

document.addEventListener("keydown", (event) => {
  const activeIndex = els.sectionTabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  if (activeIndex === -1) {
    return;
  }
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
    return;
  }
  event.preventDefault();
  let nextIndex = activeIndex;
  if (event.key === "ArrowRight") {
    nextIndex = (activeIndex + 1) % els.sectionTabs.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (activeIndex - 1 + els.sectionTabs.length) % els.sectionTabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = els.sectionTabs.length - 1;
  }
  const nextTab = els.sectionTabs[nextIndex];
  activateSection(nextTab.dataset.sectionTarget);
  nextTab.focus();
});

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDay(dateString) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(parseLocalDate(dateString));
}

function formatCalendarDay(dateString) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseLocalDate(dateString));
}

function formatTinyDate(dateString) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseLocalDate(dateString));
}

function formatLongDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(parseLocalDate(dateString));
}

function formatTime(timeValue) {
  const [hourString, minuteString] = timeValue.split(":");
  const date = new Date();
  date.setHours(Number(hourString), Number(minuteString), 0, 0);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
