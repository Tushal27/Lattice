// A deliberately small markdown renderer for AI/reflection output. It handles the
// subset we actually produce — headings, bold, italic, inline code, bullet and
// numbered lists, GFM tables, and paragraphs — and escapes HTML first so model
// output can't inject markup.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

// Split a table row "| a | b |" into trimmed cells, tolerating missing edge pipes.
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

// A GFM separator row: every cell is dashes with optional alignment colons.
function isSeparatorRow(line: string): boolean {
  if (!line.includes("|") && !line.includes("-")) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, "")));
}

function looksLikeRow(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && t.includes("|");
}

function renderTable(header: string[], rows: string[][]): string {
  const cols = header.length;
  const head = header.map((c) => `<th>${inline(c)}</th>`).join("");
  const body = rows
    .map((r) => {
      const cells = Array.from({ length: cols }, (_, i) => `<td>${inline(r[i] ?? "")}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function toHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let listTag: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listTag) {
      out.push(`</${listTag}>`);
      listTag = null;
    }
  };
  const openList = (tag: "ul" | "ol") => {
    if (listTag !== tag) {
      closeList();
      out.push(`<${tag}>`);
      listTag = tag;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      i++;
      continue;
    }

    // Table: a row line immediately followed by a separator row.
    if (looksLikeRow(trimmed) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      closeList();
      const header = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && looksLikeRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, rows));
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 3);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^([-*_])\1{2,}$/.test(trimmed.replace(/\s/g, ""))) {
      closeList();
      out.push("<hr />");
      i++;
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      openList("ul");
      out.push(`<li>${inline(bullet[1])}</li>`);
      i++;
      continue;
    }

    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (numbered) {
      openList("ol");
      out.push(`<li>${inline(numbered[1])}</li>`);
      i++;
      continue;
    }

    closeList();
    out.push(`<p>${inline(trimmed)}</p>`);
    i++;
  }
  closeList();
  return out.join("");
}

export function Markdown({ children }: { children: string }) {
  return <div className="prose-lattice" dangerouslySetInnerHTML={{ __html: toHtml(children) }} />;
}
