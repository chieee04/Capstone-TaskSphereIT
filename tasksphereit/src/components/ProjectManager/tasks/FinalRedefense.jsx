// src/components/ProjectManager/tasks/FinalRedefense.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  UserCircle2,
  Paperclip,
  X,
  Loader2,
  Trash2,
  AlertCircle,
} from "lucide-react";

/* ===== Firebase (Auth + Firestore + Storage) ===== */
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
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

/* ===== Supabase (Storage) ===== */
import { supabase } from "../../../config/supabase";

const MAROON = "#6A0F14";
const FINAL_REDEFENSE_TASKS_COLLECTION = "finalRedefenseTasks";

/* ---------- Storage switches & constants ---------- */
const ENABLE_SUPABASE =
  !!supabase && typeof supabase.storage?.from === "function";

const SUPABASE_ATTACH_BUCKET =
  import.meta.env.VITE_SUPABASE_ATTACH_BUCKET || "task-attachments";

const FIREBASE_ATTACH_ROOT =
  import.meta.env.VITE_FIREBASE_ATTACH_ROOT || "attachments/finalRedefense";

/* ---------- UI helpers ---------- */
const ModeSwitch = ({ mode, setMode }) => (
  <div className="inline-flex rounded-md border border-neutral-300 overflow-hidden">
    <button
      onClick={() => setMode("team")}
      className={`px-3 py-1.5 text-sm font-medium ${
        mode === "team" ? "text-white" : "text-neutral-700"
      }`}
      style={{ background: mode === "team" ? MAROON : "white" }}
    >
      Team
    </button>
    <button
      onClick={() => setMode("adviser")}
      className={`px-3 py-1.5 text-sm font-medium border-l border-neutral-300 ${
        mode === "adviser" ? "text-white" : "text-neutral-700"
      }`}
      style={{ background: mode === "adviser" ? MAROON : "white" }}
    >
      Adviser Tasks
    </button>
  </div>
);

