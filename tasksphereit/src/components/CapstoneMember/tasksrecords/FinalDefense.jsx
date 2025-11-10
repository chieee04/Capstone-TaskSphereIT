// src/components/CapstoneMember/tasksrecords/FinalDefense.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Search, Eye, CalendarDays, Clock, ChevronLeft } from "lucide-react";
import { db } from "../../../config/firebase";
import { collection, getDocs } from "firebase/firestore";

const MAROON = "#6A0F14";

// No static rows; loads from Firestore

/* =============================== Helpers =============================== */
const formatDate = (d) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const H = parseInt(h, 10);
  const ampm = H >= 12 ? "PM" : "AM";
  const hour12 = ((H + 11) % 12) + 1;
  return `${hour12}:${m} ${ampm}`;
}

/* =========================== Component =========================== */
function FinalDefense({ onBack, onView }) {
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "finalDefenseTasks"));
        const arr = [];
        snap.forEach((d) => {
          const t = d.data() || {};
          const mine = Array.isArray(t.assignees) && t.assignees.some((a) => a?.uid === uid);
          const completed = String(t.status || "").toLowerCase() === "completed";
          if (!mine || !completed) return;
          const assigned = Array.isArray(t.assignees)
            ? t.assignees.map((a) => a?.name).filter(Boolean).join(", ")
            : "";
          const createdISO = t.createdAt?.toDate?.()?.toISOString?.().slice(0, 10) || "";
          const completedISO =
            t.completedAt?.toDate?.()?.toISOString?.().slice(0, 10) ||
            t.updatedAt?.toDate?.()?.toISOString?.().slice(0, 10) ||
            t.dueDate || "";
          arr.push({
            assigned: assigned || "—",
            type: t.type || "—",
            task: t.task || t.type || "Task",
            subtask: t.subtask || t.type || "—",
            element: t.element || t.team?.name || t.teamName || "—",
            created: createdISO,
            due: t.dueDate || "",
            time: t.dueTime || "",
            completed: completedISO,
            revision: t.revision || "No Revision",
            status: t.status || "Completed",
            methodology: t.methodology || "—",
            phase: t.phase || "—",
            __createdSort: createdISO,
          });
        });
        arr.sort((a, b) => (b.__createdSort || "").localeCompare(a.__createdSort || ""));
        if (alive) setRows(arr.map((r, i) => ({ no: i + 1, ...r })));
      } catch (e) {
        console.error("Member FinalDefense record load failed:", e);
        if (alive) setRows([]);
      }
    })();
    return () => { alive = false; };
  }, [uid]);

  const phases = useMemo(
    () => Array.from(new Set(rows.map((r) => r.phase))),
    [rows]
  );

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

  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else window.history.back();
  };

  const handleView = (row) => {
    // Hook this to your modal or route
    if (typeof onView === "function") onView(row);
    else alert(`Viewing task:\n${row.assigned} • ${row.task}`);
  };

  return (
    <div className="flex-1 min-w-0 max-w-full overflow-hidden space-y-4">
      {/* Back */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
          title="Back to Tasks Record"
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
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Created
                  </span>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Due Date
                  </span>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Time
                  </span>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Completed
                  </span>
                </th>
                <th className="py-2 pr-3 whitespace-nowrap">Revision No</th>
                <th className="py-2 pr-3 whitespace-nowrap">Status</th>
                <th className="py-2 pr-3 whitespace-nowrap">Methodology</th>
                <th className="py-2 pr-3 whitespace-nowrap">Project Phase</th>
                <th className="py-2 pr-6 whitespace-nowrap">Action</th>
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
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.due)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatTime(r.time)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.completed)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.revision}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.status}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.methodology}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.phase}</td>
                  {/* Member-only action: View */}
                  <td className="py-2 pr-6 whitespace-nowrap">
                    <button
                      onClick={() => handleView(r)}
                      className="p-1 rounded-md text-neutral-700 hover:bg-neutral-100"
                      title="View"
                      aria-label="View"
                      style={{ color: MAROON }}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
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
export default FinalDefense
