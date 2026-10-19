#!/usr/bin/env python3
"""Prata + Cera - rebuild the site log from log-entries/*.md

What it does (see "Automated notes flow" guide):
  1. Reads every .md / .txt note in log-entries/, newest first.
  2. Rewrites everything between <!-- LOG:START --> / <!-- LOG:END --> in sitemap.html.
  3. Rewrites everything between /* LOG:START */ / /* LOG:END */ in js/lang-pt.js.
  4. If (and only if) the log changed, sets the footer date on every page to today
     (Belo Horizonte time, DD.MM.YYYY).
  5. Leaves everything outside the markers untouched.

Running it twice in a row changes nothing the second time, so it is safe to run on
every deploy.

Note file name:   YYYY-MM-DD-short-slug.md or .txt   e.g. 2026-10-19-first-note.txt
Note file layout:

    Short title

    English paragraph. Links work like [this](https://example.com).

    Another English paragraph.

    ---pt---
    Título curto

    Parágrafo em português. Links: [isto](https://example.com).

    Outro parágrafo em português.

The Portuguese part mirrors the English part (title, blank line, paragraphs).
The Portuguese part is optional. Anything missing stays in English on the page.
Raw HTML (<br>, &#169;, <a href>) is allowed and is not escaped.

Usage:  python3 scripts/build_log.py [--date YYYY-MM-DD]
"""
import argparse
import datetime as dt
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
NOTES_DIR = ROOT / "log-entries"
SITEMAP = ROOT / "sitemap.html"
LANG_PT = ROOT / "js" / "lang-pt.js"
TIMEZONE = "America/Sao_Paulo"   # Belo Horizonte (MG) follows Brasilia time

HTML_START, HTML_END = "<!-- LOG:START -->", "<!-- LOG:END -->"
JS_START, JS_END = "/* LOG:START */", "/* LOG:END */"

NAME_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-(.+)\.(?:md|txt)$", re.I)
LINK_RE = re.compile(r'\[([^\]\n]+)\]\(([^)\s"]+)\)')
FOOTER_RE = re.compile(r"(Last updated</span> )\d{2}\.\d{2}\.\d{4}( ~)")
SKIP_DIRS = {".git", "dist", "node_modules", "log-entries", "_notes"}


def warn(msg, path=None):
    where = f" file={path}" if path else ""
    print(f"::warning{where}::{msg}")


def fail(msg):
    print(f"::error::{msg}")
    sys.exit(1)


# ---------- file helpers (keep the file's own line endings) ----------
def read(path):
    raw = path.read_bytes().decode("utf-8-sig")
    eol = "\r\n" if "\r\n" in raw else "\n"
    return raw.replace("\r\n", "\n"), eol


def write(path, text, eol):
    path.write_bytes(text.replace("\n", eol).encode("utf-8"))


# ---------- note parsing ----------
def inline(s):
    """Markdown-style links -> HTML links; single newlines -> <br>. Raw HTML passes through."""
    def link(m):
        text, url = m.group(1), m.group(2)
        if re.match(r"https?://", url):
            return f'<a href="{url}" target="_blank" rel="noopener noreferrer">{text}</a>'
        return f'<a href="{url}">{text}</a>'

    s = LINK_RE.sub(link, s)
    lines = [ln.rstrip() for ln in s.split("\n")]
    out = ""
    for i, ln in enumerate(lines):
        out += ln
        if i < len(lines) - 1:
            out += "\n" if ln.endswith("<br>") else "<br>\n"
    return out


def parse_part(text):
    """'Title\\n\\npara\\n\\npara' -> ('Title', ['para', 'para'])  or None if blank."""
    text = text.strip()
    if not text:
        return None
    first, _, rest = text.partition("\n")
    paras = [p.strip() for p in re.split(r"\n[ \t]*\n", rest.strip()) if p.strip()]
    return inline(first.strip()), [inline(p) for p in paras]


