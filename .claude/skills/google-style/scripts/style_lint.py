#!/usr/bin/env python3
"""style_lint.py — flag prose that departs from the Google developer
documentation style guide (developers.google.com/style).

Reports CANDIDATES, not verdicts. A passive-voice hit that reads better passive
stays passive; a long sentence carrying one idea is fine. Never auto-replace
from this output.

Usage:
    style_lint.py FILE [FILE ...]     scan files ('-' reads stdin)
    style_lint.py --json FILE         machine-readable output
    style_lint.py --only wordlist     restrict categories
    style_lint.py --min-severity 2    hide low-severity noise
    style_lint.py --stats FILE        document metrics only
    style_lint.py --max-sentence 30   change the long-sentence threshold

Categories: wordlist, filler, voice, person, structure, format, inclusive, tone

Structure checks are positional rather than regex: sentence length (lines are
joined into blocks first, since markdown prose is hard-wrapped), title-case and
'-ing' headings, stacked headings, and mixed terminal punctuation inside one
bulleted list.

Exit status: 1 if anything was flagged (use --exit-zero to always exit 0).
"""

import argparse
import json
import os
import re
import sys

# ---------------------------------------------------------------------------
# Pattern table: (id, category, severity, regex, hint)
# severity: 3 = guide calls it an error, 2 = strong, 1 = context-dependent
# ---------------------------------------------------------------------------


def _p(pat, flags=re.I):
    return re.compile(pat, flags)


W = r"\b"

