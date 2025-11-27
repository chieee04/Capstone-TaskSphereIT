import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ClipboardList,
  ChevronRight,
  Search,
  MoreVertical,
  X,
  Loader2,
  Edit,
} from "lucide-react";


/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";


const MAROON = "#3B0304";


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


/* --------------------------- Confirmation Dialog --------------------------- */
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


/* --------------------------- Edit Due Date & Time Dialog --------------------------- */
function EditDueDateTimeDialog({
  open,
  onClose,
  onSaved,
  existingTask,
  category,
}) {
  const [saving, setSaving] = useState(false);
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);


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


  const save = async () => {
    if (!due || !time) return;
    setSaving(true);
    try {
      const dueAtMs = due && time ? new Date(`${due}T${time}:00`).getTime() : null;
     
      const currentRevision = existingTask?.revision || "No Revision";
      const revisionNumber = currentRevision === "No Revision" ? 1 :
                           parseInt(currentRevision.match(/\d+/)?.[0] || "0") + 1;
      const newRevision = revisionNumber === 1 ? "1st Revision" :
                         revisionNumber === 2 ? "2nd Revision" :
                         revisionNumber === 3 ? "3rd Revision" :
                         `${revisionNumber}th Revision`;


      const payload = {
        dueDate: due || null,
        dueTime: time || null,
        dueAtMs,
        revision: newRevision,
        status: "To Do", // This will remove it from completed tasks
        completedAt: null,
        updatedAt: serverTimestamp(),
      };


      if (existingTask?.id) {
        const cat = CATEGORIES.find((c) => c.id === category);
        const collectionName = cat ? cat.coll : "titleDefenseTasks";
       
        await updateDoc(
          doc(db, collectionName, existingTask.id),
          payload
        );
      }


      onSaved?.();
      onClose();
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Error updating task. Please try again.");
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
                <span>Edit Due Date & Time</span>
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
                    <span className="font-medium">Assigned:</span> {existingTask?.assignees?.[0]?.name || "Team"}
                  </div>
                  <div>
                    <span className="font-medium">Task Type:</span> {existingTask?.type || "Unknown"}
                  </div>
                  <div>
                    <span className="font-medium">Task:</span> {existingTask?.task || "Unknown"}
                  </div>
                  <div>
                    <span className="font-medium">Current Status:</span> {existingTask?.status || "Completed"}
                  </div>
                  <div>
                    <span className="font-medium">Current Revision:</span> {existingTask?.revision || "No Revision"}
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      handleInputChange();
                    }}
                  />
                </div>
              </div>


              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Extending the due date/time will increase the revision number and reset the status to "To Do". This task will be moved back to active tasks immediately and will disappear from this completed tasks list.
                </p>
              </div>
            </div>


            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={save}
                disabled={!due || !time || saving}
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
  onEdit,
  onView,
  onDelete,
  deletingId,
  menuOpenId,
  setMenuOpenId
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
          rows.map((r, idx) => (
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
                            onEdit(r.existingTask);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                          onClick={() => {
                            setMenuOpenId(null);
                            onView(r.existingTask);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-red-600 disabled:opacity-50"
                          disabled={deletingId === r.id}
                          onClick={() => {
                            setMenuOpenId(null);
                            onDelete(r.id);
                          }}
                        >
                          {deletingId === r.id ? (
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
          ))
        )}
      </tbody>
    </table>
  </div>
);


const TitleDefensePage2Table = ({
  rows,
  loading,
  onEdit,
  onView,
  onDelete,
  deletingId,
  menuOpenId,
  setMenuOpenId
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
          rows.map((r, idx) => (
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
                            onEdit(r.existingTask);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                          onClick={() => {
                            setMenuOpenId(null);
                            onView(r.existingTask);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-red-600 disabled:opacity-50"
                          disabled={deletingId === r.id}
                          onClick={() => {
                            setMenuOpenId(null);
                            onDelete(r.id);
                          }}
                        >
                          {deletingId === r.id ? (
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
          ))
        )}
      </tbody>
    </table>
  </div>
);


/* --------------------------- Defense Tasks Table (Oral, Final, Final Re-defense) --------------------------- */
const DefenseTasksTable = ({
  rows,
  loading,
  onEdit,
  onView,
  onDelete,
  deletingId,
  menuOpenId,
  setMenuOpenId
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
          rows.map((r, idx) => (
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
                            onEdit(r.existingTask);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                          onClick={() => {
                            setMenuOpenId(null);
                            onView(r.existingTask);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-red-600 disabled:opacity-50"
                          disabled={deletingId === r.id}
                          onClick={() => {
                            setMenuOpenId(null);
                            onDelete(r.id);
                          }}
                        >
                          {deletingId === r.id ? (
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
          ))
        )}
      </tbody>
    </table>
  </div>
);


/* ------------------------------ MAIN ------------------------------ */
const TaskRecord = () => {
  const [view, setView] = useState("grid");
  const [category, setCategory] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("team"); // "team" or "adviser"


  const [meUid, setMeUid] = useState("");
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);


  const [loadingTasks, setLoadingTasks] = useState(false);
  const [records, setRecords] = useState([]);


  // Action states
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editDueDateTime, setEditDueDateTime] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);


  const teamUnsubsRef = useRef([]);
  const tasksUnsubRef = useRef(null);


  /* -------- identify current user -------- */
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid || localStorage.getItem("uid") || "";
      setMeUid(uid);
    });
    return () => stop();
  }, []);


  /* -------- fetch teams of this Project Manager -------- */
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


    const stopA = onSnapshot(
      query(collection(db, "teams"), where("projectManager.uid", "==", meUid)),
      apply,
      () => setLoadingTeams(false)
    );
    const stopB = onSnapshot(
      query(collection(db, "teams"), where("manager.uid", "==", meUid)),
      apply,
      () => setLoadingTeams(false)
    );


    teamUnsubsRef.current.push(stopA, stopB);
    return () => {
      teamUnsubsRef.current.forEach((u) => typeof u === "function" && u());
      teamUnsubsRef.current = [];
    };
  }, [meUid]);


  /* -------- FIXED: REAL-TIME fetch completed tasks - FILTERED BY PROJECT MANAGER'S TEAMS -------- */
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


    const normalize = (doc) => {
      const x = doc.data();
     
      // FIXED: Properly handle assigned name for both team and adviser tasks
      let assignedName = "Unknown";
     
      // For team tasks
      if (x.isTeamTask) {
        assignedName = "Team";
      }
      // For individual tasks with assignees
      else if (x.assignees && x.assignees.length > 0) {
        // Check if it's a team assignment (uid === 'team')
        if (x.assignees[0].uid === 'team') {
          assignedName = "Team";
        } else {
          assignedName = x.assignees[0].name || "Unknown";
        }
      }
      // For adviser tasks that might not have assignees but have taskManager
      else if (x.taskManager === "Adviser") {
        // For adviser tasks, show the team name from the team object if available
        if (x.team && x.team.name) {
          assignedName = x.team.name;
        } else {
          assignedName = "Team";
        }
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
        taskManager: x.taskManager || "Project Manager", // Add taskManager for filtering
      };
    };


    // Get team IDs for filtering
    const teamIds = teams.map(team => team.id);
   
    // If no teams, don't fetch any tasks
    if (teamIds.length === 0) {
      setRecords([]);
      setLoadingTasks(false);
      return;
    }


    // FIXED: Only fetch tasks that belong to the project manager's teams
    const qy = query(
      collection(db, cat.coll),
      where("team.id", "in", teamIds), // Only tasks from the project manager's teams
      orderBy("updatedAt", "desc")
    );
   
    const stop = onSnapshot(
      qy,
      (snap) => {
        // Filter for completed tasks in memory
        const completedTasks = snap.docs
          .map((d) => ({ doc: d, data: d.data() }))
          .filter(({ data }) => data.status === "Completed")
          .map(({ doc }) => normalize(doc))
          .sort((a, b) => (a.completed > b.completed ? -1 : 1))
          .map((r, i) => ({ ...r, no: i + 1 }));
       
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
  }, [view, category, teams]); // Added teams to dependency array


  /* -------- Filter records by active tab for defense categories -------- */
  const filteredRecords = useMemo(() => {
    const isDefenseCategory = ["oral", "final", "finalRedefense"].includes(category);
   
    if (!isDefenseCategory) {
      return records;
    }


    // For defense categories, filter by taskManager
    return records.filter(record => {
      if (activeTab === "team") {
        return record.taskManager === "Project Manager";
      } else {
        return record.taskManager === "Adviser";
      }
    });
  }, [records, category, activeTab]);


  /* -------- search + page derivations -------- */
  const [searchText, setSearchText] = useState("");
  useEffect(() => setSearchText(search), [search]);


  const filtered = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    if (!s) return filteredRecords;
    return filteredRecords.filter((r) =>
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
  }, [filteredRecords, searchText]);


  const page1Rows = useMemo(() => filtered, [filtered]);
  const page2Rows = useMemo(
    () => filtered.map((r) => ({ ...r, status: "Completed" })),
    [filtered]
  );


  /* -------- Action Handlers -------- */
  const handleEdit = (task) => {
    setEditDueDateTime(task);
    setMenuOpenId(null);
  };


  const handleView = (task) => {
    alert(`Viewing task: ${task.task}\nAssigned to: ${task.assignees?.[0]?.name || 'Team'}\nCompleted on: ${formatDateMonthDayYear(convertFirebaseTime(task.completedAt))}`);
    setMenuOpenId(null);
  };


  const handleDelete = (taskId) => {
    setTaskToDelete(taskId);
    setShowDeleteConfirm(true);
    setMenuOpenId(null);
  };


  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setDeletingId(taskToDelete);
   
    try {
      const cat = CATEGORIES.find((c) => c.id === category);
      if (cat) {
        await deleteDoc(doc(db, cat.coll, taskToDelete));
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Error deleting task. Please try again.");
    } finally {
      setDeletingId(null);
      setTaskToDelete(null);
      setShowDeleteConfirm(false);
    }
  };


  const handleEditSaved = () => {
    // The real-time listener will automatically update the records
    // because when status changes from "Completed" to "To Do", the task will be filtered out
    setEditDueDateTime(null);
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


        {/* Tabs for Defense Categories */}
        {isDefenseCategory && (
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
        )}


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
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
                deletingId={deletingId}
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
              />
            ) : (
              <TitleDefensePage2Table
                rows={page2Rows}
                loading={loadingTasks || loadingTeams}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
                deletingId={deletingId}
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
              />
            )
          ) : isDefenseCategory ? (
            <DefenseTasksTable
              rows={page1Rows}
              loading={loadingTasks || loadingTeams}
              onEdit={handleEdit}
              onView={handleView}
              onDelete={handleDelete}
              deletingId={deletingId}
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
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
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTasks || loadingTeams ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            Loading…
                          </td>
                        </tr>
                      ) : page1Rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            No completed tasks.
                          </td>
                        </tr>
                      ) : (
                        page1Rows.map((r) => (
                          <tr key={r._key} className="border-t border-neutral-200">
                            <td className="py-3 pl-6 pr-3">{r.no}.</td>
                            <td className="py-3 pr-3">{r.assigned}</td>
                            <td className="py-3 pr-3">{r.task}</td>
                            <td className="py-3 pr-3">{r.subtask}</td>
                            <td className="py-3 pr-3">{r.elements}</td>
                            <td className="py-3 pr-3">{r.created}</td>
                            <td className="py-3 pr-6">{r.due}</td>
                          </tr>
                        ))
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
                        page2Rows.map((r) => (
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
                              <button className="p-1 rounded hover:bg-neutral-100">
                                <MoreVertical className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>


        {/* Edit Dialog */}
        <EditDueDateTimeDialog
          open={!!editDueDateTime}
          onClose={() => setEditDueDateTime(null)}
          onSaved={handleEditSaved}
          existingTask={editDueDateTime}
          category={category}
        />


        {/* Delete Confirmation */}
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
              setActiveTab("team"); // Reset to team tab when switching categories
            }}
          />
        ))}
      </div>
    </div>
  );
};


export default TaskRecord;

