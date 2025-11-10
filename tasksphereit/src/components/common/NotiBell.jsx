// src/components/common/NotiBell.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { subscribeNotifications } from "../../services/notifications";
import { getUserTeams } from "../../services/events";
import { useNavigate } from "react-router-dom";

export default function NotiBell({ role, to }) {
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

  const unread = useMemo(
    () => items.filter((n) => !Array.isArray(n.readBy) || !n.readBy.includes(uid)).length,
    [items, uid]
  );

  return (
    <button
      className="relative p-2 rounded-full hover:bg-neutral-100 cursor-pointer"
      onClick={() => navigate(to || "/")}
      title="Notifications"
      aria-label="Notifications"
    >
      <Bell className="w-6 h-6 text-[#6A0F14]" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] leading-[16px] text-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

