"use client";

import { Check, ExternalLink, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function ModerationQueue({ reports, viewer }) {
  const router = useRouter();

  const resolve = async (report, remove) => {
    const supabase = createClient();
    const targetTable = report.post_id ? "posts" : "comments";
    const targetId = report.post_id || report.comment_id;
    if (remove) {
      await supabase.from(targetTable).update({ status: "removed" }).eq("id", targetId);
      await supabase.from("moderation_actions").insert({
        moderator_id: viewer.id,
        post_id: report.post_id,
        comment_id: report.comment_id,
        action: "remove",
        reason: report.reason
      });
    }
    await supabase.from("reports").update({
      status: "resolved",
      resolved_at: new Date().toISOString()
    }).eq("id", report.id);
    router.refresh();
  };

  return (
    <div className="moderation-queue">
      {reports.map((report) => (
        <article className="moderation-item glass" key={report.id}>
          <div className="moderation-icon"><ShieldAlert size={19} /></div>
          <div>
            <span>{report.reason.replaceAll("_", " ")}</span>
            <strong>Reported by {report.reporter?.display_name || report.reporter?.username}</strong>
            {report.details && <p>{report.details}</p>}
          </div>
          <div className="moderation-actions">
            {report.post_id && <Link href={`/community/${report.post_id}`}><ExternalLink size={15} /> Review</Link>}
            <button onClick={() => resolve(report, false)}><Check size={15} /> Dismiss</button>
            <button className="danger" onClick={() => resolve(report, true)}><Trash2 size={15} /> Remove</button>
          </div>
        </article>
      ))}
      {!reports.length && <div className="moderation-empty glass"><Check size={22} /><strong>The queue is clear.</strong></div>}
    </div>
  );
}
