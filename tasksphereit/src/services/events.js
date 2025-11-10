import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

const COL = {
  title: "titleDefenseSchedules",
  manuscript: "manuscriptSubmissions",
  oral: "oralDefenseSchedules",
  final: "finalDefenseSchedules",
  reFinal: "finalRedefenseSchedules",
  teams: "teams",
  teamTitles: "teamSystemTitles",
};

async function getTeamTitlesMap(teamIds = []) {
  const map = new Map();
  if (!Array.isArray(teamIds) || teamIds.length === 0) return map;
  // Firestore doesn't support IN on doc IDs for getDoc, so fetch individually
  await Promise.all(
    teamIds.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, COL.teamTitles, id));
        if (snap.exists()) {
          const d = snap.data();
          const title = (d?.systemTitle || "").toString();
          map.set(id, title);
        }
      } catch (_) {}
    })
  );
  return map;
}

async function fetchCollectionRows(
  colName,
  { teamIds = null, singleTimeField = null, statusField = "verdict" } = {}
) {
  let baseRef = collection(db, colName);
  let snaps = [];

  if (Array.isArray(teamIds) && teamIds.length > 0) {
    // "in" supports up to 10 values; chunk if needed
    const chunks = [];
    for (let i = 0; i < teamIds.length; i += 10)
      chunks.push(teamIds.slice(i, i + 10));
    for (const chunk of chunks) {
      const qy = query(baseRef, where("teamId", "in", chunk));
      const s = await getDocs(qy);
      snaps.push(...s.docs);
    }
  } else {
    const s = await getDocs(baseRef);
    snaps = s.docs;
  }

  const rows = snaps.map((docX) => {
    const d = docX.data() || {};
    const timeStart = (d?.timeStart || d?.time || "").toString();
    const timeEnd = (d?.timeEnd || "").toString();
    const tStart = singleTimeField
      ? (d?.[singleTimeField] || "").toString()
      : timeStart;
    return {
      id: docX.id,
      teamId: (d?.teamId || "").toString(),
      teamName: (d?.teamName || "").toString(),
      title: (d?.title || "").toString(),
      date: (d?.date || "").toString(),
      timeStart: tStart,
      timeEnd: singleTimeField ? "" : timeEnd,
      panelists: Array.isArray(d?.panelists) ? d.panelists : [],
      verdict: (d?.[statusField] || "Pending").toString(),
      plag: typeof d?.plag === "number" ? d.plag : Number(d?.plag || 0),
      ai: typeof d?.ai === "number" ? d.ai : Number(d?.ai || 0),
      file: (d?.file || "").toString(),
      createdAt: d?.createdAt,
    };
  });

  // Sort by date then start time for stable UI
  rows.sort((a, b) => {
    const ad = a.date || "";
    const bd = b.date || "";
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    return (a.timeStart || "").localeCompare(b.timeStart || "");
  });
  return rows;
}

export async function getUserTeams(uid) {
  if (!uid) return [];
  const res = [];
  try {
    const qMembers = query(
      collection(db, COL.teams),
      where("memberUids", "array-contains", uid)
    );
    const s1 = await getDocs(qMembers);
    s1.forEach((d) => res.push({ id: d.id, name: d.data()?.name || "" }));
  } catch (_) {}

  try {
    const qMgr = query(
      collection(db, COL.teams),
      where("manager.uid", "==", uid)
    );
    const s2 = await getDocs(qMgr);
    s2.forEach((d) => {
      if (!res.find((x) => x.id === d.id))
        res.push({ id: d.id, name: d.data()?.name || "" });
    });
  } catch (_) {}

  // NEW: teams where this user is the adviser
  try {
    const qAdv = query(
      collection(db, COL.teams),
      where("adviser.uid", "==", uid)
    );
    const s3 = await getDocs(qAdv);
    s3.forEach((d) => {
      if (!res.find((x) => x.id === d.id))
        res.push({ id: d.id, name: d.data()?.name || "" });
    });
  } catch (_) {}

  return res;
}

export async function getAdviserEvents(adviserUid) {
  const EMPTY = {
    titleDefense: [],
    manuscript: [],
    oralDefense: [],
    finalDefense: [],
    finalRedefense: [],
  };
  if (!adviserUid) return EMPTY;

  // Find teams handled by this adviser
  const s = await getDocs(
    query(collection(db, COL.teams), where("adviser.uid", "==", adviserUid))
  );
  const teamIds = s.docs.map((d) => d.id);

  if (!teamIds.length) return EMPTY;

  // Reuse existing filtered fetcher
  return getEventsForTeams(teamIds);
}

export async function getEventsForTeams(teamIds = []) {
  const [titleRows, manusRows, oralRows, finalRows, reFinalRows] =
    await Promise.all([
      fetchCollectionRows(COL.title, { teamIds }),
      fetchCollectionRows(COL.manuscript, {
        teamIds,
        singleTimeField: "time",
        statusField: "verdict",
      }),
      fetchCollectionRows(COL.oral, { teamIds }),
      fetchCollectionRows(COL.final, { teamIds }),
      fetchCollectionRows(COL.reFinal, { teamIds }).catch(() => []),
    ]);
  const titlesMap = await getTeamTitlesMap(teamIds);
  const withTitle = (rows) =>
    rows.map((r) => ({
      ...r,
      title: r.title || titlesMap.get(r.teamId) || "",
    }));
  return {
    titleDefense: titleRows,
    manuscript: manusRows,
    oralDefense: withTitle(oralRows),
    finalDefense: withTitle(finalRows),
    finalRedefense: withTitle(reFinalRows),
  };
}

// Convenience to load by current user id
export async function getEventsForUser(uid) {
  const teams = await getUserTeams(uid);
  const teamIds = teams.map((t) => t.id);
  return getEventsForTeams(teamIds);
}

// --- Updates (for Adviser management) ---
export async function updateManuscriptVerdict(
  docId,
  { verdict, plag, ai, file }
) {
  const payload = {};
  if (typeof verdict === "string") payload.verdict = verdict;
  if (typeof plag === "number") payload.plag = plag;
  if (typeof ai === "number") payload.ai = ai;
  if (typeof file === "string") payload.file = file;
  await updateDoc(doc(db, COL.manuscript, docId), payload);
}

export async function updateScheduleVerdict(collectionKey, docId, verdict) {
  const cmap = {
    title: COL.title,
    oral: COL.oral,
    final: COL.final,
    reFinal: COL.reFinal,
  };
  const col = cmap[collectionKey];
  if (!col) throw new Error("Invalid schedule collection key");
  await updateDoc(doc(db, col, docId), { verdict });
}
