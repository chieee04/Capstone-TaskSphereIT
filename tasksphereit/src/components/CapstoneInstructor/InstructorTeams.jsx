// src/components/CapstoneInstructor/InstructorTeams.jsx
import React, { useEffect, useState } from "react";
import {
  Users,
  ChevronRight,
  PlusCircle,
  MoreVertical,
  X,
  CirclePlus,
  Edit3,
  Trash2,
  Users2,
} from "lucide-react";
import TeamIcon from "../../assets/imgs/InstructorTeamIcon.png";
import AdviserIcon from "../../assets/imgs/InstructoIconAdviser.png";
 
import { useInstructorTeams } from "./InstructorFunctions/InstructorTeamsFunction";
import Select from "react-select";
import Swal from "sweetalert2";
 
const MAROON = "#6A0F14";
 
const InstructorTeams = () => {
  const [view, setView] = useState("teams"); // "teams" | "advisers"
  const [openCreate, setOpenCreate] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
 
  // Edit dialog state
  const [etTeam, setEtTeam] = useState(null);
  const [etManagerId, setEtManagerId] = useState("");
  const [etTeamName, setEtTeamName] = useState("");
  const [etMemberPick, setEtMemberPick] = useState("");
  const [etMemberIds, setEtMemberIds] = useState([]);
 
  const idOf = (u) => u?.uid || u?.id;
  const [activeMenu, setActiveMenu] = useState(null);
  const [dropUp, setDropUp] = useState(false);
 
  const [transferUser, setTransferUser] = useState(null);
  const [transferFromTeam, setTransferFromTeam] = useState(null);
  const [transferToTeamId, setTransferToTeamId] = useState("");
 
  // State for transferring team to another adviser
  const [transferTeam, setTransferTeam] = useState(null);
  const [transferToAdviserId, setTransferToAdviserId] = useState("");
 
  const {
    allUsers,
    members,
    advisers,
    teams,
    availableManagers,
    availableMembers,
    teamSystemTitles, // Added this
 
    // create team
    ctManagerId,
    setCtManagerId,
    ctTeamName,
    setCtTeamName,
    ctMemberPick,
    setCtMemberPick,
    ctMemberIds,
    addMember,
    removeMember,
    saveCreateTeam,
 
    // assign adviser
    asTeamId,
    setAsTeamId,
    asAdviserUid,
    setAsAdviserUid,
    saveAssign,
 
    // misc
    menuOpenId,
    setMenuOpenId,
    dissolveTeam,
    editTeam,
    transferTeamMember,
  } = useInstructorTeams();
 
  const uniqByUid = (arr) => {
    const m = new Map();
    for (const u of arr || []) {
      const k = u?.uid || u?.id;
      if (!k) continue;
      if (!m.has(k)) m.set(k, u);
    }
    return Array.from(m.values());
  };
 
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenCreate(false);
        setOpenAssign(false);
        setMenuOpenId(null);
        setEtTeam(null);
        setTransferTeam(null);
      }
    };
    if (openCreate || openAssign || menuOpenId || etTeam || transferTeam)
      window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCreate, openAssign, menuOpenId, etTeam, setMenuOpenId, transferTeam]);
 
  // TeamCard with system title display
  const TeamCard = ({ team, systemTitle, showTransferOption = false, currentAdviser = null }) => {
    const hasEtAl = team.name && team.name.includes("Et Al");
    const teamTitle = systemTitle || "No title set";
 
    return (
      <div className="relative w-[160px] h-[220px]">
        {/* Main Card Button */}
        <button
          type="button"
          onClick={() => {
            setEtTeam(team);
            setEtManagerId(team.manager?.uid || "");
            setEtTeamName(team.name || "");
            setEtMemberIds(team.memberUids || []);
            setEtMemberPick("");
            setMenuOpenId(null);
          }}
          className="cursor-pointer w-full h-full rounded-2xl bg-white border-2 border-gray-200 shadow-lg text-neutral-800 overflow-hidden"
        >
          {/* Bottom accent - only show for teams with "Et Al" in name */}
          {hasEtAl && (
            <div 
              className="absolute bottom-0 left-0 right-0 h-5 rounded-b-2xl"
              style={{ background: MAROON }}
            />
          )}
 
          {/* Central content area */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center px-4 pt-2 ${hasEtAl ? 'pb-9' : 'pb-5'}`}>
            {/* Team icon - smaller size and NO animation */}
            <div>
              <img src={TeamIcon} alt="" className="w-14 h-14 mb-3 object-contain" />
            </div>
 
            {/* Team name text - smaller font size */}
            <span className="text-[15px] font-bold text-center leading-tight text-black">
              {team.name || "—"}
            </span>
 
            {/* System title - smaller font size, limited to 2 lines */}
            <span className="text-[11px] text-neutral-600 text-center mt-1.5 leading-tight min-h-[2.5rem] flex items-center justify-center" style={{ 
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {teamTitle}
            </span>
          </div>
        </button>
 
        {/* Original Kebab Menu Button - positioned inside the main button */}
        <button
          className="absolute top-2 right-2 p-1 hover:bg-neutral-100 z-30"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation(); // prevent triggering card click
            setMenuOpenId(menuOpenId === team.id ? null : team.id);
          }}
        >
          <MoreVertical className="w-4 h-4 text-neutral-500" />
        </button>
 
        {/* Dropdown Menu */}
        {menuOpenId === team.id && (
          <div
            className="absolute right-2 top-9 z-40 w-40 rounded-lg border border-neutral-200 bg-white shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Transfer Team option - only show when in adviser view */}
            {showTransferOption && (
              <button
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpenId(null);
                  setTransferTeam({
                    teamId: team.id,
                    teamName: team.name,
                    currentAdviserId: currentAdviser?.uid || currentAdviser?.id
                  });
                }}
              >
                <Users2 className="w-4 h-4" /> Transfer Team
              </button>
            )}
 
            <button
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpenId(null);
 
                const result = await Swal.fire({
                  title: `Dissolve Team?`,
                  html: `Dissolve team <b>"${team.name}"</b>?`,
                  icon: "warning",
                  showCancelButton: true,
                  confirmButtonColor: MAROON,
                  cancelButtonColor: "#9ca3af",
                  confirmButtonText: "Yes, dissolve",
                  cancelButtonText: "Cancel",
                });
 
                if (!result.isConfirmed) return;
 
                await dissolveTeam(team.id);
 
                Swal.fire({
                  icon: "success",
                  title: "Team Dissolved",
                  text: `Team "${team.name}" has been dissolved successfully.`,
                  timer: 2000,
                  showConfirmButton: false,
                });
              }}
            >
              <Trash2 className="w-4 h-4" /> Dissolve
            </button>
          </div>
        )}
      </div>
    );
  };
 
  const AdviserCard = ({ name, uid }) => {
    const [showAdviserModal, setShowAdviserModal] = useState(false);
    const [modalMenuOpenId, setModalMenuOpenId] = useState(null);
 
    // Filter teams for this adviser
    const adviserTeams = teams.filter(
      (team) => team.adviser && team.adviser.uid === uid
    );
 
    const handleCardClick = () => {
      setShowAdviserModal(true);
    };
 
    // Extract just the last name for display
    const displayName = name.split(",")[0];
 
    // TeamCard for use inside the adviser modal (with separate menu state)
    const ModalTeamCard = ({ team, showTransferOption = false, currentAdviser = null }) => {
      const hasEtAl = team.name && team.name.includes("Et Al");
      const teamTitle = teamSystemTitles[team.id] || "No title set";
 
      return (
        <div className="relative w-[160px] h-[220px]">
          {/* Main Card Button */}
          <button
            type="button"
            onClick={() => {
              setEtTeam(team);
              setEtManagerId(team.manager?.uid || "");
              setEtTeamName(team.name || "");
              setEtMemberIds(team.memberUids || []);
              setEtMemberPick("");
              setModalMenuOpenId(null);
            }}
            className="cursor-pointer w-full h-full rounded-2xl bg-white border-2 border-gray-200 shadow-lg text-neutral-800 overflow-hidden"
          >
            {/* Bottom accent - only show for teams with "Et Al" in name */}
            {hasEtAl && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-5 rounded-b-2xl"
                style={{ background: MAROON }}
              />
            )}
 
            {/* Central content area */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center px-4 pt-2 ${hasEtAl ? 'pb-9' : 'pb-5'}`}>
              {/* Team icon - smaller size and NO animation */}
              <div>
                <img src={TeamIcon} alt="" className="w-14 h-14 mb-3 object-contain" />
              </div>
 
              {/* Team name text - smaller font size */}
              <span className="text-[15px] font-bold text-center leading-tight text-black">
                {team.name || "—"}
              </span>
 
              {/* System title - smaller font size, limited to 2 lines */}
              <span className="text-[11px] text-neutral-600 text-center mt-1.5 leading-tight min-h-[2.5rem] flex items-center justify-center" style={{ 
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {teamTitle}
              </span>
            </div>
          </button>
 
          {/* Original Kebab Menu Button - positioned inside the main button */}
          <button
            className="absolute top-2 right-2 p-1 hover:bg-neutral-100 z-30"
            aria-label="More actions"
            onClick={(e) => {
              e.stopPropagation(); // prevent triggering card click
              setModalMenuOpenId(modalMenuOpenId === team.id ? null : team.id);
            }}
          >
            <MoreVertical className="w-4 h-4 text-neutral-500" />
          </button>
 
          {/* Dropdown Menu */}
          {modalMenuOpenId === team.id && (
            <div
              className="absolute right-2 top-9 z-40 w-40 rounded-lg border border-neutral-200 bg-white shadow-lg py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Transfer Team option - only show when in adviser view */}
              {showTransferOption && (
                <button
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setModalMenuOpenId(null);
                    setTransferTeam({
                      teamId: team.id,
                      teamName: team.name,
                      currentAdviserId: currentAdviser?.uid || currentAdviser?.id
                    });
                  }}
                >
                  <Users2 className="w-4 h-4" /> Transfer Team
                </button>
              )}
 
              <button
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setModalMenuOpenId(null);
 
                  const result = await Swal.fire({
                    title: `Dissolve Team?`,
                    html: `Dissolve team <b>"${team.name}"</b>?`,
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonColor: MAROON,
                    cancelButtonColor: "#9ca3af",
                    confirmButtonText: "Yes, dissolve",
                    cancelButtonText: "Cancel",
                  });
 
                  if (!result.isConfirmed) return;
 
                  await dissolveTeam(team.id);
 
                  Swal.fire({
                    icon: "success",
                    title: "Team Dissolved",
                    text: `Team "${team.name}" has been dissolved successfully.`,
                    timer: 2000,
                    showConfirmButton: false,
                  });
                }}
              >
                <Trash2 className="w-4 h-4" /> Dissolve
              </button>
            </div>
          )}
        </div>
      );
    };
 
    return (
      <>
        {/* Tapable Card */}
        <button
          type="button"
          onClick={handleCardClick}
          className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg text-neutral-800 overflow-hidden"
        >
          {/* Left vertical shaded part - NO animation */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-3 rounded-l-2xl"
            style={{ 
              backgroundColor: MAROON
            }}
          />
 
          {/* Central content area */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-2 pb-5">
            {/* Adviser icon - smaller size and NO animation */}
            <div>
              <img src={AdviserIcon} alt="" className="w-14 h-14 mb-3 object-contain" />
            </div>
 
            {/* Adviser name text - smaller font size */}
            <span className="text-[15px] font-bold text-center leading-tight text-black">
              {displayName || "—"}
            </span>
 
            {/* Team count - smaller font size */}
            <span className="text-[11px] text-neutral-600 text-center mt-1.5">
              {adviserTeams.length} team{adviserTeams.length !== 1 ? "s" : ""}
            </span>
          </div>
        </button>
 
        {/* Adviser Modal */}
        {showAdviserModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowAdviserModal(false)}
          >
            <div
              className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">
                    Teams Under: <span style={{ color: MAROON }}>{name}</span>
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    {adviserTeams.length} team
                    {adviserTeams.length !== 1 ? "s" : ""} assigned
                  </p>
                </div>
                <button
                  onClick={() => setShowAdviserModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full flex-shrink-0 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>
 
              {/* Content - List View */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  {adviserTeams.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500 border-2 border-dashed border-neutral-200 rounded-lg">
                      <div className="text-lg font-medium mb-2">
                        No teams assigned
                      </div>
                      <div className="text-sm">
                        This adviser doesn't have any teams assigned yet.
                      </div>
                      <div className="text-xs text-neutral-400 mt-4">
                        Adviser UID: {uid}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-6">
                      {adviserTeams.map((team) => (
                        <ModalTeamCard 
                          key={team.id} 
                          team={team} 
                          systemTitle={teamSystemTitles[team.id]}
                          showTransferOption={true}
                          currentAdviser={{ name, uid }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };
 
  const handleTransferMember = async () => {
    if (!transferUser || !transferFromTeam || !transferToTeamId) return;
 
    try {
      const success = await transferTeamMember(
        transferUser,
        transferFromTeam,
        transferToTeamId
      );
 
      if (success) {
        setTransferUser(null);
        setTransferFromTeam(null);
        setTransferToTeamId("");
 
        // Refresh the current team data in the edit dialog
        if (etTeam && etTeam.id === transferFromTeam) {
          setEtMemberIds((prev) => prev.filter((id) => id !== transferUser));
        }
 
        console.log("Member transferred successfully!");
      }
    } catch (error) {
      console.error("Failed to transfer member:", error);
      alert("Failed to transfer member. Please try again.");
    }
  };
 
  // Handle transferring team to another adviser
  const handleTransferTeam = async () => {
    if (!transferTeam || !transferToAdviserId) return;
 
    const result = await Swal.fire({
      title: `Transfer Team?`,
      html: `Transfer team <b>"${transferTeam.teamName}"</b> to selected adviser?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: MAROON,
      cancelButtonColor: "#9ca3af",
      confirmButtonText: "Yes, transfer",
      cancelButtonText: "Cancel",
    });
 
    if (!result.isConfirmed) return;
 
    // Note: You'll need to implement transferTeamAdviser function in your hook
    // const success = await transferTeamAdviser(transferTeam.teamId, transferToAdviserId);
 
    // For now, let's just show a message that this needs to be implemented
    Swal.fire({
      icon: "warning",
      title: "Function Not Implemented",
      text: "The transferTeamAdviser function needs to be implemented in your hook.",
      timer: 2000,
      showConfirmButton: false,
    });
 
    // TODO: Uncomment this when transferTeamAdviser is implemented
    // if (success) {
    //   Swal.fire({
    //     icon: "success",
    //     title: "Team Transferred",
    //     text: `Team "${transferTeam.teamName}" has been transferred successfully.`,
    //     timer: 2000,
    //     showConfirmButton: false,
    //   });
 
    //   setTransferTeam(null);
    //   setTransferToAdviserId("");
    // }
  };
 
  // Pass systemTitle to each TeamCard
  const teamCards = teams.map((t) => (
    <TeamCard 
      key={t.id} 
      team={t} 
      systemTitle={teamSystemTitles[t.id]}
    />
  ));
 
  const adviserItems = advisers.map((a) => (
    <AdviserCard key={a.uid || a.id} name={a.fullName} uid={a.uid || a.id} />
  ));
 
  return (
    <div className="min-h-full flex flex-col">
      {/* ===== Header ===== */}
      <div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-5 h-5 text-neutral-800" />
          <h2 className="text-base font-semibold text-neutral-900">
            {view === "teams" ? "Teams" : "Advisers"}
          </h2>
        </div>
        <div className="mt-3 h-[2px] w-full" style={{ backgroundColor: MAROON }} />
      </div>
 
      {/* ===== Toggle + Actions ===== */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="cursor-pointer rounded-full border border-neutral-300 p-1 flex">
          <button
            onClick={() => setView("teams")}
            className={`px-3 py-1.5 text-sm rounded-full cursor-pointer  ${
              view === "teams"
                ? "text-white"
                : "text-neutral-800 hover:bg-neutral-100"
            }`}
            style={view === "teams" ? { backgroundColor: MAROON } : {}}
          >
            Teams
          </button>
          <button
            onClick={() => setView("advisers")}
            className={`px-3 py-1.5 text-sm rounded-full cursor-pointer  ${
              view === "advisers"
                ? "text-white"
                : "text-neutral-800 hover:bg-neutral-100"
            }`}
            style={view === "advisers" ? { backgroundColor: MAROON } : {}}
          >
            Adviser
          </button>
        </div>
 
        <button
          onClick={() => setOpenCreate(true)}
          className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm text-neutral-800 hover:bg-neutral-100"
        >
          <PlusCircle className="w-4 h-4" /> Create Team
        </button>
        <button
          onClick={() => setOpenAssign(true)}
          className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm text-neutral-800 hover:bg-neutral-100"
        >
          <PlusCircle className="w-4 h-4" /> Assign Adviser
        </button>
      </div>
 
      {/* Cards grid */}
      <div className="mt-6 flex flex-wrap gap-6">
        {view === "teams" ? teamCards : adviserItems}
      </div>
 
      {/* Create Team Dialog */}
      {openCreate && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenCreate(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 flex items-center justify-center min-h-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-neutral-200 shadow-2xl">
              <div className="px-5 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-900">
                    <PlusCircle className="w-5 h-5" style={{ color: MAROON }} />
                    <h3 className="text-base font-semibold">Create Team</h3>
                  </div>
                  <button
                    className="p-2 rounded-full hover:bg-neutral-100"
                    onClick={() => setOpenCreate(false)}
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-neutral-600" />
                  </button>
                </div>
                <div className="mt-3 h-[2px]" style={{ backgroundColor: MAROON }} />
              </div>
 
              <div className="px-5 py-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Project Manager
                    </label>
                    <Select
                      options={availableMembers.map((s) => ({
                        value: idOf(s),
                        label: s.fullName,
                      }))}
                      value={
                        availableMembers
                          .map((s) => ({ value: idOf(s), label: s.fullName }))
                          .find((option) => option.value === ctManagerId) ||
                        null
                      }
                      onChange={(selectedOption) => {
                        const id = selectedOption?.value || "";
                        setCtManagerId(id);
 
                        if (id) {
                          const selectedManager = availableMembers.find(
                            (s) => idOf(s) === id
                          );
                          if (selectedManager && selectedManager.lastName) {
                            setCtTeamName(`${selectedManager.lastName}, Et Al`);
                          } else if (
                            selectedManager &&
                            selectedManager.fullName
                          ) {
                            const names = selectedManager.fullName.split(" ");
                            const lastName = names[names.length - 1];
                            setCtTeamName(`${lastName}, Et Al`);
                          }
                        } else {
                          setCtTeamName("");
                        }
 
                        if (ctMemberIds.includes(id)) removeMember(id);
                      }}
                      placeholder="Select Project Manager"
                      isSearchable
                      isClearable
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderRadius: "0.5rem",
                          borderColor: "#d4d4d4",
                          fontSize: "0.875rem",
                          minHeight: "42px",
                          "&:hover": {
                            borderColor: "#d4d4d4",
                          },
                        }),
                        option: (base, state) => ({
                          ...base,
                          fontSize: "0.875rem",
                          backgroundColor: state.isFocused
                            ? "#f5f5f5"
                            : "white",
                          color: "#171717",
                        }),
                      }}
                    />
                  </div>
 
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">
                      Team Name
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30 bg-gray-100 cursor-not-allowed"
                      value={ctTeamName}
                      onChange={(e) => setCtTeamName(e.target.value)}
                      placeholder="e.g., Bernardo, Et Al"
                      readOnly
                    />
                  </div>
                </div>
 
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Add Member
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        options={availableMembers
                          .filter((s) => idOf(s) !== ctManagerId)
                          .filter((s) => !ctMemberIds.includes(idOf(s)))
                          .map((s) => ({
                            value: idOf(s),
                            label: s.fullName,
                          }))}
                        value={
                          availableMembers
                            .map((s) => ({ value: idOf(s), label: s.fullName }))
                            .find((option) => option.value === ctMemberPick) ||
                          null
                        }
                        onChange={(selectedOption) => {
                          if (selectedOption) {
                            setCtMemberPick(selectedOption.value);
                          } else {
                            setCtMemberPick("");
                          }
                        }}
                        placeholder="Select member to add"
                        isSearchable
                        isClearable
                        className="react-select-container"
                        classNamePrefix="react-select"
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: "0.5rem",
                            borderColor: "#d4d4d4",
                            fontSize: "0.875rem",
                            minHeight: "42px",
                            "&:hover": {
                              borderColor: "#d4d4d4",
                            },
                          }),
                          option: (base, state) => ({
                            ...base,
                            fontSize: "0.875rem",
                            backgroundColor: state.isFocused
                              ? "#f5f5f5"
                              : "white",
                            color: "#171717",
                          }),
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addMember}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 h-[42px]"
                      disabled={!ctMemberPick}
                    >
                      <CirclePlus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>
 
                <div>
                  <label className="block text-sm font-medium text-neutral-700">
                    Members List
                  </label>
                  <div className="mt-1 rounded-lg border border-neutral-200">
                    {ctMemberIds.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-500">
                        No members added.
                      </div>
                    ) : (
                      <ul className="divide-y divide-neutral-200">
                        {ctMemberIds.map((uid) => {
                          const u =
                            members.find((m) => (m.uid || m.id) === uid) ||
                            allUsers.find((m) => (m.uid || m.id) === uid) ||
                            null;
                          return (
                            <li
                              key={uid}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <span className="text-sm">
                                {u?.fullName || uid}
                              </span>
                              <button
                                onClick={() => removeMember(uid)}
                                className="p-1 rounded hover:bg-neutral-100"
                                aria-label={`Remove ${u?.fullName || ""}`}
                              >
                                <X className="w-4 h-4 text-neutral-500" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
 
              <div className="px-5 pb-5 flex justify-end gap-2">
                <button
                  onClick={async () => {
                    const ok = await saveCreateTeam();
                    if (ok) setOpenCreate(false);
                  }}
                  style={{ backgroundColor: MAROON }}
                  className="px-5 py-2 rounded-full text-white text-sm hover:bg-[#5c0d12]"
                  disabled={!ctManagerId}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {/* Assign Adviser Dialog */}
      {openAssign && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenAssign(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 flex items-center justify-center min-h-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-xl bg-white rounded-2xl border border-neutral-200 shadow-2xl">
              <div className="px-5 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-900">
                    <PlusCircle className="w-5 h-5" style={{ color: MAROON }} />
                    <h3 className="text-base font-semibold">Assign Adviser</h3>
                  </div>
                  <button
                    className="p-2 rounded-full hover:bg-neutral-100"
                    onClick={() => setOpenAssign(false)}
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-neutral-600" />
                  </button>
                </div>
                <div className="mt-3 h-[2px]" style={{ backgroundColor: MAROON }} />
              </div>
 
              <div className="px-5 py-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">
                      Team/s
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                      value={asTeamId}
                      onChange={(e) => setAsTeamId(e.target.value)}
                    >
                      <option value="">Select</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.adviser?.uid ? " (has adviser)" : ""}
                        </option>
                      ))}
                    </select>
                    {asTeamId &&
                      teams.find((t) => t.id === asTeamId)?.adviser?.uid && (
                        <p className="mt-1 text-xs text-red-600">
                          This team already has an adviser.
                        </p>
                      )}
                  </div>
 
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">
                      Adviser
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                      value={asAdviserUid}
                      onChange={(e) => setAsAdviserUid(e.target.value)}
                      disabled={
                        !!(
                          asTeamId &&
                          teams.find((t) => t.id === asTeamId)?.adviser?.uid
                        )
                      }
                    >
                      <option value="">Select</option>
                      {advisers.map((a) => (
                        <option key={a.uid || a.id} value={a.uid || a.id}>
                          {a.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
 
              <div className="px-5 pb-5 flex justify-end gap-2">
                <button
                  onClick={async () => {
                    const ok = await saveAssign();
                    if (ok) setOpenAssign(false);
                  }}
                  style={{ backgroundColor: MAROON }}
                  className="px-5 py-2 rounded-full text-white text-sm hover:bg-[#5c0d12]"
                  disabled={
                    !asTeamId ||
                    !asAdviserUid ||
                    !!(
                      asTeamId &&
                      teams.find((t) => t.id === asTeamId)?.adviser?.uid
                    )
                  }
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {/* Edit Team Dialog */}
      {etTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEtTeam(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-neutral-900 truncate">
                Edit Team: <span style={{ color: MAROON }}>{etTeamName}</span>
              </h2>
              <button
                onClick={() => setEtTeam(null)}
                className="p-2 hover:bg-neutral-100 rounded-full flex-shrink-0"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>
 
            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Members Title + Add Button */}
              <div className="px-4 sm:px-6 mt-4 sm:mt-6">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-48">
                      <Select
                        options={availableMembers.map((m) => ({
                          value: m.uid || m.id,
                          label: m.fullName,
                        }))}
                        value={
                          availableMembers
                            .map((m) => ({
                              value: m.uid || m.id,
                              label: m.fullName,
                            }))
                            .find((option) => option.value === etMemberPick) ||
                          null
                        }
                        onChange={(selectedOption) => {
                          if (selectedOption) {
                            setEtMemberPick(selectedOption.value);
                          } else {
                            setEtMemberPick("");
                          }
                        }}
                        placeholder="Add member..."
                        isSearchable
                        isClearable
                        className="react-select-container"
                        classNamePrefix="react-select"
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: "0.5rem",
                            borderColor: "#d4d4d4",
                            fontSize: "0.875rem",
                            minHeight: "40px",
                            "&:hover": {
                              borderColor: "#d4d4d4",
                            },
                          }),
                          option: (base, state) => ({
                            ...base,
                            fontSize: "0.875rem",
                            backgroundColor: state.isFocused
                              ? "#f5f5f5"
                              : "white",
                            color: "#171717",
                          }),
                        }}
                      />
                    </div>
 
                    <button
                      type="button"
                      onClick={() => {
                        if (!etMemberPick) return;
                        if (!etMemberIds.includes(etMemberPick)) {
                          setEtMemberIds((v) => [...v, etMemberPick]);
                        }
                        setEtMemberPick("");
                      }}
                      style={{ backgroundColor: MAROON }}
                      className="text-white px-4 py-2 rounded-md text-sm hover:bg-[#5c0d12] whitespace-nowrap"
                      disabled={!etMemberPick}
                    >
                      Add Member
                    </button>
                  </div>
                </div>
              </div>
 
              {/* Members Table */}
              <div className="px-4 sm:px-6 mt-3 pb-4">
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {etMemberIds.length === 0 && (
                    <div className="text-center py-4 text-neutral-500 border rounded-lg">
                      No members yet.
                    </div>
                  )}
 
                  {(etManagerId && !etMemberIds.includes(etManagerId)
                    ? [etManagerId, ...etMemberIds]
                    : etMemberIds
                  ).map((uid, index) => {
                    const u = allUsers.find((m) => (m.uid || m.id) === uid);
                    const isPM = uid === etManagerId;
 
                    return (
                      <div
                        key={uid}
                        className="border rounded-lg p-3 bg-white shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-neutral-100 text-neutral-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {u?.lastName}, {u?.firstName}
                            </span>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveMenu(activeMenu === uid ? null : uid)
                              }
                              className="p-1"
                            >
                              <MoreVertical className="w-4 h-4 text-neutral-600 hover:text-black cursor-pointer" />
                            </button>
 
                            {activeMenu === uid && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white border rounded-md shadow-lg text-left z-50">
                                <button
                                  className={`w-full text-left px-3 py-2 text-xs ${
                                    isPM
                                      ? "text-neutral-400 cursor-not-allowed opacity-50"
                                      : "hover:bg-neutral-100 cursor-pointer"
                                  }`}
                                  disabled={isPM}
                                  onClick={() => {
                                    if (isPM) return;
                                    setTransferUser(uid);
                                    setTransferFromTeam(etTeam.id);
                                    setActiveMenu(null);
                                  }}
                                >
                                  Transfer Member
                                </button>
 
                                <button
                                  disabled={isPM}
                                  className={`w-full text-left px-3 py-2 text-xs ${
                                    isPM
                                      ? "text-neutral-400 cursor-default"
                                      : "text-red-600 hover:bg-neutral-100"
                                  }`}
                                  onClick={() => {
                                    setEtMemberIds((prev) =>
                                      prev.filter((x) => x !== uid)
                                    );
                                    setActiveMenu(null);
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
 
                        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 mb-3">
                          <div>
                            <span className="font-medium">ID:</span>{" "}
                            {u?.idNumber}
                          </div>
                          <div>
                            <span className="font-medium">Middle:</span>{" "}
                            {u?.middleName || "-"}
                          </div>
                        </div>
                        <select
                          className="border rounded-md px-2 py-1 text-xs w-full"
                          value={
                            uid === etManagerId ? "Project Manager" : "Member"
                          }
                          onChange={(e) => {
                            const newRole = e.target.value;
 
                            if (newRole === "Project Manager") {
                              setEtMemberIds(prev => {
                                if (prev.includes(etManagerId)) return prev;
                                return [...prev, etManagerId];
                              });
 
                              setEtManagerId(uid);
 
                              const pmUser = allUsers.find(
                                (m) => (m.uid || m.id) === uid
                              );
                              if (pmUser) {
                                setEtTeamName(`${pmUser.lastName}, Et Al`);
                              }
                            } else {
                              if (uid === etManagerId) {
                                setEtMemberIds((prev) =>
                                  prev.includes(uid) ? prev : [...prev, uid]
                                );
 
                                setEtManagerId("");
                              }
                            }
                          }}
                        >
                          <option value="Member">Member</option>
                          <option value="Project Manager">
                            Project Manager
                          </option>
                        </select>
                      </div>
                    );
                  })}
                </div>
 
                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="text-left bg-neutral-50">
                      <tr className="border-b">
                        <th className="px-4 py-2 w-12">No</th>
                        <th className="px-4 py-2">ID No</th>
                        <th className="px-4 py-2">Last Name</th>
                        <th className="px-4 py-2">First Name</th>
                        <th className="px-4 py-2">Middle Name</th>
                        <th className="px-4 py-2">Role</th>
                        <th className="px-4 py-2 w-16 text-center">Action</th>
                      </tr>
                    </thead>
 
                    <tbody>
                      {etMemberIds.length === 0 && (
                        <tr>
                          <td
                            colSpan="7"
                            className="px-4 py-3 text-center text-neutral-500"
                          >
                            No members yet.
                          </td>
                        </tr>
                      )}
 
                      {(etManagerId && !etMemberIds.includes(etManagerId)
                        ? [etManagerId, ...etMemberIds]
                        : etMemberIds
                      ).map((uid, index) => {
                        const u = allUsers.find((m) => (m.uid || m.id) === uid);
                        const isPM = uid === etManagerId;
 
                        return (
                          <tr
                            key={uid}
                            className="border-b hover:bg-neutral-50"
                          >
                            <td className="px-4 py-3 text-center">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3">{u?.idNumber}</td>
                            <td className="px-4 py-3">{u?.lastName}</td>
                            <td className="px-4 py-3">{u?.firstName}</td>
                            <td className="px-4 py-3">{u?.middleName}</td>
 
                            <td className="px-4 py-2">
                              <select
                                className="border rounded-md px-2 py-1 text-xs w-full max-w-32"
                                value={isPM ? "Project Manager" : "Member"}
                                onChange={(e) => {
                                  const newRole = e.target.value;
 
                                  if (newRole === "Project Manager") {
                                    setEtMemberIds(prev => {
                                      if (prev.includes(etManagerId)) return prev;
                                      return [...prev, etManagerId];
                                    });
 
                                    setEtManagerId(uid);
 
                                    const pmUser = allUsers.find(
                                      (m) => (m.uid || m.id) === uid
                                    );
                                    if (pmUser) {
                                      setEtTeamName(
                                        `${pmUser.lastName}, Et Al`
                                      );
                                    }
                                  } else {
                                    if (isPM) {
                                      setEtMemberIds((prev) =>
                                        prev.includes(uid)
                                          ? prev
                                          : [...prev, uid]
                                      );
                                      setEtManagerId("");
                                    }
                                  }
                                }}
                              >
                                <option value="Member">Member</option>
                                <option value="Project Manager">
                                  Project Manager
                                </option>
                              </select>
                            </td>
 
                            <td className="px-4 py-2 text-center relative">
                              <button
                                onClick={() =>
                                  setActiveMenu(activeMenu === uid ? null : uid)
                                }
                                className="p-1 hover:bg-neutral-100"
                              >
                                <MoreVertical className="w-5 h-5 text-neutral-600 hover:text-black cursor-pointer" />
                              </button>
 
                              {activeMenu === uid && (
                                <div
                                  className={`absolute right-0 w-40 bg-white border rounded-md shadow-lg text-left z-50 ${
                                    index >= etMemberIds.length - 2
                                      ? "bottom-full mb-2"
                                      : "top-full mt-2"
                                  }`}
                                >
                                  <button
                                    className={`w-full text-left px-3 py-2 text-sm ${
                                      isPM
                                        ? "text-neutral-400 cursor-not-allowed opacity-50"
                                        : "hover:bg-neutral-100 cursor-pointer"
                                    }`}
                                    disabled={isPM}
                                    onClick={() => {
                                      if (isPM) return;
                                      setTransferUser(uid);
                                      setTransferFromTeam(etTeam.id);
                                      setActiveMenu(null);
                                    }}
                                  >
                                    Transfer Member
                                  </button>
 
                                  <button
                                    disabled={isPM}
                                    className={`w-full text-left px-3 py-2 text-sm ${
                                      isPM
                                        ? "text-neutral-400 cursor-default"
                                        : "text-red-600 hover:bg-neutral-100"
                                    }`}
                                    onClick={() => {
                                      setEtMemberIds((prev) =>
                                        prev.filter((x) => x !== uid)
                                      );
                                      setActiveMenu(null);
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
 
            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 flex justify-end gap-2 border-t bg-neutral-50">
              <button
                onClick={async () => {
                  const ok = await editTeam(etTeam.id, {
                    managerUid: etManagerId,
                    teamName: etTeamName,
                    memberUids: etMemberIds,
                  });
                  if (ok) setEtTeam(null);
                }}
                disabled={!String(etTeamName).trim() || !etManagerId}
                style={{ backgroundColor: MAROON }}
                className="text-white px-6 py-2 rounded-full text-sm hover:bg-[#5c0d12] disabled:bg-neutral-400 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Transfer Member Modal */}
      {transferUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setTransferUser(null);
            setTransferFromTeam(null);
            setTransferToTeamId("");
          }}
        >
          <div
            className="bg-white rounded-xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">
                  Transfer Member
                </h3>
                <button
                  className="p-2 rounded-full hover:bg-neutral-100"
                  onClick={() => {
                    setTransferUser(null);
                    setTransferFromTeam(null);
                    setTransferToTeamId("");
                  }}
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>
              <div className="mt-3 h-[2px]" style={{ backgroundColor: MAROON }} />
            </div>
 
            {/* Content */}
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select a new team
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={transferToTeamId}
                  onChange={(e) => setTransferToTeamId(e.target.value)}
                >
                  <option value="">Select team</option>
                  {teams
                    .filter((team) => team.id !== transferFromTeam)
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
 
            {/* Footer */}
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={handleTransferMember}
                disabled={!transferToTeamId}
                style={{ backgroundColor: MAROON }}
                className="px-5 py-2 rounded-full text-white text-sm hover:bg-[#5c0d12] disabled:bg-neutral-400 disabled:cursor-not-allowed"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Transfer Team Modal */}
      {transferTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setTransferTeam(null);
            setTransferToAdviserId("");
          }}
        >
          <div
            className="bg-white rounded-xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">
                  Transfer Team
                </h3>
                <button
                  className="p-2 rounded-full hover:bg-neutral-100"
                  onClick={() => {
                    setTransferTeam(null);
                    setTransferToAdviserId("");
                  }}
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>
              <div className="mt-3 h-[2px]" style={{ backgroundColor: MAROON }} />
            </div>
 
            {/* Content */}
            <div className="px-5 py-5 space-y-4">
              <div>
                <p className="text-sm text-neutral-600 mb-4">
                  Transfer team <strong>"{transferTeam.teamName}"</strong> to another adviser.
                </p>
 
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select New Adviser
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                  value={transferToAdviserId}
                  onChange={(e) => setTransferToAdviserId(e.target.value)}
                >
                  <option value="">Select adviser</option>
                  {advisers
                    .filter((adviser) => (adviser.uid || adviser.id) !== transferTeam.currentAdviserId)
                    .map((adviser) => (
                      <option key={adviser.uid || adviser.id} value={adviser.uid || adviser.id}>
                        {adviser.fullName}
                      </option>
                    ))}
                </select>
              </div>
            </div>
 
            {/* Footer */}
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={handleTransferTeam}
                disabled={!transferToAdviserId}
                style={{ backgroundColor: MAROON }}
                className="px-5 py-2 rounded-full text-white text-sm hover:bg-[#5c0d12] disabled:bg-neutral-400 disabled:cursor-not-allowed"
              >
                Transfer Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorTeams;