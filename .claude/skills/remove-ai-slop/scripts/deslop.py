#!/usr/bin/env python3
"""deslop.py — flag candidate AI-slop patterns in prose and source files.

This reports CANDIDATES, not verdicts. Every hit needs human/model judgment, and a
clean report does not mean the text is good: the worst slop (fluent text that says
nothing) is invisible to regex. Never auto-replace from this output.

Usage:
    deslop.py FILE [FILE ...]        scan files ('-' reads stdin)
    deslop.py --stats FILE           structural metrics only
    deslop.py --json FILE            machine-readable output
    deslop.py --mode code FILE       comment/docstring/ceremony tells in source
    deslop.py --only frame,hedge     restrict categories
    deslop.py --min-severity 2       hide low-severity noise
    deslop.py --include-code FILE    also scan fenced code blocks in markdown

Exit status: 1 if anything was flagged (use --exit-zero to always exit 0).
"""

import argparse
import json
import os
import re
import sys
from statistics import pstdev

# ---------------------------------------------------------------------------
# Pattern table.  (id, category, severity, regex, hint)
# severity: 3 = near-diagnostic, 2 = strong, 1 = weak on its own
# ---------------------------------------------------------------------------

W = r"\b"


def _p(pat, flags=re.I):
    return re.compile(pat, flags)


