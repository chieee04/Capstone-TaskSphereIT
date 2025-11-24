// src/components/ProjectManager/ProjectManagerTasks.jsx
import React, { useMemo, useState } from "react";
import {
  ClipboardList,
  CalendarRange,
  Users as UsersIcon,
  ChevronLeft,
} from "lucide-react";

// Import the task pages you want to show
import PMTitleDefense from "./tasks/TitleDefense.jsx";
import PMOralDefense from "./tasks/OralDefense.jsx";
import PMFinalDefense from "./tasks/FinalDefense.jsx";
import PMFinalRedefense from "./tasks/FinalRedefense.jsx";

const MAROON = "#3B0304";

/* --------------------------- Card configuration --------------------------- */
const CARDS = [
  { key: "title",      label: "Title Defense",     icon: ClipboardList },
  { key: "oral",       label: "Oral Defense",      icon: ClipboardList },
  { key: "final",      label: "Final Defense",     icon: ClipboardList },
  { key: "redefense",  label: "Final Re-Defense",  icon: ClipboardList },
];

/* --------------------------- Local view renderer -------------------------- */
const VIEW_COMPONENT = {
  title: PMTitleDefense,
  oral: PMOralDefense,
  final: PMFinalDefense,
  redefense: PMFinalRedefense,
};

function TaskCard({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg transition-all duration-300
                 hover:shadow-2xl hover:-translate-y-2 hover:border-gray-300 active:scale-[0.98] text-neutral-800 overflow-hidden group"
    >
      {/* Left side accent - reduced width */}
      <div 
        className="absolute left-0 top-0 w-6 h-full rounded-l-2xl transition-all duration-300 group-hover:w-8"
        style={{ background: MAROON }}
      />
      
      {/* Bottom accent - reduced height */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-6 rounded-b-2xl transition-all duration-300 group-hover:h-8"
        style={{ background: MAROON }}
      />
      
      {/* Central content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pl-6 pr-4 pt-2 pb-10">
        {/* Task icon - centered in main white area with animation */}
        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="w-16 h-16 mb-4 text-black" />
        </div>
        
        {/* Title text - positioned below icon */}
        <span className="text-base font-bold text-center leading-tight text-black transition-all duration-300 group-hover:scale-105">
          {label}
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

const ProjectManagerTasks = () => {
  const [view, setView] = useState(null); // null = cards grid; otherwise one of the CARDS keys

  const ActiveView = useMemo(
    () => (view ? VIEW_COMPONENT[view] : null),
    [view]
  );

  // Header title when inside a specific view
  const currentLabel = useMemo(
    () => (view ? CARDS.find((c) => c.key === view)?.label : "Tasks"),
    [view]
  );

  return (
    <div className="space-y-4">
      {/* ===== Title + underline ===== */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
          <ClipboardList className="w-5 h-5" />
          <span>Tasks</span>
        </div>
        {/* Divider with rounded edges */}
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
      </div>

      {/* If a view is selected, render it; else show the cards */}
      {ActiveView ? (
        <div className="space-y-3">
          <div className="mt-2">
            {/* pass onBack to clear the local view */}
            <ActiveView onBack={() => setView(null)} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-6">
          {CARDS.map(({ key, label, icon }) => (
            <TaskCard key={key} label={label} icon={icon} onClick={() => setView(key)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectManagerTasks;