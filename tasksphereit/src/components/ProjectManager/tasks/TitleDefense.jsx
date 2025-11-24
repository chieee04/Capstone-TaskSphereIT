// src/components/ProjectManager/tasks/TitleDefense.jsx
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
  ChevronDown,
  Edit,
  Users,
} from "lucide-react";

/* ===== Firebase ===== */
import { auth, db } from "../../../config/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

/* ===== Supabase ===== */
import { supabase } from "../../../config/supabase";

const MAROON = "#3B0304";
const TASKS_COLLECTION = "titleDefenseTasks";

/* ---------- Options ---------- */
const DOC_TASKS = [
  "Brainstorming",
  "Data Gathering: Internet Research",
  "Title Proposal: Concepts and Layouts",
  "Interview User/Client",
  "Collect User/Client Requirements",
  "Title Proposal: Selection of Three Titles",
  "Refining Selected Title",
  "Prepare: PowerPoint Presentation",
  "Title Defense: Mock Defense",
  "Title Defense",
  "Title Re-Defense Planning",
  "Revise Based on the Title Defense Feedback.",
  "Panel-Requested Enhancements Presentation",
  "Team Request for Advisership",
  "Re-Defense: Title Gathering",
  "Re-Defense: Refining the Selected Title",
  "Feedback Gathering",
  "Prepare: Title Re-Defense PowerPoint Presentation",
  "Title Re-Defense: Mock Defense",
  "Title Re-Defense Presentation",
  "Revise Based on the Title Re-Defense Feedback",
  "Team Request for Advership"
];
const DISCUSS_TASKS = ["Capstone Meeting"];

const STATUS_OPTIONS = ["To Do", "In Progress", "To Review", "Completed"];
const FILTER_OPTIONS = ["All Status", "To Do", "In Progress", "To Review", "Missed"];

/* ---------- Status Colors ---------- */
const STATUS_COLORS = {
  "To Do": "#FABC3F", // Yellow
  "In Progress": "#809D3C", // Green
  "To Review": "#578FCA", // Blue
  "Completed": "#AA60C8", // Purple
  "Missed": "#3B0304", // Maroon
};

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
  const currentCount = parseRevCount(prev);
  if (currentCount >= 10) {
    return "10th Revision"; // Maximum revision reached
  }
  return `${ordinal(currentCount + 1)} Revision`;
};

const isMaxRevision = (revision) => {
  return parseRevCount(revision) >= 10;
};

const StatusBadge = ({ value }) => {
  if (!value || value === "null") return <span>null</span>;
  const backgroundColor = STATUS_COLORS[value] || "#6B7280"; // Default gray
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
  value && value !== "null" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-neutral-100 border border-neutral-200">
      {value}
    </span>
  ) : (
    <span>null</span>
  );

