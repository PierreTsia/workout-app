# Discovery — Next milestone candidates

Snapshot from the May–Aug 2026 retro (19 Aug), rewritten 20 Aug after prospective tickets [#501](https://github.com/PierreTsia/workout-app/issues/501)–[#507](https://github.com/PierreTsia/workout-app/issues/507). Not an Epic Brief. Not a commitment.

**How to read a Go.** Tagline is the job. Then a **gradation**: first step (smallest thing that makes the Go real) → next (the epic if that works) → target (north star, often not this year). Tickets are GitHub. `needs-grilling` means prospective — grill before a brief.

**Still locked**

- [#149](https://github.com/PierreTsia/workout-app/issues/149) (MV / MEV / MAV / MRV) is an engine enhancement, not a milestone, unless it becomes a first-class **Mesocycle**.
- **Go social** splits in two. **Clone + share of a Program** is in the quarter — it is the other half of **Go coach** (fork before a patch; send the result). Gallery / publish / marketplace is the rest of [#230](https://github.com/PierreTsia/workout-app/issues/230), not the quarter.
- Faux milestones: SemVer, leftover chores, MCP copy typos, `set_active_program`, “9 missing exercises”.
- **Vérité** is a filter on every Go, not a Go you ship.

**The ranking question:** if the next quarter is *only* this Go, does someone already in reach of GymLogic feel a better training week — without a second company, a crowd, or a funnel we do not have?

---

## Go social — someone else trains with your thing

**Tagline:** Clone and share are verbs on a **Program**. A network is a different company.

| Gradation | What |
| --- | --- |
| First step | Clone-your-own *and* share-a-link: fork before a coach patch wrecks the live **Program**; send the result to one person who clones it. This is [#230](https://github.com/PierreTsia/workout-app/issues/230) phase 1 — not a gallery. |
| Next | Same verbs, less friction (deep link that lands on the **Program**, not a dead exercise URL — distinct from [#370](https://github.com/PierreTsia/workout-app/issues/370)). |
| Target | Marketplace / ranked board (#230 remainder). Empty-room. Not this quarter. |

**Tickets:** [#230](https://github.com/PierreTsia/workout-app/issues/230) phase 1. Sits on the same object as **Go coach**.

**Out:** Feed, clubs, coach dashboards, two-human comparison, WOD leaderboards. Cutting *this* Go to “marketplace later” was wrong — that threw away the verbs.

---

## Go coach — the app talks while you are in the program

**Tagline:** Creation-only AI is a funnel. In-program AI is the product — and a **Program** you cannot clone or send is a diary.

| Gradation | What |
| --- | --- |
| First step | [#503](https://github.com/PierreTsia/workout-app/issues/503) — AI *insight* on the **Builder** (the **Program** under edit). No new chat surface. Clone exists so a patch has a before. |
| Next | [#505](https://github.com/PierreTsia/workout-app/issues/505) — **Embedded Agent** *between sessions*: why HOLD, what we change this week, user confirms a patch. Share is how that patch leaves the account. |
| Target | Agent may `update_program` on the live **Program**. Creation flows stay creation flows. |

**Tickets:** [#503](https://github.com/PierreTsia/workout-app/issues/503), [#505](https://github.com/PierreTsia/workout-app/issues/505), plus [#230](https://github.com/PierreTsia/workout-app/issues/230) phase 1 (the other half — see **Go social**).

**Out:** Chat during the set (fights **Eyes-off Feedback**; see [#465](https://github.com/PierreTsia/workout-app/issues/465) / [#501](https://github.com/PierreTsia/workout-app/issues/501)). Replaying May’s onboarding chat. Coach *without* clone/share.

---

## Go saison — you steer a block, not a set

**Tagline:** The week has a shape you can see and name, before the engine invents a meso.

| Gradation | What |
| --- | --- |
| First step | [#504](https://github.com/PierreTsia/workout-app/issues/504) — live goal-track scoring on the **Program** (hypertrophy / strength / …) from **Template Prescription**, not `set_logs`. |
| Next | [#149](https://github.com/PierreTsia/workout-app/issues/149) — volume landmarks in the **Progression Engine**. |
| Target | **Mesocycle** as an object next to **Cycle** (week / wave / exit). Phase change without recreating a **Program**. |

**Tickets:** [#504](https://github.com/PierreTsia/workout-app/issues/504), [#149](https://github.com/PierreTsia/workout-app/issues/149).

**Out:** Shipping #149 as a deload pictogram. Cycle goals that need intake (that’s **Go food**).

---

## Go quotidien — GymLogic is the habit, not the plan

**Tagline:** Show up without a **Program** — or stop pretending this is a Go.

| Gradation | What |
| --- | --- |
| First step | **Quick Workout** as the home bet (streak, 20 min, no program). No ticket. That *is* **Go one sport**, session-only. |
| Next | — |
| Target | Habit loop. Empty until someone picks this for real. |

**Tickets:** none. [#465](https://github.com/PierreTsia/workout-app/issues/465) is a *session ritual on a Program day*, not habit-vs-plan.

**Out:** Treating Bookends as “quotidien”. Widget / lock-screen as a gym feature.

---

## Go OS agentique — GymLogic is infra, Claude / Cursor are UI

**Tagline:** Power users drive the gym from an **External MCP Client**. Gym users never see it.

| Gradation | What |
| --- | --- |
| First step | [#311](https://github.com/PierreTsia/workout-app/issues/311) connect pages (Cursor / Le Chat / OpenClaw) + [#266](https://github.com/PierreTsia/workout-app/issues/266) SSE. |
| Next | Skill + MCP as a versioned packaged product (touches [#328](https://github.com/PierreTsia/workout-app/issues/328)). |
| Target | Other hosts (ChatGPT, Siri). Not a better training week for someone already in the PWA. |

**Tickets:** [#311](https://github.com/PierreTsia/workout-app/issues/311), [#266](https://github.com/PierreTsia/workout-app/issues/266). [#328](https://github.com/PierreTsia/workout-app/issues/328) is ops, not the job.

**Out:** Calling this the next quarter. MCP copy nits ([#286](https://github.com/PierreTsia/workout-app/issues/286)–[#289](https://github.com/PierreTsia/workout-app/issues/289), [#290](https://github.com/PierreTsia/workout-app/issues/290)).

---

## Go logger — beat Hevy / Strong on the notebook

**Tagline:** Did this movement move this year — without opening a spreadsheet.

| Gradation | What |
| --- | --- |
| First step | [#502](https://github.com/PierreTsia/workout-app/issues/502) — match, then beat, Hevy / Strong on glance-at-progress (one surface: exercise story *or* period dashboard). |
| Next | [#370](https://github.com/PierreTsia/workout-app/issues/370) — exercise share that actually lands on the exercise. |
| Target | Apple Health / Watch as loggers. Not a CSV steal-their-users play (that’s **Go switch**). |

**Tickets:** [#502](https://github.com/PierreTsia/workout-app/issues/502), [#370](https://github.com/PierreTsia/workout-app/issues/370).

**Out:** Rebuilding History Revamp. Pasting Hevy’s 1RM chips onto planks and **Circuits**.

---

## Go contenu — the library is the app

**Tagline:** The catalog is complete enough that a serious split does not bounce.

| Gradation | What |
| --- | --- |
| First step | Holes and physics: [#232](https://github.com/PierreTsia/workout-app/issues/232), [#281](https://github.com/PierreTsia/workout-app/issues/281) weighted bodyweight, [#214](https://github.com/PierreTsia/workout-app/issues/214) Fundamental / Elite. |
| Next | [#423](https://github.com/PierreTsia/workout-app/issues/423) — `muscle_group` as slugs, not French display strings (unblocks honest scoring / maps). |
| Target | Editorial GymLogic blocks (“8-week pecs”). EN-first catalog. Not user-publish. |

**Tickets:** [#232](https://github.com/PierreTsia/workout-app/issues/232), [#281](https://github.com/PierreTsia/workout-app/issues/281), [#214](https://github.com/PierreTsia/workout-app/issues/214), [#423](https://github.com/PierreTsia/workout-app/issues/423).

**Out:** Video / form-check vision. That’s a graveyard.

---

## Go thune — a product, not a craft piece

**Tagline:** Money is policy, not a user job.

| Gradation | What |
| --- | --- |
| First step | **Embedded Agent quota** as a real cap, already implied by existing AI flows. |
| Next | Paywall. Not designed. |
| Target | White-label / human “GymLogic Coach”. Service, not software. |

**Tickets:** none that are a user milestone. [#328](https://github.com/PierreTsia/workout-app/issues/328) is SemVer ops.

**Out:** Shipping SemVer and calling it a quarter.

---

## Go vérité — the app that does not lie to you

**Tagline:** A filter. If a number looks scientific, publish the rule or don’t show it.

Applies to [#504](https://github.com/PierreTsia/workout-app/issues/504) scores, [#502](https://github.com/PierreTsia/workout-app/issues/502) period deltas, and any Foodlogic kcal. Not a quarter of its own.

---

## Go one sport, deeper — the session and the editor *are* the product

**Tagline:** Hevy’s floor on authoring and on the gym floor — plus what they cannot copy.

| Gradation | What |
| --- | --- |
| First step | [#503](https://github.com/PierreTsia/workout-app/issues/503) — Hevy-class **Builder** (live muscle read, clean add, insight touch). Same canvas as **Go coach** first step. |
| Next | Session quality on a **Program** day: [#465](https://github.com/PierreTsia/workout-app/issues/465) Bookends, [#501](https://github.com/PierreTsia/workout-app/issues/501) landscape / floor HUD, [#194](https://github.com/PierreTsia/workout-app/issues/194) rest. |
| Target | Best in-session product in the market. Still one sport: no social, no Foodlogic, no Watch. |

**Tickets:** [#503](https://github.com/PierreTsia/workout-app/issues/503), [#465](https://github.com/PierreTsia/workout-app/issues/465), [#501](https://github.com/PierreTsia/workout-app/issues/501), [#194](https://github.com/PierreTsia/workout-app/issues/194).

**Out:** In-set LLM. Flattening Bookends into the **Unified Day Sequence**.

---

## Go switch — a Hevy / Strong user tries GymLogic with their bag

**Tagline:** Week one is *their* split and *their* loads, not a blank questionnaire.

| Gradation | What |
| --- | --- |
| First step | [#506](https://github.com/PierreTsia/workout-app/issues/506) — inbound CSV → review unmatched names → History + reconstructed **Program**. |
| Next | Last loads seed **Template Prescription**. Engine starts living after they train *here* (ADR 0012: imported rows do not drive **Last Performance**). |
| Target | “Give it a try, no cost” is honest. Converts, does not acquire. |

**Tickets:** [#506](https://github.com/PierreTsia/workout-app/issues/506).

**Out:** Exporting GymLogic into Hevy. Inventing custom catalog rows for unmatched names (v1). Treating this as a growth engine.

---

## Go food — Foodlogic, the plate next to the bar

**Tagline:** Macros that change the next session — or it is a second app.

| Gradation | What |
| --- | --- |
| First step | [#507](https://github.com/PierreTsia/workout-app/issues/507) — grill sister-app vs tab, then one capture rung (barcode → OCR → plate photo). |
| Next | Protein / kcal vs current **Program** goal, visible before the session. |
| Target | Bulk / cut as a constraint on **Progression** (feeds **Go saison**). |

**Tickets:** [#507](https://github.com/PierreTsia/workout-app/issues/507).

**Out:** Camera-first kcal presented as fact (torches **vérité**). MCP-exported nutrition (skill is out of scope until reversed). MyFitnessPal with a GymLogic skin.

---

## If we pick one quarter (20 Aug)

Shortlist: **coach**, **social** (clone + share only), **saison**, **logger**.

They stack. They are not four epics.

1. **Canvas** — [#503](https://github.com/PierreTsia/workout-app/issues/503) **Builder** (Hevy floor + insight touch).
2. **Intent** — [#504](https://github.com/PierreTsia/workout-app/issues/504) live goal-tracks on that canvas (**saison** first step).
3. **Evidence** — [#502](https://github.com/PierreTsia/workout-app/issues/502) History glance (**logger** first step). Twin of #504: written vs trained.
4. **Verbs** — [#230](https://github.com/PierreTsia/workout-app/issues/230) phase 1: clone (fork before a patch) + share (send the **Program**). This is half of **coach**, not a network.
5. **Then** [#505](https://github.com/PierreTsia/workout-app/issues/505) between-session chat, if the numbers and the verbs exist for the agent to point at.

**Still out of the quarter:** marketplace, **switch**, **food**, **quotidien**, Watch, in-set LLM.

**Read it as:** see the week, see the past, edit, fork, send. Coach is the caption. Clone/share are how the caption leaves the diary. Marketplace is the encore.

Punchy write-up: `file:docs/Milestone_Brief_—_Voir_Éditer_Envoyer.md`.
