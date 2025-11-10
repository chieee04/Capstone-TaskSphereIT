// src/components/CapstoneInstructor/InstructorDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Users } from "lucide-react";

/* ==== Firestore ==== */
import { db } from "../../config/firebase";
import { collection, getDocs } from "firebase/firestore";

const MAROON = "#6A0F14";

/* ----------------------------- UI Pieces (match sample) ----------------------------- */
const Card = ({ className = "", children }) => (
  <div
    className={
      "bg-white border border-neutral-200 rounded-xl shadow-sm " + className
    }
  >
    {children}
  </div>
);

function UpcomingCard({ item }) {
  return (
    <div className="w-[280px] bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="px-3 py-2 text-white text-sm font-semibold flex items-center gap-2"
        style={{ backgroundColor: item.color }}
      >
        <Users className="w-4 h-4" />
        {item.team || "—"}
      </div>
      <div className="p-3 text-sm">
        <div className="text-neutral-800">{item.task}</div>
        <div className="mt-2 text-neutral-600">{item.date}</div>
        <div className="text-neutral-600">{item.time}</div>
      </div>
    </div>
  );
}

function Donut({ percent }) {
  const size = 120;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * c;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#EEE"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={MAROON}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-neutral-800"
        style={{ fontSize: 20, fontWeight: 700 }}
      >
        {Math.round(Math.max(0, Math.min(100, percent)))}%
      </text>
    </svg>
  );
}

