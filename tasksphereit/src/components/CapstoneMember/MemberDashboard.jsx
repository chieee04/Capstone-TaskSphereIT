import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Users, MoreVertical } from "lucide-react";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

// Registering Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const MAROON = "#6A0F14";
const MAROON_DARK = "#4a0a0d";

// Firestore
import { db } from "../../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getUserTeams } from "../../services/events";

/* -------------------- Small UI helpers -------------------- */
const Card = ({ className = "", children }) => (
  <div
    className={
      "rounded-xl border border-neutral-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.05)] " +
      className
    }
  >
    {children}
  </div>
);

const Badge = ({ children, tone = "maroon" }) => {
  const map = {
    maroon: "bg-[#6A0F14] text-white",
    soft: "bg-neutral-100 text-neutral-600",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-md px-2 py-[2px] text-xs font-medium " +
        map[tone]
      }
    >
      {children}
    </span>
  );
};

/* -------------------- Live (no static data) -------------------- */
const COLOR = {
  todo: "#FABC3F",
  inprogress: "#809D3C",
  toreview: "#578FCA",
  completed: "#4BC0C0",
  missed: "#FF6384",
};

/* -------------------- Calendar generator -------------------- */
function getMonthMatrix(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  const first = new Date(y, m, 1);
  const startDay = (first.getDay() + 6) % 7; // make Monday=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));

  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  // slice into weeks
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/* -------------------- Page -------------------- */
function MemberDashboard() {
  const uid =
    typeof window !== "undefined" ? localStorage.getItem("uid") : null;
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [weeklyCounts, setWeeklyCounts] = useState({
    todo: 0,
    inprogress: 0,
    toreview: 0,
    completed: 0,
    missed: 0,
  });

  const to12h = (t) => {
    if (!t) return "";
    const [H, M] = String(t).split(":").map(Number);
    const ampm = H >= 12 ? "PM" : "AM";
    const hh = ((H + 11) % 12) + 1;
    return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
  };
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const fmtDate = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return "";
    const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
    return `${MONTHS[(m || 1) - 1]} ${Number(d || 1)}, ${y}`;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Load all task collections then filter by assignee uid
        const cols = [
          { tag: "Title Defense", coll: "titleDefenseTasks" },
          { tag: "Oral Defense", coll: "oralDefenseTasks" },
          { tag: "Final Defense", coll: "finalDefenseTasks" },
          { tag: "Final Re-Defense", coll: "finalRedefenseTasks" },
        ];
        const snaps = await Promise.all(
          cols.map((c) => getDocs(collection(db, c.coll)))
        );
        const all = [];
        snaps.forEach((s, i) => {
          const tag = cols[i].tag;
          s.forEach((dx) => {
            const d = dx.data() || {};
            all.push({ id: dx.id, tag, ...d });
          });
        });

        const mine = all.filter(
          (t) =>
            Array.isArray(t.assignees) &&
            t.assignees.some((a) => a?.uid === uid)
        );

        const upcoming = mine
          .filter(
            (t) => typeof t.dueAtMs === "number" && t.dueAtMs >= Date.now()
          )
          .sort((a, b) => (a.dueAtMs || 0) - (b.dueAtMs || 0))
          .slice(0, 3)
          .map((t) => {
            const assignee = Array.isArray(t.assignees)
              ? t.assignees.find((a) => a?.uid === uid) || t.assignees[0]
              : null;

            const fullName = assignee?.name || "";
            let last = "",
              first = "",
              middle = "";

            // Parse "Last, First Middle" or "First Middle Last"
            if (fullName.includes(",")) {
              const [l, rest] = fullName.split(",");
              last = l.trim();
              const parts = rest.trim().split(" ");
              first = parts[0] || "";
              middle = parts.slice(1).join(" ") || "";
            } else {
              const parts = fullName.trim().split(" ");
              first = parts[0] || "";
              last = parts.slice(-1)[0] || "";
              middle = parts.slice(1, -1).join(" ") || "";
            }

            const member = `${last}, ${first} ${middle}`.trim();

            const status = String(t.status || "To Do").toLowerCase();
            let color = COLOR.todo;
            if (status.includes("progress")) color = COLOR.inprogress;
            else if (status.includes("review")) color = COLOR.toreview;
            else if (status.includes("complete")) color = COLOR.completed;
            else if (status.includes("miss")) color = COLOR.missed;

            return {
              id: t.id,
              member,
              task: t.task || "—",
              date: fmtDate(t.dueDate || ""),
              time: to12h(t.dueTime || ""),
              color,
            };
          });

        if (alive) setUpcomingTasks(upcoming);

        const counts = {
          todo: 0,
          inprogress: 0,
          toreview: 0,
          completed: 0,
          missed: 0,
        };
        const now = Date.now();
        mine.forEach((t) => {
          const s = String(t.status || "To Do").toLowerCase();
          if (s.includes("review")) counts.toreview++;
          else if (s.includes("progress")) counts.inprogress++;
          else if (s.includes("complete")) counts.completed++;
          else counts.todo++;
          if (
            typeof t.dueAtMs === "number" &&
            t.dueAtMs < now &&
            (t.status || "") !== "Completed"
          )
            counts.missed++;
        });
        if (alive) setWeeklyCounts(counts);
      } catch (e) {
        console.error("MemberDashboard load failed:", e);
        if (alive) {
          setUpcomingTasks([]);
          setWeeklyCounts({
            todo: 0,
            inprogress: 0,
            toreview: 0,
            completed: 0,
            missed: 0,
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);
  const today = new Date();
  const monthWeeks = useMemo(() => getMonthMatrix(today), [today]);
  const monthName = today.toLocaleString("default", { month: "long" });

  // Calendar (match PM layout)
  const [calCursor, setCalCursor] = useState(new Date());
  const [calEvents, setCalEvents] = useState([]); // [{date:'yyyy-mm-dd', title}]
  const calTitle = `${calCursor.toLocaleString("default", {
    month: "long",
  })} ${calCursor.getFullYear()}`;
  const calMatrix = useMemo(() => {
    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    // build 6x7 matrix
    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [calCursor]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!uid) return;
        // Teams for schedules
        const teams = await getUserTeams(uid);
        const teamIds = teams.map((t) => t.id);

        const chunkFetch = async (collName) => {
          if (teamIds.length === 0) return [];
          const arr = [];
          for (let i = 0; i < teamIds.length; i += 10) {
            const ch = teamIds.slice(i, i + 10);
            const s = await getDocs(
              query(collection(db, collName), where("teamId", "in", ch))
            );
            s.forEach((dx) => arr.push({ id: dx.id, ...dx.data() }));
          }
          return arr;
        };

        // Member tasks
        const taskCols = [
          "titleDefenseTasks",
          "oralDefenseTasks",
          "finalDefenseTasks",
          "finalRedefenseTasks",
        ];
        const taskSnaps = await Promise.all(
          taskCols.map((c) => getDocs(collection(db, c)))
        );
        const myTasks = [];
        taskSnaps.forEach((s) =>
          s.forEach((dx) => {
            const d = dx.data() || {};
            if (
              Array.isArray(d.assignees) &&
              d.assignees.some((a) => a?.uid === uid)
            ) {
              myTasks.push(d);
            }
          })
        );

        // Schedules
        const [titleSched, manusSched, oralSched, finalSched, redefSched] =
          await Promise.all([
            chunkFetch("titleDefenseSchedules"),
            chunkFetch("manuscriptSubmissions"),
            chunkFetch("oralDefenseSchedules"),
            chunkFetch("finalDefenseSchedules"),
            chunkFetch("finalRedefenseSchedules").catch(() => []),
          ]);

        // Month range
        const y = calCursor.getFullYear();
        const m = calCursor.getMonth() + 1;
        const start = `${y}-${String(m).padStart(2, "0")}-01`;
        const endDay = new Date(y, m, 0).getDate();
        const end = `${y}-${String(m).padStart(2, "0")}-${String(
          endDay
        ).padStart(2, "0")}`;
        const between = (d) => d >= start && d <= end;

        const taskEvents = myTasks
          .filter(
            (t) =>
              typeof t.dueDate === "string" &&
              t.dueDate.length >= 10 &&
              between(t.dueDate)
          )
          .map((t) => {
            const status = String(t.status || "To Do").toLowerCase();
            let color = COLOR.todo;
            if (status.includes("progress")) color = COLOR.inprogress;
            else if (status.includes("review")) color = COLOR.toreview;
            else if (status.includes("complete")) color = COLOR.completed;
            else if (status.includes("miss")) color = COLOR.missed;

            return {
              date: t.dueDate,
              title: `${t.task || t.type || "Task"}`,
              status: t.status || "To Do",
              color,
            };
          });

        const schedEvents = [
          ...titleSched.map((s) => ({
            date: s.date || "",
            title: "Title Defense",
          })),
          ...manusSched.map((s) => ({
            date: s.date || "",
            title: "Manuscript Submission",
          })),
          ...oralSched.map((s) => ({
            date: s.date || "",
            title: "Oral Defense",
          })),
          ...finalSched.map((s) => ({
            date: s.date || "",
            title: "Final Defense",
          })),
          ...redefSched.map((s) => ({
            date: s.date || "",
            title: "Final Re-Defense",
          })),
        ].filter((e) => e.date && between(e.date));

        const merged = [...taskEvents, ...schedEvents];
        if (alive) setCalEvents(merged);
      } catch (e) {
        console.error("Member calendar load failed:", e);
        if (alive) setCalEvents([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, calCursor]);

  return (
    <div className="p-6">
      {/* ---------- UPCOMING TASK ---------- */}
      <h2 className="text-[18px] font-semibold tracking-wide text-[#6A0F14]">
        UPCOMING TASK
      </h2>

      <div className="mt-3 flex flex-wrap gap-4">
        {upcomingTasks.map((u) => (
          <Card key={u.id} className="w-[300px]">
            {/* maroon header band */}
            <div
              className="rounded-t-xl px-3 py-2 text-white text-sm font-semibold"
              style={{ backgroundColor: u.color }}
            >
              {u.member}
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center gap-2 text-[15px] font-medium text-neutral-800">
                <Users size={16} className="text-neutral-500" />
                {u.task}
              </div>

              <div className="mt-2 flex items-center gap-2 text-neutral-700">
                <Calendar size={16} className="text-neutral-500" />
                {u.date}
              </div>

              <div className="mt-1 flex items-center gap-2 text-neutral-700">
                <Clock size={16} className="text-neutral-500" />
                {u.time}
              </div>
            </div>
          </Card>
        ))}
        {upcomingTasks.length === 0 && (
          <Card className="w-[300px]">
            <div
              className="rounded-t-xl px-3 py-2 text-white text-sm font-semibold"
              style={{ backgroundColor: MAROON }}
            >
              Upcoming
            </div>
            <div className="px-4 py-3 text-sm text-neutral-600">
              No upcoming tasks.
            </div>
          </Card>
        )}
      </div>

      {/* ---------- WEEKLY SUMMARY ---------- */}
      <h2 className="mt-8 text-[18px] font-semibold tracking-wide text-[#6A0F14]">
        WEEKLY SUMMARY & STATUS
      </h2>

      <div className="mt-3 grid md:grid-cols-2 gap-5">
        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-[0_6px_18px_rgba(0,0,0,0.05)] p-4">
          <Bar
            data={{
              labels: [
                "To Do",
                "In Progress",
                "To Review",
                "Completed",
                "Missed",
              ],
              datasets: [
                {
                  label: "Weekly Summary",
                  data: [
                    weeklyCounts.todo,
                    weeklyCounts.inprogress,
                    weeklyCounts.toreview,
                    weeklyCounts.completed,
                    weeklyCounts.missed,
                  ],
                  backgroundColor: [
                    COLOR.todo,
                    COLOR.inprogress,
                    COLOR.toreview,
                    COLOR.completed,
                    COLOR.missed,
                  ],
                },
              ],
            }}
            options={{ responsive: true }}
          />
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-[0_6px_18px_rgba(0,0,0,0.05)] p-4 flex items-center justify-center">
          <div style={{ maxWidth: "300px", maxHeight: "300px" }}>
            <Pie
              data={{
                labels: ["To Do", "In Progress", "Completed", "Missed"],
                datasets: [
                  {
                    data: [
                      weeklyCounts.todo,
                      weeklyCounts.inprogress,
                      weeklyCounts.completed,
                      weeklyCounts.missed,
                    ],
                    backgroundColor: [
                      COLOR.todo,
                      COLOR.inprogress,
                      COLOR.completed,
                      COLOR.missed,
                    ],
                  },
                ],
              }}
              options={{ responsive: true, maintainAspectRatio: true }}
            />
          </div>
        </div>
      </div>

      {/* ---------- CALENDAR (match PM layout) ---------- */}
      <h2 className="mt-8 text-[18px] font-semibold tracking-wide text-[#6A0F14]">
        CALENDAR
      </h2>
      <div className="mt-3 bg-white rounded-xl border border-neutral-200 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
        <div className="px-5 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="h-8 w-8 grid place-items-center rounded-md text-white"
              style={{ background: MAROON }}
              onClick={() =>
                setCalCursor(
                  new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1)
                )
              }
              title="Previous"
            >
              ‹
            </button>
            <button
              className="h-8 w-8 grid place-items-center rounded-md text-white"
              style={{ background: MAROON }}
              onClick={() =>
                setCalCursor(
                  new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1)
                )
              }
              title="Next"
            >
              ›
            </button>
          </div>
          <div className="text-sm font-semibold" style={{ color: MAROON }}>
            {calTitle}
          </div>
          <div />
        </div>
        <div
          className="px-5 mt-3 h-[2px] w-full"
          style={{ background: MAROON }}
        />
        <div className="p-5">
          <div className="grid grid-cols-7 text-xs text-neutral-500 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-neutral-200 rounded-lg overflow-hidden">
            {calMatrix.flat().map((cell, i) => {
              const id = `cell-${i}`;
              const isBlank = !cell;
              const cellYmd = cell
                ? `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(
                    2,
                    "0"
                  )}-${String(cell.getDate()).padStart(2, "0")}`
                : "";
              const dayEvents = (calEvents || []).filter(
                (e) => e.date === cellYmd
              );
              return (
                <div
                  key={id}
                  className={`min-h-[92px] bg-white relative ${
                    isBlank ? "bg-neutral-50" : ""
                  }`}
                >
                  {!isBlank && (
                    <div className="absolute top-2 right-2 text-xs text-neutral-500">
                      {cell.getDate()}
                    </div>
                  )}
                  <div className="absolute left-3 right-3 top-8 space-y-1">
                    {dayEvents.map((e, idx) => {
                      // Determine color by status
                      const s = String(e.status || e.title || "").toLowerCase();
                      let color = COLOR.todo;
                      if (s.includes("progress")) color = COLOR.inprogress;
                      else if (s.includes("review")) color = COLOR.toreview;
                      else if (s.includes("complete")) color = COLOR.completed;
                      else if (s.includes("miss")) color = COLOR.missed;

                      return (
                        <div
                          key={idx}
                          className="text-[11px] text-white px-2 py-0.5 rounded"
                          style={{ background: color }}
                        >
                          {e.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberDashboard;
