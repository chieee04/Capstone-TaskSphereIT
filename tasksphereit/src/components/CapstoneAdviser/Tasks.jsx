// src/components/CapstoneAdviser/AdviserTasks.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ClipboardList,
  ChevronRight,
  MoreVertical,
  Search,
  Loader2,
  ChevronDown,
  SlidersHorizontal,
  Edit,
  Eye,
  Trash2,
  X,
  AlertCircle,
  Users,
} from "lucide-react";


/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";


const MAROON = "#3B0304";


/* --------------------------- Card configuration --------------------------- */
const CARDS = [
  { key: "oral", label: "Oral Defense", icon: ClipboardList },
  { key: "final", label: "Final Defense", icon: ClipboardList },
  { key: "finalRedefense", label: "Final Re-Defense", icon: ClipboardList },
];


/* ---------- Status Colors ---------- */
const STATUS_COLORS = {
  "To Do": "#FABC3F", // Yellow
  "In Progress": "#809D3C", // Green
  "To Review": "#578FCA", // Blue
  "Completed": "#AA60C8", // Purple
  "Missed": "#3B0304", // Maroon
};


// UPDATED: Adviser tasks can now go up to "Completed"
const STATUS_OPTIONS_ADVISER = ["To Do", "In Progress", "To Review", "Completed"];


// UPDATED: Filter options without "Completed"
const FILTER_OPTIONS_ADVISER = ["All", "To Do", "In Progress", "To Review", "Missed"];


/* ---------- Helper Functions ---------- */
const ordinal = (n) => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  const r = n % 10;
  if (r === 1) return `${n}st`;
  if (r === 2) return `${n}nd`;
  if (r === 3) return `${n}rd`;
  return `${n}th`;
};


const parseRevCount = (rev) => {
  const m = String(rev || "").match(/^(\d+)(st|nd|rd|th)\s+Revision$/i);
  return m ? parseInt(m[1], 10) : 0;
};


const nextRevision = (prev = "No Revision") => {
  const count = parseRevCount(prev);
  if (count >= 10) {
    return null; // Maximum revisions reached
  }
  return `${ordinal(count + 1)} Revision`;
};


const formatTime12Hour = (time24) => {
  if (!time24 || time24 === "null") return "--";
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
};


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


const localTodayStr = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};


