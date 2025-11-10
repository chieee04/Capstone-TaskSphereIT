// src/components/CapstoneMember/MemberTasksRecord.jsx
import React, { useMemo, useState } from "react";
import { ClipboardList, CalendarRange } from "lucide-react";

// ===== Member record pages =====
import MTitleDefenseRecord from "./tasksrecords/TitleDefense.jsx";
import MOralDefenseRecord from "./tasksrecords/OralDefense.jsx";
import MFinalDefenseRecord from "./tasksrecords/FinalDefense.jsx";
import MFinalRedefenseRecord from "./tasksrecords/FinalRedefense.jsx";

const MAROON = "#6A0F14";

/* --------------------------- Card configuration --------------------------- */
const CARDS = [
  { key: "title",     label: "Title Defense",    icon: CalendarRange },
  { key: "oral",      label: "Oral Defense",     icon: CalendarRange },
  { key: "final",     label: "Final Defense",    icon: CalendarRange },
  { key: "redefense", label: "Final Re-Defense", icon: CalendarRange },
];

/* --------------------------- Local view renderer -------------------------- */
const VIEW_COMPONENT = {
  title: MTitleDefenseRecord,
  oral: MOralDefenseRecord,
  final: MFinalDefenseRecord,
  redefense: MFinalRedefenseRecord,
};

function TaskCard({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer relative w-[210px] h-[160px] rounded-2xl bg-white border border-neutral-200 shadow transition
                 hover:shadow-md active:scale-[0.99] text-neutral-800"
    >
      {/* left rail */}
      <div
        className="absolute left-0 top-0 h-full w-10 rounded-l-2xl"
        style={{ background: MAROON }}
      />
      {/* bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-6 rounded-b-2xl"
        style={{ background: MAROON }}
      />
      {/* content */}
      <div className="absolute inset-0 pl-12 pr-4 pt-6 grid place-items-start">
        <div className="flex flex-col items-start gap-4">
          <Icon className="w-14 h-14 text-neutral-800" />
          <span className="text-sm font-semibold leading-tight">{label}</span>
        </div>
      </div>
    </button>
  );
}

function MemberTasksRecord() {
  const [view, setView] = useState(null); // null = cards grid

  const ActiveView = useMemo(
    () => (view ? VIEW_COMPONENT[view] : null),
    [view]
  );

  return (
    <div className="space-y-4">
      {/* ===== Title + underline (matches PM Tasks design) ===== */}
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 text-[18px] font-semibold"
          style={{ color: MAROON }}
        >
          <ClipboardList className="w-5 h-5" />
          <span>Tasks Record</span>
        </div>
        <div className="h-[3px] w-full" style={{ backgroundColor: MAROON }} />
      </div>

      {/* If a view is selected, render it; else show the cards */}
      {ActiveView ? (
        <div className="space-y-3">
          <div className="mt-2">
            <ActiveView onBack={() => setView(null)} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-6">
          {CARDS.map(({ key, label, icon }) => (
            <TaskCard
              key={key}
              label={label}
              icon={icon}
              onClick={() => setView(key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MemberTasksRecord
