// src/components/CapstoneMember/MemberTasksBoard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutList,
  StickyNote,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  Send,
  MessageSquareText,
  Loader2,
  MoreVertical,
} from "lucide-react";


/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  limit,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";


/* ===== Supabase (for uploads & public URLs) ===== */
import { supabase } from "../../config/supabase";


const MAROON = "#6A0F14";


/* ========================== Helpers ========================== */
const COLUMNS = [
  { id: "todo", title: "To Do", color: "#F5B700" },
  { id: "inprogress", title: "In Progress", color: "#7C9C3B" },
  { id: "review", title: "To Review", color: "#6FA8DC" },
  { id: "missed", title: "Missed", color: "#6A0F14" },
];


const STATUS_TO_COLUMN = {
  "To Do": "todo",
  "In Progress": "inprogress",
  "To Review": "review",
};


const cardShell =
  "bg-white border border-neutral-200 rounded-lg shadow-sm hover:shadow transition-shadow";


const safeName = (u) =>
  [u?.firstName, u?.middleName ? `${u.middleName[0]}.` : null, u?.lastName]
    .filter(Boolean)
    .join(" ") || "Unknown";


const BUCKET = "user-tasks-files";


const safeFileName = (name = "") =>
  name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_");


const buildTaskFolder = (card) => `${card._collection}/${card.id}`;


const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(+d) ? null : d;
};


const formatDate = (date) => {
  if (!date) return "—";
  if (typeof date.toDate === "function") {
    date = date.toDate();
  }
  if (date instanceof Date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  const d = new Date(date);
  return Number.isNaN(+d) ? date : d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};


const formatTime = (timeString) => {
  if (!timeString) return "—";
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch (e) {
    return timeString;
  }
};


const formatDateTime = (timestamp) => {
  if (!timestamp) return "";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return "";
  }
};


const uniqBy = (arr, keyFn) => {
  const m = new Map();
  arr.forEach((x) => m.set(keyFn(x), x));
  return Array.from(m.values());
};


const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
 
  // Get first letter of first name and first letter of last name
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};


/* ======================= Confirmation Dialog ======================= */
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
                onClose();
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#5A0D12]"
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


