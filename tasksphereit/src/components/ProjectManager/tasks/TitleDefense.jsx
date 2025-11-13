// src/components/ProjectManager/tasks/TitleDefense.jsx
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

const MAROON = "#6A0F14";
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
  "Revise Based on the Title Re-Defense Feedback.",
  "Team Request for Advisership",
];
const DISCUSS_TASKS = ["Capstone Meeting"];

const STATUS_OPTIONS = ["To Do", "To Review", "In Progress", "Completed"];

/* ---------- helpers ---------- */
const localTodayStr = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
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
const nextRevision = (prev = "No Revision") =>
  `${ordinal(parseRevCount(prev) + 1)} Revision`;

const StatusBadge = ({ value }) => {
  if (!value || value === "null") return <span>null</span>;
  const map = {
    "To Do": "bg-[#D9A81E] text-white",
    "To Review": "bg-[#6FA8DC] text-white",
    "In Progress": "bg-[#7C9C3B] text-white",
    Completed: "bg-[#6A0F14] text-white",
    Missed: "bg-[#C0392B] text-white", // 🔴 Added red color for Missed
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium ${
        map[value] || "bg-neutral-200"
      }`}
    >
      {value}
    </span>
  );
};

const RevisionPill = ({ value }) =>
  value && value !== "null" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-neutral-100 border border-neutral-200">
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

/* ======= Edit/Create Task Dialog (with attachments) ======= */
function EditTaskDialog({
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

  // attachments state (unchanged)
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
  }, [open, existingTask, seedMember, teams]);

  const availableTasks = useMemo(() => {
    if (type === "Documentation") return DOC_TASKS;
    if (type === "Discussion & Review") return DISCUSS_TASKS;
    return [];
  }, [type]);

  const canSave = teamId && type && task && assignees.length > 0 && !!time;

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
    setFilesToDelete((prev) => (f.fileName ? [...prev, f] : prev));
    setAttachedFiles((prev) => prev.filter((x) => x.id !== id));
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

      // compute revision bump if date/time changed on edit
      let revision = (existingTask && existingTask.revision) || "No Revision";
      const dueChanged = existingTask && due !== (existingTask.dueDate || "");
      const timeChanged = existingTask && time !== (existingTask.dueTime || "");
      if (existingTask && (dueChanged || timeChanged)) {
        revision = nextRevision(revision);
      }

      const basePayload = {
        phase: "Planning",
        type,
        task,
        fileUrl: finalFileUrl,
        dueDate: due || null,
        dueTime: time || null,
        dueAtMs: due && time ? new Date(`${due}T${time}:00`).getTime() : null,
        status: existingTask?.status || "To Do",
        revision,
        assignees: assignees.map((a) => ({ uid: a.uid, name: a.name })),
        team: team ? { id: team.id, name: team.name } : null,
        comment: comment || "",
        updatedAt: serverTimestamp(),
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
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-6 overscroll-contain">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* panel */}
      <div className="relative z-10 w-full max-w-[980px]">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh]">
          {/* top accent */}
          <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />

          {/* header (fixed within panel) */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <PlusCircle className="w-5 h-5" />
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
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Team
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
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
                  Project Phase
                </label>
                <input
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 bg-neutral-100"
                  value="Planning"
                  disabled
                  readOnly
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Task Type
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setTask("");
                  }}
                >
                  <option value="">Select</option>
                  <option>Documentation</option>
                  <option>Discussion & Review</option>
                </select>
              </div>
              <div className="col-span-8">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Tasks
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
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

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  min={today}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
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
                  step={600} // 10 minutes
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  value={time}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return setTime("");
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
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Assign Members
              </label>
              <AssigneesPicker
                members={members}
                pickedUid={pickedUid}
                setPickedUid={setPickedUid}
                assignees={assignees}
                setAssignees={setAssignees}
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
          </div>

          {/* footer (outside the scrollable area) */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
              disabled={saving}
            >
              Cancel
            </button>
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
  );
}

/* Small subcomponent to keep the dialog tidy */
function AssigneesPicker({
  members,
  pickedUid,
  setPickedUid,
  assignees,
  setAssignees,
}) {
  return (
    <>
      <div className="flex gap-2">
        <select
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
          onClick={() => {
            if (!pickedUid) return;
            const found = members.find((m) => m.uid === pickedUid);
            if (found && !assignees.some((a) => a.uid === found.uid))
              setAssignees((a) => [...a, found]);
            setPickedUid("");
          }}
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
              onClick={() =>
                setAssignees((arr) => arr.filter((x) => x.uid !== a.uid))
              }
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </>
  );
}

/* ================= Main ================= */
const TitleDefense = ({ onBack }) => {
  const handleBack = () =>
    typeof onBack === "function" ? onBack() : window.history.back();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const pageSize = 10;

  const [menuOpenId, setMenuOpenId] = useState(null); // member uid
  const [editingModal, setEditingModal] = useState(null); // {seedMember, existingTask}
  const [deletingId, setDeletingId] = useState(null); // task id

  // which cell is being inline-edited
  const [editingCell, setEditingCell] = useState(null); // {key, field:'type'|'task'|'due'|'time'|'status'}

  // Optimistic overlay
  const [optimistic, setOptimistic] = useState({}); // {[memberUid]: {type?, task?, due?, time?, status?}}

  // current PM
  const pmUid = auth.currentUser?.uid || localStorage.getItem("uid") || "";
  const [pmProfile, setPmProfile] = useState(null);

  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);

  // raw task docs created by this PM
  const [tasks, setTasks] = useState([]);

  const today = localTodayStr();

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
      setSelected(new Set());
      setPage(1);

      // 🕒 Auto-update overdue tasks
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


  /* Build table rows: only members who have non-completed tasks (each task = 1 row) */
  const rows = useMemo(() => {
    const rowsWithTasks = [];

    members.forEach((m) => {
      const relatedTasks = tasks.filter(
        (t) =>
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
          created: t?.createdAt?.toDate?.()?.toLocaleDateString?.() || "null",
          due: t.dueDate || "null",
          time: t.dueTime || "null",
          revision: t.revision || "No Revision",
          status: t.status || "To Do",
          phase: t.phase || "Planning",
          existingTask: t,
        };

        const opt = optimistic[m.uid];
        if (opt) {
          if (opt.type !== undefined) base.type = opt.type || "null";
          if (opt.task !== undefined) base.task = opt.task || "null";
          if (opt.due !== undefined) base.due = opt.due || "null";
          if (opt.time !== undefined) base.time = opt.time || "null";
          if (opt.status !== undefined) base.status = opt.status || "To Do";
        }

        rowsWithTasks.push(base);
      });
    });

    return rowsWithTasks;
  }, [members, tasks, optimistic]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
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
  }, [q, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* Helpers */
  const currentVal = (row, field) => {
    const opt = optimistic[row.memberUid];
    const v = (opt && opt[field]) !== undefined ? opt[field] : row[field];
    return v && v !== "null" ? v : "";
  };

  const upsertForMember = async (row, patch, optimisticPatch) => {
    setOptimistic((prev) => ({
      ...prev,
      [row.memberUid]: { ...(prev[row.memberUid] || {}), ...optimisticPatch },
    }));

    const base = {
      phase: "Planning",
      status: "To Do",
      revision: "No Revision",
      createdBy: pmProfile
        ? { uid: pmProfile.uid, name: pmProfile.name, role: "Project Manager" }
        : null,
      assignees: [{ uid: row.memberUid, name: row.memberName }],
      team: teams[0] ? { id: teams[0].id, name: teams[0].name } : null,
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
    const time = currentVal(row, "time"); // HH:mm or ""
    const dueAtMs =
      newDate && time ? new Date(`${newDate}T${time}:00`).getTime() : null;

    // bump revision if changed
    const changed = (row.existingTask?.dueDate || "") !== (newDate || "");
    const rev = changed ? nextRevision(row.revision) : row.revision;

    await upsertForMember(
      row,
      {
        dueDate: newDate || null,
        dueAtMs,
        ...(changed ? { revision: rev } : {}),
      },
      { due: newDate || "null", ...(newDate ? {} : { time: "null" }) }
    );
    stopEdit();
  };

  const saveTime = async (row, newTime) => {
    const due = currentVal(row, "due"); // YYYY-MM-DD or ""
    const dueAtMs =
      due && newTime ? new Date(`${due}T${newTime}:00`).getTime() : null;

    // bump revision if changed
    const changed = (row.existingTask?.dueTime || "") !== (newTime || "");
    const rev = changed ? nextRevision(row.revision) : row.revision;

    await upsertForMember(
      row,
      {
        dueTime: newTime || null,
        dueAtMs,
        ...(changed ? { revision: rev } : {}),
      },
      { time: newTime || "null" }
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

  const deleteTask = async (taskId) => {
    setDeletingId(taskId);
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
    } finally {
      setDeletingId(null);
    }
  };

  const openModalEditor = (row) => {
    setEditingModal({
      seedMember: { uid: row.memberUid, name: row.memberName },
      existingTask: row.taskId ? { ...row.existingTask, id: row.taskId } : null,
    });
  };

  return (
    <div className="space-y-4">
      {/* toolbar (no Create button) */}
      <div className="flex items-center justify-between gap-3 flex-nowrap">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
            title="Back to Tasks"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Tasks
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
                placeholder="Search members or tasks"
                className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <button
              onClick={() =>
                setEditingModal({
                  seedMember: null,
                  existingTask: null,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
              style={{ backgroundColor: "#6A0F14" }}
            >
              <PlusCircle className="w-4 h-4" />
              Create Task
            </button>
          </div>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
          title="Filter"
          onClick={() => alert("Open Filter panel")}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* table */}
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
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Task Type</th>
                <th className="py-2 pr-3">Task</th>
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
                <th className="py-2 pr-6">Status</th>
                <th className="py-2 pr-6">Project Phase</th>
                <th className="py-2 pr-6 w-12 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const isEditingType =
                  editingCell?.key === r.key && editingCell?.field === "type";
                const isEditingTask =
                  editingCell?.key === r.key && editingCell?.field === "task";
                const isEditingDue =
                  editingCell?.key === r.key && editingCell?.field === "due";
                const isEditingTime =
                  editingCell?.key === r.key && editingCell?.field === "time";
                const isEditingStatus =
                  editingCell?.key === r.key && editingCell?.field === "status";

                const taskOptions =
                  r.type === "Documentation"
                    ? DOC_TASKS
                    : r.type === "Discussion & Review"
                    ? DISCUSS_TASKS
                    : [];

                const canEditDue = r.task !== "null";
                const canEditTime = r.due !== "null";

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

                    {/* Task Type */}
                    <td
                      className="py-2 pr-3"
                      onDoubleClick={() => startEdit(r, "type")}
                    >
                      {isEditingType ? (
                        <select
                          autoFocus
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          defaultValue={r.type === "null" ? "" : r.type}
                          onBlur={(e) => saveType(r, e.target.value)}
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
                        <span>{r.type}</span>
                      )}
                    </td>

                    {/* Task */}
                    <td
                      className={`py-2 pr-3 ${
                        r.type === "null"
                          ? "text-neutral-400 cursor-not-allowed"
                          : ""
                      }`}
                      onDoubleClick={() => startEdit(r, "task")}
                      title={r.type === "null" ? "Set Task Type first" : ""}
                    >
                      {isEditingTask ? (
                        <select
                          autoFocus
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          defaultValue={r.task === "null" ? "" : r.task}
                          onBlur={(e) => saveTask(r, e.target.value)}
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
                        <span>{r.task}</span>
                      )}
                    </td>

                    {/* Date Created */}
                    <td className="py-2 pr-3">{r.created}</td>

                    {/* Due Date */}
                    <td
                      className={`py-2 pr-3 ${
                        !canEditDue ? "text-neutral-400 cursor-not-allowed" : ""
                      }`}
                      onDoubleClick={() => canEditDue && startEdit(r, "due")}
                      title={!canEditDue ? "Set Task first" : ""}
                    >
                      {isEditingDue ? (
                        <input
                          type="date"
                          min={today}
                          autoFocus
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          defaultValue={r.due === "null" ? "" : r.due}
                          onBlur={(e) => saveDue(r, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") stopEdit();
                          }}
                        />
                      ) : (
                        <span>{r.due}</span>
                      )}
                    </td>

                    {/* Time */}
                    <td
                      className={`py-2 pr-3 ${
                        !canEditTime
                          ? "text-neutral-400 cursor-not-allowed"
                          : ""
                      }`}
                      onDoubleClick={() => canEditTime && startEdit(r, "time")}
                      title={!canEditTime ? "Set Due Date first" : ""}
                    >
                      {isEditingTime ? (
                        <input
                          type="time"
                          step="600"
                          autoFocus
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          defaultValue={r.time === "null" ? "" : r.time}
                          onBlur={(e) => saveTime(r, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") stopEdit();
                          }}
                        />
                      ) : (
                        <span>{r.time}</span>
                      )}
                    </td>

                    <td className="py-2 pr-3">
                      <RevisionPill value={r.revision} />
                    </td>

                    {/* Status (dropdown) */}
                    <td
                      className="py-2 pr-6"
                      onDoubleClick={() => startEdit(r, "status")}
                      title="Double-click to edit"
                    >
                      {isEditingStatus ? (
                        <select
                          autoFocus
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          defaultValue={r.status}
                          onBlur={(e) => saveStatus(r, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") stopEdit();
                          }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge value={r.status} />
                      )}
                    </td>

                    <td className="py-2 pr-6">{r.phase || "Planning"}</td>

                    <td className="py-2 pr-6">
                      <div className="relative flex justify-center">
                        <button
                          className="p-1.5 rounded-md hover:bg-neutral-100"
                          onClick={() =>
                            setMenuOpenId(menuOpenId === r.key ? null : r.key)
                          }
                          aria-label="Row actions"
                        >
                          <MoreVertical className="w-4 h-4 text-neutral-600" />
                        </button>

                        {menuOpenId === r.key && (
                          <div className="absolute right-0 top-6 z-10 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg p-1">
                            <div className="flex flex-col">
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-neutral-50"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  openModalEditor(r);
                                }}
                              >
                                Edit {r.taskId ? "" : "(create)"}
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-neutral-50"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  alert(
                                    r.taskId
                                      ? `Open detail: ${r.taskId}`
                                      : "No task yet"
                                  );
                                }}
                              >
                                View
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-neutral-50 disabled:opacity-50"
                                disabled={!r.taskId || deletingId === r.taskId}
                                onClick={async () => {
                                  setMenuOpenId(null);
                                  if (!r.taskId) return;
                                  await deleteTask(r.taskId);
                                }}
                              >
                                {deletingId === r.taskId ? (
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
                    </td>
                  </tr>
                );
              })}

              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="py-10 text-center text-neutral-500"
                  >
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
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

      {/* Modal editor (from Actions → Edit) */}
      <EditTaskDialog
        open={!!editingModal}
        onClose={() => setEditingModal(null)}
        onSaved={() => setEditingModal(null)}
        pm={pmProfile || { uid: pmUid, name: "Project Manager" }}
        teams={teams}
        members={members}
        seedMember={editingModal?.seedMember || null}
        existingTask={editingModal?.existingTask || null}
      />
    </div>
  );
};

export default TitleDefense;
