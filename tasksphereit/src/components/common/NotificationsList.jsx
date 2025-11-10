// src/components/common/NotificationsList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import { subscribeNotifications, markNotificationRead } from "../../services/notifications";
import { getUserTeams } from "../../services/events";
import { useNavigate } from "react-router-dom";

export default function NotificationsList({ role }) {
  const navigate = useNavigate();
  const uid = typeof window !== "undefined" ? localStorage.getItem("uid") : null;
  const [teams, setTeams] = useState([]);
  const [items, setItems] = useState([]);

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
    const teamIds = (teams || []).map((t) => t.id).slice(0, 10);
    const unsub = subscribeNotifications({ uid, role, teamIds }, (docs) => setItems(docs || []));
    return () => unsub && unsub();
  }, [uid, role, teams]);

  const onOpen = async (n) => {
    if (!uid) return;
    try { await markNotificationRead(n.id, uid); } catch (_) {}
    navigate(n.link || "/");
  };

  const unreadCount = useMemo(
    () => items.filter((n) => !Array.isArray(n.readBy) || !n.readBy.includes(uid)).length,
    [items, uid]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[18px] font-semibold" style={{ color: "#6A0F14" }}>
        <Bell className="w-5 h-5" />
        <span>Notifications</span>
        <span className="ml-2 text-xs font-medium text-neutral-600">{unreadCount} unread</span>
      </div>
      <div className="h-[3px] w-full" style={{ backgroundColor: "#6A0F14" }} />

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-neutral-600">No notifications yet.</div>
        ) : (
          items.map((n) => {
            const isUnread = !Array.isArray(n.readBy) || !n.readBy.includes(uid);
            return (
              <div key={n.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${isUnread ? "bg-neutral-50 border-neutral-300" : "bg-white border-neutral-200"}`}>
                <div className={`mt-1 h-2 w-2 rounded-full ${isUnread ? "bg-[#DC2626]" : "bg-neutral-300"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-800">{n.title || "Notification"}</div>
                  {n.body ? <div className="text-xs text-neutral-700 mt-0.5">{n.body}</div> : null}
                  <div className="text-[11px] text-neutral-500 mt-1">{n.createdAt?.toDate?.().toLocaleString?.() || ""}</div>
                </div>
                <button onClick={() => onOpen(n)} className="inline-flex items-center gap-1 text-xs font-medium text-[#6A0F14] hover:underline">
                  Open <ExternalLink size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

