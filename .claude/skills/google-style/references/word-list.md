# Word list

Condensed from [developers.google.com/style/word-list](https://developers.google.com/style/word-list).
The live page is authoritative and much longer; consult it for anything not here.

## Delete outright

These words carry no meaning in technical prose. Deleting each one costs nothing.

| Word | Why it goes |
| --- | --- |
| `just` | Filler. If you mean "only," write "only." |
| `simply`, `easily`, `obviously`, `of course` | Tells the reader how they should feel about difficulty. If it's easy, the short instruction proves it; if it isn't, you've insulted them. |
| `please` | Not needed in a procedure. Keep only when genuinely asking for a favor. |
| `currently`, `now`, `at this time` | Present tense already implies now. |
| `basically`, `essentially`, `actually`, `really` | Adds nothing. |
| `very`, `quite`, `extremely`, `incredibly` | Empty intensifier. Give a number or cut. |
| `note that`, `it's worth noting that`, `it's important to note` | Preamble. Keep the claim, drop the frame. |
| `in order to` | → `to` |
| `as of this writing` | Dates the doc. Cut, or name a version. |

## Replace

| Avoid | Use | Why |
| --- | --- | --- |
| `allows you to` | `lets you` | Shorter, same meaning. |
| `due to the fact that` | `because` | |
| `a wide variety of`, `a plethora of` | `many`, or the actual number | |
| `at this point in time` | `now` | |
| `utilize` | `use` | |
| `leverage` (as a verb) | `use` | |
| `provides a description of` | `describes` | Nominalization — the verb is hiding inside a noun. |
| `causes the triggering of` | `triggers` | Same. |
| `is able to`, `has the ability to` | `can` | |
| `in the event that` | `if` | |
| `prior to`, `subsequent to` | `before`, `after` | |
| `e.g.`, `i.e.` | `for example`, `that is` | Readers confuse the two. |
| `etc.` | Finish the list, or write "and so on" | `etc.` usually means the author stopped thinking. |
| `and/or` | Rewrite: "A, B, or both" | |
| `access` (verb) | `see`, `edit`, `view`, `use` | |
| `abort` | `stop`, `cancel`, `exit` | Except the literal Linux signal. |
| `execute` (a program) | `run` | |
| `functionality` | `features`, or the specific feature | |
| `click here` | Descriptive link text | Screen readers read links out of context. |
| `above`, `below` (as cross-references) | Section name or link | Position changes with rendering. |
| `latest`, `new`, `newer` | A version number or date | Goes stale. |

## Precision traps

| Term | Means | Doesn't mean |
| --- | --- | --- |
| `deprecated` | Still works, discouraged | Removed |
| `removed` / `deleted` | Gone | Deprecated |
| `may` | Permission | Possibility (use `might` or `can`) |
| `since` | Time | Because |
| `data` | Mass noun: "the data is" | Plural of datum, in most technical prose |

## Inclusive language

Non-negotiable, and Google's guide treats these as errors rather than preferences.

| Avoid | Use |
| --- | --- |
| `blacklist` / `whitelist` | `denylist` / `allowlist` |
| `master` / `slave` | `primary` / `replica`, `controller` / `worker`, `leader` / `follower` |
| `grandfathered` | `legacy`, `exempt` |
| `guys` (for a group) | `everyone`, `folks`, `team` |
| `he` / `his` (generic) | singular `they` / `their` |
| `man-in-the-middle` | `person-in-the-middle`, `on-path attacker` |
| `sanity check` | `validity check`, `confidence check` |
| `dummy value` | `placeholder value`, `sample value` |
| `crazy`, `insane`, `blind to`, `cripples` (figurative) | Say what happens: `ignores`, `slows` |
| `native` (of software) | `built-in`, `platform-specific` |
| `ninja`, `rockstar`, `wizard` (of people) | `expert`, `specialist` |

## Where this list is wrong for this repo

Google writes for a global audience reading reference docs. This repo's
CLAUDE.md and skill files argue positions, and sometimes need emphasis Google
would strip. Keep a rule-breaking sentence when it's doing real work. Break the
rule knowingly, and never break the inclusive-language ones.
