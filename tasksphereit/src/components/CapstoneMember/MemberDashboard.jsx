// src/components/Member/MemberDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Users } from "lucide-react";

// Firestore
import { db } from "../../config/firebase";
import { collection, getDocs, query, where, doc, getDoc, onSnapshot } from "firebase/firestore";
import { getUserTeams } from "../../services/events";

const MAROON = "#6A0F14";

// brand/status colors
const COLORS = {
  todo: "#D9A81E",
  inprogress: "#7C9C3B",
  toreview: "#6FA8DC",
  completed: "#8E5BAA",
  missed: "#3B0304", // Maroon for missed tasks
};

const statusColor = (s) =>
  s === "To Review" ? COLORS.toreview :
    s === "In Progress" ? COLORS.inprogress :
      s === "To Do" ? COLORS.todo :
        s === "Completed" ? COLORS.completed :
          COLORS.missed; // This now returns "#3B0304" for missed tasks

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

// Function to fetch schedule events for teams
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

// Function to fetch adviser tasks for teams (from MemberAdviserTasks.jsx) - EXCLUDE COMPLETED TASKS
const fetchAdviserTasksForTeams = async (teamIds) => {
  const allTasks = [];
  
  // Define task collections (same as MemberAdviserTasks.jsx)
  const taskCollections = ["oralDefenseTasks", "finalDefenseTasks", "finalRedefenseTasks"];
  
  for (const teamId of teamIds) {
    for (const collectionName of taskCollections) {
      try {
        // Query: team.id matches AND taskManager is "Adviser" AND status is not "Completed"
        const q = query(
          collection(db, collectionName),
          where("team.id", "==", teamId),
          where("taskManager", "==", "Adviser"),
          where("status", "!=", "Completed") // EXCLUDE COMPLETED TASKS
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

const CalendarCard = ({ uid }) => {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allScheduleEvents, setAllScheduleEvents] = useState([]);
  const [allAdviserTasks, setAllAdviserTasks] = useState([]);

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

  // Format time for display
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

  // Load all data once
  useEffect(() => {
    let alive = true;
    if (!uid) return;
   
    (async () => {
      try {
        // Find teams for this member
        const teams = await getUserTeams(uid);
        const teamIds = teams.map((t) => t.id);

        // Load tasks assigned to member (EXCLUDE COMPLETED TASKS)
        const taskDefs = ["titleDefenseTasks", "oralDefenseTasks", "finalDefenseTasks", "finalRedefenseTasks"];
        const memberTasks = [];
       
        for (const collName of taskDefs) {
          const s = await getDocs(collection(db, collName));
          s.forEach((dx) => {
            const data = dx.data() || {};
            // Filter: assigned to member AND status is not "Completed"
            if (Array.isArray(data.assignees) && 
                data.assignees.some(a => a?.uid === uid) && 
                data.status !== "Completed") { // EXCLUDE COMPLETED TASKS
              memberTasks.push({ id: dx.id, ...data });
            }
          });
        }

        // Load schedule events for member teams
        const scheduleEvents = await fetchScheduleEvents(teamIds);
        
        // Load adviser tasks for member teams (EXCLUDE COMPLETED TASKS)
        const adviserTasks = await fetchAdviserTasksForTeams(teamIds);

        if (alive) {
          setAllTasks(memberTasks);
          setAllScheduleEvents(scheduleEvents);
          setAllAdviserTasks(adviserTasks);
        }
      } catch (e) {
        console.error("Calendar data load failed:", e);
      }
    })();
    return () => { alive = false; };
  }, [uid]);

  // Update events when cursor or view changes
  useEffect(() => {
    // Get current view's date range
    const { start, end } = getDateRange();
    const between = (d) => d >= start && d <= end;

    // Member task events with color coding (all tasks are already filtered to exclude completed)
    const taskEvents = allTasks
      .filter((t) => typeof t.dueDate === "string" && t.dueDate.length >= 10 && between(t.dueDate))
      .map((t) => {
        // Check if task is missed (from MemberTasks.jsx logic)
        const isMissed = typeof t.dueAtMs === "number" && 
                       t.dueAtMs < Date.now() && 
                       (t.status || "") !== "Completed";
        const displayStatus = isMissed ? "Missed" : (t.status || "To Do");
        
        return {
          date: t.dueDate,
          title: `${t.task || t.type || "Task"} (${displayStatus})`,
          color: statusColor(displayStatus), // This will use "#3B0304" for missed
          time: t.dueTime || "",
          teamName: t.team?.name || "Team",
          eventType: "Task",
        };
      });

    // Schedule events (they don't have completion status, so show all)
    const schedEvents = allScheduleEvents
      .filter((e) => e.date && between(e.date))
      .map((e) => ({
        date: e.date,
        title: e.eventType || e.type,
        color: MAROON,
        time: e.timeStart || "",
        teamName: e.teamName,
        eventType: "Schedule",
      }));

    // Adviser task events (already filtered to exclude completed)
    const adviserTaskEvents = allAdviserTasks
      .filter((t) => typeof t.dueDate === "string" && t.dueDate.length >= 10 && between(t.dueDate))
      .map((t) => {
        // Check if adviser task is missed
        const isMissed = typeof t.dueAtMs === "number" && 
                       t.dueAtMs < Date.now() && 
                       (t.status || "") !== "Completed";
        const displayStatus = isMissed ? "Missed" : (t.status || "To Do");
        
        return {
          date: t.dueDate,
          title: `${t.task || t.type || "Adviser Task"} (${displayStatus})`,
          color: isMissed ? "#3B0304" : "#4A5568", // Dark maroon for missed adviser tasks, dark gray for others
          time: t.dueTime || "",
          teamName: t.team?.name || "Team",
          eventType: "Adviser Task",
        };
      });

    // Combine all events
    const merged = [...taskEvents, ...schedEvents, ...adviserTaskEvents];
    setEvents(merged);
  }, [cursor, view, allTasks, allScheduleEvents, allAdviserTasks]);

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
function MemberDashboard() {
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;
 
  // Live data that falls back to sample values until loaded
  const [upcoming, setUpcoming] = useState([]);
  const [weekly, setWeekly] = useState([
    { key: "todo", label: "To Do", value: 0, color: COLORS.todo },
    { key: "inprogress", label: "In Progress", value: 0, color: COLORS.inprogress },
    { key: "toreview", label: "To Review", value: 0, color: COLORS.toreview },
    { key: "completed", label: "Completed", value: 0, color: COLORS.completed },
    { key: "missed", label: "Missed", value: 0, color: COLORS.missed }
  ]);

  // helpers
  const to12h = (t) => {
    if (!t) return "";
    const [H, M] = String(t).split(":").map(Number);
    const ampm = H >= 12 ? "PM" : "AM";
    const hh = ((H + 11) % 12) + 1;
    return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
  };
 
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Format date for display
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

  // Load member tasks and compute dashboard data
  useEffect(() => {
    if (!uid) return;
   
    (async () => {
      try {
        // Get member's teams
        const teams = await getUserTeams(uid);
        const teamIds = teams.map(t => t.id);

        // Fetch member tasks (EXCLUDE COMPLETED TASKS) - from MemberTasks.jsx
        const cols = [
          { tag: "Title Defense", coll: "titleDefenseTasks" },
          { tag: "Oral Defense", coll: "oralDefenseTasks" },
          { tag: "Final Defense", coll: "finalDefenseTasks" },
          { tag: "Final Re-Defense", coll: "finalRedefenseTasks" },
        ];

        const snaps = await Promise.all(
          cols.map((c) => getDocs(collection(db, c.coll)))
        );
       
        const allTasks = [];
        snaps.forEach((s, i) => {
          const tag = cols[i].tag;
          s.forEach((dx) => {
            const d = dx.data() || {};
            allTasks.push({ id: dx.id, tag, ...d });
          });
        });

        // Filter tasks assigned to this member (EXCLUDE COMPLETED TASKS)
        const mine = allTasks.filter(
          (t) =>
            Array.isArray(t.assignees) &&
            t.assignees.some((a) => a?.uid === uid) &&
            String(t.status || "").toLowerCase() !== "completed"
        );

        // Fetch schedule events for member's teams
        const scheduleEvents = await fetchScheduleEvents(teamIds);
        
        // Fetch adviser tasks for member's teams (EXCLUDE COMPLETED TASKS)
        const adviserTasks = await fetchAdviserTasksForTeams(teamIds);

        // Upcoming: Combine tasks, schedule events, and adviser tasks (future dates only, exclude completed)
        const now = Date.now();
        
        // Format member tasks for upcoming (only future tasks)
        const upcomingTasks = mine
          .filter((t) => typeof t.dueAtMs === "number" && t.dueAtMs >= now)
          .map((t) => {
            const assignee = Array.isArray(t.assignees)
              ? t.assignees.find((a) => a?.uid === uid) || t.assignees[0]
              : null;

            const fullName = assignee?.name || "";
            let last = "", first = "", middle = "";

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
            let color = COLORS.todo;
            if (status.includes("progress")) color = COLORS.inprogress;
            else if (status.includes("review")) color = COLORS.toreview;
            else if (status.includes("complete")) color = COLORS.completed;
            else if (status.includes("miss")) color = COLORS.missed;

            return {
              type: "task",
              name: member,
              chapter: t.task || "Task",
              date: formatDateMonthDayYear(t.dueDate || ""),
              time: to12h(t.dueTime || ""),
              color,
              sortKey: t.dueAtMs,
            };
          });

        // Format schedule events for upcoming (only future events)
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
              type: "schedule",
              name: event.teamName,
              chapter: event.eventType || event.type,
              date: formatDateMonthDayYear(eventDateStr),
              time: to12h(eventTimeStr),
              color: MAROON,
              sortKey: new Date(`${eventDateStr}T${eventTimeStr}`).getTime(),
            };
          });

        // Format adviser tasks for upcoming (only future tasks)
        const upcomingAdviserTasks = adviserTasks
          .filter(t => typeof t.dueAtMs === "number" && t.dueAtMs >= now)
          .map(t => ({
            type: "adviser",
            name: "Adviser Task",
            chapter: t.task || "Adviser Task",
            date: formatDateMonthDayYear(t.dueDate || ""),
            time: to12h(t.dueTime || ""),
            color: "#4A5568", // Dark gray for adviser tasks
            sortKey: t.dueAtMs,
          }));

        // Combine all upcoming items and sort by date
        const combinedUpcoming = [...upcomingTasks, ...upcomingScheduleEvents, ...upcomingAdviserTasks]
          .sort((a, b) => a.sortKey - b.sortKey)
          .slice(0, 5);
        
        setUpcoming(combinedUpcoming);

        // Weekly summary: counts by status (with missed logic) - Only from member's tasks
        const counts = { todo: 0, inprogress: 0, toreview: 0, completed: 0, missed: 0 };
        const nowMs = Date.now();
       
        mine.forEach((t) => {
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

      } catch (e) {
        console.error("MemberDashboard load failed:", e);
      }
    })();
  }, [uid]);

  return (
    <div className="space-y-6 md:space-y-8 w-full p-6">
      {/* UPCOMING TASKS */}
      <section className="space-y-3 w-full">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          UPCOMING TASKS
        </h3>
        <UpcomingTasksCarousel tasks={upcoming} />
      </section>

      {/* WEEKLY SUMMARY */}
      <section className="space-y-3 w-full">
        <Card className="w-full max-w-4xl mr-auto">
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
      </section>

      {/* CALENDAR */}
      <section className="space-y-3 w-full">
        <h3 className="text-xl font-extrabold tracking-wide" style={{ color: MAROON }}>
          CALENDAR
        </h3>
        <CalendarCard uid={uid} />
      </section>
    </div>
  );
}

export default MemberDashboard;