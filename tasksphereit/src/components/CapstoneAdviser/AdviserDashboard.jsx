import React, { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

const MAROON = "#6A0F14";

/* ----------------------------- HELPERS ----------------------------- */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = String(yyyy_mm_dd).split("-").map(Number);
  if (!y || !m || !d) return String(yyyy_mm_dd);
  return `${MONTHS[(m || 1) - 1]} ${Number(d || 1)}, ${y}`;
};
const to12h = (t) => {
  if (!t) return "";
  const [H, M] = String(t).split(":").map(Number);
  if (Number.isNaN(H) || Number.isNaN(M)) return String(t);
  const ampm = H >= 12 ? "PM" : "AM";
  const hh = ((H + 11) % 12) + 1;
  return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
};
const computeDueMs = (dueDate, dueTime) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ""))) return null;
  const [y, m, d] = String(dueDate).split("-").map(Number);
  let H = 0, M = 0;
  if (dueTime && /^\d{1,2}:\d{2}$/.test(String(dueTime))) {
    const [hh, mm] = String(dueTime).split(":").map(Number);
    H = hh || 0; M = mm || 0;
  }
  return new Date(y, (m || 1) - 1, d || 1, H, M).getTime();
};

/* ------------------------------- UI PIECES ----------------------------- */
function UpcomingCard({ item }) {
  return (
    <div className="w-[280px] bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="px-3 py-2 text-white text-sm font-semibold flex items-center gap-2"
        style={{ backgroundColor: item.color }}
      >
        <Users className="w-4 h-4" />
        {item.team}
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
  const dash = (percent / 100) * c;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEE" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={"#6A0F14"}
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
        {percent}%
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
  const styles = useMemo(() => {
    switch (status) {
      case "In Progress":
        return "bg-[#7C9C3B] text-white";
      case "To Review":
        return "bg-[#6FA8DC] text-white";
      case "To Do":
      default:
        return "bg-[#D9A81E] text-white";
    }
  }, [status]);
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${styles}`}>
      {status}
    </span>
  );
}

/* --------------------------------- MAIN --------------------------------- */
const AdviserDashboard = () => {
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;

  const [upcoming, setUpcoming] = useState([]); // {team, task, date, time, color}
  const [progress, setProgress] = useState([]); // {team, percent}
  const [recent, setRecent] = useState([]);     // mapped rows (not rendered per specs)

  // simple calendar state (month of today)
  const [calCursor, setCalCursor] = useState(new Date());
  const [calEvents, setCalEvents] = useState([]); // {date: yyyy-mm-dd, title}

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Load teams advised by current user
        const tSnap = await getDocs(query(collection(db, "teams"), where("adviser.uid", "==", uid || "")));
        const teams = [];
        tSnap.forEach((d) => teams.push({ id: d.id, name: d.data()?.name || "" }));
        const teamIds = teams.map((t) => t.id);
        const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

        // 2) Load tasks across phases (only Adviser-managed tasks)
        const cols = ["titleDefenseTasks","oralDefenseTasks","finalDefenseTasks","finalRedefenseTasks"];
        const snaps = await Promise.all(cols.map((c) => getDocs(collection(db, c))));
        const all = [];
        snaps.forEach((s) => s.forEach((dx) => all.push({ id: dx.id, ...(dx.data() || {}) })));

        const isAdviserTask = (t) => (t?.taskManager || "Adviser") === "Adviser";
        const filtered = all.filter((t) => teamIds.includes(t.teamId) && isAdviserTask(t));

        // 2a) Upcoming (by due date/time, not completed)
        const upTasks = filtered
          .filter((t) => String(t.status || "").toLowerCase() !== "completed")
          .map((t) => {
            const due = computeDueMs(t.dueDate, t.dueTime);
            const st = String(t.status || "To Do").toLowerCase();
            const color = st.includes("progress") ? "#7C9C3B" : st.includes("review") ? "#6FA8DC" : "#D9A81E";
            return {
              team: teamNameMap.get(t.teamId) || t.teamName || "Team",
              task: t.task || t.type || "Task",
              date: fmtDate(t.dueDate || ""),
              time: to12h(t.dueTime || ""),
              color,
              _due: due ?? Number.MAX_SAFE_INTEGER,
            };
          })
          .sort((a, b) => (a._due || 0) - (b._due || 0))
          .slice(0, 8);

        // 2a.1) Build calendar events from task due dates
        const taskEvents = filtered
          .filter((t) => t.dueDate)
          .map((t) => ({ date: String(t.dueDate), title: (teamNameMap.get(t.teamId) || t.teamName || "Team") + ": " + (t.task || t.type || "Task") }));

        // 2b) Progress per team (completed / total of adviser tasks)
        const byTeam = new Map();
        for (const t of filtered) {
          const key = t.teamId;
          const curr = byTeam.get(key) || { total: 0, done: 0 };
          curr.total += 1;
          if (String(t.status || "").toLowerCase() === "completed") curr.done += 1;
          byTeam.set(key, curr);
        }
        const prog = Array.from(byTeam.entries()).map(([teamId, v]) => ({
          team: teamNameMap.get(teamId) || "Team",
          percent: v.total ? Math.round((v.done / v.total) * 100) : 0,
        })).sort((a,b)=> a.team.localeCompare(b.team)).slice(0, 8);

        // 2c) Recent tasks created (by createdAt desc) — retained internally but not displayed
        const rec = filtered
          .map((t) => ({
            createdMs: t.createdAt?.toMillis?.() || (t.createdAt?.seconds ? t.createdAt.seconds * 1000 : 0),
            assigned: teamNameMap.get(t.teamId) || t.teamName || "Team",
            task: t.task || t.type || "Task",
            subtask: t.subtask || t.type || "",
            elements: t.element || t.teamElement || "",
            due: fmtDate(t.dueDate || ""),
            time: to12h(t.dueTime || ""),
            status: t.status || "To Do",
          }))
          .sort((a,b)=> (b.createdMs||0) - (a.createdMs||0))
          .slice(0, 10)
          .map((r, i) => ({ no: i+1, ...r }));

        // 3) Load schedules for adviser teams and merge into upcoming + calendar
        const schedCols = [
          { key: "Title Defense", coll: "titleDefenseSchedules" },
          { key: "Oral Defense",  coll: "oralDefenseSchedules" },
          { key: "Final Defense", coll: "finalDefenseSchedules" },
          { key: "Final Re-Defense", coll: "finalRedefenseSchedules" },
          { key: "Manuscript Submission", coll: "manuscriptSubmissions", timeField: "time" },
        ];
        const schedSnaps = await Promise.all(schedCols.map((c) => getDocs(collection(db, c.coll)))).catch(() => []);
        const scheduleRows = [];
        schedSnaps.forEach((s, idx) => {
          const cfg = schedCols[idx] || {};
          s?.forEach?.((dx) => {
            const d = dx.data() || {};
            if (!teamIds.includes(d.teamId)) return;
            scheduleRows.push({
              kind: cfg.key,
              teamId: d.teamId,
              teamName: d.teamName || teamNameMap.get(d.teamId) || "Team",
              date: d.date || "",
              timeStart: (cfg.timeField ? d[cfg.timeField] : d.timeStart) || "",
              timeEnd: d.timeEnd || "",
              verdict: d.verdict || "Pending",
            });
          });
        });

        const verdictColor = (v) => {
          const s = String(v || "").toLowerCase();
          if (s === "passed") return "#7C9C3B"; // green
          if (s === "recheck" || s === "to review") return "#6FA8DC"; // blue
          if (s === "pending") return "#D9A81E"; // yellow
          return "#6A0F14"; // maroon default
        };

        const upSched = scheduleRows
          .filter((r) => r.date)
          .map((r) => ({
            team: r.teamName,
            task: r.kind,
            date: fmtDate(r.date),
            time: to12h(r.timeStart || r.timeEnd || ""),
            color: verdictColor(r.verdict),
            _due: computeDueMs(r.date, r.timeStart || r.timeEnd || "") ?? Number.MAX_SAFE_INTEGER,
          }))
          .sort((a, b) => (a._due || 0) - (b._due || 0))
          .slice(0, 8);

        const calSchedEvents = scheduleRows.filter((r) => r.date).map((r) => ({ date: r.date, title: `${r.kind}: ${r.teamName}` }));

        if (!alive) return;
        // merge tasks and schedules for upcoming, then slice top 10
        const mergedUpcoming = [...upTasks, ...upSched].sort((a,b)=> (a._due||0)-(b._due||0)).slice(0, 12);
        setUpcoming(mergedUpcoming);
        setProgress(prog);
        setRecent(rec);
        setCalEvents([ ...taskEvents, ...calSchedEvents ]);
      } catch (e) {
        console.error("AdviserDashboard load failed:", e);
        if (!alive) return;
        setUpcoming([]);
        setProgress([]);
        setRecent([]);
        setCalEvents([]);
      }
    })();
    return () => { alive = false; };
  }, [uid]);
  return (
    <div className="space-y-8">
      {/* UPCOMING TASKS */}
      <section className="space-y-3">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          UPCOMING TASKS
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {upcoming.length === 0 ? (
            <div className="text-sm text-neutral-500">No upcoming tasks.</div>
          ) : (
            upcoming.map((u, idx) => (
              <UpcomingCard key={`${u.team}-${u.task}-${idx}`} item={u} />
            ))
          )}
        </div>
      </section>

      {/* TEAMS' PROGRESS */}
      <section className="space-y-3">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          TEAMS' PROGRESS
        </h3>
        <div className="flex flex-wrap gap-4">
          {progress.length === 0 ? (
            <div className="text-sm text-neutral-500">No progress to show.</div>
          ) : (
            progress.map((p) => (
              <ProgressCard key={p.team} team={p.team} percent={p.percent} />
            ))
          )}
        </div>
      </section>

      {/* CALENDAR */}
      <section className="space-y-3">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          CALENDAR
        </h3>
        <div className="bg-white rounded-xl border border-neutral-200 shadow">
          <div className="p-5">
            <CalendarView cursor={calCursor} onCursorChange={setCalCursor} events={calEvents} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdviserDashboard;

// --- Simple Calendar view (matches Member/PM style light version) ---
function CalendarView({ cursor, onCursorChange, events = [] }) {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const monthName = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });

  // build matrix Mon-start or Sun-start; use Sun-start to match Member
  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i=0;i<startDay;i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const toYmd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            className="h-8 w-8 grid place-items-center rounded-md text-white"
            style={{ background: MAROON }}
            onClick={() => onCursorChange(new Date(y, m - 1, 1))}
            title="Previous"
          >
            ‹
          </button>
          <button
            className="h-8 w-8 grid place-items-center rounded-md text-white"
            style={{ background: MAROON }}
            onClick={() => onCursorChange(new Date(y, m + 1, 1))}
            title="Next"
          >
            ›
          </button>
        </div>
        <div className="text-sm font-semibold" style={{ color: MAROON }}>{monthName}</div>
        <div />
      </div>
      <div className="grid grid-cols-7 text-xs text-neutral-500 mb-2">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-neutral-200 rounded-lg overflow-hidden">
        {cells.map((cell, i) => {
          const id = `cell-${i}`;
          const isBlank = !cell;
          const dayEvents = cell ? events.filter((e) => e.date === toYmd(cell)) : [];
          return (
            <div key={id} className={`min-h-[92px] bg-white relative ${isBlank ? 'bg-neutral-50' : ''}`}>
              {!isBlank && (
                <div className="absolute top-2 right-2 text-xs text-neutral-500">{cell.getDate()}</div>
              )}
              <div className="absolute left-3 right-3 top-8 space-y-1">
                {dayEvents.map((e, idx) => (
                  <div key={idx} className="text-[11px] text-white px-2 py-0.5 rounded" style={{ background: MAROON }}>
                    {e.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
