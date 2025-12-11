// src/components/CapstoneInstructor/InstructorDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Users, ChevronLeft, ChevronRight } from "lucide-react";

/* ==== Firestore ==== */
import { db } from "../../config/firebase";
import { collection, getDocs } from "firebase/firestore";

const MAROON = "#6A0F14";
const CARD_HEADER_COLOR = "#3B0304";

/* ----------------------------- UI Pieces ----------------------------- */
const Card = ({ className = "", children }) => (
  <div
    className={
      "bg-white border border-neutral-200 rounded-xl shadow-sm " + className
    }
  >
    {children}
  </div>
);

function UpcomingCard({ item }) {
  return (
    <div className="w-[280px] bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="px-3 py-2 text-white text-sm font-semibold flex items-center gap-2"
        style={{ backgroundColor: CARD_HEADER_COLOR }}
      >
        <Users className="w-4 h-4" />
        {item.team || "—"}
      </div>
      <div className="p-3 text-sm">
        <div className="text-neutral-800">{item.task}</div>
        <div className="mt-2 text-neutral-600">{item.date}</div>
        <div className="text-neutral-600">{item.time}</div>
      </div>
    </div>
  );
}

function Donut({ percent }) {
  const size = 120;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * c;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#EEE"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={MAROON}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-neutral-800"
        style={{ fontSize: 20, fontWeight: 700 }}
      >
        {Math.round(Math.max(0, Math.min(100, percent)))}%
      </text>
    </svg>
  );
}

function ProgressCard({ team, percent }) {
  return (
    <div className="w-[260px] bg-white border border-neutral-200 rounded-xl shadow-sm">
      <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2">
        <Users className="w-4 h-4" />
        {team}
      </div>
      <div className="grid place-items-center p-3">
        <Donut percent={percent} />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs text-white"
      style={{ backgroundColor: MAROON }}
    >
      {status || "Pending"}
    </span>
  );
}

/* ----------------------------- Calendar Components ----------------------------- */
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function buildMonthMatrix(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  const matrix = [];
  for (let i = 0; i < cells.length; i += 7) matrix.push(cells.slice(i, i + 7));
  return matrix;
}

function buildWeekMatrix(startDate) {
  const matrix = [];
  const weekDays = [];
 
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    weekDays.push(day);
  }
  matrix.push(weekDays);
  return matrix;
}

function buildDayMatrix(day) {
  return [[day]];
}

