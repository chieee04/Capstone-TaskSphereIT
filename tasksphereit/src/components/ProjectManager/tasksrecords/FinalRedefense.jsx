// src/components/ProjectManager/tasksrecords/FinalRedefense.jsx
import React, { useState, useMemo } from "react";
import {
  Search,
  Trash2,
  Edit3,
  X,
  Check,
  CalendarDays,
  Clock,
  ChevronLeft,
} from "lucide-react";

const MAROON = "#6A0F14";

// Sample completed Final Re-Defense records
const RAW_ROWS = [
  {
    no: 1,
    assigned: "Alejandro F.",
    type: "Presentation",
    task: "Re-Defense Deck",
    subtask: "Slide Fixes",
    element: "Software",
    created: "2025-03-10",
    due: "2025-03-14",
    time: "09:00",
    completed: "2025-03-14",
    revision: "Revision 1",
    status: "Completed",
    methodology: "Agile",
    phase: "Re-Defense",
  },
  {
    no: 2,
    assigned: "Harzwel Zhen L.",
    type: "Documentation",
    task: "Revised Manuscript",
    subtask: "Proofreading",
    element: "Software",
    created: "2025-03-09",
    due: "2025-03-13",
    time: "13:30",
    completed: "2025-03-13",
    revision: "Revision 2",
    status: "Completed",
    methodology: "Agile",
    phase: "Re-Defense",
  },
  {
    no: 3,
    assigned: "Julliana C.",
    type: "Demo",
    task: "System Demo (Re-Defense)",
    subtask: "Dry Run",
    element: "Hardware",
    created: "2025-03-08",
    due: "2025-03-12",
    time: "15:00",
    completed: "2025-03-12",
    revision: "No Revision",
    status: "Completed",
    methodology: "Agile",
    phase: "Re-Defense",
  },
];

/** Convert YYYY-MM-DD to "Mon D, YYYY" */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Convert "HH:MM" (24h) to "H:MM AM/PM" */
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minute] = timeStr.split(":");
  const hours = parseInt(hourStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = ((hours + 11) % 12) + 1;
  return `${hour12}:${minute} ${ampm}`;
}

/** Next "Revision N" label */
function nextRevision(revision) {
  if (!revision || revision.toLowerCase() === "no revision") return "Revision 1";
  const match = revision.match(/Revision\s+(\d+)/i);
  if (match) {
    const number = parseInt(match[1], 10);
    return `Revision ${number + 1}`;
  }
  return "Revision 1";
}

export default function FinalRedefense({ onBack }) {
  const [rows, setRows] = useState(RAW_ROWS);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [editDue, setEditDue] = useState("");
  const [editTime, setEditTime] = useState("");

  // distinct phases for dropdown
  const phases = useMemo(() => {
    const set = new Set(rows.map((r) => r.phase));
    return Array.from(set);
  }, [rows]);

  // search + phase filter
  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !s ||
        r.assigned.toLowerCase().includes(s) ||
        r.type.toLowerCase().includes(s) ||
        r.task.toLowerCase().includes(s) ||
        (r.subtask || "").toLowerCase().includes(s) ||
        (r.element || "").toLowerCase().includes(s) ||
        r.methodology.toLowerCase().includes(s) ||
        r.revision.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s) ||
        r.phase.toLowerCase().includes(s) ||
        formatDate(r.created).toLowerCase().includes(s) ||
        formatDate(r.due).toLowerCase().includes(s) ||
        formatDate(r.completed).toLowerCase().includes(s);
      const matchesPhase = !phaseFilter || r.phase === phaseFilter;
      return matchesSearch && matchesPhase;
    });
  }, [rows, search, phaseFilter]);

  // back
  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else window.history.back();
  };

  // edit controls
  const beginEdit = (no) => {
    const row = rows.find((r) => r.no === no);
    if (!row) return;
    setEditing(no);
    setEditDue(row.due);
    setEditTime(row.time);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditDue("");
    setEditTime("");
  };

  const saveEdit = (no) => {
    setRows((prev) => {
      const updatedList = prev.map((r) => {
        if (r.no !== no) return r;
        return {
          ...r,
          due: editDue,
          time: editTime,
          revision: nextRevision(r.revision),
          status: "To Do",
        };
      });
      // remove from record list after editing (moves back to tasks)
      return updatedList.filter((r) => r.no !== no);
    });
    cancelEdit();
  };

  const deleteRow = (no) => {
    setRows((prev) => prev.filter((r) => r.no !== no));
  };

  return (
    /* prevent squeezing the sidebar; table scrolls horizontally inside */
    <div className="flex-1 min-w-0 max-w-full overflow-hidden space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
          </div>
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            <option value="">All Phases</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-[13px] leading-tight">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pl-6 pr-3 whitespace-nowrap">NO</th>
                <th className="py-2 pr-3 whitespace-nowrap">Assigned</th>
                <th className="py-2 pr-3 whitespace-nowrap">Task Type</th>
                <th className="py-2 pr-3 whitespace-nowrap">Task</th>
                <th className="py-2 pr-3 whitespace-nowrap">Subtask</th>
                <th className="py-2 pr-3 whitespace-nowrap">Element</th>
                <th className="py-2 pr-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Created
                  </div>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Due Date
                  </div>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Time
                  </div>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Completed
                  </div>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">Revision No</th>
                <th className="py-2 pr-3 whitespace-nowrap">Status</th>
                <th className="py-2 pr-3 whitespace-nowrap">Methodology</th>
                <th className="py-2 pr-3 whitespace-nowrap">Phase</th>
                <th className="py-2 pr-6 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.no} className="border-t border-neutral-200">
                  <td className="py-2 pl-6 pr-3 whitespace-nowrap">{r.no}.</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.assigned}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.type}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.task}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.subtask || "-"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.element || "-"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.created)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {editing === r.no ? (
                      <input
                        type="date"
                        value={editDue}
                        onChange={(e) => setEditDue(e.target.value)}
                        className="border border-neutral-300 rounded-md px-2 py-1 text-[13px]"
                      />
                    ) : (
                      formatDate(r.due)
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {editing === r.no ? (
                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="border border-neutral-300 rounded-md px-2 py-1 text-[13px]"
                      />
                    ) : (
                      formatTime(r.time)
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.completed)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.revision}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.status}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.methodology}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.phase}</td>
                  <td className="py-2 pr-6 whitespace-nowrap">
                    {editing === r.no ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveEdit(r.no)}
                          className="p-1 rounded-md text-green-600 hover:bg-green-50"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 rounded-md text-neutral-600 hover:bg-neutral-100"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => beginEdit(r.no)}
                          className="p-1 rounded-md text-blue-600 hover:bg-blue-50"
                          title="Update due date/time"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRow(r.no)}
                          className="p-1 rounded-md text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-neutral-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
