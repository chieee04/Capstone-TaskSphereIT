// src/components/CapstoneMember/MemberTasksRecord.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ClipboardList,
  ChevronRight,
  Search,
  MoreVertical,
  X,
  Loader2,
  Eye,
} from "lucide-react";


/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  or,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";


const MAROON = "#6A0F14";


/* --------------------------- Categories --------------------------- */
const CATEGORIES = [
  { id: "title", title: "Title Defense", coll: "titleDefenseTasks" },
  { id: "oral", title: "Oral Defense", coll: "oralDefenseTasks" },
  { id: "final", title: "Final Defense", coll: "finalDefenseTasks" },
  {
    id: "finalRedefense",
    title: "Final Re-defense",
    coll: "finalRedefenseTasks",
  },
];


/* --------------------------- View Task Dialog --------------------------- */
function ViewTaskDialog({
  open,
  onClose,
  task,
}) {
  if (!open || !task) return null;


  const formatDate = (date) => {
    if (!date) return "—";
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return "—";
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return "—";
    }
  };


  const formatTime = (time24) => {
    if (!time24 || time24 === "null") return "—";
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  };


  const getAssigneeName = () => {
    if (task.assignees && task.assignees.length > 0) {
      if (task.assignees[0].uid === 'team') {
        return "Team";
      }
      return task.assignees[0].name || "—";
    }
    return "Team";
  };


  const getCompletedDate = () => {
    if (task.completedAt) {
      return formatDate(task.completedAt);
    }
    if (task.updatedAt && task.status === "Completed") {
      return formatDate(task.updatedAt);
    }
    return "—";
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-200">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <Eye className="w-5 h-5" />
              <span>View Task Details</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>


          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
            <div className="space-y-6 py-4">
              {/* Basic Task Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-neutral-700 mb-2">Task Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Assigned To:</span> {getAssigneeName()}
                    </div>
                    <div>
                      <span className="font-medium">Task Type:</span> {task.type || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Task:</span> {task.task || task.chapter || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-[#AA60C8] text-white ml-2">
                        Completed
                      </span>
                    </div>
                  </div>
                </div>
               
                <div>
                  <h3 className="font-medium text-neutral-700 mb-2">Timeline</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Date Created:</span> {formatDate(task.createdAt)}
                    </div>
                    <div>
                      <span className="font-medium">Due Date:</span> {formatDate(task.dueDate)}
                    </div>
                    <div>
                      <span className="font-medium">Due Time:</span> {formatTime(task.dueTime)}
                    </div>
                    <div>
                      <span className="font-medium">Date Completed:</span> {getCompletedDate()}
                    </div>
                  </div>
                </div>
              </div>


              {/* Additional Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-neutral-700 mb-2">Task Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Subtasks:</span> {task.subtask || task.subTask || task.subtasks || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Elements:</span> {task.elements || task.element || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Revision:</span> {task.revision || "No Revision"}
                    </div>
                  </div>
                </div>
               
                <div>
                  <h3 className="font-medium text-neutral-700 mb-2">Project Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Methodology:</span> {task.methodology || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Project Phase:</span> {task.phase || "Planning"}
                    </div>
                    <div>
                      <span className="font-medium">Task Manager:</span> {task.taskManager || "Project Manager"}
                    </div>
                  </div>
                </div>
              </div>


              {/* Description if available */}
              {task.description && (
                <div>
                  <h3 className="font-medium text-neutral-700 mb-2">Description</h3>
                  <p className="text-sm text-neutral-600 bg-neutral-50 rounded-lg p-3">
                    {task.description}
                  </p>
                </div>
              )}
            </div>
          </div>


          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* --------------------------- Updated Card Component -------------------------- */
function TaskRecordCard({ title, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg transition-all duration-300
                 hover:shadow-2xl hover:-translate-y-2 hover:border-gray-300 active:scale-[0.98] text-neutral-800 overflow-hidden group"
    >
      <div
        className="absolute left-0 top-0 w-6 h-full rounded-l-2xl transition-all duration-300 group-hover:w-8"
        style={{ background: MAROON }}
      />
     
      <div
        className="absolute bottom-0 left-0 right-0 h-6 rounded-b-2xl transition-all duration-300 group-hover:h-8"
        style={{ background: MAROON }}
      />
     
      <div className="absolute inset-0 flex flex-col items-center justify-center pl-6 pr-4 pt-2 pb-10">
        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
          <ClipboardList className="w-16 h-16 mb-4 text-black" />
        </div>
       
        <span className="text-base font-bold text-center leading-tight text-black transition-all duration-300 group-hover:scale-105">
          {title}
        </span>
      </div>


      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style={{
             boxShadow: `0 0 20px ${MAROON}40`,
             background: `radial-gradient(circle at center, transparent 0%, ${MAROON}10 100%)`
           }} />
    </button>
  );
}


const Toolbar = ({ onSearch }) => (
  <div className="flex items-center gap-3 flex-wrap">
    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
      <input
        placeholder="Search..."
        onChange={(e) => onSearch(e.target.value)}
        className="w-64 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
      />
    </div>
  </div>
);


/* ---------- Helper Functions ---------- */
const formatTime12Hour = (time24) => {
  if (!time24 || time24 === "null") return "—";
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
};


const formatDateMonthDayYear = (date) => {
  if (!date) return "—";
 
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return "—";
   
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return dateObj.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "—";
  }
};