const CalendarCard = () => {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);

  const getTitle = () => {
    if (view === "month") {
      return `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
    } else if (view === "week") {
      const startOfWeek = new Date(cursor);
      startOfWeek.setDate(cursor.getDate() - cursor.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
     
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      } else {
        return `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      }
    } else {
      return `${monthNames[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    }
  };

  const matrix = useMemo(() => {
    if (view === "month") {
      return buildMonthMatrix(cursor.getFullYear(), cursor.getMonth());
    } else if (view === "week") {
      const startOfWeek = new Date(cursor);
      startOfWeek.setDate(cursor.getDate() - cursor.getDay());
      return buildWeekMatrix(startOfWeek);
    } else {
      return buildDayMatrix(cursor);
    }
  }, [cursor, view]);

  const goPrev = () => {
    const newDate = new Date(cursor);
    if (view === "month") {
      newDate.setMonth(cursor.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(cursor.getDate() - 7);
    } else {
      newDate.setDate(cursor.getDate() - 1);
    }
    setCursor(newDate);
  };

  const goNext = () => {
    const newDate = new Date(cursor);
    if (view === "month") {
      newDate.setMonth(cursor.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(cursor.getDate() + 7);
    } else {
      newDate.setDate(cursor.getDate() + 1);
    }
    setCursor(newDate);
  };

  const goToday = () => {
    setCursor(new Date());
  };

  const getDateRange = () => {
    if (view === "month") {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      return { start: ymd(start), end: ymd(end) };
    } else if (view === "week") {
      const startOfWeek = new Date(cursor);
      startOfWeek.setDate(cursor.getDate() - cursor.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return { start: ymd(startOfWeek), end: ymd(endOfWeek) };
    } else {
      return { start: ymd(cursor), end: ymd(cursor) };
    }
  };

  useEffect(() => {
    let alive = true;
   
    (async () => {
      try {
        // Load all team schedules
        const [titleSched, manusSched, oralSched, finalSched, redefSched] = await Promise.all([
          getDocs(collection(db, "titleDefenseSchedules")),
          getDocs(collection(db, "manuscriptSubmissions")),
          getDocs(collection(db, "oralDefenseSchedules")),
          getDocs(collection(db, "finalDefenseSchedules")),
          getDocs(collection(db, "finalRedefenseSchedules")),
        ]);

        const normalizeSched = (snap, tagLabel) => {
          const arr = [];
          snap.forEach((docX) => {
            const data = docX.data() || {};
            const teamName = (data.teamName || "").toString().trim();
            const date = (data.date || "").toString().trim();
            const timeStart = (data.timeStart || "00:00").toString().trim();
            const timeEnd = (data.timeEnd || "").toString().trim();

            arr.push({
              id: docX.id,
              tag: tagLabel,
              team: teamName,
              date,
              timeStart,
              timeEnd,
            });
          });
          return arr;
        };

        const titleRows = normalizeSched(titleSched, "Title Defense");
        const oralRows = normalizeSched(oralSched, "Oral Defense");
        const finalRows = normalizeSched(finalSched, "Final Defense");
        const manusRows = normalizeSched(manusSched, "Manuscript Submission");
        const redefRows = normalizeSched(redefSched, "Final Re-Defense");

        // Get current view's date range
        const { start, end } = getDateRange();
        const between = (d) => d >= start && d <= end;

        // Schedule events - all in dark maroon color
        const schedEvents = [
          ...titleRows.map((s) => ({
            date: s.date || "",
            title: `${s.team}: Title Defense`,
            type: 'schedule',
            color: CARD_HEADER_COLOR
          })),
          ...manusRows.map((s) => ({
            date: s.date || "",
            title: `${s.team}: Manuscript Submission`,
            type: 'schedule',
            color: CARD_HEADER_COLOR
          })),
          ...oralRows.map((s) => ({
            date: s.date || "",
            title: `${s.team}: Oral Defense`,
            type: 'schedule',
            color: CARD_HEADER_COLOR
          })),
          ...finalRows.map((s) => ({
            date: s.date || "",
            title: `${s.team}: Final Defense`,
            type: 'schedule',
            color: CARD_HEADER_COLOR
          })),
          ...redefRows.map((s) => ({
            date: s.date || "",
            title: `${s.team}: Final Re-Defense`,
            type: 'schedule',
            color: CARD_HEADER_COLOR
          })),
        ].filter((e) => e.date && between(e.date));

        if (alive) setEvents(schedEvents);
      } catch (e) {
        console.error("Calendar load failed:", e);
        if (alive) setEvents([]);
      }
    })();
    return () => { alive = false; };
  }, [cursor, view]);

  const getCellHeight = () => {
    if (view === "month") {
      return "min-h-[60px] md:min-h-[80px] lg:min-h-[92px]";
    } else if (view === "week") {
      return "min-h-[300px] md:min-h-[400px] lg:min-h-[552px]";
    } else {
      return "min-h-[300px] md:min-h-[400px] lg:min-h-[552px]";
    }
  };

  const renderGrid = () => {
    const { start } = getDateRange();
    const isCurrentMonth = (date) => {
      if (view === "month") {
        return date && date.getMonth() === cursor.getMonth();
      }
      return true;
    };

    return (
      <div className={`grid ${view === "day" ? "grid-cols-1" : view === "week" ? "grid-cols-7" : "grid-cols-7"} gap-px bg-neutral-200 rounded-lg overflow-hidden`}>
        {matrix.flat().map((cell, i) => {
          const isBlank = !cell;
          const cellYmd = cell ? ymd(cell) : "";
          const dayEvents = events.filter((e) => e.date === cellYmd);
          const isToday = cellYmd === ymd(new Date());

          return (
            <div
              key={`cell-${i}`}
              className={`${getCellHeight()} bg-white relative ${isBlank ? "bg-neutral-50" : ""} ${
                !isCurrentMonth(cell) ? "opacity-50" : ""
              }`}
            >
              {!isBlank && (
                <div className={`absolute top-1 right-1 md:top-2 md:right-2 text-xs ${
                  isToday ? "bg-maroon text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center" : "text-neutral-500"
                }`}>
                  {cell.getDate()}
                </div>
              )}

              <div className={`absolute left-1 right-1 ${
                view === "month" ? "top-6 md:top-8 lg:top-10 max-h-8 md:max-h-10 lg:max-h-12" : "top-8 md:top-10 lg:top-12 max-h-[280px] md:max-h-[380px] lg:max-h-[500px]"
              } space-y-1 overflow-y-auto`}>
                {dayEvents.map((e, idx) => (
                  <div
                    key={idx}
                    className="text-[10px] md:text-[11px] text-white px-1 md:px-2 py-0.5 rounded truncate"
                    style={{ background: e.color }}
                    title={e.title}
                  >
                    {e.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <div className="px-3 md:px-5 pt-3 md:pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-2 order-2 sm:order-1">
          <button
            className="h-8 w-8 grid place-items-center rounded-md text-white"
            style={{ background: MAROON }}
            onClick={goPrev}
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="h-8 w-8 grid place-items-center rounded-md text-white"
            style={{ background: MAROON }}
            onClick={goNext}
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            className="ml-2 h-8 px-3 rounded-md text-sm font-medium text-white"
            style={{ background: MAROON }}
            onClick={goToday}
          >
            Today
          </button>
        </div>

        <div className="text-sm font-semibold order-1 sm:order-2" style={{ color: MAROON }}>
          {getTitle()}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 order-3">
          {["Month", "Week", "Day"].map((label) => {
            const key = label.toLowerCase();
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`h-8 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium border ${
                  active ? "text-white" : "text-neutral-700 bg-white"
                }`}
                style={{
                  background: active ? MAROON : undefined,
                  borderColor: active ? MAROON : "#e5e7eb",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 md:px-5 mt-2 md:mt-3 h-[2px] w-full" style={{ background: MAROON }} />

      <div className="p-3 md:p-5">
        {view !== "day" && (
          <div className="grid grid-cols-7 text-xs text-neutral-500 mb-1 md:mb-2">
            {dayNames.map((d) => (
              <div key={d} className="text-center text-xs">{d}</div>
            ))}
          </div>
        )}

        {renderGrid()}
      </div>
    </Card>
  );
};

/* ----------------------------- Helpers ----------------------------- */
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
];

function toDateObj(yyyy_mm_dd, hhmm = "00:00") {
  if (!yyyy_mm_dd) return null;
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const [H, M] = (hhmm || "00:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, (m || 1) - 1, d || 1, H || 0, M || 0, 0);
}

function fmtDate(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = String(yyyy_mm_dd).split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${Number(d)}, ${y}`;
}