/* ======================= Reusable UI ========================= */
function Column({ title, color, children }) {
  return (
    <div className="flex flex-col bg-white border border-neutral-200 rounded-xl shadow h-fit">
      <div
        className="px-4 py-3 rounded-t-xl text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        {title}
      </div>
      <div className="flex-1 min-h-0">
        <div className="h-full px-3 py-3 space-y-3">
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


        <div className="mt-3 text-xs flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              data._colId === "missed" ? "bg-[#6A0F14]" : "bg-neutral-400"
            } inline-block`}
          />
          <span className="font-bold" style={{ color: MAROON }}>
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


function Comment({ message, meUid, onEdit, onDelete, onReply, editingId, setEditingId, replyingTo, setReplyingTo, depth = 0 }) {
  const isMine = message.sender?.uid === meUid;
  const [editText, setEditText] = useState(message.text);
  const [replyText, setReplyText] = useState("");
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const isEditing = editingId === message.id && isMine;
  const isReplying = replyingTo === message.id;


  // Disable edit if message has already been edited
  const canEdit = isMine && !message.__optimistic && !message.editedAt;


  const handleEditConfirm = () => {
    onEdit(message.id, editText);
    setEditingId(null);
    setShowEditConfirm(false);
  };


  const handleDeleteConfirm = () => {
    onDelete(message.id);
    setShowDeleteConfirm(false);
  };


  const handleReply = () => {
    if (replyText.trim()) {
      onReply(message.id, replyText);
      setReplyText("");
      setShowReplyInput(false);
      setReplyingTo(null);
    }
  };


  const handleCancelReply = () => {
    setReplyText("");
    setShowReplyInput(false);
    setReplyingTo(null);
  };


  // Calculate indentation based on depth
  const indentClass = depth > 0 ? `ml-12` : "";


  return (
    <>
      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={showEditConfirm}
        onClose={() => setShowEditConfirm(false)}
        onConfirm={handleEditConfirm}
        title="Edit Comment"
        message="Are you sure you want to edit this comment? This action cannot be undone."
        confirmText="Yes, Edit"
        cancelText="No, Cancel"
      />


      <ConfirmationDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? Replies will be promoted to main comments."
        confirmText="Yes, Delete"
        cancelText="No, Cancel"
      />


      <div className={`flex gap-3 mb-6 last:mb-0 ${indentClass}`}>
        {/* Profile Icon */}
        <div className="flex-shrink-0">
          <div
            className="w-10 h-10 rounded-full bg-[#6A0F14] flex items-center justify-center text-white font-semibold text-sm"
            title={message.sender?.name || "Unknown User"}
          >
            {getInitials(message.sender?.name)}
          </div>
        </div>


        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          {/* Header with name and timestamp inline */}
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-[15px] text-gray-900">
              {message.sender?.name || "Unknown User"}
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">
              {formatDateTime(message.createdAt)}
            </span>
            {message.editedAt?.toDate?.() && (
              <>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500">(edited)</span>
              </>
            )}
          </div>


          {/* Comment Body */}
          <div className="mb-2">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6A0F14] focus:border-transparent text-sm"
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEditConfirm(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#6A0F14] rounded-lg hover:bg-[#5A0D12] transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditText(message.text);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* FIX: Ensure proper line break preservation with multiple CSS classes */}
                <div className="text-sm text-gray-800 leading-relaxed mt-1 whitespace-pre-wrap break-words w-full overflow-hidden">
                  {message.text || (
                    <span className="italic text-gray-500">[no text]</span>
                  )}
                </div>
               
                {/* Display attached files in the comment - REMOVED BORDER BOX */}
                {message.sender?.fileUrl?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.sender.fileUrl.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Paperclip className="w-4 h-4 text-red-600" />
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={file.originalName || file.fileName}
                          className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[200px]"
                          title={file.originalName || file.fileName}
                        >
                          {file.originalName || file.fileName}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>


          {/* Action Buttons */}
          {!isEditing && (
            <div className="flex items-center gap-4 mt-2">
              {canEdit && (
                <button
                  onClick={() => {
                    setEditingId(message.id);
                    setEditText(message.text);
                  }}
                  className="text-xs text-[#6A0F14] font-medium hover:text-[#5A0D12] transition-colors"
                >
                  Edit
                </button>
              )}
              {isMine && !message.__optimistic && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-red-600 font-medium hover:text-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
              {!isMine && (
                <button
                  onClick={() => {
                    setShowReplyInput(true);
                    setReplyingTo(message.id);
                  }}
                  className="text-xs text-[#6A0F14] font-medium hover:text-[#5A0D12] transition-colors"
                >
                  Reply
                </button>
              )}
            </div>
          )}


          {/* Reply Input */}
          {(showReplyInput || isReplying) && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-full bg-[#6A0F14] flex items-center justify-center text-white font-semibold text-xs"
                    title="You"
                  >
                    {getInitials("You")}
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply…"
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6A0F14] focus:border-transparent text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancelReply}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReply}
                      disabled={!replyText.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[#6A0F14] rounded-lg hover:bg-[#5A0D12] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* ONE-LEVEL-only Replies */}
          {message.replies && message.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {message.replies.map((reply) => (
                <Comment
                  key={reply.id}
                  message={reply}
                  meUid={meUid}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReply={onReply}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  depth={1} // always one-level indent
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}


function DetailView({ me, card, onBack }) {
  const meUid = me?.uid;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [tab, setTab] = useState("comments");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [attRows, setAttRows] = useState([]);
  const [hydrating, setHydrating] = useState(false);
  const listRef = useRef(null);


  // Helper: flatten messages so replies are only 1-level deep and no duplicates
  const flattenMessages = (rows) => {
    // Build map of id -> message (shallow clone) with replies array
    const map = new Map();
    rows.forEach((m) => map.set(m.id, { ...m, replies: [] }));


    // Attach direct replies to their parent (only direct)
    rows.forEach((m) => {
      if (m.parentId && map.has(m.parentId)) {
        const parent = map.get(m.parentId);
        parent.replies.push(map.get(m.id));
      }
    });


    // Function to recursively collect all descendants of a message
    const collectDescendants = (msg, visited = new Set()) => {
      let acc = [];
      // copy of current direct replies (from map)
      const direct = msg.replies ? [...msg.replies] : [];
      for (const r of direct) {
        if (!visited.has(r.id)) {
          visited.add(r.id);
          acc.push(r);
          // If that reply itself has children in the original dataset, collect them
          // The children of r are available via map.get(r.id).replies only if they were attached earlier
          const deeper = collectDescendants(map.get(r.id) || r, visited);
          if (deeper.length) acc = acc.concat(deeper);
        }
      }
      return acc;
    };


    // Build top-level array (messages without parentId)
    const topLevel = [];
    rows.forEach((m) => {
      if (!m.parentId) {
        const base = map.get(m.id);
        // collect all nested replies and flatten to single-level
        const flatReplies = collectDescendants(base);
        // ensure uniqueness and sort by createdAt
        const unique = Array.from(
          new Map(flatReplies.map((r) => [r.id, r])).values()
        );
        unique.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return aTime - bTime;
        });
        // assign flattened replies and clear any nested replies on children
        base.replies = unique.map((r) => ({ ...r, replies: [] }));
        topLevel.push(base);
      }
    });


    // Sort top-level messages by createdAt ascending (keep original ordering)
    topLevel.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return aTime - bTime;
    });


    return topLevel;
  };


  useEffect(() => {
    if (!card?.id) return;
    const filters = [
      where("taskCollection", "==", card._collection),
      where("taskId", "==", card.id),
    ];
    if (card.teamId) filters.push(where("teamId", "==", card.teamId));
    const qy = query(
      collection(db, "chats"),
      ...filters,
      orderBy("createdAt", "asc")
    );


    const stop = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt,
        editedAt: d.data().editedAt
      }));


      // flatten and de-duplicate replies so UI shows one-level replies only
      const organized = flattenMessages(rows);
      setMessages(organized);


      // scroll to bottom
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    });


    return () => typeof stop === "function" && stop();
  }, [card]);


  const hydrateAttachments = async () => {
    setHydrating(true);
    try {
      const merged = [];
      const folder = buildTaskFolder(card);


      const taskSnap = await getDoc(doc(db, card._collection, card.id));
      if (taskSnap.exists()) {
        const data = taskSnap.data() || {};
        const arr = Array.isArray(data.fileUrl) ? data.fileUrl : [];
        for (const f of arr) {
          const fileName = f.fileName || f.name || "";
          const originalName = f.originalName || fileName;
          let url = f.url || f.publicUrl || null;
          if (!url && fileName) {
            const { data: pub } = supabase.storage
              .from(BUCKET)
              .getPublicUrl(`${folder}/${fileName}`);
            url = pub?.publicUrl || null;
          }
          merged.push({
            name: fileName,
            originalName: originalName,
            url,
            date: toDate(f.uploadedAt) || toDate(data.createdAt) || null,
            source: "task",
          });
        }
      }


      const filters = [
        where("taskCollection", "==", card._collection),
        where("taskId", "==", card.id),
      ];
      if (card.teamId) filters.push(where("teamId", "==", card.teamId));
      const snap = await getDocs(query(collection(db, "chats"), ...filters));
      snap.forEach((d) => {
        const m = d.data();
        const files =
          (Array.isArray(m?.sender?.fileUrl) && m.sender.fileUrl) ||
          (Array.isArray(m?.fileUrl) && m.fileUrl) ||
          [];
        files.forEach((f, i) => {
          merged.push({
            name: f.fileName || f.name || `Attachment ${i + 1}`,
            originalName: f.originalName || f.fileName || f.name || `Attachment ${i + 1}`,
            url: f.url || f.publicUrl || null,
            date: toDate(f.uploadedAt) || toDate(m.createdAt) || null,
            source: "chat",
          });
        });
      });


      const unique = uniqBy(
        merged,
        (x) => `${x.source}:${x.name}:${x.url || ""}`
      );
      unique.sort(
        (a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0)
      );
      setAttRows(unique);
    } finally {
      setHydrating(false);
    }
  };


  useEffect(() => {
    if (tab === "attachment") hydrateAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);


  const openPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length) setPendingFiles((prev) => [...prev, ...files]);
    };
    input.click();
  };


  const removePending = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };


  const send = async (parentId = null) => {
    const text = (draft || "").trim();
    if (!text && pendingFiles.length === 0) return;


    setSending(true);
    const uploads = [];


    try {
      const folder = buildTaskFolder(card);


      for (const f of pendingFiles) {
        // Use original file name without timestamp prefix
        const originalName = f.name;
        const filename = safeFileName(originalName);
        const storagePath = `${folder}/${filename}`;
       
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, f, {
            contentType: f.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) throw upErr;


        const { data: pub } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);
        uploads.push({
          fileName: filename,
          originalName: originalName, // Store original file name
          url: pub?.publicUrl || null,
          storagePath,
          uploadedAt: new Date().toISOString(),
        });
      }


      const optimistic = {
        id: `tmp-${Date.now()}`,
        text,
        parentId: parentId || null,
        role: me?.role || "Member",
        sender: {
          uid: meUid,
          name: me?.name || "Unknown",
          fileUrl: uploads
        },
        teamId: card.teamId || null,
        teamName: card.teamName || null,
        taskId: card.id,
        taskTitle: card.task || card.chapter || "Task",
        taskCollection: card._collection,
        createdAt: new Date(),
        __optimistic: true,
        type: "message",
      };
     
      // Optimistic update: if top-level, push to messages; if reply, attach to parent (local)
      setMessages(prev => {
        if (!parentId) {
          return [...prev, optimistic];
        }
       
        const addReply = (messages) => {
          return messages.map(msg => {
            if (msg.id === parentId) {
              // ensure replies array exists
              return {
                ...msg,
                replies: [...(msg.replies || []), optimistic]
              };
            }
            // Recursively check if the parent is a reply
            if (msg.replies && msg.replies.length > 0) {
              return { ...msg, replies: addReply(msg.replies) };
            }
            return msg;
          });
        };
       
        return addReply(prev);
      });
     
      setDraft("");
      setPendingFiles([]);


      await addDoc(collection(db, "chats"), {
        text,
        parentId: parentId || null,
        role: me?.role || "Member",
        sender: {
          uid: meUid || null,
          name: me?.name || "Unknown",
          fileUrl: uploads,
        },
        teamId: card.teamId || null,
        teamName: card.teamName || null,
        taskId: card.id,
        taskTitle: card.task || card.chapter || "Task",
        taskCollection: card._collection,
        createdAt: serverTimestamp(),
        type: "message",
      });


      if (tab === "attachment") hydrateAttachments();
    } catch (e) {
      console.error("[chat] send failed:", e);
      alert("Failed to send. Check console for details.");
    } finally {
      setSending(false);
    }
  };


  const sendReply = async (parentId, replyText) => {
    if (!replyText.trim()) return;


    setSending(true);
    try {
      const optimistic = {
        id: `tmp-reply-${Date.now()}`,
        text: replyText,
        parentId: parentId,
        role: me?.role || "Member",
        sender: {
          uid: meUid,
          name: me?.name || "Unknown",
          fileUrl: []
        },
        teamId: card.teamId || null,
        teamName: card.teamName || null,
        taskId: card.id,
        taskTitle: card.task || card.chapter || "Task",
        taskCollection: card._collection,
        createdAt: new Date(),
        __optimistic: true,
        type: "message",
      };


      // Optimistic update: attach reply to parent (local)
      setMessages(prev => {
        const addReply = (messages) => {
          return messages.map(msg => {
            if (msg.id === parentId) {
              return { ...msg, replies: [...(msg.replies || []), optimistic] };
            }
            // Recursively check if the parent is a reply
            if (msg.replies && msg.replies.length > 0) {
              return { ...msg, replies: addReply(msg.replies) };
            }
            return msg;
          });
        };
        return addReply(prev);
      });


      await addDoc(collection(db, "chats"), {
        text: replyText,
        parentId: parentId,
        role: me?.role || "Member",
        sender: {
          uid: meUid || null,
          name: me?.name || "Unknown",
          fileUrl: [],
        },
        teamId: card.teamId || null,
        teamName: card.teamName || null,
        taskId: card.id,
        taskTitle: card.task || card.chapter || "Task",
        taskCollection: card._collection,
        createdAt: serverTimestamp(),
        type: "message",
      });


    } catch (e) {
      console.error("[chat] reply failed:", e);
      alert("Failed to send reply. Check console for details.");
    } finally {
      setSending(false);
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


  /**
   * FIX: Deletes the specified message and promotes its direct replies
   * to become top-level messages by setting their parentId to null in Firestore.
   * This relies on the onSnapshot listener to update the local state correctly.
   */
  const deleteMessage = async (id) => {
    try {
      // 1. Find and promote all direct replies to be top-level messages in Firestore
      const repliesQuery = query(
        collection(db, "chats"),
        where("parentId", "==", id)
      );
      // Use getDocs to fetch the replies so we can update them
      const repliesSnap = await getDocs(repliesQuery);


      if (!repliesSnap.empty) {
        const promotePromises = repliesSnap.docs.map((docSnapshot) => {
          // Update the reply's parentId to null to promote it
          return updateDoc(doc(db, "chats", docSnapshot.id), {
            parentId: null,
          });
        });
        // Wait for all replies to be promoted
        await Promise.all(promotePromises);
      }


      // 2. Delete the original message in Firestore
      await deleteDoc(doc(db, "chats", id));


      // The onSnapshot listener will automatically handle the local state update
      // with the deleted comment removed and the replies promoted.


    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment.");
    } finally {
      setSending(false);
    }
  };


  const renderComments = (messages, depth = 0) => {
    return messages.map((message) => (
      <Comment
        key={message.id || message._localId || Math.random()}
        message={message}
        meUid={meUid}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReply={sendReply}
        editingId={editingId}
        setEditingId={setEditingId}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        depth={depth}
      />
    ));
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
          <LayoutList className="w-5 h-5" />
          <span>Task Board</span>
        </div>
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Details Panel */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xl font-semibold text-gray-900">
              {card.teamName || "No Team"}
            </div>
            <span
              className="text-sm font-semibold px-4 py-2 rounded-full text-white"
              style={{
                backgroundColor:
                  card._colId === "missed"
                    ? "#6A0F14"
                    : card.status === "To Review"
                    ? "#6FA8DC"
                    : card.status === "In Progress"
                    ? "#7C9C3B"
                    : "#F5B700",
              }}
            >
              {card._colId === "missed"
                ? "Missed"
                : card.status || "To Do"}
            </span>
          </div>


          {/* Task Fields */}
          <div className="space-y-4">
            <Field label="Tasks" value={card.task} />
            <Field label="Subtasks" value={card.subtask || "—"} />
            <Field label="Elements" value={card.elements || "—"} />
            <Field label="Date Created" value={card.createdDisplay} />
            <Field label="Due Date" value={card.dueDisplay} />
            <Field label="Time" value={card.timeDisplay || "—"} />
            <Field label="Revision NO" value={card.revision} />
            <Field label="Status" value={card.status} />
            <Field label="Methodology" value={card.methodology} />
            <Field label="Project Phase" value={card.phase} />
          </div>
        </div>


        {/* Comments & Attachments Panel */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow overflow-hidden flex flex-col h-[700px]">
          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="flex gap-8 text-sm border-b border-neutral-200">
              <button
                onClick={() => setTab("comments")}
                className={`pb-3 font-medium transition-colors relative ${
                  tab === "comments"
                    ? "text-[#6A0F14] font-semibold"
                    : "text-neutral-600 hover:text-neutral-800"
                }`}
              >
                Comments
                {tab === "comments" && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#6A0F14] rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setTab("attachment")}
                className={`pb-3 font-medium transition-colors relative ${
                  tab === "attachment"
                    ? "text-[#6A0F14] font-semibold"
                    : "text-neutral-600 hover:text-neutral-800"
                }`}
              >
                Attachment
                {tab === "attachment" && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#6A0F14] rounded-t-full" />
                )}
              </button>
            </div>
          </div>


          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {tab === "comments" && (
              <>
                {/* Comment Input - AT THE TOP */}
                <div className="border-b border-neutral-200 p-6">
                  <div className="space-y-4">
                    {/* User Profile and Name */}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full bg-[#6A0F14] flex items-center justify-center text-white font-semibold text-sm"
                          title={me?.name || "You"}
                        >
                          {getInitials(me?.name)}
                        </div>
                      </div>
                      <span className="font-semibold text-[15px] text-gray-900">
                        {me?.name || "You"}
                      </span>
                    </div>
                   
                    {/* Textarea */}
                    <div className="space-y-3">
                      <textarea
                        rows={3}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Write a comment…"
                        className="w-full p-4 border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6A0F14] focus:border-transparent text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />


                      {/* Pending Files - REMOVED BORDER BOX */}
                      {pendingFiles.length > 0 && (
                        <div className="space-y-2">
                          {pendingFiles.map((f, i) => (
                            <div
                              key={`${f.name}-${i}`}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Paperclip className="w-4 h-4 text-red-600" />
                              <span className="text-gray-700 truncate max-w-[200px]">
                                {f.name}
                              </span>
                              <button
                                onClick={() => removePending(i)}
                                className="text-gray-500 hover:text-gray-700 p-1"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}


                      {/* Action Buttons - Attach icon before Send */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={openPicker}
                          className="p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="Attach files"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => send()}
                          disabled={sending || (!draft.trim() && pendingFiles.length === 0)}
                          className="inline-flex items-center gap-2 px-6 py-2 bg-[#6A0F14] text-white rounded-lg hover:bg-[#5A0D12] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {sending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Send
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>


                {/* Comments List - BELOW THE INPUT */}
                <div
                  ref={listRef}
                  className="flex-1 overflow-y-auto p-6 space-y-6"
                >
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <MessageSquareText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No comments yet. Start the conversation above.</p>
                    </div>
                  ) : (
                    renderComments(messages, 0)
                  )}
                </div>
              </>
            )}


            {tab === "attachment" && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-gray-50 rounded-lg border border-neutral-200 overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-3/4" />
                      <col className="w-1/4" />
                    </colgroup>
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">
                          Attachment
                        </th>
                        <th className="text-left px-3 py-3 font-semibold"> {/* Reduced padding-left from px-4 to px-3 */}
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {hydrating ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-gray-500" colSpan={2}>
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                            Loading attachments…
                          </td>
                        </tr>
                      ) : attRows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-gray-500" colSpan={2}>
                            <Paperclip className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            No attachments yet.
                          </td>
                        </tr>
                      ) : (
                        attRows.map((f, i) => (
                          <tr
                            key={`${f.name}-${i}`}
                            className="hover:bg-white transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Paperclip className="w-4 h-4 text-red-600 flex-shrink-0" />
                                {f.url ? (
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={f.originalName || f.name}
                                    className="text-blue-600 hover:text-blue-800 hover:underline truncate"
                                    title={f.originalName || f.name}
                                  >
                                    {f.originalName || f.name}
                                  </a>
                                ) : (
                                  <span className="text-gray-700 truncate">
                                    {f.originalName || f.name}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                  {f.source}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-gray-600 whitespace-nowrap"> {/* Reduced padding-left from px-4 to px-3 */}
                              {f.date ? formatDate(f.date) : "—"}
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
    </div>
  );
}


/* ============================ Main ============================ */
export default function MemberTasksBoard() {
  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState([]);
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("team"); // "team" | "adviser"


  const location = useLocation();


  // auto-open when navigated with state
  useEffect(() => {
    if (location.state?.selectedTask) {
      setSelected({
        ...location.state.selectedTask,
        _collection: location.state.selectedTask.sourceColl,
      });
      // clear history state to avoid re-opening on back/refresh
      try {
        window.history.replaceState({}, document.title);
      } catch (e) {}
    }
  }, [location.state]);


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
        role: profile?.role || "Member",
        photoURL: profile?.photoURL || null,
      });
    });
    return () => stop();
  }, []);


  // Get teams that the member belongs to
  useEffect(() => {
    if (!me?.uid) return;


    const stop = onSnapshot(
      query(collection(db, "teams"), where("members", "array-contains", me.uid)),
      (snap) => {
        const teamData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeams(teamData);
      }
    );


    return () => typeof stop === "function" && stop();
  }, [me?.uid]);


  const unsubsRef = useRef([]);
  useEffect(() => {
    unsubsRef.current.forEach((u) => typeof u === "function" && u());
    unsubsRef.current = [];


    if (teams.length === 0) {
      setCards([]);
      return;
    }


    const teamIds = teams.map((t) => t.id);
    const chunks = (arr, n = 10) =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
        arr.slice(i * n, i * n + n)
      );


    const store = {
      titleDefenseTasks: { A: new Map(), B: new Map() },
      oralDefenseTasks: { A: new Map(), B: new Map() },
      finalDefenseTasks: { A: new Map(), B: new Map() },
      finalRedefenseTasks: { A: new Map(), B: new Map() },
    };


    const normalize = (collectionName, d) => {
      const x = d.data();
     
      // Filter out completed tasks
      if (x.status === "Completed") {
        return null;
      }


      const t = x.team || {};
      const teamId = t.id || x.teamId || "no-team";
      const teamName =
        t.name || teams.find((tt) => tt.id === teamId)?.name || "No Team";


      const created =
        typeof x.createdAt?.toDate === "function" ? x.createdAt.toDate() : null;
      const createdDisplay = formatDate(x.createdAt);


      const dueDate = x.dueDate || null;
      const time = x.dueTime || null;
      const timeDisplay = formatTime(time);
      const dueDisplay = formatDate(dueDate);
      const dueAtMs =
        x.dueAtMs ??
        (dueDate && time ? new Date(`${dueDate}T${time}:00`).getTime() : null);


      let colId = STATUS_TO_COLUMN[x.status || "To Do"] || "todo";
      const now = Date.now();
      const isOverdue =
        !!dueAtMs && dueAtMs < now && (x.status || "To Do") !== "Completed";
      if (isOverdue) colId = "missed";


      // Check if task should be included based on tab and assignment
      const shouldIncludeTask = () => {
        // For adviser tasks, include all tasks for the team regardless of assignment
        if (x.taskManager === "Adviser") {
          return true;
        }


        // For team tasks, check if assigned to current member
        // Check assignees array
        if (Array.isArray(x.assignees)) {
          return x.assignees.some(assignee =>
            assignee.uid === me.uid || assignee === me.uid
          );
        }
       
        // Check assignedMember
        if (x.assignedMember && x.assignedMember.uid === me.uid) {
          return true;
        }
       
        // Check assignedTo field (string comparison)
        if (x.assignedTo && me.name) {
          return x.assignedTo.includes(me.name);
        }
       
        return false;
      };


      // Only include tasks that pass the assignment check
      if (!shouldIncludeTask()) {
        return null;
      }


      const cardData = {
        id: d.id,
        _collection: collectionName,
        _colId: colId,
        teamId,
        teamName,
        assignedTo: me.name, // Show member's own name
        task: x.task || x.chapter || "Task",
        chapter: x.chapter || null,
        type: x.type || null,
        methodology: x.methodology || null,
        phase: x.phase || null,
        revision: x.revision || "No Revision",
        status: x.status || "To Do",
        time: time || "—",
        timeDisplay,
        dueDisplay,
        createdDisplay,
        dueAtMs: dueAtMs || null,
        taskManager: x.taskManager || "Project Manager",
      };


      // Extract subtask and elements with comprehensive field checking
      const subtask =
        x.subtask ||
        x.subtasks ||
        x.subTask ||
        x.subTasks ||
        null;
     
      const elements =
        x.elements ||
        x.element ||
        x.scope ||
        null;


      // Handle different data types for subtask and elements
      if (subtask) {
        if (Array.isArray(subtask)) {
          cardData.subtask = subtask.join(", ");
        } else if (typeof subtask === 'string') {
          cardData.subtask = subtask;
        } else if (typeof subtask === 'object') {
          cardData.subtask = JSON.stringify(subtask);
        }
      }


      if (elements) {
        if (Array.isArray(elements)) {
          cardData.elements = elements.join(", ");
        } else if (typeof elements === 'string') {
          cardData.elements = elements;
        } else if (typeof elements === 'object') {
          cardData.elements = JSON.stringify(elements);
        }
      }


      return cardData;
    };


    const publish = () => {
      const unionMap = new Map();
      for (const coll of [
        "titleDefenseTasks",
        "oralDefenseTasks",
        "finalDefenseTasks",
        "finalRedefenseTasks",
      ]) {
        for (const subset of ["A", "B"]) {
          store[coll][subset].forEach((val, key) => {
            if (val) { // Skip null values (completed tasks and tasks not assigned to member)
              unionMap.set(`${coll}:${key}`, val);
            }
          });
        }
      }
     
      // Filter cards based on selected tab
      const filteredCards = Array.from(unionMap.values()).filter(card => {
        if (activeTab === "adviser") {
          return card.taskManager === "Adviser";
        } else {
          return card.taskManager === "Project Manager";
        }
      });
     
      setCards(filteredCards);
    };


    const attach = (collectionName) => {
      chunks(teamIds, 10).forEach((ids) => {
        const q = query(collection(db, collectionName), where("team.id", "in", ids));
        const unsub = onSnapshot(q, (snap) => {
          const next = new Map();
          snap.docs.forEach((d) => {
            const normalized = normalize(collectionName, d);
            if (normalized) {
              next.set(d.id, normalized);
            }
          });
          store[collectionName].A = next;
          publish();
        });
        unsubsRef.current.push(unsub);
      });
    };


    attach("titleDefenseTasks");
    attach("oralDefenseTasks");
    attach("finalDefenseTasks");
    attach("finalRedefenseTasks");


    return () => {
      unsubsRef.current.forEach((u) => typeof u === "function" && u());
      unsubsRef.current = [];
    };
  }, [teams, activeTab, me]);


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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
          <LayoutList className="w-5 h-5" />
          <span>Task Board</span>
        </div>
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
      </div>


      {/* Modern Tab Design */}
      <div className="flex border-b border-neutral-200">
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


      {/* Responsive Kanban Board */}
      <div className="min-h-[520px]">
        <div className="h-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {COLUMNS.map((col) => (
            <Column key={col.id} title={col.title} color={col.color}>
              {grouped[col.id].length === 0 ? (
                <div className="text-sm text-neutral-500 text-center py-8">
                  {activeTab === "adviser"
                    ? "No adviser tasks."
                    : "No team tasks."}
                </div>
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


