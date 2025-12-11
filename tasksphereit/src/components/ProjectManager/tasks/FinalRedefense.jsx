// src/components/ProjectManager/tasks/FinalRedefense.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  CalendarDays,
  Clock,
  PlusCircle,
  UserCircle2,
  Paperclip,
  X,
  MoreVertical,
  Loader2,
  Trash2,
  Edit,
  Users,
  ChevronDown,
  AlertCircle,
  Eye, // Added Eye icon for View
} from "lucide-react";
import { useNavigate } from "react-router-dom"; // Added useNavigate

/* ===== Firebase ===== */
import { auth, db } from "../../../config/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDoc,
} from "firebase/firestore";

/* ===== Supabase ===== */
import { supabase } from "../../../config/supabase";

/* ===== JSON options (Final Re-Defense) ===== */
import OPTIONS_JSON from "../methodologyContents/finalReDefense.json";

const MAROON = "#6A0F14";
const TASKS_COLLECTION = "finalRedefenseTasks";

/* ---------- Status Colors ---------- */
const STATUS_COLORS = {
  "To Do": "#FABC3F", // Yellow
  "In Progress": "#809D3C", // Green
  "To Review": "#578FCA", // Blue
  "Completed": "#AA60C8", // Purple
  "Missed": "#3B0304", // Maroon
};

// Updated: Team tasks can go up to "Completed", Adviser tasks only up to "To Review"
const STATUS_OPTIONS_TEAM = ["To Do", "In Progress", "To Review", "Completed"];
const STATUS_OPTIONS_ADVISER = ["To Do", "In Progress", "To Review"];
// Updated: Filter options without "Completed"
const FILTER_OPTIONS_TEAM = ["All Status", "To Do", "In Progress", "To Review", "Missed"];
const FILTER_OPTIONS_ADVISER = ["All Status", "To Do", "In Progress", "To Review", "Missed"];

/* ---------- helpers ---------- */
const localTodayStr = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const formatTime12Hour = (time24) => {
  if (!time24 || time24 === "null") return "null";
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
};

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

