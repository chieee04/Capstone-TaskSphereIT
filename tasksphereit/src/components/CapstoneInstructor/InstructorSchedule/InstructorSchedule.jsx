// src/components/CapstoneInstructor/InstructorSchedule.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  FileText,
  Presentation,
  GraduationCap,
  RotateCcw, // Icon for Final Re-Defense
} from "lucide-react";

const MAROON = "#6A0F14";

const Card = ({ title, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="
      relative w-[240px] h-[300px] rounded-2xl bg-white
      border border-neutral-200
      shadow-[0_6px_18px_rgba(0,0,0,0.06)]
      hover:shadow-[0_10px_24px_rgba(0,0,0,0.10)]
      transition-shadow
      focus:outline-none focus:ring-2 focus:ring-[#6A0F14] focus:ring-offset-2 cursor-pointer
    "
  >
    <div className="grid place-items-center mt-16">
      <div className="grid place-items-center h-20 w-20 rounded-xl border border-neutral-300 bg-white">
        {icon}
      </div>
    </div>

    <div className="mt-8 px-4 text-center text-[18px] font-semibold" style={{ color: MAROON }}>
      {title}
    </div>

    <div className="absolute bottom-0 left-0 right-0 h-8 rounded-b-2xl" style={{ backgroundColor: "#4a0a0d" }} />
  </button>
);

export default function InstructorSchedule() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Title Defense",
      icon: <CalendarDays size={44} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/title-defense"),
    },
    {
      title: "Manuscript Submission",
      icon: <FileText size={44} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/manuscript"),
    },
    {
      title: "Oral Defense",
      icon: <Presentation size={44} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/oral-defense"),
    },
    {
      title: "Final Defense",
      icon: <GraduationCap size={44} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/final-defense"),
    },
    {
      title: "Final Re-Defense", // New card
      icon: <RotateCcw size={44} strokeWidth={2.2} />,
      onClick: () => navigate("/instructor/schedule/final-redefense"),
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
        <div className="mt-3 h-[2px] w-full bg-[#6A0F14]" />
      </div>

      {/* cards */}
      <div className="mt-8 flex flex-wrap gap-8">
        {cards.map((c) => (
          <Card key={c.title} title={c.title} icon={c.icon} onClick={c.onClick} />
        ))}
      </div>
    </div>
  );
}