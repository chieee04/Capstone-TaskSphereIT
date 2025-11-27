// src/components/CapstoneMember/MemberTasks.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  SlidersHorizontal,
  Eye,
  MoreVertical,
  ChevronDown,
  X,
} from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";


const MAROON = "#6A0F14";


/* ---------- Status Colors ---------- */
const STATUS_COLORS = {
  "To Do": "#FABC3F", // Yellow
  "In Progress": "#809D3C", // Green
  "To Review": "#578FCA", // Blue
  "Missed": "#3B0304", // Maroon
};


const STATUS_OPTIONS_TEAM = ["To Do", "In Progress", "To Review"];
const FILTER_OPTIONS_TEAM = ["All Status", "To Do", "In Progress", "To Review", "Missed"];


/* ===== Status component ===== */
const StatusBadgeMemberTasks = ({ value, isEditable, onChange, disabled = false }) => {
  const backgroundColor = STATUS_COLORS[value] || "#6B7280"; // Default gray
 
  if (!value || value === "--") return <span>--</span>;
 
  if (disabled) {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium text-white cursor-not-allowed opacity-70"
        style={{ backgroundColor }}
      >
        {value}
      </span>
    );
  }
 
  return isEditable ? (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[12px] font-medium border border-neutral-300 rounded px-2.5 py-0.5 bg-white cursor-pointer appearance-none pr-6 text-gray-900"
        style={{
          backgroundColor: backgroundColor,
          color: 'white',
        }}
      >
        {STATUS_OPTIONS_TEAM.map((status) => (
          <option key={status} value={status} className="text-gray-900 bg-white">
            {status}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-white absolute right-1.5 pointer-events-none" />
    </div>
  ) : (
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


export default function MemberTasks() {
  const navigate = useNavigate();
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [memberName, setMemberName] = useState("");


  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
       
        // Get member name from users collection
        if (uid) {
          const usersSnapshot = await getDocs(collection(db, "users"));
          const userData = usersSnapshot.docs.find(doc => doc.data().uid === uid)?.data();
          if (userData) {
            const name = [userData.firstName, userData.middleName, userData.lastName]
              .filter(Boolean)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            setMemberName(name || "Member");
          }
        }


        const cols = [
          { coll: "titleDefenseTasks" },
          { coll: "oralDefenseTasks" },
          { coll: "finalDefenseTasks" },
          { coll: "finalRedefenseTasks" },
        ];
        const snaps = await Promise.all(
          cols.map((c) => getDocs(collection(db, c.coll)))
        );
        const all = [];
        snaps.forEach((s, i) => {
          const collName = cols[i].coll;
          s.forEach((dx) =>
            all.push({ id: dx.id, sourceColl: collName, ...(dx.data() || {}) })
          );
        });


        // Filter tasks assigned specifically to this member
        const mine = all.filter(
          (t) =>
            Array.isArray(t.assignees) &&
            t.assignees.some((a) => a?.uid === uid)
        );
       
        const mapped = mine.map((t) => {
          const dueDate = t.dueDate || "";
          const dueTime = t.dueTime || "";
          const createdAt = t.createdAt?.toDate?.()?.toISOString()?.split("T")[0] || "";
         
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
            status: t.status || "To Do",
            projectPhase: t.phase || "Design",
            methodology: t.methodology || "--",
            dueAtMs: typeof t.dueAtMs === "number" ? t.dueAtMs : null,
            _missed:
              typeof t.dueAtMs === "number" &&
              t.dueAtMs < Date.now() &&
              (t.status || "") !== "Completed",
            existingTask: t,
            // Add assigned member name
            assignedTo: memberName || "You",
          };
        });


        mapped.sort((a, b) => {
          const ak =
            mine.find((x) => x.id === a.id)?.createdAt?.toMillis?.() || 0;
          const bk =
            mine.find((x) => x.id === b.id)?.createdAt?.toMillis?.() || 0;
          if (bk !== ak) return bk - ak;
          return (a.dueDate || "").localeCompare(b.dueDate || "");
        });


        if (alive) setRows(mapped);
      } catch (e) {
        console.error("MemberTasks load failed:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, memberName]);


  // Filter out completed tasks and apply search/filter
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
   
    // First, filter out completed tasks
    let base = rows.filter(row => row.status !== "Completed");
   
    // Then apply status filter
    if (filterStatus !== "All Status") {
      if (filterStatus === "Missed") {
        base = base.filter((r) => r._missed);
      } else {
        base = base.filter((r) => (r.status || "").toLowerCase() === filterStatus.toLowerCase());
      }
    }
   
    // Finally apply search filter
    if (!q) return base;
    return base.filter((r) =>
      [r.task, r.subtask, r.element, r.status, r.projectPhase, r.methodology]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchQuery, filterStatus]);


  const allowedStatuses = ["To Do", "In Progress", "To Review"];
  const canUpdateRow = (row) =>
    allowedStatuses.includes(row.status || "") && !row._missed;


  const handleUpdateStatus = async (row, newStatus) => {
    if (!row?.id || !row?.sourceColl) return;
    if (!allowedStatuses.includes(newStatus)) return;
    try {
      await updateDoc(doc(db, row.sourceColl, row.id), { status: newStatus });
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id && r.sourceColl === row.sourceColl
            ? { ...r, status: newStatus }
            : r
        )
      );
    } catch (e) {
      console.error("Update status failed:", e);
      alert("Failed to update status.");
    }
  };


  const handleViewTask = (row) => {
    navigate("/member/tasks-board", { state: { selectedTask: row } });
  };


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpenId && !event.target.closest('.dropdown-container')) {
        setMenuOpenId(null);
      }
    };


    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenId]);


  return (
    <div className="p-4 md:p-6">
      {/* ===== Title + horizontal line ===== */}
      <div className="space-y-2 mb-6">
        <div
          className="flex items-center gap-2 text-[18px] font-semibold"
          style={{ color: MAROON }}
        >
          <ClipboardList className="w-5 h-5" />
          <span>Tasks</span>
        </div>
        <div className="h-[3px] w-full" style={{ backgroundColor: MAROON }} />
      </div>


      {/* ===== Toolbar — Search and Filter ===== */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {/* Reduced width search - matching Oral Defense */}
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


        {/* Filter - matching Oral Defense UI */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm">Filter</span>
          </button>


          {isFilterOpen && (
            <div className="absolute right-0 top-10 z-50 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
              {FILTER_OPTIONS_TEAM.map((status) => (
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


      {/* ===== Table - matching Oral Defense design ===== */}
      <div className="w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left p-3 whitespace-nowrap">NO</th>
              <th className="text-left p-3 whitespace-nowrap">Assigned</th>
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
             
              return (
                <tr key={row.id} className="border-t border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <td className="p-3 align-top whitespace-nowrap">{rowNo}</td>
                  <td className="p-3 align-top whitespace-nowrap">
                    <div className="font-medium">{memberName || "You"}</div>
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
                    {isMissed ? (
                      <StatusBadgeMemberTasks
                        value="Missed"
                        isEditable={false}
                        disabled={true}
                      />
                    ) : (
                      <StatusBadgeMemberTasks
                        value={row.status || "To Do"}
                        isEditable={canUpdateRow(row)}
                        onChange={(v) => handleUpdateStatus(row, v)}
                      />
                    )}
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
                  {loading ? "Loading tasks..." : "No tasks found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


