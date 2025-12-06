// src/components/CapstoneInstructor/InstructorSchedule.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  FileText,
  Presentation,
  GraduationCap,
} from "lucide-react";

const MAROON = "#3B0304";

const Card = ({ title, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg text-neutral-800 overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl"
  >
    {/* Bottom accent with hover animation */}
    <div 
      className="absolute bottom-0 left-0 right-0 h-5 rounded-b-2xl transition-all duration-300 hover:h-7"
      style={{ background: MAROON }}
    />
    
    {/* Central content area */}
    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-2 pb-9">
      {/* Icon with hover animation */}
      <div className="grid place-items-center h-14 w-14 mb-3 transition-transform duration-300 hover:scale-110">
        {icon}
      </div>
      
      {/* Title text with hover animation */}
      <span className="text-[15px] font-bold text-center leading-tight text-black transition-colors duration-300 hover:text-[#3B0304]">
        {title || "—"}
      </span>
    </div>
  </button>
);

export default function InstructorSchedule() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Title Defense",
      icon: <CalendarDays size={32} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/title-defense"),
    },
    {
      title: "Manuscript Submission",
      icon: <FileText size={32} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/manuscript"),
    },
    {
      title: "Oral Defense",
      icon: <Presentation size={32} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/oral-defense"),
    },
    {
      title: "Final Defense",
      icon: <GraduationCap size={32} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/final-defense"),
    },
  ];

  return (
    <div className="min-h-full flex flex-col">
      {/* header to match Enroll (icon + title + thin maroon rule) */}
      <div>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-neutral-800" />
          <h2 className="text-base font-semibold text-neutral-900">Schedule</h2>
        </div>
        <div className="mt-3 h-[2px] w-full bg-[#3B0304]" />
      </div>

      {/* cards - updated to match Teams grid style */}
      <div className="mt-6 flex flex-wrap gap-6">
        {cards.map((c) => (
          <Card key={c.title} title={c.title} icon={c.icon} onClick={c.onClick} />
        ))}
      </div>
    </div>
  );
}