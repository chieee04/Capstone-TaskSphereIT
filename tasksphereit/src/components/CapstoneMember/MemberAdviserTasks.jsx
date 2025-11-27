// src/components/CapstoneMember/MemberAdviserTasks.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  SlidersHorizontal,
  Eye,
  MoreVertical,
  ChevronDown,
  X,
  ChevronRight,
} from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";


const MAROON = "#6A0F14";


/* ---------- Status Colors ---------- */
const STATUS_COLORS = {
  "To Do": "#FABC3F", // Yellow
  "In Progress": "#809D3C", // Green
  "To Review": "#578FCA", // Blue
  "Completed": "#AA60C8", // Purple
  "Missed": "#3B0304", // Maroon
};


const FILTER_OPTIONS = ["All Status", "To Do", "In Progress", "To Review", "Completed", "Missed"];


/* ===== Status component ===== */
const StatusBadgeMemberAdviserTasks = ({ value }) => {
  const backgroundColor = STATUS_COLORS[value] || "#6B7280"; // Default gray
 
  if (!value || value === "--") return <span>--</span>;
 
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium text-white"
      style={{ backgroundColor }}
    >
      {value}
    </span>
  );
};


const RevisionPill = ({ value }) =>
  value && value !== "null" && value !== "No Revision" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-neutral-100 border border-neutral-200">
      {value}
    </span>
  ) : (
    <span>--</span>
  );


// Helper functions for date and time formatting
const formatDateMonthDayYear = (dateStr) => {
  if (!dateStr || dateStr === "null") return "null";
 
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "null";
   
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "null";
  }
};


const formatTime12Hour = (time24) => {
  if (!time24 || time24 === "null") return "null";
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
};


const displayDueDate = (dueDate) => {
  return dueDate ? formatDateMonthDayYear(dueDate) : "--";
};


const displayDueTime = (dueTime) => {
  return dueTime ? formatTime12Hour(dueTime) : "--";
};


/* ---------- Card Configuration ---------- */
const CARDS = [
  { key: "oral", label: "Oral Defense", icon: ClipboardList },
  { key: "final", label: "Final Defense", icon: ClipboardList },
  { key: "finalRedefense", label: "Final Re-Defense", icon: ClipboardList },
];


/* ---------- Card Component ---------- */
function TaskCard({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg transition-all duration-300
                 hover:shadow-2xl hover:-translate-y-2 hover:border-gray-300 active:scale-[0.98] text-neutral-800 overflow-hidden group"
    >
      {/* Left side accent - reduced width */}
      <div
        className="absolute left-0 top-0 w-6 h-full rounded-l-2xl transition-all duration-300 group-hover:w-8"
        style={{ background: MAROON }}
      />
     
      {/* Bottom accent - reduced height */}
      <div
        className="absolute bottom-0 left-0 right-0 h-6 rounded-b-2xl transition-all duration-300 group-hover:h-8"
        style={{ background: MAROON }}
      />
     
      {/* Central content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pl-6 pr-4 pt-2 pb-10">
        {/* Task icon - centered in main white area with animation */}
        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="w-16 h-16 mb-4 text-black" />
        </div>
       
        {/* Title text - positioned below icon */}
        <span className="text-base font-bold text-center leading-tight text-black transition-all duration-300 group-hover:scale-105">
          {label}
        </span>
      </div>


      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style={{
             boxShadow: `0 0 20px ${MAROON}40`,
             background: `radial-gradient(circle at center, transparent 0%, ${MAROON}10 100%)`
           }} />
    </button>
  );
}