PROSE_PATTERNS = [
    # -- sentence frames: the highest-signal tells ---------------------------
    ("frame.not-just", "frame", 3, _p(r"\b(it'?s|this is|that'?s)\s+not\s+just\b"),
     "Cut the frame, keep the payload."),
    ("frame.isnt-a-its-a", "frame", 3, _p(r"\bis(n'?t| not)\s+(just\s+)?an?\s+\w+[.,;]?\s*it'?s\s+an?\b"),
     "False-profundity antithesis. Cut."),
    ("frame.more-than-just", "frame", 3, _p(r"\bmore than just\b"),
     "Cut; state what it is."),
    ("frame.not-about", "frame", 3, _p(r"\bis(n'?t| not) about\b[^.]{0,60}\bit'?s about\b"),
     "Antithesis frame. Cut."),
    ("frame.heres-the-thing", "frame", 3, _p(r"\bhere'?s the (thing|kicker|catch|secret)\b"),
     "Setup-and-reveal tic. Cut."),
    ("frame.thats-where", "frame", 3, _p(r"\bthat'?s where\b[^.]{0,40}\bcomes? in\b"),
     "Fine once if a gap was set up; usually cut."),
    ("frame.todays-world", "frame", 3,
     _p(r"\bin today'?s\s+(\w+\s+){0,2}(world|landscape|environment|market|era|age)\b"),
     "Ceremonial opener. Cut the sentence."),
    ("frame.whether-youre", "frame", 3, _p(r"\bwhether you'?re an?\b[^.]{0,60}\bor\b"),
     "Both-audiences opener. Cut."),
    ("frame.at-its-core", "frame", 2, _p(r"\bat its core\b"),
     "Cut; lead with the actual claim."),
    ("frame.lets-dive", "frame", 3, _p(r"\blet'?s\s+(dive|explore|unpack|take a look|jump)\b"),
     "Cut."),
    ("frame.the-truth-is", "frame", 2, _p(r"\bthe truth is\b"), "Cut."),
    ("frame.rhetorical-q", "frame", 2, _p(r"\bhave you ever (wondered|thought about|noticed)\b"),
     "Rhetorical-question opener. Cut."),
    ("frame.in-conclusion", "frame", 3, _p(r"^\s*(in conclusion|in summary|to sum up|to wrap up)\b", re.I | re.M),
     "Ceremonial closer. Cut unless the piece is genuinely long."),
    ("frame.remember-homily", "frame", 2, _p(r"^\s*remember[,:]", re.I | re.M),
     "Closing homily. Cut."),
    ("frame.hope-this-helps", "frame", 3,
     _p(r"\b(i hope this helps|happy coding|great question|you'?re absolutely right)\b"),
     "Chat residue. Cut."),
    ("frame.by-doing-x", "frame", 1, _p(r"\bby (doing|following|implementing) (this|these|the above)\b"),
     "Closer boilerplate. Cut."),
    ("frame.key-is-to", "frame", 2, _p(r"\bthe key is to\b"), "Non-recommendation. Commit to one."),
    ("frame.when-it-comes-to", "frame", 2, _p(r"\bwhen it comes to\b"), "Filler. Rewrite without it."),
    ("frame.plays-a-role", "frame", 2,
     _p(r"\bplays? an? (crucial|vital|key|important|pivotal|significant) role\b"),
     "Inflation. Say what it does."),
    ("frame.testament", "frame", 3,
     _p(r"\b(serves? as|stands? as|is|are|remains?) a (testament|reminder|shining example)\b"),
     "Cut."),
    ("frame.powerful-tool", "frame", 2, _p(r"\bis a powerful (tool|framework|library|solution)\b"),
     "Cut; describe behavior."),
    ("frame.not-only", "frame", 1, _p(r"\bnot only\b[^.]{0,80}\bbut also\b"),
     "Parallelism tic. Often two plain sentences."),
    ("frame.enter-x", "frame", 2, _p(r"^\s*enter[:,]\s+\w", re.I | re.M), "Cut."),

    # -- hedging / filler ----------------------------------------------------
    ("hedge.worth-noting", "hedge", 3,
     _p(r"\bit'?s (worth (noting|mentioning)|important to (note|remember|understand))\b"),
     "Delete the preamble; keep the claim."),
    ("hedge.keep-in-mind", "hedge", 2, _p(r"\b(keep|bear) in mind that\b"), "Delete preamble."),
    ("hedge.that-said", "hedge", 1, _p(r"^\s*(that said|with that in mind|as mentioned earlier)\b", re.I | re.M),
     "Usually deletable."),
    ("hedge.may-potentially", "hedge", 3, _p(r"\b(may|might|could) (potentially|possibly)\b"),
     "Double hedge. Keep at most one."),
    ("hedge.can-help-to", "hedge", 2, _p(r"\b(can|will) help (to )?\w+"), "Say it does the thing."),
    ("hedge.in-order-to", "filler", 2, _p(r"\bin order to\b"), '→ "to"'),
    ("hedge.due-to-fact", "filler", 3, _p(r"\bdue to the fact that\b"), '→ "because"'),
    ("hedge.wide-variety", "filler", 2, _p(r"\ba (wide|broad) (variety|range) of\b"), '→ "many" or a number'),
    ("hedge.at-this-time", "filler", 2, _p(r"\bat this (point in time|juncture)\b"), '→ "now"'),
    ("hedge.intensifier", "filler", 1,
     _p(r"\b(very|really|truly|quite|incredibly|absolutely|extremely|highly)\s+\w+"),
     "Empty intensifier. Delete or quantify."),
    ("hedge.significantly", "filler", 2, _p(r"\b(significantly|dramatically|substantially|drastically)\b"),
     "Unquantified magnitude. Give the number or cut."),
    ("hedge.connective", "filler", 1,
     _p(r"^\s*(moreover|furthermore|additionally|notably|importantly|ultimately|essentially|"
        r"fundamentally|arguably|indeed)\b", re.I | re.M),
     "Connective tic. Usually deletable."),

    # -- vocabulary ----------------------------------------------------------
    ("vocab.elevation", "vocab", 2,
     _p(W + r"(delve[sd]?|tapestry|realm|embark(ed|ing)?|unlock(s|ed|ing)?|elevat(e|es|ing|ed)|"
       r"empower(s|ed|ing)?|foster(s|ed|ing)?|cultivat(e|es|ing|ed)|illuminat(e|es|ing|ed)|"
       r"underscor(e|es|ing|ed)|harness(es|ed|ing)?|leverag(e|es|ing|ed)|spearhead(s|ed|ing)?|"
       r"garner(s|ed|ing)?|resonat(e|es|ing|ed)|showcas(e|es|ing|ed))" + W),
     "Elevated verb. Usually a plainer verb exists."),
    ("vocab.superlative", "vocab", 2,
     _p(W + r"(pivotal|paramount|invaluable|profound|unwavering|seamless(ly)?|robust|comprehensive|"
       r"holistic|intricate|nuanced|meticulous(ly)?|vibrant|bustling|myriad|plethora|versatile|"
       r"cutting-edge|state-of-the-art|best-in-class|game-?chang(er|ing)|world-class|next-level)" + W),
     "Empty superlative. Delete, or replace with the fact it stands in for."),
    ("vocab.consultancy", "vocab", 3,
     _p(W + r"(ever-evolving|fast-paced|rapidly changing|digital age|deep dive|key takeaway[s]?|"
       r"actionable insight[s]?|low-hanging fruit|move the needle|north star|value-add)" + W),
     "Consultancy filler. Cut."),
    ("vocab.journey", "vocab", 1, _p(W + r"(journey|landscape|navigate|navigating)" + W),
     "Fine literally; a tell when metaphorical."),

    # -- shape ---------------------------------------------------------------
    ("shape.bold-bullet", "shape", 2, _p(r"^\s*[-*+]\s+\*\*[^*]{1,40}\*\*\s*[—:-]", re.M),
     "Bold lead-in bullet. Fine for a glossary, a tell otherwise."),
    ("shape.emoji-heading", "shape", 3,
     _p(r"^#{1,6}\s.*[\U0001F300-\U0001FAFF☀-➿⭐]", re.M),
     "Emoji in heading. Delete unless the repo does this."),
    ("shape.emdash-pair", "shape", 1, _p(r"—"), "Counted for density; see structural metrics."),
]

