import React, { useEffect, useMemo, useState } from "react";
import { Users, CalendarDays, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";


const MAROON = "#6A0F14";


// brand/status colors
const COLORS = {
  todo: "#D9A81E",
  inprogress: "#7C9C3B",
  toreview: "#6FA8DC",
  completed: "#8E5BAA",
  missed: "#3B0304",
};


const statusColor = (s) =>
  s === "To Review" ? COLORS.toreview :
    s === "In Progress" ? COLORS.inprogress :
      s === "To Do" ? COLORS.todo :
        s === "Completed" ? COLORS.completed :
          COLORS.missed;


// ---- Carousel Components (copied from Project Manager) ----
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-neutral-200 rounded-2xl shadow ${className}`}>
    {children}
  </div>
);


const UpcomingCard = ({ item }) => (
  <div className="w-full min-w-[200px] max-w-[280px] flex-shrink-0">
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


// Carousel Component for Upcoming Tasks
const UpcomingTasksCarousel = ({ tasks }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);


  useEffect(() => {
    const updateVisibleCount = () => {
      if (window.innerWidth < 640) {
        setVisibleCount(1);
      } else if (window.innerWidth < 1024) {
        setVisibleCount(2);
      } else {
        setVisibleCount(3);
      }
    };


    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);


  const maxIndex = Math.max(0, tasks.length - visibleCount);


  const nextSlide = () => {
    setCurrentIndex(current => Math.min(current + 1, maxIndex));
  };


  const prevSlide = () => {
    setCurrentIndex(current => Math.max(current - 1, 0));
  };


  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        No upcoming tasks.
      </div>
    );
  }


  return (
    <div className="relative">
      <div className="flex items-center gap-2 sm:gap-4">
        {tasks.length > visibleCount && currentIndex > 0 && (
          <button
            onClick={prevSlide}
            className="h-8 w-8 sm:h-10 sm:w-10 grid place-items-center rounded-full border border-neutral-300 bg-white hover:bg-neutral-50 shadow-sm transition-all duration-200 hover:scale-105 z-10 flex-shrink-0"
            style={{ color: MAROON }}
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}


        <div className="flex-1 overflow-hidden">
          <div
            className="flex gap-3 sm:gap-4 transition-transform duration-300 ease-in-out"
            style={{
              transform: `translateX(-${currentIndex * (100 / visibleCount)}%)`
            }}
          >
            {tasks.map((task, index) => (
              <div key={index} className="flex-shrink-0" style={{ width: `${100 / visibleCount}%` }}>
                <UpcomingCard item={task} />
              </div>
            ))}
          </div>
        </div>


        {tasks.length > visibleCount && currentIndex < maxIndex && (
          <button
            onClick={nextSlide}
            className="h-8 w-8 sm:h-10 sm:w-10 grid place-items-center rounded-full border border-neutral-300 bg-white hover:bg-neutral-50 shadow-sm transition-all duration-200 hover:scale-105 z-10 flex-shrink-0"
            style={{ color: MAROON }}
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>


      {tasks.length > visibleCount && (
        <div className="flex justify-center mt-4 gap-1">
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex ? 'scale-125' : 'scale-100'
              }`}
              style={{
                backgroundColor: index === currentIndex ? MAROON : '#D1D5DB'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};


// ---- Calendar Components (copied from Project Manager) ----
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


const CalendarCard = ({ adviserUid }) => {
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


  // Helper function to fetch by team with proper error handling
  const fetchByTeam = async (collName, teamIds, teamNameMap) => {
    if (teamIds.length === 0) return [];
    const arr = [];
    try {
      for (let i = 0; i < teamIds.length; i += 10) {
        const chunk = teamIds.slice(i, i + 10);
        const s = await getDocs(query(collection(db, collName), where("teamId", "in", chunk)));
        s.forEach((dx) => {
          const data = dx.data() || {};
          arr.push({
            id: dx.id,
            ...data,
            teamName: teamNameMap.get(data.teamId) || data.teamName || "Team"
          });
        });
      }
    } catch (error) {
      console.error(`Error fetching ${collName}:`, error);
    }
    return arr;
  };


  useEffect(() => {
    let alive = true;
    if (!adviserUid) return;
   
    (async () => {
      try {
        // Find teams advised by this adviser
        const teamsRef = collection(db, "teams");
        let teamsSnap = await getDocs(query(teamsRef, where("adviser.uid", "==", adviserUid)));
        let adviserTeams = teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
       
        const teamIds = adviserTeams.map((t) => t.id);
        const teamNameMap = new Map(adviserTeams.map((t) => [t.id, t.name || "Unnamed Team"]));


        if (teamIds.length === 0) {
          if (alive) setEvents([]);
          return;
        }


        // Load ALL tasks for adviser's teams - INCLUDING ADVISER TASKS
        const taskDefs = [
          "titleDefenseTasks",
          "oralDefenseTasks",
          "finalDefenseTasks",
          "finalRedefenseTasks"
        ];


        const allTasks = [];
       
        // Load tasks from all collections
        for (const collName of taskDefs) {
          try {
            const taskSnap = await getDocs(collection(db, collName));
            taskSnap.forEach((dx) => {
              const data = dx.data() || {};
              // Include ALL tasks for adviser's teams, regardless of taskManager
              if (teamIds.includes(data.teamId) ||
                  (data.team && teamIds.includes(data.team.id)) ||
                  (data.teamId && teamIds.includes(data.teamId))) {
                allTasks.push({
                  id: dx.id,
                  ...data,
                  collectionName: collName,
                  teamName: teamNameMap.get(data.teamId) ||
                           (data.team && data.team.name) ||
                           data.teamName ||
                           "Team"
                });
              }
            });
          } catch (error) {
            console.error(`Error loading tasks from ${collName}:`, error);
          }
        }


        // Load schedules relevant to adviser teams
        const [titleSched, manusSched, oralSched, finalSched, redefSched] = await Promise.all([
          fetchByTeam("titleDefenseSchedules", teamIds, teamNameMap),
          fetchByTeam("manuscriptSubmissions", teamIds, teamNameMap),
          fetchByTeam("oralDefenseSchedules", teamIds, teamNameMap),
          fetchByTeam("finalDefenseSchedules", teamIds, teamNameMap),
          fetchByTeam("finalRedefenseSchedules", teamIds, teamNameMap),
        ]);


        // Get current view's date range
        const { start, end } = getDateRange();
        const between = (d) => d >= start && d <= end;


        // Task events - EXCLUDE completed tasks and only show active statuses
        const taskEvents = allTasks
          .filter((t) => {
            // Check if task has due date and it's within current view range
            const hasValidDueDate = typeof t.dueDate === "string" && t.dueDate.length >= 10;
            const isActiveStatus = t.status && !["Completed", "Done"].includes(t.status);
            return hasValidDueDate && between(t.dueDate) && isActiveStatus;
          })
          .map((t) => {
            const taskType = t.collectionName?.replace('Tasks', '') || 'Task';
            const managerType = t.taskManager === "Adviser" ? " (Adviser)" : " (PM)";
            return {
              date: t.dueDate,
              title: `${t.teamName}: ${t.task || t.type || taskType} (${t.status || "To Do"})${managerType}`,
              type: 'task',
              color: statusColor(t.status)
            };
          });


        // Schedule events - keep all schedule events
        const schedEvents = [
          ...titleSched.map((s) => ({
            date: s.date || "",
            title: `${s.teamName}: Title Defense`,
            type: 'schedule',
            color: MAROON
          })),
          ...manusSched.map((s) => ({
            date: s.date || "",
            title: `${s.teamName}: Manuscript Submission`,
            type: 'schedule',
            color: MAROON
          })),
          ...oralSched.map((s) => ({
            date: s.date || "",
            title: `${s.teamName}: Oral Defense`,
            type: 'schedule',
            color: MAROON
          })),
          ...finalSched.map((s) => ({
            date: s.date || "",
            title: `${s.teamName}: Final Defense`,
            type: 'schedule',
            color: MAROON
          })),
          ...redefSched.map((s) => ({
            date: s.date || "",
            title: `${s.teamName}: Final Re-Defense`,
            type: 'schedule',
            color: MAROON
          })),
        ].filter((e) => e.date && between(e.date));


        const merged = [...taskEvents, ...schedEvents];
        if (alive) setEvents(merged);
      } catch (e) {
        console.error("Calendar load failed:", e);
        if (alive) setEvents([]);
      }
    })();
    return () => { alive = false; };
  }, [adviserUid, cursor, view]);


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


// ---- Progress Components ----
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
  const ampm = H >= 12 ? 'PM' : 'AM';
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


/* --------------------------------- MAIN --------------------------------- */
const AdviserDashboard = () => {
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;


  const [upcoming, setUpcoming] = useState([]);
  const [progress, setProgress] = useState([]);
  const [recent, setRecent] = useState([]);


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


        // 2) Load tasks across phases (ALL tasks for adviser's teams, including adviser tasks)
        const cols = ["titleDefenseTasks","oralDefenseTasks","finalDefenseTasks","finalRedefenseTasks"];
        const snaps = await Promise.all(cols.map((c) => getDocs(collection(db, c))));
        const all = [];
        snaps.forEach((s) => s.forEach((dx) => all.push({ id: dx.id, ...(dx.data() || {}) })));


        // Filter for adviser's teams - FIXED: Only include tasks for the adviser's handling teams
        const filtered = all.filter((t) => {
          const taskTeamId = t.teamId || (t.team && t.team.id);
          return teamIds.includes(taskTeamId);
        });


        // 2a) Upcoming (by due date/time, not completed) - FIXED: Only show tasks for adviser's teams
        const upTasks = filtered
          .filter((t) => {
            const status = String(t.status || "").toLowerCase();
            return status !== "completed" && status !== "done";
          })
          .map((t) => {
            const due = computeDueMs(t.dueDate, t.dueTime);
            const st = String(t.status || "To Do").toLowerCase();
            const color = st.includes("progress") ? COLORS.inprogress :
                         st.includes("review") ? COLORS.toreview :
                         st.includes("complete") ? COLORS.completed : COLORS.todo;
            return {
              name: teamNameMap.get(t.teamId) || (t.team && t.team.name) || t.teamName || "Team",
              chapter: t.task || t.type || "Task",
              date: fmtDate(t.dueDate || ""),
              time: to12h(t.dueTime || ""),
              color,
              _due: due ?? Number.MAX_SAFE_INTEGER,
            };
          })
          .sort((a, b) => (a._due || 0) - (b._due || 0))
          .slice(0, 12);


        // 2b) Progress per team (completed / total of ALL tasks for the team)
        const byTeam = new Map();
        for (const t of filtered) {
          const teamId = t.teamId || (t.team && t.team.id);
          if (!teamId) continue;
         
          const curr = byTeam.get(teamId) || { total: 0, done: 0 };
          curr.total += 1;
          if (String(t.status || "").toLowerCase() === "completed") curr.done += 1;
          byTeam.set(teamId, curr);
        }
        const prog = Array.from(byTeam.entries()).map(([teamId, v]) => ({
          team: teamNameMap.get(teamId) || "Team",
          percent: v.total ? Math.round((v.done / v.total) * 100) : 0,
        })).sort((a,b)=> a.team.localeCompare(b.team)).slice(0, 8);


        // 2c) Load schedules for adviser teams and merge into upcoming
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
          if (s === "passed") return COLORS.completed;
          if (s === "recheck" || s === "to review") return COLORS.toreview;
          if (s === "pending") return COLORS.todo;
          return COLORS.missed;
        };


        const upSched = scheduleRows
          .filter((r) => r.date)
          .map((r) => ({
            name: r.teamName,
            chapter: r.kind,
            date: fmtDate(r.date),
            time: to12h(r.timeStart || r.timeEnd || ""),
            color: verdictColor(r.verdict),
            _due: computeDueMs(r.date, r.timeStart || r.timeEnd || "") ?? Number.MAX_SAFE_INTEGER,
          }))
          .sort((a, b) => (a._due || 0) - (b._due || 0))
          .slice(0, 12);


        // 2d) Recent tasks created (by createdAt desc)
        const rec = filtered
          .map((t) => ({
            createdMs: t.createdAt?.toMillis?.() || (t.createdAt?.seconds ? t.createdAt.seconds * 1000 : 0),
            assigned: teamNameMap.get(t.teamId) || (t.team && t.team.name) || t.teamName || "Team",
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


        if (!alive) return;
        // merge tasks and schedules for upcoming, then slice top 12
        const mergedUpcoming = [...upTasks, ...upSched].sort((a,b)=> (a._due||0)-(b._due||0)).slice(0, 12);
        setUpcoming(mergedUpcoming);
        setProgress(prog);
        setRecent(rec);
      } catch (e) {
        console.error("AdviserDashboard load failed:", e);
        if (!alive) return;
        setUpcoming([]);
        setProgress([]);
        setRecent([]);
      }
    })();
    return () => { alive = false; };
  }, [uid]);


  return (
    <div className="space-y-6 md:space-y-8 w-full">
      {/* UPCOMING TASKS with Carousel */}
      <section className="space-y-3 w-full">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          UPCOMING TASKS
        </h3>
        <UpcomingTasksCarousel tasks={upcoming} />
      </section>


      {/* TEAMS' PROGRESS */}
      <section className="space-y-3 w-full">
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


      {/* CALENDAR with Enhanced UI */}
      <section className="space-y-3 w-full">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          CALENDAR
        </h3>
        <CalendarCard adviserUid={uid} />
      </section>
    </div>
  );
};


export default AdviserDashboard;