/* ---------- Status Badge Component ---------- */
const StatusBadge = ({ value, isEditable, onChange, disabled = false, statusOptions = STATUS_OPTIONS_ADVISER }) => {
  const backgroundColor = STATUS_COLORS[value] || "#6B7280"; // Default gray
 
  if (!value || value === "null") return <span>--</span>;
 
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
        {statusOptions.map((status) => (
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


// Helper function to check if adviser task has due date and time
const hasDueDateAndTime = (task) => {
  return task && task.dueDate && task.dueTime && task.dueDate !== "--" && task.dueTime !== "--";
};


/* ---------- Confirmation Dialog ---------- */
function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirmation",
  message = "Are you sure you want to proceed?",
  confirmText = "Yes",
  cancelText = "No",
}) {
  if (!open) return null;


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overscroll-contain">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              {title}
            </h3>
            <p className="text-neutral-600">{message}</p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#4A0405]"
              style={{ backgroundColor: MAROON }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ---------- Edit Due Date & Time Dialog (Updated with Revision Logic) ---------- */
function EditDueDateTimeDialog({
  open,
  onClose,
  onSaved,
  existingTask,
}) {
  const [saving, setSaving] = useState(false);
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);


  const today = localTodayStr();
  const currentRevisionCount = parseRevCount(existingTask?.revision);


  useEffect(() => {
    if (!open) return;
    if (existingTask) {
      setDue(existingTask.dueDate || "");
      setTime(existingTask.dueTime || "");
    } else {
      setDue("");
      setTime("");
    }
    setHasChanges(false);
  }, [open, existingTask]);


  const canSave = due && time && currentRevisionCount < 10;


  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const dueAtMs = due && time ? new Date(`${due}T${time}:00`).getTime() : null;
      const currentStatus = existingTask?.status || "To Do";
      const currentRevision = existingTask?.revision || "No Revision";
     
      // Check if date/time actually changed
      const dueChanged = existingTask && due !== (existingTask.dueDate || "");
      const timeChanged = existingTask && time !== (existingTask.dueTime || "");
      const dateTimeChanged = dueChanged || timeChanged;


      let newStatus = currentStatus;
      let newRevision = currentRevision;


      // Apply revision and status rules based on current status
      if (dateTimeChanged) {
        if (currentStatus === "To Review" || currentStatus === "Missed" || currentStatus === "Completed") {
          // Bump revision and reset to "To Do" for "To Review", "Missed", and "Completed" tasks
          const nextRev = nextRevision(currentRevision);
          if (nextRev) {
            newRevision = nextRev;
            newStatus = "To Do";
          } else {
            // Maximum revisions reached - don't change revision but show message
            alert("Maximum revisions (10) reached. Please create a new task instead of editing this one.");
            setSaving(false);
            return;
          }
        }
        // For "To Do" and "In Progress", keep current status and revision
      }


      const payload = {
        dueDate: due || null,
        dueTime: time || null,
        dueAtMs,
        revision: newRevision,
        status: newStatus,
        updatedAt: serverTimestamp(),
      };


      if (existingTask?.id) {
        await updateDoc(
          doc(db, existingTask.collectionName, existingTask.id),
          payload
        );
      }


      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };


  const shouldShowRevisionNote = () => {
    const currentStatus = existingTask?.status || "To Do";
    return currentStatus === "To Review" || currentStatus === "Missed" || currentStatus === "Completed";
  };


  const handleClose = () => {
    if (hasChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };


  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };


  const handleInputChange = () => {
    setHasChanges(true);
  };


  if (!open) return null;


  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
        <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-200">
              <div
                className="flex items-center gap-2 text-[16px] font-semibold"
                style={{ color: MAROON }}
              >
                <Edit className="w-5 h-5" />
                <span>Edit</span>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>


            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-5">
              <div className="space-y-3">
                <h3 className="font-medium text-neutral-700">Task Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Team:</span> {existingTask?.teamName || "Unknown"}
                  </div>
                  <div>
                    <span className="font-medium">Task Type:</span> {existingTask?.type || "Unknown"}
                  </div>
                  <div>
                    <span className="font-medium">Task:</span> {existingTask?.task || "Unknown"}
                  </div>
                  <div>
                    <span className="font-medium">Current Status:</span> {existingTask?.status || "To Do"}
                  </div>
                  <div>
                    <span className="font-medium">Current Revision:</span> {existingTask?.revision || "No Revision"}
                  </div>
                </div>
              </div>


              {currentRevisionCount >= 10 ? (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">!</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-red-800 mb-1">Maximum Revisions Reached</h4>
                      <p className="text-red-700 text-sm">
                        This task has reached the maximum of 10 revisions. It is recommended to create a new task instead of editing this one further.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        min={today}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                        value={due}
                        onChange={(e) => {
                          setDue(e.target.value);
                          handleInputChange();
                        }}
                      />
                    </div>
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        step={60}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                        value={time}
                        onChange={(e) => {
                          setTime(e.target.value);
                          handleInputChange();
                        }}
                      />
                    </div>
                  </div>


                  {shouldShowRevisionNote() && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        <strong>Note:</strong> Updating due date/time will add revision number and reset status to "To Do".
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>


            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={save}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
                style={{ backgroundColor: MAROON }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>


      <ConfirmationDialog
        open={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={handleConfirmExit}
        title="Discard Changes?"
        message="Are you sure you want to exit? Any unsaved changes will be lost."
        confirmText="Yes, Exit"
        cancelText="No, Stay"
      />
    </>
  );
}


/* ---------- Updated Card Component ---------- */
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


/* ===================== MAIN ===================== */
export default function AdviserTasks() {
  /* -------- view state -------- */
  const [category, setCategory] = useState(null);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterTeam, setFilterTeam] = useState("All Teams");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isTeamFilterOpen, setIsTeamFilterOpen] = useState(false);


  /* -------- identity -------- */
  const [adviserUid, setAdviserUid] = useState("");


  /* -------- data state -------- */
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);


  /* -------- ui state -------- */
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editDueDateTime, setEditDueDateTime] = useState(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [err, setErr] = useState("");


  // Inline editing
  const [optimistic, setOptimistic] = useState({});


  /* -------- derived -------- */
  const collectionName =
    category === "final"
      ? "finalDefenseTasks"
      : category === "oral"
      ? "oralDefenseTasks"
      : category === "finalRedefense"
      ? "finalRedefenseTasks"
      : null;


  /* ================== Effects ================== */


  // 0) Track signed-in user reliably
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid || localStorage.getItem("uid") || "";
      setAdviserUid(uid);
    });
    return () => stop();
  }, []);


  // 1) Load teams owned by this adviser
  useEffect(() => {
    if (!adviserUid) return;
    setLoadingTeams(true);
    const qTeams = query(
      collection(db, "teams"),
      where("adviser.uid", "==", adviserUid)
    );
    const unsub = onSnapshot(
      qTeams,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeams(rows);
        setLoadingTeams(false);
      },
      (e) => {
        console.error("Teams snapshot error:", e);
        setErr(e.message || "Failed to load teams.");
        setLoadingTeams(false);
      }
    );
    return () => unsub();
  }, [adviserUid]);


  // 2) Load tasks for current category - EXCLUDE COMPLETED TASKS
  useEffect(() => {
    if (!collectionName) {
      setTasks([]);
      return;
    }
    if (loadingTeams) return;


    const teamIdsToFetch = teams.map((t) => t.id);


    if (teamIdsToFetch.length === 0) {
      setTasks([]);
      return;
    }


    const chunk = (arr, n = 10) =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
        arr.slice(i * n, i * n + n)
      );


    setLoadingTasks(true);
    setErr("");


    const colRef = collection(db, collectionName);
    const idChunks = chunk(teamIdsToFetch, 10);


    const unsubs = [];
    const merged = new Map();


    const rebuildRows = () => {
      let rows = Array.from(merged.values()).map((x, idx) => {
        const createdAtMillis =
          typeof x.createdAt?.toMillis === "function"
            ? x.createdAt.toMillis()
            : (typeof x.updatedAt?.toMillis === "function"
                ? x.updatedAt.toMillis()
                : 0);


        const teamObj = x.team || {};
        const tId = teamObj.id || x.teamId || "no-team";
        const foundTeam = teams.find((t) => t.id === tId) || null;


        return {
          id: x.__id,
          no: idx + 1,
          teamName: teamObj.name || foundTeam?.name || "No Team",
          type: x.type || "--",
          task: x.task || "--",
          subtasks: x.subtasks || "--",
          elements: x.elements || "--",
          created: formatDateMonthDayYear(
            typeof x.createdAt?.toDate === "function"
              ? x.createdAt.toDate().toISOString().split("T")[0]
              : null
          ),
          dueDate: x.dueDate || null,
          due: x.dueDate ? formatDateMonthDayYear(x.dueDate) : "--",
          dueTime: x.dueTime || null,
          time: x.dueTime ? formatTime12Hour(x.dueTime) : "--",
          revision: x.revision || "No Revision",
          status: x.status || "To Do",
          methodology: x.methodology || "--",
          phase: x.phase || "--",
          teamId: tId,
          collectionName: collectionName,
          __raw: x,
        };
      });


      // UPDATED: Filter out Completed tasks from the main tasks table
      rows = rows.filter(row => row.status !== "Completed");
     
      rows.sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));
      rows = rows.map((r, i) => ({ ...r, no: i + 1 }));


      setTasks(rows);
      setOptimistic({});
      setLoadingTasks(false);
    };


    const handleSnap = (snap) => {
      snap.docs.forEach((d) => {
        const x = d.data();
        if (x.taskManager === "Adviser") {
          merged.set(d.id, { __id: d.id, ...x });
        }
      });
      rebuildRows();
    };


    const handleErr = (e) => {
      console.error("Tasks snapshot error:", e);
      if (e.code === "permission-denied") {
        setErr("Permission denied by Firestore rules for this adviser/team.");
      } else {
        setErr(e.message || "Failed to load tasks.");
      }
      setLoadingTasks(false);
    };


    idChunks.forEach((ids) => {
      unsubs.push(
        onSnapshot(query(colRef, where("team.id", "in", ids), where("taskManager", "==", "Adviser")), handleSnap, handleErr)
      );
      unsubs.push(
        onSnapshot(query(colRef, where("teamId", "in", ids), where("taskManager", "==", "Adviser")), handleSnap, handleErr)
      );
    });


    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [collectionName, teams, loadingTeams]);


  // 3) Auto-update overdue tasks to "Missed" status (except Completed tasks)
  useEffect(() => {
    if (!collectionName || tasks.length === 0) return;


    const now = Date.now();
    const overdueTasks = tasks.filter(
      (t) =>
        typeof t.__raw.dueAtMs === "number" &&
        t.__raw.dueAtMs < now &&
        (t.status || "") !== "Completed" &&
        (t.status || "") !== "Missed"
    );


    if (overdueTasks.length > 0) {
      const updates = overdueTasks.map((t) =>
        updateDoc(doc(db, collectionName, t.id), {
          status: "Missed",
          updatedAt: serverTimestamp()
        })
      );
      Promise.allSettled(updates).then(() => {
        console.log(`Auto-updated ${updates.length} missed tasks`);
      });
    }
  }, [tasks, collectionName]);


  /* ================== Helpers ================== */


  const rows = useMemo(() => {
    return tasks.map((r) => ({ ...r, ...(optimistic[r.id] || {}) }));
  }, [tasks, optimistic]);


  const filtered = useMemo(() => {
    let result = rows;
   
    const s = q.trim().toLowerCase();
    if (s) {
      result = result.filter(
        (r) =>
          String(r.no).includes(s) ||
          (r.teamName || "").toLowerCase().includes(s) ||
          (r.type || "").toLowerCase().includes(s) ||
          (r.task || "").toLowerCase().includes(s) ||
          (r.subtasks || "").toLowerCase().includes(s) ||
          (r.elements || "").toLowerCase().includes(s) ||
          (r.created || "").toLowerCase().includes(s) ||
          (r.due || "").toLowerCase().includes(s) ||
          (r.time || "").toLowerCase().includes(s) ||
          String(r.revision || "").toLowerCase().includes(s) ||
          String(r.status || "").toLowerCase().includes(s) ||
          (r.methodology || "").toLowerCase().includes(s) ||
          (r.phase || "").toLowerCase().includes(s)
      );
    }


    // Apply team filter
    if (filterTeam !== "All Teams") {
      result = result.filter(r => r.teamName === filterTeam);
    }


    // Apply status filter
    if (filterStatus !== "All") {
      result = result.filter(r => r.status === filterStatus);
    }


    return result;
  }, [q, rows, filterStatus, filterTeam]);


  const saveStatus = async (row, newStatus) => {
    // Check if task has due date and time set
    const hasDueDateTime = hasDueDateAndTime(row.__raw);
    if (!hasDueDateTime && newStatus !== "Completed") {
      alert("Please set due date and time before updating status.");
      return;
    }


    setOptimistic((prev) => ({
      ...prev,
      [row.id]: { ...(prev[row.id] || {}), status: newStatus || "To Do" },
    }));


    try {
      const updates = {
        status: newStatus || "To Do",
        updatedAt: serverTimestamp()
      };


      // If marking as completed, set completedAt timestamp - THIS ENSURES IT APPEARS IN TASK RECORD
      if (newStatus === "Completed") {
        updates.completedAt = serverTimestamp();
      }


      await updateDoc(doc(db, collectionName, row.id), updates);
    } catch (error) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[row.id]?.status;
        if (Object.keys(next[row.id] || {}).length === 0) {
          delete next[row.id];
        }
        return next;
      });
      console.error("Error updating status:", error);
    }
  };


  const deleteRow = async (id) => {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, collectionName, id));
      setShowDeleteConfirm(false);
    } finally {
      setDeletingId(null);
    }
  };


  const handleDeleteClick = (taskId) => {
    setTaskToDelete(taskId);
    setShowDeleteConfirm(true);
    setMenuOpenId(null);
  };


  const confirmDelete = async () => {
    if (!taskToDelete) return;
    await deleteRow(taskToDelete);
  };


  const [taskToDelete, setTaskToDelete] = useState(null);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if ((isStatusFilterOpen || isTeamFilterOpen) && !event.target.closest('.filter-container')) {
        setIsStatusFilterOpen(false);
        setIsTeamFilterOpen(false);
      }
      if (menuOpenId && !event.target.closest('.dropdown-container')) {
        setMenuOpenId(null);
      }
    };


    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusFilterOpen, isTeamFilterOpen, menuOpenId]);


  /* ================== Render ================== */


  if (!category) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
            <ClipboardList className="w-5 h-5" />
            <span>Tasks</span>
          </div>
          <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
        </div>


        <div className="flex flex-wrap gap-6">
          {CARDS.map(({ key, label, icon }) => (
            <TaskCard key={key} label={label} icon={icon} onClick={() => setCategory(key)} />
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* UPDATED HEADER - Consistent with grid view */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
          <ClipboardList className="w-5 h-5" />
          <span>Tasks</span>
          <ChevronRight className="w-4 h-4 text-neutral-500" />
          <span>
            {category === "oral" && "Oral Defense"}
            {category === "final" && "Final Defense"}
            {category === "finalRedefense" && "Final Re-Defense"}
          </span>
        </div>
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
      </div>


      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              placeholder="Search..."
              onChange={(e) => setQ(e.target.value)}
              className="w-64 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
            />
          </div>
        </div>


        <div className="flex items-center gap-2">
          {/* Team Filter */}
          <div className="relative filter-container">
            <button
              onClick={() => {
                setIsTeamFilterOpen(!isTeamFilterOpen);
                setIsStatusFilterOpen(false);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50"
            >
              <Users className="w-4 h-4" />
              <span className="text-sm">Team: {filterTeam}</span>
              <ChevronDown className="w-4 h-4" />
            </button>


            {isTeamFilterOpen && (
              <div className="absolute right-0 top-10 z-50 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setFilterTeam("All Teams");
                    setIsTeamFilterOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 ${
                    filterTeam === "All Teams" ? "bg-neutral-100 font-medium" : ""
                  }`}
                >
                  All Teams
                </button>
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      setFilterTeam(team.name);
                      setIsTeamFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 ${
                      filterTeam === team.name ? "bg-neutral-100 font-medium" : ""
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            )}
          </div>


          {/* Status Filter */}
          <div className="relative filter-container">
            <button
              onClick={() => {
                setIsStatusFilterOpen(!isStatusFilterOpen);
                setIsTeamFilterOpen(false);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-sm">Status: {filterStatus}</span>
              <ChevronDown className="w-4 h-4" />
            </button>


            {isStatusFilterOpen && (
              <div className="absolute right-0 top-10 z-50 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
                {FILTER_OPTIONS_ADVISER.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilterStatus(status);
                      setIsStatusFilterOpen(false);
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
      </div>


      {/* Table - FIXED horizontal scroll implementation */}
      <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[1400px]">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left p-3 whitespace-nowrap">NO</th>
              <th className="text-left p-3 whitespace-nowrap">Team</th>
              <th className="text-left p-3 whitespace-nowrap">Tasks Type</th>
              <th className="text-left p-3 whitespace-nowrap">Tasks</th>
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
            {(loadingTeams || loadingTasks) && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-neutral-500">
                  Loading tasks…
                </td>
              </tr>
            )}
            {!!err && !loadingTeams && !loadingTasks && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-red-600">
                  {err}
                </td>
              </tr>
            )}
            {!loadingTeams && !loadingTasks && !err && filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-neutral-500">
                  No tasks found for your teams.
                </td>
              </tr>
            )}


            {!loadingTeams && !loadingTasks && !err && filtered.map((row, idx) => {
              const rowNo = idx + 1;
              const isMissed = row.status === "Missed";
              const currentRevisionCount = parseRevCount(row.revision);
              const hasMaxRevisions = currentRevisionCount >= 10;
              const hasDueDateTime = hasDueDateAndTime(row.__raw);
              const isCompleted = row.status === "Completed";


              return (
                <tr key={row.id} className="border-t border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <td className="p-3 align-top whitespace-nowrap">{rowNo}</td>
                  <td className="p-3 align-top whitespace-nowrap">
                    <div className="font-medium">{row.teamName}</div>
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">{row.type}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.task}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.subtasks}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.elements}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.created}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.due}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.time}</td>
                  <td className="p-3 align-top whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <RevisionPill value={row.revision} />
                      {hasMaxRevisions && (
                        <span className="text-xs text-red-600 font-medium" title="Maximum revisions reached - create new task">
                          MAX
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">
                    {isMissed ? (
                      <StatusBadge
                        value={row.status || "Missed"}
                        isEditable={false}
                        disabled={true}
                      />
                    ) : (
                      <StatusBadge
                        value={row.status || "To Do"}
                        isEditable={hasDueDateTime || isCompleted}
                        onChange={(v) => saveStatus(row, v)}
                        statusOptions={STATUS_OPTIONS_ADVISER}
                      />
                    )}
                    {!hasDueDateTime && !isCompleted && (
                      <div className="text-xs text-neutral-500 mt-1">
                        Set due date/time to enable status
                      </div>
                    )}
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">{row.methodology}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.phase}</td>
                  <td className="p-3 align-top text-right whitespace-nowrap">
                    <div className="relative inline-block dropdown-container">
                      <button
                        className="p-1.5 rounded-md transition-colors hover:bg-neutral-100"
                        onClick={() => setMenuOpenId(menuOpenId === row.id ? null : row.id)}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === row.id && (
                        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg">
                          <div className="flex flex-col">
                            <button
                              className={`w-full text-left px-3 py-2 ${
                                hasMaxRevisions
                                  ? "text-neutral-400 cursor-not-allowed"
                                  : "hover:bg-neutral-50"
                              } flex items-center gap-2`}
                              onClick={() => {
                                if (hasMaxRevisions) {
                                  alert("Maximum revisions reached (10). Please create a new task instead of editing this one.");
                                  return;
                                }
                                setMenuOpenId(null);
                                setEditDueDateTime({
                                  ...row,
                                  existingTask: row.__raw,
                                  teamName: row.teamName
                                });
                              }}
                              disabled={hasMaxRevisions}
                              title={hasMaxRevisions ? "Maximum revisions reached - create new task" : ""}
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center gap-2"
                              onClick={() => {
                                setMenuOpenId(null);
                                alert(`View details for: ${row.task}`);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-red-600 flex items-center gap-2"
                              onClick={() => handleDeleteClick(row.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {/* Edit Due Date & Time Modal */}
      <EditDueDateTimeDialog
        open={!!editDueDateTime}
        onClose={() => setEditDueDateTime(null)}
        onSaved={() => setEditDueDateTime(null)}
        existingTask={editDueDateTime}
      />


      {/* Delete Confirmation Modal */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTaskToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Task?"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="No, Cancel"
      />
    </div>
  );
}


