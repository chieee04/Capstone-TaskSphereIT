// src/components/CapstoneMember/MemberAdviserTasks.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, Filter, Eye } from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs } from "firebase/firestore";

const MAROON = "#6A0F14";

/* ---------- helpers ---------- */
const to12h = (t) => {
  if (!t) return "";
  const [H, M] = String(t).split(":").map(Number);
  const ampm = (H ?? 0) >= 12 ? "PM" : "AM";
  const hh = (((H ?? 0) + 11) % 12) + 1;
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
  // handle "YYYY-MM-DD" only; otherwise just return as-is
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd)) return yyyy_mm_dd;
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${Number(d || 1)}, ${y}`;
};

const computeDueMs = (dueDate, dueTime) => {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  let H = 0,
    M = 0;
  if (dueTime && /^\d{1,2}:\d{2}$/.test(dueTime)) {
    const [hh, mm] = dueTime.split(":").map(Number);
    H = hh || 0;
    M = mm || 0;
  }
  return new Date(y, (m || 1) - 1, d || 1, H, M).getTime();
};

function MemberAdviserTasks() {
  const uid =
    typeof window !== "undefined" ? localStorage.getItem("uid") : null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewRow, setViewRow] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // Collections to read
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
        snaps.forEach((s) =>
          s.forEach((dx) => all.push({ id: dx.id, ...(dx.data() || {}) }))
        );

        // Only tasks managed by Adviser and where current user is an assignee
        const mine = all.filter(
          (t) =>
            t?.taskManager === "Adviser" &&
            Array.isArray(t.assignees) &&
            t.assignees.some((a) => a?.uid === uid)
        );

        const mapped = mine.map((t) => {
          const createdMillis =
            t?.createdAt?.toMillis?.() ??
            (t?.createdAt?.seconds
              ? t.createdAt.seconds * 1000
              : undefined) ??
            0;

          const dueAtMsExplicit =
            typeof t?.dueAtMs === "number" ? t.dueAtMs : null;
          const dueAtMsFallback = computeDueMs(t?.dueDate, t?.dueTime);
          const dueAtMs = dueAtMsExplicit ?? dueAtMsFallback ?? null;

          const createdStr =
            t?.createdAt?.toDate?.()?.toLocaleDateString?.("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            }) ?? "";

          return {
            id: t.id,
            assigned:
              (t.assignees || [])
                .map((a) => a?.name)
                .filter(Boolean)
                .join(", ") || "—",
            task: t.task || t.type || "Task",
            subtask: t.subtask || t.type || "—",
            element: t.team?.name || t.teamName || "—",
            dateCreated: createdStr || "—",
            dueDate: fmtDate(t.dueDate || ""),
            time: to12h(t.dueTime || ""),
            revision: t.revision || "No Revision",
            status: t.status || "To Do",
            methodology: t.methodology || "—",
            phase: t.phase || "—",
            _missed:
              dueAtMs !== null &&
              dueAtMs < Date.now() &&
              String(t.status || "").toLowerCase() !== "completed",
            __createdMillis: createdMillis,
            __raw: t,
          };
        });

        mapped.sort((a, b) => (b.__createdMillis || 0) - (a.__createdMillis || 0));

        if (alive) setRows(mapped);
      } catch (e) {
        console.error("MemberAdviserTasks load failed:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid]);

  // Normalize status comparison ("Complete" vs "Completed")
  const normalizeStatus = (s) => {
    const v = String(s || "").toLowerCase();
    if (v === "complete") return "completed";
    return v;
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    let base = rows;
    if (statusFilter && statusFilter !== "All") {
      if (statusFilter === "Missed") {
        base = base.filter((r) => r._missed);
      } else {
        base = base.filter(
          (r) => normalizeStatus(r.status) === normalizeStatus(statusFilter)
        );
      }
    }

    if (!s) return base;

    const fields = [
      "assigned",
      "task",
      "subtask",
      "element",
      "revision",
      "status",
      "methodology",
      "phase",
      "dateCreated",
      "dueDate",
      "time",
    ];

    return base.filter((r) =>
      fields
        .map((k) => r[k])
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [rows, q, statusFilter]);

  return (
    <div className="space-y-4">
      {/* ===== Title + underline (matches PM/Adviser style) ===== */}
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 text-[18px] font-semibold"
          style={{ color: MAROON }}
        >
          <ClipboardList className="w-5 h-5" />
          <span>Adviser Tasks</span>
        </div>
        <div className="h-[3px] w-full" style={{ backgroundColor: MAROON }} />
      </div>

      {/* ===== Controls ===== */}
      <div className="flex items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-neutral-400"
            style={{ boxShadow: `0 0 0 2px transparent` }}
            onFocus={(e) =>
              (e.target.style.boxShadow = `0 0 0 2px ${MAROON}33`)
            }
            onBlur={(e) =>
              (e.target.style.boxShadow = "0 0 0 2px transparent")
            }
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-neutral-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-400"
          >
            <option>All</option>
            <option>To Do</option>
            <option>In Progress</option>
            <option>Completed</option>
            <option>Missed</option>
          </select>
        </div>
      </div>

      {/* ===== Table ===== */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-neutral-50/80 text-neutral-600 text-left">
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Subtask</th>
                <th className="px-4 py-3">Team/Element</th>
                <th className="px-4 py-3">Date Created</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Revision</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Methodology</th>
                <th className="px-4 py-3">Project Phase</th>
                <th className="px-2 py-3 text-center">View</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-neutral-500"
                >
                    Loading…
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-neutral-200 hover:bg-neutral-50/60"
                  >
                    <td className="px-4 py-3">{r.assigned}</td>
                    <td className="px-4 py-3">{r.task}</td>
                    <td className="px-4 py-3">{r.subtask}</td>
                    <td className="px-4 py-3">{r.element}</td>
                    <td className="px-4 py-3">{r.dateCreated}</td>
                    <td className="px-4 py-3">{r.dueDate}</td>
                    <td className="px-4 py-3">{r.time}</td>
                    <td className="px-4 py-3">{r.revision}</td>
                    <td className="px-4 py-3">
                      {r._missed ? (
                        <span className="inline-flex items-center rounded-full bg-[#EAB8B8] text-[#5A1A1A] px-2 py-0.5 text-xs">
                          Missed
                        </span>
                      ) : (
                        r.status
                      )}
                    </td>
                    <td className="px-4 py-3">{r.methodology}</td>
                    <td className="px-4 py-3">{r.phase}</td>
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-100"
                        aria-label="View"
                        title="View"
                        onClick={() => setViewRow(r)}
                      >
                        <Eye className="h-4 w-4 text-neutral-700" />
                      </button>
                    </td>
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-neutral-500"
                  >
                    No adviser tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== View Modal ===== */}
      {viewRow && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setViewRow(null)}
          />
          <div className="absolute left-1/2 top-1/2 w-[720px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="px-5 py-3" style={{ backgroundColor: MAROON }}>
              <div className="text-white text-sm font-semibold">Task Details</div>
            </div>
            <div className="p-5 text-sm space-y-2">
              <div>
                <b>Assigned:</b> {viewRow.assigned}
              </div>
              <div>
                <b>Task:</b> {viewRow.task}
              </div>
              <div>
                <b>Subtask:</b> {viewRow.subtask}
              </div>
              <div>
                <b>Team/Element:</b> {viewRow.element}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <b>Date Created:</b> {viewRow.dateCreated}
                </div>
                <div>
                  <b>Due:</b> {viewRow.dueDate} {viewRow.time}
                </div>
                <div>
                  <b>Revision:</b> {viewRow.revision}
                </div>
                <div>
                  <b>Status:</b>{" "}
                  {viewRow._missed ? "Missed" : viewRow.status}
                </div>
                <div>
                  <b>Methodology:</b> {viewRow.methodology}
                </div>
                <div>
                  <b>Project Phase:</b> {viewRow.phase}
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-end">
              <button
                onClick={() => setViewRow(null)}
                className="rounded-md px-4 py-2 text-white"
                style={{ backgroundColor: MAROON }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberAdviserTasks;
