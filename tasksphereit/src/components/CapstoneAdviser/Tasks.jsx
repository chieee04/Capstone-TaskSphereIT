// src/components/CapstoneAdviser/AdviserTasks.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ClipboardList,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Caret,
  Filter as FilterIcon,
  MoreVertical,
  Search,
  Clock,
  Loader2,
} from "lucide-react";

/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const MAROON = "#6A0F14";

/* ---------- small UI helpers ---------- */
const StatusBadge = ({ value }) => {
  if (!value || value === "null") return <span>null</span>;
  const map = {
    "To Do": "bg-[#D9A81E] text-white",
    "To Review": "bg-[#6FA8DC] text-white",
    "In Progress": "bg-[#7C9C3B] text-white",
    Completed: "bg-[#6A0F14] text-white",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium ${map[value] || "bg-neutral-200"}`}
    >
      {value}
    </span>
  );
};

const RevisionPill = ({ value }) =>
  value && value !== "null" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-neutral-100 border border-neutral-200">
      {value}
    </span>
  ) : (
    <span>null</span>
  );

/* ---------- Card ---------- */
const CategoryCard = ({ title, onClick }) => (
  <button
    onClick={onClick}
    className="cursor-pointer relative w-56 h-44 text-left bg-white border border-neutral-200 rounded-2xl shadow-[0_6px_12px_rgba(0,0,0,0.12)] overflow-hidden hover:translate-y-[-2px] transition-transform"
  >
    <div className="absolute left-0 top-0 h-full w-8" style={{ backgroundColor: MAROON }} />
    <div className="absolute bottom-0 left-0 right-0 h-5" style={{ backgroundColor: MAROON }} />
    <div className="pl-12 pr-4 pt-6">
      <CalendarDays className="w-12 h-12 text-neutral-900" />
      <p className="mt-3 font-medium">{title}</p>
    </div>
  </button>
);

/* ===================== MAIN ===================== */
export default function AdviserTasks() {
  /* -------- view state -------- */
  const [category, setCategory] = useState(null); // 'oral' | 'final' | null
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  /* -------- identity -------- */
  const [adviserUid, setAdviserUid] = useState("");

  /* -------- data state -------- */
  const [teams, setTeams] = useState([]); // teams under this adviser
  const [teamId, setTeamId] = useState(""); // "ALL" | specific team id
  const [tasks, setTasks] = useState([]); // rows from Firestore

  /* -------- ui state -------- */
  const [selected, setSelected] = useState(new Set());
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [err, setErr] = useState("");

  // Inline editing
  const [editingCell, setEditingCell] = useState(null); // {id, field}
  const [optimistic, setOptimistic] = useState({}); // { [id]: { due?, time?, revision?, status? } }

  /* -------- derived -------- */
  const collectionName =
  category === "final"
    ? "finalDefenseTasks"
    : category === "oral"
    ? "oralDefenseTasks"
    : category === "finalRedefense"
    ? "finalRedefenseTasks"
    : null;

  /* ================== Effects ================== */

  // 0) Track signed-in user reliably
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid || localStorage.getItem("uid") || "";
      setAdviserUid(uid);
    });
    return () => stop();
  }, []);

  // 1) Load teams owned by this adviser (expects teams docs to have adviser.uid)
  useEffect(() => {
    if (!adviserUid) return;
    setLoadingTeams(true);
    const qTeams = query(
      collection(db, "teams"),
      where("adviser.uid", "==", adviserUid)
    );
    const unsub = onSnapshot(
      qTeams,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeams(rows);
        if (!teamId) setTeamId("ALL");
        setLoadingTeams(false);
      },
      (e) => {
        console.error("Teams snapshot error:", e);
        setErr(e.message || "Failed to load teams.");
        setLoadingTeams(false);
      }
    );
    return () => unsub();
  }, [adviserUid]); // eslint-disable-line

  // 2) Load tasks for current category + team(s) using batched `in` queries (chunks of 10)
  useEffect(() => {
    if (!collectionName) {
      setTasks([]);
      return;
    }
    if (loadingTeams) return;

    // If no teams or no selection to fetch
    const teamIdsToFetch =
      teamId === "ALL"
        ? teams.map((t) => t.id)
        : teamId
        ? [teamId]
        : [];

    if (teamIdsToFetch.length === 0) {
      setTasks([]);
      return;
    }

    // Helper to chunk arrays into size n
    const chunk = (arr, n = 10) =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
        arr.slice(i * n, i * n + n)
      );

    setLoadingTasks(true);
    setErr("");

    // We’ll attach multiple listeners (team.id in [...], teamId in [...]) and merge results by doc id
    const colRef = collection(db, collectionName);
    const idChunks = chunk(teamIdsToFetch, 10);

    const unsubs = [];
    const merged = new Map(); // id -> data

    const rebuildRows = () => {
      let rows = Array.from(merged.values()).map((x, idx) => {
        const createdAtMillis =
          typeof x.createdAt?.toMillis === "function"
            ? x.createdAt.toMillis()
            : (typeof x.updatedAt?.toMillis === "function"
                ? x.updatedAt.toMillis()
                : 0);

        // prefer embedded team then fallback to teamId
        const teamObj = x.team || {};
        const tId = teamObj.id || x.teamId || "no-team";
        const foundTeam = teams.find((t) => t.id === tId) || null;

        return {
          id: x.__id, // injected below
          no: idx + 1,
          assigned: (x.assignees || []).map((a) => a.name).join(", "),
          type: x.type || "null",
          methodology: x.methodology || "null",
          phase: x.phase || "null",
          task: x.task || "null",
          created:
            typeof x.createdAt?.toDate === "function"
              ? x.createdAt.toDate().toLocaleDateString()
              : "null",
          createdAtMillis,
          due: x.dueDate || "null",
          time: x.dueTime || "null",
          revision: x.revision || "No Revision",
          status: x.status || "To Do",
          teamId: tId,
          teamName: teamObj.name || foundTeam?.name || "No Team",
          __raw: x,
        };
      });

      // Sort client-side by createdAt DESC
      rows.sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));
      // Re-number after sort
      rows = rows.map((r, i) => ({ ...r, no: i + 1 }));

      setTasks(rows);
      setSelected(new Set());
      setPage(1);
      setOptimistic({});
      setLoadingTasks(false);
    };

    const handleSnap = (snap) => {
      snap.docs.forEach((d) => {
        const x = d.data();
        if (x.taskManager === "Adviser") { // Filter by taskManager: "Adviser"
          merged.set(d.id, { __id: d.id, ...x });
        }
      });
      rebuildRows();
    };

    const handleErr = (e) => {
      console.error("Tasks snapshot error:", e);
      if (e.code === "permission-denied") {
        setErr("Permission denied by Firestore rules for this adviser/team.");
      } else {
        setErr(e.message || "Failed to load tasks.");
      }
      setLoadingTasks(false);
    };

    // Attach listeners for both shapes using batched IN queries
    idChunks.forEach((ids) => {
      unsubs.push(
        onSnapshot(query(colRef, where("team.id", "in", ids), where("taskManager", "==", "Adviser")), handleSnap, handleErr)
      );
      unsubs.push(
        onSnapshot(query(colRef, where("teamId", "in", ids), where("taskManager", "==", "Adviser")), handleSnap, handleErr)
      );
    });

    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [collectionName, teamId, teams, loadingTeams]);

  /* ================== Helpers ================== */

  const rows = useMemo(() => {
    return tasks.map((r) => ({ ...r, ...(optimistic[r.id] || {}) }));
  }, [tasks, optimistic]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        String(r.no).includes(s) ||
        (r.assigned || "").toLowerCase().includes(s) ||
        (r.type || "").toLowerCase().includes(s) ||
        (r.methodology || "").toLowerCase().includes(s) ||
        (r.task || "").toLowerCase().includes(s) ||
        (r.created || "").toLowerCase().includes(s) ||
        (r.due || "").toLowerCase().includes(s) ||
        (r.time || "").toLowerCase().includes(s) ||
        String(r.revision || "").toLowerCase().includes(s) ||
        String(r.status || "").toLowerCase().includes(s) ||
        (r.teamName || "").toLowerCase().includes(s)
    );
  }, [q, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // When showing ALL teams, group the *paged* rows by team for display
  const grouped = useMemo(() => {
    if (teamId !== "ALL") return null;
    const map = new Map();
    for (const r of pageRows) {
      const k = r.teamId || "no-team";
      if (!map.has(k)) map.set(k, { teamId: k, teamName: r.teamName || "No Team", rows: [] });
      map.get(k).rows.push(r);
    }
    return Array.from(map.values());
  }, [teamId, pageRows]);

  const toggleSelect = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const startEdit = (row, field) => {
    if (!["due", "time", "revision", "status"].includes(field)) return;
    if (field === "time" && (row.due === "null" || !row.due)) return; // need due first
    setEditingCell({ id: row.id, field });
  };
  const stopEdit = () => setEditingCell(null);

  const setOpt = (id, patch) =>
    setOptimistic((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  const savePatch = async (rowId, patch, optimisticPatch) => {
    setOpt(rowId, optimisticPatch);
    await updateDoc(doc(db, collectionName, rowId), patch);
  };

  const saveDue = async (row, newDate) => {
    const time = optimistic[row.id]?.time ?? row.time;
    const hasTime = time && time !== "null";
    const dueAtMs = newDate && hasTime ? new Date(`${newDate}T${time}:00`).getTime() : null;

    const createdDate =
      row.createdAtMillis ? new Date(row.createdAtMillis).toISOString().split("T")[0] : null;
    if (createdDate && newDate && newDate < createdDate) {
      alert("Due Date must be after the task creation date.");
      return;
    }

    await savePatch(
      row.id,
      { dueDate: newDate || null, dueAtMs },
      { due: newDate || "null", ...(newDate ? {} : { time: "null" }) }
    );
    stopEdit();
  };

  const saveTime = async (row, newTime) => {
    const due = optimistic[row.id]?.due ?? row.due;
    const dueAtMs =
      due && due !== "null" && newTime ? new Date(`${due}T${newTime}:00`).getTime() : null;

    await savePatch(row.id, { dueTime: newTime || null, dueAtMs }, { time: newTime || "null" });
    stopEdit();
  };

  const saveRevision = async (row, newRev) => {
    await savePatch(row.id, { revision: newRev || null }, { revision: newRev || "null" });
    stopEdit();
  };

  const saveStatus = async (row, newStatus) => {
    await savePatch(row.id, { status: newStatus || null }, { status: newStatus || "null" });
    stopEdit();
  };

  const deleteRow = async (id) => {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, collectionName, id));
    } finally {
      setDeletingId(null);
    }
  };

  /* ================== Render ================== */
  <span className="font-semibold">
  {category === "oral" 
    ? "Oral Defense" 
    : category === "final" 
    ? "Final Defense" 
    : "Final Re-Defense"}
</span>
  if (!category) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Tasks</h2>
      </div>
      <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />
      <div className="flex flex-wrap gap-4">
        <CategoryCard title="Oral Defense" onClick={() => setCategory("oral")} />
        <CategoryCard title="Final Defense" onClick={() => setCategory("final")} />
        <CategoryCard title="Final Re-Defense" onClick={() => setCategory("finalRedefense")} />
      </div>
    </div>
  );
}

  return (
    <div className="space-y-4">
      {/* header trail */}
      <div className="flex items-center gap-2">
  <ClipboardList className="w-5 h-5" />
  <h2 className="text-lg font-semibold">Tasks</h2>
  <Caret className="w-4 h-4 text-neutral-500" />
  <span className="font-semibold">
    {category === "oral" 
      ? "Oral Defense" 
      : category === "final" 
      ? "Final Defense" 
      : "Final Re-Defense"}
  </span>
</div>
      <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />

      {/* toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => {
            setCategory(null);
            setTeamId("");
            setTasks([]);
            setSelected(new Set());
            setPage(1);
          }}
          className="cursor-pointer inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Categories
        </button>

        {/* Team select */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-700">Team:</span>
          <select
            className="w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={loadingTeams || teams.length === 0}
          >
            <option value="ALL">All teams</option>
            {teams.length === 0 ? (
              <option value="">No teams</option>
            ) : (
              teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Search */}
        <div className="relative ml-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search"
            className="w-64 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="cursor-pointer inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
            onClick={() => alert("Filter panel")}
          >
            <FilterIcon className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* table */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] leading-tight whitespace-nowrap">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pl-6 pr-3 w-10">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(pageRows.map((r) => r.id)));
                      else setSelected(new Set());
                    }}
                    checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                  />
                </th>
                <th className="py-2 pr-3 w-16">NO</th>
                <th className="py-2 pr-3">{teamId === "ALL" ? "Team" : "Assigned"}</th>
                {teamId !== "ALL" && <th className="py-2 pr-3">Task Type</th>}
                {teamId !== "ALL" && <th className="py-2 pr-3">Methodology</th>}
                {teamId !== "ALL" && <th className="py-2 pr-3">Task</th>}
                {teamId === "ALL" && <th className="py-2 pr-3">Task Type</th>}
                {teamId === "ALL" && <th className="py-2 pr-3">Methodology</th>}
                {teamId === "ALL" && <th className="py-2 pr-3">Task</th>}
                <th className="py-2 pr-3">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Date Created
                  </div>
                </th>
                <th className="py-2 pr-3">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Due Date
                  </div>
                </th>
                <th className="py-2 pr-3">
                  <div className="inline-flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Time
                  </div>
                </th>
                <th className="py-2 pr-3">Revision NO</th>
                <th className="py-2 pr-6">Status</th>
                <th className="py-2 pr-6 w-12 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {(loadingTeams || loadingTasks) && (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-neutral-500">
                    Loading tasks…
                  </td>
                </tr>
              )}
              {!!err && !loadingTeams && !loadingTasks && (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-red-600">
                    {err}
                  </td>
                </tr>
              )}
              {!loadingTeams && !loadingTasks && !err && pageRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-neutral-500">
                    No tasks {teamId === "ALL" ? "for your teams." : "for this team."}
                  </td>
                </tr>
              )}

              {/* Grouped by Team (ALL teams) */}
              {teamId === "ALL" &&
                !loadingTeams &&
                !loadingTasks &&
                !err &&
                (() => {
                  return grouped?.map((g, gIdx) => (
                    <React.Fragment key={g.teamId || `group-${gIdx}`}>
                      <tr className="bg-neutral-50/60">
                        <td colSpan={12} className="py-2 pl-6 pr-3 text-[13px] font-semibold text-neutral-800">
                          Team: {g.teamName}
                        </td>
                      </tr>
                      {g.rows.map((r, idx) => {
                        const isEditing = (field) => editingCell?.id === r.id && editingCell?.field === field;

                        return (
                          <tr key={r.id} className="border-t border-neutral-200">
                            <td className="py-2 pl-6 pr-3">
                              <input
                                type="checkbox"
                                checked={selected.has(r.id)}
                                onChange={() => toggleSelect(r.id)}
                              />
                            </td>

                            <td className="py-2 pr-3">{(page - 1) * pageSize + idx + 1}.</td>
                            <td className="py-2 pr-3">{g.teamName}</td>
                            <td className="py-2 pr-3">{r.type}</td>
                            <td className="py-2 pr-3">{r.methodology}</td>
                            <td className="py-2 pr-3">{r.task}</td>
                            <td className="py-2 pr-3">{r.created}</td>

                            {/* Due Date (editable) */}
                            <td
                              className="py-2 pr-3"
                              onDoubleClick={() => startEdit(r, "due")}
                              title="Double-click to edit"
                            >
                              {isEditing("due") ? (
                                <input
                                  type="date"
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={r.due === "null" ? "" : r.due}
                                  onBlur={(e) => saveDue(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                />
                              ) : (
                                <span>{r.due}</span>
                              )}
                            </td>

                            {/* Time (editable; requires due) */}
                            <td
                              className={`py-2 pr-3 ${r.due === "null" ? "text-neutral-400 cursor-not-allowed" : ""}`}
                              onDoubleClick={() => startEdit(r, "time")}
                              title={r.due === "null" ? "Set Due Date first" : "Double-click to edit"}
                            >
                              {isEditing("time") ? (
                                <input
                                  type="time"
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={r.time === "null" ? "" : r.time}
                                  onBlur={(e) => saveTime(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                />
                              ) : (
                                <span>{r.time}</span>
                              )}
                            </td>

                            {/* Revision (editable) */}
                            <td
                              className="py-2 pr-3"
                              onDoubleClick={() => startEdit(r, "revision")}
                              title="Double-click to edit"
                            >
                              {isEditing("revision") ? (
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="e.g., 1st Revision"
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={r.revision === "null" ? "" : r.revision}
                                  onBlur={(e) => saveRevision(r, e.target.value.trim())}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                />
                              ) : (
                                <RevisionPill value={r.revision} />
                              )}
                            </td>

                            {/* Status (editable) */}
                            <td
                              className="py-2 pr-6"
                              onDoubleClick={() => startEdit(r, "status")}
                              title="Double-click to edit"
                            >
                              {isEditing("status") ? (
                                <select
                                  autoFocus
                                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                  defaultValue={r.status === "null" ? "" : r.status}
                                  onBlur={(e) => saveStatus(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    if (e.key === "Escape") stopEdit();
                                  }}
                                >
                                  <option value="">null</option>
                                  <option>To Do</option>
                                  <option>To Review</option>
                                  <option>In Progress</option>
                                  <option>Completed</option>
                                </select>
                              ) : (
                                <StatusBadge value={r.status} />
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-2 pr-6">
                              <div className="relative flex justify-center">
                                <button
                                  className="p-1.5 rounded-md hover:bg-neutral-100"
                                  onClick={() =>
                                    setMenuOpenId(menuOpenId === r.id ? null : r.id)
                                  }
                                  aria-label="Row actions"
                                >
                                  <MoreVertical className="w-4 h-4 text-neutral-600" />
                                </button>

                                {menuOpenId === r.id && (
                                  <div className="absolute right-0 top-6 z-10 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg p-1">
                                    <div className="flex flex-col">
                                      <button
                                        className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-neutral-50"
                                        onClick={() => {
                                          setMenuOpenId(null);
                                          alert(`Open detail: ${r.id}`);
                                        }}
                                      >
                                        View
                                      </button>
                                      <button
                                        className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-neutral-50 disabled:opacity-50"
                                        disabled={deletingId === r.id}
                                        onClick={() => {
                                          setMenuOpenId(null);
                                          deleteRow(r.id);
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
                        );
                      })}
                    </React.Fragment>
                  ));
                })()}

              {/* Single team (original) */}
              {teamId !== "ALL" &&
                !loadingTeams &&
                !loadingTasks &&
                !err &&
                pageRows.map((r, idx) => {
                  const isEditing = (field) => editingCell?.id === r.id && editingCell?.field === field;

                  return (
                    <tr key={r.id} className="border-t border-neutral-200">
                      <td className="py-2 pl-6 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                        />
                      </td>

                      <td className="py-2 pr-3">{(page - 1) * pageSize + idx + 1}.</td>
                      <td className="py-2 pr-3">{r.assigned}</td>
                      <td className="py-2 pr-3">{r.type}</td>
                      <td className="py-2 pr-3">{r.methodology}</td>
                      <td className="py-2 pr-3">{r.task}</td>
                      <td className="py-2 pr-3">{r.created}</td>

                      {/* Due Date (editable) */}
                      <td
                        className="py-2 pr-3"
                        onDoubleClick={() => startEdit(r, "due")}
                        title="Double-click to edit"
                      >
                        {isEditing("due") ? (
                          <input
                            type="date"
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.due === "null" ? "" : r.due}
                            onBlur={(e) => saveDue(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          />
                        ) : (
                          <span>{r.due}</span>
                        )}
                      </td>

                      {/* Time (editable; requires due) */}
                      <td
                        className={`py-2 pr-3 ${r.due === "null" ? "text-neutral-400 cursor-not-allowed" : ""}`}
                        onDoubleClick={() => startEdit(r, "time")}
                        title={r.due === "null" ? "Set Due Date first" : "Double-click to edit"}
                      >
                        {isEditing("time") ? (
                          <input
                            type="time"
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.time === "null" ? "" : r.time}
                            onBlur={(e) => saveTime(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          />
                        ) : (
                          <span>{r.time}</span>
                        )}
                      </td>

                      {/* Revision (editable) */}
                      <td
                        className="py-2 pr-3"
                        onDoubleClick={() => startEdit(r, "revision")}
                        title="Double-click to edit"
                      >
                        {isEditing("revision") ? (
                          <input
                            type="text"
                            autoFocus
                            placeholder="e.g., 1st Revision"
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.revision === "null" ? "" : r.revision}
                            onBlur={(e) => saveRevision(r, e.target.value.trim())}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          />
                        ) : (
                          <RevisionPill value={r.revision} />
                        )}
                      </td>

                      {/* Status (editable) */}
                      <td
                        className="py-2 pr-6"
                        onDoubleClick={() => startEdit(r, "status")}
                        title="Double-click to edit"
                      >
                        {isEditing("status") ? (
                          <select
                            autoFocus
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            defaultValue={r.status === "null" ? "" : r.status}
                            onBlur={(e) => saveStatus(r, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") stopEdit();
                            }}
                          >
                            <option value="">null</option>
                            <option>To Do</option>
                            <option>To Review</option>
                            <option>In Progress</option>
                            <option>Completed</option>
                          </select>
                        ) : (
                          <StatusBadge value={r.status} />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 pr-6">
                        <div className="relative flex justify-center">
                          <button
                            className="p-1.5 rounded-md hover:bg-neutral-100"
                            onClick={() =>
                              setMenuOpenId(menuOpenId === r.id ? null : r.id)
                            }
                            aria-label="Row actions"
                          >
                            <MoreVertical className="w-4 h-4 text-neutral-600" />
                          </button>

                          {menuOpenId === r.id && (
                            <div className="absolute right-0 top-6 z-10 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg p-1">
                              <div className="flex flex-col">
                                <button
                                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-neutral-50"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    alert(`Open detail: ${r.id}`);
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-neutral-50 disabled:opacity-50"
                                  disabled={deletingId === r.id}
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    deleteRow(r.id);
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
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