CODE_PATTERNS = [
    ("code.narrating-comment", "code", 3,
     _p(r"^\s*(#|//)\s*(initialize|increment|decrement|loop (over|through)|iterate over|"
        r"get the|set the|return the|create an?|define an?|check if|add the|append the|"
        r"call the|declare|instantiate|import the)\b", re.I | re.M),
     "Comment restates the code. Delete."),
    ("code.banner", "code", 3, _p(r"^\s*(#|//|/\*)\s*[=*_~-]{6,}", re.M),
     "Section banner. Delete; split the file if it needs one."),
    ("code.changelog-comment", "code", 2,
     _p(r"^\s*(#|//)\s*(added|fixed|changed|updated|removed)\s+(in\s+)?v?\d", re.I | re.M),
     "Git already records this. Delete."),
    ("code.todo-errors", "code", 2,
     _p(r"(#|//)\s*TODO:?\s*(add|implement|handle)\s+(proper\s+)?error", re.I),
     "Left-behind TODO for the actual ask."),
    ("code.bare-except-pass", "code", 3,
     _p(r"except(\s+\w[\w.]*)?(\s+as\s+\w+)?\s*:\s*(\n\s*(#[^\n]*\n\s*)?)?pass\b"),
     "Swallows real bugs. Nearly always wrong — flag before removing (behavior change)."),
    ("code.broad-except", "code", 2, _p(r"except\s+(Exception|BaseException)\s*:"),
     "Justify or narrow. Fine at a trust boundary."),
    ("code.redundant-none-len", "code", 2,
     _p(r"if\s+\w+\s+is not None\s+and\s+len\(\s*\w+\s*\)\s*[>!]=?\s*0"),
     'Collapse to "if x:"'),
    ("code.emoji-output", "code", 3,
     _p(r"(print|console\.log|logger?\.\w+|fmt\.Print\w*)\s*\([^)\n]*"
        r"[\U0001F300-\U0001FAFF☀-➿✅❌✨⭐]"),
     "Emoji in output. Log lines get grepped at 3am."),
    ("code.ceremony-class", "code", 2,
     _p(r"^\s*(class|type|interface)\s+\w*(Manager|Helper|Utils?|Handler|Wrapper|Factory)\b", re.M),
     "Check for a single implementation / stateless wrapper; inline it."),
    ("code.type-restating-name", "code", 2,
     _p(W + r"\w+_(list|dict|array|string|str|map|obj|object)\b"),
     "Name restates the type. Use a domain word."),
    ("code.docstring-echo", "code", 1,
     _p(r'"""\s*(Get|Set|Return|Create|Initialize|Process|Handle)s?\s+(the|a)\s[\w\s]{1,40}\.?\s*"""'),
     "Docstring restates the signature. Cut unless it's public API."),
    ("code.redundant-else", "code", 1,
     _p(r"^(\s*)(return|raise|continue|break)\b[^\n]*\n\1?\s*(else|} else)\s*[:{]", re.M),
     "Redundant else after return/raise. Dedent the branch."),
    ("code.placeholder-name", "code", 1, _p(W + r"(tmp|temp|data|result|item|helper|foo|bar)\d*" + W),
     "Placeholder name where a domain word exists."),
    ("code.assert-not-none", "code", 2, _p(r"assert\s+\w+\s+is not None\s*$", re.M),
     "Passes for almost any bug. Assert the actual value."),
]

