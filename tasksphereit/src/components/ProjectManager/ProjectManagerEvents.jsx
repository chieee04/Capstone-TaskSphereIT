// src/components/ProjectManager/ProjectManagerEvents.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  BookOpenCheck,
  Presentation,
  GraduationCap,
  ExternalLink,
  Download,
  X,
} from "lucide-react";
import { getEventsForUser } from "../../services/events";

/* ===== Firestore (for view-only files modal) ===== */
import { db } from "../../config/firebase";
import { doc, getDoc } from "firebase/firestore";

const MAROON = "#3B0304";

const to12h = (t) => {
  if (!t) return "";
  const [H, M] = String(t).split(":").map(Number);
  const ampm = H >= 12 ? "PM" : "AM";
  const hh = ((H + 11) % 12) + 1;
  return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
};

const CardTable = ({ children }) => (
  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">{children}</table>
    </div>
  </div>
);

const Pill = ({ children }) => (
  <span className="px-3 py-1 rounded-full text-xs inline-flex border border-neutral-300 text-neutral-700">
    {children}
  </span>
);

/* ---------------- Files (view-only) Modal ---------------- */
function FilesModal({ open, row, onClose }) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!open || !row?.id) return;
      setLoading(true);
      try {
        // Read fresh from Firestore so we don't depend on the list response
        const snap = await getDoc(doc(db, "manuscriptSubmissions", row.id));
        const data = snap.exists() ? snap.data() : {};
        const list = Array.isArray(data.fileUrl) ? data.fileUrl : [];
        if (alive) setFiles(list);
      } catch (e) {
        console.error("[PM FilesModal] load failed:", e);
        if (alive) setFiles([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [open, row?.id]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 mx-auto mt-10 w-[880px] max-w-[95vw]">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Accent bar */}
          <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <span>●</span>
              <span>Uploaded Files — {row.teamName || row.team}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 px-5 pb-5 overflow-y-auto">
            <div className="rounded-xl border border-neutral-200">
              <div className="px-4 py-2 border-b border-neutral-200 text-sm font-semibold">
                Files
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-sm text-neutral-600">Loading…</div>
                ) : files.length === 0 ? (
                  <div className="text-sm text-neutral-600">
                    There's no uploaded file yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {files.map((f, i) => (
                      <li
                        key={f.fileName || `${f.url}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                      >
                        <div className="truncate">
                          <div className="text-sm font-medium truncate">
                            {f.name || "file"}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {f.fileName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Open"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </a>
                          <a
                            href={f.url}
                            download={f.name || "file"}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 pb-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ Updated Category Card ============================ */
function CategoryCard({ title, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg transition-all duration-300
                 hover:shadow-2xl hover:-translate-y-2 hover:border-gray-300 active:scale-[0.98] text-neutral-800 overflow-hidden group"
    >
      {/* Bottom accent only - removed left side accent */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-6 rounded-b-2xl transition-all duration-300 group-hover:h-8"
        style={{ background: MAROON }}
      />
      
      {/* Central content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-2 pb-10">
        {/* Task icon - centered in main white area with animation */}
        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="w-16 h-16 mb-4 text-black" />
        </div>
        
        {/* Title text - positioned below icon */}
        <span className="text-base font-bold text-center leading-tight text-black transition-all duration-300 group-hover:scale-105">
          {title}
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

/* ============================ Main ============================ */
export default function ProjectManagerEvents() {
  const [rows, setRows] = useState({
    titleDefense: [],
    manuscript: [],
    oralDefense: [],
    finalDefense: [],
    finalRedefense: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(
    (searchParams.get("view") || "menu").toLowerCase()
  );
  const [defTab, setDefTab] = useState(
    (searchParams.get("tab") || "title").toLowerCase()
  );

  // View-only files modal state
  const [filesRow, setFilesRow] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const uid = localStorage.getItem("uid");
        const res = await getEventsForUser(uid);
        if (alive) setRows(res);
      } catch (e) {
        console.error("Failed to load PM events:", e);
        if (alive)
          setRows({
            titleDefense: [],
            manuscript: [],
            oralDefense: [],
            finalDefense: [],
            finalRedefense: [],
          });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // sync URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (view === "menu") next.delete("view");
    else next.set("view", view);
    if (view === "defenses") next.set("tab", defTab);
    else next.delete("tab");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, defTab]);

  /* ===== Updated Header to match ProjectManagerTasks ===== */
  const Header = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
        <ClipboardList className="w-5 h-5" />
        <span>Events</span>
      </div>
      {/* Divider with rounded edges - matching ProjectManagerTasks */}
      <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
    </div>
  );

  if (view === "menu") {
    return (
      <div className="space-y-4">
        {Header}
        <div className="flex flex-wrap gap-6">
          <CategoryCard
            title="Manuscript Results"
            icon={BookOpenCheck}
            onClick={() => setView("manuscript")}
          />
          <CategoryCard
            title="Capstone Defenses"
            icon={Presentation}
            onClick={() => setView("defenses")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Header}

      {/* manuscript-only view */}
      {view === "manuscript" && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <BookOpenCheck className="w-5 h-5" color={MAROON} />
            <h2 className="text-[17px] font-semibold" style={{ color: MAROON }}>
              Manuscript Results
            </h2>
          </div>
          <CardTable>
            <thead>
              <tr className="bg-neutral-50/80 text-neutral-600">
                <th className="text-left py-2 pl-6 pr-3">NO</th>
                <th className="text-left py-2 pr-3">Team</th>
                <th className="text-left py-2 pr-3">Title</th>
                <th className="text-left py-2 pr-3">Due Date</th>
                <th className="text-left py-2 pr-3">Time</th>
                <th className="text-left py-2 pr-3">Plagiarism</th>
                <th className="text-left py-2 pr-3">AI</th>
                <th className="text-left py-2 pr-3">File Uploaded</th>
                <th className="text-left py-2 pr-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : rows.manuscript).map((r, idx) => (
                <tr key={`ms-${r.id}`} className="border-t border-neutral-200">
                  <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                  <td className="py-2 pr-3">{r.teamName}</td>
                  <td className="py-2 pr-3">{r.title}</td>
                  <td className="py-2 pr-3">{r.date}</td>
                  <td className="py-2 pr-3">{to12h(r.timeStart)}</td>
                  <td className="py-2 pr-3">{`${r.plag ?? 0}%`}</td>
                  <td className="py-2 pr-3">{`${r.ai ?? 0}%`}</td>

                  {/* View-only files button */}
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => setFilesRow(r)}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Files
                    </button>
                  </td>

                  <td className="py-2 pr-6">
                    <Pill>{r.verdict}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </CardTable>

          {/* View-only Files Modal */}
          <FilesModal
            open={!!filesRow}
            row={filesRow}
            onClose={() => setFilesRow(null)}
          />
        </section>
      )}

      {/* defenses view with tabs */}
      {view === "defenses" && (
        <>
          <div className="flex gap-2 mb-3">
            {[
              { key: "title", label: "Title Defense" },
              { key: "oral", label: "Oral Defense" },
              { key: "final", label: "Final Defense" },
              // Removed Final Re-Defense tab
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setDefTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  defTab === t.key ? "text-white" : "text-neutral-700"
                }`}
                style={defTab === t.key ? { backgroundColor: MAROON } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>

          {defTab === "title" && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-5 h-5" color={MAROON} />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: MAROON }}
                >
                  Title Defense
                </h2>
              </div>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? [] : rows.titleDefense).map((r, idx) => (
                    <tr
                      key={`td-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.date}</td>
                      <td className="py-2 pr-3">
                        {r.timeStart ? to12h(r.timeStart) : ""}
                      </td>
                      <td className="py-2 pr-3">
                        {Array.isArray(r.panelists)
                          ? r.panelists.join(", ")
                          : ""}
                      </td>
                      <td className="py-2 pr-6">
                        <Pill>{r.verdict}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CardTable>
            </section>
          )}

          {defTab === "oral" && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Presentation className="w-5 h-5" color={MAROON} />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: MAROON }}
                >
                  Oral Defense
                </h2>
              </div>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? [] : rows.oralDefense).map((r, idx) => (
                    <tr
                      key={`od-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.title}</td>
                      <td className="py-2 pr-3">{r.date}</td>
                      <td className="py-2 pr-3">
                        {r.timeStart ? to12h(r.timeStart) : ""}
                      </td>
                      <td className="py-2 pr-3">
                        {Array.isArray(r.panelists)
                          ? r.panelists.join(", ")
                          : ""}
                      </td>
                      <td className="py-2 pr-6">
                        <Pill>{r.verdict}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CardTable>
            </section>
          )}

          {defTab === "final" && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-5 h-5" color={MAROON} />
                <h2
                  className="text-[17px] font-semibold"
                  style={{ color: MAROON }}
                >
                  Final Defense
                </h2>
              </div>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.finalDefense || []).length ? (
                    rows.finalDefense.map((r, idx) => (
                      <tr
                        key={`fd-${r.id}`}
                        className="border-t border-neutral-200"
                      >
                        <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                        <td className="py-2 pr-3">{r.teamName}</td>
                        <td className="py-2 pr-3">{r.title}</td>
                        <td className="py-2 pr-3">{r.date}</td>
                        <td className="py-2 pr-3">
                          {r.timeStart ? to12h(r.timeStart) : ""}
                        </td>
                        <td className="py-2 pr-3">
                          {Array.isArray(r.panelists)
                            ? r.panelists.join(", ")
                            : ""}
                        </td>
                        <td className="py-2 pr-6">
                          <Pill>{r.verdict || "Pending"}</Pill>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-neutral-200">
                      <td
                        className="py-6 text-center text-neutral-500"
                        colSpan={7}
                      >
                        No final defense items yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </CardTable>
            </section>
          )}

          {/* Removed Final Re-Defense section */}
        </>
      )}
    </div>
  );
}