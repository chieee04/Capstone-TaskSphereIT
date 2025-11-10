import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ClipboardList,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Search,
  Trash2,
  Filter,
  FileText,
  MoreVertical,
} from "lucide-react";

/* ===== Firebase ===== */
import { auth, db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const MAROON = "#6A0F14";

/* --------------------------- Categories --------------------------- */
const CATEGORIES = [
  { id: "title", title: "Title Defense", coll: "titleDefenseTasks" },
  { id: "oral", title: "Oral Defense", coll: "oralDefenseTasks" },
  { id: "final", title: "Final Defense", coll: "finalDefenseTasks" },
  {
    id: "finalRedefense",
    title: "Final Re-defense",
    coll: "finalRedefenseTasks",
  },
];

/* --------------------------- UI helpers -------------------------- */
const Card = ({ title, onClick }) => (
  <button
    onClick={onClick}
    className="cursor-pointer relative w-56 h-44 text-left bg-white border border-neutral-200 rounded-2xl shadow-[0_6px_12px_rgba(0,0,0,0.12)] overflow-hidden hover:translate-y-[-2px] transition-transform"
  >
    <div
      className="absolute left-0 top-0 h-full w-8"
      style={{ backgroundColor: MAROON }}
    />
    <div
      className="absolute bottom-0 left-0 right-0 h-5"
      style={{ backgroundColor: MAROON }}
    />
    <div className="pl-12 pr-4 pt-6">
      <CalendarDays className="w-12 h-12 text-neutral-900" />
      <p className="mt-3 font-medium">{title}</p>
    </div>
  </button>
);

const Toolbar = ({ onBack, onCreate, onPage, page, onSearch }) => (
  <div className="flex items-center gap-3 flex-wrap">
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
    >
      <ChevronLeft className="w-4 h-4" />
      Back to Records
    </button>

    <div className="relative ml-2">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
      <input
        placeholder="Search"
        onChange={(e) => onSearch(e.target.value)}
        className="w-64 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
      />
    </div>

    <div className="ml-auto flex items-center gap-2">
      <button className="cursor-pointer inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100">
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
      <button className="cursor-pointer inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100">
        <Filter className="w-4 h-4" />
        Filter
      </button>
    </div>

    <div className="w-full md:w-auto md:ml-2">
      <div className="inline-flex rounded-lg border border-neutral-300 overflow-hidden">
        <button
          onClick={() => onPage(1)}
          className={`cursor-pointer px-3 py-1.5 text-sm ${
            page === 1 ? "bg-neutral-100 font-semibold" : ""
          }`}
        >
          Page 1
        </button>
        <button
          onClick={() => onPage(2)}
          className={`cursor-pointer px-3 py-1.5 text-sm border-l border-neutral-300 ${
            page === 2 ? "bg-neutral-100 font-semibold" : ""
          }`}
        >
          Page 2
        </button>
      </div>
    </div>
  </div>
);

const TableShell = ({ children }) => (
  <div className="bg-white border border-neutral-200 rounded-2xl shadow-[0_6px_12px_rgba(0,0,0,0.08)] overflow-hidden">
    <div className="overflow-x-auto">{children}</div>
  </div>
);

/* --------------------------- Tables --------------------------- */
const Page1Table = ({ rows, loading }) => (
  <TableShell>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-neutral-500">
          <th className="py-3 pl-6 pr-3 w-16">NO</th>
          <th className="py-3 pr-3">Assigned</th>
          <th className="py-3 pr-3">Tasks</th>
          <th className="py-3 pr-3">SubTasks</th>
          <th className="py-3 pr-3">Elements</th>
          <th className="py-3 pr-3">Date Created</th>
          <th className="py-3 pr-6">Due&nbsp;&nbsp;Date</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={7} className="py-8 text-center text-neutral-500">
              Loading…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-8 text-center text-neutral-500">
              No completed tasks.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r._key} className="border-t border-neutral-200">
              <td className="py-3 pl-6 pr-3">{r.no}.</td>
              <td className="py-3 pr-3">{r.assigned}</td>
              <td className="py-3 pr-3">{r.task}</td>
              <td className="py-3 pr-3">{r.subtask}</td>
              <td className="py-3 pr-3">{r.elements}</td>
              <td className="py-3 pr-3">{r.created}</td>
              <td className="py-3 pr-6">{r.due}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </TableShell>
);

