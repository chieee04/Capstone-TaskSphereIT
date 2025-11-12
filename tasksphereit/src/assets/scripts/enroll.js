// src/utils/enroll.js
import { auth, db } from "../../config/firebase";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as signOutAuth,
} from "firebase/auth";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,          // ✅ missing
  query,            // ✅ missing
  where,
} from "firebase/firestore";

const DEFAULT_PASSWORD = "UserUser321";
const DEFAULT_IMAGE_URL = "None";
const TOS_VERSION = "2025-05-09";

/* ------------ secondary auth so the current admin session is untouched ------------ */
let _secondaryAuth = null;
function getSecondaryAuth() {
  if (_secondaryAuth) return _secondaryAuth;
  const NAME = "admin-user-create";
  const apps = getApps();
  let secondaryApp = apps.find((a) => a.name === NAME);
  if (!secondaryApp) {
    const cfg = getApp().options; // reuse default app config
    secondaryApp = initializeApp(cfg, NAME);
  }
  _secondaryAuth = getAuth(secondaryApp);
  return _secondaryAuth;
}

const enforceRole = (role) => {
  const r = String(role || "").toLowerCase();
  if (r === "adviser" || r === "advisor") return "Adviser";
  // Treat anything else (student, project manager, pm, blank, typos) as Member
  return "Member";
};

/* ------------ helpers ------------ */
const generateRandomEmail = () => {
  const s = Math.random().toString(36).slice(2, 12);
  return `${s}@gmail.com`;
};

const shapeUserDoc = (userData, uid) => ({
  uid,
  email: (userData.email || "").trim(),
  idNumber: (userData.idNumber || "").trim(),
  firstName: (userData.firstName || "").trim(),
  middleName: (userData.middleName || "").trim(),
  lastName: (userData.lastName || "").trim(),
  imageUrl: DEFAULT_IMAGE_URL,
  role: userData.role || "",
  activate: "inactive",
  // ToS defaults — NOT accepted at creation
  isTosAccepted: false,
  tosAcceptedAt: null,
  tosVersion: null,
  // your password flags
  mustChangePassword: true,
  forceDefaultPassword: true,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

/* ------------ single create ------------ */
export const createUser = async (userData) => {
  const secAuth = getSecondaryAuth();
  try {
    const email = (userData.email || "").trim();
    const cred = await createUserWithEmailAndPassword(
      secAuth,
      email,
      DEFAULT_PASSWORD
    );

    const safeRole = enforceRole(userData.role);

    await addDoc(
      collection(db, "users"),
      shapeUserDoc({ ...userData, role: safeRole }, cred.user.uid)
    );
  } catch (error) {
    const msg =
      error?.code === "auth/email-already-in-use"
        ? "Email is already in use."
        : error?.code === "auth/invalid-email"
        ? "Please enter a valid email."
        : error?.message || "Failed to add user.";
    throw new Error(msg);
  } finally {
    try {
      await signOutAuth(secAuth);
    } catch {}
  }
};

/* ------------ bulk import (Excel) ------------ */
export const saveImportedUsers = async (rows, selectedTabOrRole) => {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const secAuth = getSecondaryAuth();

  // Map the context to a valid DB role
  const roleForImport =
    String(selectedTabOrRole || "").toLowerCase() === "student"
      ? "Member"
      : "Adviser";

  try {
    for (const r of rows) {
      if (typeof r._select === "boolean" && !r._select) continue;

      const email = (r.email || "").trim() || generateRandomEmail();

      const cred = await createUserWithEmailAndPassword(
        secAuth,
        email,
        DEFAULT_PASSWORD
      );

      // We *override* any role from Excel to enforce our two-role model.
      await addDoc(
        collection(db, "users"),
        shapeUserDoc(
          {
            email,
            idNumber: r.idNumber || "",
            firstName: r.firstName || "",
            middleName: r.middleName || "",
            lastName: r.lastName || "",
            role: roleForImport, // <- always "Member" on Student tab, else "Adviser"
          },
          cred.user.uid
        )
      );
    }
  } catch (error) {
    throw new Error(error?.message || "Error saving imported users.");
  } finally {
    try {
      await signOutAuth(secAuth);
    } catch {}
  }
};

/* ------------ admin actions ------------ */
export const deleteAndBlockUser = async (user) => {
  try {
    const fromRef = doc(db, "users", user.id);
    const snap = await getDoc(fromRef);
    if (!snap.exists()) return;

    const data = snap.data();

    // 🔴 Move to blockedUsers
    await setDoc(doc(db, "blockedUsers", user.id), {
      ...data,
      blockedAt: serverTimestamp(),
      uid: data.uid || null,
      email: data.email || null,
    });

    // 🧩 If Project Manager → dissolve team(s)
    if (data.role === "Project Manager") {
      const teamsRef = collection(db, "teams");
      const q = query(teamsRef, where("manager.uid", "==", data.uid));
      const teamSnap = await getDocs(q);

      for (const teamDoc of teamSnap.docs) {
        const teamId = teamDoc.id;
        console.log(`Dissolving team: ${teamDoc.data().name} (${teamId})`);

        const collectionsToDelete = [
          "titleDefenseSchedules",
          "manuscriptSubmissions",
          "oralDefenseSchedules",
          "finalDefenseSchedules",
        ];

        for (const colName of collectionsToDelete) {
          const snap = await getDocs(
            query(collection(db, colName), where("teamId", "==", teamId))
          );
          for (const docSnap of snap.docs) {
            await deleteDoc(docSnap.ref);
          }
        }

        await deleteDoc(teamDoc.ref);
      }
    }

    // 🔥 Finally delete user from "users"
    await deleteDoc(fromRef);
    console.log(`✅ User "${data.firstName} ${data.lastName}" deleted and blocked.`);
  } catch (error) {
    console.error("Block failed:", error);
    throw new Error("Failed to delete/block this account.");
  }
};

export const resetPasswordToDefault = async (user) => {
  try {
    await updateDoc(doc(db, "users", user.id), {
      forceDefaultPassword: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(error);
    throw new Error("Failed to set reset flag.");
  }
};

export const sendPasswordResetEmailToUser = async (user) => {
  try {
    if (!user?.email) throw new Error("No email on record.");
    await sendPasswordResetEmail(auth, user.email);
    return `Password reset email sent to ${user.email}.`;
  } catch (error) {
    console.error(error);
    throw new Error(error?.message || "Failed to send reset email.");
  }
};

export const bulkDeleteUsers = async (userIds, allUsers) => {
  for (const id of userIds) {
    const user = allUsers.find((x) => x.id === id);
    if (user) await deleteAndBlockUser(user);
  }
};

export const bulkResetPasswords = async (userIds) => {
  for (const id of userIds) {
    await updateDoc(doc(db, "users", id), {
      forceDefaultPassword: true,
      updatedAt: serverTimestamp(),
    });
  }
};

export const getMiddleInitial = (name) =>
  name ? `${name[0].toUpperCase()}.` : "";