const convertFirebaseTime = (timestamp) => {
  if (!timestamp) return null;
 
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
 
  if (timestamp instanceof Date) {
    return timestamp;
  }
 
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
 
  return null;
};


/* ---------- Status Badge for Completed Tasks ---------- */
const StatusBadgeCompleted = () => (
  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-[#AA60C8] text-white">
    Completed
  </span>
);


const RevisionPill = ({ value }) =>
  value && value !== "null" && value !== "No Revision" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-neutral-100 border border-neutral-200">
      {value}
    </span>
  ) : (
    <span>No Revision</span>
  );


/* --------------------------- Title Defense Tables --------------------------- */
const TitleDefensePage1Table = ({
  rows,
  loading,
  onView,
  menuOpenId,
  setMenuOpenId,
  currentUserName,
  meUid
}) => (
  <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-x-auto">
    <table className="w-full text-sm min-w-[1200px]">
      <thead className="bg-neutral-50 text-neutral-700">
        <tr>
          <th className="text-left p-3">NO</th>
          <th className="text-left p-3">Assigned</th>
          <th className="text-left p-3">Task Type</th>
          <th className="text-left p-3">Task</th>
          <th className="text-left p-3">Date Created</th>
          <th className="text-left p-3">Due Date</th>
          <th className="text-left p-3">Time</th>
          <th className="text-left p-3">Date Completed</th>
          <th className="text-left p-3">Revision NO</th>
          <th className="text-left p-3">Status</th>
          <th className="text-left p-3">Project Phase</th>
          <th className="text-right p-3">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={12} className="p-6 text-center text-neutral-500">
              Loading…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={12} className="p-6 text-center text-neutral-500">
              No completed tasks.
            </td>
          </tr>
        ) : (
          rows.map((r, idx) => {
            const isCurrentUserTask = r.existingTask.assignees &&
              r.existingTask.assignees.some(assignee => assignee.uid === meUid);
            const isTeamTask = r.assigned === "Team";
            const showKebabMenu = isCurrentUserTask || isTeamTask;


            return (
              <tr key={r._key} className="border-t border-neutral-200">
                <td className="p-3 align-top">{idx + 1}</td>
                <td className="p-3 align-top">
                  <div className="font-medium">{r.assigned}</div>
                </td>
                <td className="p-3 align-top">{r.type || "—"}</td>
                <td className="p-3 align-top">{r.task}</td>
                <td className="p-3 align-top">{r.created}</td>
                <td className="p-3 align-top">{r.due}</td>
                <td className="p-3 align-top">{r.time}</td>
                <td className="p-3 align-top">{r.completed}</td>
                <td className="p-3 align-top">
                  <RevisionPill value={r.revision} />
                </td>
                <td className="p-3 align-top">
                  <StatusBadgeCompleted />
                </td>
                <td className="p-3 align-top">{r.phase}</td>
                <td className="p-3 align-top text-right">
                  {showKebabMenu && (
                    <div className="relative inline-block dropdown-container">
                      <button
                        className="p-1.5 rounded-md hover:bg-neutral-100"
                        onClick={() => setMenuOpenId(menuOpenId === r._key ? null : r._key)}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === r._key && (
                        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg">
                          <div className="flex flex-col">
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                              onClick={() => {
                                setMenuOpenId(null);
                                onView(r.existingTask);
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);


const TitleDefensePage2Table = ({
  rows,
  loading,
  onView,
  menuOpenId,
  setMenuOpenId,
  currentUserName,
  meUid
}) => (
  <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-x-auto">
    <table className="w-full text-sm min-w-[800px]">
      <thead className="bg-neutral-50 text-neutral-700">
        <tr>
          <th className="text-left p-3">NO</th>
          <th className="text-left p-3">Time</th>
          <th className="text-left p-3">Date Completed</th>
          <th className="text-left p-3">Revision No.</th>
          <th className="text-left p-3">Status</th>
          <th className="text-left p-3">Methodology</th>
          <th className="text-left p-3">Project Phase</th>
          <th className="text-right p-3">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={8} className="p-6 text-center text-neutral-500">
              Loading…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="p-6 text-center text-neutral-500">
              No completed tasks.
            </td>
          </tr>
        ) : (
          rows.map((r, idx) => {
            const isCurrentUserTask = r.existingTask.assignees &&
              r.existingTask.assignees.some(assignee => assignee.uid === meUid);
            const isTeamTask = r.assigned === "Team";
            const showKebabMenu = isCurrentUserTask || isTeamTask;


            return (
              <tr key={r._key} className="border-t border-neutral-200">
                <td className="p-3 align-top">{idx + 1}</td>
                <td className="p-3 align-top">{r.time}</td>
                <td className="p-3 align-top">{r.completed}</td>
                <td className="p-3 align-top">
                  <RevisionPill value={r.revision} />
                </td>
                <td className="p-3 align-top">
                  <StatusBadgeCompleted />
                </td>
                <td className="p-3 align-top">{r.methodology}</td>
                <td className="p-3 align-top">{r.phase}</td>
                <td className="p-3 align-top text-right">
                  {showKebabMenu && (
                    <div className="relative inline-block dropdown-container">
                      <button
                        className="p-1.5 rounded-md hover:bg-neutral-100"
                        onClick={() => setMenuOpenId(menuOpenId === r._key ? null : r._key)}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === r._key && (
                        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg">
                          <div className="flex flex-col">
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                              onClick={() => {
                                setMenuOpenId(null);
                                onView(r.existingTask);
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);


/* --------------------------- Defense Tasks Table (Oral, Final, Final Re-defense) --------------------------- */
const DefenseTasksTable = ({
  rows,
  loading,
  onView,
  menuOpenId,
  setMenuOpenId,
  currentUserName,
  meUid
}) => (
  <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-x-auto">
    <table className="w-full text-sm min-w-[1400px]">
      <thead className="bg-neutral-50 text-neutral-700">
        <tr>
          <th className="text-left p-3">NO</th>
          <th className="text-left p-3">Assigned</th>
          <th className="text-left p-3">Task Type</th>
          <th className="text-left p-3">Task</th>
          <th className="text-left p-3">Subtasks</th>
          <th className="text-left p-3">Elements</th>
          <th className="text-left p-3">Date Created</th>
          <th className="text-left p-3">Due Date</th>
          <th className="text-left p-3">Time</th>
          <th className="text-left p-3">Date Completed</th>
          <th className="text-left p-3">Revision NO</th>
          <th className="text-left p-3">Status</th>
          <th className="text-left p-3">Methodology</th>
          <th className="text-left p-3">Project Phase</th>
          <th className="text-right p-3">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={15} className="p-6 text-center text-neutral-500">
              Loading…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={15} className="p-6 text-center text-neutral-500">
              No completed tasks.
            </td>
          </tr>
        ) : (
          rows.map((r, idx) => {
            const isCurrentUserTask = r.existingTask.assignees &&
              r.existingTask.assignees.some(assignee => assignee.uid === meUid);
            const isTeamTask = r.assigned === "Team";
            const showKebabMenu = isCurrentUserTask || isTeamTask;


            return (
              <tr key={r._key} className="border-t border-neutral-200">
                <td className="p-3 align-top">{idx + 1}</td>
                <td className="p-3 align-top">
                  <div className="font-medium">{r.assigned}</div>
                </td>
                <td className="p-3 align-top">{r.type || "—"}</td>
                <td className="p-3 align-top">{r.task}</td>
                <td className="p-3 align-top">{r.subtask}</td>
                <td className="p-3 align-top">{r.elements}</td>
                <td className="p-3 align-top">{r.created}</td>
                <td className="p-3 align-top">{r.due}</td>
                <td className="p-3 align-top">{r.time}</td>
                <td className="p-3 align-top">{r.completed}</td>
                <td className="p-3 align-top">
                  <RevisionPill value={r.revision} />
                </td>
                <td className="p-3 align-top">
                  <StatusBadgeCompleted />
                </td>
                <td className="p-3 align-top">{r.methodology}</td>
                <td className="p-3 align-top">{r.phase}</td>
                <td className="p-3 align-top text-right">
                  {showKebabMenu && (
                    <div className="relative inline-block dropdown-container">
                      <button
                        className="p-1.5 rounded-md hover:bg-neutral-100"
                        onClick={() => setMenuOpenId(menuOpenId === r._key ? null : r._key)}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === r._key && (
                        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg">
                          <div className="flex flex-col">
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                              onClick={() => {
                                setMenuOpenId(null);
                                onView(r.existingTask);
                              }}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);


/* ------------------------------ MAIN ------------------------------ */
const MemberTasksRecord = () => {
  const [view, setView] = useState("grid");
  const [category, setCategory] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");


  const [meUid, setMeUid] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);


  const [loadingTasks, setLoadingTasks] = useState(false);
  const [records, setRecords] = useState([]);


  // Action states
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [viewTask, setViewTask] = useState(null);


  const teamUnsubsRef = useRef([]);
  const tasksUnsubRef = useRef(null);


  /* -------- identify current user -------- */
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid || localStorage.getItem("uid") || "";
      const name = u?.displayName || localStorage.getItem("userName") || "";
      setMeUid(uid);
      setCurrentUserName(name);
    });
    return () => stop();
  }, []);


  /* -------- fetch teams of this member -------- */
  useEffect(() => {
    teamUnsubsRef.current.forEach((u) => typeof u === "function" && u());
    teamUnsubsRef.current = [];


    if (!meUid) return;
    setLoadingTeams(true);


    const merged = new Map();
    const apply = (snap) => {
      snap.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      setTeams(Array.from(merged.values()));
      setLoadingTeams(false);
    };


    // Member can be in teams as a member
    const stop = onSnapshot(
      query(collection(db, "teams"), where("members", "array-contains", meUid)),
      apply,
      () => setLoadingTeams(false)
    );


    teamUnsubsRef.current.push(stop);
    return () => {
      teamUnsubsRef.current.forEach((u) => typeof u === "function" && u());
      teamUnsubsRef.current = [];
    };
  }, [meUid]);


  /* -------- Check if task is adviser task -------- */
  const isAdviserTask = (taskData) => {
    if (!taskData) return false;
   
    // Check if assigned to adviser by name (both spellings)
    if (taskData.assigned) {
      const assignedLower = taskData.assigned.toLowerCase();
      if (assignedLower.includes('adviser') ||
          assignedLower.includes('advisor') ||
          assignedLower === 'adviser' ||
          assignedLower === 'advisor') {
        return true;
      }
    }
   
    // Check if assignee is adviser
    if (taskData.assignees && taskData.assignees.length > 0) {
      const firstAssignee = taskData.assignees[0];
      if (firstAssignee.name) {
        const nameLower = firstAssignee.name.toLowerCase();
        if (nameLower.includes('adviser') ||
            nameLower.includes('advisor') ||
            nameLower === 'adviser' ||
            nameLower === 'advisor') {
          return true;
        }
      }
      if (firstAssignee.uid && (
          firstAssignee.uid.includes('adviser') ||
          firstAssignee.uid.includes('advisor')
      )) {
        return true;
      }
    }
   
    // Check if task type is adviser-related
    if (taskData.type) {
      const typeLower = taskData.type.toLowerCase();
      if (typeLower.includes('adviser') ||
          typeLower.includes('advisor')) {
        return true;
      }
    }
   
    // Check for role field
    if (taskData.role) {
      const roleLower = taskData.role.toLowerCase();
      if (roleLower.includes('adviser') ||
          roleLower.includes('advisor')) {
        return true;
      }
    }


    // Check for taskManager field
    if (taskData.taskManager) {
      const taskManagerLower = taskData.taskManager.toLowerCase();
      if (taskManagerLower.includes('adviser') ||
          taskManagerLower.includes('advisor')) {
        return true;
      }
    }


    return false;
  };


  /* -------- Check if task belongs to current user -------- */
  const isTaskForCurrentUser = (taskData) => {
    if (!taskData) return false;


    // Get current user's team IDs
    const userTeamIds = teams.map(team => team.id);
   
    // Check if task is assigned to current user directly
    if (taskData.assignees && taskData.assignees.length > 0) {
      const isAssignedToUser = taskData.assignees.some(assignee =>
        assignee.uid === meUid
      );
      if (isAssignedToUser) return true;
    }


    // Check if task is assigned to team and user is in that team
    if (taskData.assignees && taskData.assignees.length > 0) {
      const isTeamTask = taskData.assignees.some(assignee =>
        assignee.uid === 'team'
      );
      if (isTeamTask && userTeamIds.length > 0) return true;
    }


    // Check if task has teamId field that matches user's teams
    if (taskData.teamId && userTeamIds.includes(taskData.teamId)) {
      return true;
    }


    // Check if assigned field contains user's name
    if (taskData.assigned === currentUserName) {
      return true;
    }


    // Additional check for oral defense tasks
    if (taskData.assignee === currentUserName) {
      return true;
    }


    return false;
  };


  /* -------- REAL-TIME fetch completed tasks for member -------- */
  useEffect(() => {
    if (view !== "detail" || !category) return;


    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat) return;


    // Clean up previous listener
    if (tasksUnsubRef.current) {
      tasksUnsubRef.current();
      tasksUnsubRef.current = null;
    }


    setLoadingTasks(true);
    console.log("Fetching tasks for category:", cat.coll);


    const normalize = (doc) => {
      const x = doc.data();
     
      // Enhanced assignment logic
      let assignedName = "—";
     
      // Check multiple possible assignment fields in order of priority
      if (x.assigned && x.assigned !== "—" && x.assigned !== "null") {
        assignedName = x.assigned;
      }
      // For Oral Defense tasks, check specific field names that might be used
      else if (x.assignee && x.assignee !== "—" && x.assignee !== "null") {
        assignedName = x.assignee;
      }
      // For team tasks
      else if (x.isTeamTask) {
        assignedName = "Team";
      }
      // For individual tasks with assignees array
      else if (x.assignees && x.assignees.length > 0) {
        // Check if it's a team assignment (uid === 'team')
        if (x.assignees[0].uid === 'team') {
          assignedName = "Team";
        } else {
          // Use the actual name of the assigned member
          assignedName = x.assignees[0].name || "—";
        }
      }
      // Check for taskManager field as fallback
      else if (x.taskManager && x.taskManager !== "—" && x.taskManager !== "null") {
        assignedName = x.taskManager;
      }


      const created = convertFirebaseTime(x.createdAt);
      const createdDisplay = formatDateMonthDayYear(created);


      const dueDate = x.dueDate || null;
      const dueTime = x.dueTime || null;
      const dueDisplay = dueDate ? formatDateMonthDayYear(dueDate) : "—";
      const timeDisplay = dueTime ? formatTime12Hour(dueTime) : "—";


      let completed = convertFirebaseTime(x.completedAt);
     
      if (!completed && x.status === "Completed") {
        completed = convertFirebaseTime(x.updatedAt);
      }
     
      const completedDisplay = completed ? formatDateMonthDayYear(completed) : "—";


      const subtask = x.subtask || x.subTask || x.subtasks || "—";
      const elements = x.elements || x.element || "—";


      return {
        _key: `${doc.id}`,
        id: doc.id,
        assigned: assignedName,
        type: x.type || "—",
        task: x.task || x.chapter || "Task",
        subtask: subtask,
        elements: elements,
        created: createdDisplay,
        due: dueDisplay,
        time: timeDisplay,
        completed: completedDisplay,
        revision: x.revision || "No Revision",
        methodology: x.methodology || "—",
        phase: x.phase || "Planning",
        existingTask: { id: doc.id, ...x },
      };
    };


    // SIMPLIFIED QUERY: Get all completed tasks and filter client-side
    const qy = query(
      collection(db, cat.coll),
      orderBy("updatedAt", "desc")
    );
   
    const stop = onSnapshot(
      qy,
      (snap) => {
        console.log(`Found ${snap.docs.length} total tasks in ${cat.coll}`);
       
        // Filter for completed tasks that belong to current user
        const completedTasks = snap.docs
          .map((doc) => ({ doc, data: doc.data() }))
          .filter(({ data }) => {
            // First check if task is completed
            if (data.status !== "Completed") {
              return false;
            }
           
            // Then check if it's an adviser task
            if (isAdviserTask(data)) {
              return false;
            }
           
            // Then check if it belongs to current user
            if (!isTaskForCurrentUser(data)) {
              return false;
            }
           
            return true;
          })
          .map(({ doc }) => normalize(doc))
          .sort((a, b) => (a.completed > b.completed ? -1 : 1))
          .map((r, i) => ({ ...r, no: i + 1 }));
       
        console.log(`Filtered to ${completedTasks.length} completed tasks for user`);
        setRecords(completedTasks);
        setLoadingTasks(false);
      },
      (error) => {
        console.error("Error in tasks listener:", error);
        setLoadingTasks(false);
      }
    );
   
    tasksUnsubRef.current = stop;


    return () => {
      if (tasksUnsubRef.current) {
        tasksUnsubRef.current();
        tasksUnsubRef.current = null;
      }
    };
  }, [view, category, teams, meUid, currentUserName]);


  /* -------- search + page derivations -------- */
  const [searchText, setSearchText] = useState("");
  useEffect(() => setSearchText(search), [search]);


  const filtered = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    if (!s) return records;
    return records.filter((r) =>
      [
        r.assigned,
        r.type,
        r.task,
        r.subtask,
        r.elements,
        r.methodology,
        r.phase,
        r.completed,
        r.due,
        r.created,
      ]
        .join(" • ")
        .toLowerCase()
        .includes(s)
    );
  }, [records, searchText]);


  const page1Rows = useMemo(() => filtered, [filtered]);
  const page2Rows = useMemo(
    () => filtered.map((r) => ({ ...r, status: "Completed" })),
    [filtered]
  );


  /* -------- Action Handlers -------- */
  const handleView = (task) => {
    setViewTask(task);
    setMenuOpenId(null);
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


  /* -------- Check if current category is a defense category -------- */
  const isDefenseCategory = ["oral", "final", "finalRedefense"].includes(category);
  const isTitleDefense = category === "title";


  /* -------- render -------- */
  if (view === "detail" && category) {
    const current = CATEGORIES.find((c) => c.id === category);
   
    return (
      <div className="space-y-4">
        {/* UPDATED HEADER - Consistent with grid view */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
            <ClipboardList className="w-5 h-5" />
            <span>Tasks Record</span>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
            <span>{current?.title}</span>
          </div>
          <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
        </div>


        <Toolbar onSearch={setSearch} />


        {!isTitleDefense && !isDefenseCategory && (
          <div className="w-full md:w-auto md:ml-auto">
            <div className="inline-flex rounded-lg border border-neutral-300 overflow-hidden">
              <button
                onClick={() => setPage(1)}
                className={`cursor-pointer px-3 py-1.5 text-sm ${
                  page === 1 ? "bg-neutral-100 font-semibold" : ""
                }`}
              >
                Page 1
              </button>
              <button
                onClick={() => setPage(2)}
                className={`cursor-pointer px-3 py-1.5 text-sm border-l border-neutral-300 ${
                  page === 2 ? "bg-neutral-100 font-semibold" : ""
                }`}
              >
                Page 2
              </button>
            </div>
          </div>
        )}


        <div className="mt-3">
          {isTitleDefense ? (
            page === 1 ? (
              <TitleDefensePage1Table
                rows={page1Rows}
                loading={loadingTasks || loadingTeams}
                onView={handleView}
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
                currentUserName={currentUserName}
                meUid={meUid}
              />
            ) : (
              <TitleDefensePage2Table
                rows={page2Rows}
                loading={loadingTasks || loadingTeams}
                onView={handleView}
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
                currentUserName={currentUserName}
                meUid={meUid}
              />
            )
          ) : isDefenseCategory ? (
            <DefenseTasksTable
              rows={page1Rows}
              loading={loadingTasks || loadingTeams}
              onView={handleView}
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
              currentUserName={currentUserName}
              meUid={meUid}
            />
          ) : (
            page === 1 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-[0_6px_12px_rgba(0,0,0,0.08)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1000px]">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="py-3 pl-6 pr-3 w-16">NO</th>
                        <th className="py-3 pr-3">Assigned</th>
                        <th className="py-3 pr-3">Tasks</th>
                        <th className="py-3 pr-3">SubTasks</th>
                        <th className="py-3 pr-3">Elements</th>
                        <th className="py-3 pr-3">Date Created</th>
                        <th className="py-3 pr-6">Due&nbsp;&nbsp;Date</th>
                        <th className="py-3 pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTasks || loadingTeams ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-500">
                            Loading…
                          </td>
                        </tr>
                      ) : page1Rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-500">
                            No completed tasks.
                          </td>
                        </tr>
                      ) : (
                        page1Rows.map((r) => {
                          const isCurrentUserTask = r.existingTask.assignees &&
                            r.existingTask.assignees.some(assignee => assignee.uid === meUid);
                          const isTeamTask = r.assigned === "Team";
                          const showKebabMenu = isCurrentUserTask || isTeamTask;


                          return (
                            <tr key={r._key} className="border-t border-neutral-200">
                              <td className="py-3 pl-6 pr-3">{r.no}.</td>
                              <td className="py-3 pr-3">{r.assigned}</td>
                              <td className="py-3 pr-3">{r.task}</td>
                              <td className="py-3 pr-3">{r.subtask}</td>
                              <td className="py-3 pr-3">{r.elements}</td>
                              <td className="py-3 pr-3">{r.created}</td>
                              <td className="py-3 pr-6">{r.due}</td>
                              <td className="py-3 pr-6">
                                {showKebabMenu && (
                                  <div className="relative inline-block dropdown-container">
                                    <button
                                      className="p-1.5 rounded-md hover:bg-neutral-100"
                                      onClick={() => setMenuOpenId(menuOpenId === r._key ? null : r._key)}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {menuOpenId === r._key && (
                                      <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg">
                                        <div className="flex flex-col">
                                          <button
                                            className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                                            onClick={() => {
                                              setMenuOpenId(null);
                                              handleView(r.existingTask);
                                            }}
                                          >
                                            View
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-[0_6px_12px_rgba(0,0,0,0.08)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="py-3 pl-6 pr-3 w-16">NO</th>
                        <th className="py-3 pr-3">Time</th>
                        <th className="py-3 pr-3">Date Completed</th>
                        <th className="py-3 pr-3">Revision No.</th>
                        <th className="py-3 pr-3">Status</th>
                        <th className="py-3 pr-3">Methodology</th>
                        <th className="py-3 pr-3">Project Phase</th>
                        <th className="py-3 pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTasks || loadingTeams ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-500">
                            Loading…
                          </td>
                        </tr>
                      ) : page2Rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-500">
                            No completed tasks.
                          </td>
                        </tr>
                      ) : (
                        page2Rows.map((r) => {
                          const isCurrentUserTask = r.existingTask.assignees &&
                            r.existingTask.assignees.some(assignee => assignee.uid === meUid);
                          const isTeamTask = r.assigned === "Team";
                          const showKebabMenu = isCurrentUserTask || isTeamTask;


                          return (
                            <tr key={r._key} className="border-t border-neutral-200">
                              <td className="py-3 pl-6 pr-3">{r.no}.</td>
                              <td className="py-3 pr-3">{r.time}</td>
                              <td className="py-3 pr-3">{r.completed}</td>
                              <td className="py-3 pr-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-neutral-300">
                                  {r.revision}
                                  <ChevronRight className="w-4 h-4 text-neutral-500" />
                                </div>
                              </td>
                              <td className="py-3 pr-3">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-[#9B59B6] text-white">
                                  Completed
                                </span>
                              </td>
                              <td className="py-3 pr-3">{r.methodology}</td>
                              <td className="py-3 pr-3">{r.phase}</td>
                              <td className="py-3 pr-6">
                                {showKebabMenu && (
                                  <div className="relative inline-block dropdown-container">
                                    <button
                                      className="p-1.5 rounded-md hover:bg-neutral-100"
                                      onClick={() => setMenuOpenId(menuOpenId === r._key ? null : r._key)}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {menuOpenId === r._key && (
                                      <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg">
                                        <div className="flex flex-col">
                                          <button
                                            className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                                            onClick={() => {
                                              setMenuOpenId(null);
                                              handleView(r.existingTask);
                                            }}
                                          >
                                            View
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>


        {/* View Task Dialog */}
        <ViewTaskDialog
          open={!!viewTask}
          onClose={() => setViewTask(null)}
          task={viewTask}
        />
      </div>
    );
  }


  // GRID VIEW
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
          <ClipboardList className="w-5 h-5" />
          <span>Tasks Record</span>
        </div>
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
      </div>


      <div className="flex flex-wrap gap-6">
        {CATEGORIES.map(({ id, title }) => (
          <TaskRecordCard
            key={id}
            title={title}
            icon={ClipboardList}
            onClick={() => {
              setCategory(id);
              setView("detail");
            }}
          />
        ))}
      </div>
    </div>
  );
};


export default MemberTasksRecord;


