# Word list

The arbitrary long tail, condensed from
[developers.google.com/style/word-list](https://developers.google.com/style/word-list).
Only entries worth looking up are here. The obvious substitutions live in the
linter, not this file. The live page is authoritative.

## Inclusive language

Errors, not preferences.

| Avoid | Use |
| --- | --- |
| `blacklist` / `whitelist` | `denylist` / `allowlist` |
| `master` / `slave` | `primary` / `replica`, `controller` / `worker` |
| `grandfathered` | `legacy`, `exempt` |
| `sanity check` | `validity check`, `confidence check` |
| `dummy value` | `placeholder value` |
| `man-in-the-middle` | `person-in-the-middle`, `on-path attacker` |
| `guys` (a group) | `everyone`, `folks`, `team` |
| `he` / `his` (generic) | singular `they` / `their` |
| `crazy`, `insane`, `blind to`, `cripples` (figurative) | Say what happens: `ignores`, `slows` |
| `native` (of software) | `built-in`, `platform-specific` |
| `ninja`, `rockstar`, `guru` (of people) | `expert`, `specialist` |

## Precision traps

Words that mean something narrower than writers assume.

| Term | Means | Doesn't mean |
| --- | --- | --- |
| `deprecated` | Still works, discouraged | Removed |
| `may` | Permission | Possibility — use `might` or `can` |
| `since` | Time | Because |
| `data` | Mass noun: "the data is" | Plural of datum |
| `abort` | The Linux signal | `stop`, `cancel`, `exit` |
| `e.g.` / `i.e.` | — | Readers confuse them; write `for example` / `that is` |

## Goes stale

Cut, or replace with a version or date: `currently`, `now`, `latest`, `new`,
`as of this writing`, `does not yet`, `at this time`.

## Accessibility

| Avoid | Why |
| --- | --- |
| `click here`, `read this` | Screen reader users navigate by jumping between links, which strips surrounding context |
| `above`, `below`, `right-hand side` | No spatial position exists for a screen reader, and rendering moves it |
| Color or position as the only signal | Add a text label or icon |
| Information only inside an image | Not searchable, translatable, or readable |
