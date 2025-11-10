// src/components/CapstoneMember/tasksrecords/TitleDefense.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  CalendarDays,
  Clock,
  ChevronLeft,
} from "lucide-react";
import { db } from "../../../config/firebase";
import { collection, getDocs } from "firebase/firestore";

const MAROON = "#6A0F14";

// No static rows; loads from Firestore

// ===== Helpers =====
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  const H = parseInt(h, 10);
  const ampm = H >= 12 ? "PM" : "AM";
  const twelve = ((H + 11) % 12) + 1;
  return `${twelve}:${m} ${ampm}`;
}

function TitleDefense({ onBack, onView }) {
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "titleDefenseTasks"));
        const arr = [];
        snap.forEach((d) => {
          const t = d.data() || {};
          const assigned = Array.isArray(t.assignees) ? t.assignees.map((a) => a?.name).filter(Boolean).join(", ") : "";
          const mine = Array.isArray(t.assignees) && t.assignees.some((a) => a?.uid === uid);
          const completed = String(t.status || "").toLowerCase() === "completed";
          if (!mine || !completed) return;
          arr.push({
            assigned: assigned || "—",
            type: t.type || "—",
            task: t.task || t.type || "Task",
            created: t.createdAt?.toDate?.()?.toISOString?.().slice(0,10) || "",
            due: t.dueDate || "",
            time: t.dueTime || "",
            completed: t.completedAt?.toDate?.()?.toISOString?.().slice(0,10) || t.updatedAt?.toDate?.()?.toISOString?.().slice(0,10) || t.dueDate || "",
            revision: t.revision || "No Revision",
            status: t.status || "Completed",
            phase: t.phase || "—",
          });
        });
        // Stable sort by created date desc
        arr.sort((a,b) => (b.created||"").localeCompare(a.created||""));
        if (alive) setRows(arr.map((r, i) => ({ no: i+1, ...r })));
      } catch (e) {
        console.error("Member TitleDefense record load failed:", e);
        if (alive) setRows([]);
      }
    })();
    return () => { alive = false; };
  }, [uid]);

  // derive phases for filter
  const phases = useMemo(() => Array.from(new Set(rows.map((r) => r.phase).filter(Boolean))), [rows]);

  // filter rows
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

  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else window.history.back();
  };

  const handleView = (row) => {
    // Wire up your modal or navigation here
    if (typeof onView === "function") onView(row);
    else alert(`Viewing task: ${row.assigned} • ${row.task}`);
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
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
          {/* Search */}
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
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.created)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.due)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatTime(r.time)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.completed)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.revision}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.status}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.phase}</td>
                  {/* Member-only action: View */}
                  <td className="py-2 pr-6 whitespace-nowrap">
                    <button
                      onClick={() => handleView(r)}
                      className="p-1 rounded-md text-neutral-700 hover:bg-neutral-100"
                      title="View"
                      aria-label="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
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

export default TitleDefense
