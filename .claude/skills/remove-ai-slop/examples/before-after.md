# Worked examples

Calibration reference. The commentary matters more than the rewrites — note how often
the right edit is *deletion*, and how often the honest answer is "I need a fact from
the user."

---

## 1. README intro

**Before**

> In today's fast-paced development landscape, managing configuration across multiple
> environments has become increasingly complex. Config-Kit is a powerful, comprehensive
> tool designed to streamline your configuration workflow. Whether you're a solo
> developer or part of a large enterprise team, Config-Kit provides a robust,
> seamless experience. It's not just a config loader — it's a complete configuration
> management solution. Let's dive in!

**After**

> Config-Kit loads config from files, env vars, and CLI flags, with later sources
> overriding earlier ones. It validates against a schema at startup, so a typo in
> `production.yaml` fails the deploy instead of the first request that reads it.

**Commentary.** The original is 68 words and says only "it's a config tool." Almost all
of it fails the Inversion test — nobody ships a config tool and claims it's slow and
partial. Deleted: the "today's landscape" opener, the "whether you're" both-audiences
line, the "not just X — it's Y" frame, "Let's dive in." What replaced them isn't a
rewrite of the original sentences; it's the actual behavior, which required reading the
code. **That's the usual shape of this work.** If the behavior isn't knowable, ask —
don't write a shorter version of nothing.

---

## 2. PR description

**Before**

> This PR introduces several key improvements to the authentication flow. It
> significantly enhances security by implementing a more robust token validation
> mechanism. Additionally, it improves the overall user experience by streamlining the
> login process. These changes represent an important step forward in our ongoing
> efforts to deliver a best-in-class authentication system.

**After**

> Validates the `exp` and `aud` claims on incoming JWTs — we were only checking the
> signature, so a token minted for the staging audience worked in prod.
>
> Also drops the second redirect on login; the session cookie is set on the callback
> now instead of a follow-up request.

**Commentary.** Every sentence in the original failed the Specificity test — it would
fit any auth PR ever written. The rewrite needed information from the diff, not the
prose. "Significantly enhances security" became the actual vulnerability. Note the
paragraph break: two unrelated changes, so two paragraphs, unequal in length because
they're unequal in importance.

---

## 3. Docs paragraph — a light-touch case

**Before**

> The `retry` option is quite useful when dealing with flaky network conditions. It's
> important to note that it may potentially increase latency in some cases. Ultimately,
> the key is to find the right balance for your use case.

**After**

> `retry` re-sends failed requests up to `max_attempts` times with exponential backoff.
> It can multiply worst-case latency by roughly `max_attempts`, so keep it low behind
> a user-facing request path.

**Commentary.** "May potentially increase latency in some cases" hedges three times
around a real fact, so the hedges went and the fact stayed — quantified and with the
consequence attached. "Find the right balance for your use case" is the classic
both-sides non-recommendation; replaced with an actual recommendation. Notice what
*survived*: "can" is still there, because the latency increase genuinely is conditional.

---

## 4. Structural fix — list-ification

**Before**

> The migration has several benefits:
>
> - **Performance** — Queries run faster on the new schema.
> - **Maintainability** — The code is easier to maintain.
> - **Scalability** — The system can handle more load.

**After**

> Reads get faster mostly because `events` is no longer joined against `users` on every
> query — the dashboard's p95 drops from 800ms to about 120ms. Write throughput is
> unchanged; this migration doesn't help there.

**Commentary.** Three tells at once: rule of three, bold lead-ins on every bullet, and
symmetric coverage that gives "Maintainability" (which says nothing at all) equal weight
with the one real benefit. Two of the three bullets fail the Inversion test. The
rewrite is prose because the items weren't a real enumeration, and it names the thing
that *doesn't* improve — that's the Stakes test passing.

---

## 5. Code — comments and defenses

**Before**

```python
def process_users(users):
    """Process a list of users.

    Args:
        users: A list of user objects to process.
    Returns:
        A list of processed results.
    """
    # Initialize the results list
    results = []

    # Loop through each user in the users list
    for user in users:
        try:
            # Get the user's name
            name = user.name
            # Append the processed name to results
            results.append(name.strip().lower())
        except Exception:
            # Skip users that cause errors
            pass

    return results
```

**After**

```python
def process_users(users):
    return [u.name.strip().lower() for u in users]
```

**Commentary.** Every comment restated the line under it. The docstring restated the
signature. The `except Exception: pass` was the real problem — it silently dropped any
user with a `None` name, turning a bug into missing data. Removing it is a *behavior
change*, so it goes in the report: "the old code silently skipped users with a null
name; the new one raises. If skipping was intentional, say so and I'll filter
explicitly." Never quietly delete a swallowed exception without flagging it.

---

## 6. Where the answer is a question, not an edit

**Before**

> Our new caching layer dramatically improves response times and reduces database load,
> making the application significantly more performant under heavy traffic.

**After** — no rewrite offered. Reported instead:

> This sentence has no specifics and would read identically for any cache ever shipped.
> I can make it concrete if you have: the before/after p95, the drop in DB QPS, and the
> traffic level you measured at. Without those, the honest version is one clause —
> "adds a read-through cache in front of the user table" — and the performance claim
> comes out entirely.

**Commentary.** The failure mode here is inventing "cut p95 from 400ms to 40ms" because
it sounds like what the author meant. Fabricated specifics are worse than slop: slop is
merely empty, invented numbers are false. When the missing ingredient is a fact, say so.