PATTERNS = [
    # -- inclusive language: the guide treats these as errors ----------------
    ("inclusive.denylist", "inclusive", 3,
     _p(W + r"(black|white|gray|grey)list(s|ed|ing)?" + W),
     "→ denylist / allowlist / provisional list"),
    ("inclusive.primary", "inclusive", 3,
     _p(W + r"(master|slave)s?" + W + r"(?![\s-]*(branch|of science|of arts))"),
     "→ primary/replica, controller/worker, leader/follower"),
    ("inclusive.grandfathered", "inclusive", 3, _p(W + r"grandfather(ed|ing)?" + W),
     "→ legacy, exempt, exception"),
    ("inclusive.guys", "inclusive", 3, _p(W + r"(you )?guys" + W),
     "→ everyone, folks, team"),
    ("inclusive.generic-he", "inclusive", 2,
     _p(W + r"(he|his|him|she|her)\s+(or|/)\s*(she|he|him|her|his)" + W),
     "→ singular they/their"),
    ("inclusive.mitm", "inclusive", 3, _p(r"man[- ]in[- ]the[- ]middle"),
     "→ person-in-the-middle (PITM), on-path attacker"),
    ("inclusive.sanity", "inclusive", 3, _p(W + r"sanity[- ]check(s|ed|ing)?" + W),
     "→ validity check, confidence check"),
    ("inclusive.dummy", "inclusive", 2, _p(W + r"dummy\s+(value|data|variable|file)"),
     "→ placeholder, sample"),
    ("inclusive.figurative-disability", "inclusive", 2,
     _p(W + r"(crazy|insane|lame|cripple[sd]?|dumb|blind to|tone[- ]deaf)" + W),
     "Say what actually happens instead."),
    ("inclusive.ninja", "inclusive", 2, _p(W + r"(ninja|rockstar|rock star|guru)s?" + W),
     "→ expert, specialist"),
    ("inclusive.native", "inclusive", 1, _p(W + r"native\s+(app|support|feature|code)"),
     "'native' is ambiguous → built-in, platform-specific"),

    # -- word list: delete outright ------------------------------------------
    ("wordlist.just", "wordlist", 2, _p(W + r"just" + W),
     "Filler. Delete, or write 'only' if that's the meaning."),
    ("wordlist.simply", "wordlist", 3,
     _p(W + r"(simply|easily|obviously|trivially|of course|needless to say)" + W),
     "Tells the reader how hard it should feel. Delete."),
    ("wordlist.please", "wordlist", 2, _p(W + r"please" + W),
     "Not needed in a procedure. Delete."),
    ("wordlist.currently", "wordlist", 2, _p(W + r"(currently|at present|at this time)" + W),
     "Present tense already means now. Delete."),
    ("wordlist.basically", "wordlist", 2,
     _p(W + r"(basically|essentially|actually|really|literally|fundamentally)" + W),
     "Adds nothing. Delete."),
    ("wordlist.intensifier", "wordlist", 1,
     _p(W + r"(very|quite|extremely|incredibly|highly|truly|absolutely)\s+\w+"),
     "Empty intensifier. Give a number or delete."),
    ("wordlist.as-of-writing", "wordlist", 3, _p(r"as of (this|the time of) writing"),
     "Dates the doc. Cut, or name a version."),
    ("wordlist.latest", "wordlist", 1, _p(W + r"(the latest|the newest|the new)\s+\w+"),
     "Goes stale. Name a version or date."),
    ("wordlist.etc", "wordlist", 2, _p(r"\betc\.?"),
     "Finish the list, or write 'and so on'."),
    ("wordlist.above-below", "wordlist", 2,
     _p(r"\b(see|as (described|shown|mentioned|noted))\s+(above|below)" + W),
     "Position depends on rendering. Link the section by name."),
    ("wordlist.click-here", "wordlist", 3, _p(r"\b(click|tap|see|read)\w*\s+here" + W),
     "Undescriptive link text. Name the destination."),

    # -- word list: replace ---------------------------------------------------
    ("filler.in-order-to", "filler", 3, _p(r"\bin order to" + W), "→ to"),
    ("filler.due-to-fact", "filler", 3, _p(r"\bdue to the fact that" + W), "→ because"),
    ("filler.in-the-event", "filler", 2, _p(r"\bin the event that" + W), "→ if"),
    ("filler.point-in-time", "filler", 3, _p(r"\bat (this|that) point in time" + W), "→ now / then"),
    ("filler.wide-variety", "filler", 2, _p(r"\ba (wide|broad) (variety|range) of" + W),
     "→ many, or the actual number"),
    ("filler.plethora", "filler", 2, _p(W + r"(plethora|myriad)" + W), "→ many, or a number"),
    ("filler.allows-you-to", "filler", 2, _p(r"\ballows? (you|users?) to" + W), "→ lets you"),
    ("filler.is-able-to", "filler", 2, _p(r"\b(is|are|was|were) able to" + W), "→ can"),
    ("filler.ability-to", "filler", 2, _p(r"\bhas the ability to" + W), "→ can"),
    ("filler.prior-to", "filler", 2, _p(r"\b(prior to|subsequent to)" + W), "→ before / after"),
    ("filler.utilize", "filler", 2, _p(W + r"utiliz(e|es|ed|ing|ation)" + W), "→ use"),
    # "high-leverage" is the noun and fine; only the verb is jargon.
    ("filler.leverage", "filler", 2, _p(r"(?<![-\w])leverag(e|es|ed|ing)" + W), "→ use"),
    ("filler.functionality", "filler", 2, _p(W + r"functionalit(y|ies)" + W),
     "→ features, or name the specific feature"),
    ("filler.eg-ie", "filler", 3, _p(r"\b(e\.g\.|i\.e\.)"), "→ for example / that is"),
    ("filler.and-or", "filler", 2, _p(r"\band/or" + W), "→ 'A, B, or both'"),
    ("filler.abort", "filler", 1, _p(W + r"abort(s|ed|ing)?" + W),
     "→ stop, cancel, exit (unless it's the literal signal)"),
    ("filler.execute", "filler", 1, _p(W + r"execut(e|es|ed|ing)\s+the\s+(command|script|program)"),
     "→ run"),
    ("filler.access-verb", "filler", 1, _p(r"\b(to|can|could|should)\s+access" + W),
     "→ see, edit, view, use"),
    ("filler.note-that", "filler", 3,
     _p(r"\b(please )?note that\b|\bit'?s (worth (noting|mentioning)|important to (note|remember))"),
     "Preamble. Keep the claim, drop the frame."),
    # The suffix test alone matches concrete nouns too ("makes a sentence"), so
    # the common ones are excluded by name.
    ("filler.nominalization", "filler", 2,
     _p(r"\b(provide[sd]?|perform(s|ed)?|conduct(s|ed)?|make[s]?|give[s]?|carr(y|ies|ied) out)\s+"
       r"(a|an|the)\s+(?!(sentence|difference|document|element|audience|experience|"
       r"instance|moment|reference|service|environment|entity|security|community|"
       r"city|opportunity|quality|priority|majority|minority|distinction)\b)"
       r"\w*(tion|ment|ance|ence|sis|ity)" + W),
     "Buried verb. 'provides a description of' → 'describes'."),

    # -- voice / person -------------------------------------------------------
    ("voice.passive", "voice", 1,
     _p(r"\b(is|are|was|were|be|been|being|gets?|got)\s+"
       r"(\w+ly\s+)?\w+(ed|en)\s+by" + W),
     "Passive with a named actor. Make the actor the subject."),
    ("voice.passive-bare", "voice", 1,
     _p(r"\b(is|are|was|were|will be|can be|must be|should be|has been|have been)\s+"
       r"(\w+ly\s+)?(configured|created|generated|deployed|executed|handled|invoked|"
       r"performed|processed|returned|triggered|validated|verified|updated|removed|"
       r"stored|parsed|rendered|applied|enabled|disabled|blocked)" + W),
     "Passive. Name who does it, or use the imperative."),
    ("person.we", "person", 2,
     _p(r"^\s*(we|our|us)\b|(?<=[.:;!?]\s)(we|our|us)\b|\b(we|our|us)\s+(can|should|will|need|want|must)\b",
       re.I | re.M),
     "Second person: 'you', or the imperative. Keep 'we' only for real "
     "first-person claims about this project."),
    ("person.the-user", "person", 2, _p(r"\bthe user (should|must|can|needs? to|will)" + W),
     "Address the reader: 'you', or the imperative."),
    # 'one' is only the impersonal pronoun at the head of a clause; elsewhere it
    # is almost always a count or a back-reference ("violates one should be...").
    ("person.one-might", "person", 2,
     _p(r"(?:^|(?<=[.;:!?]\s)|(?<=,\s))one (might|may|can|should|could|would)" + W, re.I | re.M),
     "→ you, or the imperative."),

    # -- format ---------------------------------------------------------------
    ("format.ambiguous-date", "format", 3,
     _p(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b"),
     "Ambiguous date. Use 2026-08-18 or 'August 18, 2026'."),
    ("format.bold-emphasis", "format", 1,
     _p(r"\*\*(very|really|never|always|must|do not|don'?t|critical|important)\b[^*]*\*\*", re.I),
     "Bold is for UI elements. If the sentence needs bold, rewrite the sentence."),
    ("format.unit-spacing", "format", 1, _p(r"\b\d+(ms|s|GB|MB|KB|kB|TB)\b", 0),
     "Space between number and unit: '5 ms', not '5ms'."),

    # -- tone -----------------------------------------------------------------
    ("tone.exclamation", "tone", 2, _p(r"[a-z]!(\s|$)", re.M | re.I),
     "No exclamation marks in technical prose."),
    ("tone.idiom", "tone", 2,
     _p(r"\b(out of the box|under the hood|first-class citizen|ballpark|back burner|"
        r"low-hanging fruit|move the needle|bread and butter|silver bullet|"
        r"rabbit hole|apples to apples|the elephant in the room)" + W),
     "Idiom. Doesn't translate — say the literal thing."),
    ("tone.commence", "tone", 1, _p(W + r"(commence[sd]?|endeavor|aforementioned|heretofore)" + W),
     "Formal register. Use the plain word."),
]

CATEGORIES = ["wordlist", "filler", "voice", "person", "structure", "format",
              "inclusive", "tone"]
ING_EXEMPT = {"billing", "pricing", "logging", "routing", "engineering", "onboarding"}
SEV_NAME = {3: "high", 2: "med", 1: "low"}

SENT_SPLIT = re.compile(r"(?<=[.!?])[\"')\]]*\s+")
WORD_RX = re.compile(r"[A-Za-z][A-Za-z'’-]*")
HEADING_RX = re.compile(r"^(#{1,6})\s+(.+?)\s*#*$", re.M)
BULLET_RX = re.compile(r"^\s*([-*+]|\d+[.)])\s+")
SMALL_WORDS = {
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor",
    "of", "on", "or", "over", "per", "the", "to", "up", "via", "vs", "with",
}

CODE_EXT = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".c", ".h", ".cc",
    ".cpp", ".rb", ".php", ".swift", ".kt", ".cs", ".sh", ".bash", ".zsh", ".sql",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def mask_code(text):
    """Blank frontmatter, fenced blocks, inline spans, and links, keeping offsets.

    Frontmatter is metadata, not prose: a skill `description` is deliberately a
    long single sentence packed with trigger phrases, and linting it as a
    paragraph produces nothing but noise.
    """
    chars = list(text)
    fm = re.match(r"---\n.*?\n---\n", text, re.S)
    if fm:
        for i in range(fm.end()):
            if chars[i] != "\n":
                chars[i] = " "
    for m in re.finditer(r"^(\s*)(```|~~~).*?(\n)(.*?)(^\s*\2.*?$|\Z)", text, re.S | re.M):
        for i in range(m.start(), min(m.end(), len(chars))):
            if chars[i] != "\n":
                chars[i] = " "
    masked = "".join(chars)
    masked = re.sub(r"`[^`\n]*`", lambda m: " " * len(m.group(0)), masked)
    masked = re.sub(r"\]\([^)\s]+\)", lambda m: " " * len(m.group(0)), masked)
    masked = re.sub(r"https?://\S+", lambda m: " " * len(m.group(0)), masked)
    return masked


def strip_comment_markers(text):
    """For source files: keep only comment and docstring text, blanking the rest."""
    out = []
    for line in text.split("\n"):
        m = re.match(r"^(\s*)(#|//|\*|--)\s?(.*)$", line)
        if m:
            out.append(" " * (len(m.group(1)) + len(m.group(2)) + 1) + m.group(3))
        else:
            out.append(" " * len(line))
    return "\n".join(out)


def line_col(text, offset):
    return text.count("\n", 0, offset) + 1, offset - (text.rfind("\n", 0, offset) + 1) + 1


def excerpt(text, start, end, width=72):
    ls = text.rfind("\n", 0, start) + 1
    le = text.find("\n", end)
    le = len(text) if le == -1 else le
    s = text[ls:le].strip()
    if len(s) > width:
        rel = max(0, start - ls - 20)
        s = ("…" if rel else "") + s[rel:rel + width] + "…"
    return s


def sentences_with_offsets(text):
    """Yield (sentence, start_offset), skipping headings, tables, and code.

    Markdown prose is hard-wrapped, so a sentence routinely spans several lines.
    Lines are joined into blocks before splitting, or every measurement of
    sentence length reports the wrap width instead. `index_map` carries each
    joined character back to its absolute offset in the source.
    """
    out = []
    blocks = []
    buf, index_map = [], []
    pos = 0

    def flush():
        if buf:
            blocks.append(("".join(buf), list(index_map)))
        buf.clear()
        index_map.clear()

    for line in text.split("\n"):
        stripped = line.lstrip()
        if not stripped or stripped.startswith(("#", "|", ">")):
            flush()
        else:
            body = re.sub(r"^(\s*)([-*+]|\d+[.)])\s+",
                          lambda m: " " * len(m.group(0)), line)
            # A new list item starts a new block: adjacent items aren't one sentence.
            if BULLET_RX.match(line) and buf:
                flush()
            if buf:
                buf.append(" ")
                index_map.append(pos)
            for i, ch in enumerate(body):
                buf.append(ch)
                index_map.append(pos + i)
        pos += len(line) + 1
    flush()

    for joined, imap in blocks:
        cursor = 0
        for part in SENT_SPLIT.split(joined):
            idx = joined.find(part, cursor)
            if idx == -1:
                idx = cursor
            cursor = idx + len(part)
            if len(WORD_RX.findall(part)) >= 2:
                lead = len(part) - len(part.lstrip())
                out.append((part.strip(), imap[min(idx + lead, len(imap) - 1)]))
    return out


def is_title_case(heading):
    """Distinguish title case from a heading that merely contains proper nouns.

    "Deploy to Cloud Run" is sentence case with a product name in it; two
    capitals alone can't be the signal. A capitalized article or preposition
    ("Rolling Back A Bad Revision") is near-diagnostic, so it stands on its own.
    """
    words = re.findall(r"[A-Za-z][\w'’-]*", heading)
    if len(words) < 3:
        return False
    rest = words[1:]
    if any(w.lower() in SMALL_WORDS and w[0].isupper() for w in rest):
        return True
    substantive = [w for w in rest if w.lower() not in SMALL_WORDS and not w.isupper()]
    if len(substantive) < 3:
        return False
    caps = [w for w in substantive if w[0].isupper()]
    return len(caps) >= 3 and len(caps) / len(substantive) >= 0.75


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------

def scan_patterns(text, only, min_sev):
    findings = []
    for pid, cat, sev, rx, hint in PATTERNS:
        if sev < min_sev or (only and cat not in only):
            continue
        for m in rx.finditer(text):
            if not m.group(0).strip():
                continue
            line, col = line_col(text, m.start())
            findings.append({
                "id": pid, "category": cat, "severity": sev,
                "line": line, "column": col, "match": m.group(0).strip()[:80],
                "excerpt": excerpt(text, m.start(), m.end()), "hint": hint,
            })
    return findings


def scan_structure(text, raw, only, min_sev, max_sentence):
    """Sentence length and heading case — positional checks the regex table can't do."""
    findings = []
    if only and "structure" not in only:
        return findings

    if min_sev <= 2:
        for sent, off in sentences_with_offsets(text):
            n = len(WORD_RX.findall(sent))
            if n > max_sentence:
                line, col = line_col(text, off)
                findings.append({
                    "id": "structure.long-sentence", "category": "structure", "severity": 2,
                    "line": line, "column": col, "match": f"{n} words",
                    "excerpt": sent[:72] + ("…" if len(sent) > 72 else ""),
                    "hint": f"{n} words. One idea per sentence — look for a "
                            f"'which'/'and' that starts a second claim.",
                })

    if min_sev <= 2:
        headings = list(HEADING_RX.finditer(raw))
        for i, m in enumerate(headings):
            level, title = len(m.group(1)), m.group(2)
            line, col = line_col(raw, m.start(2))

            if is_title_case(title):
                findings.append({
                    "id": "structure.title-case-heading", "category": "structure", "severity": 2,
                    "line": line, "column": col, "match": title[:60],
                    "excerpt": m.group(0).strip()[:72],
                    "hint": "Sentence case in headings: capitalize the first word only.",
                })

            first = re.match(r"[A-Za-z]+", title)
            if first and first.group(0).lower().endswith("ing") \
                    and first.group(0).lower() not in ING_EXEMPT:
                findings.append({
                    "id": "structure.ing-heading", "category": "structure", "severity": 2,
                    "line": line, "column": col, "match": first.group(0),
                    "excerpt": m.group(0).strip()[:72],
                    "hint": f"'-ing' opener: '{first.group(0)}' → bare infinitive, "
                            f"or a noun phrase for a concept section.",
                })

            # Stacked heading: the next non-blank line is another heading.
            tail = raw[m.end():]
            nxt = next((ln for ln in tail.split("\n")[1:] if ln.strip()), "")
            if nxt.lstrip().startswith("#") and i + 1 < len(headings):
                if len(re.match(r"#+", nxt.lstrip()).group(0)) > level:
                    findings.append({
                        "id": "structure.stacked-heading", "category": "structure", "severity": 1,
                        "line": line, "column": col, "match": title[:60],
                        "excerpt": m.group(0).strip()[:72],
                        "hint": "Stacked heading — no text before the next one. Add a "
                                "sentence of orientation, or drop this level.",
                    })

    # Inconsistent terminal punctuation within one bulleted list breaks the
    # parallelism Google requires; the first item sets the pattern.
    if min_sev <= 1:
        for start, items in bullet_groups(text):
            if len(items) < 3:
                continue
            ends = [bool(re.search(r"[.!?][\"')\]]*$", t.strip())) for _, t in items]
            if len(set(ends)) > 1 and sum(ends) not in (0, len(ends)):
                line, col = line_col(text, items[0][0])
                findings.append({
                    "id": "structure.list-parallelism", "category": "structure", "severity": 1,
                    "line": line, "column": col,
                    "match": f"{sum(ends)}/{len(ends)} items end with a period",
                    "excerpt": items[0][1].strip()[:72],
                    "hint": "Mixed terminal punctuation in one list. Full sentences "
                            "all take periods; fragments all take none.",
                })

    return [f for f in findings if f["severity"] >= min_sev]


def bullet_groups(text):
    """Yield (start_offset, [(offset, text), ...]) for each run of sibling bullets."""
    groups, current, start = [], [], 0
    pos = 0
    for line in text.split("\n"):
        m = BULLET_RX.match(line)
        if m:
            if not current:
                start = pos
            current.append((pos + m.end(), line[m.end():]))
        elif not line.strip():
            if len(current) >= 2:
                groups.append((start, current))
            current = []
        pos += len(line) + 1
    if len(current) >= 2:
        groups.append((start, current))
    return groups


def metrics(text, raw):
    words = WORD_RX.findall(text)
    sents = [s for s, _ in sentences_with_offsets(text)]
    lens = [len(WORD_RX.findall(s)) for s in sents]
    m = {"words": len(words), "sentences": len(sents)}
    if lens:
        m["sentence_len_mean"] = round(sum(lens) / len(lens), 1)
        m["sentence_len_max"] = max(lens)
        m["sentences_over_30"] = sum(1 for n in lens if n > 30)
    lines = [ln for ln in raw.split("\n") if ln.strip()]
    if lines:
        m["headings"] = len(HEADING_RX.findall(raw))
        m["bullet_ratio"] = round(
            sum(1 for ln in lines if BULLET_RX.match(ln)) / len(lines), 2)
    return m


def scan_file(path, args):
    if path == "-":
        raw, name, ext = sys.stdin.read(), "<stdin>", ""
    else:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            raw = fh.read()
        name, ext = path, os.path.splitext(path)[1].lower()

    mode = args.mode
    if mode == "auto":
        mode = "code" if ext in CODE_EXT else "prose"

    text = strip_comment_markers(raw) if mode == "code" else mask_code(raw)
    only = set(args.only.split(",")) if args.only else None

    findings = []
    if not args.stats:
        findings = scan_patterns(text, only, args.min_severity)
        if mode == "prose":
            findings += scan_structure(text, raw, only, args.min_severity, args.max_sentence)
        findings.sort(key=lambda f: (f["line"], f["column"]))

    return {"file": name, "mode": mode, "findings": findings,
            "metrics": metrics(text, raw)}


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def render(results, args):
    total = 0
    for r in results:
        hits = r["findings"]
        total += len(hits)
        if not hits and not args.stats:
            continue
        print(f"\n{r['file']}  [{r['mode']}]")
        if args.stats:
            for k, v in r["metrics"].items():
                print(f"  {k:>20}  {v}")
            continue
        for f in hits:
            loc = f"{f['line']}:{f['column']}"
            print(f"  {loc:>9}  {SEV_NAME[f['severity']]:<4} {f['category']:<9} {f['excerpt']}")
            print(f"  {'':>9}  → {f['hint']}  [{f['id']}]")
    if args.stats:
        return 0
    if total:
        print(f"\n{total} candidate(s). Candidates, not verdicts — a rule worth "
              f"breaking is worth breaking knowingly. Never blind find-and-replace.")
    else:
        print("No pattern hits. Structure and word choice are checkable; whether "
              "the document says the right thing is not. Read it yourself.")
    return total


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--mode", choices=["auto", "prose", "code"], default="auto")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--stats", action="store_true", help="document metrics only")
    ap.add_argument("--only", help="comma-separated categories: " + ",".join(CATEGORIES))
    ap.add_argument("--min-severity", type=int, default=1, choices=[1, 2, 3])
    ap.add_argument("--max-sentence", type=int, default=40,
                    help="flag sentences longer than this (default 40)")
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
        total = sum(len(r["findings"]) for r in results)
    else:
        total = render(results, args)

    if errors:
        sys.exit(2)
    sys.exit(0 if args.exit_zero or not total else 1)


if __name__ == "__main__":
    main()
