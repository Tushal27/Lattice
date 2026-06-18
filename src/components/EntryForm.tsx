"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  showReview?: boolean;
}

const inputBase =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-transparent focus:outline-none focus:ring-2";

export function EntryForm({ type, projects, initial, showReview }: EntryFormProps) {
  const router = useRouter();
  const cfg = TYPES[type];
  const a = accent(cfg.accent);

  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
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
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : initial ? "Save changes" : `Save ${cfg.label}`}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
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