CATEGORIES = ["frame", "hedge", "filler", "vocab", "shape", "code"]
SEV_NAME = {3: "high", 2: "med", 1: "low"}

EMOJI_RX = re.compile(r"[\U0001F300-\U0001FAFF☀-➿✅❌✨⭐]")
SENT_SPLIT = re.compile(r"(?<=[.!?])[\"')\]]*\s+")
WORD_RX = re.compile(r"[A-Za-z][A-Za-z'-]*")
TRIAD_RX = re.compile(r"\b[\w-]+,\s+[\w-]+,?\s+and\s+[\w-]+\b")
BULLET_RX = re.compile(r"^\s*([-*+]|\d+\.)\s+")
HEADING_RX = re.compile(r"^#{1,6}\s+\S", re.M)

CODE_EXT = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".c", ".h", ".cc",
    ".cpp", ".hpp", ".rb", ".php", ".swift", ".kt", ".cs", ".sh", ".bash", ".zsh",
    ".sql", ".scala", ".lua", ".pl", ".r", ".m", ".mm",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def mask_code_blocks(text):
    """Blank out fenced blocks and inline spans, preserving offsets/line numbers."""
    chars = list(text)
    for m in re.finditer(r"^(\s*)(```|~~~).*?(\n)(.*?)(^\s*\2.*?$|\Z)",
                         text, re.S | re.M):
        for i in range(m.start(), min(m.end(), len(chars))):
            if chars[i] != "\n":
                chars[i] = " "
    masked = "".join(chars)
    out = []
    for line in masked.split("\n"):
        out.append(re.sub(r"`[^`\n]*`", lambda m: " " * len(m.group(0)), line))
    return "\n".join(out)


def line_col(text, offset):
    line = text.count("\n", 0, offset) + 1
    col = offset - (text.rfind("\n", 0, offset) + 1) + 1
    return line, col


def excerpt(text, start, end, width=72):
    line_start = text.rfind("\n", 0, start) + 1
    line_end = text.find("\n", end)
    line_end = len(text) if line_end == -1 else line_end
    s = text[line_start:line_end].strip()
    if len(s) > width:
        rel = max(0, start - line_start - 20)
        s = ("…" if rel else "") + s[rel:rel + width] + "…"
    return s


def prose_em_dashes(text):
    """Count em-dashes used *in prose*.

    Table cells and definition-style bullet labels ("- **Term** — meaning") use the
    dash structurally, not rhetorically; counting them punishes well-formed reference
    docs and hides real overuse in the surrounding paragraphs.
    """
    count = 0
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("|") or stripped.startswith(">"):
            continue
        line = re.sub(r"^\s*([-*+]|\d+\.)\s+(\*\*[^*]+\*\*|`[^`]+`)\s*—", "", line)
        count += line.count("—") + len(re.findall(r"(?<=\w)\s--\s(?=\w)", line))
    return count


