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
const MAX_EVENTS = 20;

function formatRelativeTime(dateStr: string, compact = false): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (compact) {
    if (diffMin < 1) return "net";
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}u`;
    if (diffDay < 7) return `${diffDay}d`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w`;
    return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" });
  }

  if (diffMin < 1) return "net";
  if (diffMin < 60) return `${diffMin}m geleden`;
  if (diffHour < 24) return `${diffHour}u geleden`;
  if (diffDay === 1) return "gisteren";
  if (diffDay < 7) return `${diffDay}d geleden`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w geleden`;
  return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" });
}

function PersonPlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  );
}

function FootballIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.5,9A6.5,6.5 0 0,0 2,15.5A6.5,6.5 0 0,0 8.5,22A6.5,6.5 0 0,0 15,15.5V13.91L22,12V9H11V11H9V9H8.5M11,2V7H9V2H11M6.35,7.28C5.68,7.44 5.04,7.68 4.43,8L2.14,4.88L3.76,3.7L6.35,7.28M17.86,4.88L16.32,7H13.85L16.24,3.7L17.86,4.88Z"/>
    </svg>
  );
}

function EuroIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.2 7A6.5 6.5 0 0 0 7 12a6.5 6.5 0 0 0 10.2 5" />
      <line x1="5" y1="10" x2="15" y2="10" />
      <line x1="5" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

const typeIcons: Record<ActivityEvent["type"], () => React.ReactNode> = {
  signup: () => <PersonPlusIcon />,
  result: () => <FootballIcon />,
  payment: () => <EuroIcon />,
  points: () => <TrendUpIcon />,
  lock: () => <LockIcon />,
  extra_answer: () => <CheckCircleIcon />,
};

export default function ActivityFeed({
  events: initialEvents,
}: {
  events: ActivityEvent[];
}) {
  const [events, setEvents] = useState(initialEvents.slice(0, PAGE_SIZE));
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(
    initialEvents.length > PAGE_SIZE && initialEvents.length <= MAX_EVENTS,
  );

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
        .limit(PAGE_SIZE + 1);

      if (data && data.length > 0) {
        const page = data.slice(0, PAGE_SIZE);
        const newTotal = events.length + page.length;
        setEvents((prev) => [...prev, ...page]);
        setHasMore(data.length > PAGE_SIZE && newTotal < MAX_EVENTS);
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
      <div className="glass-card-subtle overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full">
          <thead>
            <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left font-normal px-5 py-3 w-12" />
              <th className="text-left font-normal py-3">Activiteit</th>
              <th className="text-right font-normal px-5 py-3 w-36">Wanneer</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-3 text-cb-blue">
                  {typeIcons[event.type]()}
                </td>
                <td className="py-3 text-sm text-gray-200">
                  {event.message}
                </td>
                <td className="text-right px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {formatRelativeTime(event.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center px-4 py-3 gap-3"
            >
              <span className="text-cb-blue shrink-0">
                {typeIcons[event.type]()}
              </span>
              <span className="text-[12px] text-gray-200 flex-1 min-w-0">
                {event.message}
              </span>
              <span className="text-[10px] text-gray-500 shrink-0">
                {formatRelativeTime(event.created_at)}
              </span>
            </div>
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full px-5 py-3 text-xs text-gray-500 hover:text-gray-400 border-t border-white/[0.04] transition-colors disabled:opacity-50"
          >
            {loading ? "Laden..." : "Laad meer"}
          </button>
        )}
      </div>
    </section>
  );
}
