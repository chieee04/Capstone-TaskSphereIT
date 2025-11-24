// src/components/CapstoneInstructor/ProjectManagerFooter.jsx
import React from "react";

const ProjectManagerFooter = () => {
  return (
    <footer className="w-full">
      {/* thin maroon accent strip */}
      <div className="h-[3px] bg-[#3B0304]" />
      {/* base footer with soft shadow and border */}
      <div className="bg-white border-t border-neutral-100 shadow-[0_-4px_8px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-xs text-neutral-600 py-4">
            ©2025 TaskSphere IT — All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ProjectManagerFooter;