def sentences(text):
    plain = re.sub(r"^\s*([-*+]|\d+\.|#{1,6})\s+", "", text, flags=re.M)
    return [s.strip() for s in SENT_SPLIT.split(plain) if len(WORD_RX.findall(s)) >= 2]


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------

def scan_patterns(text, patterns, only, min_sev):
    findings = []
    for pid, cat, sev, rx, hint in patterns:
        if sev < min_sev or (only and cat not in only):
            continue
        for m in rx.finditer(text):
            if not m.group(0).strip():
                continue
            line, col = line_col(text, m.start())
            findings.append({
                "id": pid, "category": cat, "severity": sev,
                "line": line, "column": col,
                "match": m.group(0).strip()[:80],
                "excerpt": excerpt(text, m.start(), m.end()),
                "hint": hint,
            })
    findings.sort(key=lambda f: (f["line"], f["column"]))
    return findings


def structural_metrics(text, raw=None):
    """Whole-document shape checks. Returns (metrics, list of flagged notes).

    `text` has code blocks masked; `raw` is the original. Density checks that would
    be distorted by masking (heading spacing) measure against `raw`.
    """
    raw = text if raw is None else raw
    words = WORD_RX.findall(text)
    n_words = len(words)
    notes = []
    m = {"words": n_words}
    if n_words < 60:
        return m, notes

    per_k = 1000.0 / n_words

    m["em_dash_per_1k"] = round(prose_em_dashes(text) * per_k, 1)
    if m["em_dash_per_1k"] > 5.0:
        notes.append(("em-dash density", f"{m['em_dash_per_1k']}/1k words (>5 reads as machine-written)",
                      "Cut the ones not doing real work — to periods, not semicolons."))

    triads = len(TRIAD_RX.findall(text))
    m["triads_per_1k"] = round(triads * per_k, 1)
    if triads >= 3 and m["triads_per_1k"] > 3.0:
        notes.append(("rule of three", f"{triads} 'X, Y, and Z' triads",
                      "Break some to two or four items, or unequal lengths."))

    sents = sentences(text)
    lens = [len(WORD_RX.findall(s)) for s in sents]
    m["sentences"] = len(sents)
    if len(lens) >= 8:
        sd = pstdev(lens)
        m["sentence_len_mean"] = round(sum(lens) / len(lens), 1)
        m["sentence_len_stdev"] = round(sd, 1)
        if sd < 6.0:
            notes.append(("uniform rhythm",
                          f"sentence length stdev {sd:.1f} (mean {m['sentence_len_mean']})",
                          "Vary it: let one run long and the next be four words."))

    lines = text.split("\n")
    nonempty = [ln for ln in lines if ln.strip()]
    bullets = [ln for ln in nonempty if BULLET_RX.match(ln)]
    if nonempty:
        m["bullet_ratio"] = round(len(bullets) / len(nonempty), 2)
        if len(bullets) >= 8 and m["bullet_ratio"] > 0.5:
            notes.append(("list-ification", f"{int(m['bullet_ratio'] * 100)}% of lines are bullets",
                          "If the items are sentences that flow, it was a paragraph."))

    # Measured against raw lines, not masked words: a doc that is mostly code
    # samples is not header-inflated just because masking removed its prose.
    heads = HEADING_RX.findall(raw)
    raw_lines = len([ln for ln in raw.split("\n") if ln.strip()])
    m["headings"] = len(heads)
    if len(heads) >= 6 and raw_lines / len(heads) < 6:
        m["lines_per_heading"] = round(raw_lines / len(heads), 1)
        notes.append(("header inflation",
                      f"{len(heads)} headings over {raw_lines} content lines",
                      "Headers are for navigation, not pacing."))

    paras = [p for p in re.split(r"\n\s*\n", text)
             if p.strip() and not BULLET_RX.match(p.strip()) and not p.lstrip().startswith("#")]
    counts = [len(sentences(p)) for p in paras]
    counts = [c for c in counts if c]
    if len(counts) >= 4 and len(set(counts)) == 1 and counts[0] >= 3:
        notes.append(("uniform paragraphs", f"{len(counts)} paragraphs, all exactly {counts[0]} sentences",
                      "Vary. One-line paragraphs carry emphasis."))

    emoji = len(EMOJI_RX.findall(text))
    if emoji:
        m["emoji"] = emoji
        notes.append(("emoji", f"{emoji} emoji", "Delete unless surrounding files use them."))

    if n_words >= 150 and not re.search(r"\d", text):
        notes.append(("no specifics", "no digits anywhere in the document",
                      "Strongest slop signal: no numbers, versions, or measurements."))

    return m, notes