function ProgressCard({ team, percent }) {
  return (
    <div className="w-[260px] bg-white border border-neutral-200 rounded-xl shadow-sm">
      <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2">
        <Users className="w-4 h-4" />
        {team}
      </div>
      <div className="grid place-items-center p-3">
        <Donut percent={percent} />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = React.useMemo(() => {
    switch ((status || "").toLowerCase()) {
      case "in progress":
        return "bg-[#7C9C3B] text-white";
      case "to review":
        return "bg-[#6FA8DC] text-white";
      case "to do":
      default:
        return "bg-[#D9A81E] text-white";
    }
  }, [status]);
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${styles}`}
    >
      {status || "Pending"}
    </span>
  );
}

/* ----------------------------- Helpers ----------------------------- */
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

function toDateObj(yyyy_mm_dd, hhmm = "00:00") {
  if (!yyyy_mm_dd) return null;
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const [H, M] = (hhmm || "00:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, (m || 1) - 1, d || 1, H || 0, M || 0, 0);
}
function fmtDate(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${Number(d)}, ${y}`;
}
function to12h(t) {
  if (!t) return "";
  const [H, M] = t.split(":").map(Number);
  const ampm = H >= 12 ? "PM" : "AM";
  const hh = ((H + 11) % 12) + 1;
  return `${hh}:${String(M).padStart(2, "0")} ${ampm}`;
}
function fmtTimeRange(start, end) {
  const a = to12h(start);
  const b = to12h(end);
  return b ? `${a} - ${b}` : a;
}
function fmtDateTimeHuman(d) {
  if (!d) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ----------------------------- Calendar ----------------------------- */
function getMonthMatrix(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const first = new Date(y, m, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* ----------------------------- Page ----------------------------- */
export default function InstructorDashboard() {
  const today = new Date();
  const monthWeeks = useMemo(() => getMonthMatrix(today), [today]);
  const monthName = today.toLocaleString("default", { month: "long" });

  // UPCOMING (nearest per team)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingPerTeam, setUpcomingPerTeam] = useState([]);

  // RECENT activity created
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentCreated, setRecentCreated] = useState([]);

  // Teams’ progress
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [teamsProgress, setTeamsProgress] = useState([]); // [{team, percent}]

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingUpcoming(true);
      setLoadingRecent(true);
      setLoadingProgress(true);
      try {
        const [titleSnap, oralSnap, finalSnap, manusSnap, teamsSnap] =
          await Promise.all([
            getDocs(collection(db, "titleDefenseSchedules")),
            getDocs(collection(db, "oralDefenseSchedules")),
            getDocs(collection(db, "finalDefenseSchedules")),
            getDocs(collection(db, "manuscriptSubmissions")),
            getDocs(collection(db, "teams")),
          ]);

        const normalizeSched = (snap, tagLabel, opts = {}) => {
          const {
            useSingleTimeField = false,
            singleTimeFieldName = "time",
            statusField = "verdict",
          } = opts;

          const arr = [];
          snap.forEach((docX) => {
            const data = docX.data() || {};
            const teamName = (data.teamName || "").toString().trim();
            const teamId = (data.teamId || "").toString().trim() || null;
            const date = (data.date || "").toString().trim();

            let timeStart = (data.timeStart || "00:00").toString().trim();
            let timeEnd = (data.timeEnd || "").toString().trim();
            if (useSingleTimeField) {
              const t = (data[singleTimeFieldName] || "00:00")
                .toString()
                .trim();
              timeStart = t;
              timeEnd = "";
            }

            const when = toDateObj(date, timeStart);
            const createdAt = data.createdAt?.toDate
              ? data.createdAt.toDate()
              : null;
            const status = (data[statusField] || "Pending").toString();

            arr.push({
              id: docX.id,
              tag: tagLabel,
              team: teamName,
              teamKey: teamId || teamName,
              date,
              timeStart,
              timeEnd,
              when,
              createdAt,
              status,
            });
          });
          return arr;
        };

        const titleRows = normalizeSched(titleSnap, "Title Defense");
        const oralRows = normalizeSched(oralSnap, "Oral Defense");
        const finalRows = normalizeSched(finalSnap, "Final Defense");
        const manusRows = normalizeSched(manusSnap, "Manuscript Submission", {
          useSingleTimeField: true,
          singleTimeFieldName: "time",
        });

        // ---------- UPCOMING (nearest per team) ----------
        const now = new Date();
        const futureOnly = [
          ...titleRows,
          ...oralRows,
          ...finalRows,
          ...manusRows,
        ].filter((r) => r.when && r.when >= now);
        const byTeamUpcoming = new Map();
        for (const item of futureOnly) {
          const key = item.teamKey || item.team;
          const prev = byTeamUpcoming.get(key);
          if (!prev || item.when < prev.when) byTeamUpcoming.set(key, item);
        }
        const resultUpcoming = Array.from(byTeamUpcoming.values()).sort(
          (a, b) => a.when - b.when
        );
        if (alive) setUpcomingPerTeam(resultUpcoming);

        // ---------- RECENT (last 10) ----------
        const allRows = [...titleRows, ...oralRows, ...finalRows, ...manusRows];
        const recentList = allRows
          .map((r) => {
            const timeText = r.timeEnd
              ? fmtTimeRange(r.timeStart, r.timeEnd)
              : to12h(r.timeStart);
            const createdKey =
              r.createdAt?.getTime?.() || (r.when ? r.when.getTime() : 0);
            return { ...r, timeText, _createdKey: createdKey };
          })
          .filter((r) => r._createdKey > 0)
          .sort((a, b) => b._createdKey - a._createdKey)
          .slice(0, 10);
        if (alive) setRecentCreated(recentList);

        // ---------- TEAMS’ PROGRESS (0–100%) ----------
        // Progress rule: each passed type (Title / Manuscript / Oral / Final) = +25
        const hasPassed = (rows, teamKey) =>
          rows.some(
            (r) =>
              (r.teamKey || r.team) === teamKey &&
              typeof r.status === "string" &&
              r.status.toLowerCase() === "passed"
          );

        const progressList = [];
        teamsSnap.forEach((docX) => {
          const data = docX.data() || {};
          const teamName = (data.name || "").toString().trim();
          const teamKey = docX.id || teamName;

          const pts =
            (hasPassed(titleRows, teamKey) ? 1 : 0) +
            (hasPassed(manusRows, teamKey) ? 1 : 0) +
            (hasPassed(oralRows, teamKey) ? 1 : 0) +
            (hasPassed(finalRows, teamKey) ? 1 : 0);

          progressList.push({ team: teamName, percent: pts * 25 });
        });

        // Sort by team name for stable UI
        progressList.sort((a, b) => a.team.localeCompare(b.team));
        if (alive) setTeamsProgress(progressList);
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
        if (alive) {
          setUpcomingPerTeam([]);
          setRecentCreated([]);
          setTeamsProgress([]);
        }
      } finally {
        if (alive) {
          setLoadingUpcoming(false);
          setLoadingRecent(false);
          setLoadingProgress(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // map activity type -> header color (same idea as sample’s colored headers)
  const TAG_COLORS = {
    "Title Defense": "#D9A81E",
    "Manuscript Submission": "#6FA8DC",
    "Oral Defense": "#7C9C3B",
    "Final Defense": "#9E9E9E",
  };

  return (
    <div className="space-y-8">
      {/* UPCOMING TASKS (uniform header & card style) */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          UPCOMING TASKS
        </h3>

        {loadingUpcoming ? (
          <div className="text-sm text-neutral-500">
            Loading upcoming tasks…
          </div>
        ) : upcomingPerTeam.length === 0 ? (
          <div className="text-sm text-neutral-500">No upcoming tasks.</div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {upcomingPerTeam.map((u) => (
              <UpcomingCard
                key={`${u.tag}-${u.id}`}
                item={{
                  team: u.team,
                  task: u.tag,
                  date: fmtDate(u.date),
                  time: fmtTimeRange(u.timeStart, u.timeEnd),
                  color: TAG_COLORS[u.tag] || MAROON,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* TEAMS’ PROGRESS (uniform donut + card) */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          TEAMS’ PROGRESS
        </h3>

        {loadingProgress ? (
          <div className="text-sm text-neutral-500">Loading progress…</div>
        ) : teamsProgress.length === 0 ? (
          <div className="text-sm text-neutral-500">No teams found.</div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {teamsProgress.map((t) => (
              <ProgressCard key={t.team} team={t.team} percent={t.percent} />
            ))}
          </div>
        )}
      </section>

      {/* RECENT TASKS CREATED (uniform table look) */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          RECENT TASKS CREATED
        </h3>

        <div className="bg-white border border-neutral-200 rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="py-3 pl-6 pr-3 w-16">No</th>
                  <th className="py-3 pr-3">Activity</th>
                  <th className="py-3 pr-3">Team</th>
                  <th className="py-3 pr-3">Date Created</th>
                  <th className="py-3 pr-3">Date</th>
                  <th className="py-3 pr-6">Time</th>
                  <th className="py-3 pr-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingRecent ? (
                  <tr>
                    <td className="py-3 pl-6 pr-3" colSpan={7}>
                      <span className="text-neutral-600">Loading…</span>
                    </td>
                  </tr>
                ) : recentCreated.length === 0 ? (
                  <tr>
                    <td className="py-3 pl-6 pr-3" colSpan={7}>
                      <span className="text-neutral-600">
                        No recent activity.
                      </span>
                    </td>
                  </tr>
                ) : (
                  recentCreated.map((r, idx) => (
                    <tr
                      key={`${r.tag}-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-3 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-3 pr-3">{r.tag}</td>
                      <td className="py-3 pr-3">{r.team || "—"}</td>
                      <td className="py-3 pr-3">
                        {r.createdAt ? fmtDateTimeHuman(r.createdAt) : "—"}
                      </td>
                      <td className="py-3 pr-3">{fmtDate(r.date)}</td>
                      <td className="py-3 pr-6">{r.timeText}</td>
                      <td className="py-3 pr-6">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CALENDAR (kept, but header style unified) */}
      <section className="space-y-3">
        <h3
          className="text-xl font-extrabold tracking-wide"
          style={{ color: MAROON }}
        >
          CALENDAR
        </h3>
        <Card className="p-4">
          <div className="w-full text-center">
            <span
              className="inline-block rounded-md px-3 py-[2px] text-xs font-medium text-white"
              style={{ backgroundColor: MAROON }}
            >
              {monthName}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-[40px_repeat(7,1fr)] gap-y-2 text-sm">
            <div />
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <div key={d} className="text-center text-neutral-600">
                {d}
              </div>
            ))}

            {monthWeeks.map((week, wi) => (
              <React.Fragment key={wi}>
                <div className="grid place-items-center">
                  <span
                    className="rounded-md px-2 py-[2px] text-xs font-medium text-white"
                    style={{ backgroundColor: "#4a0a0d" }}
                  >
                    {String(wi + 40)}
                  </span>
                </div>
                {week.map((d, di) => {
                  const isToday =
                    d &&
                    d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();
                  return (
                    <div key={di} className="h-10 grid place-items-center">
                      {d ? (
                        <span
                          className={
                            "inline-flex items-center justify-center h-7 w-7 rounded-md " +
                            (isToday ? "text-white" : "text-neutral-700")
                          }
                          style={isToday ? { backgroundColor: MAROON } : {}}
                        >
                          {d.getDate()}
                        </span>
                      ) : (
                        <span className="h-7 w-7" />
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