/* ===== Supabase helpers for task files (any type) ===== */
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
              onClick={() => {
                onConfirm();
                onClose(); // Close immediately
              }}
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
}) {
  const [saving, setSaving] = useState(false);
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const today = localTodayStr();

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

  // Check if task has reached maximum revisions
  const isMaxRevisionReached = isMaxRevision(existingTask?.revision || "No Revision");
  const canSave = due && time && !isMaxRevisionReached;

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
          newRevision = nextRevision(currentRevision);
          newStatus = "To Do";
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
      onClose(); // Close immediately after successful operation
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

  // Get the correct assignee name - FIXED: Use the actual assignee from the task
  const getAssigneeName = () => {
    if (!existingTask) return "Unknown";
    
    // For team tasks, show "Team"
    if (existingTask.isTeamTask) {
      return "Team";
    }
    
    // For individual tasks, show the first assignee's name
    if (existingTask.assignees && existingTask.assignees.length > 0) {
      return existingTask.assignees[0].name || "Unknown";
    }
    
    return "Unknown";
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
              {/* Maximum Revision Warning */}
              {isMaxRevisionReached && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Maximum Revisions Reached
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>
                          This task has reached the maximum of 10 revisions. 
                          Please create a new task instead of editing this one.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Task Info - REMOVED border box styling */}
              <div className="space-y-3">
                <h3 className="font-medium text-neutral-700">Task Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Assigned:</span> {getAssigneeName()}
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
                    {isMaxRevisionReached && (
                      <span className="ml-1 text-red-600 font-semibold">(MAX)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    min={today}
                    className={`w-full rounded-lg border px-3 py-2 ${
                      isMaxRevisionReached 
                        ? "border-red-300 bg-red-50 text-red-900 cursor-not-allowed" 
                        : "border-neutral-300"
                    }`}
                    value={due}
                    onChange={(e) => {
                      if (isMaxRevisionReached) return;
                      setDue(e.target.value);
                      handleInputChange();
                    }}
                    disabled={isMaxRevisionReached}
                  />
                </div>
                <div className="col-span-6">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    step={600} // 10 minutes
                    className={`w-full rounded-lg border px-3 py-2 ${
                      isMaxRevisionReached 
                        ? "border-red-300 bg-red-50 text-red-900 cursor-not-allowed" 
                        : "border-neutral-300"
                    }`}
                    value={time}
                    onChange={(e) => {
                      if (isMaxRevisionReached) return;
                      const v = e.target.value;
                      if (!v) {
                        setTime("");
                        handleInputChange();
                        return;
                      }
                      const [H, M] = v.split(":").map(Number);
                      let mm = Math.round(M / 10) * 10;
                      let hh = H;
                      if (mm === 60) {
                        mm = 0;
                        hh = (hh + 1) % 24;
                      }
                      const snapped = `${String(hh).padStart(2, "0")}:${String(
                        mm
                      ).padStart(2, "0")}`;
                      setTime(snapped);
                      handleInputChange();
                    }}
                    onBlur={(e) => {
                      if (isMaxRevisionReached) return;
                      const v = e.target.value;
                      if (!v) return;
                      const [H, M] = v.split(":").map(Number);
                      let mm = Math.round(M / 10) * 10;
                      let hh = H;
                      if (mm === 60) {
                        mm = 0;
                        hh = (hh + 1) % 24;
                      }
                      const snapped = `${String(hh).padStart(2, "0")}:${String(
                        mm
                      ).padStart(2, "0")}`;
                      if (snapped !== v) e.target.value = snapped;
                      setTime(snapped);
                      handleInputChange();
                    }}
                    disabled={isMaxRevisionReached}
                  />
                </div>
              </div>

              {shouldShowRevisionNote() && !isMaxRevisionReached && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> Updating due date/time will add revision number and reset status to "To Do".
                  </p>
                </div>
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

/* ======= Create Task Dialog (with all fields) ======= */
function CreateTaskDialog({
  open,
  onClose,
  onSaved,
  pm,
  teams = [],
  members = [],
  seedMember,
  existingTask,
}) {
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("");
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [pickedUid, setPickedUid] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [comment, setComment] = useState("");
  const [teamId, setTeamId] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // attachments state
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const fileInputRef = useRef(null);

  const today = localTodayStr();

  useEffect(() => {
    if (!open) return;
    setTeamId(existingTask?.team?.id || teams[0]?.id || "");
    if (existingTask) {
      setType(existingTask.type || "");
      setTask(existingTask.task || "");
      setDue(existingTask.dueDate || "");
      setTime(existingTask.dueTime || "");
      setAssignees(
        (existingTask.assignees || []).map((a) => ({
          uid: a.uid,
          name: a.name,
        }))
      );
      setComment(existingTask.comment || "");

      const files = Array.isArray(existingTask.fileUrl)
        ? existingTask.fileUrl.map((f, idx) => ({
            id: f.id || f.fileName || f.url || `old-${idx}`,
            name: f.name || f.originalName || `file-${idx}`,
            fileName: f.fileName || null,
            url: f.url || null,
            uploadedAt: f.uploadedAt || null,
            size: f.size || null,
            type: f.type || null,
          }))
        : [];
      setAttachedFiles(files);
      setNewFiles([]);
      setFilesToDelete([]);
    } else {
      setType("");
      setTask("");
      setDue("");
      setTime("");
      setAssignees(
        seedMember ? [{ uid: seedMember.uid, name: seedMember.name }] : []
      );
      setComment("");
      setAttachedFiles([]);
      setNewFiles([]);
      setFilesToDelete([]);
    }
    setHasChanges(false);
  }, [open, existingTask, seedMember, teams]);

  const availableTasks = useMemo(() => {
    if (type === "Documentation") return DOC_TASKS;
    if (type === "Discussion & Review") return DISCUSS_TASKS;
    return [];
  }, [type]);

  const canSave = type && task && assignees.length > 0 && !!time;

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
      const team = teams.find((t) => t.id === teamId) || null;
      const userId =
        auth.currentUser?.uid || localStorage.getItem("uid") || "anon";

      if (filesToDelete.length > 0) {
        await Promise.allSettled(
          filesToDelete.map((f) => deleteTaskFileFromSupabase(f.fileName))
        );
      }

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

      // Check if this is a team task
      const isTeamTask = assignees.some(a => a.uid === 'team');

      // For team tasks, we don't store all individual names, just mark it as team task
      const finalAssignees = isTeamTask 
        ? [{ uid: 'team', name: 'Team' }]
        : assignees;

      // For create task dialog, always use the simple logic (no revision bump for new tasks)
      const basePayload = {
        phase: "Planning",
        type,
        task,
        fileUrl: finalFileUrl,
        dueDate: due || null,
        dueTime: time || null,
        dueAtMs: due && time ? new Date(`${due}T${time}:00`).getTime() : null,
        status: existingTask?.status || "To Do",
        revision: existingTask?.revision || "No Revision",
        assignees: finalAssignees,
        team: team ? { id: team.id, name: team.name } : null,
        comment: comment || "",
        updatedAt: serverTimestamp(),
        isTeamTask: isTeamTask,
        ...(existingTask
          ? {}
          : {
              createdAt: serverTimestamp(),
              createdBy: pm
                ? { uid: pm.uid, name: pm.name, role: "Project Manager" }
                : null,
            }),
      };

      if (existingTask?.id) {
        await updateDoc(
          doc(db, TASKS_COLLECTION, existingTask.id),
          basePayload
        );
      } else {
        await addDoc(collection(db, TASKS_COLLECTION), basePayload);
      }

      onSaved?.();
      onClose(); // Close modal immediately after successful operation
    } catch (error) {
      console.error("Error saving task:", error);
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

  const assignTeam = () => {
    // For team assignment, just add a single "Team" assignee
    setAssignees([{ uid: 'team', name: 'Team' }]);
    setHasChanges(true);
  };

  const handleInputChange = () => {
    setHasChanges(true);
  };

  // Check if "Team" is in assignees
  const hasTeamAssignee = assignees.some(a => a.uid === 'team');
  
  // Check if any individual members are assigned
  const hasIndividualAssignees = assignees.length > 0 && !hasTeamAssignee;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain">
        {/* backdrop */}
        <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

        {/* panel - centered with reduced width */}
        <div className="relative z-10 w-full max-w-[700px]"> {/* Reduced from 980px to 700px */}
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
            {/* header - UPDATED with border below header */}
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

            {/* CONTENT — scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4"> {/* Reduced spacing */}
              {/* Project Phase only - REMOVED Team field */}
              <div className="grid grid-cols-12 gap-3"> {/* Reduced gap */}
                <div className="col-span-6"> {/* Reduced from col-span-6 */}
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Project Phase
                  </label>
                  <input
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-neutral-100 text-sm" // Added text-sm
                    value="Planning"
                    disabled
                    readOnly
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3"> {/* Reduced gap */}
                <div className="col-span-4"> {/* Reduced from col-span-4 */}
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Task Type
                  </label>
                  <select
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" // Added text-sm
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setTask("");
                      handleInputChange();
                    }}
                  >
                    <option value="">Select</option>
                    <option>Documentation</option>
                    <option>Discussion & Review</option>
                  </select>
                </div>
                <div className="col-span-8"> {/* Reduced from col-span-8 */}
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Tasks
                  </label>
                  <select
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" // Added text-sm
                    value={task}
                    onChange={(e) => {
                      setTask(e.target.value);
                      handleInputChange();
                    }}
                    disabled={!type}
                  >
                    <option value="">
                      {type ? "Select task" : "Select Task Type first"}
                    </option>
                    {(type === "Documentation"
                      ? DOC_TASKS
                      : type === "Discussion & Review"
                      ? DISCUSS_TASKS
                      : []
                    ).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3"> {/* Reduced gap */}
                <div className="col-span-4"> {/* Reduced from col-span-4 */}
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    min={today}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" // Added text-sm
                    value={due}
                    onChange={(e) => {
                      setDue(e.target.value);
                      handleInputChange();
                    }}
                  />
                </div>
                <div className="col-span-4"> {/* Reduced from col-span-4 */}
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    step={600} // 10 minutes
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" // Added text-sm
                    value={time}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setTime("");
                        handleInputChange();
                        return;
                      }
                      const [H, M] = v.split(":").map(Number);
                      let mm = Math.round(M / 10) * 10;
                      let hh = H;
                      if (mm === 60) {
                        mm = 0;
                        hh = (hh + 1) % 24;
                      }
                      const snapped = `${String(hh).padStart(2, "0")}:${String(
                        mm
                      ).padStart(2, "0")}`;
                      setTime(snapped);
                      handleInputChange();
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const [H, M] = v.split(":").map(Number);
                      let mm = Math.round(M / 10) * 10;
                      let hh = H;
                      if (mm === 60) {
                        mm = 0;
                        hh = (hh + 1) % 24;
                      }
                      const snapped = `${String(hh).padStart(2, "0")}:${String(
                        mm
                      ).padStart(2, "0")}`;
                      if (snapped !== v) e.target.value = snapped;
                      setTime(snapped);
                      handleInputChange();
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Assigned
                </label>
                <AssigneesPicker
                  members={[...members, pm].filter(Boolean)} // Include PM in assignable members
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
                />
              </div>

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
                      className="w-full resize-none px-3 py-2 text-sm outline-none" // Added text-sm
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        handleInputChange();
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-2 bottom-2 p-1 rounded hover:bg-neutral-100"
                      title="Attach"
                      onClick={handleAttachClick}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      className="hidden"
                      type="file"
                      multiple
                      onChange={onFilePicked}
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
                        >
                          <X className="w-4 h-4 text-neutral-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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

/* Small subcomponent to keep the dialog tidy */
function AssigneesPicker({
  members,
  pickedUid,
  setPickedUid,
  assignees,
  setAssignees,
  onAssignTeam,
  hasTeamAssignee,
  hasIndividualAssignees,
}) {
  return (
    <>
      <div className="flex gap-2">
        <select
          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
            hasTeamAssignee 
              ? "border-neutral-300 bg-neutral-100 text-neutral-500 cursor-not-allowed" 
              : "border-neutral-300"
          }`}
          value={pickedUid}
          onChange={(e) => setPickedUid(e.target.value)}
          disabled={hasTeamAssignee}
        >
          <option value="">Select member</option>
          {members.map((m) => (
            <option 
              key={m.uid} 
              value={m.uid}
              disabled={hasTeamAssignee}
            >
              {m.name}
            </option>
          ))}
          <option 
            value="team"
            disabled={hasIndividualAssignees}
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
          disabled={!pickedUid || hasTeamAssignee}
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

/* ===== Status component with colors ===== */
const StatusBadgeOralDefense = ({ value, isEditable, onChange, disabled = false }) => {
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
        {STATUS_OPTIONS.map((status) => (
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

const RevisionSelectOralDefense = ({ value, onChange, disabled }) => (
  <select
    className={`text-[12px] leading-tight font-medium border border-neutral-300 rounded px-2.5 py-0.5 bg-white ${
      disabled ? "opacity-60 cursor-not-allowed" : ""
    }`}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
  >
    <option>No Revision</option>
    <option>Revision 1</option>
    <option>Revision 2</option>
    <option>Revision 3</option>
  </select>
);

/* ================= Main ================= */
const TitleDefense = ({ onBack }) => {
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState(null);
  const [createModal, setCreateModal] = useState(null);
  const [editDueDateTime, setEditDueDateTime] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [optimistic, setOptimistic] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // current PM
  const pmUid = auth.currentUser?.uid || localStorage.getItem("uid") || "";
  const [pmProfile, setPmProfile] = useState(null);

  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);

  const today = localTodayStr();

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

  /* PM profile */
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

  /* Teams + members of this PM */
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

  /* Tasks created by this PM (live) */
  useEffect(() => {
    if (!pmUid) return;
    const unsub = onSnapshot(
      query(
        collection(db, TASKS_COLLECTION),
        where("createdBy.uid", "==", pmUid),
        orderBy("createdAt", "desc")
      ),
      async (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTasks(docs);

        // Auto-update overdue tasks
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

        // clear optimistic overlays
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

  /* Build table rows - UPDATED to match OralDefense behavior */
  const rows = useMemo(() => {
    const rowsWithTasks = [];

    // Handle team tasks - show as single row with "Team" as assignee
    const teamTasks = tasks.filter(t => 
      t.isTeamTask && 
      (t.status || "To Do") !== "Completed"
    );
    
    teamTasks.forEach(t => {
      const base = {
        key: `team-${t.id}`,
        memberUid: 'team',
        memberName: "Team",
        taskId: t.id,
        type: t.type || "null",
        task: t.task || "null",
        created: formatDateMonthDayYear(t?.createdAt?.toDate?.()?.toISOString()?.split("T")[0]) || "null",
        due: formatDateMonthDayYear(t.dueDate) || "null",
        time: formatTime12Hour(t.dueTime) || "null",
        revision: t.revision || "No Revision",
        status: t.status || "To Do",
        phase: t.phase || "Planning",
        existingTask: t,
        isTeamTask: true,
        canManage: true, // PM can always manage team tasks
      };

      const opt = optimistic['team'];
      if (opt) {
        if (opt.type !== undefined) base.type = opt.type || "null";
        if (opt.task !== undefined) base.task = opt.task || "null";
        if (opt.due !== undefined) base.due = formatDateMonthDayYear(opt.due) || "null";
        if (opt.time !== undefined) base.time = formatTime12Hour(opt.time) || "null";
        if (opt.status !== undefined) base.status = opt.status || "To Do";
      }

      rowsWithTasks.push(base);
    });

    // Handle individual tasks - show per assignee
    const allMembers = [...members];
    if (pmProfile && !members.some(m => m.uid === pmProfile.uid)) {
      allMembers.push(pmProfile);
    }

    allMembers.forEach((m) => {
      const relatedTasks = tasks.filter(
        (t) =>
          !t.isTeamTask && // Exclude team tasks since we already handled them
          (t.assignees || []).some((a) => a.uid === m.uid) &&
          (t.status || "To Do") !== "Completed"
      );

      relatedTasks.forEach((t) => {
        const base = {
          key: `${m.uid}-${t.id}`,
          memberUid: m.uid,
          memberName: m.name,
          taskId: t.id,
          type: t.type || "null",
          task: t.task || "null",
          created: formatDateMonthDayYear(t?.createdAt?.toDate?.()?.toISOString()?.split("T")[0]) || "null",
          due: formatDateMonthDayYear(t.dueDate) || "null",
          time: formatTime12Hour(t.dueTime) || "null",
          revision: t.revision || "No Revision",
          status: t.status || "To Do",
          phase: t.phase || "Planning",
          existingTask: t,
          isTeamTask: false,
          canManage: true, // PM can always manage individual tasks
        };

        const opt = optimistic[m.uid];
        if (opt) {
          if (opt.type !== undefined) base.type = opt.type || "null";
          if (opt.task !== undefined) base.task = opt.task || "null";
          if (opt.due !== undefined) base.due = formatDateMonthDayYear(opt.due) || "null";
          if (opt.time !== undefined) base.time = formatTime12Hour(opt.time) || "null";
          if (opt.status !== undefined) base.status = opt.status || "To Do";
        }

        rowsWithTasks.push(base);
      });
    });

    return rowsWithTasks;
  }, [members, tasks, optimistic, pmProfile]);

  const filtered = useMemo(() => {
    let result = rows;
    
    // Apply search filter
    const s = q.trim().toLowerCase();
    if (s) {
      result = result.filter(
        (r) =>
          r.memberName.toLowerCase().includes(s) ||
          r.type.toLowerCase().includes(s) ||
          r.task.toLowerCase().includes(s) ||
          r.created.toLowerCase().includes(s) ||
          r.due.toLowerCase().includes(s) ||
          r.time.toLowerCase().includes(s) ||
          String(r.revision).toLowerCase().includes(s) ||
          String(r.status).toLowerCase().includes(s) ||
          r.phase.toLowerCase().includes(s)
      );
    }

    // Apply status filter
    if (filterStatus !== "All Status") {
      result = result.filter(r => r.status === filterStatus);
    }

    return result;
  }, [q, rows, filterStatus]);

  /* Check if task is missed */
  const isTaskMissed = (row) => {
    if (row.status === "Missed") return true;
    
    // Check if due date/time has passed
    if (row.existingTask?.dueDate && row.existingTask?.dueTime) {
      const dueDateTime = new Date(`${row.existingTask.dueDate}T${row.existingTask.dueTime}:00`);
      return dueDateTime < new Date();
    }
    
    return false;
  };

  /* Helpers */
  const currentVal = (row, field) => {
    const memberUid = row.isTeamTask ? 'team' : row.memberUid;
    const opt = optimistic[memberUid];
    const v = (opt && opt[field]) !== undefined ? opt[field] : row[field];
    return v && v !== "null" ? v : "";
  };

  const upsertForMember = async (row, patch, optimisticPatch) => {
    const memberUid = row.isTeamTask ? 'team' : row.memberUid;
    
    setOptimistic((prev) => ({
      ...prev,
      [memberUid]: { ...(prev[memberUid] || {}), ...optimisticPatch },
    }));

    const base = {
      phase: "Planning",
      status: "To Do",
      revision: "No Revision",
      createdBy: pmProfile
        ? { uid: pmProfile.uid, name: pmProfile.name, role: "Project Manager" }
        : null,
      assignees: row.isTeamTask 
        ? [{ uid: 'team', name: 'Team' }]
        : [{ uid: row.memberUid, name: row.memberName }],
      team: teams[0] ? { id: teams[0].id, name: teams[0].name } : null,
      isTeamTask: row.isTeamTask || false,
    };

    if (row.taskId) {
      await updateDoc(doc(db, TASKS_COLLECTION, row.taskId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, TASKS_COLLECTION), {
        ...base,
        ...patch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  /* Inline editors */
  const startEdit = (row, field) => {
    // Check if max revision reached - disable editing for due date and time
    if ((field === "due" || field === "time") && isMaxRevision(row.revision)) {
      return;
    }
    
    // cascade rules
    if (field === "task" && (!row.type || row.type === "null")) return;
    if (field === "due" && (!row.task || row.task === "null")) return;
    if (field === "time" && (!row.due || row.due === "null")) return;
    setEditingCell({ key: row.key, field });
  };
  const stopEdit = () => setEditingCell(null);

  const saveType = async (row, newType) => {
    await upsertForMember(
      row,
      { type: newType || null, task: null },
      { type: newType || "null", task: "null" }
    );
    stopEdit();
  };

  const saveTask = async (row, newTask) => {
    await upsertForMember(
      row,
      { task: newTask || null },
      { task: newTask || "null" }
    );
    stopEdit();
  };

  const saveDue = async (row, newDate) => {
    // Check if max revision reached
    if (isMaxRevision(row.revision)) {
      stopEdit();
      return;
    }

    const time = row.existingTask?.dueTime || "";
    const dueAtMs =
      newDate && time ? new Date(`${newDate}T${time}:00`).getTime() : null;

    // bump revision if changed
    const changed = (row.existingTask?.dueDate || "") !== (newDate || "");
    const rev = changed ? nextRevision(row.revision) : row.revision;

    // If task was missed and new date is in future, reset status to "To Do"
    let newStatus = row.status;
    if (row.status === "Missed" && dueAtMs && dueAtMs > Date.now()) {
      newStatus = "To Do";
    }

    await upsertForMember(
      row,
      {
        dueDate: newDate || null,
        dueAtMs,
        ...(changed ? { revision: rev } : {}),
        ...(newStatus !== row.status ? { status: newStatus } : {}),
      },
      { 
        due: newDate || "null", 
        ...(newDate ? {} : { time: "null" }),
        ...(newStatus !== row.status ? { status: newStatus } : {})
      }
    );
    stopEdit();
  };

  const saveTime = async (row, newTime) => {
    // Check if max revision reached
    if (isMaxRevision(row.revision)) {
      stopEdit();
      return;
    }

    const due = row.existingTask?.dueDate || "";
    const dueAtMs =
      due && newTime ? new Date(`${due}T${newTime}:00`).getTime() : null;

    // bump revision if changed
    const changed = (row.existingTask?.dueTime || "") !== (newTime || "");
    const rev = changed ? nextRevision(row.revision) : row.revision;

    // If task was missed and new time is in future, reset status to "To Do"
    let newStatus = row.status;
    if (row.status === "Missed" && dueAtMs && dueAtMs > Date.now()) {
      newStatus = "To Do";
    }

    await upsertForMember(
      row,
      {
        dueTime: newTime || null,
        dueAtMs,
        ...(changed ? { revision: rev } : {}),
        ...(newStatus !== row.status ? { status: newStatus } : {}),
      },
      { 
        time: newTime || "null",
        ...(newStatus !== row.status ? { status: newStatus } : {})
      }
    );
    stopEdit();
  };

  const saveStatus = async (row, newStatus) => {
    await upsertForMember(
      row,
      { status: newStatus || "To Do" },
      { status: newStatus || "To Do" }
    );
    stopEdit();
  };

  const handleDeleteClick = (taskId) => {
    setTaskToDelete(taskId);
    setShowDeleteConfirm(true);
    setMenuOpenId(null);
  };

  const deleteTask = async () => {
    if (!taskToDelete) return;
    setDeletingId(taskToDelete);
    
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, taskToDelete));
    } catch (error) {
      console.error("Error deleting task:", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Toolbar — Create Task and Search on left, Filter on right */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCreateModal({ seedMember: null, existingTask: null })
            }
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white shadow"
            style={{ backgroundColor: MAROON }}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-sm">Create Task</span>
          </button>

          {/* Reduced width search */}
          <div className="w-[180px]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 bg-white">
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                className="flex-1 outline-none text-sm"
                placeholder="Search..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filter moved to right side */}
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

      {/* OralDefense style table - REMOVED overflow constraints */}
      <div className="w-full rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left p-3">NO</th>
              <th className="text-left p-3">Assigned</th>
              <th className="text-left p-3">Task Type</th>
              <th className="text-left p-3">Task</th>
              <th className="text-left p-3">Date Created</th>
              <th className="text-left p-3">Due Date</th>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Revision NO</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Project Phase</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => {
              const rowNo = idx + 1;
              const isEditingType = editingCell?.key === row.key && editingCell?.field === "type";
              const isEditingTask = editingCell?.key === row.key && editingCell?.field === "task";
              const isEditingDue = editingCell?.key === row.key && editingCell?.field === "due";
              const isEditingTime = editingCell?.key === row.key && editingCell?.field === "time";
              const isEditingStatus = editingCell?.key === row.key && editingCell?.field === "status";

              const taskOptions = row.type === "Documentation" ? DOC_TASKS : row.type === "Discussion & Review" ? DISCUSS_TASKS : [];
              const canEditDue = row.task !== "null";
              const canEditTime = row.due !== "null";
              const isMissed = isTaskMissed(row);
              const isMaxRevisionReached = isMaxRevision(row.revision);

              return (
                <tr key={row.key} className="border-t border-neutral-200">
                  <td className="p-3 align-top">{rowNo}</td>
                  <td className="p-3 align-top">
                    <div className="font-medium">{row.memberName}</div>
                  </td>

                  {/* Task Type */}
                  <td
                    className="p-3 align-top"
                    onDoubleClick={() => row.canManage && startEdit(row, "type")}
                  >
                    {isEditingType ? (
                      <select
                        autoFocus
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm bg-white"
                        defaultValue={row.type === "null" ? "" : row.type}
                        onBlur={(e) => saveType(row, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") stopEdit();
                        }}
                      >
                        <option value="">null</option>
                        <option>Documentation</option>
                        <option>Discussion & Review</option>
                      </select>
                    ) : (
                      <span>{row.type}</span>
                    )}
                  </td>

                  {/* Task */}
                  <td
                    className={`p-3 align-top ${
                      row.type === "null" ? "text-neutral-400 cursor-not-allowed" : ""
                    }`}
                    onDoubleClick={() => row.canManage && startEdit(row, "task")}
                    title={row.type === "null" ? "Set Task Type first" : ""}
                  >
                    {isEditingTask ? (
                      <select
                        autoFocus
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm bg-white"
                        defaultValue={row.task === "null" ? "" : row.task}
                        onBlur={(e) => saveTask(row, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") stopEdit();
                        }}
                      >
                        <option value="">null</option>
                        {taskOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{row.task}</span>
                    )}
                  </td>

                  <td className="p-3 align-top">{row.created}</td>

                  {/* Due Date */}
                  <td
                    className={`p-3 align-top ${
                      !canEditDue || isMaxRevisionReached ? "text-neutral-400 cursor-not-allowed" : ""
                    }`}
                    onDoubleClick={() => row.canManage && canEditDue && !isMaxRevisionReached && startEdit(row, "due")}
                    title={!canEditDue ? "Set Task first" : isMaxRevisionReached ? "Maximum revisions reached. Create a new task." : ""}
                  >
                    {isEditingDue ? (
                      <input
                        type="date"
                        min={today}
                        autoFocus
                        className="w-[150px] rounded border border-neutral-300 px-2 py-1 text-sm bg-white"
                        defaultValue={row.existingTask?.dueDate || ""}
                        onBlur={(e) => saveDue(row, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") stopEdit();
                        }}
                      />
                    ) : (
                      <span>{row.due}</span>
                    )}
                  </td>

                  {/* Time */}
                  <td
                    className={`p-3 align-top ${
                      !canEditTime || isMaxRevisionReached ? "text-neutral-400 cursor-not-allowed" : ""
                    }`}
                    onDoubleClick={() => row.canManage && canEditTime && !isMaxRevisionReached && startEdit(row, "time")}
                    title={!canEditTime ? "Set Due Date first" : isMaxRevisionReached ? "Maximum revisions reached. Create a new task." : ""}
                  >
                    {isEditingTime ? (
                      <input
                        type="time"
                        step="600"
                        autoFocus
                        className="w-[120px] rounded border border-neutral-300 px-2 py-1 text-sm bg-white"
                        defaultValue={row.existingTask?.dueTime || ""}
                        onBlur={(e) => saveTime(row, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") stopEdit();
                        }}
                      />
                    ) : (
                      <span>{row.time}</span>
                    )}
                  </td>

                  <td className="p-3 align-top">
                    <div className="flex items-center gap-1">
                      <RevisionPill value={row.revision} />
                      {isMaxRevisionReached && (
                        <span className="text-xs text-red-600 font-semibold">MAX</span>
                      )}
                    </div>
                  </td>

                  {/* Status - Shows colored badge when closed, white background when dropdown is open */}
                  <td className="p-3 align-top">
                    {isMissed ? (
                      <StatusBadgeOralDefense
                        value={row.status || "Missed"}
                        isEditable={false}
                        disabled={true}
                      />
                    ) : (
                      <StatusBadgeOralDefense
                        value={row.status || "To Do"}
                        isEditable={row.canManage}
                        onChange={(v) => saveStatus(row, v)}
                      />
                    )}
                  </td>

                  <td className="p-3 align-top">{row.phase}</td>

                  <td className="p-3 align-top text-right">
                    {row.canManage ? (
                      <div className="relative inline-block dropdown-container">
                        <button
                          className="p-1.5 rounded-md hover:bg-neutral-100"
                          onClick={() =>
                            setMenuOpenId(menuOpenId === row.key ? null : row.key)
                          }
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpenId === row.key && (
                          <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg">
                            <div className="flex flex-col">
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => {
                                  if (isMaxRevisionReached) return;
                                  setMenuOpenId(null);
                                  setEditDueDateTime(row.existingTask);
                                }}
                                disabled={isMaxRevisionReached}
                                title={isMaxRevisionReached ? "Maximum revisions reached. Create a new task." : ""}
                              >
                                Edit
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setCreateModal({ seedMember: null, existingTask: row.existingTask });
                                }}
                              >
                                View
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-red-600 disabled:opacity-50"
                                disabled={!row.taskId || deletingId === row.taskId}
                                onClick={() => handleDeleteClick(row.taskId)}
                              >
                                {deletingId === row.taskId ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Deleting…
                                  </span>
                                ) : (
                                  "Delete"
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">View Only</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-neutral-500">
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Task Modal */}
      <CreateTaskDialog
        open={!!createModal}
        onClose={() => setCreateModal(null)}
        onSaved={() => setCreateModal(null)}
        pm={pmProfile || { uid: pmUid, name: "Project Manager" }}
        teams={teams}
        members={members}
        seedMember={createModal?.seedMember || null}
        existingTask={createModal?.existingTask || null}
      />

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
        onConfirm={deleteTask}
        title="Delete Task?"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="No, Cancel"
      />
    </div>
  );
};

export default TitleDefense;