def scan_file(path, args):
    if path == "-":
        text, name, ext = sys.stdin.read(), "<stdin>", ""
    else:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        name, ext = path, os.path.splitext(path)[1].lower()

    mode = args.mode
    if mode == "auto":
        mode = "code" if ext in CODE_EXT else "prose"

    if mode == "code":
        patterns, scan_text = CODE_PATTERNS, text
    else:
        patterns = PROSE_PATTERNS
        scan_text = text if args.include_code else mask_code_blocks(text)

    only = set(args.only.split(",")) if args.only else None
    findings = [] if args.stats else scan_patterns(scan_text, patterns, only, args.min_severity)
    metrics, notes = structural_metrics(scan_text, text) if mode == "prose" else ({}, [])
    return {"file": name, "mode": mode, "findings": findings,
            "metrics": metrics, "structure": [
                {"name": n, "detail": d, "hint": h} for n, d, h in notes]}


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def render(results, args):
    total = 0
    for r in results:
        hits, notes = r["findings"], r["structure"]
        total += len(hits) + len(notes)
        if not hits and not notes:
            continue
        print(f"\n{r['file']}  [{r['mode']}]")
        for n in notes:
            print(f"  {'structure':>10}  {n['name']}: {n['detail']}")
            print(f"  {'':>10}  → {n['hint']}")
        for f in hits:
            loc = f"{f['line']}:{f['column']}"
            print(f"  {loc:>10}  {SEV_NAME[f['severity']]:<4} {f['category']:<6} {f['excerpt']}")
            print(f"  {'':>10}  → {f['hint']}  [{f['id']}]")
    if total:
        print(f"\n{total} candidate(s). These are candidates, not verdicts — "
              f"apply judgment, never blind find-and-replace.")
    else:
        print("No pattern hits. Note: content-level slop (fluent but empty) is not "
              "detectable here — read it yourself.")
    return total


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--mode", choices=["auto", "prose", "code"], default="auto")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--stats", action="store_true", help="structural metrics only")
    ap.add_argument("--only", help="comma-separated categories: " + ",".join(CATEGORIES))
    ap.add_argument("--min-severity", type=int, default=1, choices=[1, 2, 3])
    ap.add_argument("--include-code", action="store_true",
                    help="also scan fenced code blocks in markdown")
    ap.add_argument("--exit-zero", action="store_true")
    args = ap.parse_args()

    results, errors = [], 0
    for path in args.files:
        try:
            results.append(scan_file(path, args))
        except (OSError, UnicodeDecodeError) as exc:
            print(f"{path}: {exc}", file=sys.stderr)
            errors += 1

    if args.json:
        json.dump(results, sys.stdout, indent=2)
        print()
        total = sum(len(r["findings"]) + len(r["structure"]) for r in results)
    else:
        total = render(results, args)

    if errors:
        sys.exit(2)
    sys.exit(0 if args.exit_zero or not total else 1)


if __name__ == "__main__":
    main()
