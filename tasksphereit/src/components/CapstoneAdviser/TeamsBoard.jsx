// src/components/ProjectManager/TaskBoard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutList,
  StickyNote,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  Send,
  MessageSquareText,
  Loader2,
  X as XIcon,
} from "lucide-react";

/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  limit,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ===== Supabase (for file uploads / public URLs) ===== */
import { supabase } from "../../config/supabase";

const MAROON = "#6A0F14";

/* ========================== Helpers ========================== */
const COLUMNS = [
  { id: "todo", title: "To Do", color: "#F5B700" },
  { id: "inprogress", title: "In Progress", color: "#7C9C3B" },
  { id: "review", title: "To Review", color: "#6FA8DC" },
  { id: "missed", title: "Missed Task", color: "#D11A2A" },
];

const STATUS_TO_COLUMN = {
  "To Do": "todo",
  "In Progress": "inprogress",
  "To Review": "review",
  Completed: "todo",
};

const cardShell =
  "bg-white border border-neutral-200 rounded-lg shadow-sm hover:shadow transition-shadow";

const safeName = (u) =>
  [u?.firstName, u?.middleName ? `${u.middleName[0]}.` : null, u?.lastName]
    .filter(Boolean)
    .join(" ") || "Unknown";

const cleanBase = (p = "") =>
  String(p).split("/").pop()?.split("?")[0] || String(p);

const humanName = (meta = {}) =>
  meta.originalName ||
  meta.fileName ||
  meta.name ||
  cleanBase(meta.path || meta.url || "");

const fmtWhen = (msOrDate) => {
  try {
    if (!msOrDate) return "";
    const d = msOrDate instanceof Date ? msOrDate : new Date(msOrDate);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
};

const slugSafe = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^\w\s.-]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 120);