/* ===== Status component ===== */
const StatusBadgeFinalRedefense = ({ value, isEditable, onChange, disabled = false, statusOptions = STATUS_OPTIONS_TEAM }) => {
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

// Helper function to display due date and time properly
const displayDueDate = (dueDate, isAdviserTask = false) => {
  if (isAdviserTask && (!dueDate || dueDate === "--")) {
    return "--";
  }
  return dueDate ? formatDateMonthDayYear(dueDate) : "--";
};

const displayDueTime = (dueTime, isAdviserTask = false) => {
  if (isAdviserTask && (!dueTime || dueTime === "--")) {
    return "--";
  }
  return dueTime ? formatTime12Hour(dueTime) : "--";
};

// Helper function to check if adviser task has due date and time
const hasDueDateAndTime = (task) => {
  return task && task.dueDate && task.dueTime && task.dueDate !== "--" && task.dueTime !== "--";
};

/* -----------------------------------------------------------
   Build indexes from JSON (methodologies → phases → types → tasks → subtasks → elements)
----------------------------------------------------------- */
function buildIndexesFromJSON(json) {
  const root = json?.finalReDefense || [];

  const METHODOLOGIES = [];
  const PHASE_OPTIONS = {};
  const TASK_SEEDS = {};
  const SUBTASKS = {};
  const ELEMENTS = {};

  for (const m of root) {
    const mName = String(m?.methodology || "").trim();
    if (!mName) continue;

    METHODOLOGIES.push(mName);
    PHASE_OPTIONS[mName] = [];
    TASK_SEEDS[mName] = {};
    SUBTASKS[mName] = {};
    ELEMENTS[mName] = {};

    const phases = Array.isArray(m.projectPhases) ? m.projectPhases : [];
    for (const p of phases) {
      const phaseName = String(p?.phase || "").trim();
      if (phaseName) PHASE_OPTIONS[mName].push(phaseName);

      // Initialize TASK_SEEDS for this methodology and phase
      if (!TASK_SEEDS[mName][phaseName]) {
        TASK_SEEDS[mName][phaseName] = {};
      }

      const types = Array.isArray(p?.taskTypes) ? p.taskTypes : [];
      for (const tt of types) {
        const tType = String(tt?.type || "").trim();
        if (!tType) continue;

        if (!TASK_SEEDS[mName][phaseName][tType]) TASK_SEEDS[mName][phaseName][tType] = [];

        const tasks = Array.isArray(tt?.tasks) ? tt.tasks : [];
        for (const t of tasks) {
          const taskName = String(t?.task || "").trim();
          if (!taskName) continue;

          if (!TASK_SEEDS[mName][phaseName][tType].includes(taskName)) {
            TASK_SEEDS[mName][phaseName][tType].push(taskName);
          }

          // Handle subtasks - both array of strings and array of objects
          let subtasksArr = [];
          if (Array.isArray(t?.subtasks)) {
            subtasksArr = t.subtasks.map(subtask => {
              if (typeof subtask === 'string') {
                return { subtask: subtask.trim(), elements: [] };
              } else if (typeof subtask === 'object') {
                return {
                  subtask: String(subtask?.subtask || "").trim(),
                  elements: Array.isArray(subtask?.elements) ? subtask.elements : []
                };
              }
              return { subtask: "", elements: [] };
            }).filter(item => item.subtask);
          }

          if (!SUBTASKS[mName][taskName]) SUBTASKS[mName][taskName] = [];
          
          for (const s of subtasksArr) {
            const sName = s.subtask;
            if (!sName) continue;
            
            if (!SUBTASKS[mName][taskName].includes(sName)) {
              SUBTASKS[mName][taskName].push(sName);
            }
            
            // Handle elements
            if (s.elements && s.elements.length > 0) {
              ELEMENTS[mName][sName] = s.elements.map(e => String(e));
            }
          }

          // Handle task-level elements
          const taskEls = Array.isArray(t?.elements) ? t.elements : [];
          if (taskEls.length > 0) {
            if (!ELEMENTS[mName][taskName]) {
              ELEMENTS[mName][taskName] = taskEls.map(e => String(e));
            }
            // Add task itself as a subtask if it has elements
            if (!SUBTASKS[mName][taskName]?.includes(taskName)) {
              SUBTASKS[mName][taskName]?.push(taskName);
            }
          }
        }
      }
    }
  }

  const FIXED_PHASE = Object.fromEntries(
    Object.entries(PHASE_OPTIONS).map(([k, arr]) => [
      k,
      arr.length === 1 ? arr[0] : null,
    ])
  );

  return {
    METHODOLOGIES,
    PHASE_OPTIONS,
    TASK_SEEDS,
    SUBTASKS,
    ELEMENTS,
    FIXED_PHASE,
  };
}

const {
  METHODOLOGIES,
  PHASE_OPTIONS,
  TASK_SEEDS,
  SUBTASKS,
  ELEMENTS,
  FIXED_PHASE,
} = buildIndexesFromJSON(OPTIONS_JSON);

/* ---------- small helpers ---------- */
const snapTimeTo = (val, stepMin = 1) => {
  if (!val) return "";
  const [H, M] = String(val).split(":").map(Number);
  let mm = Math.round(M / stepMin) * stepMin;
  let hh = H;
  if (mm === 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/* ===== Supabase files ===== */
const uploadTaskFileToSupabase = async (file, userId) => {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const fileName = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("user-tasks-files")
    .upload(fileName, file);
  if (upErr) throw new Error(upErr.message || "Upload failed");
  const {
    data: { publicUrl },
  } = supabase.storage.from("user-tasks-files").getPublicUrl(fileName);
  return {
    url: publicUrl,
    fileName,
    originalName: file.name,
    size: file.size,
    type: file.type,
  };
};
const deleteTaskFileFromSupabase = async (fileName) => {
  if (!fileName) return;
  const { error } = await supabase.storage
    .from("user-tasks-files")
    .remove([fileName]);
  if (error) throw new Error(error.message || "Delete failed");
};

/* ======= Confirmation Dialog ======= */
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

/* ======= Simple Edit Due Date & Time Dialog ======= */
function EditDueDateTimeDialog({
  open,
  onClose,
  onSaved,
  existingTask,
  rowData, // Add rowData prop to get the correct member info
  isFinalRedefenseAllowed, // Add this prop to check if final re-defense is allowed
  lockedMethodology, // Add methodology prop
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

  const canSave = due && time && currentRevisionCount < 10 && isFinalRedefenseAllowed;

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
        if (currentStatus === "To Review" || currentStatus === "Missed") {
          // Bump revision and reset to "To Do" for "To Review" and "Missed" tasks
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
          doc(db, TASKS_COLLECTION, existingTask.id),
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
    return currentStatus === "To Review" || currentStatus === "Missed";
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
        {/* backdrop */}
        <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

        {/* panel - centered */}
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
            {/* header - UPDATED with Edit icon and horizontal line moved down */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-200">
              <div
                className="flex items-center gap-2 text-[16px] font-semibold"
                style={{ color: MAROON }}
              >
                <Edit className="w-5 h-5" /> {/* Changed to Edit icon */}
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

            {/* CONTENT */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-5">
              {/* Final Re-Defense Allowed Check */}
              {!isFinalRedefenseAllowed && (
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-1">Final Re-Defense Not Available</h4>
                      <p className="text-yellow-700 text-sm">
                        Final Re-Defense tasks cannot be managed until your team receives a "Re-Oral" verdict on Final Defense.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Task Info - REMOVED border box styling */}
              <div className="space-y-3">
                <h3 className="font-medium text-neutral-700">Task Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Assigned:</span> {rowData?.memberName || "Team"}
                  </div>
                  <div>
                    <span className="font-medium">Methodology:</span> {lockedMethodology || "Not Set"}
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
                        disabled={!isFinalRedefenseAllowed}
                      />
                    </div>
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        step={60} // 1 minute
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                        value={time}
                        onChange={(e) => {
                          setTime(e.target.value);
                          handleInputChange();
                        }}
                        disabled={!isFinalRedefenseAllowed}
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

            {/* footer - REMOVED Cancel button */}
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

      {/* Exit Confirmation */}
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

/* ======= Create/Edit Task Dialog ======= */
function EditTaskDialog({
  open,
  onClose,
  onSaved,
  pm,
  teams = [],
  members = [],
  seedMember,
  existingTask,
  mode, // "team" | "adviser"
  lockedMethodology,
  rowData, // Add rowData prop to get the correct member info
  isFinalRedefenseAllowed, // Add this prop to check if final re-defense is allowed
}) {
  const isTeamMode = mode === "team";
  const isAdviserMode = mode === "adviser";
  const timeStepSec = 60; // 1 minute for both

  const [saving, setSaving] = useState(false);
  const [teamId, setTeamId] = useState("");

  const [methodology, setMethodology] = useState("");
  const [phase, setPhase] = useState("");
  const [type, setType] = useState("");
  const [task, setTask] = useState("");
  const [subtasks, setSubtasks] = useState("");
  const [elements, setElements] = useState("");

  const [due, setDue] = useState("");
  const [time, setTime] = useState("");

  const [pickedUid, setPickedUid] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [comment, setComment] = useState("");

  const [attachedFiles, setAttachedFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const fileInputRef = useRef(null);

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const stepMin = 1; // 1 minute step
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const roundUpNow = (sMin = 1) => {
    const d = new Date();
    let m = Math.ceil(d.getMinutes() / sMin) * sMin;
    let h = d.getHours();
    if (m === 60) {
      m = 0;
      h = (h + 1) % 24;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const minTimeForDate = (dateStr) =>
    dateStr === todayISO ? roundUpNow(stepMin) : "";

  const availablePhases = useMemo(
    () => (methodology ? PHASE_OPTIONS[methodology] || [] : []),
    [methodology]
  );
  
  // FIXED: Get available types based on selected methodology AND phase
  const availableTypes = useMemo(
    () => {
      if (!methodology || !phase) return [];
      return Object.keys(TASK_SEEDS[methodology]?.[phase] || {});
    },
    [methodology, phase]
  );
  
  // FIXED: Get task options based on methodology, phase, and type
  const taskOptions = useMemo(() => {
    const mKey = lockedMethodology || methodology;
    if (!mKey || !phase || !type) return [];
    return TASK_SEEDS[mKey]?.[phase]?.[type] || [];
  }, [lockedMethodology, methodology, phase, type]);
  
  const subtaskOptions = useMemo(() => {
    const mKey = lockedMethodology || methodology;
    if (!mKey || !task) return [];
    return SUBTASKS[mKey]?.[task] || [];
  }, [lockedMethodology, methodology, task]);
  
  const elementOptions = useMemo(() => {
    const mKey = lockedMethodology || methodology;
    if (!mKey || !subtasks) return [];
    return ELEMENTS[mKey]?.[subtasks] || [];
  }, [lockedMethodology, methodology, subtasks]);

  useEffect(() => {
    if (!due) return;
    if (due === todayISO && time) {
      const minT = minTimeForDate(due);
      if (time < minT) setTime(minT);
    }
  }, [due]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;

    setTeamId(existingTask?.team?.id || teams[0]?.id || "");

    const initialMethod = lockedMethodology || existingTask?.methodology || "";
    setMethodology(initialMethod);

    const fixed = FIXED_PHASE[initialMethod] ?? null;
    setPhase(fixed || existingTask?.phase || "");

    if (existingTask) {
      setType(existingTask.type || "");
      setTask(existingTask.task || "");
      setSubtasks(existingTask.subtasks || "");
      setElements(existingTask.elements || "");
      
      // For adviser tasks, always show empty due date/time (will be set by adviser)
      if (isAdviserMode) {
        setDue("");
        setTime("");
      } else {
        setDue(existingTask.dueDate || "");
        setTime(existingTask.dueTime || "");
      }
      
      // Use the rowData member info instead of the task's assignees
      if (rowData?.isTeamTask) {
        // For team tasks, assign all members
        const allMembers = [...members, pm].filter(Boolean);
        setAssignees(allMembers);
      } else {
        // For individual tasks, use the specific member from rowData
        const specificMember = members.find(m => m.uid === rowData?.memberUid) || pm;
        setAssignees(specificMember ? [specificMember] : []);
      }
      
      setComment(existingTask.comment || "");
      setAttachedFiles(existingTask.fileUrl || []);
      setNewFiles([]);
      setFilesToDelete([]);
    } else {
      setType("");
      setTask("");
      setSubtasks("");
      setElements("");
      // For new adviser tasks, don't set due date/time
      setDue("");
      setTime("");
      // UPDATED: For new team tasks, start with empty assignees instead of pre-populating
      setAssignees([]);
      setComment("");
      setAttachedFiles([]);
      setNewFiles([]);
      setFilesToDelete([]);
    }
    setHasChanges(false);
  }, [open, existingTask, seedMember, teams, lockedMethodology, pm, members, rowData, isAdviserMode]);

  const onChangeMethodology = (v) => {
    setMethodology(v);
    setPhase(FIXED_PHASE[v] || "");
    setType("");
    setTask("");
    setSubtasks("");
    setElements("");
    setHasChanges(true);
  };
  
  // FIXED: When phase changes, reset type, task, subtasks, elements
  const onChangePhase = (v) => {
    setPhase(v);
    setType("");
    setTask("");
    setSubtasks("");
    setElements("");
    setHasChanges(true);
  };
  
  const onChangeType = (v) => {
    setType(v);
    setTask("");
    setSubtasks("");
    setElements("");
    setHasChanges(true);
  };
  const onChangeTask = (v) => {
    setTask(v);
    setSubtasks("");
    setElements("");
    setHasChanges(true);
  };
  const onChangeSubtasks = (v) => {
    setSubtasks(v);
    setElements("");
    setHasChanges(true);
  };

  // UPDATED: Team tasks require date and time, adviser tasks don't
  const canSave =
    isFinalRedefenseAllowed && // Add this condition
    (mode === "team" ? true : !!teamId) &&
    (lockedMethodology ? true : !!methodology) &&
    (lockedMethodology ? true : !!phase || availablePhases.length <= 1) &&
    type &&
    task &&
    (mode === "team" ? assignees.length > 0 : true) &&
    // Team tasks require date and time, adviser tasks don't
    (mode === "team" ? (due && time) : true);

  const assignTeam = () => {
    // For team assignment, just add a single "Team" assignee
    setAssignees([{ uid: 'team', name: 'Team' }]);
    setHasChanges(true);
  };

  const handleAttachClick = () => fileInputRef.current?.click();
  const onFilePicked = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const objs = files.map((f) => ({
      id: Date.now() + Math.random(),
      file: f,
      name: f.name,
      isNew: true,
    }));
    setNewFiles((prev) => [...prev, ...objs]);
    setHasChanges(true);
    e.target.value = "";
  };
  const removeNewFile = (id) => {
    setNewFiles((prev) => prev.filter((f) => f.id !== id));
    setHasChanges(true);
  };
  const removeExistingFile = (id) => {
    const f = attachedFiles.find((x) => x.id === id);
    if (!f) return;
    setFilesToDelete((prev) => (f.fileName ? [...prev, f] : prev));
    setAttachedFiles((prev) => prev.filter((x) => x.id !== id));
    setHasChanges(true);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const team =
        teams.find((t) => t.id === teamId) || existingTask?.team || null;

      if (filesToDelete.length > 0) {
        await Promise.allSettled(
          filesToDelete.map((f) => deleteTaskFileFromSupabase(f.fileName))
        );
      }

      const userId =
        auth.currentUser?.uid || localStorage.getItem("uid") || "anon";
      let uploaded = [];
      if (newFiles.length > 0) {
        uploaded = await Promise.all(
          newFiles.map(async (nf) => {
            const up = await uploadTaskFileToSupabase(nf.file, userId);
            return {
              id: nf.id,
              name: up.originalName,
              fileName: up.fileName,
              url: up.url,
              uploadedAt: new Date().toISOString(),
              size: nf.file.size,
              type: nf.file.type,
            };
          })
        );
      }
      const finalFileUrl = [...attachedFiles, ...uploaded];

      // For adviser tasks, don't set due date/time - set them to null
      const timeString = isTeamMode && time ? time : "";
      const dueAtMs =
        isTeamMode && due && timeString
          ? new Date(`${due}T${timeString}:00`).getTime()
          : null;
      
      // Only validate due date/time for team tasks
      if (dueAtMs && dueAtMs < Date.now() && isTeamMode) {
        alert("Due date/time must be in the future.");
        setSaving(false);
        return;
      }

      const hasElements = elementOptions.length > 0;
      const elementsValue = subtasks
        ? hasElements
          ? elements || null
          : "--"
        : null;

      const taskManager = mode === "adviser" ? "Adviser" : "Project Manager";

      const finalMethodology = lockedMethodology || methodology || "";
      const finalPhase = FIXED_PHASE[finalMethodology] ?? phase ?? "";

      // FIXED: Add isTeamTask field to properly identify team tasks
      const isTeamTask = mode === "team" && assignees.some(a => a.uid === 'team');

      const payload = {
        methodology: finalMethodology,
        phase: finalPhase,
        type,
        task,
        subtasks: subtasks || null,
        elements: elementsValue,
        fileUrl: finalFileUrl,
        // For adviser tasks, explicitly set due date/time to null
        dueDate: isTeamMode ? (due || null) : null,
        dueTime: isTeamMode ? (timeString || null) : null,
        dueAtMs: isTeamMode ? dueAtMs : null,
        status: existingTask?.status || "To Do",
        revision: existingTask?.revision || "No Revision",
        assignees:
          mode === "team"
            ? assignees.map((a) => ({ uid: a.uid, name: a.name }))
            : [],
        team: team ? { id: team.id, name: team.name } : null,
        comment: comment || "",
        createdBy: pm
          ? { uid: pm.uid, name: pm.name, role: "Project Manager" }
          : null,
        taskManager,
        isTeamTask: isTeamTask, // FIXED: Add this field to identify team tasks
        updatedAt: serverTimestamp(),
      };

      if (existingTask?.id) {
        await updateDoc(doc(db, TASKS_COLLECTION, existingTask.id), payload);
      } else {
        await addDoc(collection(db, TASKS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
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

  const methodologyLocked = !!lockedMethodology;

  // Check if "Team" is in assignees
  const hasTeamAssignee = assignees.some(a => a.uid === 'team');
  
  // Check if any individual members are assigned
  const hasIndividualAssignees = assignees.length > 0 && !hasTeamAssignee;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
        <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
        <div className="relative z-10 w-full max-w-[700px]">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-200">
              <div
                className="flex items-center gap-2 text-[16px] font-semibold"
                style={{ color: MAROON }}
              >
                <PlusCircle className="w-5 h-5" />
                <span>{existingTask ? "Edit Task" : "Create Task"}</span>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4">
              {/* Final Re-Defense Allowed Check */}
              {!isFinalRedefenseAllowed && (
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-1">Final Re-Defense Not Available</h4>
                      <p className="text-yellow-700 text-sm">
                        Final Re-Defense tasks cannot be created or edited until your team receives a "Re-Oral" verdict on Final Defense.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Methodology & Phase */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Methodology
                  </label>
                  <select
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    value={methodology}
                    onChange={(e) => onChangeMethodology(e.target.value)}
                    disabled={methodologyLocked || !isFinalRedefenseAllowed}
                  >
                    <option value="">
                      {methodologyLocked
                        ? lockedMethodology
                        : "Select methodology"}
                    </option>
                    {METHODOLOGIES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {methodologyLocked && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Methodology is locked to <b>{lockedMethodology}</b> from previous defense.
                    </p>
                  )}
                </div>

                <div className="col-span-6">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Project Phase
                  </label>
                  {(() => {
                    const list = methodology
                      ? PHASE_OPTIONS[methodology] || []
                      : [];
                    return list.length > 1 ? (
                      <select
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        value={phase}
                        onChange={(e) => onChangePhase(e.target.value)}
                        disabled={!methodology || !isFinalRedefenseAllowed}
                      >
                        <option value="">
                          {methodology
                            ? "Select phase"
                            : "Pick Methodology first"}
                        </option>
                        {list.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-neutral-100 text-sm"
                        value={phase}
                        readOnly
                        placeholder={
                          methodology
                            ? "Auto-selected"
                            : "Pick Methodology first"
                        }
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Type / Task / Subtasks */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Task Type
                  </label>
                  <select
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    value={type}
                    onChange={(e) => onChangeType(e.target.value)}
                    disabled={!(methodologyLocked || methodology) || !phase || !isFinalRedefenseAllowed}
                  >
                    <option value="">
                      {methodologyLocked || methodology
                        ? phase ? "Select" : "Pick Phase first"
                        : "Pick Methodology first"}
                    </option>
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Task
                  </label>
                  <select
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    value={task}
                    onChange={(e) => onChangeTask(e.target.value)}
                    disabled={!type || !isFinalRedefenseAllowed}
                  >
                    <option value="">
                      {type ? "Select task" : "Pick Task Type first"}
                    </option>
                    {taskOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Subtasks
                  </label>
                  <select
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    value={subtasks}
                    onChange={(e) => onChangeSubtasks(e.target.value)}
                    disabled={
                      !task ||
                      (lockedMethodology || methodology
                        ? (
                            SUBTASKS[lockedMethodology || methodology]?.[
                              task
                            ] || []
                          ).length === 0
                        : true) ||
                      !isFinalRedefenseAllowed
                    }
                  >
                    <option value="">
                      {task
                        ? (lockedMethodology || methodology) &&
                          (
                            SUBTASKS[lockedMethodology || methodology]?.[
                              task
                            ] || []
                          ).length
                          ? "Select subtask"
                          : "No subtasks"
                        : "Pick Task first"}
                    </option>
                    {(lockedMethodology || methodology) && task
                      ? (
                          SUBTASKS[lockedMethodology || methodology]?.[
                            task
                          ] || []
                        ).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))
                      : null}
                  </select>
                </div>
              </div>

              {/* Elements / Due Date / Time */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Elements
                  </label>
                  <select
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    value={elements}
                    onChange={(e) => {
                      setElements(e.target.value);
                      handleInputChange();
                    }}
                    disabled={
                      !subtasks ||
                      (lockedMethodology || methodology
                        ? (
                            ELEMENTS[lockedMethodology || methodology]?.[
                              subtasks
                            ] || []
                          ).length === 0
                        : true) ||
                      !isFinalRedefenseAllowed
                    }
                  >
                    <option value="">
                      {subtasks
                        ? (lockedMethodology || methodology) &&
                          (
                            ELEMENTS[lockedMethodology || methodology]?.[
                              subtasks
                            ] || []
                          ).length
                          ? "Select element"
                          : "No elements"
                        : "Pick Subtask first"}
                    </option>
                    {(lockedMethodology || methodology) && subtasks
                      ? (
                          ELEMENTS[lockedMethodology || methodology]?.[
                            subtasks
                          ] || []
                        ).map((el) => (
                          <option key={el} value={el}>
                            {el}
                          </option>
                        ))
                      : null}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Due Date {isTeamMode && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="date"
                    min={todayISO}
                    className={`w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm ${
                      isAdviserMode || !isFinalRedefenseAllowed ? 'bg-neutral-100 cursor-not-allowed' : ''
                    }`}
                    value={due}
                    onChange={(e) => {
                      if (isAdviserMode || !isFinalRedefenseAllowed) return;
                      setDue(e.target.value);
                      handleInputChange();
                    }}
                    disabled={isAdviserMode || !isFinalRedefenseAllowed}
                    title={isAdviserMode ? "Due date will be set by the Capstone Adviser" : !isFinalRedefenseAllowed ? "Final re-defense not available yet" : ""}
                  />
                  {isAdviserMode && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Due date will be set by the Capstone Adviser
                    </p>
                  )}
                </div>

                <div className="col-span-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Time {isTeamMode && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="time"
                    step={timeStepSec}
                    min={
                      due === todayISO && !isAdviserMode
                        ? (() => {
                            const d = new Date();
                            let m = d.getMinutes();
                            let h = d.getHours();
                            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                          })()
                        : ""
                    }
                    className={`w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm ${
                      isAdviserMode || !isFinalRedefenseAllowed ? 'bg-neutral-100 cursor-not-allowed' : ''
                    }`}
                    value={time}
                    onChange={(e) => {
                      if (isAdviserMode || !isFinalRedefenseAllowed) return;
                      setTime(e.target.value);
                      handleInputChange();
                    }}
                    disabled={isAdviserMode || !isFinalRedefenseAllowed}
                    title={isAdviserMode ? "Time will be set by the Capstone Adviser" : !isFinalRedefenseAllowed ? "Final re-defense not available yet" : ""}
                  />
                  {isAdviserMode && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Time will be set by the Capstone Adviser
                    </p>
                  )}
                </div>
              </div>

              {/* Assign Members (team mode) - Updated to match FinalDefense exactly */}
              {mode === "team" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Assigned <span className="text-red-500">*</span>
                  </label>
                  <AssigneesPicker
                    members={[...members, pm].filter(Boolean)}
                    pickedUid={pickedUid}
                    setPickedUid={setPickedUid}
                    assignees={assignees}
                    setAssignees={(newAssignees) => {
                      setAssignees(newAssignees);
                      handleInputChange();
                    }}
                    onAssignTeam={assignTeam}
                    hasTeamAssignee={hasTeamAssignee}
                    hasIndividualAssignees={hasIndividualAssignees}
                    isFinalRedefenseAllowed={isFinalRedefenseAllowed}
                  />
                </div>
              )}

              {/* Comment + attachments */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Leave Comment:
                </label>
                <div className="rounded-xl border border-neutral-300 bg-white shadow-sm">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200">
                    <UserCircle2 className="w-5 h-5 text-neutral-600" />
                    <span className="text-sm font-semibold text-neutral-800">
                      {pm?.name || "Project Manager"}
                    </span>
                  </div>
                  <div className="relative">
                    <textarea
                      rows={3}
                      className="w-full resize-none px-3 py-2 text-sm outline-none"
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        handleInputChange();
                      }}
                      disabled={!isFinalRedefenseAllowed}
                    />
                    <button
                      type="button"
                      className="absolute right-2 bottom-2 p-1 rounded hover:bg-neutral-100"
                      title="Attach"
                      onClick={handleAttachClick}
                      disabled={!isFinalRedefenseAllowed}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      className="hidden"
                      type="file"
                      multiple
                      onChange={onFilePicked}
                      disabled={!isFinalRedefenseAllowed}
                    />
                  </div>
                </div>
              </div>

              {(attachedFiles.length > 0 || newFiles.length > 0) && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Attachments ({attachedFiles.length + newFiles.length})
                  </label>
                  <div className="space-y-2">
                    {attachedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-neutral-200"
                      >
                        <div className="truncate text-sm">
                          <span className="font-medium">{f.name}</span>
                          {f.url ? (
                            <a
                              className="ml-2 text-xs text-[#6A0F14] underline"
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              open
                            </a>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="p-1 rounded-md hover:bg-neutral-200"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => removeExistingFile(f.id)}
                          disabled={!isFinalRedefenseAllowed}
                        >
                          <X className="w-4 h-4 text-neutral-600" />
                        </button>
                      </div>
                    ))}
                    {newFiles.map((nf) => (
                      <div
                        key={nf.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-neutral-200"
                      >
                        <div className="truncate text-sm">
                          <span className="font-medium">{nf.name}</span>
                          <span className="ml-2 text-xs text-blue-600">
                            (new)
                          </span>
                        </div>
                        <button
                          type="button"
                          className="p-1 rounded-md hover:bg-neutral-200"
                          aria-label={`Remove ${nf.name}`}
                          onClick={() => removeNewFile(nf.id)}
                          disabled={!isFinalRedefenseAllowed}
                        >
                          <X className="w-4 h-4 text-neutral-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={save}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
                style={{ backgroundColor: MAROON }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {existingTask ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Confirmation */}
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

/* Small subcomponent to keep the dialog tidy - EXACT COPY from FinalDefense */
function AssigneesPicker({
  members,
  pickedUid,
  setPickedUid,
  assignees,
  setAssignees,
  onAssignTeam,
  hasTeamAssignee,
  hasIndividualAssignees,
  isFinalRedefenseAllowed, // Add this prop
}) {
  return (
    <>
      <div className="flex gap-2">
        <select
          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
            hasTeamAssignee || !isFinalRedefenseAllowed
              ? "border-neutral-300 bg-neutral-100 text-neutral-500 cursor-not-allowed" 
              : "border-neutral-300"
          }`}
          value={pickedUid}
          onChange={(e) => setPickedUid(e.target.value)}
          disabled={hasTeamAssignee || !isFinalRedefenseAllowed}
        >
          <option value="">Select member</option>
          {members.map((m) => (
            <option 
              key={m.uid} 
              value={m.uid}
              disabled={hasTeamAssignee || !isFinalRedefenseAllowed}
            >
              {m.name}
            </option>
          ))}
          <option 
            value="team"
            disabled={hasIndividualAssignees || !isFinalRedefenseAllowed}
          >
            Team
          </option>
        </select>
        <button
          type="button"
          onClick={() => {
            if (!pickedUid) return;
            
            if (pickedUid === "team") {
              onAssignTeam();
            } else {
              const found = members.find((m) => m.uid === pickedUid);
              if (found && !assignees.some((a) => a.uid === found.uid))
                setAssignees((a) => [...a, found]);
            }
            setPickedUid("");
          }}
          disabled={!pickedUid || hasTeamAssignee || !isFinalRedefenseAllowed}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusCircle className="w-4 h-4" /> Add
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {assignees.map((a) => (
          <span
            key={a.uid}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-neutral-100 border border-neutral-200"
          >
            {a.name}
            <button
              className="p-0.5 hover:bg-neutral-200 rounded-full"
              onClick={() =>
                setAssignees((arr) => arr.filter((x) => x.uid !== a.uid))
              }
              disabled={!isFinalRedefenseAllowed}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      {(hasTeamAssignee || hasIndividualAssignees) && (
        <p className="text-xs text-neutral-500 mt-1">
          {hasTeamAssignee 
            ? "Team assignment includes all members. Remove team assignment to assign individuals." 
            : "Individual members assigned. Remove all individuals to assign team."}
        </p>
      )}
    </>
  );
}

/* ============================ Main Component ============================ */
const FinalRedefense = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState("team"); // "team" or "adviser"
  const mode = activeTab; // Use activeTab as mode

  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingModal, setEditingModal] = useState(null);
  const [editDueDateTime, setEditDueDateTime] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [optimistic, setOptimistic] = useState({});

  const pmUid = auth.currentUser?.uid || localStorage.getItem("uid") || "";
  const [pmProfile, setPmProfile] = useState(null);

  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);

  // State for final defense verdict and methodology
  const [finalDefenseVerdict, setFinalDefenseVerdict] = useState(null);
  const [finalDefenseMethodology, setFinalDefenseMethodology] = useState(null);
  const [loadingVerdict, setLoadingVerdict] = useState(true);

  // Add useNavigate hook
  const navigate = useNavigate();

  // PM profile
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
        setPmProfile({ uid: pmUid, name: name || "Project Manager" });
      }
    );
    return () => unsub && unsub();
  }, [pmUid]);

  // Teams + Members
  useEffect(() => {
    if (!pmUid) return;
    const unsubTeams = onSnapshot(
      query(collection(db, "teams"), where("manager.uid", "==", pmUid)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeams(rows);

        const memberUids = Array.from(
          new Set(rows.flatMap((t) => t.memberUids || []))
        );
        if (memberUids.length === 0) return setMembers([]);

        const chunks = [];
        for (let i = 0; i < memberUids.length; i += 10)
          chunks.push(memberUids.slice(i, i + 10));
        const unsubs = chunks.map((uids) =>
          onSnapshot(
            query(collection(db, "users"), where("uid", "in", uids)),
            (s) => {
              const list = s.docs.map((x) => {
                const d = x.data();
                const name = [d.firstName, d.middleName, d.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
                return { uid: d.uid || x.id, name };
              });
              setMembers((prev) => {
                const map = new Map(prev.map((m) => [m.uid, m]));
                list.forEach((m) => map.set(m.uid, m));
                return Array.from(map.values()).filter((m) =>
                  memberUids.includes(m.uid)
                );
              });
            }
          )
        );
        return () => unsubs.forEach((u) => u && u());
      }
    );
    return () => unsubTeams && unsubTeams();
  }, [pmUid]);

  // Check Final Defense verdict and methodology for PM's teams
  useEffect(() => {
    if (!pmUid || teams.length === 0) {
      setLoadingVerdict(false);
      return;
    }

    setLoadingVerdict(true);
    
    // Get team IDs for the PM
    const teamIds = teams.map(team => team.id);
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, "finalDefenseSchedules"), 
        where("teamId", "in", teamIds)
      ),
      (snapshot) => {
        let reOral = false;
        let methodology = null;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.verdict === "Re-Oral") {
            reOral = true;
            // Get methodology from final defense - assuming it's stored in the schedule
            methodology = data.methodology || methodology;
          }
        });

        // If no methodology found in schedule, check final defense tasks
        if (reOral && !methodology) {
          const tasksQuery = query(
            collection(db, "finalDefenseTasks"),
            where("createdBy.uid", "==", pmUid),
            where("taskManager", "==", "Project Manager")
          );
          
          onSnapshot(tasksQuery, (tasksSnapshot) => {
            if (!tasksSnapshot.empty) {
              const firstTask = tasksSnapshot.docs[0].data();
              methodology = firstTask.methodology || methodology;
              setFinalDefenseMethodology(methodology);
            }
            setFinalDefenseVerdict(reOral ? "Re-Oral" : "Not Re-Oral");
            setLoadingVerdict(false);
          });
        } else {
          setFinalDefenseMethodology(methodology);
          setFinalDefenseVerdict(reOral ? "Re-Oral" : "Not Re-Oral");
          setLoadingVerdict(false);
        }
      },
      (error) => {
        console.error("Error fetching final defense verdict:", error);
        setFinalDefenseVerdict("Not Re-Oral");
        setLoadingVerdict(false);
      }
    );

    return () => unsubscribe();
  }, [pmUid, teams]);

  // Tasks - Only fetch active tasks (not completed) - UPDATED TO MATCH FINAL DEFENSE
  useEffect(() => {
    if (!pmUid) return;
    const unsub = onSnapshot(
      query(
        collection(db, TASKS_COLLECTION),
        where("createdBy.uid", "==", pmUid),
      ),
      async (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log("Fetched Final Re-Defense tasks:", docs); // DEBUG
        setTasks(docs);

        // Auto-update overdue tasks - MATCHES FINAL DEFENSE BEHAVIOR
        const now = Date.now();
        const updates = docs
          .filter(
            (t) =>
              typeof t.dueAtMs === "number" &&
              t.dueAtMs < now &&
              (t.status || "") !== "Completed" &&
              (t.status || "") !== "Missed"
          )
          .map((t) =>
            updateDoc(doc(db, TASKS_COLLECTION, t.id), { status: "Missed" })
          );

        if (updates.length > 0) {
          console.log(`Auto-updated ${updates.length} missed tasks`);
          await Promise.allSettled(updates);
        }

        // clear optimistic overlays - MATCHES FINAL DEFENSE BEHAVIOR
        setOptimistic((prev) => {
          const next = { ...prev };
          const memberWithTask = new Set();
          for (const t of snap.docs) {
            const data = t.data();
            (data.assignees || []).forEach((a) => {
              if (a?.uid) memberWithTask.add(a.uid);
            });
          }
          for (const k of Object.keys(next)) {
            if (memberWithTask.has(k)) delete next[k];
          }
          return next;
        });
      }
    );
    return () => unsub && unsub();
  }, [pmUid]);

  const lockedMethodology = useMemo(() => {
    if (!tasks.length) return finalDefenseMethodology;
    const m = tasks.map((t) => t.methodology).find((x) => !!x);
    return m || finalDefenseMethodology;
  }, [tasks, finalDefenseMethodology]);

  // Get filter options based on active tab
  const filterOptions = useMemo(() => {
    return activeTab === "team" ? FILTER_OPTIONS_TEAM : FILTER_OPTIONS_ADVISER;
  }, [activeTab]);

  // Check if final re-defense is allowed (final defense must have "Re-Oral" verdict)
  const isFinalRedefenseAllowed = finalDefenseVerdict === "Re-Oral";

  // Helper function to get team name for adviser tasks
  const getTeamNameForAdviser = useMemo(() => {
    if (teams.length === 0 || !pmProfile) return "Team";
    
    // Get the PM's last name
    const pmNameParts = pmProfile.name.split(' ');
    const pmLastName = pmNameParts[pmNameParts.length - 1];
    
    return `${pmLastName}, Et Al`;
  }, [teams, pmProfile]);

  // Add handleViewTask function similar to FinalDefense
  const handleViewTask = (task) => {
    if (!task) return;
    
    const formatDateForDisplay = (dateValue) => {
      if (!dateValue) return "—";
      try {
        const date = typeof dateValue.toDate === 'function' ? 
          dateValue.toDate() : 
          new Date(dateValue);
        
        if (Number.isNaN(date.getTime())) return "—";
        
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        return "—";
      }
    };
    
    let assigneeName = "Team";
    if (task.assignees && task.assignees.length > 0) {
      if (task.assignees[0].uid === 'team') {
        assigneeName = "Team";
      } else {
        assigneeName = task.assignees[0].name || "—";
      }
    } else if (task.taskManager === "Adviser") {
      assigneeName = getTeamNameForAdviser;
    }
    
    const isAdviserTask = task.taskManager === "Adviser";
    
    const taskData = {
      id: task.id,
      _collection: TASKS_COLLECTION,
      teamId: task.team?.id || task.teamId || "",
      teamName: task.team?.name || "No Team",
      assignedTo: assigneeName,
      task: task.task || "Task",
      subtask: task.subtasks || "—",
      elements: task.elements || "—",
      createdDisplay: formatDateForDisplay(task.createdAt),
      dueDisplay: isAdviserTask && (!task.dueDate || task.dueDate === "--") ? 
                  "—" : formatDateForDisplay(task.dueDate),
      timeDisplay: isAdviserTask && (!task.dueTime || task.dueTime === "--") ? 
                   "—" : formatTime12Hour(task.dueTime),
      revision: task.revision || "No Revision",
      status: task.status || "To Do",
      methodology: task.methodology || "—",
      phase: task.phase || "Planning",
      _colId: (() => {
        const status = task.status;
        if (status === "To Do") return "todo";
        if (status === "In Progress") return "inprogress";
        if (status === "To Review") return "review";
        if (status === "Completed") return "done";
        if (status === "Missed") return "missed";
        return "todo";
      })(),
      type: task.type || null,
      dueAtMs: task.dueAtMs || null,
      taskManager: task.taskManager || "Project Manager",
      originalTask: task,
      assignees: task.assignees || [],
      comment: task.comment || "",
      fileUrl: task.fileUrl || []
    };
    
    console.log("Passing task data to Project Manager Task Board:", taskData);
    
    navigate('/projectmanager/tasks-board', {
      state: { 
        selectedTask: taskData,
        activeTab: isAdviserTask ? "adviser" : "team"
      } 
    });
  };

  // FIXED: Rows computation - properly handle team tasks
  const rowsTeam = useMemo(() => {
    console.log("Computing rowsTeam with tasks:", tasks); // DEBUG
    
    const rowsWithTasks = [];

    // Get all Project Manager tasks that are not completed
    const pmTasks = tasks.filter(t => 
      t.taskManager === "Project Manager" && 
      (t.status || "To Do") !== "Completed"
    );

    console.log("PM Tasks:", pmTasks); // DEBUG

    // Process each PM task
    pmTasks.forEach(t => {
      // Check if this is a team task
      const isTeamTask = t.isTeamTask === true || 
                        (t.assignees && t.assignees.some(a => a.uid === 'team' || a.name === 'Team'));
      
      console.log(`Task ${t.id}: isTeamTask = ${isTeamTask}, assignees =`, t.assignees); // DEBUG

      if (isTeamTask) {
        // This is a team task - show as single row
        const base = {
          key: `team-${t.id}`,
          memberUid: 'team',
          memberName: "Team",
          taskId: t.id,
          type: t.type || "--",
          task: t.task || "--",
          subtasks: t.subtasks || "--",
          elements: t.elements || "--",
          created: formatDateMonthDayYear(t?.createdAt?.toDate?.()?.toISOString()?.split("T")[0]) || "--",
          due: displayDueDate(t?.dueDate, false),
          time: displayDueTime(t?.dueTime, false),
          revision: t.revision || "No Revision",
          status: t.status || "To Do",
          phase: t.phase || "--",
          methodology: t.methodology || "--",
          existingTask: t,
          isTeamTask: true,
          canManage: isFinalRedefenseAllowed, // PM can manage team tasks only if final re-defense is allowed
        };

        const opt = optimistic['team'];
        if (opt) {
          if (opt.type !== undefined) base.type = opt.type || "--";
          if (opt.task !== undefined) base.task = opt.task || "--";
          if (opt.due !== undefined) base.due = displayDueDate(opt.due, false) || "--";
          if (opt.time !== undefined) base.time = displayDueTime(opt.time, false) || "--";
          if (opt.status !== undefined) base.status = opt.status || "To Do";
        }

        console.log("Adding team task row:", base); // DEBUG
        rowsWithTasks.push(base);
      } else {
        // This is an individual task - show per assignee
        const assignees = t.assignees || [];
        console.log(`Individual task ${t.id} has ${assignees.length} assignees`); // DEBUG
        
        assignees.forEach((a) => {
          const base = {
            key: `${t.id}-${a.uid}`,
            memberUid: a.uid,
            memberName: a.name,
            taskId: t.id,
            type: t.type || "--",
            task: t.task || "--",
            subtasks: t.subtasks || "--",
            elements: t.elements || "--",
            created: formatDateMonthDayYear(t?.createdAt?.toDate?.()?.toISOString()?.split("T")[0]) || "--",
            due: displayDueDate(t.dueDate, false),
            time: displayDueTime(t.dueTime, false),
            revision: t.revision || "No Revision",
            status: t.status || "To Do",
            phase: t.phase || "--",
            methodology: t.methodology || "--",
            existingTask: t,
            isTeamTask: false,
            canManage: isFinalRedefenseAllowed, // PM can manage individual tasks only if final re-defense is allowed
          };

          const opt = optimistic[a.uid];
          if (opt) {
            if (opt.type !== undefined) base.type = opt.type || "--";
            if (opt.task !== undefined) base.task = opt.task || "--";
            if (opt.due !== undefined) base.due = displayDueDate(opt.due, false) || "--";
            if (opt.time !== undefined) base.time = displayDueTime(opt.time, false) || "--";
            if (opt.status !== undefined) base.status = opt.status || "To Do";
          }

          console.log("Adding individual task row:", base); // DEBUG
          rowsWithTasks.push(base);
        });
      }
    });

    console.log("Final rowsWithTasks:", rowsWithTasks); // DEBUG
    return rowsWithTasks;
  }, [tasks, optimistic, isFinalRedefenseAllowed]);

  const rowsAdviser = useMemo(() => {
    const adviserTasks = tasks.filter((t) => t.taskManager === "Adviser" && (t.status || "To Do") !== "Completed");
    return adviserTasks.map((t, idx) => {
      const base = {
        key: t.id,
        taskId: t.id,
        memberUid: "",
        memberName: getTeamNameForAdviser, // Use the formatted team name instead of "Team"
        type: t?.type || "--",
        task: t?.task || "--",
        subtasks: t?.subtasks || "--",
        elements: t?.elements || "--",
        created: formatDateMonthDayYear(t?.createdAt?.toDate?.()?.toISOString()?.split("T")[0]) || "--",
        due: displayDueDate(t?.dueDate, true), // Always show "--" for adviser tasks
        time: displayDueTime(t?.dueTime, true), // Always show "--" for adviser tasks
        revision: t?.revision || "No Revision",
        status: t?.status || "To Do",
        phase: t?.phase || "--",
        methodology: t?.methodology || "--",
        existingTask: t,
        teamId: t?.team?.id || `no-team-${idx}`,
        teamName: t?.team?.name || "No Team",
        isTeamTask: true,
        // FIXED: Set canManage based on final re-defense allowance
        canManage: isFinalRedefenseAllowed // PM can manage adviser tasks status only if final re-defense is allowed
      };

      const opt = optimistic['adviser'];
      if (opt) {
        if (opt.status !== undefined) base.status = opt.status || "To Do";
      }

      return base;
    });
  }, [tasks, isFinalRedefenseAllowed, getTeamNameForAdviser, optimistic]);

  const baseRows = activeTab === "team" ? rowsTeam : rowsAdviser;

  const qLocal = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    let result = baseRows;
    
    // Apply search filter
    if (qLocal) {
      result = result.filter(
        (r) =>
          (r.memberName || "").toLowerCase().includes(qLocal) ||
          (r.type || "").toLowerCase().includes(qLocal) ||
          (r.task || "").toLowerCase().includes(qLocal) ||
          (r.subtasks || "").toLowerCase().includes(qLocal) ||
          (r.elements || "").toLowerCase().includes(qLocal) ||
          (r.created || "").toLowerCase().includes(qLocal) ||
          (r.due || "").toLowerCase().includes(qLocal) ||
          (r.time || "").toLowerCase().includes(qLocal) ||
          String(r.revision || "")
            .toLowerCase()
            .includes(qLocal) ||
          String(r.status || "")
            .toLowerCase()
            .includes(qLocal) ||
          (r.phase || "").toLowerCase().includes(qLocal) ||
          (r.methodology || "").toLowerCase().includes(qLocal)
      );
    }

    // Apply status filter
    if (filterStatus !== "All Status") {
      result = result.filter(r => r.status === filterStatus);
    }

    return result;
  }, [qLocal, baseRows, filterStatus]);

  // Firestore update helpers for inline cells - UPDATED TO MATCH FINAL DEFENSE
  const updateTaskRow = async (row, patch) => {
    if (!isFinalRedefenseAllowed) {
      alert("Final re-defense is not available yet. Please ensure final defense has a 'Re-Oral' verdict.");
      return;
    }

    if (row.taskId) {
      await updateDoc(doc(db, TASKS_COLLECTION, row.taskId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    const base = {
      status: "To Do",
      revision: "No Revision",
      createdBy: pmProfile
        ? { uid: pmProfile.uid, name: pmProfile.name, role: "Project Manager" }
        : null,
      assignees: row.memberUid
        ? [{ uid: row.memberUid, name: row.memberName }]
        : [],
      team:
        row.teamId && row.teamName
          ? { id: row.teamId, name: row.teamName }
          : teams[0]
          ? { id: teams[0].id, name: teams[0].name }
          : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(collection(db, TASKS_COLLECTION), { ...base, ...patch });
  };

  // Inline edit actions - UPDATED TO MATCH FINAL DEFENSE REAL-TIME BEHAVIOR
  const saveStatus = async (row, newStatus) => {
    if (!isFinalRedefenseAllowed) {
      alert("Final re-defense is not available yet. Please ensure final defense has a 'Re-Oral' verdict.");
      return;
    }

    const memberUid = row.isTeamTask ? 'team' : row.memberUid;
    
    // Set optimistic update immediately
    setOptimistic((prev) => ({
      ...prev,
      [memberUid]: { ...(prev[memberUid] || {}), status: newStatus || "To Do" },
    }));

    // If marking as completed, set completedAt timestamp
    const updates = { status: newStatus || "To Do" };
    if (newStatus === "Completed") {
      updates.completedAt = serverTimestamp();
    }

    try {
      await updateTaskRow(row, updates);
    } catch (error) {
      // Revert optimistic update on error
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[memberUid]?.status;
        if (Object.keys(next[memberUid] || {}).length === 0) {
          delete next[memberUid];
        }
        return next;
      });
      console.error("Error updating status:", error);
    }
  };

  const openEditTask = (row) => {
    if (!isFinalRedefenseAllowed) {
      alert("Final re-defense is not available yet. Please ensure final defense has a 'Re-Oral' verdict.");
      return;
    }
    setEditingModal({ 
      seedMember: null, 
      existingTask: row.existingTask,
      rowData: row, // Pass the row data to the dialog
      mode: activeTab
    });
  };

  const handleDeleteClick = (taskId) => {
    if (!isFinalRedefenseAllowed) {
      alert("Final re-defense is not available yet. Please ensure final defense has a 'Re-Oral' verdict.");
      return;
    }
    setDeletingId(taskId);
    setShowDeleteConfirm(true);
    setMenuOpenId(null);
  };

  const deleteTask = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, deletingId));
      setShowDeleteConfirm(false);
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
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
      {/* Final Defense Re-Oral Verdict Banner */}
      {!loadingVerdict && finalDefenseVerdict !== "Re-Oral" && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-800 mb-1">
                Final Defense Not Re-Oral
              </h3>
              <p className="text-yellow-700 text-sm">
                Final Re-Defense tasks cannot be created or managed until your team receives a "Re-Oral" verdict on Final Defense.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar — Create Task and Search on left */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isFinalRedefenseAllowed) {
                alert("Final defense must have 'Re-Oral' verdict before creating final re-defense tasks.");
                return;
              }
              setEditingModal({ seedMember: null, existingTask: null, mode: activeTab })
            }}
            disabled={!isFinalRedefenseAllowed}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white shadow transition-all ${
              isFinalRedefenseAllowed ? "hover:scale-105 active:scale-95" : "opacity-50 cursor-not-allowed"
            }`}
            style={{ backgroundColor: MAROON }}
            title={!isFinalRedefenseAllowed ? "Final re-defense not available yet" : ""}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-sm">Create Task</span>
          </button>

          {/* Reduced width search */}
          <div className="w-[180px]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 bg-white transition-colors focus-within:border-[#6A0F14] focus-within:ring-1 focus-within:ring-[#6A0F14]">
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                className="flex-1 outline-none text-sm bg-transparent"
                placeholder="Search..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filter - Keep original UI */}
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
              {filterOptions.map((status) => (
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

      {/* Modern Tab Design */}
      <div className="flex mb-6 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("team")}
          className={`relative px-6 py-3 text-sm font-medium transition-all duration-300 ease-in-out ${
            activeTab === "team" 
              ? "text-[#6A0F14] font-semibold" 
              : "text-neutral-600 hover:text-neutral-800"
          }`}
        >
          Team Tasks
          {activeTab === "team" && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#6A0F14] rounded-t-full transition-all duration-300 ease-in-out" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("adviser")}
          className={`relative px-6 py-3 text-sm font-medium transition-all duration-300 ease-in-out ${
            activeTab === "adviser" 
              ? "text-[#6A0F14] font-semibold" 
              : "text-neutral-600 hover:text-neutral-800"
          }`}
        >
          Adviser Tasks
          {activeTab === "adviser" && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#6A0F14] rounded-t-full transition-all duration-300 ease-in-out" />
          )}
        </button>
      </div>

      {/* Table - FIXED: Restore proper responsive table container */}
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
            {filtered.map((row, idx) => {
              const rowNo = idx + 1;
              const currentRevisionCount = parseRevCount(row.revision);
              const hasMaxRevisions = currentRevisionCount >= 10;
              const isMissed = row.status === "Missed";
              const isAdviserTask = activeTab === "adviser";
              
              // Check if adviser task has due date and time set
              const hasDueDateTime = isAdviserTask ? hasDueDateAndTime(row.existingTask) : true;
              
              return (
                <tr key={row.key} className="border-t border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <td className="p-3 align-top whitespace-nowrap">{rowNo}</td>
                  <td className="p-3 align-top whitespace-nowrap">
                    <div className="font-medium">{row.memberName}</div>
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">{row.type}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.task}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.subtasks}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.elements}</td>
                  <td className="p-3 align-top whitespace-nowrap">{row.created}</td>

                  {/* Due date - static display */}
                  <td className="p-3 align-top whitespace-nowrap">
                    <span>{row.due}</span>
                  </td>

                  {/* Time - static display with 12-hour format */}
                  <td className="p-3 align-top whitespace-nowrap">
                    <span>{row.time}</span>
                  </td>

                  {/* Revision - display only (not editable) */}
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

                  {/* Status - Team tasks can go up to "Completed", adviser tasks only up to "To Review" */}
                  {/* UPDATED: REAL-TIME STATUS UPDATES LIKE FINAL DEFENSE */}
                  <td className="p-3 align-top whitespace-nowrap">
                    {isMissed ? (
                      <StatusBadgeFinalRedefense
                        value={row.status || "Missed"}
                        isEditable={false}
                        disabled={true}
                      />
                    ) : (
                      <StatusBadgeFinalRedefense
                        value={row.status || "To Do"}
                        isEditable={row.canManage && hasDueDateTime && isFinalRedefenseAllowed}
                        onChange={(v) => saveStatus(row, v)}
                        statusOptions={isAdviserTask ? STATUS_OPTIONS_ADVISER : STATUS_OPTIONS_TEAM}
                      />
                    )}
                    {isAdviserTask && !hasDueDateTime && (
                      <div className="text-xs text-neutral-500 mt-1">
                        Set due date/time to enable status
                      </div>
                    )}
                    {!isFinalRedefenseAllowed && (
                      <div className="text-xs text-yellow-600 mt-1">
                        Final re-defense not available
                      </div>
                    )}
                  </td>

                  {/* Methodology column */}
                  <td className="p-3 align-top whitespace-nowrap">{row.methodology}</td>

                  <td className="p-3 align-top whitespace-nowrap">{row.phase}</td>

                  <td className="p-3 align-top text-right whitespace-nowrap">
                    {/* Different menu options for team vs adviser tasks */}
                    <div className="relative inline-block dropdown-container">
                      <button
                        className={`p-1.5 rounded-md transition-colors ${
                          isFinalRedefenseAllowed ? "hover:bg-neutral-100" : "opacity-50 cursor-not-allowed"
                        }`}
                        onClick={() => {
                          if (!isFinalRedefenseAllowed) {
                            alert("Final defense must have 'Re-Oral' verdict before managing final re-defense tasks.");
                            return;
                          }
                          setMenuOpenId(menuOpenId === row.key ? null : row.key)
                        }}
                        disabled={!isFinalRedefenseAllowed}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === row.key && (
                        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg animate-in fade-in-0 zoom-in-95">
                          <div className="flex flex-col">
                            {/* For team tasks: Show Edit option, for adviser tasks: Hide Edit option */}
                            {!isAdviserTask && (
                              <button
                                className={`w-full text-left px-3 py-2 ${
                                  hasMaxRevisions || !isFinalRedefenseAllowed
                                    ? "text-neutral-400 cursor-not-allowed" 
                                    : "hover:bg-neutral-50"
                                }`}
                                onClick={() => {
                                  if (!isFinalRedefenseAllowed) {
                                    alert("Final re-defense is not available yet. Please ensure final defense has a 'Re-Oral' verdict.");
                                    return;
                                  }
                                  if (hasMaxRevisions) {
                                    alert("Maximum revisions reached (10). Please create a new task instead of editing this one.");
                                    return;
                                  }
                                  setMenuOpenId(null);
                                  setEditDueDateTime({
                                    existingTask: row.existingTask,
                                    rowData: row, // Pass row data to the dialog
                                    isFinalRedefenseAllowed: isFinalRedefenseAllowed,
                                    lockedMethodology: lockedMethodology // Pass locked methodology
                                  });
                                }}
                                disabled={hasMaxRevisions || !isFinalRedefenseAllowed}
                                title={hasMaxRevisions ? "Maximum revisions reached - create new task" : !isFinalRedefenseAllowed ? "Final re-defense not available yet" : ""}
                              >
                                <Edit className="w-4 h-4 inline-block mr-2" />
                                Edit
                              </button>
                            )}
                            {/* Add View button */}
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                              onClick={() => {
                                setMenuOpenId(null);
                                handleViewTask(row.existingTask);
                              }}
                            >
                              <Eye className="w-4 h-4 inline-block mr-2" />
                              View
                            </button>
                            {/* UPDATED: Show Delete for both team and adviser tasks */}
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-red-600"
                              onClick={() => handleDeleteClick(row.taskId)}
                              disabled={!isFinalRedefenseAllowed}
                            >
                              <Trash2 className="w-4 h-4 inline-block mr-2" />
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

            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-neutral-500">
                  No {activeTab === "team" ? "team" : "adviser"} tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Task Modal */}
      {editingModal && (
        <EditTaskDialog
          open={!!editingModal}
          onClose={() => setEditingModal(null)}
          onSaved={() => setEditingModal(null)}
          pm={pmProfile || { uid: pmUid, name: "Project Manager" }}
          teams={teams}
          members={members}
          seedMember={editingModal?.seedMember || null}
          existingTask={editingModal?.existingTask || null}
          mode={editingModal?.mode || activeTab}
          lockedMethodology={lockedMethodology}
          rowData={editingModal?.rowData} // Pass row data to the dialog
          isFinalRedefenseAllowed={isFinalRedefenseAllowed} // Pass final re-defense allowance status
        />
      )}

      {/* Edit Due Date & Time Modal */}
      {editDueDateTime && (
        <EditDueDateTimeDialog
          open={!!editDueDateTime}
          onClose={() => setEditDueDateTime(null)}
          onSaved={() => setEditDueDateTime(null)}
          existingTask={editDueDateTime.existingTask}
          rowData={editDueDateTime.rowData} // Pass row data to the dialog
          isFinalRedefenseAllowed={isFinalRedefenseAllowed} // Pass final re-defense allowance status
          lockedMethodology={editDueDateTime.lockedMethodology} // Pass locked methodology
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingId(null);
        }}
        onConfirm={deleteTask}
        title="Delete Task?"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="No, Cancel"
      />
    </div>
  );
};

export default FinalRedefense;