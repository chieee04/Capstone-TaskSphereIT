// src/components/ProjectManager/tasks/OralDefense.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  MoreVertical,
  Loader2,
  Trash2,
} from "lucide-react";

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
} from "firebase/firestore";

/* ===== Supabase ===== */
import { supabase } from "../../../config/supabase";

/* ===== JSON options (keeps your data-driven dropdowns) ===== */
import OPTIONS_JSON from "../methodologyContents/oralDefense.json";

const MAROON = "#6A0F14";
const TASKS_COLLECTION = "oralDefenseTasks";

/* -----------------------------------------------------------
   Build indexes from JSON (methodologies → phases → types → tasks → subtasks → elements)
----------------------------------------------------------- */
function buildIndexesFromJSON(json) {
  const root = json?.oralDefense || [];

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

      const types = Array.isArray(p?.taskTypes) ? p.taskTypes : [];
      for (const tt of types) {
        const tType = String(tt?.type || "").trim();
        if (!tType) continue;

        if (!TASK_SEEDS[mName][tType]) TASK_SEEDS[mName][tType] = [];

        const tasks = Array.isArray(tt?.tasks) ? tt.tasks : [];
        for (const t of tasks) {
          const taskName = String(t?.task || "").trim();
          if (!taskName) continue;

          if (!TASK_SEEDS[mName][tType].includes(taskName)) {
            TASK_SEEDS[mName][tType].push(taskName);
          }

          const subtasksArr = Array.isArray(t?.subtasks) ? t.subtasks : [];
          if (!SUBTASKS[mName][taskName]) SUBTASKS[mName][taskName] = [];
          for (const s of subtasksArr) {
            const sName = String(s?.subtask || "").trim();
            if (!sName) continue;
            if (!SUBTASKS[mName][taskName].includes(sName)) {
              SUBTASKS[mName][taskName].push(sName);
            }
            const els = Array.isArray(s?.elements) ? s.elements : [];
            if (els.length) {
              ELEMENTS[mName][sName] = els.map((e) => String(e));
            }
          }

          const taskEls = Array.isArray(t?.elements) ? t.elements : [];
          if (taskEls.length) {
            if (!ELEMENTS[mName][taskName]) {
              ELEMENTS[mName][taskName] = taskEls.map((e) => String(e));
            }
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
const snapTimeTo = (val, stepMin = 10) => {
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

/* ======= Create/Edit Task Dialog (UI kept; options come from JSON) ======= */
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
}) {
  const isTeamMode = mode === "team";
  const timeStepSec = isTeamMode ? 600 : 1200; // 10m vs 20m

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

  const stepMin = isTeamMode ? 10 : 20;
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const roundUpNow = (sMin = 10) => {
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
  const availableTypes = useMemo(
    () => (methodology ? Object.keys(TASK_SEEDS[methodology] || {}) : []),
    [methodology]
  );
  const taskOptions = useMemo(() => {
    const mKey = lockedMethodology || methodology;
    if (!mKey || !type) return [];
    return TASK_SEEDS[mKey]?.[type] || [];
  }, [lockedMethodology, methodology, type]);
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
      setDue(existingTask.dueDate || "");
      setTime(existingTask.dueTime || "");
      setAssignees(
        (existingTask.assignees || []).map((a) => ({
          uid: a.uid,
          name: a.name,
        }))
      );
      setComment(existingTask.comment || "");
      setAttachedFiles(existingTask.fileUrl || []);
      setNewFiles([]);
      setFilesToDelete([]);
    } else {
      setType("");
      setTask("");
      setSubtasks("");
      setElements("");
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
  }, [open, existingTask, seedMember, teams, lockedMethodology]);

  const onChangeMethodology = (v) => {
    setMethodology(v);
    setPhase(FIXED_PHASE[v] || "");
    setType("");
    setTask("");
    setSubtasks("");
    setElements("");
  };
  const onChangeType = (v) => {
    setType(v);
    setTask("");
    setSubtasks("");
    setElements("");
  };
  const onChangeTask = (v) => {
    setTask(v);
    setSubtasks("");
    setElements("");
  };
  const onChangeSubtasks = (v) => {
    setSubtasks(v);
    setElements("");
  };

  const canSave =
    (mode === "team" ? true : !!teamId) &&
    (lockedMethodology ? true : !!methodology) &&
    (lockedMethodology ? true : !!phase || availablePhases.length <= 1) &&
    type &&
    task &&
    (mode === "team" ? assignees.length > 0 : true);

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
    e.target.value = "";
  };
  const removeNewFile = (id) =>
    setNewFiles((prev) => prev.filter((f) => f.id !== id));
  const removeExistingFile = (id) => {
    const f = attachedFiles.find((x) => x.id === id);
    if (!f) return;
    setFilesToDelete((prev) => [...prev, f]);
    setAttachedFiles((prev) => prev.filter((x) => x.id !== id));
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

      const timeString = time
        ? snapTimeTo(time, mode === "team" ? 10 : 20)
        : "";
      const dueAtMs =
        due && timeString
          ? new Date(`${due}T${timeString}:00`).getTime()
          : null;
      if (dueAtMs && dueAtMs < Date.now()) {
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

      const payload = {
        methodology: finalMethodology,
        phase: finalPhase,
        type,
        task,
        subtasks: subtasks || null,
        elements: elementsValue,
        fileUrl: finalFileUrl,
        dueDate: due || null,
        dueTime: timeString || null,
        dueAtMs,
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
      };

      if (existingTask?.id) {
        await updateDoc(doc(db, TASKS_COLLECTION, existingTask.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, TASKS_COLLECTION), {
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

  const methodologyLocked = !!lockedMethodology;
  //const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 mx-auto mt-10 w-[980px] max-w-[95vw]">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
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

          <div className="flex-1 px-5 pb-5 space-y-5 overflow-y-auto">
            {/* Team picker row (adviser mode earlier UI also showed the single Team select) */}
            {mode !== "team" && (
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
              </div>
            )}

            {/* Methodology & Phase (kept; not shown in table for classic UI) */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Methodology
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30 disabled:bg-neutral-100 disabled:text-neutral-600"
                  value={methodology}
                  onChange={(e) => onChangeMethodology(e.target.value)}
                  disabled={methodologyLocked}
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
                    Methodology is locked to <b>{lockedMethodology}</b> until
                    all tasks are deleted.
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
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                      value={phase}
                      onChange={(e) => setPhase(e.target.value)}
                      disabled={!methodology}
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
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-neutral-50 text-neutral-800"
                      value={phase}
                      readOnly
                      placeholder={
                        methodology ? "Auto-selected" : "Pick Methodology first"
                      }
                    />
                  );
                })()}
              </div>
            </div>

            {/* Type / Task / Subtasks (classic still uses them in modal) */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Task Type
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={type}
                  onChange={(e) => onChangeType(e.target.value)}
                  disabled={!(methodologyLocked || methodology)}
                >
                  <option value="">
                    {methodologyLocked || methodology
                      ? "Select"
                      : "Pick Methodology first"}
                  </option>
                  {(methodology
                    ? Object.keys(TASK_SEEDS[methodology] || {})
                    : []
                  ).map((t) => (
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
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={task}
                  onChange={(e) => onChangeTask(e.target.value)}
                  disabled={!type}
                >
                  <option value="">
                    {type ? "Select task" : "Pick Task Type first"}
                  </option>
                  {(lockedMethodology || methodology) && type
                    ? TASK_SEEDS[lockedMethodology || methodology]?.[type]?.map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        )
                      )
                    : null}
                </select>
              </div>

              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Subtasks
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={subtasks}
                  onChange={(e) => onChangeSubtasks(e.target.value)}
                  disabled={
                    !task ||
                    (lockedMethodology || methodology
                      ? (
                          SUBTASKS[lockedMethodology || methodology]?.[task] ||
                          []
                        ).length === 0
                      : true)
                  }
                >
                  <option value="">
                    {task
                      ? (lockedMethodology || methodology) &&
                        (
                          SUBTASKS[lockedMethodology || methodology]?.[task] ||
                          []
                        ).length
                        ? "Select subtask"
                        : "No subtasks"
                      : "Pick Task first"}
                  </option>
                  {(lockedMethodology || methodology) && task
                    ? (
                        SUBTASKS[lockedMethodology || methodology]?.[task] || []
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
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Elements
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={elements}
                  onChange={(e) => setElements(e.target.value)}
                  disabled={
                    !subtasks ||
                    (lockedMethodology || methodology
                      ? (
                          ELEMENTS[lockedMethodology || methodology]?.[
                            subtasks
                          ] || []
                        ).length === 0
                      : true)
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
                  Due Date
                </label>
                <input
                  type="date"
                  min={todayISO}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-white text-neutral-800"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </div>

              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Time ({isTeamMode ? "10-min" : "20-min"} interval)
                </label>
                <input
                  type="time"
                  step={timeStepSec}
                  min={
                    due === todayISO
                      ? (() => {
                          const d = new Date();
                          let m =
                            Math.ceil(d.getMinutes() / (isTeamMode ? 10 : 20)) *
                            (isTeamMode ? 10 : 20);
                          let h = d.getHours();
                          if (m === 60) {
                            m = 0;
                            h = (h + 1) % 24;
                          }
                          return `${String(h).padStart(2, "0")}:${String(
                            m
                          ).padStart(2, "0")}`;
                        })()
                      : ""
                  }
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-white text-neutral-800"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  onBlur={(e) => {
                    const snapped = snapTimeTo(
                      e.target.value,
                      isTeamMode ? 10 : 20
                    );
                    setTime(snapped);
                  }}
                />
              </div>
            </div>

            {/* Assign Members (team mode) */}
            {mode === "team" && (
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
                    onChange={(e) => setComment(e.target.value)}
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

            <div className="flex justify-end gap-2 pt-2">
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
    </div>
  );
}

/* ===== Status + Revision components (unchanged visuals) ===== */
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

/* ============================ Main (Classic UI) ============================ */
const OralDefense = ({ onBack }) => {
  const handleBack = () =>
    typeof onBack === "function" ? onBack() : window.history.back();

  // Classic UI removes the Team/Adviser toggle from the header area
  const mode = "team"; // keep data behavior; you can switch to "adviser" if this page is adviser-only
  const isTeam = mode === "team";

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingModal, setEditingModal] = useState(null); // {seedMember, existingTask}
  const [deletingId, setDeletingId] = useState(null);

  const pageSize = 10;

  const pmUid = auth.currentUser?.uid || localStorage.getItem("uid") || "";
  const [pmProfile, setPmProfile] = useState(null);

  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);

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

  // Tasks
  useEffect(() => {
    if (!pmUid) return;
    const qRef = query(
      collection(db, TASKS_COLLECTION),
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

      setTasks(list);
      setPage(1);
    });
    return () => unsub && unsub();
  }, [pmUid]);

  const lockedMethodology = useMemo(() => {
    if (!tasks.length) return null;
    const m = tasks.map((t) => t.methodology).find((x) => !!x);
    return m || null;
  }, [tasks]);

  // Rows (Team = PM-created tasks; Adviser tasks show as "Team")
  const rowsTeam = useMemo(() => {
    const out = [];
    const teamTasks = tasks.filter((t) => t.taskManager === "Project Manager");
    for (const t of teamTasks) {
      const assignees =
        t.assignees && t.assignees.length
          ? t.assignees
          : [{ uid: "", name: "Team" }];
      assignees.forEach((a, idx) => {
        out.push({
          key: `${t.id}:${a.uid || idx}`,
          taskId: t.id,
          memberUid: a.uid || "",
          memberName: a.name || "Team",
          type: t?.type || "--",
          task: t?.task || "--",
          created: t?.createdAt?.toDate?.()?.toLocaleDateString?.() || "--",
          due: t?.dueDate || "--",
          time: t?.dueTime || "--",
          revision: t?.revision || "No Revision",
          status: t?.status || "To Do",
          phase: t?.phase || "--",
          existingTask: t,
          teamId: t?.team?.id || null,
          teamName: t?.team?.name || "No Team",
        });
      });
    }
    // also add placeholders for members with no task yet
    members.forEach((m, idx) => {
      if (!out.some((r) => r.memberUid === m.uid)) {
        out.push({
          key: `placeholder:${m.uid || idx}`,
          taskId: null,
          memberUid: m.uid,
          memberName: m.name,
          type: "--",
          task: "--",
          created: "--",
          due: "--",
          time: "--",
          revision: "--",
          status: "--",
          phase: "--",
          existingTask: null,
          teamId: teams[0]?.id ?? null,
          teamName: teams[0]?.name ?? "No Team",
        });
      }
    });
    return out;
  }, [tasks, members, teams]);

  const rowsAdviser = useMemo(() => {
    const adviserTasks = tasks.filter((t) => t.taskManager === "Adviser");
    return adviserTasks.map((t, idx) => ({
      key: t.id,
      taskId: t.id,
      memberUid: "",
      memberName: "Team",
      type: t?.type || "--",
      task: t?.task || "--",
      created: t?.createdAt?.toDate?.()?.toLocaleDateString?.() || "--",
      due: t?.dueDate || "--",
      time: t?.dueTime || "--",
      revision: t?.revision || "No Revision",
      status: t?.status || "To Do",
      phase: t?.phase || "--",
      existingTask: t,
      teamId: t?.team?.id || `no-team-${idx}`,
      teamName: t?.team?.name || "No Team",
    }));
  }, [tasks]);

  const baseRows = isTeam ? rowsTeam : rowsAdviser;

  const qLocal = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!qLocal) return baseRows;
    return baseRows.filter(
      (r) =>
        (r.memberName || "").toLowerCase().includes(qLocal) ||
        (r.type || "").toLowerCase().includes(qLocal) ||
        (r.task || "").toLowerCase().includes(qLocal) ||
        (r.created || "").toLowerCase().includes(qLocal) ||
        (r.due || "").toLowerCase().includes(qLocal) ||
        (r.time || "").toLowerCase().includes(qLocal) ||
        String(r.revision || "")
          .toLowerCase()
          .includes(qLocal) ||
        String(r.status || "")
          .toLowerCase()
          .includes(qLocal) ||
        (r.phase || "").toLowerCase().includes(qLocal)
    );
  }, [qLocal, baseRows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Firestore update helpers for inline cells
  const updateTaskRow = async (row, patch) => {
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

  // Inline edit actions
  const saveStatus = async (row, newStatus) =>
    updateTaskRow(row, { status: newStatus || "To Do" });
  const saveRevision = async (row, newRev) =>
    updateTaskRow(row, { revision: newRev || "No Revision" });
  const saveDue = async (row, newDate) => {
    const hasTime = row.time && row.time !== "null";
    const dueAtMs =
      newDate && hasTime
        ? new Date(`${newDate}T${row.time}:00`).getTime()
        : null;
    await updateTaskRow(row, {
      dueDate: newDate || null,
      dueAtMs,
      ...(newDate ? {} : { dueTime: null }),
    });
  };
  const saveTime = async (row, newTime) => {
    const dueAtMs =
      row.due && row.due !== "null" && newTime
        ? new Date(`${row.due}T${newTime}:00`).getTime()
        : null;
    await updateTaskRow(row, { dueTime: newTime || null, dueAtMs });
  };

  const openCreateForMember = (row) => {
    setEditingModal({
      seedMember: row.memberUid
        ? { uid: row.memberUid, name: row.memberName }
        : null,
      existingTask: null,
    });
  };
  const openEditTask = (row) =>
    setEditingModal({ seedMember: null, existingTask: row.existingTask });
  const askDelete = (row) => setDeletingId(row.taskId);
  const doDelete = async () => {
    if (!deletingId) return;
    await deleteDoc(doc(db, TASKS_COLLECTION, deletingId));
    setDeletingId(null);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Title bar border is kept; back button text matches earlier */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Tasks
        </button>
      </div>

      {/* Toolbar — classic arrangement */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 bg-white flex-1">
            <Search className="w-4 h-4 text-neutral-500" />
            <input
              className="flex-1 outline-none text-sm"
              placeholder="Search members or tasks"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            onClick={() =>
              setEditingModal({ seedMember: null, existingTask: null })
            }
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white shadow"
            style={{ backgroundColor: MAROON }}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-sm">Create Task</span>
          </button>
        </div>

        <div className="flex items-center">
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm">Filter</span>
          </button>
        </div>
      </div>

      {/* Classic table (columns as in your earlier UI) */}
      <div className="w-full overflow-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left p-3">NO</th>
              <th className="text-left p-3">Member</th>
              <th className="text-left p-3">Task Type</th>
              <th className="text-left p-3">Task</th>
              <th className="text-left p-3">Date Created</th>
              <th className="text-left p-3">
                <div className="inline-flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  Due Date
                </div>
              </th>
              <th className="text-left p-3">
                <div className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Time
                </div>
              </th>
              <th className="text-left p-3">Revision NO</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Project Phase</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const rowNo = (page - 1) * pageSize + idx + 1;
              return (
                <tr key={row.key} className="border-t border-neutral-200">
                  <td className="p-3 align-top">{rowNo}</td>
                  <td className="p-3 align-top">
                    <div className="font-medium">{row.memberName}</div>
                  </td>
                  <td className="p-3 align-top">{row.type}</td>
                  <td className="p-3 align-top">{row.task}</td>
                  <td className="p-3 align-top">{row.created}</td>

                  {/* Due date inline edit */}
                  <td className="p-3 align-top">
                    <input
                      type="date"
                      className="w-[150px] bg-white border border-neutral-300 rounded px-2 py-1 text-sm"
                      value={row.due === "--" ? "" : row.due}
                      onChange={(e) => saveDue(row, e.target.value)}
                    />
                  </td>

                  {/* Time inline edit */}
                  <td className="p-3 align-top">
                    <input
                      type="time"
                      step={isTeam ? 600 : 1200}
                      className="w-[120px] bg-white border border-neutral-300 rounded px-2 py-1 text-sm"
                      value={row.time === "--" ? "" : row.time}
                      onChange={(e) =>
                        saveTime(
                          row,
                          snapTimeTo(e.target.value, isTeam ? 10 : 20)
                        )
                      }
                    />
                  </td>

                  <td className="p-3 align-top">
                    <RevisionSelect
                      value={row.revision || "No Revision"}
                      onChange={(v) => saveRevision(row, v)}
                    />
                  </td>

                  <td className="p-3 align-top">
                    <StatusBadge
                      value={row.status || "To Do"}
                      isEditable={true}
                      onChange={(v) => saveStatus(row, v)}
                    />
                  </td>

                  <td className="p-3 align-top">{row.phase}</td>

                  <td className="p-3 align-top text-right">
                    <div className="relative inline-block">
                      <button
                        className="p-1.5 rounded-md hover:bg-neutral-100"
                        onClick={() =>
                          setMenuOpenId(menuOpenId === row.key ? null : row.key)
                        }
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === row.key && (
                        <div className="absolute right-0 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg z-10">
                          {row.taskId ? (
                            <>
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  openEditTask(row);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-red-600"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  askDelete(row);
                                }}
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                              onClick={() => {
                                setMenuOpenId(null);
                                openCreateForMember(row);
                              }}
                            >
                              Create Task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {pageRows.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-neutral-500">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (labels match earlier) */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-neutral-600">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal: Create/Edit */}
      {editingModal && (
        <EditTaskDialog
          open={!!editingModal}
          onClose={() => setEditingModal(null)}
          onSaved={() => {}}
          pm={pmProfile}
          teams={teams}
          members={members}
          seedMember={editingModal.seedMember}
          existingTask={editingModal.existingTask}
          mode={mode}
          lockedMethodology={lockedMethodology}
        />
      )}

      {/* Confirm delete */}
      {deletingId && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDeletingId(null)}
          />
          <div className="relative z-10 mx-auto mt-24 w-[420px] max-w-[95vw]">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl overflow-hidden">
              <div
                className="h-[2px] w-full"
                style={{ backgroundColor: MAROON }}
              />
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2 text-red-700">
                  <Trash2 className="w-5 h-5" />
                  <div className="font-semibold">Delete Task</div>
                </div>
                <div className="text-sm text-neutral-700">
                  Are you sure you want to delete this task? This action cannot
                  be undone.
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50"
                    onClick={() => setDeletingId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-md text-white"
                    style={{ backgroundColor: MAROON }}
                    onClick={doDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OralDefense;