/* ======================= Reusable UI ========================= */
function Column({ title, color, children }) {
  return (
    <div className="flex flex-col w-[280px] bg-white border border-neutral-200 rounded-xl shadow">
      <div
        className="px-4 py-3 rounded-t-xl text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        {title}
      </div>
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto px-3 py-3 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ data, onOpen }) {
  return (
    <div className={cardShell}>
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="font-semibold text-sm">
            {data.teamName || "No Team"}
          </div>
          <button
            onClick={() => onOpen(data)}
            className="p-1 rounded hover:bg-neutral-100 cursor-pointer"
            aria-label="Open detail"
            title="Open"
          >
            <StickyNote className="w-4 h-4 text-neutral-600" />
          </button>
        </div>

        <div className="mt-2 text-sm">
          <div className="text-neutral-800">
            {data.task || data.chapter || "Task"}
          </div>
          <div className="text-neutral-500">
            {data.revision || "No Revision"}
          </div>
        </div>

        <div className="mt-3 text-xs text-neutral-700 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              data._colId === "missed" ? "bg-red-500" : "bg-neutral-400"
            } inline-block`}
          />
          <span className="px-2 py-1 rounded border border-neutral-200 bg-neutral-50">
            {data.dueDisplay || "No due date"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ====================== Detail + Chat ======================== */
function Field({ label, value }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="text-neutral-500">{label}</div>
      <div className="font-medium text-neutral-800">{value || "—"}</div>
    </div>
  );
}

function ChatBubble({ m, meUid, onEdit, onDelete, editingId, setEditingId }) {
  const mine = m.sender?.uid === meUid;
  const [editText, setEditText] = useState(m.text);
  const base =
    "max-w-[80%] px-3 py-2 rounded-lg text-sm leading-snug shadow border border-neutral-200";
  const isEditing = editingId === m.id && mine;

  const hasFiles = Array.isArray(m.fileUrl) && m.fileUrl.length > 0;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`${base} ${mine ? "bg-[#F9F5F4]" : "bg-white"}`}
        title={
          m.createdAt?.toDate?.() ? m.createdAt.toDate().toLocaleString() : ""
        }
      >
        <div className="text-xs text-neutral-500 mb-1">
          {m.role || m.sender?.name || "Someone"}
          {m.editedAt?.toDate?.() && <span className="ml-1">(edited)</span>}
        </div>

        {isEditing ? (
          <>
            <textarea
              className="w-full text-sm border border-neutral-300 rounded p-2"
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="mt-2 text-xs flex gap-3">
              <button
                onClick={() => {
                  onEdit(m.id, editText);
                  setEditingId(null);
                }}
                className="text-[#6A0F14] font-medium"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="text-neutral-500"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {m.text ? (
              <div className="text-neutral-800 whitespace-pre-wrap">
                {m.text}
              </div>
            ) : null}

            {hasFiles && (
              <ul className="mt-2 space-y-1">
                {m.fileUrl.map((f, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={f.url || f.publicUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {humanName(f)}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {mine && !m.__optimistic && (
              <div className="mt-1 text-xs text-neutral-500 flex gap-4">
                <button
                  onClick={() => setEditingId(m.id)}
                  className="hover:underline cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(m.id)}
                  className="hover:underline cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DetailView({ me, card, onBack }) {
  const meUid = me?.uid;

  // chat state
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // local attach-before-send
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef(null);

  // attachments tab aggregated
  const [taskFiles, setTaskFiles] = useState([]); // from task doc
  const [chatFiles, setChatFiles] = useState([]); // from chat docs
  const [tab, setTab] = useState("conversation");
  const listRef = useRef(null);

  // ==== task doc fileUrl (existing files) ====
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const dref = doc(db, card._collection, card.id);
        const snap = await getDoc(dref);
        const data = snap.exists() ? snap.data() : {};
        const arr = Array.isArray(data.fileUrl) ? data.fileUrl : [];
        // normalize: add url via supabase if only "path" provided
        const normalized = await Promise.all(
          arr.map(async (f) => {
            const path = f.path || f.fileName || f.name || "";
            let url = f.url || f.publicUrl || "";
            if (!url && path) {
              const { data } = supabase.storage
                .from("user-tasks-files")
                .getPublicUrl(path);
              url = data?.publicUrl || "";
            }
            return {
              ...f,
              path,
              url,
              source: "task",
              uploadedAtMs:
                f.uploadedAtMs ||
                (f.uploadedAt?.toDate?.()
                  ? f.uploadedAt.toDate().getTime()
                  : null),
            };
          })
        );
        if (!stop) setTaskFiles(normalized);
      } catch (e) {
        if (!stop) setTaskFiles([]);
      }
    })();
    return () => {
      stop = true;
    };
  }, [card._collection, card.id]);

  // ==== chat subscription (this task only; no threadKey) ====
  useEffect(() => {
    const qy = query(
      collection(db, "chats"),
      where("taskCollection", "==", card._collection),
      where("taskId", "==", card.id),
      orderBy("createdAt", "asc")
    );
    const stop = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(rows);

      // collect any files on messages
      const files = [];
      rows.forEach((m) => {
        const arr = Array.isArray(m.fileUrl) ? m.fileUrl : [];
        arr.forEach((f) => {
          files.push({
            ...f,
            source: "chat",
            uploadedAtMs:
              f.uploadedAtMs ||
              (f.uploadedAt?.toDate?.()
                ? f.uploadedAt.toDate().getTime()
                : null) ||
              (m.createdAt?.toDate?.() ? m.createdAt.toDate().getTime() : null),
          });
        });
      });
      setChatFiles(files);

      // autoscroll
      requestAnimationFrame(() => {
        if (listRef.current)
          listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    });
    return () => stop();
  }, [card._collection, card.id]);

  // ==== aggregate attachments for the tab ====
  const allAttachments = useMemo(() => {
    const all = [...taskFiles, ...chatFiles];
    return all
      .map((f) => ({
        ...f,
        displayName: humanName(f),
        when: fmtWhen(f.uploadedAtMs),
      }))
      .sort((a, b) => (b.uploadedAtMs || 0) - (a.uploadedAtMs || 0));
  }, [taskFiles, chatFiles]);

  // composer helpers
  const openPicker = () => fileInputRef.current?.click();
  const onFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
    e.target.value = "";
  };
  const removePending = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadFiles = async () => {
    if (pendingFiles.length === 0) return [];
    const bucket = "user-tasks-files";
    const uploaded = [];
    for (const f of pendingFiles) {
      const ts = Date.now();
      const path = `${card.teamId || "no-team"}/${card.id}/${ts}-${slugSafe(
        f.name
      )}`;
      const { error } = await supabase.storage.from(bucket).upload(path, f, {
        upsert: false,
        contentType: f.type || undefined,
      });
      if (error) {
        // skip failed items but keep sending text/chat
        continue;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      uploaded.push({
        path,
        url: data?.publicUrl || "",
        originalName: f.name,
        size: f.size,
        uploadedAtMs: ts,
      });
    }
    return uploaded;
  };

  const send = async () => {
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;

    setSending(true);
    const optimisticTime = new Date();

    // optimistic message
    const optimistic = {
      id: `tmp-${Date.now()}`,
      text,
      role: me?.role || "Project Manager",
      sender: { uid: meUid || null, name: me?.name || "Unknown" },
      teamId: card.teamId || null,
      teamName: card.teamName || null,
      taskId: card.id,
      taskTitle: card.task || card.chapter || "Task",
      taskCollection: card._collection,
      createdAt: { toDate: () => optimisticTime },
      __optimistic: true,
      type: "message",
      fileUrl: pendingFiles.map((f) => ({
        path: `${card.teamId || "no-team"}/${card.id}/(uploading)-${slugSafe(
          f.name
        )}`,
        url: "",
        originalName: f.name,
        size: f.size,
        uploadedAtMs: optimisticTime.getTime(),
      })),
    };
    if (text || optimistic.fileUrl.length) {
      setMessages((prev) => [...prev, optimistic]);
    }
    setDraft("");

    try {
      // upload to supabase
      const uploaded = await uploadFiles();

      // persist chat doc with fileUrl array + text
      await addDoc(collection(db, "chats"), {
        text,
        role: me?.role || "Project Manager",
        sender: { uid: meUid || null, name: me?.name || "Unknown" },
        teamId: card.teamId || null,
        teamName: card.teamName || null,
        taskId: card.id,
        taskTitle: card.task || card.chapter || "Task",
        taskCollection: card._collection,
        createdAt: serverTimestamp(),
        type: "message",
        fileUrl: uploaded, // <-- final uploaded list
      });
    } finally {
      setSending(false);
      setPendingFiles([]);
      // snapshot listener will refresh and show the saved message & files
    }
  };

  const editMessage = async (id, newText) => {
    const text = (newText || "").trim();
    if (!text) return;
    await updateDoc(doc(db, "chats", id), {
      text,
      editedAt: serverTimestamp(),
    });
  };

  const deleteMessage = async (id) => {
    await deleteDoc(doc(db, "chats", id));
  };

  const computedActivity = useMemo(() => {
    const items = [];
    if (card._colId === "missed")
      items.push({ id: "miss", text: "Task is overdue (Missed Task)." });
    if (card.status)
      items.push({ id: "st", text: `Current status: ${card.status}` });
    messages
      .filter((m) => m.type === "activity")
      .forEach((m) =>
        items.push({
          id: m.id,
          text: m.text || `Activity by ${m.role || "system"}`,
        })
      );
    return items;
  }, [card._colId, card.status, messages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LayoutList className="w-5 h-5" />
        <span className="font-semibold">Task Board</span>
        <ChevronRight className="w-4 h-4 text-neutral-500" />
        <span className="font-semibold">{card.teamName}</span>
      </div>
      <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />

      <button
        onClick={onBack}
        className="cursor-pointer inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Board
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Task meta */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">
              {card.task || card.chapter || "Task"}
            </div>
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full text-white"
              style={{
                backgroundColor:
                  card._colId === "missed"
                    ? "#D11A2A"
                    : card.status === "To Review"
                    ? "#6FA8DC"
                    : card.status === "In Progress"
                    ? "#7C9C3B"
                    : card.status === "Completed"
                    ? MAROON
                    : "#F5B700",
              }}
            >
              {card._colId === "missed"
                ? "Missed Task"
                : card.status || "To Do"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-6 mt-4 text-sm">
            <Field label="Team" value={card.teamName} />
            <Field label="Task Type" value={card.type} />
            <Field label="Methodology" value={card.methodology} />
            <Field label="Project Phase" value={card.phase} />
            <Field label="Revision NO" value={card.revision} />
            <Field label="Date Created" value={card.createdDisplay} />
            <Field label="Due Date" value={card.dueDisplay} />
            <Field label="Time" value={card.time || "—"} />
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="w-4 h-4" />
              Activity
            </div>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {computedActivity.length === 0 ? (
                <li className="text-neutral-500">No activity yet.</li>
              ) : (
                computedActivity.map((a) => <li key={a.id}>• {a.text}</li>)
              )}
            </ul>
          </div>
        </div>

        {/* RIGHT: Conversation / Attachments */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow p-0 overflow-hidden relative">
          {/* Tabs */}
          <div className="px-4 pt-3">
            <div className="flex gap-6 text-sm">
              <button
                onClick={() => setTab("conversation")}
                className={`pb-2 font-medium ${
                  tab === "conversation"
                    ? "border-b-2 border-neutral-800"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                Conversation
              </button>
              <button
                onClick={() => setTab("attachments")}
                className={`pb-2 font-medium inline-flex items-center gap-2 ${
                  tab === "attachments"
                    ? "border-b-2 border-neutral-800"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Paperclip className="w-4 h-4" />
                Attachments
              </button>
            </div>
          </div>
          <div className="h-[1px] bg-neutral-200" />

          {/* Conversation */}
          {tab === "conversation" && (
            <>
              <div className="p-4">
                <div className="rounded-lg border border-neutral-300 overflow-hidden">
                  <div className="px-3 py-2 border-b border-neutral-200 text-sm font-medium">
                    {me?.name || "You"}{" "}
                    <span className="text-neutral-500">({me?.role})</span>
                  </div>
                  <div className="p-3 relative">
                    <textarea
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Write a message…"
                      className="w-full resize-none outline-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />

                    {/* Pending file chips */}
                    {pendingFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pendingFiles.map((f, i) => (
                          <span
                            key={`${f.name}-${i}`}
                            className="inline-flex items-center gap-2 px-2 py-1 rounded border text-xs bg-neutral-50"
                          >
                            {f.name}
                            <button
                              onClick={() => removePending(i)}
                              className="hover:text-red-600"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* hidden picker */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={onFilePick}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                    />

                    <div className="flex items-center gap-2 absolute right-3 bottom-3">
                      <button
                        onClick={openPicker}
                        className="p-1.5 rounded hover:bg-neutral-100 cursor-pointer"
                        title="Attach files"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button
                        onClick={send}
                        disabled={sending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-white cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: MAROON }}
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {sending ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {sending && (
                <div className="absolute inset-0 bg-white/40 pointer-events-none flex items-start justify-end pr-6 pt-24" />
              )}

              <div
                ref={listRef}
                className="px-4 pb-4 max-h-[360px] overflow-y-auto space-y-3"
              >
                {messages.length === 0 ? (
                  <div className="text-sm text-neutral-600">
                    No messages yet. Start the conversation above.
                  </div>
                ) : (
                  messages.map((m) => (
                    <ChatBubble
                      key={
                        m.id ||
                        m._localId ||
                        m.createdAt?.seconds ||
                        Math.random()
                      }
                      m={m}
                      meUid={meUid}
                      onEdit={editMessage}
                      onDelete={deleteMessage}
                      editingId={editingId}
                      setEditingId={setEditingId}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* Attachments */}
          {tab === "attachments" && (
            <div className="p-4">
              <div className="rounded-lg border border-neutral-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">
                        Attachment
                      </th>
                      <th className="text-right px-4 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {allAttachments.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-6 text-center text-neutral-500"
                          colSpan={2}
                        >
                          No attachments yet.
                        </td>
                      </tr>
                    ) : (
                      allAttachments.map((f, i) => (
                        <tr
                          key={`${f.path || f.url || i}`}
                          className="hover:bg-neutral-50"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-red-600">
                                <Paperclip className="w-4 h-4" />
                              </span>
                              <a
                                href={f.url || f.publicUrl || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[15px] hover:underline cursor-pointer"
                                title={
                                  f.source === "task" ? "[task]" : "[chat]"
                                }
                              >
                                {humanName(f)}
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-700">
                            {f.when || ""}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ Main ============================ */
export default function TaskBoard() {
  const [me, setMe] = useState(null); // { uid, name, role, photoURL }
  const [teams, setTeams] = useState([]);
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState(null);

  // Identify user
  useEffect(() => {
    const stop = onAuthStateChanged(auth, async (u) => {
      const uid = u?.uid || localStorage.getItem("uid") || "";
      if (!uid) return setMe(null);

      let profile = null;
      try {
        const qUser = query(
          collection(db, "users"),
          where("uid", "==", uid),
          limit(1)
        );
        const snap = await getDocs(qUser);
        if (!snap.empty) profile = snap.docs[0].data();
      } catch (_) {}

      setMe({
        uid,
        name: safeName(profile),
        role: profile?.role || "Project Manager",
        photoURL: profile?.photoURL || null,
      });
    });
    return () => stop();
  }, []);

  // Load my teams (PM or Adviser)
  useEffect(() => {
    if (!me?.uid) return;
    const isPM = (me.role || "").toLowerCase().includes("project");
    const qTeams = isPM
      ? query(
          collection(db, "teams"),
          where("projectManager.uid", "==", me.uid)
        )
      : query(collection(db, "teams"), where("adviser.uid", "==", me.uid));

    const stop = onSnapshot(qTeams, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeams(list);
    });
    return () => stop();
  }, [me?.uid, me?.role]);

  // Subscribe tasks for my teams (taskManager == "Adviser" OR "Project Manager" depending on role)
  useEffect(() => {
    if (teams.length === 0) {
      setCards([]);
      return;
    }
    const teamIds = teams.map((t) => t.id);
    const chunks = (arr, n = 10) =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
        arr.slice(i * n, i * n + n)
      );

    const allStops = [];
    const buffer = new Map();

    const collectUpdates = (collectionName, snap) => {
      for (const d of snap.docs) {
        const x = d.data();
        const t = x.team || {};
        const teamId = t.id || x.teamId || "no-team";
        const teamName =
          t.name || teams.find((tt) => tt.id === teamId)?.name || "No Team";

        const created =
          typeof x.createdAt?.toDate === "function"
            ? x.createdAt.toDate()
            : null;
        const createdDisplay = created ? created.toLocaleDateString() : "—";

        const dueDate = x.dueDate || null;
        const time = x.dueTime || null;
        const dueDisplay = dueDate || "—";
        const dueAtMs =
          x.dueAtMs ??
          (dueDate && time
            ? new Date(`${dueDate}T${time}:00`).getTime()
            : null);

        let colId = STATUS_TO_COLUMN[x.status || "To Do"] || "todo";
        const now = Date.now();
        const isOverdue =
          !!dueAtMs && dueAtMs < now && (x.status || "To Do") !== "Completed";
        if (isOverdue) colId = "missed";

        const key = `${collectionName}:${d.id}`;
        buffer.set(key, {
          id: d.id,
          _collection: collectionName,
          _colId: colId,
          teamId,
          teamName,
          task: x.task || x.chapter || "Task",
          chapter: x.chapter || null,
          type: x.type || null,
          methodology: x.methodology || null,
          phase: x.phase || null,
          revision: x.revision || "No Revision",
          status: x.status || "To Do",
          time: time || "—",
          dueDisplay,
          createdDisplay,
          dueAtMs: dueAtMs || null,
        });
      }
      setCards(Array.from(buffer.values()));
    };

    const attach = (collectionName, managerLabel) => {
      chunks(teamIds, 10).forEach((ids) => {
        const stopA = onSnapshot(
          query(
            collection(db, collectionName),
            where("taskManager", "==", managerLabel),
            where("team.id", "in", ids)
          ),
          (snap) => collectUpdates(collectionName, snap)
        );
        const stopB = onSnapshot(
          query(
            collection(db, collectionName),
            where("taskManager", "==", managerLabel),
            where("teamId", "in", ids)
          ),
          (snap) => collectUpdates(collectionName, snap)
        );
        allStops.push(stopA, stopB);
      });
    };

    const managerLabel = (me.role || "").toLowerCase().includes("project")
      ? "Project Manager"
      : "Adviser";

    attach("oralDefenseTasks", managerLabel);
    attach("finalDefenseTasks", managerLabel);

    return () => {
      allStops.forEach((s) => s && s());
    };
  }, [teams, me?.role]);

  // group by column
  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]));
    for (const c of cards) map[c._colId]?.push(c);
    return map;
  }, [cards]);

  if (selected) {
    return (
      <DetailView me={me} card={selected} onBack={() => setSelected(null)} />
    );
  }

  return (
    <div className="space-y-4 min-h-0">
      <div className="flex items-center gap-2">
        <LayoutList className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Task Board</h2>
      </div>
      <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />

      <div className="min-h-[520px] max-h-[70vh]">
        <div className="h-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <Column key={col.id} title={col.title} color={col.color}>
              {grouped[col.id].length === 0 ? (
                <div className="text-sm text-neutral-500">No tasks.</div>
              ) : (
                grouped[col.id].map((card) => (
                  <KanbanCard
                    key={`${card._collection}:${card.id}`}
                    data={card}
                    onOpen={setSelected}
                  />
                ))
              )}
            </Column>
          ))}
        </div>
      </div>
    </div>
  );
}
