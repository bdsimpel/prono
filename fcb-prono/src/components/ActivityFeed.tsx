"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ActivityEvent {
  id: number;
  type: "signup" | "result" | "payment" | "points" | "lock" | "extra_answer";
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const PAGE_SIZE = 5;

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "net";
  if (diffMin < 60) return `${diffMin}m geleden`;
  if (diffHour < 24) return `${diffHour}u geleden`;
  if (diffDay === 1) return "gisteren";
  if (diffDay < 7) return `${diffDay}d geleden`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w geleden`;
  return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

const typeConfig: Record<ActivityEvent["type"], { dot: string }> = {
  signup: { dot: "bg-green-500" },
  result: { dot: "bg-cb-blue" },
  payment: { dot: "bg-cb-gold" },
  points: { dot: "bg-purple-500" },
  lock: { dot: "bg-red-500" },
  extra_answer: { dot: "bg-orange-500" },
};

export default function ActivityFeed({
  events: initialEvents,
}: {
  events: ActivityEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialEvents.length >= PAGE_SIZE);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const lastEvent = events[events.length - 1];
      const { data } = await supabase
        .from("activity_events")
        .select("*")
        .neq("type", "points")
        .order("created_at", { ascending: false })
        .lt("created_at", lastEvent.created_at)
        .limit(PAGE_SIZE);

      if (data && data.length > 0) {
        setEvents((prev) => [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (events.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 pb-16">
      <div className="mb-6">
        <h2 className="heading-display text-3xl md:text-4xl text-white">
          ACTIVITEIT
        </h2>
      </div>
      <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
        {events.map((event, i) => {
          const config = typeConfig[event.type];
          return (
            <div
              key={event.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i !== events.length - 1 || hasMore
                  ? "border-b border-white/5"
                  : ""
              }`}
            >
              <span
                className={`shrink-0 w-2 h-2 rounded-full ${config.dot}`}
              />
              <span className="text-sm text-gray-300 flex-1 min-w-0 truncate">
                {event.message}
              </span>
              <span className="text-xs text-gray-600 shrink-0">
                {formatRelativeTime(event.created_at)}
              </span>
            </div>
          );
        })}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full px-4 py-2.5 text-xs text-gray-500 hover:text-gray-400 transition-colors disabled:opacity-50"
          >
            {loading ? "Laden..." : "Laad meer"}
          </button>
        )}
      </div>
    </section>
  );
}