const StatusBadge = ({ status }) => (
  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-[#9B59B6] text-white">
    {status}
  </span>
);

const Page2Table = ({ rows, loading }) => (
  <TableShell>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-neutral-500">
          <th className="py-3 pl-6 pr-3 w-16">NO</th>
          <th className="py-3 pr-3">Time</th>
          <th className="py-3 pr-3">Date Completed</th>
          <th className="py-3 pr-3">Revision No.</th>
          <th className="py-3 pr-3">Status</th>
          <th className="py-3 pr-3">Methodology</th>
          <th className="py-3 pr-3">Project Phase</th>
          <th className="py-3 pr-6">Action</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={8} className="py-8 text-center text-neutral-500">
              Loading…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="py-8 text-center text-neutral-500">
              No completed tasks.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r._key} className="border-t border-neutral-200">
              <td className="py-3 pl-6 pr-3">{r.no}.</td>
              <td className="py-3 pr-3">{r.time}</td>
              <td className="py-3 pr-3">{r.completed}</td>
              <td className="py-3 pr-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-neutral-300">
                  {r.revision}
                  <ChevronRight className="w-4 h-4 text-neutral-500" />
                </div>
              </td>
              <td className="py-3 pr-3">
                <StatusBadge status="Completed" />
              </td>
              <td className="py-3 pr-3">{r.methodology}</td>
              <td className="py-3 pr-3">{r.phase}</td>
              <td className="py-3 pr-6">
                <button className="p-1 rounded hover:bg-neutral-100">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </TableShell>
);

