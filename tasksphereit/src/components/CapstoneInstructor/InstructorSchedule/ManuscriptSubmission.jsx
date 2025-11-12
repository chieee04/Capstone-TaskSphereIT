// src/components/CapstoneInstructor/ManuscriptSubmission.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Download,
  MoreVertical,
  Calendar as CalIcon,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  Trash2,
  X,
  Filter,
  ExternalLink,
  User2,
  Check,
  RotateCcw,
} from "lucide-react";
import Swal from "sweetalert2";
 
/* ===== Firestore ===== */
import { db } from "../../../config/firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { notifyTeamSchedule } from "../../../services/notifications";
 
/* ===== PDF ===== */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
 
/* ---- logos for PDF (DCT left, CCS right, TaskSphere footer-left) ---- */
import DCTLOGO from "../../../assets/imgs/pdf imgs/DCTLOGO.png";
import CCSLOGO from "../../../assets/imgs/pdf imgs/CCSLOGO.png";
import TASKSPHERELOGO from "../../../assets/imgs/pdf imgs/TASKSPHERELOGO.png";
 
const MAROON = "#6A0F14";
const COLLECTION = "manuscriptSubmissions";
 
/* ---------- small helpers ---------- */
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
const fmtDateHuman = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${Number(d || 1)}, ${y}`;
};
const to12h = (t) => {
  if (!t) return "";
  const [H, M] = t.split(":").map(Number);
  const ampm = H >= 12 ? "PM" : "AM";
  const hh = ((H + 11) % 12) + 1;
  return `${hh}:${String(M).padStart(2, "0")} ${ampm}`;
};
 
// Extract last name from full name
const getLastName = (fullName) => {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1] || "";
};
 
// Generate time options with 30-minute intervals
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      times.push(timeString);
    }
  }
  return times;
};
 
const TIME_OPTIONS = generateTimeOptions();
 
// Check if date has passed (including time) - for verdict editing
const isDatePassed = (dateStr, timeStr) => {
  if (!dateStr) return false;
 
  const now = new Date();
  const scheduleDateTime = new Date(dateStr);
 
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    scheduleDateTime.setHours(hours, minutes, 0, 0);
  } else {
    scheduleDateTime.setHours(23, 59, 59, 999); // End of day if no time
  }
 
  return scheduleDateTime < now;
};
 
// Get current date in YYYY-MM-DD format for min date
const getCurrentDate = () => {
  return new Date().toISOString().split("T")[0];
};
 
// Show SweetAlert for various messages
const showAlert = (title, text, icon = "info") => {
  Swal.fire({
    title,
    text,
    icon,
    confirmButtonColor: MAROON,
  });
};
 
const Breadcrumbs = () => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 text-neutral-700">
      <button
        onClick={() => navigate("/instructor/schedule")}
        className="text-[15px] font-medium text-neutral-600 hover:underline"
      >
        Schedule
      </button>
      <ChevronRight size={16} className="text-neutral-400" />
      <span className="text-[15px] font-semibold">Manuscript Submission</span>
      <ChevronRight size={16} className="text-neutral-400" />
      <span className="text-[15px]">Scheduled Teams</span>
    </div>
  );
};
 
/* ---------- your button (unchanged style) ---------- */
const Btn = ({
  children,
  variant = "solid",
  icon: Icon,
  className = "",
  ...props
}) => {
  const base =
    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium cursor-pointer " +
    "focus:outline-none focus:ring-2 focus:ring-neutral-200 " +
    className;
  const cls =
    variant === "solid"
      ? base + " text-white"
      : base +
        " border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50";
  const style = variant === "solid" ? { backgroundColor: MAROON } : undefined;
  return (
    <button {...props} className={cls} style={style}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
};
 
export default function ManuscriptSubmission() {
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState("");
  const [filterVerdict, setFilterVerdict] = useState("all");
 
  const [editingId, setEditingId] = useState(null);
  const [viewSchedule, setViewSchedule] = useState(null);
 
  /* ===== Firestore-backed options ===== */
  const [teamOptions, setTeamOptions] = useState([]); // [{id, name, managerLastName}]
  const [loadingTeams, setLoadingTeams] = useState(true);
 
  /* ===== Submissions list ===== */
  const [submissions, setSubmissions] = useState([]); // [{id, ...}]
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
 
  // Row menu
  const [menuOpenId, setMenuOpenId] = useState(null);
 
  // Filter dropdown state
  const [filterOpen, setFilterOpen] = useState(false);
 
  // Tooltip state for verdict
  const [showVerdictTooltip, setShowVerdictTooltip] = useState(null);
 
  /* ===== Files viewer modal ===== */
  const [filesRow, setFilesRow] = useState(null);
 
  /* ===== Bulk delete state ===== */
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
 
  const exitBulk = () => {
    setBulkMode(false);
    setSelected(new Set());
  };
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
 
  // Show tooltip for 5 seconds
  const showTooltipFor5Sec = (scheduleId) => {
    setShowVerdictTooltip(scheduleId);
    setTimeout(() => {
      setShowVerdictTooltip(null);
    }, 5000);
  };
 
  // Load Teams that passed title defense with "Approved" verdict and get project manager info
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Load title defense schedules first to get approved teams
        const titleDefenseSnap = await getDocs(
          collection(db, "titleDefenseSchedules")
        );
        const eligibleTeamIds = new Set();
 
        titleDefenseSnap.forEach((docX) => {
          const data = docX.data();
          const teamId = data?.teamId;
          const verdict = data?.verdict;
 
          // Only include teams with "Approved" verdict
          if (teamId && verdict === "Approved") {
            eligibleTeamIds.add(teamId);
          }
        });
 
        // Now load teams but only include eligible ones (approved teams) and get manager info
        const teamsSnap = await getDocs(collection(db, "teams"));
        const teams = [];
 
        for (const docX of teamsSnap.docs) {
          const data = docX.data();
          if (data?.name && eligibleTeamIds.has(docX.id)) {
            // Get project manager's last name
            let managerLastName = "etal";
            if (data.manager && data.manager.fullName) {
              const lastName = getLastName(data.manager.fullName);
              managerLastName = lastName || "etal";
            }
 
            teams.push({ 
              id: docX.id, 
              name: data.name,
              managerLastName: managerLastName + " etal",
              manager: data.manager // Store full manager object for real-time updates
            });
          }
        }
 
        teams.sort((a, b) => a.name.localeCompare(b.name));
        if (alive) setTeamOptions(teams);
      } catch (e) {
        console.error("Failed to load eligible teams:", e);
        showAlert("Error", "Failed to load teams. Please try again.", "error");
      } finally {
        if (alive) setLoadingTeams(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
 
  // Real-time listener for team updates (including manager changes)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "teams"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const updatedTeam = { id: change.doc.id, ...change.doc.data() };
 
          // Get updated manager's last name
          let updatedManagerLastName = "etal";
          if (updatedTeam.manager && updatedTeam.manager.fullName) {
            const lastName = getLastName(updatedTeam.manager.fullName);
            updatedManagerLastName = lastName || "etal";
          }
          const updatedTeamName = updatedManagerLastName + " etal";
 
          // Update teamOptions
          setTeamOptions(prev => 
            prev.map(team => 
              team.id === updatedTeam.id 
                ? { 
                    ...team, 
                    name: updatedTeam.name,
                    managerLastName: updatedTeamName,
                    manager: updatedTeam.manager
                  }
                : team
            )
          );
 
          // Update submissions with new team name (manager's last name + etal)
          setSubmissions(prev =>
            prev.map(submission =>
              submission.teamId === updatedTeam.id
                ? { ...submission, teamName: updatedTeamName }
                : submission
            )
          );
        }
      });
    });
 
    return () => unsubscribe();
  }, []);
 
  // Load Manuscript Submissions - Only for teams with "Approved" verdict in Title Defense
  const loadSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      // First, get all teams with "Approved" verdict from title defense
      const titleDefenseSnap = await getDocs(
        collection(db, "titleDefenseSchedules")
      );
      const approvedTeams = new Map();
 
      // Collect all teams that passed title defense (verdict = "Approved")
      titleDefenseSnap.forEach((docX) => {
        const data = docX.data();
        const teamId = data?.teamId;
        const verdict = data?.verdict;
 
        if (teamId && verdict === "Approved") {
          approvedTeams.set(teamId, true);
        }
      });
 
      // Get existing manuscript submissions
      const manuscriptSnap = await getDocs(collection(db, COLLECTION));
      const existingSubmissions = new Map();
 
      manuscriptSnap.forEach((docX) => {
        const d = docX.data();
        const teamId = d?.teamId;
        existingSubmissions.set(teamId, {
          id: docX.id,
          ...d,
        });
      });
 
      // Auto-create manuscript submissions for approved teams that don't have one
      const creationPromises = [];
      for (const [teamId] of approvedTeams) {
        if (!existingSubmissions.has(teamId)) {
          // Find team info to get manager's last name
          const teamInfo = teamOptions.find(t => t.id === teamId);
          const teamName = teamInfo ? teamInfo.managerLastName : "etal etal";
 
          const currentDate = new Date();
          const manuscriptData = {
            teamId: teamId,
            teamName: teamName,
            title: "", // Empty title to be filled later
            date: currentDate.toISOString().split("T")[0], // Current date as default
            duetime: currentDate.toTimeString().slice(0, 5),
            plag: 0,
            ai: 0,
            file: "—",
            verdict: "Pending",
            createdAt: serverTimestamp(),
            fileUrl: [],
          };
 
          creationPromises.push(
            addDoc(collection(db, COLLECTION), manuscriptData)
          );
        }
      }
 
      // Wait for all creations to complete
      if (creationPromises.length > 0) {
        await Promise.all(creationPromises);
      }
 
      // Reload all manuscript submissions after potential creations
      const updatedManuscriptSnap = await getDocs(collection(db, COLLECTION));
      const rows = [];
 
      updatedManuscriptSnap.forEach((docX) => {
        const d = docX.data();
        const teamId = d?.teamId;
 
        // Only include submissions for approved teams
        if (approvedTeams.has(teamId)) {
          // Get current team name based on latest manager info
          const teamInfo = teamOptions.find(t => t.id === teamId);
          const currentTeamName = teamInfo ? teamInfo.managerLastName : d?.teamName || "etal etal";
 
          rows.push({
            id: docX.id,
            teamId: teamId,
            teamName: currentTeamName,
            title: d?.title || "",
            date: d?.date || "",
            duetime: d?.duetime || "",
            plag: Number(d?.plag ?? 0),
            ai: Number(d?.ai ?? 0),
            file: d?.file || "—",
            verdict: d?.verdict || "Pending",
            createdAt: d?.createdAt,
            fileUrl: Array.isArray(d?.fileUrl) ? d.fileUrl : [],
            isReSubmission: d?.isReSubmission || false,
            originalSubmissionId: d?.originalSubmissionId || null,
          });
        }
      });
 
      // Sort by date, then by time (empty times first), then by creation date
      rows.sort((a, b) => {
        // First by date
        const ad = a.date || "",
          bd = b.date || "";
        if (ad < bd) return -1;
        if (ad > bd) return 1;
 
        // Then by time (empty times come first for re-submissions)
        const at = a.duetime || "",
          bt = b.duetime || "";
        if (!at && bt) return -1; // a has no time, b has time -> a comes first
        if (at && !bt) return 1; // a has time, b has no time -> b comes first
        if (at && bt) {
          // Both have times, sort by time
          if (at < bt) return -1;
          if (at > bt) return 1;
        }
 
        // Finally by creation date (newer first)
        const ac = a.createdAt?.toDate?.() || new Date(0);
        const bc = b.createdAt?.toDate?.() || new Date(0);
        return bc - ac; // Newer first
      });
 
      setSubmissions(rows);
    } catch (e) {
      console.error("Failed to load submissions:", e);
      showAlert(
        "Error",
        "Failed to load submissions. Please try again.",
        "error"
      );
    } finally {
      setLoadingSubmissions(false);
    }
  };
 
  useEffect(() => {
    loadSubmissions();
  }, [teamOptions]); // Reload when teamOptions change (manager updates)
 
  // verdict updater
  const handleChangeVerdict = async (submissionId, newVerdict) => {
    try {
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId ? { ...s, verdict: newVerdict } : s
        )
      );
      await updateDoc(doc(db, COLLECTION, submissionId), {
        verdict: newVerdict,
      });
      showAlert("Success", "Verdict updated successfully.", "success");
    } catch (e) {
      console.error("Failed to update verdict:", e);
      await loadSubmissions();
      showAlert(
        "Error",
        "Failed to update verdict. Please try again.",
        "error"
      );
    }
  };
 
  // Handle inline edit save
  const handleSaveEdit = async (submissionId, updatedData) => {
    try {
      // Validate all required fields
      if (!updatedData.date) {
        showAlert("Required Field", "Please select a date.", "warning");
        return;
      }
      if (!updatedData.duetime) {
        showAlert("Required Field", "Please select a time.", "warning");
        return;
      }
 
      const selected = teamOptions.find((t) => t.managerLastName === updatedData.teamName);
      const teamId = selected?.id || null;
 
      const payload = {
        teamId,
        teamName: updatedData.teamName,
        date: updatedData.date,
        duetime: updatedData.duetime,
      };
 
      await updateDoc(doc(db, COLLECTION, submissionId), payload);
 
      // Notify team (PM, Adviser, Members)
      await notifyTeamSchedule({
        kind: "Manuscript Submission",
        teamId,
        teamName: updatedData.teamName,
        date: updatedData.date,
        time: updatedData.duetime,
      });
 
      setEditingId(null);
      await loadSubmissions();
      showAlert("Success", "Submission updated successfully.", "success");
    } catch (err) {
      console.error("Failed to update submission:", err);
      showAlert("Error", "Operation failed. Please try again.", "error");
      await loadSubmissions();
    }
  };
 
  // Handle submission re-submission
  const handleScheduleReSubmission = async (originalSubmission) => {
    try {
      const newSubmission = {
        teamId: originalSubmission.teamId,
        teamName: originalSubmission.teamName,
        title: originalSubmission.title || "",
        date: "", // Empty date for re-submission
        duetime: "", // Empty time for re-submission
        plag: 0,
        ai: 0,
        verdict: "Pending",
        createdAt: new Date(),
        isReSubmission: true,
        originalSubmissionId: originalSubmission.id,
        fileUrl: [],
        file: "—",
      };
 
      await addDoc(collection(db, COLLECTION), newSubmission);
 
      setMenuOpenId(null);
      await loadSubmissions();
 
      showAlert(
        "Success",
        "Re-submission scheduled successfully. Please set the new date and time.",
        "success"
      );
    } catch (err) {
      console.error("Failed to schedule re-submission:", err);
      showAlert(
        "Error",
        "Failed to schedule re-submission. Please try again.",
        "error"
      );
    }
  };
 
  // Handle single submission deletion
  const handleDeleteSubmission = async (submission) => {
    const result = await Swal.fire({
      title: "Confirm Delete",
      text: `Delete manuscript submission for "${submission.teamName}"? This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: MAROON,
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
 
    if (!result.isConfirmed) return;
 
    try {
      await deleteDoc(doc(db, COLLECTION, submission.id));
      setMenuOpenId(null);
      await loadSubmissions();
      showAlert("Success", "Submission deleted successfully.", "success");
    } catch (e) {
      console.error("Failed to delete submission:", e);
      showAlert(
        "Error",
        "Failed to delete submission. Please try again.",
        "error"
      );
      await loadSubmissions();
    }
  };
 
  // Check if verdict can be edited (date must be passed)
  const canEditVerdict = (submission) => {
    return isDatePassed(submission.date, submission.duetime);
  };
 
  // Check if submission details can be edited (verdict must not be "Passed")
  const canEditSubmission = (submission) => {
    return submission.verdict !== "Passed";
  };
 
  // search filter (client-side) - only search team name and title
  const filtered = useMemo(() => {
    let result = submissions;
 
    // Apply verdict filter
    if (filterVerdict !== "all") {
      result = result.filter((s) => s.verdict === filterVerdict);
    }
 
    // Apply search text filter - team name and title
    const q = queryText.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (t) =>
          t.teamName.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q)
      );
    }
 
    return result;
  }, [queryText, filterVerdict, submissions]);
 
  // Select-all works on the filtered (visible) list
  const allVisibleIds = useMemo(() => filtered.map((s) => s.id), [filtered]);
  const allSelected =
    selected.size > 0 && allVisibleIds.every((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected((prev) => (allSelected ? new Set() : new Set(allVisibleIds)));
  };
 
  // Delete button behavior
  const handleBulkDeleteClick = async () => {
    if (!bulkMode) {
      setBulkMode(true);
      return;
    }
    if (selected.size === 0) {
      showAlert(
        "Selection Required",
        "Select at least one submission to delete.",
        "warning"
      );
      return;
    }
 
    const result = await Swal.fire({
      title: "Confirm Delete",
      text: `Delete ${selected.size} selected submission(s)? This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: MAROON,
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
 
    if (!result.isConfirmed) return;
 
    try {
      await Promise.all(
        Array.from(selected).map((id) => deleteDoc(doc(db, COLLECTION, id)))
      );
      exitBulk();
      await loadSubmissions();
      showAlert(
        "Success",
        `${selected.size} submission(s) deleted successfully.`,
        "success"
      );
    } catch (e) {
      console.error("Bulk delete failed:", e);
      showAlert(
        "Error",
        "Failed to delete some submissions. Please try again.",
        "error"
      );
      await loadSubmissions();
    }
  };
 
  /* ===== PDF export with SweetAlert dropdown ===== */
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
 
  const handleExportPDF = async () => {
    const { value: exportFilter } = await Swal.fire({
      title: "Export PDF",
      text: "Choose which submissions to export:",
      icon: "question",
      input: "select",
      inputOptions: {
        all: "All Submissions",
        Pending: "Pending",
        Recheck: "Recheck",
        Passed: "Passed",
      },
      inputValue: "all",
      showCancelButton: true,
      confirmButtonText: "Export",
      cancelButtonText: "Cancel",
      confirmButtonColor: MAROON,
    });
 
    if (!exportFilter) return;
 
    // Filter data based on selection
    let exportData = submissions;
    if (exportFilter !== "all") {
      exportData = submissions.filter((s) => s.verdict === exportFilter);
    }
 
    if (exportData.length === 0) {
      Swal.fire({
        title: "No Data",
        text: `No ${
          exportFilter === "all" ? "" : exportFilter + " "
        }submissions found to export.`,
        icon: "warning",
        confirmButtonColor: MAROON,
      });
      return;
    }
 
    const title = `Manuscript Submissions - ${
      exportFilter === "all" ? "All" : exportFilter
    }`;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
 
    // preload images
    let dctImg, ccsImg, tsImg;
    try {
      [dctImg, ccsImg, tsImg] = await Promise.all([
        loadImage(DCTLOGO),
        loadImage(CCSLOGO),
        loadImage(TASKSPHERELOGO),
      ]);
    } catch {
      // continue even if images fail to load
    }
 
    const drawHeader = () => {
      const topY = 24;
 
      if (dctImg) {
        const sideW = 64;
        const sideH = (dctImg.height / dctImg.width) * sideW;
        doc.addImage(dctImg, "PNG", marginX, topY, sideW, sideH);
      }
      if (ccsImg) {
        const sideW = 64;
        const sideH = (ccsImg.height / ccsImg.width) * sideW;
        doc.addImage(
          ccsImg,
          "PNG",
          pageWidth - marginX - sideW,
          topY,
          sideW,
          sideH
        );
      }
 
      const headerY = 92;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DOMINICAN COLLEGE OF TARLAC, INC.", pageWidth / 2, headerY, {
        align: "center",
      });
      doc.setFont("helvetica", "normal");
      doc.text("COLLEGE OF COMPUTER STUDIES", pageWidth / 2, headerY + 16, {
        align: "center",
      });
      doc.setFontSize(10);
      doc.text(
        "McArthur Highway, Poblacion (Sto. Rosario), Capas, 2315 Tarlac, Philippines",
        pageWidth / 2,
        headerY + 32,
        { align: "center" }
      );
      doc.text(
        "Institutional Contact Nos.: +63938-918-4093    Website: dct.edu.ph",
        pageWidth / 2,
        headerY + 48,
        { align: "center" }
      );
      doc.text(
        "E-mail: domct_2315@yahoo.com.ph / domct_2315@dct.edu.ph",
        pageWidth / 2,
        headerY + 64,
        { align: "center" }
      );
 
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const titleY = headerY + 96;
      doc.text(title, pageWidth / 2, titleY, { align: "center" });
 
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `As of ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        titleY + 16,
        {
          align: "center",
        }
      );
 
      doc.setDrawColor(180);
      doc.line(marginX, titleY + 26, pageWidth - marginX, titleY + 26);
 
      return titleY + 38; // table start Y
    };
 
    const drawFooter = () => {
      if (tsImg) {
        const logoW = 72;
        const logoH = (tsImg.height / tsImg.width) * logoW;
        const x = marginX;
        const y = pageHeight - 20 - logoH;
        doc.addImage(tsImg, "PNG", x, y, logoW, logoH);
      }
 
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(str, pageWidth - marginX, pageHeight - 14, { align: "right" });
    };
 
    const tableYStart = drawHeader();
 
    const contentWidth = pageWidth - marginX * 2;
    const W = {
      no: 0.05 * contentWidth,
      team: 0.18 * contentWidth,
      title: 0.22 * contentWidth,
      date: 0.12 * contentWidth,
      time: 0.1 * contentWidth,
      plag: 0.1 * contentWidth,
      ai: 0.1 * contentWidth,
      ver: 0.13 * contentWidth,
    };
 
    const verdictColor = (v) => {
      const s = String(v || "").toLowerCase();
      if (s === "passed") return [34, 139, 34];
      if (s === "recheck") return [217, 168, 30];
      return [106, 15, 20]; // Pending/others
    };
 
    const pctColor = (n) => (Number(n) <= 10 ? [34, 139, 34] : [180, 35, 24]);
 
    autoTable(doc, {
      startY: tableYStart,
      head: [
        [
          "NO",
          "Team",
          "Title",
          "Due Date",
          "Time",
          "Plagiarism",
          "AI",
          "Verdict",
        ],
      ],
      body: exportData.map((s, i) => [
        `${i + 1}.`,
        s.teamName || "",
        s.title || "",
        fmtDateHuman(s.date) || "",
        to12h(s.duetime) || "",
        `${Number(s.plag || 0)}%`,
        `${Number(s.ai || 0)}%`,
        s.verdict || "",
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 6,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: 60,
        lineWidth: 0.4,
        lineColor: [220, 220, 220],
        fontStyle: "bold",
      },
      bodyStyles: { lineWidth: 0.3, lineColor: [235, 235, 235] },
      columnStyles: {
        0: { cellWidth: W.no, halign: "left" },
        1: { cellWidth: W.team },
        2: { cellWidth: W.title },
        3: { cellWidth: W.date },
        4: { cellWidth: W.time },
        5: { cellWidth: W.plag, halign: "right" },
        6: { cellWidth: W.ai, halign: "right" },
        7: { cellWidth: W.ver, halign: "center" },
      },
      margin: { left: marginX, right: marginX, bottom: 64 },
      tableWidth: contentWidth,
      didParseCell: (data) => {
        if (data.section === "body") {
          if (data.column.index === 7) {
            data.cell.styles.textColor = verdictColor(data.cell.text?.[0]);
            data.cell.styles.fontStyle = "bold";
          }
          if (data.column.index === 5) {
            const val = (data.cell.text?.[0] || "").replace("%", "").trim();
            data.cell.styles.textColor = pctColor(val);
            data.cell.styles.fontStyle = "bold";
          }
          if (data.column.index === 6) {
            const val = (data.cell.text?.[0] || "").replace("%", "").trim();
            data.cell.styles.textColor = pctColor(val);
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: () => {
        drawHeader();
        drawFooter();
      },
    });
 
    doc.save(
      `manuscript_submissions_${
        exportFilter === "all" ? "all" : exportFilter.toLowerCase()
      }_${new Date().toISOString().slice(0, 10)}.pdf`
    );
 
    Swal.fire({
      title: "Export Successful!",
      text: `PDF exported with ${exportData.length} ${
        exportFilter === "all" ? "" : exportFilter + " "
      }submission(s).`,
      icon: "success",
      confirmButtonColor: MAROON,
    });
  };
 
  // EditableRow component for inline editing
  const EditableRow = ({ submission, onSave, onCancel }) => {
    const [editedData, setEditedData] = useState({
      teamName: submission.teamName || "",
      date: submission.date || "",
      duetime: submission.duetime || "",
    });
 
    const canEdit = canEditSubmission(submission);
 
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3 text-neutral-600">
          {filtered.findIndex((s) => s.id === submission.id) + 1}.
        </td>
 
        {/* Team Name (readonly in edit mode) */}
        <td className="px-4 py-3 font-medium text-neutral-800">
          {submission.teamName}
        </td>
 
        {/* Title (readonly) */}
        <td className="px-4 py-3 font-medium text-neutral-800">
          {submission.title || "—"}
        </td>
 
        <input
  type="date"
  value={editedData.date}
  onChange={(e) =>
    setEditedData((prev) => ({ ...prev, date: e.target.value }))
  }
  disabled={!canEdit}
  min={getCurrentDate()} // 👈 Prevents past date selection
  className={`w-full px-2 py-1 rounded border text-sm ${
    canEdit
      ? "border-neutral-300"
      : "border-neutral-200 bg-neutral-100 cursor-not-allowed"
  }`}
  required
/>

 
        {/* Time Dropdown */}
        <td className="px-4 py-3">
          <div className="relative">
            <select
              value={editedData.duetime}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, duetime: e.target.value }))
              }
              disabled={!canEdit}
              className={`w-full appearance-none pr-8 pl-2 py-1 rounded border text-sm ${
                canEdit
                  ? "border-neutral-300 bg-white"
                  : "border-neutral-200 bg-neutral-100 cursor-not-allowed"
              }`}
              required
            >
              <option value="">Select Time</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {to12h(time)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1.5 text-neutral-500 pointer-events-none"
            />
          </div>
        </td>
 
        {/* Plagiarism (readonly) */}
        <td className={`px-4 py-3 font-semibold ${pctClass(submission.plag)}`}>
          {submission.plag}%
        </td>
 
        {/* AI (readonly) */}
        <td className={`px-4 py-3 font-semibold ${pctClass(submission.ai)}`}>
          {submission.ai}%
        </td>
 
        {/* File Uploaded (readonly) */}
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setFilesRow(submission)}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            title="View uploaded files"
          >
            <ExternalLink className="w-4 h-4" />
            View Files
          </button>
        </td>
 
        {/* Verdict */}
        <td className="px-4 py-3">
          <div className="relative inline-flex items-center">
            <select
              value={submission.verdict || "Pending"}
              onChange={(e) =>
                handleChangeVerdict(submission.id, e.target.value)
              }
              disabled={!canEditVerdict(submission)}
              className={`appearance-none pr-8 pl-3 py-1.5 rounded-md border text-sm ${
                canEditVerdict(submission)
                  ? ""
                  : "opacity-60 cursor-not-allowed"
              }`}
              style={{ borderColor: MAROON, color: "#111827" }}
            >
              <option>Pending</option>
              <option>Recheck</option>
              <option>Passed</option>
            </select>
            <ChevronDown
              size={16}
              className="absolute right-2 pointer-events-none text-neutral-500"
            />
          </div>
        </td>
 
        {/* Action buttons */}
        <td className="px-2 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSave(editedData)}
              className="p-1.5 rounded hover:bg-green-100 text-green-600"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 rounded hover:bg-red-100 text-red-600"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };
 
  // Get row background color based on verdict
  const getRowBackgroundColor = (verdict) => {
    if (verdict === "Failed") {
      return "bg-red-600 text-white";
    }
    return "";
  };
 
  // cell color helper for ≤10% = green
  const pctClass = (n) =>
    Number(n) <= 10 ? "text-[#6BA34D]" : "text-[#E45454]";
 
  return (
    <div className="">
      <Breadcrumbs />
      <div className="mt-2 h-[2px] w-full bg-neutral-200">
        <div
          className="h-[2px]"
          style={{ backgroundColor: MAROON, width: 260 }}
        />
      </div>
 
      {/* actions */}
      <div className="mt-6 space-y-4">
        {/* Row 1: Back + Export (aligned) */}
        <div className="flex items-center gap-3">
          <Btn
            icon={ChevronLeft}
            variant="outline"
            onClick={() =>
              window.history.length
                ? window.history.back()
                : navigate("/instructor/schedule")
            }
          >
            Back to Schedule
          </Btn>
          <Btn icon={Download} variant="outline" onClick={handleExportPDF}>
            Export PDF
          </Btn>
        </div>
 
        {/* Row 2: Search (left) + Filter (right) */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <input
              type="text"
              placeholder="Search team name or title"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="pl-10 pr-3 py-2 w-72 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
            <Search
              size={16}
              className="absolute left-3 top-2.5 text-neutral-400"
            />
          </div>
 
          <div className="flex items-center gap-3">
            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Filter size={16} />
                Filter
                <ChevronDown size={16} />
              </button>
 
              {filterOpen && (
                <div className="absolute right-0 mt-1 z-20 w-48 rounded-md border bg-white shadow-lg">
                  <div className="py-1">
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "all"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("all");
                        setFilterOpen(false);
                      }}
                    >
                      All Verdicts
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "Pending"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("Pending");
                        setFilterOpen(false);
                      }}
                    >
                      Pending
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "Recheck"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("Recheck");
                        setFilterOpen(false);
                      }}
                    >
                      Recheck
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "Passed"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("Passed");
                        setFilterOpen(false);
                      }}
                    >
                      Passed
                    </button>
                  </div>
                </div>
              )}
            </div>
 
            {bulkMode && (
              <button
                onClick={exitBulk}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 border border-neutral-300 bg-white"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
 
      {/* Active Filter Badge */}
      {filterVerdict !== "all" && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-neutral-600">Active filter:</span>
          <div className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
            {filterVerdict}
            <button
              onClick={() => setFilterVerdict("all")}
              className="ml-1 rounded-full hover:bg-blue-200 p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
 
      {/* table */}
      <div className="mt-5 rounded-xl border border-neutral-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              {bulkMode ? (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </th>
              ) : (
                <th className="text-left px-4 py-3 w-16">NO</th>
              )}
              <th className="text-left px-4 py-3">Team</th>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">
                <div className="inline-flex items-center gap-2">
                  <CalIcon size={16} /> Due Date
                </div>
              </th>
              <th className="text-left px-4 py-3">
                <div className="inline-flex items-center gap-2">
                  <Clock size={16} /> Time
                </div>
              </th>
              <th className="text-left px-4 py-3">Plagiarism</th>
              <th className="text-left px-4 py-3">AI</th>
              <th className="text-left px-4 py-3">File Uploaded</th>
              <th className="text-left px-4 py-3">Verdict</th>
              <th className="text-left px-4 py-3 w-16">Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingSubmissions ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={10}>
                  Loading submissions…
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={10}>
                  No manuscript submissions found for teams that passed Title
                  Defense. Make sure teams have 'Approved' verdict in Title
                  Defense schedule.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={10}>
                  {filterVerdict !== "all"
                    ? `No ${filterVerdict.toLowerCase()} submissions found${
                        queryText ? ` for "${queryText}"` : ""
                      }.`
                    : `No matches found for "${queryText}".`}
                </td>
              </tr>
            ) : (
              filtered.map((s, idx) => {
                if (editingId === s.id) {
                  return (
                    <EditableRow
                      key={s.id}
                      submission={s}
                      onSave={(updatedData) =>
                        handleSaveEdit(s.id, updatedData)
                      }
                      onCancel={() => setEditingId(null)}
                    />
                  );
                }
 
                const isChecked = selected.has(s.id);
                const rowColor = getRowBackgroundColor(s.verdict);
                const canEditVerdictNow = canEditVerdict(s);
                const canEditSubmissionNow = canEditSubmission(s);
                const fileCount = Array.isArray(s.fileUrl)
                  ? s.fileUrl.length
                  : 0;
 
                return (
                  <tr key={s.id} className={`${rowColor}`}>
                    {/* first column: checkbox or row number */}
                    {bulkMode ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${s.teamName}`}
                          checked={isChecked}
                          onChange={() => toggleSelect(s.id)}
                          className="h-4 w-4"
                        />
                      </td>
                    ) : (
                      <td className="px-4 py-3">{idx + 1}.</td>
                    )}
 
                    <td className="px-4 py-3 font-medium">{s.teamName}</td>
                    <td className="px-4 py-3">{s.title || "—"}</td>
 
                    {/* Date */}
                    <td className="px-4 py-3">{fmtDateHuman(s.date) || "—"}</td>
 
                    {/* Time */}
                    <td className="px-4 py-3">{to12h(s.duetime) || "—"}</td>
 
                    {/* Plagiarism */}
                    <td
                      className={`px-4 py-3 font-semibold ${pctClass(s.plag)}`}
                    >
                      {s.plag}%
                    </td>
 
                    {/* AI */}
                    <td className={`px-4 py-3 font-semibold ${pctClass(s.ai)}`}>
                      {s.ai}%
                    </td>
 
                    {/* View-only files modal trigger */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setFilesRow(s)}
                        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                        title="View uploaded files"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Files{fileCount ? ` (${fileCount})` : ""}
                      </button>
                    </td>
 
                    {/* Verdict */}
                    <td className="px-4 py-3">
                      <div className="relative inline-flex items-center">
                        <select
                          value={s.verdict || "Pending"}
                          onChange={(e) =>
                            handleChangeVerdict(s.id, e.target.value)
                          }
                          onFocus={() => {
                            if (!canEditVerdictNow && s.verdict === "Pending") {
                              showTooltipFor5Sec(s.id);
                            }
                          }}
                          disabled={!canEditVerdictNow || bulkMode}
                          className={`appearance-none pr-8 pl-3 py-1.5 rounded-md border text-sm ${
                            !canEditVerdictNow || bulkMode
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                          style={{
                            borderColor: MAROON,
                            color: s.verdict === "Failed" ? "white" : "#111827",
                            backgroundColor:
                              s.verdict === "Failed" ? "transparent" : "white",
                          }}
                        >
                          <option>Pending</option>
                          <option>Recheck</option>
                          <option>Passed</option>
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-2 pointer-events-none text-neutral-500"
                        />
                        {showVerdictTooltip === s.id &&
                          !canEditVerdictNow &&
                          s.verdict === "Pending" && (
                            <div className="absolute -top-8 left-0 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 shadow-sm z-10">
                              Set verdict after submission date
                            </div>
                          )}
                      </div>
                    </td>
 
                    {/* Row actions - Kebab menu with Update, Schedule Re-Submission, and Remove */}
                    <td className="px-2 py-3 relative">
                      <button
                        disabled={bulkMode}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                          bulkMode
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-neutral-100"
                        }`}
                        onClick={() =>
                          setMenuOpenId(menuOpenId === s.id ? null : s.id)
                        }
                      >
                        <MoreVertical size={18} />
                      </button>
 
                      {!bulkMode && menuOpenId === s.id && (
                        <div className="absolute right-2 mt-1 z-20 w-48 rounded-md border bg-white shadow">
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                            onClick={() => {
                              setEditingId(s.id);
                              setMenuOpenId(null);
                            }}
                            disabled={!canEditSubmissionNow}
                          >
                            <Check size={14} />
                            Update
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                            onClick={() => handleScheduleReSubmission(s)}
                            disabled={s.verdict === "Passed"}
                          >
                            <RotateCcw size={14} />
                            Schedule Re-Submission
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 text-red-600"
                            onClick={() => handleDeleteSubmission(s)}
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
 
      {/* View Team Dialog */}
      {viewSchedule && (
        <ViewTeamDialog
          schedule={viewSchedule}
          onClose={() => setViewSchedule(null)}
        />
      )}
 
      {/* View-only Uploaded Files modal */}
      {filesRow && (
        <FilesViewerModal row={filesRow} onClose={() => setFilesRow(null)} />
      )}
    </div>
  );
}
 
/* ------- View Team Dialog ------- */
function ViewTeamDialog({ schedule, onClose }) {
  const [loading, setLoading] = useState(true);
  const [adviser, setAdviser] = useState("-");
  const [manager, setManager] = useState("-");
  const [members, setMembers] = useState([]);
 
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (schedule?.teamId) {
          const ref = doc(db, "teams", schedule.teamId);
          const snap = await getDoc(ref);
          const data = snap.exists() ? snap.data() : null;
          if (alive && data) {
            setAdviser(data?.adviser?.fullName || "-");
            setManager(data?.manager?.fullName || "-");
            setMembers(
              Array.isArray(data?.memberNames) ? data.memberNames : []
            );
          }
        } else {
          setAdviser("-");
          setManager("-");
          setMembers([]);
        }
      } catch (e) {
        console.error("Failed to load team for view:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [schedule?.teamId]);
 
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y/1/2 w-[760px] max-w-[92vw]">
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-2xl focus:outline-none p-0">
          {/* header */}
          <div className="px-6 pt-5 pb-3">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <FileText size={18} />
              View Team
            </div>
            <div className="mt-3 h-[2px] w-full bg-neutral-200">
              <div
                className="h-[2px]"
                style={{ backgroundColor: MAROON, width: 110 }}
              />
            </div>
          </div>
 
          {/* body */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              {/* Team Name */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Team
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                  {schedule?.teamName || "-"}
                </div>
              </div>
 
              {/* Adviser */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Adviser
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                  {loading ? "Loading…" : adviser}
                </div>
              </div>
 
              {/* Project Manager */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Project Manager
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                  {loading ? "Loading…" : manager}
                </div>
              </div>
 
              {/* Members */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Members
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-3 text-sm">
                  {loading ? (
                    "Loading…"
                  ) : members.length === 0 ? (
                    <span className="text-neutral-500">No members listed.</span>
                  ) : (
                    <ul className="list-disc ml-5 space-y-1">
                      {members.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
 
            {/* footer */}
            <div className="mt-8 flex items-center justify-end">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 
/* ---------------- View-only Files Modal ---------------- */
function FilesViewerModal({ row, onClose }) {
  const files = Array.isArray(row?.fileUrl) ? row.fileUrl : [];
 
  // normalize: support either object form or raw URL strings
  const list = files.map((f, i) => {
    if (typeof f === "string") {
      const name = f.split("/").pop() || `file-${i + 1}`;
      return { name, fileName: name, url: f };
    }
    return {
      name: f.name || `file-${i + 1}`,
      fileName: f.fileName || f.name || `file-${i + 1}`,
      url: f.url || "",
      uploadedAt: f.uploadedAt || "",
    };
  });
 
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="relative z-10 mx-auto mt-10 w-[880px] max-w-[95vw]">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
          {/* header bar */}
          <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <span>●</span>
              <span>Uploaded Files — {row?.teamName}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
 
          {/* body */}
          <div className="flex-1 px-5 pb-5 overflow-y-auto">
            <div className="rounded-xl border border-neutral-200">
              <div className="px-4 py-2 border-b border-neutral-200 text-sm font-semibold">
                Files
              </div>
              <div className="p-4">
                {list.length ? (
                  <ul className="space-y-2">
                    {list.map((f, i) => (
                      <li
                        key={f.fileName || `${f.url}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                      >
                        <div className="truncate">
                          <div className="text-sm font-medium truncate">
                            {f.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {f.fileName}
                          </div>
                          {f.uploadedAt && (
                            <div className="text-xs text-neutral-400">
                              {new Date(f.uploadedAt).toLocaleString()}
                            </div>
                          )}
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
                ) : (
                  <div className="text-sm text-neutral-600">
                    There's no uploaded file yet.
                  </div>
                )}
              </div>
            </div>
          </div>
 
          {/* footer */}
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