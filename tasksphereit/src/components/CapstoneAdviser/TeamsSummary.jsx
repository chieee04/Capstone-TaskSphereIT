import React, { useEffect, useMemo, useState } from "react";
import { Users, ChevronRight, FileText, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
 
/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
 
/* ---------------------- CONSTANTS & HELPERS ---------------------- */
const MAROON = "#3B0304";
 
const emptyProgress = { todo: 0, inprogress: 0, review: 0, done: 0, missed: 0 };
 
/** Builds stroke segments for an SVG donut */
function useDonutSegments(progress) {
  return useMemo(() => {
    const parts = [
      { key: "todo", label: "To Do", color: "#FABC3F" },
      { key: "inprogress", label: "In Progress", color: "#809D3C" },
      { key: "review", label: "To Review", color: "#578FCA" },
      { key: "done", label: "Completed", color: "#AA60C8" },
      { key: "missed", label: "Missed", color: MAROON },
    ];
 
    const total = parts.reduce((s, p) => s + (progress[p.key] || 0), 0) || 1;
    let acc = 0;
    const segments = parts.map((p) => {
      const val = progress[p.key] || 0;
      const frac = val / total;
      const seg = {
        ...p,
        value: val,
        frac,
        dasharray: `${(frac * 100).toFixed(4)} ${(100 - frac * 100).toFixed(4)}`,
        dashoffset: (-(acc * 100)).toFixed(4),
      };
      acc += frac;
      return seg;
    });
 
    // Calculate completion percentage: (Completed tasks / Total tasks) * 100
    const completion = total > 0 ? Math.round((progress.done / total) * 100) : 0;
 
    return { segments, completion, total, parts };
  }, [progress]);
}
 
/* ----------------------- formatting helpers ----------------------- */
const isTs = (v) => v && typeof v === "object" && typeof v.toDate === "function";
 
const fmtDate = (v) => {
  try {
    const d = isTs(v) ? v.toDate() : new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
};
 
const fmtTime = (v) => {
  if (!v) return "—";
  // accept "08:00", Date/Timestamp, or ISO
  try {
    if (typeof v === "string" && /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(v)) return v;
    const d = isTs(v) ? v.toDate() : new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
};
 
const fmtTimeRange = (start, end) => {
  if (!start && !end) return "—";
  if (start && end) return `${fmtTime(start)}–${fmtTime(end)}`;
  return fmtTime(start || end);
};
 
/* ----------------------- UPDATED CARD COMPONENTS ----------------------- */
function TeamCard({ team, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg transition-all duration-300
                 hover:shadow-2xl hover:-translate-y-2 hover:border-gray-300 active:scale-[0.98] text-neutral-800 overflow-hidden group"
    >
      {/* Bottom accent - reduced height */}
      <div
        className="absolute bottom-0 left-0 right-0 h-6 rounded-b-2xl transition-all duration-300 group-hover:h-8"
        style={{ background: MAROON }}
      />
 
      {/* Central content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-2 pb-10">
        {/* Team icon - centered in main white area with animation */}
        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Users className="w-16 h-16 mb-4 text-black" />
        </div>
 
        {/* Team name text - positioned below icon */}
        <span className="text-base font-bold text-center leading-tight text-black transition-all duration-300 group-hover:scale-105">
          {team.name || "—"}
        </span>
 
        {/* System title - smaller text below team name */}
        <span className="text-xs text-neutral-600 text-center mt-2 transition-all duration-300 group-hover:scale-105">
          {team.systemTitle || "--"}
        </span>
      </div>
 
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style={{
             boxShadow: `0 0 20px ${MAROON}40`,
             background: `radial-gradient(circle at center, transparent 0%, ${MAROON}10 100%)`
           }} />
    </button>
  );
}
 
function Donut({ progress }) {
  const { segments, completion } = useDonutSegments(progress || emptyProgress);
  const size = 220;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
 
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Tasks Progress</p>
        </div>
 
        <div className="flex gap-6 items-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            className="shrink-0"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eee" strokeWidth={stroke} />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${(s.frac * c).toFixed(2)} ${(c - s.frac * c).toFixed(2)}`}
                strokeDashoffset={(s.dashoffset * c * 0.01).toFixed(2)}
                strokeLinecap="butt"
              />
            ))}
            <foreignObject
              x={size * 0.25}
              y={size * 0.33}
              width={size * 0.5}
              height={size * 0.34}
              style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%" }}
            >
              <div className="w-full h-full grid place-items-center">
                <div className="text-4xl font-bold text-neutral-800">{completion}%</div>
                <div className="text-sm text-neutral-500 mt-1">Completed</div>
              </div>
            </foreignObject>
          </svg>
 
          {/* UPDATED: Perfectly circular bullets for legend */}
          <div className="grid gap-3 text-sm">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <div className="flex items-center gap-2">
                  <span className="text-neutral-700 whitespace-nowrap">{s.label}</span>
                  <span className="text-neutral-500 text-xs">({s.value})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
 
function MembersTable({ members }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="p-5">
        <p className="text-sm font-semibold mb-3">Team</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pr-3 w-16">NO</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={`${m.name}-${i}`} className="border-t border-neutral-200">
                  <td className="py-2 pr-3">{i + 1}.</td>
                  <td className="py-2 pr-3">{m.name}</td>
                  <td className="py-2 pr-3">{m.role}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr className="border-t border-neutral-200">
                  <td className="py-6 pr-3 text-neutral-500" colSpan={3}>
                    No members.
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
 
/* ----------------------- Status Badge Component ----------------------- */
const StatusBadge = ({ value }) => {
  const STATUS_COLORS = {
    "To Do": "#FABC3F",
    "In Progress": "#809D3C",
    "To Review": "#578FCA",
    "Completed": "#AA60C8",
    "Missed": "#3B0304",
  };
 
  const backgroundColor = STATUS_COLORS[value] || "#6B7280";
 
  if (!value || value === "null") return <span>--</span>;
 
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium text-white"
      style={{ backgroundColor }}
    >
      {value}
    </span>
  );
};
 
const RevisionPill = ({ value }) =>
  value && value !== "null" && value !== "No Revision" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-neutral-100 border border-neutral-200">
      {value}
    </span>
  ) : (
    <span>--</span>
  );
 
/* ----------------------- UPDATED Tasks Table ----------------------- */
function TasksTable({ tasks, loading, onViewTask }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="p-5">
        <p className="text-sm font-semibold mb-3">Team Tasks</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pr-3 w-16">NO</th>
                <th className="py-2 pr-3">Task Type</th>
                <th className="py-2 pr-3">Tasks</th>
                <th className="py-2 pr-3">Subtask</th>
                <th className="py-2 pr-3">Elements</th>
                <th className="py-2 pr-3">Date Created</th>
                <th className="py-2 pr-3">Due Date</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Date Completed</th>
                <th className="py-2 pr-3">Revision NO</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Project Phase</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-neutral-200">
                  <td className="py-6 pr-3 text-neutral-500" colSpan={13}>
                    Loading tasks…
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr className="border-t border-neutral-200">
                  <td className="py-6 pr-3 text-neutral-500" colSpan={13}>
                    No tasks found for this team.
                  </td>
                </tr>
              ) : (
                tasks.map((t, i) => (
                  <tr key={`${t._id || t.no}-${i}`} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="py-2 pr-3">{i + 1}.</td>
                    <td className="py-2 pr-3">{t.taskType || "—"}</td>
                    <td className="py-2 pr-3">{t.task || "—"}</td>
                    <td className="py-2 pr-3">{t.subtask || "—"}</td>
                    <td className="py-2 pr-3">{t.elements || "—"}</td>
                    <td className="py-2 pr-3">{t.dateCreated || "—"}</td>
                    <td className="py-2 pr-3">{t.dueDate || "—"}</td>
                    <td className="py-2 pr-3">{t.time || "—"}</td>
                    <td className="py-2 pr-3">{t.dateCompleted || "—"}</td>
                    <td className="py-2 pr-3">
                      <RevisionPill value={t.revisions} />
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge value={t.status} />
                    </td>
                    <td className="py-2 pr-3">{t.projectPhase || "—"}</td>
                    <td className="py-2 pr-3">
                      <button 
                        className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-100 transition-colors"
                        onClick={() => onViewTask(t)}
                      >
                        <FileText className="w-4 h-4" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
 
/* ----------------------- MAIN COMPONENT ----------------------- */
const TeamsSummary = () => {
  const navigate = useNavigate();
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null);
 
  const [tasksLoading, setTasksLoading] = useState(false);
  const [teamTasks, setTeamTasks] = useState([]);
  const [teamProgress, setTeamProgress] = useState({});
 
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || ""));
    return () => unsub();
  }, []);
 
  // load advised teams + their titles and teamName (preferred)
  useEffect(() => {
    if (!uid) return;
    let alive = true;
 
    (async () => {
      setLoading(true);
      try {
        const teamsRef = collection(db, "teams");
 
        // primary: adviser.uid
        let snap = await getDocs(query(teamsRef, where("adviser.uid", "==", uid)));
        let docs = snap.docs;
 
        // fallback: adviserUid
        if (docs.length === 0) {
          const alt = await getDocs(query(teamsRef, where("adviserUid", "==", uid)));
          docs = alt.docs;
        }
 
        const enriched = await Promise.all(
          docs.map(async (d) => {
            const data = d.data() || {};
            const teamId = d.id;
 
            // Prefer teamName from teamSystemTitles/{teamId}, else teams/{id}.name
            let systemTitle = "";
            let nameFromTitleDoc = "";
            try {
              const titleDoc = await getDoc(doc(db, "teamSystemTitles", teamId));
              if (titleDoc.exists()) {
                const tdata = titleDoc.data() || {};
                systemTitle = tdata.systemTitle || "";
                nameFromTitleDoc = (tdata.teamName || "").trim();
              }
            } catch {/* ignore */}
 
            const finalName = nameFromTitleDoc || (data.name || "Unnamed Team");
 
            const memberNames = Array.isArray(data.memberNames) ? data.memberNames : [];
            const managerName = data?.manager?.fullName || data?.managerName || "";
            const members = [
              ...(managerName ? [{ name: managerName, role: "Project Manager" }] : []),
              ...memberNames.map((n) => ({ name: n, role: "Member" })),
            ];
 
            return {
              id: teamId,
              name: finalName,
              systemTitle: systemTitle || "",
              members,
              progress: data.progress || emptyProgress,
            };
          })
        );
 
        if (alive) setTeams(enriched);
      } catch (e) {
        console.error("Failed to load advised teams:", e);
        if (alive) setTeams([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
 
    return () => {
      alive = false;
    };
  }, [uid]);
 
  /* ---------- UPDATED: Only fetch adviser tasks ---------- */
  useEffect(() => {
    if (!selected) {
      setTeamTasks([]);
      return;
    }
 
    const team = teams.find((t) => t.id === selected);
    if (!team) {
      setTeamTasks([]);
      return;
    }
 
    let alive = true;
 
    const isTs = (v) => v && typeof v === "object" && typeof v.toDate === "function";
 
    const fmtDateDetailed = (v) => {
      try {
        const d = isTs(v) ? v.toDate() : new Date(v);
        return Number.isNaN(d.getTime())
          ? "—"
          : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      } catch { return "—"; }
    };
 
    const fmtTime12Hour = (time24) => {
      if (!time24 || time24 === "null") return "--";
      try {
        if (typeof time24 === "string") {
          const [hours, minutes] = time24.split(':');
          const hour = parseInt(hours, 10);
          const period = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${period}`;
        }
        return "--";
      } catch {
        return "--";
      }
    };
 
    const normalize = (d, col) => {
      // Determine task type based on collection and data
      let taskType = "—";
      if (d.type === "Documentation" || d.type === "System Development" || d.type === "Discussion & Review") {
        taskType = d.type;
      } else if (d.elements === "Documentation" || d.elements === "System Development" || d.elements === "Discussion & Review") {
        taskType = d.elements;
      } else {
        // Default based on collection
        if (col === "oralDefenseTasks") taskType = "Oral Defense";
        if (col === "finalDefenseTasks") taskType = "Final Defense";
        if (col === "finalRedefenseTasks") taskType = "Final Re-Defense";
      }
 
      // Format dates properly
      const dateCreated = d.createdAt ? fmtDateDetailed(d.createdAt) : "—";
      const dueDate = d.dueDate ? fmtDateDetailed(d.dueDate) : "—";
      const dateCompleted = d.completedAt ? fmtDateDetailed(d.completedAt) : "—";
 
      // IMPORTANT: Store ALL fields from the original data
      return {
        _id: d.id || d.uid,
        taskId: d.id, // Store the Firestore document ID
        sourceColl: col, // Store the collection name
        taskType,
        task: d.task || (col === "oralDefenseTasks" ? "Oral Defense" : "Final Defense"),
        subtask: d.subtask || d.subTask || "—",
        elements: d.elements || d.element || "—",
        dateCreated,
        dueDate,
        time: fmtTime12Hour(d.dueTime || d.time),
        dateCompleted,
        revisions: d.revision || d.revisions || d.revisionCount || "No Revision",
        status: d.status || "To Do",
        projectPhase: d.phase || d.projectPhase || "—",
        methodology: d.methodology || "—", // Store methodology
        // Store COMPLETE original data with ALL fields for navigation
        originalData: {
          id: d.id,
          ...d,
          // Ensure all required fields exist
          methodology: d.methodology || "—",
          phase: d.phase || d.projectPhase || "—",
          task: d.task || (col === "oralDefenseTasks" ? "Oral Defense" : "Final Defense"),
          subtask: d.subtask || d.subTask || "—",
          elements: d.elements || d.element || "—",
          dueTime: d.dueTime || d.time || "—",
          revision: d.revision || d.revisions || d.revisionCount || "No Revision",
          status: d.status || "To Do",
        },
      };
    };
 
    const fetchCol = async (colName) => {
      const out = [];
 
      try {
        // ONLY QUERY ADVISER TASKS - filter by taskManager = "Adviser"
        const q = query(
          collection(db, colName),
          where("team.id", "==", team.id),
          where("taskManager", "==", "Adviser")
        );
 
        const snapshot = await getDocs(q);
        snapshot.forEach((snap) => {
          const d = { id: snap.id, ...snap.data() };
          out.push(normalize(d, colName));
        });
 
      } catch (e) {
        console.error(`Failed to fetch adviser tasks from ${colName}:`, e);
      }
 
      return out;
    };
 
    (async () => {
      setTasksLoading(true);
      try {
        // Fetch from all task collections - ONLY ADVISER TASKS
        const oral = await fetchCol("oralDefenseTasks");
        const final = await fetchCol("finalDefenseTasks");
        const redefense = await fetchCol("finalRedefenseTasks");
 
        // Combine all ADVISER tasks
        const allTasks = [...oral, ...final, ...redefense];
 
        // Calculate progress based on ACTUAL ADVISER TASKS only
        const progress = {
          todo: allTasks.filter(task => task.status === "To Do").length,
          inprogress: allTasks.filter(task => task.status === "In Progress").length,
          review: allTasks.filter(task => task.status === "To Review").length,
          done: allTasks.filter(task => task.status === "Completed").length,
          missed: allTasks.filter(task => task.status === "Missed").length,
        };
 
        // Store progress separately to avoid re-rendering teams state
        setTeamProgress(prev => ({
          ...prev,
          [team.id]: progress
        }));
 
        // Sort by due date or creation date
        allTasks.sort((a, b) => {
          const dateA = new Date(a.dueDate || a.dateCreated || 0);
          const dateB = new Date(b.dueDate || b.dateCreated || 0);
          return dateA - dateB;
        });
 
        if (alive) {
          setTeamTasks(allTasks);
        }
      } catch (e) {
        console.error("Failed loading adviser tasks:", e);
        if (alive) setTeamTasks([]);
      } finally {
        if (alive) {
          setTasksLoading(false);
        }
      }
    })();
 
    return () => { alive = false; };
  }, [selected, teams]);
 
  // Handle view task button click - UPDATED: Pass COMPLETE task data to TeamsBoard
  const handleViewTask = (task) => {
    const team = teams.find((t) => t.id === selected);
 
    if (!team) return;
 
    // Format dates for display - match TeamsBoard format
    const formatDateForDisplay = (dateValue) => {
      if (!dateValue) return "—";
      try {
        // Handle Firestore Timestamp
        const date = typeof dateValue.toDate === 'function' ? 
          dateValue.toDate() : 
          new Date(dateValue);
 
        if (Number.isNaN(date.getTime())) return "—";
 
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        return "—";
      }
    };
 
    // Format time for display - match TeamsBoard format
    const formatTimeForDisplay = (timeString) => {
      if (!timeString || timeString === "—") return "—";
      try {
        if (typeof timeString === "string") {
          const [hours, minutes] = timeString.split(':');
          const hour = parseInt(hours, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${ampm}`;
        }
        return timeString;
      } catch (e) {
        return timeString;
      }
    };
 
    // Get the COMPLETE original task data from Firestore
    const originalTask = task.originalData || {};
 
    // Create COMPLETE task data object that matches TeamsBoard's expected structure
    const taskData = {
      id: task.taskId, // Firestore document ID
      _collection: task.sourceColl, // Firestore collection name
      teamId: team.id,
      teamName: team.name,
      task: originalTask.task || task.task || "Task",
      subtask: originalTask.subtask || originalTask.subTask || task.subtask || "—",
      elements: originalTask.elements || originalTask.element || task.elements || "—",
      createdDisplay: formatDateForDisplay(originalTask.createdAt || task.dateCreated),
      dueDisplay: formatDateForDisplay(originalTask.dueDate || task.dueDate),
      timeDisplay: formatTimeForDisplay(originalTask.dueTime || originalTask.time || task.time),
      revision: originalTask.revision || originalTask.revisions || originalTask.revisionCount || task.revisions || "No Revision",
      status: originalTask.status || task.status || "To Do",
      methodology: originalTask.methodology || "—", // Get from original data
      phase: originalTask.phase || originalTask.projectPhase || task.projectPhase || "—",
      // Add _colId based on status for proper column mapping
      _colId: (() => {
        const status = originalTask.status || task.status;
        if (status === "To Do") return "todo";
        if (status === "In Progress") return "inprogress";
        if (status === "To Review") return "review";
        if (status === "Completed") return "done";
        if (status === "Missed") return "missed";
        return "todo";
      })(),
      // Add other fields that TeamsBoard might expect
      chapter: originalTask.chapter || null,
      type: originalTask.type || task.taskType || null,
      dueAtMs: originalTask.dueAtMs || null,
      taskManager: originalTask.taskManager || "Adviser",
      assignedTo: team.name,
      // Store the complete original task data
      originalTask: originalTask
    };
 
    console.log("Passing task data to TeamsBoard:", taskData);
 
    // Navigate to the TeamsBoard with the COMPLETE task data
    navigate("/adviser/teams-board", { 
      state: { 
        selectedTask: taskData
      } 
    });
  };
 
  // Get current team's progress (ADVISER TASKS ONLY)
  const currentTeamProgress = selected ? teamProgress[selected] : emptyProgress;
 
  if (selected) {
    const team = teams.find((t) => t.id === selected);
 
    return (
      <div className="space-y-4">
        {/* UPDATED HEADER - Consistent with tasks view */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
            <Users className="w-5 h-5" />
            <span>Teams Summary</span>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
            <span>{team?.name || "—"}</span>
          </div>
          <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
        </div>
 
        {/* Top row: members + donut */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MembersTable members={team?.members || []} />
          <Donut progress={currentTeamProgress || emptyProgress} />
        </div>
 
        {/* Tasks from ALL task collections for this team - ADVISER TASKS ONLY */}
        <TasksTable tasks={teamTasks} loading={tasksLoading} onViewTask={handleViewTask} />
      </div>
    );
  }
 
  // CARD GRID VIEW
  return (
    <div className="space-y-4">
      {/* UPDATED HEADER - Consistent with tasks view */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
          <Users className="w-5 h-5" />
          <span>Teams Summary</span>
        </div>
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
      </div>
 
      {loading ? (
        <div className="text-sm text-neutral-500 px-1 py-6">Loading teams…</div>
      ) : teams.length === 0 ? (
        <div className="text-sm text-neutral-500 px-1 py-6">
          No teams under your advisory.
        </div>
      ) : (
        <div className="flex flex-wrap gap-6">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onClick={() => setSelected(team.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
export default TeamsSummary;