def load_notes():
    notes = []
    if not NOTES_DIR.is_dir():
        return notes
    for path in sorted(NOTES_DIR.iterdir()):
        if not path.is_file() or path.name.lower() in ("readme.md", "readme.txt"):
            continue
        m = NAME_RE.match(path.name)
        if not m:
            warn(f"Skipped '{path.name}': name must look like YYYY-MM-DD-slug.md (or .txt)", path)
            continue
        try:
            date = dt.date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            warn(f"Skipped '{path.name}': '{m[1]}-{m[2]}-{m[3]}' is not a real date", path)
            continue
        text, _ = read(path)
        parts = re.split(r"^[ \t]*---pt---[ \t]*$", text, maxsplit=1, flags=re.M)
        en = parse_part(parts[0])
        if en is None:
            warn(f"Skipped '{path.name}': the note is empty", path)
            continue
        pt = parse_part(parts[1]) if len(parts) > 1 else None
        if pt and len(pt[1]) != len(en[1]):
            warn(f"'{path.name}': Portuguese has {len(pt[1])} paragraph(s) but English has "
                 f"{len(en[1])}. Missing ones stay in English. (The Portuguese part needs its "
                 f"own title line first.)", path)
        key = re.sub(r"[^A-Za-z0-9]+", "-", f"{path.stem}").strip("-")
        notes.append({"date": date, "key": key, "en": en, "pt": pt, "name": path.name})
    notes.sort(key=lambda n: (n["date"], n["name"]), reverse=True)   # newest first
    return notes


# ---------- rendering ----------
def render_html(notes):
    out = []
    for n in notes:
        title, paras = n["en"]
        out.append(f'          <div class="update-item" data-date="{n["date"].isoformat()}">')
        out.append(f'            <span class="updates-date">[{n["date"]:%d.%m.%Y}]</span>')
        out.append(f'            <p class="update-text" data-i18n="{n["key"]}-t"><strong>{title}</strong></p>')
        for i, p in enumerate(paras, 1):
            out.append(f'            <p class="update-text" data-i18n="{n["key"]}-{i}">{p}</p>')
        out.append("          </div>")
        out.append("")
    return "\n".join(out).rstrip("\n")


def js_str(s):
    """Safe contents for a backtick template literal."""
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def render_js(notes):
    out = []
    for n in notes:
        if not n["pt"]:
            continue
        title, paras = n["pt"]
        out.append(f"  '{n['key']}-t': `<strong>{js_str(title)}</strong>`,")
        for i, p in enumerate(paras, 1):
            out.append(f"  '{n['key']}-{i}': `{js_str(p)}`,")
    return "\n".join(out)


def replace_between(text, start, end, body, label):
    i = text.find(start)
    j = text.find(end, i + 1) if i >= 0 else -1
    if i < 0 or j < 0:
        fail(f"Markers {start} ... {end} not found in {label}. Add them first (see the guide).")
    line_start = text.rfind("\n", 0, j) + 1
    indent = text[line_start:j] if not text[line_start:j].strip() else ""
    mid = "\n" + (body + "\n" if body else "") + indent
    return text[: i + len(start)] + mid + text[j:]


# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="override today's date (YYYY-MM-DD), for testing")
    args = ap.parse_args()
    today = (dt.date.fromisoformat(args.date) if args.date
             else dt.datetime.now(ZoneInfo(TIMEZONE)).date())

    notes = load_notes()

    pending = []
    for path, start, end, body in (
        (SITEMAP, HTML_START, HTML_END, render_html(notes)),
        (LANG_PT, JS_START, JS_END, render_js(notes)),
    ):
        if not path.exists():
            fail(f"{path.relative_to(ROOT)} not found")
        old, eol = read(path)
        new = replace_between(old, start, end, body, str(path.relative_to(ROOT)))
        if new != old:
            pending.append((path, new, eol))
    for path, new, eol in pending:      # only reached if BOTH files passed
        write(path, new, eol)
    changed = bool(pending)

    if not changed:
        print(f"Log already up to date ({len(notes)} entries). Nothing written.")
        return

    stamp = f"{today:%d.%m.%Y}"
    pages = 0
    for page in sorted(ROOT.rglob("*.html")):
        if SKIP_DIRS & set(page.relative_to(ROOT).parts):
            continue
        old, eol = read(page)
        new, n = FOOTER_RE.subn(rf"\g<1>{stamp}\g<2>", old)
        if n and new != old:
            write(page, new, eol)
            pages += 1
        elif not n:
            warn(f"No 'Last updated' footer found in {page.relative_to(ROOT)}", page)
    print(f"Log rebuilt: {len(notes)} entries. Footer date {stamp} set on {pages} page(s).")


if __name__ == "__main__":
    main()
