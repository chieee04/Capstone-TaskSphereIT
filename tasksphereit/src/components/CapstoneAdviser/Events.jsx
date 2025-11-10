// src/components/CapstoneAdviser/Events.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  BookOpenCheck,
  Presentation,
  GraduationCap,
  Paperclip,
  X,
  Download,
  ExternalLink,
  MoreVertical,
  Edit,
  Check,
  X as CloseIcon,
} from "lucide-react";
 
import { getAdviserEvents } from "../../services/events";
import { auth } from "../../config/firebase";
 
/* ===== Firebase ===== */
import { db } from "../../config/firebase";
import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  onSnapshot 
} from "firebase/firestore";
 
/* ===== Supabase ===== */
import { supabase } from "../../config/supabase";
 
const MAROON = "#6A0F14";
 
/** Must match your Firestore collection name */
const MANUSCRIPT_COLLECTION = "manuscriptSubmissions";
const TEAMS_COLLECTION = "teams";
 
const to12h = (t) => {
  if (!t) return "";
  const [Hraw, Mraw] = String(t).split(":");
  const H = Number(Hraw ?? 0);
  const M = Number(Mraw ?? 0);
  const ampm = H >= 12 ? "PM" : "AM";
  const hh = ((H + 11) % 12) + 1;
  return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
};
 
const CardTable = ({ children }) => (
  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">{children}</table>
    </div>
  </div>
);
 
