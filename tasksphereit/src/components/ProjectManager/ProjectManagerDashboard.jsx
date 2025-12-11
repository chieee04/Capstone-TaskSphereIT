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
  onSnapshot,
} from "firebase/firestore";

/* === Modal that saves to teamSystemTitles === */
import ProjectManagerTitleModal from "./ProjectManagerTitleModal";

const MAROON = "#6A0F14";

// brand/status colors
const COLORS = {
  todo: "#FABC3F",
  inprogress: "#809D3C",
  toreview: "#578FCA",
  completed: "#AA60C8",
  missed: "#3B0304",
};

const statusColor = (s) =>
  s === "To Review" ? COLORS.toreview :
    s === "In Progress" ? COLORS.inprogress :
      s === "To Do" ? COLORS.todo :
        s === "Completed" ? COLORS.completed :
          COLORS.missed;

// ---- small UI bits -------------------------------------------------------
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

  // Update visible count based on screen size
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
      {/* Carousel Container */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Previous Button */}
        {tasks.length > visibleCount && currentIndex > 0 && (
          <button
            onClick={prevSlide}
            className="h-8 w-8 sm:h-10 sm:w-10 grid place-items-center rounded-full border border-neutral-300 bg-white hover:bg-neutral-50 shadow-sm transition-all duration-200 hover:scale-105 z-10 flex-shrink-0"
            style={{ color: MAROON }}
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        {/* Cards Container */}
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

        {/* Next Button */}
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

      {/* Dots Indicator */}
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

const Legend = ({ items }) => (
  <ul className="space-y-3 w-full">
    {items.map((it) => (
      <li key={it.key} className="flex items-center gap-3 text-sm">
        <span
          className="inline-block w-3 h-3 rounded-full border border-black/10 flex-shrink-0"
          style={{ backgroundColor: it.color }}
        />
        <span className="text-neutral-700 whitespace-nowrap">{it.label}</span>
      </li>
    ))}
  </ul>
);

// ---- charts --------------------------------------------------------------
const WeeklyBarChart = ({ data, maxY = 20, width = 560, height = 360 }) => {
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const barW = innerW / data.length - 22;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[360px]">
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
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="auto" className="max-w-[280px] md:max-w-[320px] lg:max-w-[360px]">
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
   Enhanced Calendar with functional navigation and consistent height
   ============================ */
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

const CalendarCard = ({ pmUid }) => {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);

  // Get the appropriate title based on current view
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
      // day view
      return `${monthNames[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    }
  };

  // Build the appropriate matrix based on current view
  const matrix = useMemo(() => {
    if (view === "month") {
      return buildMonthMatrix(cursor.getFullYear(), cursor.getMonth());
    } else if (view === "week") {
      const startOfWeek = new Date(cursor);
      startOfWeek.setDate(cursor.getDate() - cursor.getDay());
      return buildWeekMatrix(startOfWeek);
    } else {
      // day view
      return buildDayMatrix(cursor);
    }
  }, [cursor, view]);

  // Navigation functions
  const goPrev = () => {
    const newDate = new Date(cursor);
    if (view === "month") {
      newDate.setMonth(cursor.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(cursor.getDate() - 7);
    } else {
      // day view
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
      // day view
      newDate.setDate(cursor.getDate() + 1);
    }
    setCursor(newDate);
  };

  const goToday = () => {
    setCursor(new Date());
  };

  // Get date range for event filtering based on current view
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
      // day view
      return { start: ymd(cursor), end: ymd(cursor) };
    }
  };

  // Load calendar events - UPDATED to properly fetch all schedule events
  useEffect(() => {
    if (!pmUid) return;

    const loadCalendarEvents = async () => {
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

        // Helper to fetch schedule events for teams
        const fetchScheduleEventsForTeams = async (teamIds) => {
          const allEvents = [];
          
          if (teamIds.length === 0) return allEvents;
          
          // Define schedule collections (same as in ProjectManagerEvents)
          const scheduleCollections = [
            { name: "titleDefenseSchedules", type: "Title Defense" },
            { name: "manuscriptSubmissions", type: "Manuscript Submission" },
            { name: "oralDefenseSchedules", type: "Oral Defense" },
            { name: "finalDefenseSchedules", type: "Final Defense" },
            { name: "finalRedefenseSchedules", type: "Final Re-Defense" },
          ];
          
          // Fetch events for each collection
          for (const schedule of scheduleCollections) {
            try {
              // For each collection, we need to fetch events for each team
              // Since Firestore doesn't support "in" queries with more than 10 items at a time, we need to chunk
              for (let i = 0; i < teamIds.length; i += 10) {
                const chunk = teamIds.slice(i, i + 10);
                const q = query(collection(db, schedule.name), where("teamId", "in", chunk));
                const snapshot = await getDocs(q);
                snapshot.forEach((doc) => {
                  const data = doc.data();
                  allEvents.push({
                    id: doc.id,
                    ...data,
                    type: schedule.type,
                    date: data.date || "",
                    timeStart: data.timeStart || "",
                    teamName: data.teamName || (data.team && data.team.name) || "Team",
                    eventType: schedule.type,
                  });
                });
              }
            } catch (error) {
              console.error(`Error fetching ${schedule.name}:`, error);
            }
          }
          
          return allEvents;
        };

        // Load tasks created by PM - EXCLUDE COMPLETED TASKS
        const taskDefs = ["titleDefenseTasks", "oralDefenseTasks", "finalDefenseTasks", "finalRedefenseTasks"];
        const taskSnaps = await Promise.all(
          taskDefs.map((c) => getDocs(query(collection(db, c), where("createdBy.uid", "==", pmUid))))
        );
       
        const tasks = [];
        taskSnaps.forEach((s) => {
          s.forEach((dx) => {
            const data = dx.data() || {};
            // Filter out completed tasks
            if (data.status !== "Completed") {
              tasks.push({ id: dx.id, ...data });
            }
          });
        });

        // Load schedule events for PM teams
        const scheduleEvents = await fetchScheduleEventsForTeams(teamIds);

        // Get current view's date range
        const { start, end } = getDateRange();
        const between = (d) => d >= start && d <= end;

        // Task events with color coding based on status
        const taskEvents = tasks
          .filter((t) => typeof t.dueDate === "string" && t.dueDate.length >= 10 && between(t.dueDate))
          .map((t) => ({
            date: t.dueDate,
            title: `${t.task || t.type || "Task"} (${t.status || "To Do"})`,
            color: statusColor(t.status || "To Do"),
            time: t.dueTime || "",
            teamName: t.team?.name || "Team",
            eventType: "Task",
          }));

        // Schedule events
        const schedEvents = scheduleEvents
          .filter((e) => e.date && between(e.date))
          .map((e) => ({
            date: e.date,
            title: e.eventType || e.type,
            color: MAROON,
            time: e.timeStart || "",
            teamName: e.teamName,
            eventType: "Schedule",
          }));

        // Combine all events
        const merged = [...taskEvents, ...schedEvents];
        setEvents(merged);
      } catch (e) {
        console.error("Calendar load failed:", e);
        setEvents([]);
      }
    };

    loadCalendarEvents();
  }, [pmUid, cursor, view]);

  // Calculate cell height based on view to maintain consistent calendar height
  const getCellHeight = () => {
    if (view === "month") {
      return "min-h-[60px] md:min-h-[80px] lg:min-h-[92px]"; // Responsive heights
    } else if (view === "week") {
      return "min-h-[300px] md:min-h-[400px] lg:min-h-[552px]"; // Responsive heights
    } else {
      return "min-h-[300px] md:min-h-[400px] lg:min-h-[552px]"; // Responsive heights
    }
  };

  // Function to format time for display in calendar events
  const formatTimeForEvent = (timeString) => {
    if (!timeString) return "";
    try {
      if (typeof timeString === "string") {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }
      return timeString;
    } catch (e) {
      return timeString;
    }
  };

  // Render appropriate grid based on view
  const renderGrid = () => {
    const { start } = getDateRange();
    const isCurrentMonth = (date) => {
      if (view === "month") {
        return date && date.getMonth() === cursor.getMonth();
      }
      return true; // For week and day views, all dates are "current"
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
              {/* date number */}
              {!isBlank && (
                <div className={`absolute top-1 right-1 md:top-2 md:right-2 text-xs ${
                  isToday ? "bg-maroon text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center" : "text-neutral-500"
                }`}>
                  {cell.getDate()}
                </div>
              )}

              {/* events - with adjusted positioning for week and day views */}
              <div className={`absolute left-1 right-1 ${
                view === "month" ? "top-6 md:top-8 lg:top-10 max-h-8 md:max-h-10 lg:max-h-12" : "top-8 md:top-10 lg:top-12 max-h-[280px] md:max-h-[380px] lg:max-h-[500px]"
              } space-y-1 overflow-y-auto`}>
                {dayEvents.map((e, idx) => {
                  // Create display text with time if available
                  let displayText = e.title;
                  if (e.time) {
                    const formattedTime = formatTimeForEvent(e.time);
                    if (formattedTime) {
                      displayText = `${e.title} (${formattedTime})`;
                    }
                  }
                  
                  return (
                    <div
                      key={idx}
                      className="text-[10px] md:text-[11px] text-white px-1 md:px-2 py-0.5 rounded truncate"
                      style={{ background: e.color || MAROON }}
                      title={`${e.title}${e.teamName ? ` - ${e.teamName}` : ''}${e.time ? ` at ${formatTimeForEvent(e.time)}` : ''}`}
                    >
                      {displayText}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="w-full">
      {/* Header controls */}
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

      {/* Grid */}
      <div className="p-3 md:p-5">
        {/* Weekday headers - only show for month and week views */}
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

// ---- main ---------------------------------------------------------------
const ProjectManagerDashboard = () => {
  // Live data that falls back to sample values until loaded
  const [upcoming, setUpcoming] = useState([]);
  const [weekly, setWeekly] = useState([
    { key: "todo", label: "To Do", value: 0, color: COLORS.todo }, 
    { key: "inprogress", label: "In Progress", value: 0, color: COLORS.inprogress }, 
    { key: "toreview", label: "To Review", value: 0, color: COLORS.toreview }, 
    { key: "completed", label: "Completed", value: 0, color: COLORS.completed }, 
    { key: "missed", label: "Missed", value: 0, color: COLORS.missed }
  ]);
  const [teamProgress, setTeamProgress] = useState([
    { key: "todo", label: "To Do", pct: 0, color: COLORS.todo }, 
    { key: "inprogress", label: "In Progress", pct: 0, color: COLORS.inprogress }, 
    { key: "toreview", label: "To Review", pct: 0, color: COLORS.toreview }, 
    { key: "completed", label: "Completed", pct: 0, color: COLORS.completed }, 
    { key: "missed", label: "Missed", pct: 0, color: COLORS.missed }
  ]);
  const [recentTasks, setRecentTasks] = useState([]);

  // State for aggregated team progress (to match TeamsSummary)
  const [aggregatedTeamProgress, setAggregatedTeamProgress] = useState({
    todo: 0,
    inprogress: 0,
    review: 0,
    done: 0,
    missed: 0
  });

  // State for PM profile to get last name for team naming
  const [pmProfile, setPmProfile] = useState(null);

  // helpers
  const to12h = (t) => {
    if (!t) return "";
    const [H, M] = String(t).split(":").map(Number);
    const ampm = H >= 12 ? "PM" : "AM";
    const hh = ((H + 11) % 12) + 1;
    return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
  };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return "--";
    const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
    if (!y || !m || !d) return "--";
    return `${MONTHS[m - 1]} ${Number(d)}, ${y}`;
  };

  // Format date for display (like OralDefense.jsx)
  const formatDateMonthDayYear = (dateStr) => {
    if (!dateStr || dateStr === "null") return "--";
   
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "--";
     
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "--";
    }
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

  // Load PM profile to get name for team naming
  useEffect(() => {
    if (!pmUid) return;
    
    const unsub = onSnapshot(
      query(collection(db, "users"), where("uid", "==", pmUid)),
      (snap) => {
        const d = snap.docs[0]?.data();
        if (!d) return;
        const name = [d.firstName, d.middleName, d.lastName]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        setPmProfile({ uid: pmUid, name: name || "Project Manager", lastName: d.lastName || "" });
      }
    );
    return () => unsub && unsub();
  }, [pmUid]);

  // Get team name for adviser tasks (like in OralDefense.jsx)
  const getTeamNameForAdviser = useMemo(() => {
    if (!pmProfile || !pmProfile.name) return "Team";
    
    // Get the PM's last name
    const pmNameParts = pmProfile.name.split(' ');
    const pmLastName = pmNameParts[pmNameParts.length - 1];
    
    return `${pmLastName}, Et Al`;
  }, [pmProfile]);

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

  // Function to fetch Adviser tasks for all teams managed by the PM
  const fetchAdviserTasksForAllTeams = async (teamIds) => {
    const allTasks = [];
    
    // Define task collections (same as in TeamsSummary)
    const taskCollections = ["oralDefenseTasks", "finalDefenseTasks", "finalRedefenseTasks"];
    
    for (const teamId of teamIds) {
      for (const collectionName of taskCollections) {
        try {
          // Query: team.id matches AND taskManager is "Adviser"
          const q = query(
            collection(db, collectionName),
            where("team.id", "==", teamId),
            where("taskManager", "==", "Adviser")
          );
          
          const snapshot = await getDocs(q);
          snapshot.forEach((snap) => {
            const data = { id: snap.id, ...snap.data() };
            allTasks.push(data);
          });
        } catch (error) {
          console.error(`Error fetching tasks from ${collectionName} for team ${teamId}:`, error);
        }
      }
    }
    
    return allTasks;
  };

  // Function to fetch schedule events for PM's teams (similar to ProjectManagerEvents)
  const fetchScheduleEvents = async (teamIds) => {
    const events = [];
    
    if (teamIds.length === 0) return events;
    
    // Define schedule collections
    const scheduleCollections = [
      { name: "titleDefenseSchedules", type: "Title Defense" },
      { name: "manuscriptSubmissions", type: "Manuscript Submission" },
      { name: "oralDefenseSchedules", type: "Oral Defense" },
      { name: "finalDefenseSchedules", type: "Final Defense" },
      { name: "finalRedefenseSchedules", type: "Final Re-Defense" },
    ];
    
    // Helper to chunk fetch by teamId
    const fetchByTeam = async (collName, eventType) => {
      const arr = [];
      for (let i = 0; i < teamIds.length; i += 10) {
        const chunk = teamIds.slice(i, i + 10);
        try {
          const q = query(collection(db, collName), where("teamId", "in", chunk));
          const snapshot = await getDocs(q);
          snapshot.forEach((doc) => {
            const data = doc.data();
            arr.push({
              id: doc.id,
              ...data,
              eventType: eventType,
              type: eventType,
              date: data.date || "",
              timeStart: data.timeStart || "",
              teamName: data.teamName || (data.team && data.team.name) || "Team",
              verdict: data.verdict || "Pending",
            });
          });
        } catch (error) {
          console.error(`Error fetching ${collName}:`, error);
        }
      }
      return arr;
    };
    
    // Fetch all schedule events
    for (const schedule of scheduleCollections) {
      const scheduleEvents = await fetchByTeam(schedule.name, schedule.type);
      events.push(...scheduleEvents);
    }
    
    return events;
  };

  // Load PM-created tasks for weekly summary and recent tasks - UPDATED
  useEffect(() => {
    if (!pmUid) return;

    // Set up real-time listeners for all task collections
    const taskDefs = [
      { key: "title", coll: "titleDefenseTasks" },
      { key: "oral", coll: "oralDefenseTasks" },
      { key: "final", coll: "finalDefenseTasks" },
      { key: "redef", coll: "finalRedefenseTasks" },
    ];

    const unsubscribeListeners = taskDefs.map((def) =>
      onSnapshot(
        query(collection(db, def.coll), where("createdBy.uid", "==", pmUid)),
        (snapshot) => {
          // When any task collection updates, reload all data
          loadAllTasks();
        }
      )
    );

    const loadAllTasks = async () => {
      try {
        const snaps = await Promise.all(
          taskDefs.map((d) => getDocs(query(collection(db, d.coll), where("createdBy.uid", "==", pmUid))))
        );
       
        const all = [];
        snaps.forEach((s) => {
          s.forEach((dx) => {
            const data = dx.data() || {};
            all.push({ id: dx.id, ...data });
          });
        });

        // Upcoming: nearest future dueAtMs (only active tasks, not completed)
        const now = Date.now();
        const upcomingTasks = all
          .filter((t) =>
            typeof t.dueAtMs === "number" &&
            t.dueAtMs >= now &&
            String(t.status || "").toLowerCase() !== "completed"
          )
          .sort((a, b) => (a.dueAtMs || 0) - (b.dueAtMs || 0))
          .slice(0, 5)
          .map((t) => {
            // FIXED: Get assignee name - Match OralDefense.jsx behavior
            let assigneeName = "";
            if (t.assignees && t.assignees.length > 0) {
              if (t.assignees[0].uid === 'team') {
                // For team tasks (Project Manager tasks assigned to team), show "Team"
                assigneeName = "Team";
              } else if (t.taskManager === "Adviser") {
                // For adviser tasks, show team name like "Castaneda, Et Al"
                assigneeName = getTeamNameForAdviser;
              } else {
                // For individual tasks, show the assignee's name
                assigneeName = t.assignees[0].name || "—";
              }
            } else {
              // If no assignees specified, check if it's an adviser task
              if (t.taskManager === "Adviser") {
                assigneeName = getTeamNameForAdviser;
              } else {
                assigneeName = "Team";
              }
            }

            return {
              type: "task",
              name: assigneeName,
              chapter: t.task || t.type || "Task",
              date: formatDateMonthDayYear(t.dueDate || ""),
              time: to12h(t.dueTime || ""),
              color: statusColor(t.status || "To Do"),
              sortKey: t.dueAtMs,
            };
          });

        // Load schedule events for upcoming display
        try {
          // Find teams managed by this PM
          const teamsRef = collection(db, "teams");
          let teamsSnap = await getDocs(query(teamsRef, where("manager.uid", "==", pmUid)));
          let pmTeams = teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

          if (pmTeams.length === 0) {
            const altSnap = await getDocs(query(teamsRef, where("managerUid", "==", pmUid)));
            pmTeams = altSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
          }

          const teamIds = pmTeams.map(t => t.id);
          const scheduleEvents = await fetchScheduleEvents(teamIds);
          
          // Convert schedule events to upcoming format
          const upcomingScheduleEvents = scheduleEvents
            .filter(event => {
              if (!event.date) return false;
              
              // Parse event date and time
              const eventDateStr = event.date;
              const eventTimeStr = event.timeStart || "00:00";
              
              try {
                const eventDateTime = new Date(`${eventDateStr}T${eventTimeStr}`);
                if (isNaN(eventDateTime.getTime())) return false;
                
                // Only include future events
                return eventDateTime.getTime() >= now;
              } catch {
                return false;
              }
            })
            .map(event => {
              const eventDateStr = event.date;
              const eventTimeStr = event.timeStart || "00:00";
              
              return {
                type: "event",
                name: event.teamName,
                chapter: event.eventType || event.type,
                date: formatDateMonthDayYear(eventDateStr),
                time: to12h(eventTimeStr),
                color: MAROON, // Use maroon color for events
                sortKey: new Date(`${eventDateStr}T${eventTimeStr}`).getTime(),
              };
            })
            .sort((a, b) => a.sortKey - b.sortKey)
            .slice(0, 5);

          // Combine tasks and events, sort by date
          const combinedUpcoming = [...upcomingTasks, ...upcomingScheduleEvents]
            .sort((a, b) => a.sortKey - b.sortKey)
            .slice(0, 5);
          
          setUpcoming(combinedUpcoming);
        } catch (e) {
          console.error("Failed to load schedule events:", e);
          setUpcoming(upcomingTasks);
        }

        // Weekly summary: counts by status (simple total)
        const counts = { todo: 0, inprogress: 0, toreview: 0, completed: 0, missed: 0 };
        const nowMs = Date.now();
       
        all.forEach((t) => {
          const s = String(t.status || "To Do").toLowerCase();
          const isOverdue = typeof t.dueAtMs === "number" && t.dueAtMs < nowMs && (t.status || "") !== "Completed";

          if (isOverdue) {
            counts.missed++;
          } else if (s.includes("review")) {
            counts.toreview++;
          } else if (s.includes("progress")) {
            counts.inprogress++;
          } else if (s.includes("complete")) {
            counts.completed++;
          } else {
            counts.todo++;
          }
        });
       
        setWeekly([
          { key: "todo", label: "To Do", value: counts.todo, color: COLORS.todo },
          { key: "inprogress", label: "In Progress", value: counts.inprogress, color: COLORS.inprogress },
          { key: "toreview", label: "To Review", value: counts.toreview, color: COLORS.toreview },
          { key: "completed", label: "Completed", value: counts.completed, color: COLORS.completed },
          { key: "missed", label: "Missed", value: counts.missed, color: COLORS.missed },
        ]);

        // Recent tasks - Only show 4 most recently created tasks - UPDATED to match OralDefense.jsx
        const recent = all
          .map((t) => {
            // FIXED: Get assignee name - Match OralDefense.jsx behavior
            let assigneeName = "";
            if (t.assignees && t.assignees.length > 0) {
              if (t.assignees[0].uid === 'team') {
                // For team tasks (Project Manager tasks assigned to team), show "Team"
                assigneeName = "Team";
              } else if (t.taskManager === "Adviser") {
                // For adviser tasks, show team name like "Castaneda, Et Al"
                assigneeName = getTeamNameForAdviser;
              } else {
                // For individual tasks, show the assignee's name
                assigneeName = t.assignees[0].name || "—";
              }
            } else {
              // If no assignees specified, check if it's an adviser task
              if (t.taskManager === "Adviser") {
                assigneeName = getTeamNameForAdviser;
              } else {
                assigneeName = "Team";
              }
            }

            // FIXED: Elements column - match OralDefense.jsx behavior
            let elementValue = "--";
            if (t.elements && t.elements !== "--" && t.elements !== "null") {
              elementValue = t.elements;
            }

            return {
              createdKey: t.createdAt?.toMillis?.() || 0,
              assigned: assigneeName,
              task: t.task || t.type || "Task",
              subtask: t.subtasks || "--",
              element: elementValue, // FIXED: Use proper elements field
              created: t.createdAt?.toDate?.()?.toLocaleDateString?.() || "--",
              due: formatDateMonthDayYear(t.dueDate || ""),
              time: to12h(t.dueTime || ""),
              status: t.status || "To Do",
              phase: t.phase || "--",
            };
          })
          .filter((x) => x.createdKey > 0)
          .sort((a, b) => b.createdKey - a.createdKey)
          .slice(0, 4)
          .map((x, i) => ({ no: i + 1, ...x }));
       
        setRecentTasks(recent);
      } catch (e) {
        console.error("Dashboard data load failed:", e);
      }
    };

    // Initial load
    loadAllTasks();

    // Cleanup listeners
    return () => {
      unsubscribeListeners.forEach(unsub => unsub && unsub());
    };
  }, [pmUid, getTeamNameForAdviser]);

  // Load Adviser tasks for all teams managed by PM (to match TeamsSummary progress)
  useEffect(() => {
    if (!pmUid) return;

    const loadAdviserTasksForTeamProgress = async () => {
      try {
        // 1) Find the PM's teams
        const teamsRef = collection(db, "teams");
        let teamsSnap = await getDocs(query(teamsRef, where("manager.uid", "==", pmUid)));
        let pmTeams = teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

        if (pmTeams.length === 0) {
          const altSnap = await getDocs(query(teamsRef, where("managerUid", "==", pmUid)));
          pmTeams = altSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        }

        if (pmTeams.length === 0) {
          setAggregatedTeamProgress({
            todo: 0,
            inprogress: 0,
            review: 0,
            done: 0,
            missed: 0
          });
          return;
        }

        const teamIds = pmTeams.map(t => t.id);
        
        // 2) Fetch Adviser tasks for all teams (same as TeamsSummary)
        const allAdviserTasks = await fetchAdviserTasksForAllTeams(teamIds);
        
        // 3) Calculate aggregated progress (same logic as TeamsSummary)
        const progress = {
          todo: allAdviserTasks.filter(task => task.status === "To Do").length,
          inprogress: allAdviserTasks.filter(task => task.status === "In Progress").length,
          review: allAdviserTasks.filter(task => task.status === "To Review").length,
          done: allAdviserTasks.filter(task => task.status === "Completed").length,
          missed: allAdviserTasks.filter(task => task.status === "Missed").length,
        };

        setAggregatedTeamProgress(progress);
        
      } catch (error) {
        console.error("Error loading adviser tasks for team progress:", error);
        setAggregatedTeamProgress({
          todo: 0,
          inprogress: 0,
          review: 0,
          done: 0,
          missed: 0
        });
      }
    };

    loadAdviserTasksForTeamProgress();
    
    // Set up interval to refresh data periodically (every 30 seconds)
    const intervalId = setInterval(loadAdviserTasksForTeamProgress, 30000);
    
    return () => clearInterval(intervalId);
  }, [pmUid]);

  // Calculate team progress donut segments based on aggregated adviser tasks
  const teamProgressDonutSegments = useMemo(() => {
    const total = aggregatedTeamProgress.todo + 
                  aggregatedTeamProgress.inprogress + 
                  aggregatedTeamProgress.review + 
                  aggregatedTeamProgress.done + 
                  aggregatedTeamProgress.missed;
    
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    
    return [
      { key: "todo", label: "To Do", pct: pct(aggregatedTeamProgress.todo), color: COLORS.todo },
      { key: "inprogress", label: "In Progress", pct: pct(aggregatedTeamProgress.inprogress), color: COLORS.inprogress },
      { key: "toreview", label: "To Review", pct: pct(aggregatedTeamProgress.review), color: COLORS.toreview },
      { key: "completed", label: "Completed", pct: pct(aggregatedTeamProgress.done), color: COLORS.completed },
      { key: "missed", label: "Missed", pct: pct(aggregatedTeamProgress.missed), color: COLORS.missed },
    ];
  }, [aggregatedTeamProgress]);

  // Calculate team progress center text (completion percentage)
  const teamProgressCenterText = useMemo(() => {
    const total = aggregatedTeamProgress.todo + 
                  aggregatedTeamProgress.inprogress + 
                  aggregatedTeamProgress.review + 
                  aggregatedTeamProgress.done + 
                  aggregatedTeamProgress.missed;
    
    const completion = total > 0 ? Math.round((aggregatedTeamProgress.done / total) * 100) : 0;
    return `${completion}%`;
  }, [aggregatedTeamProgress]);

  return (
    <div className="space-y-6 md:space-y-8 w-full">
      {/* UPCOMING */}
      <section className="space-y-3 w-full">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          UPCOMING TASKS
        </h3>
        <UpcomingTasksCarousel tasks={upcoming} />
      </section>

      {/* BOTTOM ROW: Weekly Summary + Team Progress */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 w-full">
        {/* Weekly Summary */}
        <Card className="w-full">
          <div className="px-4 md:px-6 pt-4 md:pt-5">
            <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
              WEEKLY SUMMARY
            </h3>
          </div>
          <div className="p-4 md:p-6 w-full">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6 w-full">
              <div className="xl:col-span-8 w-full">
                <WeeklyBarChart data={weekly} />
              </div>
              <div className="xl:col-span-4 flex items-center justify-center w-full">
                <div className="w-full flex justify-center">
                  <Legend items={weekly} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Team Progress - UPDATED to use Adviser tasks */}
        <Card className="w-full">
          <div className="px-4 md:px-6 pt-4 md:pt-5">
            <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
              TEAM PROGRESS
            </h3>
          </div>
          <div className="p-4 md:p-6 w-full">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6 items-center w-full">
              <div className="xl:col-span-8 flex justify-center w-full">
                <div className="w-full max-w-[280px] md:max-w-[320px] lg:max-w-[360px]">
                  <Donut
                    segments={teamProgressDonutSegments}
                    centerText={teamProgressCenterText}
                  />
                </div>
              </div>
              <div className="xl:col-span-4 flex items-center justify-center w-full">
                <div className="w-full flex justify-center">
                  <Legend items={teamProgressDonutSegments} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* RECENT TASKS CREATED */}
      <section className="space-y-3 w-full">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          RECENT TASKS CREATED
        </h3>

        <div className="bg-white border border-neutral-200 rounded-[20px] shadow overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="py-3 pl-4 md:pl-6 pr-2 md:pr-3 w-12">NO</th>
                  <th className="py-3 pr-2 md:pr-3">Assigned</th>
                  <th className="py-3 pr-2 md:pr-3">Task</th>
                  <th className="py-3 pr-2 md:pr-3 hidden sm:table-cell">Subtask</th>
                  <th className="py-3 pr-2 md:pr-3">Elements</th>
                  <th className="py-3 pr-2 md:pr-3 hidden lg:table-cell">
                    <div className="inline-flex items-center gap-2 whitespace-nowrap">
                      <CalendarDays className="w-4 h-4" /> Date Created
                    </div>
                  </th>
                  <th className="py-3 pr-2 md:pr-3">
                    <div className="inline-flex items-center gap-2 whitespace-nowrap">
                      <CalendarDays className="w-4 h-4" /> Due Date
                    </div>
                  </th>
                  <th className="py-3 pr-2 md:pr-3 hidden md:table-cell">
                    <div className="inline-flex items-center gap-2 whitespace-nowrap">
                      <Clock className="w-4 h-4" /> Time
                    </div>
                  </th>
                  <th className="py-3 pr-2 md:pr-3">Status</th>
                  <th className="py-3 pr-4 md:pr-6 hidden xl:table-cell">Project Phase</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((r) => (
                  <tr key={r.no} className="border-t border-neutral-200">
                    <td className="py-3 pl-4 md:pl-6 pr-2 md:pr-3">{r.no}.</td>
                    <td className="py-3 pr-2 md:pr-3">{r.assigned}</td>
                    <td className="py-3 pr-2 md:pr-3">{r.task}</td>
                    <td className="py-3 pr-2 md:pr-3 hidden sm:table-cell">{r.subtask}</td>
                    <td className="py-3 pr-2 md:pr-3">{r.element}</td>
                    <td className="py-3 pr-2 md:pr-3 hidden lg:table-cell">{r.created}</td>
                    <td className="py-3 pr-2 md:pr-3">{r.due}</td>
                    <td className="py-3 pr-2 md:pr-3 hidden md:table-cell">{r.time}</td>
                    <td className="py-3 pr-2 md:pr-3">
                      <span
                        className="inline-flex items-center rounded-full px-2 md:px-3 py-1 text-xs font-semibold text-white whitespace-nowrap"
                        style={{ backgroundColor: statusColor(r.status) }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 md:pr-6 hidden xl:table-cell">{r.phase}</td>
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
      <section className="space-y-3 w-full">
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