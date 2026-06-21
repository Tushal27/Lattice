"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { TYPES, type EntryType, type FieldDef } from "@/lib/types";
import { accent, cn } from "@/lib/utils";

export interface EntryFormProps {
  type: EntryType;
  projects: { id: string; title: string }[];
  /** Present when editing an existing entry. */
  initial?: {
    id: string;
    values: Record<string, string>;
    tags: string[];
    projectId: string | null;
  };
  /** Prefill values for a brand-new entry (e.g. from AI quick-capture). */
  defaultValues?: Record<string, string>;
  defaultTags?: string[];
  showReview?: boolean;
}

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 backdrop-blur-sm transition-colors focus:border-violet-400/40 focus:bg-white/[0.07] focus:outline-none focus:ring-2";

export function EntryForm({ type, projects, initial, defaultValues, defaultTags, showReview }: EntryFormProps) {
  const router = useRouter();
  const cfg = TYPES[type];
  const a = accent(cfg.accent);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const v = { ...(initial?.values ?? defaultValues ?? {}) };
    // A select with no blank option must default to its first option, so what's
    // shown matches what's saved (e.g. an investment defaults to "monthly").
    for (const f of cfg.fields) {
      if (f.kind === "select" && f.options && !f.options.includes("") && !v[f.key]) v[f.key] = f.options[0];
    }
    return v;
  });
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? defaultTags?.join(", ") ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const visibleFields = cfg.fields.filter((f) => (f.review ? showReview : true));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const titleField = cfg.fields.find((f) => f.key === "title");
    if (titleField && !values.title?.trim()) {
      setError("Please give this a title.");
      return;
    }
    setSaving(true);
    const payload = { ...values, type, tags, projectId: projectId || null };
    const editing = Boolean(initial);
    const res = await fetch(editing ? `/api/entries/${initial!.id}` : "/api/entries", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const entry = await res.json();
    toast(editing ? "Changes saved" : `${cfg.label} captured`);
    router.push(`/entry/${editing ? initial!.id : entry.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {visibleFields.map((field) => (
        <FieldInput key={field.key} field={field} value={values[field.key] ?? ""} onChange={set} ring={a.ring} />
      ))}

      {type !== "project" && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Project (optional)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cn(inputBase, a.ring)}>
            <option value="">— none —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Attach this to a project so its story accumulates.</p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">Tags</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comma, separated, tags"
          className={cn(inputBase, a.ring)}
        />
        <p className="mt-1 text-xs text-zinc-500">Tags weave entries together across areas.</p>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="press glow-violet rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : initial ? "Save changes" : `Save ${cfg.label}`}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="press rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  ring,
}: {
  field: FieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
  ring: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-300">
        {field.label}
        {field.review && <span className="ml-2 text-xs font-normal text-amber-400/80">review</span>}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={cn(inputBase, ring, "resize-y")}
        />
      ) : field.kind === "select" ? (
        <select value={value} onChange={(e) => onChange(field.key, e.target.value)} className={cn(inputBase, ring)}>
          {!field.options?.includes("") && <option value="">— select —</option>}
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "" ? "— none —" : opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className={cn(inputBase, ring)}
        />
      )}
      {field.help && <p className="mt-1 text-xs text-zinc-500">{field.help}</p>}
    </div>
  );
}
