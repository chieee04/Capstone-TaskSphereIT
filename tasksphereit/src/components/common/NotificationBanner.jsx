// src/components/common/NotificationBanner.jsx
import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, X, ExternalLink } from "lucide-react";
import { subscribeNotifications, markNotificationRead } from "../../services/notifications";
import { getUserTeams } from "../../services/events";
import { useNavigate } from "react-router-dom";

const MAROON = "#6A0F14";

export default function NotificationBanner({ role }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (uid) {
          const t = await getUserTeams(uid);
          if (alive) setTeams(t || []);
        }
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, [uid]);

  useEffect(() => {
    if (!uid && !role) return;
    const teamIds = (teams || []).map((t) => t.id).slice(0, 10);
    const unsub = subscribeNotifications({ uid, role, teamIds }, (docs) => {
      setItems(docs || []);
    });
    return () => unsub && unsub();
  }, [uid, role, teams]);

  const latestUnread = useMemo(() => {
    if (!uid) return null;
    return (items || []).find((n) => !Array.isArray(n.readBy) || !n.readBy.includes(uid));
  }, [items, uid]);

  if (!latestUnread) return null;

  const onView = async () => {
    try {
      await markNotificationRead(latestUnread.id, uid);
    } catch (_) {}
    const link = latestUnread.link || "/";
    navigate(link);
  };
  const onDismiss = async () => {
    try { await markNotificationRead(latestUnread.id, uid); } catch (_) {}
  };

  return (
    <div className="mb-3">
      <div className="flex items-start gap-3 rounded-md border border-[#F59E0B] bg-[#FFF7ED] px-3 py-2">
        <AlertCircle className="w-5 h-5 text-[#F59E0B] mt-[2px]" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-neutral-800">{latestUnread.title || "Notification"}</div>
          {latestUnread.body ? (
            <div className="text-xs text-neutral-700 mt-0.5 truncate">{latestUnread.body}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onView} className="inline-flex items-center gap-1 text-xs font-medium text-white px-2.5 py-1.5 rounded-md" style={{ backgroundColor: MAROON }}>
            View <ExternalLink size={14} />
          </button>
          <button onClick={onDismiss} className="p-1 rounded hover:bg-neutral-200/60" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

