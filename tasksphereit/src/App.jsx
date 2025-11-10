import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TermsofService from "./components/TermsofService.jsx";

// Auth
import LoginPage from "./components/auth/LoginPage.jsx";
import ForgotPassword from "./components/auth/ForgotPassword.jsx";
import ResetPassword from "./components/auth/resetPassword.jsx";


// Instructor
import InstructorLayout from "./components/CapstoneInstructor/InsturctorLayout.jsx";
import InstructorDashboard from "./components/CapstoneInstructor/InstructorDashboard.jsx";
import InstructorEnroll from "./components/CapstoneInstructor/InstructorEnroll.jsx";
import InstructorTeams from "./components/CapstoneInstructor/InstructorTeams.jsx";
import InstructorSchedule from "./components/CapstoneInstructor/InstructorSchedule/InstructorSchedule.jsx";
import TitleDefense from "./components/CapstoneInstructor/InstructorSchedule/TitleDefense.jsx";
import ManuscriptSubmission from "./components/CapstoneInstructor/InstructorSchedule/ManuscriptSubmission.jsx";
import OralDefense from "./components/CapstoneInstructor/InstructorSchedule/OralDefense.jsx";
import FinalDefense from "./components/CapstoneInstructor/InstructorSchedule/FinalDefense.jsx";
import FinalRedefense from "./components/CapstoneInstructor/InstructorSchedule/FinalRedefense.jsx";

// Adviser
import AdviserLayout from "./components/CapstoneAdviser/AdviserLayout.jsx";
import AdviserDashboard from "./components/CapstoneAdviser/AdviserDashboard.jsx";
import Tasks from "./components/CapstoneAdviser/Tasks.jsx";
import TaskRecord from "./components/CapstoneAdviser/TaskRecord.jsx";
import TeamsBoard from "./components/CapstoneAdviser/TeamsBoard.jsx";
import TeamsSummary from "./components/CapstoneAdviser/TeamsSummary.jsx";
import Events from "./components/CapstoneAdviser/Events.jsx";
import Notes from "./components/Notes.jsx";
import Notifications from "./components/CapstoneAdviser/Notifications.jsx";
import ProjectManagerNotifications from "./components/ProjectManager/ProjectManagerNotifications.jsx";
import MemberNotifications from "./components/CapstoneMember/MemberNotifications.jsx";
import Profile from "./components/CapstoneAdviser/Profile.jsx";

// Member
import MemberLayout from "./components/CapstoneMember/MemberLayout.jsx";
import MemberDashboard from "./components/CapstoneMember/MemberDashboard.jsx";
import MemberTasks from "./components/CapstoneMember/MemberTasks.jsx";
import MemberAdviserTasks from "./components/CapstoneMember/MemberAdviserTasks.jsx";
import MemberTasksBoard from "./components/CapstoneMember/MemberTasksBoard.jsx";
import MemberTasksRecord from "./components/CapstoneMember/MemberTasksRecord.jsx";
import MemberEvents from "./components/CapstoneMember/MemberEvents.jsx";

// Project Manager
import ProjectManagerLayout from "./components/ProjectManager/ProjectManagerLayout.jsx";
import ProjectManagerDashboard from "./components/ProjectManager/ProjectManagerDashboard.jsx";
import ProjectManagerAdviserTaskRecord from "./components/ProjectManager/ProjectManagerAdviserTaskRecord.jsx";
import ProjectManagerTaskBoard from "./components/ProjectManager/ProjectManagerTaskBoard.jsx";
import ProjectManagerEvents from "./components/ProjectManager/ProjectManagerEvents.jsx";
import ProjectManagerTasks from "./components/ProjectManager/ProjectManagerTasks.jsx";

export default function App() {
  useEffect(() => {
    const href = window.location.href;
    const u = new URL(href);
    const mode = u.searchParams.get("mode");

    // If the email client dropped you on the wrong page,
    // shove any sign-in link to /verify-invite (keep the full query string)
    if (mode === "signIn" && !href.includes("/verify-invite")) {
      window.location.replace(`/verify-invite${u.search}`);
    }
  }, []);

  return (
    <div className="min-h-screen font-sans">
      {/* Mount globally so it can auto-pop after login and hide once accepted */}
      <TermsofService />

      <Routes>
        {/* Auth */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Direct route to open TOS explicitly if needed */}
        <Route path="/terms-of-service" element={<TermsofService />} />

        {/* Instructor section */}
        <Route path="/instructor" element={<InstructorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<InstructorDashboard />} />
          <Route path="enroll" element={<InstructorEnroll />} />
          <Route path="teams" element={<InstructorTeams />} />
          <Route path="schedule" element={<InstructorSchedule />} />
          <Route path="schedule/title-defense" element={<TitleDefense />} />
          <Route path="schedule/manuscript" element={<ManuscriptSubmission />} />
          <Route path="schedule/oral-defense" element={<OralDefense />} />
          <Route path="schedule/final-defense" element={<FinalDefense />} />
          <Route path="schedule/final-redefense" element={<FinalRedefense />} />
        </Route>

        {/* Adviser section */}
        <Route path="/adviser" element={<AdviserLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdviserDashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="task-record" element={<TaskRecord />} />
          <Route path="teams-board" element={<TeamsBoard />} />
          <Route path="teams-summary" element={<TeamsSummary />} />
          <Route path="events" element={<Events />} />
          <Route path="notes" element={<Notes />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Project Manager section */}
        <Route path="/projectmanager" element={<ProjectManagerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ProjectManagerDashboard />} />
          <Route path="tasks-board" element={<ProjectManagerTaskBoard />} />
          <Route path="tasks-record" element={<ProjectManagerAdviserTaskRecord />} />
          <Route path="events" element={<ProjectManagerEvents />} />
          <Route path="notifications" element={<ProjectManagerNotifications />} />
          <Route path="tasks" element={<ProjectManagerTasks />} />
          <Route path="notes" element={<Notes />} />
        </Route>

        {/* Member section */}
        <Route path="/member" element={<MemberLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MemberDashboard />} />
          <Route path="tasks" element={<MemberTasks />} />
          <Route path="adviser-tasks" element={<MemberAdviserTasks />} />
          <Route path="tasks-board" element={<MemberTasksBoard />} />
          <Route path="tasks-record" element={<MemberTasksRecord />} />
          <Route path="events" element={<MemberEvents />} />
          <Route path="notifications" element={<MemberNotifications />} />
          <Route path="notes" element={<Notes />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}