const Pill = ({ children, editable, onClick }) => (
  <span
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs inline-flex border border-neutral-300 text-neutral-700 ${
      editable
        ? "cursor-pointer hover:bg-neutral-50 hover:border-neutral-400"
        : ""
    }`}
  >
    {children}
  </span>
);
 
/* ============ Editable Cell ============ */
function EditableCell({
  value,
  row,
  field,
  onSave,
  editing,
  onEdit,
  onCancel,
  type = "number",
}) {
  const [editValue, setEditValue] = useState(
    value?.toString() || (type === "number" ? "0" : "")
  );
 
  useEffect(() => {
    setEditValue(value?.toString() || (type === "number" ? "0" : ""));
  }, [value, type]);
 
  const handleChange = (newValue) => {
    if (type === "number") {
      // Only allow numbers and limit to 100
      const numValue = newValue.replace(/[^0-9]/g, "");
      if (
        numValue === "" ||
        (parseInt(numValue) >= 0 && parseInt(numValue) <= 100)
      ) {
        setEditValue(numValue === "" ? "" : numValue);
      }
    } else {
      setEditValue(newValue);
    }
  };
 
  const handleSave = () => {
    let finalValue;
    if (type === "number") {
      finalValue = editValue === "" ? 0 : parseInt(editValue);
    } else {
      finalValue = editValue.trim();
    }
    onSave(row.id, field, finalValue);
  };
 
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };
 
  if (editing) {
    if (type === "select") {
      return (
        <div className="flex items-center gap-1">
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          >
            <option value="Pending">Pending</option>
            <option value="Passed">Passed</option>
            <option value="Failed">Failed</option>
            <option value="Revision">Revision</option>
          </select>
          <button
            onClick={handleSave}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Save"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={onCancel}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Cancel"
          >
            <CloseIcon className="w-3 h-3" />
          </button>
        </div>
      );
    }
 
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyPress}
          className={`px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            type === "number" ? "w-16" : "w-24"
          }`}
          autoFocus
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
          title="Save"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="Cancel"
        >
          <CloseIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }
 
  return (
    <div className="flex items-center gap-1 group">
      <span>{type === "number" ? `${value ?? 0}%` : value}</span>
      <button
        onClick={() => onEdit(row.id, field)}
        className="p-1 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 rounded transition-opacity"
        title="Edit"
      >
        <Edit className="w-3 h-3" />
      </button>
    </div>
  );
}
 
/* ============ Editable Verdict ============ */
function EditableVerdict({ value, row, onSave, editing, onEdit, onCancel }) {
  const [editValue, setEditValue] = useState(value || "Pending");
 
  useEffect(() => {
    setEditValue(value || "Pending");
  }, [value]);
 
  const handleSave = () => {
    onSave(row.id, "verdict", editValue);
  };
 
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };
 
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        >
          <option value="Pending">Pending</option>
          <option value="Passed">Passed</option>
          <option value="Failed">Failed</option>
          <option value="Revision">Revision</option>
        </select>
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
          title="Save"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="Cancel"
        >
          <CloseIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }
 
  return (
    <div className="flex items-center gap-1 group">
      <Pill>{value || "Pending"}</Pill>
      <button
        onClick={() => onEdit(row.id, "verdict")}
        className="p-1 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 rounded transition-opacity"
        title="Edit"
      >
        <Edit className="w-3 h-3" />
      </button>
    </div>
  );
}
 
/* ============ Kebab Menu ============ */
function KebabMenu({ row, onEdit, canEdit }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
 
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
 
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
 
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
        aria-label="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
 
      {open && (
        <div className="absolute right-0 top-6 bg-white border border-neutral-200 rounded-md shadow-lg z-10 min-w-[120px]">
          <button
            onClick={() => {
              if (canEdit) {
                onEdit(row);
                setOpen(false);
              }
            }}
            disabled={!canEdit}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 text-left ${
              !canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
            title={
              !canEdit
                ? "Cannot edit: Due date and time not set"
                : "Update scores"
            }
          >
            <Edit className="w-4 h-4" />
            Update
          </button>
        </div>
      )}
    </div>
  );
}
 
/* ============ Upload helpers ============ */
const safeName = (name = "") =>
  name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
 
async function uploadToSupabase(file, row) {
  const fileKey = `${row.teamId || "no-team"}/${row.id}/${
    Date.now() + "-" + Math.random().toString(36).slice(2)
  }-${safeName(file.name)}`;
 
  const { error } = await supabase.storage
    .from("user-manuscripts")
    .upload(fileKey, file, { upsert: false });
  if (error) throw new Error(error.message);
 
  const {
    data: { publicUrl },
  } = supabase.storage.from("user-manuscripts").getPublicUrl(fileKey);
 
  return {
    name: file.name,
    fileName: fileKey,
    url: publicUrl,
    uploadedAt: new Date().toISOString(),
  };
}
 
async function upsertFileUrl(docId, nextList) {
  const ref = doc(db, MANUSCRIPT_COLLECTION, docId);
  try {
    await updateDoc(ref, { fileUrl: nextList });
  } catch {
    await setDoc(ref, { fileUrl: nextList }, { merge: true });
  }
}
 
/* ============ Upload Modal ============ */
function UploadModal({ open, row, onClose, onSaved }) {
  const [pendingFiles, setPendingFiles] = useState([]);
  const [existing, setExisting] = useState([]);
  const [toDelete, setToDelete] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
 
  // Initialize when opened
  useEffect(() => {
    if (!open || !row?.id) return;
 
    // snapshot existing files locally for editing
    setExisting(Array.isArray(row.fileUrl) ? [...row.fileUrl] : []);
    setPendingFiles([]);
    setToDelete(new Set());
 
    // ensure fileUrl exists remotely too
    (async () => {
      if (!Array.isArray(row.fileUrl)) {
        try {
          await setDoc(
            doc(db, MANUSCRIPT_COLLECTION, row.id),
            { fileUrl: [] },
            { merge: true }
          );
          onSaved?.([]);
        } catch (e) {
          console.error("Init fileUrl failed:", e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.id]);
 
  if (!open || !row) return null;
 
  const pickFiles = () => inputRef.current?.click();
 
  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };
 
  const removePending = (idx) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
 
  const removeExisting = (fileName) => {
    setExisting((prev) => prev.filter((f) => f.fileName !== fileName));
    setToDelete((prev) => {
      const next = new Set(prev);
      next.add(fileName);
      return next;
    });
  };
 
  const save = async () => {
    if (uploading || !row?.id) return;
    setUploading(true);
    try {
      // 1) delete removed existing files from storage
      if (toDelete.size > 0) {
        const names = Array.from(toDelete);
        const { error } = await supabase.storage
          .from("user-manuscripts")
          .remove(names);
        if (error) console.warn("Supabase remove error:", error.message);
      }
 
      // 2) upload new files
      const uploaded =
        pendingFiles.length > 0
          ? await Promise.all(pendingFiles.map((f) => uploadToSupabase(f, row)))
          : [];
 
      // 3) compose final list & write to Firestore
      const nextList = [...existing, ...uploaded];
      await upsertFileUrl(row.id, nextList);
 
      onSaved?.(nextList);
      onClose();
    } catch (e) {
      console.error(e);
      alert(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
 
  const hasChanges = pendingFiles.length > 0 || toDelete.size > 0;
 
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 mx-auto mt-10 w-[880px] max-w-[95vw]">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <span>●</span>
              <span>Upload Files — {row.teamName}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
 
          {/* Body (scrollable) */}
          <div className="flex-1 px-5 pb-5 overflow-y-auto space-y-5">
            {/* Existing files */}
            <div className="rounded-xl border border-neutral-200">
              <div className="px-4 py-2 border-b border-neutral-200 text-sm font-semibold">
                Uploaded Files
              </div>
              <div className="p-4">
                {existing.length > 0 ? (
                  <ul className="space-y-2">
                    {existing.map((f, i) => (
                      <li
                        key={f.fileName || `${f.url}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                      >
                        <div className="truncate">
                          <div className="text-sm font-medium truncate">
                            {f.name || "file"}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {f.fileName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Open"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </a>
                          <a
                            href={f.url}
                            download={f.name || "file"}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExisting(f.fileName)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-neutral-600">
                    There's no uploaded file yet.
                  </div>
                )}
              </div>
            </div>
 
            {/* Pending attachments */}
            <div className="rounded-xl border border-neutral-200">
              <div className="px-4 py-2 border-b border-neutral-200 text-sm font-semibold flex items-center justify-between">
                <span>Attach Files</span>
                <button
                  type="button"
                  onClick={pickFiles}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border border-neutral-300 hover:bg-neutral-50"
                >
                  <Paperclip className="w-4 h-4" />
                  Attach file
                </button>
                <input
                  type="file"
                  className="hidden"
                  ref={inputRef}
                  multiple
                  onChange={onFileChange}
                />
              </div>
 
              <div className="p-4">
                {pendingFiles.length === 0 ? (
                  <div className="text-sm text-neutral-600">
                    No files selected.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {pendingFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                      >
                        <div className="truncate">
                          <div className="text-sm font-medium truncate">
                            {f.name}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {(f.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePending(i)}
                          className="p-1 rounded-md hover:bg-neutral-100"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
 
          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 pb-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-100"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={uploading || !hasChanges}
              className="px-4 py-2 rounded-md text-sm text-white shadow disabled:opacity-50"
              style={{ backgroundColor: MAROON }}
            >
              {uploading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
 
// Helper function to get last name from full name
const getLastName = (fullName) => {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1] || "";
};
 
/* ============================ Main ============================ */
export default function AdviserEvents() {
  const [rows, setRows] = useState({
    titleDefense: [],
    manuscript: [],
    oralDefense: [],
    finalDefense: [],
    finalRedefense: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(
    (searchParams.get("view") || "menu").toLowerCase()
  );
  const [defTab, setDefTab] = useState(
    (searchParams.get("tab") || "title").toLowerCase()
  );
 
  // Upload modal state
  const [uploadRow, setUploadRow] = useState(null);
 
  // Inline editing state
  const [editingCells, setEditingCells] = useState(new Set()); // Set of 'docId-field' strings
 
  const uid =
    auth?.currentUser?.uid ??
    (typeof window !== "undefined" ? localStorage.getItem("uid") : null);
 
  // Get adviser's teams and their manuscript submissions
  const fetchAdviserManuscripts = async () => {
    try {
      setLoading(true);
      console.log("Fetching manuscripts for adviser UID:", uid);
 
      // First, get all teams where this user is the adviser
      const teamsQuery = query(
        collection(db, TEAMS_COLLECTION),
        where("adviser.uid", "==", uid)
      );
      const teamsSnapshot = await getDocs(teamsQuery);
      const adviserTeamIds = teamsSnapshot.docs.map(doc => doc.id);
 
      console.log("Adviser's team IDs:", adviserTeamIds);
 
      if (adviserTeamIds.length === 0) {
        console.log("No teams found for this adviser");
        setRows(prev => ({ ...prev, manuscript: [] }));
        return;
      }
 
      // Get manuscript submissions for these teams
      const manuscriptsQuery = query(
        collection(db, MANUSCRIPT_COLLECTION),
        where("teamId", "in", adviserTeamIds)
      );
 
      const manuscriptsSnapshot = await getDocs(manuscriptsQuery);
      const manuscriptsData = manuscriptsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
 
      console.log("Raw manuscript data:", manuscriptsData);
 
      // Process manuscript data with team information
      const processedManuscripts = await Promise.all(
        manuscriptsData.map(async (m) => {
          // Get current team info to ensure we have the latest team name
          let currentTeamName = m.teamName || "Unknown Team";
          try {
            const teamDoc = await getDoc(doc(db, TEAMS_COLLECTION, m.teamId));
            if (teamDoc.exists()) {
              const teamData = teamDoc.data();
              // Use manager's last name + "etal" format
              if (teamData.manager && teamData.manager.fullName) {
                const lastName = getLastName(teamData.manager.fullName);
                currentTeamName = `${lastName} etal`;
              } else if (teamData.name) {
                currentTeamName = teamData.name;
              }
            }
          } catch (error) {
            console.error("Error fetching team data:", error);
          }
 
          // Extract date and time fields - check ALL possible field names
          const date = m.date || m.dueDate || m.submissionDate || m.deadline || "";
 
          let duetime = "";
          if (m.duetime) duetime = m.duetime;
          else if (m.dueTime) duetime = m.dueTime;
          else if (m.time) duetime = m.time;
          else if (m.submissionTime) duetime = m.submissionTime;
          else if (m.deadlineTime) duetime = m.deadlineTime;
          else if (m.timeStart) duetime = m.timeStart;
 
          console.log(`Processing manuscript ${m.id}:`, {
            date,
            duetime,
            teamName: currentTeamName,
            allFields: Object.keys(m)
          });
 
          return {
            ...m,
            fileUrl: Array.isArray(m.fileUrl) ? m.fileUrl : [],
            duetime: duetime,
            date: date,
            timeStart: duetime, // For compatibility
            teamName: currentTeamName,
            title: m.title || m.projectTitle || "",
            plag: m.plag || m.plagiarism || 0,
            ai: m.ai || m.aiScore || 0,
            verdict: m.verdict || m.status || "Pending",
          };
        })
      );
 
      console.log("Processed manuscripts:", processedManuscripts);
      setRows(prev => ({ ...prev, manuscript: processedManuscripts }));
 
    } catch (error) {
      console.error("Error fetching adviser manuscripts:", error);
      setRows(prev => ({ ...prev, manuscript: [] }));
    } finally {
      setLoading(false);
    }
  };
 
  // Real-time listener for team changes
  useEffect(() => {
    if (!uid) return;
 
    // Listen for changes in teams collection
    const teamsQuery = query(
      collection(db, TEAMS_COLLECTION),
      where("adviser.uid", "==", uid)
    );
 
    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          // Team was dissolved - remove its manuscripts
          const dissolvedTeamId = change.doc.id;
          console.log("Team dissolved, removing manuscripts for team:", dissolvedTeamId);
          setRows(prev => ({
            ...prev,
            manuscript: prev.manuscript.filter(m => m.teamId !== dissolvedTeamId)
          }));
        } else if (change.type === 'modified') {
          // Team was updated (manager changed, etc.) - update team names
          const updatedTeam = { id: change.doc.id, ...change.doc.data() };
          console.log("Team updated:", updatedTeam);
 
          // Update team name in manuscripts
          let newTeamName = updatedTeam.name || "Unknown Team";
          if (updatedTeam.manager && updatedTeam.manager.fullName) {
            const lastName = getLastName(updatedTeam.manager.fullName);
            newTeamName = `${lastName} etal`;
          }
 
          setRows(prev => ({
            ...prev,
            manuscript: prev.manuscript.map(m => 
              m.teamId === updatedTeam.id 
                ? { ...m, teamName: newTeamName }
                : m
            )
          }));
        }
      });
    });
 
    // Listen for manuscript changes
    const manuscriptsUnsubscribe = onSnapshot(
      collection(db, MANUSCRIPT_COLLECTION), 
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            // Manuscript was deleted
            const removedId = change.doc.id;
            setRows(prev => ({
              ...prev,
              manuscript: prev.manuscript.filter(m => m.id !== removedId)
            }));
          }
        });
      }
    );
 
    return () => {
      unsubscribeTeams();
      manuscriptsUnsubscribe();
    };
  }, [uid]);
 
  // Initial data fetch
  useEffect(() => {
    if (uid) {
      fetchAdviserManuscripts();
    }
  }, [uid]);
 
  // Additional direct fetch as backup
  useEffect(() => {
    const fetchManuscriptsDirectly = async () => {
      try {
        console.log("Backup: Fetching all manuscripts directly...");
        const manuscriptsCollection = collection(db, MANUSCRIPT_COLLECTION);
        const snapshot = await getDocs(manuscriptsCollection);
        const manuscriptsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
 
        console.log("Backup fetch - all manuscripts:", manuscriptsData);
 
        // Get adviser's team IDs to filter
        const teamsQuery = query(
          collection(db, TEAMS_COLLECTION),
          where("adviser.uid", "==", uid)
        );
        const teamsSnapshot = await getDocs(teamsQuery);
        const adviserTeamIds = teamsSnapshot.docs.map(doc => doc.id);
 
        // Filter manuscripts by adviser's teams and process
        const filteredManuscripts = manuscriptsData
          .filter(m => adviserTeamIds.includes(m.teamId))
          .map((m) => {
            const date = m.date || m.dueDate || m.submissionDate || m.deadline || "";
            let duetime = "";
            if (m.duetime) duetime = m.duetime;
            else if (m.dueTime) duetime = m.dueTime;
            else if (m.time) duetime = m.time;
            else if (m.submissionTime) duetime = m.submissionTime;
            else if (m.deadlineTime) duetime = m.deadlineTime;
            else if (m.timeStart) duetime = m.timeStart;
 
            return {
              ...m,
              fileUrl: Array.isArray(m.fileUrl) ? m.fileUrl : [],
              duetime: duetime,
              date: date,
              timeStart: duetime,
              teamName: m.teamName || m.team || "",
              title: m.title || m.projectTitle || "",
              plag: m.plag || m.plagiarism || 0,
              ai: m.ai || m.aiScore || 0,
              verdict: m.verdict || m.status || "Pending",
            };
          });
 
        setRows((prev) => ({
          ...prev,
          manuscript: filteredManuscripts,
        }));
      } catch (error) {
        console.error("Backup fetch error:", error);
      }
    };
 
    // If still no data after initial load, try backup fetch
    if (view === "manuscript" && rows.manuscript.length === 0 && !loading && uid) {
      console.log("No data found, running backup fetch...");
      setTimeout(() => {
        fetchManuscriptsDirectly();
      }, 1000);
    }
  }, [view, rows.manuscript.length, loading, uid]);
 
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (view === "menu") next.delete("view");
    else next.set("view", view);
    if (view === "defenses") next.set("tab", defTab);
    else next.delete("tab");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, defTab]);
 
  // FIXED: Updated canEditRow function
  const canEditRow = (row) => {
    const hasDate = !!row.date && row.date.trim() !== "";
    const hasDuetime = !!row.duetime && row.duetime.trim() !== "";
 
    console.log("canEditRow check for:", row.teamName, {
      date: row.date,
      duetime: row.duetime,
      hasDate,
      hasDuetime,
      canEdit: hasDate && hasDuetime,
    });
 
    return hasDate && hasDuetime;
  };
 
  const handleSaveScore = async (docId, field, value) => {
    try {
      const ref = doc(db, MANUSCRIPT_COLLECTION, docId);
      await updateDoc(ref, { [field]: value });
 
      // Update local state
      setRows((prev) => ({
        ...prev,
        manuscript: prev.manuscript.map((m) =>
          m.id === docId ? { ...m, [field]: value } : m
        ),
      }));
 
      // Remove from editing set
      setEditingCells((prev) => {
        const next = new Set(prev);
        next.delete(`${docId}-${field}`);
        return next;
      });
    } catch (error) {
      console.error("Failed to update score:", error);
      alert("Failed to update score. Please try again.");
    }
  };
 
  const handleEditCell = (docId, field) => {
    const row = rows.manuscript.find((m) => m.id === docId);
    if (row && canEditRow(row)) {
      setEditingCells((prev) => new Set(prev).add(`${docId}-${field}`));
    }
  };
 
  const handleBulkEdit = (row) => {
    if (canEditRow(row)) {
      // Enable editing for all three fields at once
      setEditingCells(
        new Set([`${row.id}-plag`, `${row.id}-ai`, `${row.id}-verdict`])
      );
    }
  };
 
  const handleCancelEdit = (docId, field) => {
    setEditingCells((prev) => {
      const next = new Set(prev);
      next.delete(`${docId}-${field}`);
      return next;
    });
  };
 
  const isEditing = (docId, field) => {
    return editingCells.has(`${docId}-${field}`);
  };
 
  const Header = (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 text-[18px] font-semibold"
        style={{ color: MAROON }}
      >
        <ClipboardList className="w-5 h-5" />
        <span>Events</span>
      </div>
      <div className="h-[3px] w-full" style={{ backgroundColor: MAROON }} />
    </div>
  );
 
  const CategoryCard = ({ title, icon: Icon, onClick }) => (
    <button
      onClick={onClick}
      className="w-[220px] h-[120px] rounded-xl border border-neutral-200 bg-white shadow hover:shadow-md text-left overflow-hidden"
    >
      <div className="h-full flex">
        <div className="w-2" style={{ backgroundColor: MAROON }} />
        <div className="flex-1 p-4 flex items-center gap-3">
          <Icon className="w-8 h-8 text-neutral-800" />
          <div className="text-[14px] font-semibold text-neutral-800">
            {title}
          </div>
        </div>
      </div>
    </button>
  );
 
  if (view === "menu") {
    return (
      <div className="space-y-4">
        {Header}
        <div className="flex gap-4">
          <CategoryCard
            title="Manuscript Results"
            icon={BookOpenCheck}
            onClick={() => setView("manuscript")}
          />
          <CategoryCard
            title="Capstone Defenses"
            icon={Presentation}
            onClick={() => setView("defenses")}
          />
        </div>
      </div>
    );
  }
 
  return (
    <div className="space-y-4">
      {Header}
 
      {view === "manuscript" && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <BookOpenCheck className="w-5 h-5" color={MAROON} />
            <h2 className="text-[17px] font-semibold" style={{ color: MAROON }}>
              Manuscript Results
            </h2>
          </div>
 
          {/* Instructions */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You can only edit scores and verdict when a
              due date and due time are set by the instructor. Click the edit icons
              next to each field or use the "Update" action to edit all fields
              at once.
            </p>
          </div>
 
          {rows.manuscript.length === 0 && !loading ? (
            <div className="text-center py-8 text-neutral-500">
              No manuscript submissions found for your teams.
            </div>
          ) : (
            <CardTable>
              <thead>
                <tr className="bg-neutral-50/80 text-neutral-600">
                  <th className="text-left py-2 pl-6 pr-3">NO</th>
                  <th className="text-left py-2 pr-3">Team</th>
                  <th className="text-left py-2 pr-3">Title</th>
                  <th className="text-left py-2 pr-3">Due Date</th>
                  <th className="text-left py-2 pr-3">Due Time</th>
                  <th className="text-left py-2 pr-3">Plagiarism</th>
                  <th className="text-left py-2 pr-3">AI</th>
                  <th className="text-left py-2 pr-3">Verdict</th>
                  <th className="text-left py-2 pr-3">File Uploaded</th>
                  <th className="text-left py-2 pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(loading ? [] : rows.manuscript).map((r, idx) => {
                  const canEdit = canEditRow(r);
                  const editingPlag = isEditing(r.id, "plag");
                  const editingAI = isEditing(r.id, "ai");
                  const editingVerdict = isEditing(r.id, "verdict");
 
                  console.log("Rendering row:", {
                    id: r.id,
                    teamName: r.teamName,
                    date: r.date,
                    duetime: r.duetime,
                    canEdit,
                  });
 
                  return (
                    <tr
                      key={`ms-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.title || "—"}</td>
                      <td className="py-2 pr-3">
                        {r.date || (
                          <span className="text-red-500 text-xs">Not set</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {r.duetime ? (
                          to12h(r.duetime)
                        ) : (
                          <span className="text-red-500 text-xs">Not set</span>
                        )}
                      </td>
 
                      {/* Plagiarism Score - Editable */}
                      <td className="py-2 pr-3">
                        <EditableCell
                          value={r.plag}
                          row={r}
                          field="plag"
                          onSave={handleSaveScore}
                          editing={editingPlag}
                          onEdit={handleEditCell}
                          onCancel={() => handleCancelEdit(r.id, "plag")}
                          type="number"
                        />
                      </td>
 
                      {/* AI Score - Editable */}
                      <td className="py-2 pr-3">
                        <EditableCell
                          value={r.ai}
                          row={r}
                          field="ai"
                          onSave={handleSaveScore}
                          editing={editingAI}
                          onEdit={handleEditCell}
                          onCancel={() => handleCancelEdit(r.id, "ai")}
                          type="number"
                        />
                      </td>
 
                      {/* Verdict - Editable */}
                      <td className="py-2 pr-3">
                        <EditableCell
                          value={r.verdict}
                          row={r}
                          field="verdict"
                          onSave={handleSaveScore}
                          editing={editingVerdict}
                          onEdit={handleEditCell}
                          onCancel={() => handleCancelEdit(r.id, "verdict")}
                          type="select"
                        />
                      </td>
 
                      {/* Upload button + modal */}
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setUploadRow(r)}
                          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                        >
                          <Paperclip className="w-4 h-4" />
                          Upload File
                        </button>
                      </td>
 
                      {/* Kebab Menu */}
                      <td className="py-2 pr-6">
                        <KebabMenu
                          row={r}
                          onEdit={handleBulkEdit}
                          canEdit={canEdit}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </CardTable>
          )}
 
          {/* Upload Modal */}
          <UploadModal
            open={!!uploadRow}
            row={uploadRow}
            onClose={() => setUploadRow(null)}
            onSaved={(newList) => {
              setRows((prev) => ({
                ...prev,
                manuscript: (prev.manuscript || []).map((m) =>
                  m.id === uploadRow?.id ? { ...m, fileUrl: newList } : m
                ),
              }));
              setUploadRow((old) => (old ? { ...old, fileUrl: newList } : old));
            }}
          />
        </section>
      )}
 
      {view === "defenses" && (
        <>
          <div className="flex gap-2 mb-3">
            {[
              { key: "title", label: "Title Defense" },
              { key: "oral", label: "Oral Defense" },
              { key: "final", label: "Final Defense" },
              { key: "redef", label: "Final Re-Defense" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setDefTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  defTab === t.key ? "text-white" : "text-neutral-700"
                }`}
                style={defTab === t.key ? { backgroundColor: MAROON } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
 
          {defTab === "title" && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-5 h-5" color={MAROON} />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: MAROON }}
                >
                  Title Defense
                </h2>
              </div>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? [] : rows.titleDefense).map((r, idx) => (
                    <tr
                      key={`td-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.date}</td>
                      <td className="py-2 pr-3">
                        {r.timeStart ? to12h(r.timeStart) : ""}
                      </td>
                      <td className="py-2 pr-3">
                        {Array.isArray(r.panelists)
                          ? r.panelists.join(", ")
                          : ""}
                      </td>
                      <td className="py-2 pr-6">
                        <Pill>{r.verdict}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CardTable>
            </section>
          )}
 
          {defTab === "oral" && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Presentation className="w-5 h-5" color={MAROON} />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: MAROON }}
                >
                  Oral Defense
                </h2>
              </div>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? [] : rows.oralDefense).map((r, idx) => (
                    <tr
                      key={`od-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.title}</td>
                      <td className="py-2 pr-3">{r.date}</td>
                      <td className="py-2 pr-3">
                        {r.timeStart ? to12h(r.timeStart) : ""}
                      </td>
                      <td className="py-2 pr-3">
                        {Array.isArray(r.panelists)
                          ? r.panelists.join(", ")
                          : ""}
                      </td>
                      <td className="py-2 pr-6">
                        <Pill>{r.verdict}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CardTable>
            </section>
          )}
 
          {defTab === "final" && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-5 h-5" color={MAROON} />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: MAROON }}
                >
                  Final Defense
                </h2>
              </div>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.finalDefense || []).length ? (
                    rows.finalDefense.map((r, idx) => (
                      <tr
                        key={`fd-${r.id}`}
                        className="border-t border-neutral-200"
                      >
                        <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                        <td className="py-2 pr-3">{r.teamName}</td>
                        <td className="py-2 pr-3">{r.title}</td>
                        <td className="py-2 pr-3">{r.date}</td>
                        <td className="py-2 pr-3">
                          {r.timeStart ? to12h(r.timeStart) : ""}
                        </td>
                        <td className="py-2 pr-3">
                          {Array.isArray(r.panelists)
                            ? r.panelists.join(", ")
                            : ""}
                        </td>
                        <td className="py-2 pr-6">
                          <Pill>{r.verdict || "Pending"}</Pill>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-neutral-200">
                      <td
                        className="py-6 text-center text-neutral-500"
                        colSpan={7}
                      >
                        No final defense items yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </CardTable>
            </section>
          )}
 
          {defTab === "redef" && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-5 h-5" color={MAROON} />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: MAROON }}
                >
                  Final Re-Defense
                </h2>
              </div>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.finalRedefense || []).length ? (
                    rows.finalRedefense.map((r, idx) => (
                      <tr
                        key={`frd-${r.id}`}
                        className="border-t border-neutral-200"
                      >
                        <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                        <td className="py-2 pr-3">{r.teamName}</td>
                        <td className="py-2 pr-3">{r.title}</td>
                        <td className="py-2 pr-3">{r.date}</td>
                        <td className="py-2 pr-3">
                          {r.timeStart ? to12h(r.timeStart) : ""}
                        </td>
                        <td className="py-2 pr-3">
                          {Array.isArray(r.panelists)
                            ? r.panelists.join(", ")
                            : ""}
                        </td>
                        <td className="py-2 pr-6">
                          <Pill>{r.verdict || "Pending"}</Pill>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-neutral-200">
                      <td
                        className="py-6 text-center text-neutral-500"
                        colSpan={7}
                      >
                        No final re-defense items yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </CardTable>
            </section>
          )}
        </>
      )}
    </div>
  );
}