export default function MemberAdviserTasks() {
  const navigate = useNavigate();
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [userTeam, setUserTeam] = useState(null);


  // Get user's team first
  useEffect(() => {
    const getUserTeam = async () => {
      if (!uid) return;
     
      try {
        // Get user document to find their team
        const userQuery = query(collection(db, "users"), where("uid", "==", uid));
        const userSnap = await getDocs(userQuery);
       
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          console.log("User data:", userData);
         
          // Find which team this user belongs to
          const teamsQuery = query(collection(db, "teams"));
          const teamsSnap = await getDocs(teamsQuery);
         
          teamsSnap.forEach(teamDoc => {
            const teamData = teamDoc.data();
            const memberUids = teamData.memberUids || [];
            const managerUid = teamData.manager?.uid;
           
            // Check if user is a member or manager of this team
            if (memberUids.includes(uid) || managerUid === uid) {
              setUserTeam({
                id: teamDoc.id,
                name: teamData.name || "Team"
              });
            }
          });
        }
      } catch (error) {
        console.error("Error getting user team:", error);
      }
    };
   
    getUserTeam();
  }, [uid]);


  // Load tasks when a category is selected
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);


        if (!userTeam || !selectedCategory) {
          setRows([]);
          setLoading(false);
          return;
        }


        // Determine collection name based on selected category
        const collectionName =
          selectedCategory === "final"
            ? "finalDefenseTasks"
            : selectedCategory === "oral"
            ? "oralDefenseTasks"
            : selectedCategory === "finalRedefense"
            ? "finalRedefenseTasks"
            : null;


        if (!collectionName) {
          setRows([]);
          setLoading(false);
          return;
        }


        console.log(`Fetching tasks from ${collectionName} for team:`, userTeam);


        // Get ALL tasks from the collection
        const snaps = await getDocs(collection(db, collectionName));
        const all = [];
        snaps.forEach((dx) =>
          all.push({ id: dx.id, sourceColl: collectionName, ...(dx.data() || {}) })
        );


        console.log(`Total tasks in ${collectionName}:`, all.length);


        // Filter tasks: Adviser tasks for the user's team
        const teamTasks = all.filter((t) => {
          const isAdviserTask = t?.taskManager === "Adviser";
          const isForMyTeam = userTeam && t.team?.id === userTeam.id;
         
          return isAdviserTask && isForMyTeam;
        });


        console.log(`Team tasks in ${collectionName}:`, teamTasks.length);
       
        const mapped = teamTasks.map((t) => {
          const dueDate = t.dueDate || "";
          const dueTime = t.dueTime || "";
          const createdAt = t.createdAt?.toDate?.()?.toISOString()?.split("T")[0] || "";
          const dueAtMs = typeof t.dueAtMs === "number" ? t.dueAtMs : null;
         
          // Check if task is missed
          const isMissed = dueAtMs !== null && dueAtMs < Date.now() && t.status !== "Completed";
          const displayStatus = isMissed ? "Missed" : (t.status || "To Do");
         
          return {
            id: t.id,
            sourceColl: t.sourceColl,
            task: t.task || t.type || "Task",
            subtask: t.subtasks || "—",
            element: t.elements || "—",
            dateCreated: formatDateMonthDayYear(createdAt) || "—",
            dueDate: displayDueDate(dueDate),
            time: displayDueTime(dueTime),
            revision: t.revision || "No Revision",
            status: displayStatus,
            projectPhase: t.phase || "Design",
            methodology: t.methodology || "--",
            team: t.team?.name || "Team",
            dueAtMs: dueAtMs,
            _missed: isMissed,
            existingTask: t,
          };
        });


        mapped.sort((a, b) => {
          const ak = a.existingTask?.createdAt?.toMillis?.() || 0;
          const bk = b.existingTask?.createdAt?.toMillis?.() || 0;
          if (bk !== ak) return bk - ak;
          return (a.dueDate || "").localeCompare(b.dueDate || "");
        });


        console.log(`Mapped tasks:`, mapped);
       
        if (alive) setRows(mapped);
      } catch (e) {
        console.error("MemberAdviserTasks load failed:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedCategory, userTeam]);


  // Filter data based on search and status filter
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = rows;
   
    // Apply status filter
    if (filterStatus !== "All Status") {
      if (filterStatus === "Missed") {
        base = base.filter((r) => r._missed);
      } else {
        base = base.filter((r) => (r.status || "").toLowerCase() === filterStatus.toLowerCase());
      }
    }
   
    // Apply search filter
    if (!q) return base;
    return base.filter((r) =>
      [r.task, r.subtask, r.element, r.status, r.projectPhase, r.methodology, r.team]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchQuery, filterStatus]);


  const handleViewTask = (row) => {
    navigate("/member/tasks-board", { state: { selectedTask: row } });
  };


  const handleCardClick = (categoryKey) => {
    setSelectedCategory(categoryKey);
    // Reset search and filter when switching categories
    setSearchQuery("");
    setFilterStatus("All Status");
  };


  const handleBackToCards = () => {
    setSelectedCategory(null);
    setRows([]);
    setSearchQuery("");
    setFilterStatus("All Status");
  };


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpenId && !event.target.closest('.dropdown-container')) {
        setMenuOpenId(null);
      }
      if (isFilterOpen && !event.target.closest('.filter-container')) {
        setIsFilterOpen(false);
      }
    };


    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenId, isFilterOpen]);


  // Show only cards initially
  if (!selectedCategory) {
    return (
      <div className="p-4 md:p-6">
        {/* ===== Title + horizontal line ===== */}
        <div className="space-y-2 mb-6">
          <div
            className="flex items-center gap-2 text-[18px] font-semibold"
            style={{ color: MAROON }}
          >
            <ClipboardList className="w-5 h-5" />
            <span>Adviser Tasks</span>
          </div>
          <div className="h-[3px] w-full" style={{ backgroundColor: MAROON }} />
        </div>


        {/* ===== Cards ===== */}
        <div className="flex flex-wrap gap-6">
          {CARDS.map(({ key, label, icon }) => (
            <TaskCard
              key={key}
              label={label}
              icon={icon}
              onClick={() => handleCardClick(key)}
            />
          ))}
        </div>
      </div>
    );
  }


  // Show table when a category is selected
  return (
    <div className="p-4 md:p-6">
      {/* ===== Title + horizontal line ===== */}
      <div className="space-y-2 mb-6">
        <div
          className="flex items-center gap-2 text-[18px] font-semibold"
          style={{ color: MAROON }}
        >
          <button
            onClick={handleBackToCards}
            className="p-1 rounded-md hover:bg-neutral-100 transition-colors"
            title="Back to defense types"
          >
            <ChevronDown className="w-5 h-5 transform rotate-90" />
          </button>
          <ClipboardList className="w-5 h-5" />
          <span>Adviser Tasks</span>
          <ChevronRight className="w-4 h-4 text-neutral-500" />
          <span>
            {selectedCategory === "oral" && "Oral Defense"}
            {selectedCategory === "final" && "Final Defense"}
            {selectedCategory === "finalRedefense" && "Final Re-Defense"}
          </span>
        </div>
        <div className="h-[3px] w-full" style={{ backgroundColor: MAROON }} />
      </div>


      {/* ===== Toolbar — Search and Filter ===== */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {/* Back button for mobile */}
          <button
            onClick={handleBackToCards}
            className="md:hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-sm"
          >
            <ChevronDown className="w-4 h-4 transform rotate-90" />
            Back
          </button>


          {/* Reduced width search - matching MemberTasks */}
          <div className="w-[180px]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 bg-white transition-colors focus-within:border-[#6A0F14] focus-within:ring-1 focus-within:ring-[#6A0F14]">
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                className="flex-1 outline-none text-sm bg-transparent"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>


        {/* Filter - matching MemberTasks UI */}
        <div className="relative filter-container">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm">Filter</span>
          </button>


          {isFilterOpen && (
            <div className="absolute right-0 top-10 z-50 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
              {FILTER_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setFilterStatus(status);
                    setIsFilterOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 ${
                    filterStatus === status ? "bg-neutral-100 font-medium" : ""
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* ===== Table - matching MemberTasks design ===== */}
      <div className="w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left p-3 whitespace-nowrap">NO</th>
              <th className="text-left p-3 whitespace-nowrap">Team</th>
              <th className="text-left p-3 whitespace-nowrap">Task Type</th>
              <th className="text-left p-3 whitespace-nowrap">Task</th>
              <th className="text-left p-3 whitespace-nowrap">Subtasks</th>
              <th className="text-left p-3 whitespace-nowrap">Elements</th>
              <th className="text-left p-3 whitespace-nowrap">Date Created</th>
              <th className="text-left p-3 whitespace-nowrap">Due Date</th>
              <th className="text-left p-3 whitespace-nowrap">Time</th>
              <th className="text-left p-3 whitespace-nowrap">Revision NO</th>
              <th className="text-left p-3 whitespace-nowrap">Status</th>
              <th className="text-left p-3 whitespace-nowrap">Methodology</th>
              <th className="text-left p-3 whitespace-nowrap">Project Phase</th>
              <th className="text-right p-3 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => {
              const rowNo = idx + 1;
              const isMissed = row.status === "Missed" || row._missed;
              const displayStatus = isMissed ? "Missed" : row.status;
             
              return (
                <tr key={row.id} className="border-t border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <td className="p-3 align-top whitespace-nowrap">{rowNo}</td>
                  <td className="p-3 align-top whitespace-nowrap">
                    <div className="font-medium">{row.team}</div>
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">{row.existingTask?.type || "--"}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.task}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.subtask}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.element}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.dateCreated}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.dueDate}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.time}</td>
                  <td className="p-3 align-top whitespace-nowrap">
                    <RevisionPill value={row.revision} />
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">
                    <StatusBadgeMemberAdviserTasks value={displayStatus} />
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">{row.methodology}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.projectPhase}</td>
                  <td className="p-3 align-top text-right whitespace-nowrap">
                    {/* Kebab menu - keeping original actions */}
                    <div className="relative inline-block dropdown-container">
                      <button
                        className="p-1.5 rounded-md transition-colors hover:bg-neutral-100"
                        onClick={() => setMenuOpenId(menuOpenId === row.id ? null : row.id)}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === row.id && (
                        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg animate-in fade-in-0 zoom-in-95">
                          <div className="flex flex-col">
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                              onClick={() => {
                                setMenuOpenId(null);
                                handleViewTask(row);
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}


            {filteredData.length === 0 && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-neutral-500">
                  {loading ? "Loading adviser tasks..." : "No adviser tasks found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {/* ===== View Modal ===== */}
      {viewRow && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setViewRow(null)}
          />
          <div className="absolute left-1/2 top-1/2 w-[720px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="px-5 py-3" style={{ backgroundColor: MAROON }}>
              <div className="text-white text-sm font-semibold">Task Details</div>
            </div>
            <div className="p-5 text-sm space-y-2">
              <div>
                <b>Team:</b> {viewRow.team}
              </div>
              <div>
                <b>Task:</b> {viewRow.task}
              </div>
              <div>
                <b>Subtask:</b> {viewRow.subtask}
              </div>
              <div>
                <b>Element:</b> {viewRow.element}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <b>Date Created:</b> {viewRow.dateCreated}
                </div>
                <div>
                  <b>Due:</b> {viewRow.dueDate} {viewRow.time}
                </div>
                <div>
                  <b>Revision:</b> {viewRow.revision}
                </div>
                <div>
                  <b>Status:</b>{" "}
                  {viewRow._missed ? "Missed" : viewRow.status}
                </div>
                <div>
                  <b>Methodology:</b> {viewRow.methodology}
                </div>
                <div>
                  <b>Project Phase:</b> {viewRow.projectPhase}
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-end">
              <button
                onClick={() => setViewRow(null)}
                className="rounded-md px-4 py-2 text-white"
                style={{ backgroundColor: MAROON }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


