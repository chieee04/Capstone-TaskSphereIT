// src/components/CapstoneMember/MemberTasks.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Eye,
} from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const MAROON = "#6A0F14";

export default function MemberTasks() {
  const navigate = useNavigate();
  const uid =
    typeof window !== "undefined" ? localStorage.getItem("uid") : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");

  const to12h = (t) => {
    if (!t) return "";
    const [H, M] = String(t).split(":").map(Number);
    const ampm = H >= 12 ? "PM" : "AM";
    const hh = ((H + 11) % 12) + 1;
    return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
  };

  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const fmtDate = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return "";
    const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
    return `${MONTHS[(m || 1) - 1]} ${Number(d || 1)}, ${y}`;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const cols = [
          { coll: "titleDefenseTasks" },
          { coll: "oralDefenseTasks" },
          { coll: "finalDefenseTasks" },
          { coll: "finalRedefenseTasks" },
        ];
        const snaps = await Promise.all(
          cols.map((c) => getDocs(collection(db, c.coll)))
        );
        const all = [];
        snaps.forEach((s, i) => {
          const collName = cols[i].coll;
          s.forEach((dx) =>
            all.push({ id: dx.id, sourceColl: collName, ...(dx.data() || {}) })
          );
        });

        const mine = all.filter(
          (t) =>
            Array.isArray(t.assignees) &&
            t.assignees.some((a) => a?.uid === uid)
        );
        const mapped = mine.map((t) => ({
          id: t.id,
          sourceColl: t.sourceColl,
          task: t.task || t.type || "Task",
          subtask: "—",
          element: "—",
          dateCreated: t.createdAt?.toDate?.()?.toLocaleDateString?.() || "—",
          dueDate: fmtDate(t.dueDate || ""),
          time: to12h(t.dueTime || ""),
          revision: t.revision || "No Revision",
          status: t.status || "To Do",
          projectPhase: t.phase || "Design",
          dueAtMs: typeof t.dueAtMs === "number" ? t.dueAtMs : null,
          _missed:
            typeof t.dueAtMs === "number" &&
            t.dueAtMs < Date.now() &&
            (t.status || "") !== "Completed",
        }));

        mapped.sort((a, b) => {
          const ak =
            mine.find((x) => x.id === a.id)?.createdAt?.toMillis?.() || 0;
          const bk =
            mine.find((x) => x.id === b.id)?.createdAt?.toMillis?.() || 0;
          if (bk !== ak) return bk - ak;
          return (a.dueDate || "").localeCompare(b.dueDate || "");
        });

        if (alive) setRows(mapped);
      } catch (e) {
        console.error("MemberTasks load failed:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = rows;
    if (statusFilter && statusFilter !== "All") {
      if (statusFilter === "Missed") base = base.filter((r) => r._missed);
      else
        base = base.filter(
          (r) => (r.status || "").toLowerCase() === statusFilter.toLowerCase()
        );
    }
    if (!q) return base;
    return base.filter((r) =>
      [r.task, r.subtask, r.element, r.status, r.projectPhase]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchQuery, statusFilter]);

  const allowedStatuses = ["To Do", "In Progress", "To Review"];
  const canUpdateRow = (row) =>
    allowedStatuses.includes(row.status || "") && !row._missed;

  const handleUpdateStatus = async (row, newStatus) => {
    if (!row?.id || !row?.sourceColl) return;
    if (!allowedStatuses.includes(newStatus)) return;
    try {
      await updateDoc(doc(db, row.sourceColl, row.id), { status: newStatus });
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id && r.sourceColl === row.sourceColl
            ? { ...r, status: newStatus }
            : r
        )
      );
    } catch (e) {
      console.error("Update status failed:", e);
      alert("Failed to update status.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "To Do":
        return "bg-yellow-400 text-white";
      case "In Progress":
        return "bg-green-600 text-white";
      case "To Review":
        return "bg-blue-500 text-white";
      case "Completed":
        return "bg-purple-500 text-white";
      case "Missed":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-300 text-gray-800";
    }
  };

  const handleViewTask = (row) => {
    navigate("/member/tasks-board", { state: { selectedTask: row } });
  };

  return (
    <div className="space-y-4">
      {/* ===== Title + underline ===== */}
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 text-[18px] font-semibold"
          style={{ color: MAROON }}
        >
          <ClipboardList className="w-5 h-5" />
          <span>Tasks</span>
        </div>
        <div className="h-[3px] w-full" style={{ backgroundColor: MAROON }} />
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            className="border border-neutral-300 rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ boxShadow: `0 0 0 2px transparent` }}
            onFocus={(e) =>
              (e.target.style.boxShadow = `0 0 0 2px ${MAROON}33`)
            }
            onBlur={(e) => (e.target.style.boxShadow = "0 0 0 2px transparent")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          >
            <option>All</option>
            <option>To Do</option>
            <option>In Progress</option>
            <option>To Review</option>
            <option>Missed</option>
          </select>
        </div>
      </div>

      {/* ===== Desktop Table ===== */}
      <div className="hidden md:block overflow-x-auto border border-neutral-200 rounded-lg">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              {[
                "NO",
                "Task",
                "Subtask",
                "Element",
                "Date Created",
                "Due Date",
                "Time",
                "Revision NO",
                "Status",
                "Project Phase",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-neutral-200">
            {filteredData.map((row, index) => (
              <tr key={index} className="hover:bg-neutral-50">
                <td className="px-6 py-4 text-sm">{index + 1}</td>
                <td className="px-6 py-4 text-sm">{row.task}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 text-center">
                  {row.subtask}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 text-center">
                  {row.element}
                </td>
                <td className="px-6 py-4 text-sm">{row.dateCreated}</td>
                <td className="px-6 py-4 text-sm">{row.dueDate}</td>
                <td className="px-6 py-4 text-sm">{row.time}</td>
                <td className="px-6 py-4 text-sm">{row.revision}</td>

                {/* Status Column with Dropdown */}
                <td className="px-6 py-4">
                  {canUpdateRow(row) ? (
                    <select
                      value={row.status}
                      onChange={(e) => handleUpdateStatus(row, e.target.value)}
                      className={`border border-neutral-300 rounded-md px-2 py-1 text-sm ${getStatusColor(
                        row.status
                      )}`}
                    >
                      {allowedStatuses.map((s) => (
                        <option
                          key={s}
                          value={s}
                          className="bg-white text-gray-800"
                        >
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-medium rounded-md ${getStatusColor(
                        row._missed ? "Missed" : row.status
                      )}`}
                    >
                      {row._missed ? "Missed" : row.status}
                    </span>
                  )}
                </td>

                <td className="px-6 py-4 text-sm">{row.projectPhase}</td>

                {/* Action Column with View Button */}
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleViewTask(row)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-maroon text-white rounded-md hover:bg-maroon/90 transition-colors"
                    style={{ backgroundColor: MAROON }}
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filteredData.length === 0 && (
              <tr>
                <td
                  className="px-6 py-6 text-center text-neutral-500"
                  colSpan={11}
                >
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile Card Layout ===== */}
      <div className="md:hidden divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
        {filteredData.map((row, index) => (
          <div key={index} className="p-4 bg-white">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-neutral-500">
                Task #{index + 1}
              </span>

              {/* Status Dropdown for Mobile */}
              {canUpdateRow(row) ? (
                <select
                  value={row.status}
                  onChange={(e) => handleUpdateStatus(row, e.target.value)}
                  className={`border border-neutral-300 rounded-md px-2 py-1 text-xs ${getStatusColor(
                    row.status
                  )}`}
                >
                  {allowedStatuses.map((s) => (
                    <option
                      key={s}
                      value={s}
                      className="bg-white text-gray-800"
                    >
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`inline-flex px-3 py-1 text-xs font-medium rounded-md ${getStatusColor(
                    row._missed ? "Missed" : row.status
                  )}`}
                >
                  {row._missed ? "Missed" : row.status}
                </span>
              )}
            </div>

            <div className="space-y-1 text-sm text-neutral-800">
              <p>
                <b>Task:</b> {row.task}
              </p>
              <p>
                <b>Subtask:</b> {row.subtask}
              </p>
              <p>
                <b>Element:</b> {row.element}
              </p>
              <p>
                <b>Due Date:</b> {row.dueDate} • {row.time}
              </p>
              <p>
                <b>Revision:</b> {row.revision}
              </p>
              <p>
                <b>Phase:</b> {row.projectPhase}
              </p>

              {/* View Button for Mobile */}
              <div className="mt-3">
                <button
                  onClick={() => handleViewTask(row)}
                  className="flex items-center justify-center gap-1 w-full px-3 py-2 text-sm bg-maroon text-white rounded-md hover:bg-maroon/90 transition-colors"
                  style={{ backgroundColor: MAROON }}
                >
                  <Eye className="w-4 h-4" />
                  View Task Details
                </button>
              </div>
            </div>
          </div>
        ))}

        {!loading && filteredData.length === 0 && (
          <div className="text-center py-6 text-neutral-500 text-sm">
            No tasks found.
          </div>
        )}
      </div>
    </div>
  );
}
