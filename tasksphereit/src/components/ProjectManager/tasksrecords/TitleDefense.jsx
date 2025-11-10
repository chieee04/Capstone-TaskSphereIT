// src/components/ProjectManager/tasksrecords/TitleDefense.jsx
import React, { useState, useMemo } from "react";
import {
  Search,
  Trash2,
  Edit3,
  X,
  Check,
  CalendarDays,
  Clock,
  ClipboardList,
  ChevronLeft, // <-- added for back button
} from "lucide-react";


const MAROON = "#6A0F14";

// Sample data for Title Defense tasks record. Fields such as `due`, `time`,
// and `completed` are stored in ISO/24‑hour formats to simplify
// manipulation. Display formatting is handled in the component.
const RAW_ROWS = [
  {
    no: 1,
    assigned: "Addrialene G. Mendoza",
    type: "Documentation",
    task: "Introduction",
    created: "2025-01-05",
    due: "2025-01-10",
    time: "08:00",
    completed: "2025-01-10",
    revision: "No Revision",
    status: "Completed",
    phase: "Analysis",
  },
  {
    no: 2,
    assigned: "Harzwel Zhen B. Lacson",
    type: "Documentation",
    task: "Chapter 1",
    created: "2025-01-07",
    due: "2025-01-12",
    time: "10:30",
    completed: "2025-01-12",
    revision: "Revision 1",
    status: "Completed",
    phase: "Planning",
  },
  {
    no: 3,
    assigned: "Julliana N. Castaneda",
    type: "Discussion",
    task: "Scope Definition",
    created: "2025-01-06",
    due: "2025-01-14",
    time: "09:15",
    completed: "2025-01-14",
    revision: "No Revision",
    status: "Completed",
    phase: "Analysis",
  },
];

/**
 * Convert an ISO date (YYYY‑MM‑DD) string into a human‑friendly string.
 */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Convert a 24‑hour time string (HH:MM) into 12‑hour format with AM/PM.
 */
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minute] = timeStr.split(":");
  const hours = parseInt(hourStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = ((hours + 11) % 12) + 1;
  return `${hour12}:${minute} ${ampm}`;
}

/**
 * Compute the next revision label given the current revision.
 * "No Revision" → "Revision 1"
 * "Revision N" → "Revision N+1"
 */
function nextRevision(revision) {
  if (!revision || revision.toLowerCase() === "no revision") return "Revision 1";
  const match = revision.match(/Revision\s+(\d+)/i);
  if (match) {
    const number = parseInt(match[1], 10);
    return `Revision ${number + 1}`;
  }
  return "Revision 1";
}

export default function TitleDefense({ onBack }) {
  const [rows, setRows] = useState(RAW_ROWS);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [editDue, setEditDue] = useState("");
  const [editTime, setEditTime] = useState("");

  // Derive the set of phases from the current rows for the filter.
  const phases = useMemo(() => {
    const set = new Set(rows.map((r) => r.phase));
    return Array.from(set);
  }, [rows]);

  // Filter rows based on search text and selected phase.
  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !s ||
        r.assigned.toLowerCase().includes(s) ||
        r.type.toLowerCase().includes(s) ||
        r.task.toLowerCase().includes(s) ||
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

  // Back handler
  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else window.history.back();
  };

  /** Start editing a particular row. Populates local state for the date and time inputs. */
  const beginEdit = (no) => {
    const row = rows.find((r) => r.no === no);
    if (!row) return;
    setEditing(no);
    setEditDue(row.due);
    setEditTime(row.time);
  };

  /** Cancel editing and reset local edit state. */
  const cancelEdit = () => {
    setEditing(null);
    setEditDue("");
    setEditTime("");
  };

  /**
   * Save the edited due date and time for the specified row. This function
   * increments the revision number and sets the status back to "To Do".
   */
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
      // Remove the updated task from the record to emulate returning it to active tasks
      return updatedList.filter((r) => r.no !== no);
    });
    cancelEdit();
  };

  /** Delete the given task from the record. */
  const deleteRow = (no) => {
    setRows((prev) => prev.filter((r) => r.no !== no));
  };

  return (
    <div className="space-y-4">
      {/* Header with Back button and title */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
          title="Back to Tasks Record"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
          </div>
          {/* Phase filter */}
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
          <table className="w-full text-[13px] leading-tight">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pl-6 pr-3 whitespace-nowrap">NO</th>
                <th className="py-2 pr-3 whitespace-nowrap">Assigned</th>
                <th className="py-2 pr-3 whitespace-nowrap">Task Type</th>
                <th className="py-2 pr-3 whitespace-nowrap">Task</th>
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
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.created)}</td>
                  {/* Due date column */}
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
                  {/* Time column */}
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
                  {/* Completed date */}
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.completed)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.revision}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.status}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.phase}</td>
                  {/* Actions */}
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
                  <td colSpan={12} className="py-8 text-center text-neutral-500">
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