/* ------------------------------ MAIN ------------------------------ */
const TaskRecord = () => {
  const [view, setView] = useState("grid"); // 'grid' | 'detail'
  const [category, setCategory] = useState(null); // 'title' | 'oral' | 'final' | 'finalRedefense'
  const [page, setPage] = useState(1); // 1 | 2
  const [search, setSearch] = useState("");

  const [meUid, setMeUid] = useState("");
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [loadingTasks, setLoadingTasks] = useState(false);
  const [records, setRecords] = useState([]); // normalized completed tasks for current category

  const teamUnsubsRef = useRef([]);

  /* -------- identify current user -------- */
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid || localStorage.getItem("uid") || "";
      setMeUid(uid);
    });
    return () => stop();
  }, []);

  /* -------- fetch teams of this Project Manager (merge both shapes) -------- */
  useEffect(() => {
    teamUnsubsRef.current.forEach((u) => typeof u === "function" && u());
    teamUnsubsRef.current = [];

    if (!meUid) return;
    setLoadingTeams(true);

    const merged = new Map();
    const apply = (snap) => {
      snap.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      setTeams(Array.from(merged.values()));
      setLoadingTeams(false);
    };

    const stopA = onSnapshot(
      query(collection(db, "teams"), where("projectManager.uid", "==", meUid)),
      apply,
      () => setLoadingTeams(false)
    );
    const stopB = onSnapshot(
      query(collection(db, "teams"), where("manager.uid", "==", meUid)),
      apply,
      () => setLoadingTeams(false)
    );

    teamUnsubsRef.current.push(stopA, stopB);
    return () => {
      teamUnsubsRef.current.forEach((u) => typeof u === "function" && u());
      teamUnsubsRef.current = [];
    };
  }, [meUid]);

  /* -------- fetch completed tasks for the selected category (ALL tasks, no taskManager filter) -------- */
  useEffect(() => {
    if (view !== "detail" || !category) return;
    if (loadingTeams) return;

    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat) return;

    const teamIds = teams.map((t) => t.id);
    if (teamIds.length === 0) {
      setRecords([]);
      return;
    }

    const chunk = (arr, n = 10) =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
        arr.slice(i * n, i * n + n)
      );

    setLoadingTasks(true);
    const buffer = new Map(); // `${id}` -> normalized task
    const unsubs = [];

    const normalize = (d) => {
      const x = d.data();
      const t = x.team || {};
      const teamId = t.id || x.teamId || "no-team";
      const teamName =
        t.name || teams.find((tt) => tt.id === teamId)?.name || "No Team";

      const created =
        typeof x.createdAt?.toDate === "function" ? x.createdAt.toDate() : null;
      const createdDisplay = created ? created.toLocaleDateString() : "—";

      const dueDate = x.dueDate || null;
      const dueTime = x.dueTime || null;
      const dueDisplay = dueDate || "—";

      const completed =
        typeof x.completedAt?.toDate === "function"
          ? x.completedAt.toDate()
          : null;
      const completedDisplay = completed ? completed.toLocaleDateString() : "—";

      return {
        _key: `${d.id}`,
        teamName,
        task: x.task || x.chapter || "Task",
        subtask: x.subtask || "—",
        elements: x.elements || "—",
        created: createdDisplay,
        due: dueDisplay,
        time: dueTime || "—",
        completed: completedDisplay,
        revision: x.revision || "No Revision",
        methodology: x.methodology || "—",
        phase: x.phase || "—",
      };
    };

    const publish = () => {
      const rows = Array.from(buffer.values())
        .sort((a, b) => (a.completed > b.completed ? -1 : 1))
        .map((r, i) => ({ ...r, no: i + 1, assigned: r.teamName }));
      setRecords(rows);
      setLoadingTasks(false);
    };

    const attach = (fieldName) => {
      chunk(teamIds).forEach((ids) => {
        const qy = query(
          collection(db, cat.coll),
          where("status", "==", "Completed"),
          where(fieldName, "in", ids),
          orderBy("updatedAt", "desc") // optional when present
        );
        const stop = onSnapshot(
          qy,
          (snap) => {
            snap.docs.forEach((d) => buffer.set(d.id, normalize(d)));
            publish();
          },
          () => setLoadingTasks(false)
        );
        unsubs.push(stop);
      });
    };

    attach("team.id");
    attach("teamId");

    return () => unsubs.forEach((u) => typeof u === "function" && u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, category, teams, loadingTeams]);

  /* -------- search + page derivations -------- */
  const [searchText, setSearchText] = useState("");
  useEffect(() => setSearchText(search), [search]);

  const filtered = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    if (!s) return records;
    return records.filter((r) =>
      [
        r.teamName,
        r.task,
        r.subtask,
        r.elements,
        r.methodology,
        r.phase,
        r.completed,
        r.due,
        r.created,
      ]
        .join(" • ")
        .toLowerCase()
        .includes(s)
    );
  }, [records, searchText]);

  const page1Rows = useMemo(() => filtered, [filtered]);
  const page2Rows = useMemo(
    () => filtered.map((r) => ({ ...r, status: "Completed" })),
    [filtered]
  );

  /* -------- render -------- */
  if (view === "detail" && category) {
    const current = CATEGORIES.find((c) => c.id === category);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Tasks Record</h2>
          <ChevronRight className="w-4 h-4 text-neutral-500" />
          <span className="font-semibold">{current?.title}</span>
        </div>
        <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />

        <Toolbar
          onBack={() => {
            setView("grid");
            setPage(1);
            setRecords([]);
            setSearch("");
          }}
          onCreate={() => {}}
          onPage={(p) => setPage(p)}
          page={page}
          onSearch={setSearch}
        />

        <div className="mt-3">
          {page === 1 ? (
            <Page1Table
              rows={page1Rows}
              loading={loadingTasks || loadingTeams}
            />
          ) : (
            <Page2Table
              rows={page2Rows}
              loading={loadingTasks || loadingTeams}
            />
          )}
        </div>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Tasks Record</h2>
      </div>
      <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />

      <div className="flex flex-wrap gap-4">
        {CATEGORIES.map((c) => (
          <Card
            key={c.id}
            title={c.title}
            onClick={() => {
              setCategory(c.id);
              setView("detail");
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskRecord;
