# Code tells — AI slop in source files

Model-written code is usually *correct and over-built*. The tells are ceremony:
comments, defenses, and abstractions that exist because they look like good practice,
not because anything in this file needed them.

Same hard rule as prose: **flag ≠ fix**. Every item below is correct in some codebase.
Match the repo's existing conventions over the guidance here whenever they conflict.

---

## 1. Comments that restate the code

```python
# Increment the counter
counter += 1

# Loop through each user
for user in users:
```

Delete. A comment earns its place by explaining **why**, a non-obvious constraint, or a
link to the issue/spec — never by narrating **what**.

**Keep:** `# fmt: off`, `# noqa`, `# SAFETY:`, comments explaining a workaround
(`# API returns 200 with an error body; see #4412`), and comments on genuinely
non-obvious algorithms.

## 2. Ceremonial docstrings

Full `Args:` / `Returns:` / `Raises:` blocks on a three-line private helper whose
signature already says everything:

```python
def get_name(user: User) -> str:
    """Get the name of a user.

    Args:
        user: The user to get the name of.
    Returns:
        str: The name of the user.
    """
    return user.name
```

Cut to a one-liner or nothing. **Keep** full docstrings on public API surface, on
anything with non-obvious preconditions, and everywhere the repo already does it
consistently (check before stripping — a repo with docs generation needs them).

## 3. Section-banner comments

```python
# ============================================
# HELPER FUNCTIONS
# ============================================
```

Delete. If a file needs banners to be navigable, it needs splitting.

## 4. Defensive code around things that can't fail

```python
try:
    result = data["key"]
except Exception:
    result = None
```

...where `data` was constructed four lines above with `"key"` in it. Also:

- `except Exception: pass` — swallows real bugs. Nearly always wrong.
- Catch-log-rethrow with no added context.
- Null checks on values a type checker already proves non-null.
- `if x is not None and len(x) > 0:` → `if x:`
- Type validation at the top of a private function in a duck-typed codebase.
- Re-validating input that the caller already validated one frame up.

**Keep:** every defense at a trust boundary — parsing external input, network calls,
filesystem, user data, anything crossing a process. Defensive code is only slop when
it defends against the impossible.

## 5. Abstraction with one implementation

- An interface/ABC/Protocol with exactly one implementer and no second one planned.
- `Manager`, `Handler`, `Helper`, `Utils`, `Service`, `Factory`, `Wrapper` classes that
  hold no state and wrap one function.
- A config dict or constants block whose keys are each referenced exactly once.
- A strategy/registry pattern for two branches an `if` would cover.
- Dependency injection for a dependency that is never injected differently.

**Fix:** inline it. **Keep:** when a second implementation genuinely exists (tests
count only if the fake is actually used), or when the seam is the point of the change.

## 6. Dead flexibility

Parameters that no caller ever passes non-default. `**kwargs` forwarded nowhere.
Feature flags with one value. `version="v1"` in code that has never had a v2.
Backwards-compatibility shims for an interface that never shipped.

Delete. It's speculative generality — cost now, benefit never. **Keep** if the user
asked for the extension point, or a caller outside this repo depends on it.

## 7. Emoji and cheerleading in output

```python
print("✅ Successfully completed all operations! 🎉")
logger.info("🚀 Starting server...")
```

Strip to plain text unless the surrounding code already does this. Log lines are read
by grep and by tired people at 3am; they should be greppable and boring.

Same for over-logging: an `info` line at every step of a function is `debug` at most,
and usually nothing.

## 8. Test slop

- `assert result is not None` as the whole test — passes for almost any bug.
- Tests that assert the mock was called, and nothing about behavior.
- One test per branch of a trivial getter, none for the hard concurrency path.
- Setup fixtures building elaborate objects where a literal would do.
- Test names that restate the function name (`test_get_user`) rather than the
  condition and expectation (`test_get_user_returns_none_when_deleted`).

## 9. Style tics

- Redundant `else` after `return`/`raise`.
- Variable names restating types: `user_list_array`, `config_dict`, `result_string`.
- `data`, `result`, `item`, `temp`, `helper` where a domain word exists.
- Extracting a one-line function used once, named a paraphrase of its body.
- Changelog comments in source: `# Added in v2`, `# Fixed bug where...`. Git has this.
- `# TODO: add error handling` left where the error handling was the ask.
- Reimplementing a stdlib call (hand-rolled `chunked`, `groupby`, `dedupe`).
- Type hints so broad they assert nothing: `Dict[str, Any]` on a known shape.

---

## Review order for a code de-slop pass

1. **Delete** — comments, banners, dead params, unused config, `except: pass`.
   Biggest win, zero risk of changing behavior.
2. **Inline** — one-implementation abstractions, single-use helpers, thin wrappers.
   Behavior-preserving but a real diff; call it out in the report.
3. **Rewrite** — defensive blocks, log levels, test assertions. Highest risk;
   only where you understand the intent.

Run the test suite after steps 2 and 3. Report what you deleted, what you inlined, and
anything you left because it looked deliberate.