function to12h(t) {
  if (!t) return "";
  const [H, M] = String(t).split(":").map(Number);
  const ampm = H >= 12 ? "PM" : "AM";
  const hh = ((H + 11) % 12) + 1;
  return `${hh}:${String(M).padStart(2, "0")} ${ampm}`;
}

function fmtTimeRange(start, end) {
  const a = to12h(start);
  const b = to12h(end);
  return b ? `${a} - ${b}` : a;
}

function fmtDateOnly(d) {
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/* ----------------------------- Calendar ----------------------------- */
function getMonthMatrix(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const first = new Date(y, m, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* ----------------------------- Page ----------------------------- */
export default function InstructorDashboard() {
  const today = new Date();
  const monthWeeks = useMemo(() => getMonthMatrix(today), [today]);
  const monthName = today.toLocaleString("default", { month: "long" });

  // UPCOMING (nearest per team)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingPerTeam, setUpcomingPerTeam] = useState([]);

  // RECENT activity created
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentCreated, setRecentCreated] = useState([]);

  // Teams' progress
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [teamsProgress, setTeamsProgress] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingUpcoming(true);
      setLoadingRecent(true);
      setLoadingProgress(true);
      try {
        const [titleSnap, oralSnap, finalSnap, manusSnap, teamsSnap] =
          await Promise.all([
            getDocs(collection(db, "titleDefenseSchedules")),
            getDocs(collection(db, "oralDefenseSchedules")),
            getDocs(collection(db, "finalDefenseSchedules")),
            getDocs(collection(db, "manuscriptSubmissions")),
            getDocs(collection(db, "teams")),
          ]);

        const normalizeSched = (snap, tagLabel, opts = {}) => {
          const {
            useSingleTimeField = false,
            singleTimeFieldName = "time",
            statusField = "verdict",
          } = opts;

          const arr = [];
          snap.forEach((docX) => {
            const data = docX.data() || {};
            const teamName = (data.teamName || "").toString().trim();
            const teamId = (data.teamId || "").toString().trim() || null;
            const date = (data.date || "").toString().trim();

            let timeStart = (data.timeStart || "00:00").toString().trim();
            let timeEnd = (data.timeEnd || "").toString().trim();
            if (useSingleTimeField) {
              const t = (data[singleTimeFieldName] || "00:00")
                .toString()
                .trim();
              timeStart = t;
              timeEnd = "";
            }

            const when = toDateObj(date, timeStart);
            const createdAt = data.createdAt?.toDate
              ? data.createdAt.toDate()
              : null;
            const status = (data[statusField] || "Pending").toString();

            arr.push({
              id: docX.id,
              tag: tagLabel,
              team: teamName,
              teamKey: teamId || teamName,
              date,
              timeStart,
              timeEnd,
              when,
              createdAt,
              status,
            });
          });
          return arr;
        };

        const titleRows = normalizeSched(titleSnap, "Title Defense");
        const oralRows = normalizeSched(oralSnap, "Oral Defense");
        const finalRows = normalizeSched(finalSnap, "Final Defense");
        const manusRows = normalizeSched(manusSnap, "Manuscript Submission", {
          useSingleTimeField: true,
          singleTimeFieldName: "time",
        });

        // ---------- UPCOMING (nearest per team) ----------
        const now = new Date();
        const futureOnly = [
          ...titleRows,
          ...oralRows,
          ...finalRows,
          ...manusRows,
        ].filter((r) => r.when && r.when >= now);
        const byTeamUpcoming = new Map();
        for (const item of futureOnly) {
          const key = item.teamKey || item.team;
          const prev = byTeamUpcoming.get(key);
          if (!prev || item.when < prev.when) byTeamUpcoming.set(key, item);
        }
        const resultUpcoming = Array.from(byTeamUpcoming.values()).sort(
          (a, b) => a.when - b.when
        );
        if (alive) setUpcomingPerTeam(resultUpcoming);

        // ---------- RECENT (last 4) ----------
        const allRows = [...titleRows, ...oralRows, ...finalRows, ...manusRows];
        const recentList = allRows
          .map((r) => {
            const timeText = r.timeEnd
              ? fmtTimeRange(r.timeStart, r.timeEnd)
              : to12h(r.timeStart);
            const createdKey =
              r.createdAt?.getTime?.() || (r.when ? r.when.getTime() : 0);
            return { ...r, timeText, _createdKey: createdKey };
          })
          .filter((r) => r._createdKey > 0)
          .sort((a, b) => b._createdKey - a._createdKey)
          .slice(0, 4);
        if (alive) setRecentCreated(recentList);

        // ---------- TEAMS' PROGRESS (0–100%) ----------
        // Progress rule: each passed type (Title / Manuscript / Oral / Final) = +25
        // const hasPassed = (rows, teamKey) =>
        //   rows.some(
        //     (r) =>
        //       (r.teamKey || r.team) === teamKey &&
        //       typeof r.status === "string" &&
        //       r.status.toLowerCase() === "passed"
        //   );

        // const progressList = [];
        // teamsSnap.forEach((docX) => {
        //   const data = docX.data() || {};
        //   const teamName = (data.name || "").toString().trim();
        //   const teamKey = docX.id || teamName;

        //   const pts =
        //     (hasPassed(titleRows, teamKey) ? 1 : 0) +
        //     (hasPassed(manusRows, teamKey) ? 1 : 0) +
        //     (hasPassed(oralRows, teamKey) ? 1 : 0) +
        //     (hasPassed(finalRows, teamKey) ? 1 : 0);

        //   progressList.push({ team: teamName, percent: pts * 25 });
        // });
// ---------- TEAMS' PROGRESS (0–100%) ----------

// Load ALL TASKS (same collections as adviser)
const taskCollections = [
  "titleDefenseTasks",
  "oralDefenseTasks",
  "finalDefenseTasks",
  "finalRedefenseTasks",
];

let allTaskRows = [];
for (const coll of taskCollections) {
  const snap = await getDocs(collection(db, coll));
  snap.forEach((dx) => {
    const d = dx.data() || {};
    if (d.taskManager !== "Adviser") return;
    const teamId = d.teamId || (d.team?.id) || null;
    allTaskRows.push({
      teamId,
      teamName: d.teamName || d.team?.name || "",
      status: d.status || "To Do",
    });
  });
}

// Compute progress for each team
const progressList = teamsSnap.docs.map((docX) => {
  const data = docX.data();
  const teamId = docX.id;
  const teamName = data.name || "Team";

  const tasksForTeam = allTaskRows.filter((t) => t.teamId === teamId);
  const total = tasksForTeam.length;
  const completed = tasksForTeam.filter(
    (t) => t.status.toLowerCase() === "completed"
  ).length;

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { team: teamName, percent };
}).sort((a, b) => a.team.localeCompare(b.team));

if (alive) setTeamsProgress(progressList);

        // Sort by team name for stable UI
        progressList.sort((a, b) => a.team.localeCompare(b.team));
        if (alive) setTeamsProgress(progressList);
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
        if (alive) {
          setUpcomingPerTeam([]);
          setRecentCreated([]);
          setTeamsProgress([]);
        }
      } finally {
        if (alive) {
          setLoadingUpcoming(false);
          setLoadingRecent(false);
          setLoadingProgress(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* UPCOMING ACTIVITY */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          UPCOMING ACTIVITY
        </h3>

        {loadingUpcoming ? (
          <div className="text-sm text-neutral-500">
            Loading upcoming activity…
          </div>
        ) : upcomingPerTeam.length === 0 ? (
          <div className="text-sm text-neutral-500">No upcoming activity.</div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {upcomingPerTeam.map((u) => (
              <UpcomingCard
                key={`${u.tag}-${u.id}`}
                item={{
                  team: u.team,
                  task: u.tag,
                  date: fmtDate(u.date),
                  time: fmtTimeRange(u.timeStart, u.timeEnd),
                  color: CARD_HEADER_COLOR,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* TEAMS' PROGRESS */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          TEAMS' PROGRESS
        </h3>

        {loadingProgress ? (
          <div className="text-sm text-neutral-500">Loading progress…</div>
        ) : teamsProgress.length === 0 ? (
          <div className="text-sm text-neutral-500">No teams found.</div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {teamsProgress.map((t) => (
              <ProgressCard key={t.team} team={t.team} percent={t.percent} />
            ))}
          </div>
        )}
      </section>

      {/* RECENT ACTIVITY CREATED */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          RECENT ACTIVITY CREATED
        </h3>

        <div className="bg-white border border-neutral-200 rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="py-3 pl-6 pr-3 w-16">No</th>
                  <th className="py-3 pr-3">Activity</th>
                  <th className="py-3 pr-3">Team</th>
                  <th className="py-3 pr-3">Date Created</th>
                  <th className="py-3 pr-3">Date</th>
                  <th className="py-3 pr-6">Time</th>
                  <th className="py-3 pr-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingRecent ? (
                  <tr>
                    <td className="py-3 pl-6 pr-3" colSpan={7}>
                      <span className="text-neutral-600">Loading…</span>
                    </td>
                  </tr>
                ) : recentCreated.length === 0 ? (
                  <tr>
                    <td className="py-3 pl-6 pr-3" colSpan={7}>
                      <span className="text-neutral-600">
                        No recent activity.
                      </span>
                    </td>
                  </tr>
                ) : (
                  recentCreated.map((r, idx) => (
                    <tr
                      key={`${r.tag}-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-3 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-3 pr-3">{r.tag}</td>
                      <td className="py-3 pr-3">{r.team || "—"}</td>
                      <td className="py-3 pr-3">
                        {r.createdAt ? fmtDateOnly(r.createdAt) : "—"}
                      </td>
                      <td className="py-3 pr-3">{fmtDate(r.date)}</td>
                      <td className="py-3 pr-6">{r.timeText}</td>
                      <td className="py-3 pr-6">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CALENDAR - Enhanced with AdviserDashboard UI */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          CALENDAR
        </h3>
        <CalendarCard />
      </section>
    </div>
  );
}