const StatusBadge = ({ value, isEditable, onChange }) => {
  const statusColors = {
    "To Do": "bg-[#D9A81E] text-white",
    "To Review": "bg-[#6FA8DC] text-white",
    "In Progress": "bg-[#7C9C3B] text-white",
    Completed: "bg-[#6A0F14] text-white",
  };

  if (!value || value === "--") return <span>--</span>;

  return isEditable ? (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium border-none bg-white shadow-md cursor-pointer"
    >
      {Object.keys(statusColors).map((status) => (
        <option
          key={status}
          value={status}
          className={`${statusColors[status]}`}
        >
          {status}
        </option>
      ))}
    </select>
  ) : (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium ${
        statusColors[value] || "bg-neutral-200"
      }`}
    >
      {value}
    </span>
  );
};

const RevisionSelect = ({ value, onChange, disabled }) => (
  <select
    className={`text-[12px] leading-tight font-medium border border-neutral-300 rounded-lg px-2.5 py-0.5 bg-white ${
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

/* -------------------- METHODOLOGIES / PHASES / TYPES / TASKS (from your doc) -------------------- */
/* Methodologies */
const METHODOLOGIES = [
  "Agile",
  "Extreme Programming (XP)",
  "Rapid Application Development (RAD)",
  "Prototyping",
  "Spiral",
];

/* Phases by Methodology */
const PHASE_OPTIONS = {
  Agile: ["Develop", "Test", "Deploy", "Review"],
  "Extreme Programming (XP)": ["Coding", "Testing", "Deploy", "Listening"],
  "Rapid Application Development (RAD)": [
    "Construction",
    "System Development",
    "Cutover",
  ],
  Prototyping: ["Refining Prototype", "Implement Product & Maintain"],
  Spiral: ["Engineering", "System Development", "Evaluate"],
};

/* Task Types by Methodology */
const TYPES_BY_METHODOLOGY = {
  Agile: [
    "Documentation",
    "System Development",
    "Test",
    "Deploy",
    "Review",
    "Discussion & Review",
  ],
  "Extreme Programming (XP)": [
    "Documentation",
    "System Development",
    "Testing",
    "Deploy",
    "Listening",
    "Discussion & Review",
  ],
  "Rapid Application Development (RAD)": [
    "Documentation",
    "System Development",
    "Cutover",
    "Discussion & Review",
  ],
  Prototyping: [
    "Documentation",
    "Implement Product & Maintain",
    "Discussion & Review",
  ],
  Spiral: [
    "Documentation",
    "System Development",
    "Evaluate",
    "Discussion & Review",
  ],
};

/* Common groups to avoid duplication (summarized from the doc’s tables) */
const DOC_REPOLISH = [
  "Re-Polishing: Chapter 1",
  "Re-Polishing: Chapter 2",
  "Re-Polishing: Chapter 3",
  "Re-Polishing: Chapter 4",
  "Re-Polishing: Development",
  "Re-Polishing: Verification and Testing",
  "Re-Polishing: Implementation Plan",
  "Re-Polishing: Installation Process",
  "Re-Polishing: Chapter 5",
  "Re-Polishing Supporting Sections",
  "Review Documentation & System Details",
];

const QA_LIST = [
  "Re-Defense System QA",
  "Unit Testing",
  "Compatibility Testing",
  "Performance Testing",
  "Stress Testing",
  "Load Testing",
  "Concurrent Testing",
  "Pacing Time",
  "Response Time",
  "Network Testing",
];

const DISCUSS_PREP = [
  "Capstone Meeting",
  "Adviser Consultation",
  "Meeting with the User/Client",
  "Final Re-Defense Preparation: System Testing Request Letter",
  "PowerPoint Presentation",
  "Mock Defense",
  "Manuscript Printing",
];

/* Tasks by Methodology + Type (top-level tasks from your tables) */
const TASK_SEEDS = {
  Agile: {
    Documentation: [...DOC_REPOLISH, "Re-Defense: Manuscript Submission"],
    "System Development": [
      "UI Enhancement",
      "Functionality Enhancement",
      "Bug Fixing",
    ],
    Test: [...QA_LIST, "Bug Fixing and Final Adjustments"],
    Deploy: ["Patch Update"],
    Review: [
      "Review Users Feedback",
      "Final Re-Defense",
      "Final Re-Defense Feedback Integration",
      "Manuscript Re-Submission for AI and Plagiarism Check",
    ],
    "Discussion & Review": [...DISCUSS_PREP],
  },

  "Extreme Programming (XP)": {
    Documentation: [...DOC_REPOLISH, "Re-Defense: Manuscript Submission"],
    "System Development": [
      "Iterative UI Refinement",
      "Continuous Feature Improvement",
      "Ongoing Refactoring and Defect Resolution",
    ],
    Testing: [...QA_LIST, "Bug Fixing and Final Adjustments", "Patch Update"],
    Deploy: ["Patch Update"],
    Listening: [
      "Review Users Feedback",
      "Gather Users/Client Feedback",
      "Finalization of the System",
      "Final Re-Defense",
      "Final Re-Defense Feedback Integration",
      "Manuscript Re-Submission for AI and Plagiarism Check",
    ],
    "Discussion & Review": [...DISCUSS_PREP],
  },

  "Rapid Application Development (RAD)": {
    Documentation: [...DOC_REPOLISH, "Re-Defense: Manuscript Submission"],
    "System Development": [
      "UI Enhancement",
      "Functionality Enhancement",
      "Bug Fixing",
      ...QA_LIST,
      "Bug Fixing and Final Adjustments",
    ],
    Cutover: [
      "Patch Update",
      "System Update Orientation for End Users",
      "Review Users Feedback",
      "System Completion and Cutover Activities",
      "Final Re-Defense",
      "Final Re-Defense Feedback Integration",
      "Manuscript Re-Submission for AI and Plagiarism Check",
    ],
    "Discussion & Review": [...DISCUSS_PREP],
  },

  Prototyping: {
    Documentation: [
      "Final Defense Response: UI Polishing & Functional Optimization",
      ...DOC_REPOLISH,
      "Re-Defense: Manuscript Submission",
    ],
    "Implement Product & Maintain": [
      "Improved visual design and layout",
      "Feature & Workflow Improvements",
      "Bug Fixing",
      ...QA_LIST,
      "Bug Fixing and Final Adjustments",
      "System Patch",
      "Review Users Feedback",
      "Finalization of the System",
      "Final Re-Defense",
      "Final Re-Defense Feedback Integration",
      "Manuscript Re-Submission for AI and Plagiarism Check",
    ],
    "Discussion & Review": [...DISCUSS_PREP],
  },

  Spiral: {
    Documentation: [...DOC_REPOLISH, "Re-Defense: Manuscript Submission"],
    "System Development": [
      "Refine User Interface Based on Feedback",
      "Feature Improvement Implementation",
      "System Issue Resolution",
      ...QA_LIST,
      "Bug Fixing and Final Adjustments",
      "Patch Update",
    ],
    Evaluate: [
      "Review Users Feedback",
      "Finalization of the System",
      "Final Re-Defense",
      "Final Re-Defense Feedback Integration",
      "Manuscript Re- Submission for AI and Plagiarism Check",
    ],
    "Discussion & Review": [...DISCUSS_PREP],
  },
};

/* ---------- Attachment helpers ---------- */
const slugifyName = (name = "") =>
  name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "_");

async function uploadToSupabase(file, { teamId = "no-team" } = {}) {
  const stamp = Date.now();
  const path = `finalRedefense/${teamId}/${stamp}_${slugifyName(file.name)}`;

  const { error } = await supabase.storage
    .from(SUPABASE_ATTACH_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(SUPABASE_ATTACH_BUCKET)
    .getPublicUrl(path);

  return {
    provider: "supabase",
    bucket: SUPABASE_ATTACH_BUCKET,
    path,
    url: data?.publicUrl || "",
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  };
}

async function uploadToFirebase(file, { teamId = "no-team" } = {}) {
  const storage = getStorage();
  const stamp = Date.now();
  const path = `${FIREBASE_ATTACH_ROOT}/${teamId}/${stamp}_${slugifyName(
    file.name
  )}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);
  return {
    provider: "firebase",
    path,
    url,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  };
}

async function uploadAttachmentSmart(file, { teamId }) {
  if (ENABLE_SUPABASE) {
    try {
      return await uploadToSupabase(file, { teamId });
    } catch {
      return await uploadToFirebase(file, { teamId });
    }
  }
  return await uploadToFirebase(file, { teamId });
}

/* ======= Edit/Create Task Dialog (SCROLLABLE + PM controls due/time) ======= */
function EditTaskDialog({
  open,
  onClose,
  onSaved,
  pm,
  teams = [],
  members = [],
  seedMember,
  existingTask,
  mode,
}) {
  const [saving, setSaving] = useState(false);

  const [teamId, setTeamId] = useState("");
  const [methodology, setMethodology] = useState("");
  const [phase, setPhase] = useState("");
  const [type, setType] = useState("");
  const [task, setTask] = useState("");
  const [subtask, setSubtask] = useState("");
  const [element, setElement] = useState("");
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [pickedUid, setPickedUid] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [comment, setComment] = useState("");

  // attachments
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setTeamId(existingTask?.team?.id || teams[0]?.id || "");
    if (existingTask) {
      setMethodology(existingTask.methodology || "");
      setPhase(existingTask.phase || "");
      setType(existingTask.type || "");
      setTask(existingTask.task || "");
      setSubtask(existingTask.subtask || "");
      setElement(existingTask.element || "");
      setDue(existingTask.dueDate || "");
      setTime(existingTask.dueTime || "");
      setAssignees(
        (existingTask.assignees || []).map((a) => ({
          uid: a.uid,
          name: a.name,
        }))
      );
      setComment(existingTask.comment || "");
      setAttachments(
        Array.isArray(existingTask.attachments) ? existingTask.attachments : []
      );
    } else {
      setMethodology("");
      setPhase("");
      setType("");
      setTask("");
      setSubtask("");
      setElement("");
      setDue("");
      setTime("");
      setAssignees(
        seedMember ? [{ uid: seedMember.uid, name: seedMember.name }] : []
      );
      setComment("");
      setAttachments([]);
    }
    setUploadErr("");
  }, [open, existingTask, seedMember, teams]);

  const availablePhases = useMemo(
    () => (methodology ? PHASE_OPTIONS[methodology] || [] : []),
    [methodology]
  );
  const typesForMethod = useMemo(
    () => (methodology ? TYPES_BY_METHODOLOGY[methodology] || [] : []),
    [methodology]
  );

  const canSave =
    teamId && methodology && phase && type && task && assignees.length > 0;

  const addAssignee = () => {
    if (!pickedUid) return;
    const found = members.find((m) => m.uid === pickedUid);
    if (!found) return;
    if (!assignees.some((a) => a.uid === pickedUid))
      setAssignees((arr) => [...arr, found]);
    setPickedUid("");
  };
  const removeAssignee = (uid) =>
    setAssignees((arr) => arr.filter((a) => a.uid !== uid));

  const handleAttachClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setUploading(true);
      setUploadErr("");
      try {
        const uploaded = [];
        for (const f of files) {
          const meta = await uploadAttachmentSmart(f, {
            teamId: teamId || "no-team",
          });
          uploaded.push(meta);
        }
        setAttachments((prev) => [...prev, ...uploaded]);
      } catch (err) {
        setUploadErr(String(err?.message || err || "Upload failed"));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const removeAttachment = (idx) => {
    setAttachments((list) => list.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const team = teams.find((t) => t.id === teamId) || null;
      const taskManager = mode === "adviser" ? "Adviser" : "Project Manager";
      const dueAtMs =
        due && time ? new Date(`${due}T${time}:00`).getTime() : null;

      const payload = {
        methodology,
        phase,
        type,
        task,
        subtask: subtask || "--",
        element: element || "--",
        dueDate: due || null,
        dueTime: time || null,
        dueAtMs,
        status: existingTask?.status || "To Do",
        revision: existingTask?.revision || "No Revision",
        assignees: assignees.map((a) => ({ uid: a.uid, name: a.name })),
        team: team ? { id: team.id, name: team.name } : null,
        comment: comment || "",
        createdBy: pm
          ? { uid: pm.uid, name: pm.name, role: "Project Manager" }
          : null,
        taskManager,
        attachments: (attachments || []).map((a) => ({
          ...a,
          uploadedAt: serverTimestamp(),
        })),
      };

      if (existingTask?.id) {
        await updateDoc(
          doc(db, FINAL_REDEFENSE_TASKS_COLLECTION, existingTask.id),
          {
            ...payload,
            updatedAt: serverTimestamp(),
          }
        );
      } else {
        await addDoc(collection(db, FINAL_REDEFENSE_TASKS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-6 overscroll-contain">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[980px]">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
          <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <span>●</span>
              <span>{existingTask ? "Edit Task" : "Create Task"}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CONTENT — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-5">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <b>Note:</b> Due Date and Time are{" "}
              <b>set by the Project Manager</b>.
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Team
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-6">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Methodology
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={methodology}
                  onChange={(e) => {
                    setMethodology(e.target.value);
                    setPhase("");
                    setType("");
                    setTask("");
                  }}
                >
                  <option value="">Select</option>
                  {METHODOLOGIES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Project Phase
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  disabled={!methodology}
                >
                  <option value="">
                    {methodology ? "Select phase" : "Pick Methodology first"}
                  </option>
                  {(PHASE_OPTIONS[methodology] || []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Task Type
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setTask("");
                  }}
                  disabled={!methodology}
                >
                  <option value="">
                    {methodology ? "Select" : "Pick Methodology first"}
                  </option>
                  {(TYPES_BY_METHODOLOGY[methodology] || []).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Tasks
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  disabled={!type}
                >
                  <option value="">
                    {type ? "Select task" : "Pick Task Type first"}
                  </option>
                  {(TASK_SEEDS[methodology]?.[type] || []).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Subtask
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={subtask}
                  onChange={(e) => setSubtask(e.target.value)}
                  placeholder="e.g., Integration Testing"
                />
              </div>

              <div className="col-span-6">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Element
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={element}
                  onChange={(e) => setElement(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Software">Software</option>
                  <option value="Peopleware">Peopleware</option>
                </select>
              </div>
            </div>

            {/* PM sets Due Date & Time */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-white text-neutral-800"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </div>
              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-white text-neutral-800"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Assign Members
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={pickedUid}
                  onChange={(e) => setPickedUid(e.target.value)}
                >
                  <option value="">Select member</option>
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addAssignee}
                  disabled={!pickedUid}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
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
                      onClick={() => removeAssignee(a.uid)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Leave Comment & Attachments:
              </label>
              <div className="rounded-xl border border-neutral-300 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-200">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="w-5 h-5 text-neutral-600" />
                    <span className="text-sm font-semibold text-neutral-800">
                      {pm?.name || "Project Manager"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-100 text-sm"
                    title="Attach files (Supabase/Firebase)"
                  >
                    <Paperclip className="w-4 h-4" />
                    Attach
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    className="w-full resize-none px-3 py-2 text-sm outline-none"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                {(attachments?.length > 0 || uploading || uploadErr) && (
                  <div className="px-3 pb-3 space-y-2">
                    {uploading && (
                      <div className="text-sm text-neutral-600 inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading…
                      </div>
                    )}
                    {uploadErr && (
                      <div className="text-sm text-red-600">{uploadErr}</div>
                    )}
                    {attachments?.length > 0 && (
                      <div className="rounded-md border border-neutral-200 overflow-hidden">
                        <table className="w-full text-[12px]">
                          <thead className="bg-neutral-50 text-neutral-600">
                            <tr>
                              <th className="text-left px-2 py-1.5">File</th>
                              <th className="text-left px-2 py-1.5">
                                Provider
                              </th>
                              <th className="text-left px-2 py-1.5">Size</th>
                              <th className="px-2 py-1.5 w-16 text-right">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {attachments.map((a, i) => (
                              <tr key={`${a.url}-${i}`} className="border-t">
                                <td className="px-2 py-1.5">
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[12px] underline text-blue-600 break-all"
                                  >
                                    {a.name}
                                  </a>
                                </td>
                                <td className="px-2 py-1.5">{a.provider}</td>
                                <td className="px-2 py-1.5">
                                  {typeof a.size === "number"
                                    ? `${(a.size / 1024).toFixed(1)} KB`
                                    : "--"}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <button
                                    onClick={() => removeAttachment(i)}
                                    className="text-xs px-2 py-0.5 rounded border border-neutral-300 hover:bg-neutral-50"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-100"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave || saving}
              className="px-4 py-2 rounded-md text-sm text-white shadow disabled:opacity-50"
              style={{ backgroundColor: MAROON }}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </span>
              ) : existingTask ? (
                "Save"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ Main ============================ */
const FinalRedefense = ({ onBack, isReOral = false }) => {
  const handleBack = () =>
    typeof onBack === "function" ? onBack() : window.history.back();

  const [mode, setMode] = useState("team");
  const isTeam = mode === "team";
  const canEdit = true; // PM can edit in both views (incl. due/time)

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [editingModal, setEditingModal] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingCell, setEditingCell] = useState(null);

  const pageSize = 10;

  const pmUid = auth.currentUser?.uid || localStorage.getItem("uid") || "";
  const [pmProfile, setPmProfile] = useState(null);

  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [finalTasks, setFinalTasks] = useState([]);

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

  useEffect(() => {
    if (!pmUid) return;
    const qRef = query(
      collection(db, FINAL_REDEFENSE_TASKS_COLLECTION),
      where("createdBy.uid", "==", pmUid)
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTs = a?.updatedAt?.toDate?.() ?? a?.createdAt?.toDate?.() ?? 0;
          const bTs = b?.updatedAt?.toDate?.() ?? b?.createdAt?.toDate?.() ?? 0;
          return bTs - aTs;
        });

      setFinalTasks(list);
      setSelected(new Set());
      setPage(1);
    });
    return () => unsub && unsub();
  }, [pmUid]);

  const rows = useMemo(() => {
    const out = [];
    const seenMemberUids = new Set();
    const teamTasks = finalTasks.filter(
      (t) => t.taskManager === "Project Manager"
    );

    for (const t of teamTasks) {
      const assignees =
        t.assignees && t.assignees.length
          ? t.assignees
          : [{ uid: "", name: "Team" }];
      assignees.forEach((a, idx) => {
        if (a.uid) seenMemberUids.add(a.uid);
        out.push({
          key: `${t.id}:${a.uid || idx}`,
          taskId: t.id,
          memberUid: a.uid || "",
          memberName: a.name || "Team",
          methodology: t?.methodology || "--",
          phase: t?.phase || "--",
          type: t?.type || "--",
          task: t?.task || "--",
          subtask: t?.subtask || "--",
          element: t?.element || "--",
          created: t?.createdAt?.toDate?.()?.toLocaleDateString?.() || "--",
          due: t?.dueDate || "--",
          time: t?.dueTime || "--",
          revision: t?.revision || "No Revision",
          status: t?.status || "To Do",
          existingTask: t,
          teamId: t?.team?.id || null,
          teamName: t?.team?.name || "No Team",
        });
      });
    }

    members.forEach((m, idx) => {
      if (!seenMemberUids.has(m.uid)) {
        out.push({
          key: `placeholder:${m.uid || idx}`,
          taskId: null,
          memberUid: m.uid,
          memberName: m.name,
          methodology: "--",
          phase: "--",
          type: "--",
          task: "--",
          subtask: "--",
          element: "--",
          created: "--",
          due: "--",
          time: "--",
          revision: "--",
          status: "--",
          existingTask: null,
          teamId: teams[0]?.id ?? null,
          teamName: teams[0]?.name ?? "No Team",
        });
      }
    });

    return out;
  }, [finalTasks, members, teams]);

  const adviserRows = useMemo(() => {
    const adviserTasks = finalTasks.filter((t) => t.taskManager === "Adviser");
    return adviserTasks.map((t, idx) => ({
      key: t.id,
      taskId: t.id,
      memberUid: "",
      memberName: "Team",
      methodology: t?.methodology || "--",
      phase: t?.phase || "--",
      type: t?.type || "--",
      task: t?.task || "--",
      subtask: t?.subtask || "--",
      element: t?.element || "--",
      created: t?.createdAt?.toDate?.()?.toLocaleDateString?.() || "--",
      due: t?.dueDate || "--",
      time: t?.dueTime || "--",
      revision: t?.revision || "No Revision",
      status: t?.status || "To Do",
      existingTask: t,
      teamId: t?.team?.id || `no-team-${idx}`,
      teamName: t?.team?.name || "No Team",
    }));
  }, [finalTasks]);

  const [qLocal, setQLocal] = useState("");
  useEffect(() => setQLocal(q.trim().toLowerCase()), [q]);

  const baseRows = mode === "team" ? rows : adviserRows;

  const filtered = useMemo(() => {
    if (!qLocal) return baseRows;
    return baseRows.filter(
      (r) =>
        (r.memberName || "").toLowerCase().includes(qLocal) ||
        (r.teamName || "").toLowerCase().includes(qLocal) ||
        (r.methodology || "").toLowerCase().includes(qLocal) ||
        (r.phase || "").toLowerCase().includes(qLocal) ||
        (r.type || "").toLowerCase().includes(qLocal) ||
        (r.task || "").toLowerCase().includes(qLocal) ||
        (r.subtask || "").toLowerCase().includes(qLocal) ||
        (r.element || "").toLowerCase().includes(qLocal) ||
        (r.created || "").toLowerCase().includes(qLocal) ||
        (r.due || "").toLowerCase().includes(qLocal) ||
        (r.time || "").toLowerCase().includes(qLocal) ||
        String(r.revision || "")
          .toLowerCase()
          .includes(qLocal) ||
        String(r.status || "")
          .toLowerCase()
          .includes(qLocal)
    );
  }, [qLocal, baseRows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const updateTaskRow = async (row, patch) => {
    if (row.taskId) {
      await updateDoc(doc(db, FINAL_REDEFENSE_TASKS_COLLECTION, row.taskId), {
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
    await addDoc(collection(db, FINAL_REDEFENSE_TASKS_COLLECTION), {
      ...base,
      ...patch,
    });
  };

  const startEdit = (row, field) => {
    if (!canEdit) return;
    // PM can edit everything; just guard cascades like before
    if (field === "phase" && row.methodology === "--") return;
    if (field === "type" && (row.methodology === "--" || row.phase === "--"))
      return;
    if (field === "task" && row.type === "--") return;
    setEditingCell({ key: row.key, field });
  };
  const stopEdit = () => setEditingCell(null);

  const saveMethodology = async (row, newMethod) => {
    await updateTaskRow(row, {
      methodology: newMethod || null,
      phase: null,
      type: null,
      task: null,
    });
    stopEdit();
  };
  const savePhase = async (row, newPhase) => {
    await updateTaskRow(row, {
      phase: newPhase || null,
      type: null,
      task: null,
    });
    stopEdit();
  };
  const saveType = async (row, newType) => {
    await updateTaskRow(row, { type: newType || null, task: null });
    stopEdit();
  };
  const saveTask = async (row, newTask) => {
    await updateTaskRow(row, { task: newTask || null });
    stopEdit();
  };
  const saveSubtask = async (row, newSubtask) => {
    await updateTaskRow(row, { subtask: newSubtask || null });
    stopEdit();
  };
  const saveElement = async (row, newElement) => {
    await updateTaskRow(row, { element: newElement || null });
    stopEdit();
  };
  const saveRevision = async (row, newRev) => {
    await updateTaskRow(row, { revision: newRev || "No Revision" });
  };
  const saveStatus = async (row, newStatus) => {
    await updateTaskRow(row, { status: newStatus || "To Do" });
  };
  const saveDue = async (row, newDate) => {
    const hasTime = row.time && row.time !== "--";
    const dueAtMs =
      newDate && hasTime
        ? new Date(`${newDate}T${row.time}:00`).getTime()
        : null;
    await updateTaskRow(row, {
      dueDate: newDate || null,
      dueAtMs,
      ...(newDate ? {} : { dueTime: null }),
    });
    stopEdit();
  };
  const saveTime = async (row, newTime) => {
    const dueAtMs =
      row.due && row.due !== "--" && newTime
        ? new Date(`${row.due}T${newTime}:00`).getTime()
        : null;
    await updateTaskRow(row, { dueTime: newTime || null, dueAtMs });
    stopEdit();
  };

  const deleteTask = async (taskId) => {
    setDeletingId(taskId);
    try {
      await deleteDoc(doc(db, FINAL_REDEFENSE_TASKS_COLLECTION, taskId));
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelectedRows = async () => {
    if (selected.size === 0) return;
    const toDelete = pageRows
      .filter((r) => selected.has(r.key) && r.taskId)
      .map((r) => r.taskId);
    for (const id of toDelete) {
      // eslint-disable-next-line no-await-in-loop
      await deleteTask(id);
    }
    setSelected(new Set());
  };

  const openModalCreate = (row) => {
    setEditingModal({
      seedMember: row?.memberUid
        ? { uid: row.memberUid, name: row.memberName }
        : null,
      existingTask: null,
    });
  };

  return (
    <div className="space-y-4">
      {!isReOral && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-amber-800">
              Re-Oral Verdict Required
            </span>
          </div>
          <div className="mt-2 text-sm text-amber-700">
            Final Re-Defense tasks can only be created when the team's verdict
            is <b>Re-Oral</b>.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-nowrap">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
            title="Back to Tasks"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Tasks
          </button>

          <ModeSwitch mode={mode} setMode={setMode} />

          <button
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow ${
              !isReOral ? "opacity-60 cursor-not-allowed" : ""
            }`}
            style={{ background: MAROON }}
            onClick={() => {
              const selectedKey = Array.from(selected)[0] || null;
              let seedRow =
                (selectedKey && filtered.find((r) => r.key === selectedKey)) ||
                filtered.find((r) => r.memberUid);
              openModalCreate(seedRow || null);
            }}
            disabled={!isReOral}
          >
            + Create Task
          </button>

          <div className="w-[360px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={deleteSelectedRows}
            className={`inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50`}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
            title="Filter"
            onClick={() => alert("Open Filter panel")}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] leading-tight whitespace-nowrap">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pl-6 pr-3 w-10">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelected(new Set(pageRows.map((r) => r.key)));
                      else setSelected(new Set());
                    }}
                    checked={
                      pageRows.length > 0 &&
                      pageRows.every((r) => selected.has(r.key))
                    }
                  />
                </th>
                <th className="py-2 pr-3 w-16">NO</th>
                <th className="py-2 pr-3">
                  {mode === "team" ? "Assigned" : "Team"}
                </th>
                <th className="py-2 pr-3">Task Type</th>
                <th className="py-2 pr-3">Task</th>
                <th className="py-2 pr-3">Subtask</th>
                <th className="py-2 pr-3">Element</th>
                <th className="py-2 pr-3">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Date Created
                  </div>
                </th>
                <th className="py-2 pr-3">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Due Date
                  </div>
                </th>
                <th className="py-2 pr-3">
                  <div className="inline-flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Time
                  </div>
                </th>
                <th className="py-2 pr-3">Revision NO</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Methodology</th>
                <th className="py-2 pr-6">Project Phase</th>
              </tr>
            </thead>

            <tbody>
              {/* Adviser view (grouped by team) */}
              {mode !== "team" &&
                (() => {
                  const groups = (() => {
                    const m = new Map();
                    for (const r of pageRows) {
                      const key = r.teamId || "no-team";
                      if (!m.has(key))
                        m.set(key, {
                          teamId: key,
                          teamName: r.teamName || "No Team",
                          rows: [],
                        });
                      m.get(key).rows.push(r);
                    }
                    return Array.from(m.values());
                  })();

                  return groups.map((g, gIdx) => (
                    <React.Fragment key={g.teamId || `group-${gIdx}`}>
                      <tr className="bg-neutral-50/60">
                        <td
                          colSpan={14}
                          className="py-2 pl-6 pr-3 text-[13px] font-semibold text-neutral-800"
                        >
                          Team: {g.teamName}
                        </td>
                      </tr>
                      {g.rows.map((r, idx) => {
                        const isEditing = (field) =>
                          editingCell?.key === r.key &&
                          editingCell?.field === field;

                        const typeOptions =
                          r.methodology !== "--"
                            ? TYPES_BY_METHODOLOGY[r.methodology] || []
                            : [];
                        const taskOptions =
                          r.methodology !== "--" && r.type !== "--"
                            ? TASK_SEEDS[r.methodology]?.[r.type] || []
                            : [];

                        const canEditType =
                          r.methodology !== "--" && r.phase !== "--";
                        const canEditTask = r.type !== "--";

                        return (
                          <tr
                            key={r.key}
                            className="border-t border-neutral-200"
                          >
                            <td className="py-2 pl-6 pr-3">
                              <input
                                type="checkbox"
                                checked={selected.has(r.key)}
                                onChange={() => {
                                  const s = new Set(selected);
                                  s.has(r.key) ? s.delete(r.key) : s.add(r.key);
                                  setSelected(s);
                                }}
                              />
                            </td>
                            <td className="py-2 pr-3">
                              {(page - 1) * pageSize + idx + 1}.
                            </td>
                            <td className="py-2 pr-3">{g.teamName}</td>

                            <td
                              className={`py-2 pr-3 ${
                                !canEditType ? "text-neutral-400" : ""
                              }`}
                              onDoubleClick={() =>
                                canEditType &&
                                setEditingCell({ key: r.key, field: "type" })
                              }
                              title={
                                !canEditType
                                  ? "Set Methodology and Phase first"
                                  : ""
                              }
                            >
                              {isEditing("type") ? (
                                <select
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={r.type === "--" ? "" : r.type}
                                  onBlur={(e) => {
                                    updateTaskRow(r, {
                                      type: e.target.value || null,
                                      task: null,
                                    });
                                    stopEdit();
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                >
                                  <option value="">--</option>
                                  {typeOptions.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span>{r.type}</span>
                              )}
                            </td>

                            <td
                              className={`py-2 pr-3 ${
                                !canEditTask ? "text-neutral-400" : ""
                              }`}
                              onDoubleClick={() =>
                                canEditTask &&
                                setEditingCell({ key: r.key, field: "task" })
                              }
                              title={!canEditTask ? "Set Task Type first" : ""}
                            >
                              {isEditing("task") ? (
                                <select
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={r.task === "--" ? "" : r.task}
                                  onBlur={(e) => {
                                    saveTask(r, e.target.value);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                >
                                  <option value="">--</option>
                                  {taskOptions.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span>{r.task}</span>
                              )}
                            </td>

                            <td className="py-2 pr-3">
                              {isEditing("subtask") ? (
                                <input
                                  autoFocus
                                  type="text"
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={
                                    r.subtask === "--" ? "" : r.subtask
                                  }
                                  onBlur={(e) => saveSubtask(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                />
                              ) : (
                                <span
                                  className="cursor-text"
                                  onDoubleClick={() =>
                                    setEditingCell({
                                      key: r.key,
                                      field: "subtask",
                                    })
                                  }
                                >
                                  {r.subtask}
                                </span>
                              )}
                            </td>

                            <td className="py-2 pr-3">
                              {isEditing("element") ? (
                                <select
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={
                                    r.element === "--" ? "" : r.element
                                  }
                                  onBlur={(e) => saveElement(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                >
                                  <option value="">--</option>
                                  <option value="Hardware">Hardware</option>
                                  <option value="Software">Software</option>
                                  <option value="Peopleware">Peopleware</option>
                                </select>
                              ) : (
                                <span
                                  className="cursor-text"
                                  onDoubleClick={() =>
                                    setEditingCell({
                                      key: r.key,
                                      field: "element",
                                    })
                                  }
                                >
                                  {r.element}
                                </span>
                              )}
                            </td>

                            <td className="py-2 pr-3">{r.created}</td>

                            {/* Due Date — inline edit for PM */}
                            <td
                              className="py-2 pr-3"
                              onDoubleClick={() =>
                                setEditingCell({ key: r.key, field: "due" })
                              }
                              title="Double-click to edit"
                            >
                              {isEditing("due") ? (
                                <input
                                  autoFocus
                                  type="date"
                                  defaultValue={r.due === "--" ? "" : r.due}
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  onBlur={(e) => saveDue(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                />
                              ) : (
                                <span className="cursor-text">{r.due}</span>
                              )}
                            </td>

                            {/* Time — inline edit for PM */}
                            <td
                              className="py-2 pr-3"
                              onDoubleClick={() =>
                                setEditingCell({ key: r.key, field: "time" })
                              }
                              title="Double-click to edit"
                            >
                              {isEditing("time") ? (
                                <input
                                  autoFocus
                                  type="time"
                                  defaultValue={r.time === "--" ? "" : r.time}
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  onBlur={(e) => saveTime(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                />
                              ) : (
                                <span className="cursor-text">{r.time}</span>
                              )}
                            </td>

                            <td className="py-2 pr-3">
                              <RevisionSelect
                                value={r.revision}
                                onChange={() => {}}
                                disabled
                              />
                            </td>

                            <td className="py-2 pr-3">
                              <StatusBadge value={r.status} />
                            </td>

                            <td className="py-2 pr-3">
                              {isEditing("methodology") ? (
                                <select
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={
                                    r.methodology === "--" ? "" : r.methodology
                                  }
                                  onBlur={(e) =>
                                    saveMethodology(r, e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                >
                                  <option value="">--</option>
                                  {METHODOLOGIES.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className="cursor-text"
                                  onDoubleClick={() =>
                                    setEditingCell({
                                      key: r.key,
                                      field: "methodology",
                                    })
                                  }
                                >
                                  {r.methodology}
                                </span>
                              )}
                            </td>

                            <td className="py-2 pr-6">
                              {isEditing("phase") ? (
                                <select
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={r.phase === "--" ? "" : r.phase}
                                  onBlur={(e) => savePhase(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                >
                                  <option value="">--</option>
                                  {(PHASE_OPTIONS[r.methodology] || []).map(
                                    (p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : (
                                <span
                                  className="cursor-text"
                                  onDoubleClick={() =>
                                    setEditingCell({
                                      key: r.key,
                                      field: "phase",
                                    })
                                  }
                                >
                                  {r.phase}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ));
                })()}

              {/* Team view */}
              {mode === "team" &&
                pageRows.map((r, idx) => {
                  const isEditing = (field) =>
                    editingCell?.key === r.key && editingCell?.field === field;

                  const typeOptions =
                    r.methodology !== "--"
                      ? TYPES_BY_METHODOLOGY[r.methodology] || []
                      : [];
                  const taskOptions =
                    r.methodology !== "--" && r.type !== "--"
                      ? TASK_SEEDS[r.methodology]?.[r.type] || []
                      : [];

                  const canEditType =
                    r.methodology !== "--" && r.phase !== "--";
                  const canEditTask = r.type !== "--";

                  return (
                    <tr key={r.key} className="border-t border-neutral-200">
                      <td className="py-2 pl-6 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.key)}
                          onChange={() => {
                            const s = new Set(selected);
                            s.has(r.key) ? s.delete(r.key) : s.add(r.key);
                            setSelected(s);
                          }}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {(page - 1) * pageSize + idx + 1}.
                      </td>
                      <td className="py-2 pr-3">{r.memberName}</td>

                      <td
                        className={`py-2 pr-3 ${
                          !canEditType ? "text-neutral-400" : ""
                        }`}
                        onDoubleClick={() =>
                          canEditType &&
                          setEditingCell({ key: r.key, field: "type" })
                        }
                        title={
                          !canEditType ? "Set Methodology and Phase first" : ""
                        }
                      >
                        {isEditing("type") ? (
                          <select
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.type === "--" ? "" : r.type}
                            onBlur={(e) => {
                              updateTaskRow(r, {
                                type: e.target.value || null,
                                task: null,
                              });
                              stopEdit();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          >
                            <option value="">--</option>
                            {typeOptions.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{r.type}</span>
                        )}
                      </td>

                      <td
                        className={`py-2 pr-3 ${
                          !canEditTask ? "text-neutral-400" : ""
                        }`}
                        onDoubleClick={() =>
                          canEditTask &&
                          setEditingCell({ key: r.key, field: "task" })
                        }
                        title={!canEditTask ? "Set Task Type first" : ""}
                      >
                        {isEditing("task") ? (
                          <select
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.task === "--" ? "" : r.task}
                            onBlur={(e) => {
                              saveTask(r, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          >
                            <option value="">--</option>
                            {taskOptions.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{r.task}</span>
                        )}
                      </td>

                      <td className="py-2 pr-3">
                        {isEditing("subtask") ? (
                          <input
                            autoFocus
                            type="text"
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.subtask === "--" ? "" : r.subtask}
                            onBlur={(e) => saveSubtask(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          />
                        ) : (
                          <span
                            className="cursor-text"
                            onDoubleClick={() =>
                              setEditingCell({ key: r.key, field: "subtask" })
                            }
                          >
                            {r.subtask}
                          </span>
                        )}
                      </td>

                      <td className="py-2 pr-3">
                        {isEditing("element") ? (
                          <select
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.element === "--" ? "" : r.element}
                            onBlur={(e) => saveElement(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          >
                            <option value="">--</option>
                            <option value="Hardware">Hardware</option>
                            <option value="Software">Software</option>
                            <option value="Peopleware">Peopleware</option>
                          </select>
                        ) : (
                          <span
                            className="cursor-text"
                            onDoubleClick={() =>
                              setEditingCell({ key: r.key, field: "element" })
                            }
                          >
                            {r.element}
                          </span>
                        )}
                      </td>

                      <td className="py-2 pr-3">{r.created}</td>

                      {/* Due Date — inline edit */}
                      <td
                        className="py-2 pr-3"
                        onDoubleClick={() =>
                          setEditingCell({ key: r.key, field: "due" })
                        }
                        title="Double-click to edit"
                      >
                        {isEditing("due") ? (
                          <input
                            autoFocus
                            type="date"
                            defaultValue={r.due === "--" ? "" : r.due}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            onBlur={(e) => saveDue(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          />
                        ) : (
                          <span className="cursor-text">{r.due}</span>
                        )}
                      </td>

                      {/* Time — inline edit */}
                      <td
                        className="py-2 pr-3"
                        onDoubleClick={() =>
                          setEditingCell({ key: r.key, field: "time" })
                        }
                        title="Double-click to edit"
                      >
                        {isEditing("time") ? (
                          <input
                            autoFocus
                            type="time"
                            defaultValue={r.time === "--" ? "" : r.time}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            onBlur={(e) => saveTime(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          />
                        ) : (
                          <span className="cursor-text">{r.time}</span>
                        )}
                      </td>

                      <td className="py-2 pr-3">
                        <RevisionSelect
                          value={r.revision}
                          onChange={(v) => saveRevision(r, v)}
                          disabled
                        />
                      </td>

                      <td className="py-2 pr-3">
                        <select
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          defaultValue={r.status}
                          onChange={(e) => saveStatus(r, e.target.value)}
                        >
                          {[
                            "To Do",
                            "In Progress",
                            "To Review",
                            "Completed",
                          ].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2 pr-3">
                        {isEditing("methodology") ? (
                          <select
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={
                              r.methodology === "--" ? "" : r.methodology
                            }
                            onBlur={(e) => saveMethodology(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          >
                            <option value="">--</option>
                            {METHODOLOGIES.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="cursor-text"
                            onDoubleClick={() =>
                              setEditingCell({
                                key: r.key,
                                field: "methodology",
                              })
                            }
                          >
                            {r.methodology}
                          </span>
                        )}
                      </td>

                      <td className="py-2 pr-6">
                        {isEditing("phase") ? (
                          <select
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.phase === "--" ? "" : r.phase}
                            onBlur={(e) => savePhase(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          >
                            <option value="">--</option>
                            {(PHASE_OPTIONS[r.methodology] || []).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="cursor-text"
                            onDoubleClick={() =>
                              setEditingCell({ key: r.key, field: "phase" })
                            }
                          >
                            {r.phase}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
                    className="py-10 text-center text-neutral-500"
                  >
                    No {mode === "team" ? "members" : "tasks"} found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <EditTaskDialog
        open={!!editingModal}
        onClose={() => setEditingModal(null)}
        onSaved={() => setEditingModal(null)}
        pm={pmProfile || { uid: pmUid, name: "Project Manager" }}
        teams={teams}
        members={members}
        seedMember={editingModal?.seedMember || null}
        existingTask={editingModal?.existingTask || null}
        mode={mode}
      />
    </div>
  );
};

export default FinalRedefense;
