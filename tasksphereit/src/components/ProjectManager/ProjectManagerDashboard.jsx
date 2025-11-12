// src/components/ProjectManager/ProjectManagerDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Users, CalendarDays, Clock, ChevronLeft, ChevronRight } from "lucide-react";

/* === Firebase === */
import { auth, db } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

/* === Modal that saves to teamSystemTitles === */
import ProjectManagerTitleModal from "./ProjectManagerTitleModal";

const MAROON = "#6A0F14";

// brand/status colors
const COLORS = {
  todo: "#D9A81E",
  inprogress: "#7C9C3B",
  toreview: "#6FA8DC",
  completed: "#8E5BAA",
  missed: "#E5534B",
};

// No static sample datasets; everything loads from Firestore.

const statusColor = (s) =>
  s === "To Review"   ? COLORS.toreview :
  s === "In Progress" ? COLORS.inprogress :
  s === "To Do"       ? COLORS.todo :
  s === "Completed"   ? COLORS.completed :
                        COLORS.missed;

// ---- small UI bits -------------------------------------------------------
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-neutral-200 rounded-2xl shadow ${className}`}>
    {children}
  </div>
);

const UpcomingCard = ({ item }) => (
  <div className="w-[300px]">
    <div className="rounded-xl shadow-sm border border-neutral-200 bg-white overflow-hidden">
      <div
        className="px-4 py-2 text-white text-sm font-semibold flex items-center gap-2"
        style={{ backgroundColor: item.color }}
      >
        <Users className="w-4 h-4" />
        <span>{item.name}</span>
      </div>
      <div className="p-4 text-sm">
        <div className="text-neutral-800">{item.chapter}</div>
        <div className="mt-2 text-neutral-600">{item.date}</div>
        <div className="text-neutral-600">{item.time}</div>
      </div>
    </div>
  </div>
);

const Legend = ({ items }) => (
  <ul className="space-y-3">
    {items.map((it) => (
      <li key={it.key} className="flex items-center gap-3 text-sm">
        <span
          className="inline-block w-3 h-3 rounded-full border border-black/10"
          style={{ backgroundColor: it.color }}
        />
        <span className="text-neutral-700">{it.label}</span>
      </li>
    ))}
  </ul>
);

// ---- charts --------------------------------------------------------------
const WeeklyBarChart = ({ data, maxY = 20, width = 560, height = 260 }) => {
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const barW = innerW / data.length - 22;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[260px]">
      {/* axes */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="#BDBDBD" strokeWidth="1" />
      <line x1={padding.left} y1={padding.top + innerH} x2={padding.left + innerW} y2={padding.top + innerH} stroke="#BDBDBD" strokeWidth="1" />
      {/* y ticks */}
      {Array.from({ length: 5 }).map((_, i) => {
        const yVal = (i * maxY) / 4;
        const y = padding.top + innerH - (yVal / maxY) * innerH;
        return (
          <g key={i}>
            <line x1={padding.left - 4} x2={padding.left} y1={y} y2={y} stroke="#BDBDBD" strokeWidth="1" />
            <text x={padding.left - 10} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#6B7280">
              {yVal}
            </text>
          </g>
        );
      })}
      {/* bars */}
      {data.map((d, idx) => {
        const x = padding.left + idx * (innerW / data.length) + 12;
        const h = (d.value / maxY) * innerH;
        const y = padding.top + innerH - h;
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={h} rx="6" ry="6" fill={d.color} />
            <text x={x + barW / 2} y={padding.top + innerH + 18} textAnchor="middle" fontSize="11" fill="#6B7280">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const Donut = ({ segments, centerText = "40%" }) => {
  const size = 360;
  const stroke = 48;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const arcs = useMemo(() => {
    let acc = 0;
    return segments.map((s) => {
      const arc = (s.pct / 100) * c;
      const offset = acc;
      acc += arc;
      return { ...s, arc, offset };
    });
  }, [segments, c]);

  return (
    <div className="relative grid place-items-center">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEE" strokeWidth={stroke} />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${a.arc} ${c - a.arc}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </g>
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 44, fontWeight: 800, fill: MAROON }}>
          {centerText}
        </text>
      </svg>
    </div>
  );
};

/* ============================
   Simple Calendar (Month view)
   ============================ */
const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// sample events to mimic your screenshot
// Calendar events are loaded live (tasks + schedules)
// shape: { date: 'yyyy-mm-dd', title: string, pill?: boolean }
const SAMPLE_EVENTS = [];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function buildMonthMatrix(year, monthIndex) {
  // monthIndex: 0..11
  const first = new Date(year, monthIndex, 1);
  const startDay = first.getDay(); // 0..6 Sun..Sat
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells = [];
  // preceding blanks
  for (let i = 0; i < startDay; i++) cells.push(null);
  // month days
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  // pad to 6 rows * 7 cols = 42 cells
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  const matrix = [];
  for (let i = 0; i < cells.length; i += 7) matrix.push(cells.slice(i, i + 7));
  return matrix;
}

const CalendarCard = ({ pmUid }) => {
  // default to current month
  const [view, setView] = useState("month"); // "month" | "week" | "day" (only month visual here)
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState(SAMPLE_EVENTS);

  const title = `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const matrix = useMemo(
    () => buildMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const goPrev = () => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  };

  useEffect(() => {
    let alive = true;
    if (!pmUid) return;
    (async () => {
      try {
        // Find teams managed by this PM
        const teamsRef = collection(db, "teams");
        let teamsSnap = await getDocs(query(teamsRef, where("manager.uid", "==", pmUid)));
        let pmTeams = teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        if (pmTeams.length === 0) {
          const alt = await getDocs(query(teamsRef, where("managerUid", "==", pmUid)));
          pmTeams = alt.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        }
        const teamIds = pmTeams.map((t) => t.id);

        // Helper to chunk fetch schedules by teamId (IN up to 10)
        const fetchByTeam = async (collName) => {
          if (teamIds.length === 0) return [];
          const arr = [];
          for (let i = 0; i < teamIds.length; i += 10) {
            const chunk = teamIds.slice(i, i + 10);
            const s = await getDocs(query(collection(db, collName), where("teamId", "in", chunk)));
            s.forEach((dx) => arr.push({ id: dx.id, ...dx.data() }));
          }
          return arr;
        };

        // Load tasks created by PM (for due dates)
        const taskDefs = ["titleDefenseTasks", "oralDefenseTasks", "finalDefenseTasks", "finalRedefenseTasks"];
        const taskSnaps = await Promise.all(
          taskDefs.map((c) => getDocs(query(collection(db, c), where("createdBy.uid", "==", pmUid))))
        );
        const tasks = [];
        taskSnaps.forEach((s) => s.forEach((dx) => tasks.push({ id: dx.id, ...dx.data() })));

        // Load schedules relevant to PM teams
        const [titleSched, manusSched, oralSched, finalSched, redefSched] = await Promise.all([
          fetchByTeam("titleDefenseSchedules"),
          fetchByTeam("manuscriptSubmissions"),
          fetchByTeam("oralDefenseSchedules"),
          fetchByTeam("finalDefenseSchedules"),
          fetchByTeam("finalRedefenseSchedules").catch(() => []),
        ]);

        // Month window boundaries
        const y = cursor.getFullYear();
        const m = cursor.getMonth() + 1;
        const start = `${y}-${String(m).padStart(2, "0")}-01`;
        const endDate = new Date(y, m, 0).getDate();
        const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;
        const between = (d) => d >= start && d <= end;

        const taskEvents = tasks
          .filter((t) => typeof t.dueDate === "string" && t.dueDate.length >= 10 && between(t.dueDate))
          .map((t) => ({
            date: t.dueDate,
            title: `${t.task || t.type || "Task"} (${t.status || "To Do"})`,
          }));

        const schedEvents = [
          ...titleSched.map((s) => ({ date: s.date || "", title: "Title Defense" })),
          ...manusSched.map((s) => ({ date: s.date || "", title: "Manuscript Submission" })),
          ...oralSched.map((s) => ({ date: s.date || "", title: "Oral Defense" })),
          ...finalSched.map((s) => ({ date: s.date || "", title: "Final Defense" })),
          ...redefSched.map((s) => ({ date: s.date || "", title: "Final Re-Defense" })),
        ].filter((e) => e.date && between(e.date));

        const merged = [...taskEvents, ...schedEvents];
        if (alive) setEvents(merged);
      } catch (e) {
        console.error("Calendar load failed:", e);
        if (alive) setEvents([]);
      }
    })();
    return () => { alive = false; };
  }, [pmUid, cursor]);

  return (
    <Card>
      {/* Header controls */}
      <div className="px-5 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
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
            disabled
            className="ml-3 h-8 px-3 rounded-md text-sm font-medium bg-neutral-200 text-neutral-500 cursor-not-allowed"
          >
            Today
          </button>
        </div>

        <div className="text-sm font-semibold" style={{ color: MAROON }}>
          {title}
        </div>

        <div className="flex items-center gap-2">
          {["Month", "Week", "Day"].map((label) => {
            const key = label.toLowerCase();
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`h-8 px-4 rounded-md text-sm font-medium border ${
                  active
                    ? "text-white"
                    : "text-neutral-700 bg-white"
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

      <div className="px-5 mt-3 h-[2px] w-full" style={{ background: MAROON }} />

      {/* Grid */}
      <div className="p-5">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 text-xs text-neutral-500 mb-2">
          {dayNames.map((d) => (
            <div key={d} className="text-center">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-neutral-200 rounded-lg overflow-hidden">
          {matrix.flat().map((cell, i) => {
            const id = `cell-${i}`;
            const isBlank = !cell;
            const cellYmd = cell ? ymd(cell) : "";
            const dayEvents = (events || []).filter((e) => e.date === cellYmd);

            return (
              <div
                key={id}
                className={`min-h-[92px] bg-white relative ${isBlank ? "bg-neutral-50" : ""}`}
              >
                {/* date number */}
                {!isBlank && (
                  <div className="absolute top-2 right-2 text-xs text-neutral-500">
                    {cell.getDate()}
                  </div>
                )}

                {/* purple person pill*/}
                {/* reserved for future person pills */}

                {/* maroon event chips */}
                <div className="absolute left-3 right-3 top-10 space-y-1">
                  {dayEvents
                    .map((e, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] text-white px-2 py-0.5 rounded"
                        style={{ background: MAROON }}
                      >
                        {e.title}
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

// ---- main ---------------------------------------------------------------
const ProjectManagerDashboard = () => {
  // Live data that falls back to sample values until loaded
  const [upcoming, setUpcoming] = useState([]);
  const [weekly, setWeekly] = useState([{ key: "todo", label: "To Do", value: 0, color: COLORS.todo },{ key: "inprogress", label: "In Progress", value: 0, color: COLORS.inprogress },{ key: "toreview", label: "To Review", value: 0, color: COLORS.toreview },{ key: "completed", label: "Completed", value: 0, color: COLORS.completed },{ key: "missed", label: "Missed", value: 0, color: COLORS.missed }]);
  const [donut, setDonut] = useState([{ key: "todo", label: "To Do", pct: 0, color: COLORS.todo },{ key: "inprogress", label: "In Progress", pct: 0, color: COLORS.inprogress },{ key: "toreview", label: "To Review", pct: 0, color: COLORS.toreview },{ key: "completed", label: "Completed", pct: 0, color: COLORS.completed },{ key: "missed", label: "Missed", pct: 0, color: COLORS.missed }]);
  const [recentTasks, setRecentTasks] = useState([]);

  // helpers
  const to12h = (t) => {
    if (!t) return "";
    const [H, M] = String(t).split(":").map(Number);
    const ampm = H >= 12 ? "PM" : "AM";
    const hh = ((H + 11) % 12) + 1;
    return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
  };
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtDate = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return "--";
    const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
    if (!y || !m || !d) return "--";
    return `${MONTHS[m - 1]} ${Number(d)}, ${y}`;
  };
  /* ===== Title gate (Passed => require title) ===== */
  const [pmUid, setPmUid] = useState("");
  const [modalTeam, setModalTeam] = useState(null); // { id, name }
  const [titleGateChecked, setTitleGateChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setPmUid(u?.uid || "");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!pmUid || titleGateChecked) return;

    (async () => {
      try {
        // 1) Find the PM's teams. Primary shape: manager.uid; fallback: managerUid.
        const teamsRef = collection(db, "teams");
        let teamsSnap = await getDocs(query(teamsRef, where("manager.uid", "==", pmUid)));
        let pmTeams = teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

        if (pmTeams.length === 0) {
          const altSnap = await getDocs(query(teamsRef, where("managerUid", "==", pmUid)));
          pmTeams = altSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        }

        if (pmTeams.length === 0) {
          setTitleGateChecked(true);
          return;
        }

        // 2) For each team, require title if:
        //    - titleDefenseSchedules has verdict "Passed"
        //    - teamSystemTitles does NOT exist
        for (const t of pmTeams) {
          const teamId = t.id;

          const passSnap = await getDocs(
            query(
              collection(db, "titleDefenseSchedules"),
              where("teamId", "==", teamId),
              where("verdict", "==", "Passed")
            )
          );
          const hasPassed = passSnap.size > 0;
          if (!hasPassed) continue;

          const titleDoc = await getDoc(doc(db, "teamSystemTitles", teamId));
          const hasTitle = titleDoc.exists() && !!titleDoc.data()?.systemTitle;

          if (!hasTitle) {
            setModalTeam({ id: teamId, name: t.name || "Unnamed Team" });
            setTitleGateChecked(true);
            return; // show 1 modal only
          }
        }

        setTitleGateChecked(true);
      } catch (e) {
        console.error("Title gate check failed:", e);
        setTitleGateChecked(true);
      }
    })();
  }, [pmUid, titleGateChecked]);

  // Load PM-created tasks and compute dashboard data
  useEffect(() => {
    if (!pmUid) return;
    (async () => {
      try {
        const defs = [
          { key: "title", coll: "titleDefenseTasks" },
          { key: "oral", coll: "oralDefenseTasks" },
          { key: "final", coll: "finalDefenseTasks" },
          { key: "redef", coll: "finalRedefenseTasks" },
        ];

        const snaps = await Promise.all(
          defs.map((d) => getDocs(query(collection(db, d.coll), where("createdBy.uid", "==", pmUid))))
        );
        const all = [];
        snaps.forEach((s) => {
          s.forEach((dx) => {
            const data = dx.data() || {};
            all.push({ id: dx.id, ...data });
          });
        });

        // Upcoming: nearest future dueAtMs
        const now = Date.now();
        const upcomingRaw = all
          .filter((t) => typeof t.dueAtMs === "number" && t.dueAtMs >= now)
          .sort((a, b) => (a.dueAtMs || 0) - (b.dueAtMs || 0))
          .slice(0, 5)
          .map((t) => ({
            name: t.team?.name || (t.assignees?.[0]?.name || "—"),
            chapter: t.task || t.type || "Task",
            date: fmtDate(t.dueDate || ""),
            time: to12h(t.dueTime || ""),
            color:
              (t.status === "In Progress" && COLORS.inprogress) ||
              (t.status === "To Review" && COLORS.toreview) ||
              (t.status === "Completed" && COLORS.completed) ||
              COLORS.todo,
          }));
        if (upcomingRaw.length > 0) setUpcoming(upcomingRaw);

        // Weekly summary: counts by status (simple total)
        const counts = { todo: 0, inprogress: 0, toreview: 0, completed: 0, missed: 0 };
        const nowMs = Date.now();
        all.forEach((t) => {
          const s = String(t.status || "To Do").toLowerCase();
          if (s.includes("review")) counts.toreview++;
          else if (s.includes("progress")) counts.inprogress++;
          else if (s.includes("complete")) counts.completed++;
          else counts.todo++;
          if (typeof t.dueAtMs === "number" && t.dueAtMs < nowMs && (t.status || "") !== "Completed") counts.missed++;
        });
        setWeekly([
          { key: "todo",       label: "To Do",       value: counts.todo,       color: COLORS.todo },
          { key: "inprogress", label: "In Progress", value: counts.inprogress, color: COLORS.inprogress },
          { key: "toreview",   label: "To Review",   value: counts.toreview,   color: COLORS.toreview },
          { key: "completed",  label: "Completed",   value: counts.completed,  color: COLORS.completed },
          { key: "missed",     label: "Missed",      value: counts.missed,     color: COLORS.missed },
        ]);

        // Donut: percentage from counts
        const total = counts.todo + counts.inprogress + counts.toreview + counts.completed + counts.missed;
        const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
        setDonut([
          { key: "todo",       label: "To Do",       pct: pct(counts.todo),       color: COLORS.todo },
          { key: "inprogress", label: "In Progress", pct: pct(counts.inprogress), color: COLORS.inprogress },
          { key: "toreview",   label: "To Review",   pct: pct(counts.toreview),   color: COLORS.toreview },
          { key: "completed",  label: "Completed",   pct: pct(counts.completed),  color: COLORS.completed },
          { key: "missed",     label: "Missed",      pct: pct(counts.missed),     color: COLORS.missed },
        ]);

        // Recent tasks
        const recent = all
          .map((t, i) => ({
            createdKey: t.createdAt?.toMillis?.() || 0,
            assigned: t.assignees?.[0]?.name || "—",
            task: t.task || t.type || "Task",
            subtask: t.type || "—",
            element: t.team?.name || "—",
            created: t.createdAt?.toDate?.()?.toLocaleDateString?.() || "—",
            due: fmtDate(t.dueDate || ""),
            time: to12h(t.dueTime || ""),
            status: t.status || "To Do",
            phase: t.phase || "Design",
          }))
          .filter((x) => x.createdKey > 0)
          .sort((a, b) => b.createdKey - a.createdKey)
          .slice(0, 10)
          .map((x, i) => ({ no: i + 1, ...x }));
        if (recent.length > 0) setRecentTasks(recent);
      } catch (e) {
        console.error("Title gate check failed:", e);
      }
    })();
  }, [pmUid]);

  return (
    <div className="space-y-8">
      {/* UPCOMING */}
      <section className="space-y-3">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          UPCOMING TASKS
        </h3>
        <div className="flex flex-wrap gap-5">
          {upcoming.map((u, i) => (
            <UpcomingCard key={i} item={u} />
          ))}
        </div>
      </section>

      {/* BOTTOM ROW: Weekly Summary + Team Progress */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Summary */}
        <Card>
          <div className="px-6 pt-5">
            <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
              WEEKLY SUMMARY
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 xl:col-span-8">
                <WeeklyBarChart data={weekly} />
              </div>
              <div className="col-span-12 xl:col-span-4">
                <Legend items={weekly} />
              </div>
            </div>
          </div>
        </Card>

        {/* Team Progress */}
        <Card>
          <div className="px-6 pt-5">
            <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
              TEAM PROGRESS
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-12 gap-6 items-center">
              <div className="col-span-12 xl:col-span-8">
                <Donut segments={donut} centerText="0" />
              </div>
              <div className="col-span-12 xl:col-span-4">
                <Legend items={donut} />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* RECENT TASKS CREATED */}
      <section className="space-y-3">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          RECENT TASKS CREATED
        </h3>

        <div className="bg-white border border-neutral-200 rounded-[20px] shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="py-3 pl-6 pr-3 w-16">NO</th>
                  <th className="py-3 pr-3">Assigned</th>
                  <th className="py-3 pr-3">Task</th>
                  <th className="py-3 pr-3">Subtask</th>
                  <th className="py-3 pr-3">Element</th>
                  <th className="py-3 pr-3">
                    <div className="inline-flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" /> Date Created
                    </div>
                  </th>
                  <th className="py-3 pr-3">
                    <div className="inline-flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" /> Due Date
                    </div>
                  </th>
                  <th className="py-3 pr-3">
                    <div className="inline-flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Time
                    </div>
                  </th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-6">Project Phase</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((r) => (
                  <tr key={r.no} className="border-t border-neutral-200">
                    <td className="py-3 pl-6 pr-3">{r.no}.</td>
                    <td className="py-3 pr-3">{r.assigned}</td>
                    <td className="py-3 pr-3">{r.task}</td>
                    <td className="py-3 pr-3">{r.subtask}</td>
                    <td className="py-3 pr-3">{r.element}</td>
                    <td className="py-3 pr-3">{r.created}</td>
                    <td className="py-3 pr-3">{r.due}</td>
                    <td className="py-3 pr-3">{r.time}</td>
                    <td className="py-3 pr-3">
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: statusColor(r.status) }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-6">{r.phase}</td>
                  </tr>
                ))}

                {recentTasks.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-neutral-500">
                      No recent tasks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CALENDAR */}
      <section className="space-y-3">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          CALENDAR
        </h3>
        <CalendarCard pmUid={pmUid} />
      </section>

      {/* === Title requirement modal (opens when Passed & no title yet) === */}
      {modalTeam && (
        <ProjectManagerTitleModal
          open
          teamId={modalTeam.id}
          teamName={modalTeam.name}
          pm={{ uid: pmUid, name: "Project Manager" }}
          onSaved={() => setModalTeam(null)}
        />
      )}
    </div>
  );
};

export default ProjectManagerDashboard;





