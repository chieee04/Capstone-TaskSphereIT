import React, { useEffect, useMemo, useState } from "react";
import { Users, ChevronRight, ChevronLeft, FileText } from "lucide-react";

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

/* ---------------------- SMALL HELPERS ---------------------- */
const cardBase =
  "bg-white border border-neutral-200 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.08)] overflow-hidden hover:translate-y-[-2px] transition-transform";
const maroon = "#6A0F14";

const emptyProgress = { todo: 0, inprogress: 0, review: 0, done: 0, missed: 0 };

/** Builds stroke segments for an SVG donut */
function useDonutSegments(progress) {
  return useMemo(() => {
    const parts = [
      { key: "todo", label: "To Do", color: "#F5B700" },
      { key: "inprogress", label: "In Progress", color: "#63A46C" },
      { key: "review", label: "To Review", color: "#7C5CC4" },
      { key: "done", label: "Completed", color: maroon },
      { key: "missed", label: "Missed", color: "#D11A2A" },
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

    const completion =
      (progress.done || 0) / total > 0
        ? Math.round(((progress.done || 0) / total) * 100)
        : 0;

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

/* ----------------------- UI SUBPARTS ----------------------- */
function TeamCard({ team, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${cardBase} w-64 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${maroon}]/60 hover:shadow-lg transition-shadow`}
      aria-label={`Open ${team.name} summary`}
    >
      <div className="p-4 pb-5">
        <div className="grid place-items-center mb-2">
          <Users className="w-10 h-10" />
        </div>
        <div className="text-center">
          {/* ONLY the team name */}
          <p className="font-medium text-neutral-800">{team.name || "—"}</p>
          {/* Title line (or "--") */}
          <p className="mt-1 text-[13px] text-neutral-600">
            <span className="font-semibold">Title:</span>{" "}
            {team.systemTitle || "--"}
          </p>
        </div>
      </div>
      <div className="h-5" style={{ backgroundColor: maroon }} />
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
    <div className={`${cardBase}`}>
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
              </div>
            </foreignObject>
          </svg>

          <div className="grid gap-2 text-sm">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
                <span className="text-neutral-700">{s.label}</span>
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
    <div className={`${cardBase}`}>
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

function TasksTable({ tasks, loading }) {
  return (
    <div className={`${cardBase}`}>
      <div className="p-5">
        <p className="text-sm font-semibold mb-3">Team Tasks</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pr-3 w-16">NO</th>
                <th className="py-2 pr-3">Task</th>
                <th className="py-2 pr-3">Subtask</th>
                <th className="py-2 pr-3">Elements</th>
                <th className="py-2 pr-3">Due Date</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Revisions NO</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-neutral-200">
                  <td className="py-6 pr-3 text-neutral-500" colSpan={8}>
                    Loading tasks…
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr className="border-t border-neutral-200">
                  <td className="py-6 pr-3 text-neutral-500" colSpan={8}>
                    No tasks yet.
                  </td>
                </tr>
              ) : (
                tasks.map((t, i) => (
                  <tr key={`${t._id || t.no}-${i}`} className="border-t border-neutral-200">
                    <td className="py-2 pr-3">{i + 1}.</td>
                    <td className="py-2 pr-3">{t.task}</td>
                    <td className="py-2 pr-3">{t.subtask}</td>
                    <td className="py-2 pr-3">{t.elements}</td>
                    <td className="py-2 pr-3">{t.dueDate}</td>
                    <td className="py-2 pr-3">{t.time}</td>
                    <td className="py-2 pr-3">{t.revisions}</td>
                    <td className="py-2 pr-3">
                      <button className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-100">
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
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]); // [{id, name, systemTitle, members, progress}]
  const [selected, setSelected] = useState(null);

  // new: tasks for the selected team
  const [tasksLoading, setTasksLoading] = useState(false);
  const [teamTasks, setTeamTasks] = useState([]);

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

  /* ---------- NEW: fetch team tasks when a team is opened ---------- */
  // --- replace the whole useEffect that loads tasks with this one ---
useEffect(() => {
  if (!selected) return;
  const team = teams.find((t) => t.id === selected);
  if (!team) return;

  let alive = true;

  const isTs = (v) => v && typeof v === "object" && typeof v.toDate === "function";
  const fmtDate = (v) => {
    try {
      const d = isTs(v) ? v.toDate() : new Date(v);
      return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return "—"; }
  };
  const fmtTime = (v) => {
    try {
      if (!v) return "—";
      if (typeof v === "string") return v;
      const d = isTs(v) ? v.toDate() : new Date(v);
      return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch { return "—"; }
  };

  const normalize = (d, col) => ({
    _id: d.id || d.uid,
    task: d.task || (col === "oralDefenseTasks" ? "Oral Defense" : "Final Defense"),
    subtask: d.subtask || d.subTask || d.phase || "—",
    elements: d.elements || d.element || d.type || "—", // your doc shows `type: "Discussion & Review"`
    dueDate: fmtDate(d.dueDate || d.due || d.date),
    time: fmtTime(d.dueTime || d.time),
    revisions: d.revision || d.revisions || d.revisionCount || "—",
  });

  const fetchCol = async (colName) => {
    const out = [];
    // by team.id (correct path for your schema)
    try {
      const s1 = await getDocs(query(collection(db, colName), where("team.id", "==", team.id)));
      s1.forEach((snap) => {
        const d = { id: snap.id, ...snap.data() };
        if ((d.taskManager || "") === "Adviser") out.push(normalize(d, colName));
      });
    } catch (e) { console.warn(`Query by team.id failed for ${colName}:`, e); }

    // fallback by team.name
    try {
      const s2 = await getDocs(query(collection(db, colName), where("team.name", "==", team.name)));
      s2.forEach((snap) => {
        const d = { id: snap.id, ...snap.data() };
        if ((d.taskManager || "") === "Adviser") {
          if (!out.some((x) => x._id === snap.id)) out.push(normalize(d, colName));
        }
      });
    } catch (e) { console.warn(`Query by team.name failed for ${colName}:`, e); }

    return out;
  };

  (async () => {
    setTasksLoading(true);
    try {
      const oral = await fetchCol("oralDefenseTasks");
      const fin  = await fetchCol("finalDefenseTasks");
      if (alive) setTeamTasks([...oral, ...fin]);
    } catch (e) {
      console.error("Failed loading team tasks:", e);
      if (alive) setTeamTasks([]);
    } finally {
      if (alive) setTasksLoading(false);
    }
  })();

  return () => { alive = false; };
}, [selected, teams]);


  if (selected) {
    const team = teams.find((t) => t.id === selected);

    return (
      <div className="space-y-5">
        {/* Breadcrumb + title (use team name) */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4" />
          <span className="font-medium">Teams Summary</span>
          <ChevronRight className="w-4 h-4 text-neutral-500" />
          <span className="font-semibold">{team?.name || "—"}</span>
        </div>
        <div className="h-[2px] w-full" style={{ backgroundColor: maroon }} />

        {/* team name + system title line */}
        <div className="text-sm">
          <span className="font-semibold">Team:</span> {team?.name || "—"}{" "}
          <span className="mx-3 text-neutral-300">|</span>
          <span className="font-semibold">System Title:</span>{" "}
          {team?.systemTitle || "--"}
        </div>

        {/* Back */}
        <button
          onClick={() => setSelected(null)}
          className="cursor-pointer inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
          type="button"
        >
          <ChevronLeft className="w-4 h-4 " />
          Back to Teams
        </button>

        {/* Top row: members + donut */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MembersTable members={team?.members || []} />
          <Donut progress={team?.progress || emptyProgress} />
        </div>

        {/* Tasks (from oralDefenseTasks + finalDefenseTasks, taskManager=Adviser) */}
        <TasksTable tasks={teamTasks} loading={tasksLoading} />
      </div>
    );
  }

  // CARD GRID VIEW
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Teams Summary</h2>
      </div>
      <div className="h-[2px] w-full" style={{ backgroundColor: maroon }} />

      {loading ? (
        <div className="text-sm text-neutral-500 px-1 py-6">Loading teams…</div>
      ) : teams.length === 0 ? (
        <div className="text-sm text-neutral-500 px-1 py-6">
          No teams under your advisory.
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
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
