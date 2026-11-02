# Vision — Porte Agent

Pas un Epic Brief. Pas un Tech Plan. **Vision produit** d'un point d'entrée global vers l'agent embarqué — le « chantier UI préalable » est le vrai livrable.

**Issue :** [#556](https://github.com/PierreTsia/workout-app/issues/556)
**Refs :** [#505](https://github.com/PierreTsia/workout-app/issues/505) (agent in-program, entre séances) · [#552](https://github.com/PierreTsia/workout-app/issues/552) (Jev) · [#555](https://github.com/PierreTsia/workout-app/issues/555) (spike routage) · [#287](https://github.com/PierreTsia/workout-app/issues/287) (consentement d'écriture MCP)
**ADR :** `file:docs/adr/0023-jev-verdicts-only-embedded-agent.md`

---

## 1. Cible

Une **porte unique, persistante, disponible sur tous les écrans** vers l'agent : on l'ouvre d'un geste, on parle ou on écrit, on la referme, on reste là où on était. **Voix d'abord**, **expérimentale** au départ.

Aujourd'hui l'agent n'existe que dans deux flux : `EmbeddedAgentChatStep` est monté uniquement dans `OnboardingPage.tsx` et `CreateProgramPage.tsx`. Il n'y a **pas de route chat globale** — l'agent est un *step* de wizard, pas une présence.

La porte est **l'entrée**, pas la capacité. Elle ne fait rien de plus que ce que l'agent sait déjà faire ; elle rend l'agent joignable partout.

**Ce que ce n'est pas :**

- Pas une refonte de l'onboarding. L'onboarding garde son questionnaire structuré et son chat additif (voir `docs/CONTEXT.md`, **Embedded Agent onboarding (v1)**).
- Pas une seconde app, pas un onglet de plus dans la nav, pas un remplacement du `SideDrawer`.
- Pas une promesse de génération : la porte route et ouvre des surfaces, elle ne produit pas de mots (frontière Jev, ADR 0023).

---

## 2. Pourquoi maintenant / pourquoi pas tout de suite

Le spike [#555](https://github.com/PierreTsia/workout-app/issues/555) (PR #558) a mesuré le gain du routage Jev sur l'onboarding : **0 % de tours routables** (0 sur 10, transcripts réels, confiance faible). Le seuil de rentabilité est ~**20–24 %** ; même un jeu de fixtures salé de tours progress/history n'atteint que **9,4 %**.

Conclusion : **la valeur n'est pas dans le routage progress/history de l'onboarding.** Le chat d'onboarding fait du remplissage qualitatif par design, avec des utilisateurs tout neufs — `ask_progress` / `ask_history` n'a presque rien sur quoi mordre. C'est structurel, corroboré par tous les transcripts survivants.

Donc :

- **Ne pas construire la route Jev sur l'onboarding.** Recommandation du spike : repenser l'onboarding (#505) ou repointer Jev sur le consentement d'écriture MCP (#287).
- **La valeur est ailleurs** : le coaching *entre séances* (#505) et les surfaces où l'utilisateur a un historique à interroger. La porte est ce qui rend ces surfaces joignables — **l'enabler, pas la feature**.
- **Pourquoi pas tout de suite** : la porte n'a de sens que si la capacité qui la justifie existe. Construire la porte avant #505, c'est ouvrir une porte sur une pièce vide.

---

## 3. Le chantier UI préalable

C'est le livrable réel de cette vision. Quatre décisions, dont une seule est purement UI.

### (a) Montage global + surface

Le montage vit dans `AppShell.tsx` — le seul composant qui enveloppe toutes les routes principales (`/`, `/history`, `/builder`, `/programs`, `/library`, `/account`, `/profile`…). Un montage dans `AppShell` survit aux changements de route ; c'est exactement la propriété « disponible partout » qu'on cherche.

Trois surfaces possibles :

| Surface | Ce que c'est | Verdict |
| --- | --- | --- |
| **Route globale** (`/agent`) | Une destination de plus | **Rejeté** — une route n'est pas une porte : on la quitte, on perd le contexte d'écran, et il faut la mettre dans la nav |
| **Orbe** | Une affordance flottante persistante | **Retenu comme entrée** |
| **Sheet** | Le panneau de conversation | **Retenu comme surface** |

**Recommandation : orbe → sheet.** L'orbe est l'affordance toujours présente (un bouton flottant, coin bas, au-dessus du contenu) ; le tap ouvre un **sheet** (bottom sheet mobile, déjà disponible via `src/components/ui/sheet.tsx` et `drawer.tsx`). Le sheet est modal, refermable, et ne change pas de route — on reste sur l'écran d'où on vient. C'est le plus petit montage qui satisfait « partout » sans toucher au routeur.

À trancher : l'orbe doit-elle être visible sur **tous** les écrans, ou masquée pendant une **Session** (le mode « eyes-off » de #501 / #465) ? Recommandation : masquée pendant une Session — une porte qui s'ouvre au milieu d'une série est le mode d'échec de la fusion Bookends.

### (b) Gate expérimental

**Correction factuelle :** le repo n'a **pas** de système de feature flag runtime/remote. Il a un **kill switch build-time** : `src/lib/featureFlags.ts` (`isEmbeddedAgentEnabled()`, env `VITE_FEATURE_EMBEDDED_AGENT`). C'est le seul mécanisme existant.

**Plus petit mécanisme :** suivre ce patron — une fonction `isAgentDoorEnabled()` lisant une env `VITE_FEATURE_AGENT_DOOR`, default-off. Un seul call site, un seul endroit à flipper, rollback par redéploiement. Pas de table de flags, pas de PostgREST, pas de service tiers. Le commentaire de `featureFlags.ts` note déjà qu'une migration vers un flag remote est un follow-up post-GA — la porte n'a pas à l'anticiper.

Limite assumée : un flag build-time ne permet pas de cibler un utilisateur ou un pourcentage. Pour une expérimentation, c'est suffisant au départ ; si on veut un rollout progressif, c'est une décision séparée (HITL).

### (c) Voix

Aucun code de reconnaissance vocale n'existe dans le repo aujourd'hui. Deux options :

| Option | Pour | Contre |
| --- | --- | --- |
| **Web Speech API** (natif) | Zéro dépendance, zéro coût, latence faible, intégré au navigateur | Support inégal (iOS Safari capricieux), l'audio peut transiter par le vendor du navigateur, pas de contrôle sur le modèle |
| **HF Whisper** (`@huggingface/inference`, déjà en dépendance `^4.13.30`) | Contrôle du modèle, comportement homogène cross-browser | Coût par appel, latence réseau, l'audio quitte l'appareil vers HF, une dépendance déjà là mais un nouveau chemin d'inférence |

**Recommandation : Web Speech API d'abord**, Whisper en repli derrière la même interface. La voix est un *input* : on transcrit, puis on envoie le texte au flux agent existant. Le choix du moteur ne doit pas fuiter dans le produit. À trancher : la politique de confidentialité de l'audio (le Web Speech peut envoyer au vendor) — c'est une décision produit, pas technique.

### (d) Thread model — **décision produit ouverte**

Quel thread persiste un chat global ? `embedded_agent_threads` a aujourd'hui un `purpose` contraint à `'onboarding' | 'additional_program'`, avec un index unique partiel `(user_id, purpose)` sur les statuts actifs. Un chat global ne rentre dans aucun des deux.

`docs/CONTEXT.md` est explicite : un **coach global = nouveau type de thread + consentement distinct** (cf. #505). La rétention le confirme — la mémoire de coaching étendue est un épic séparé, avec opt-in explicite et consentement distinct, pas un héritage silencieux des threads d'onboarding.

Options (non tranchées) :

1. **Nouveau `purpose`** (`'coach'` / `'global'`) sur `embedded_agent_threads` — réutilise la table, l'index partiel et la rétention ; ajoute une valeur au CHECK et un consentement.
2. **Nouvelle table** — plus propre si le cycle de vie diverge (pas de `preview_ready` / `committed`, pas de `create_program`), mais duplique la mécanique de quota et de resume.
3. **Réutiliser `additional_program`** — rejeté : ce serait un quatrième sens pour un `purpose` déjà chargé, et ça mélangerait deux consentements.

**Recommandation : option 1**, avec un consentement distinct explicite à l'ouverture (la porte demande l'accord avant de persister un chat global). Mais c'est une **décision HITL** — elle touche la rétention PII et le modèle de consentement, pas juste le schéma.

---

## 4. Relation à #505 et à #552

Trois choses différentes, à ne pas confondre :

| | Quoi | Rôle |
| --- | --- | --- |
| **Cette vision (#556)** | La porte : un point d'entrée global, voix d'abord | **L'entrée** |
| **#505** | L'agent in-program, entre séances : expliquer / proposer un patch au programme actif | **La capacité** |
| **#552** | Jev : routage et gardes au début d'un tour (tranche 1 : `ask_progress` / `ask_history`, zéro modèle) | **Le routeur derrière la porte** |

Séquencement honnête :

1. **#505 d'abord** — la capacité qui justifie la porte. Sans elle, la porte ouvre sur le chat d'onboarding, dont le spike a montré que le routage n'y a pas de gain.
2. **La porte ensuite** — le chantier UI de cette vision (montage global, gate, voix, thread).
3. **#552 / Jev derrière** — une fois la porte et la capacité en place, Jev route les tours. La tranche 1 read-only de #552 est indépendante de la porte (elle vit dans `/send`), mais son gain produit se mesure sur les surfaces que la porte rend joignables.

La porte ne dépend pas de Jev. Jev ne dépend pas de la porte. Mais **la porte sans #505 n'a pas de raison d'être** — c'est le piège principal.

---

## 5. Hors scope / pièges

- **Ne pas promettre la génération Jev.** Jev route et garde, il ne génère jamais de prose (ADR 0023). La porte ne change pas cette frontière.
- **Ne pas promettre le hors-ligne.** L'agent est online-only en v1 (`docs/CONTEXT.md`, **Embedded Agent onboarding product (v1)** règle 2). La voix et le chat exigent le réseau ; la porte doit gérer l'absence de réseau honnêtement, pas la masquer.
- **Ne pas construire la porte avant la capacité.** C'est le piège central : une porte partout vers un agent qui ne sait rien faire de plus qu'aujourd'hui.
- **Ne pas ouvrir la porte pendant une Session.** Le mode eyes-off (#501 / #465) est un invariant produit, pas un détail de placement.
- **Ne pas traiter le thread global comme un thread d'onboarding.** Consentement et rétention distincts (CONTEXT).
- **Pas de refonte de l'onboarding ici.** Le spike a montré où *ne pas* mettre Jev ; repenser l'onboarding est #505, pas cette vision.

---

## 6. Décisions ouvertes (HITL)

À trancher par un humain avant tout ticket :

1. **Surface** — orbe → sheet (recommandé) vs autre. Et : masquée pendant une Session ?
2. **Gate** — kill switch build-time (recommandé) vs rollout progressif ciblé (nécessite un vrai système de flags, inexistant).
3. **Voix** — Web Speech API d'abord (recommandé) vs Whisper ; et la politique de confidentialité de l'audio.
4. **Thread** — nouveau `purpose` (recommandé) vs nouvelle table ; et la forme exacte du consentement distinct.
5. **Séquencement** — confirmer que #505 précède la porte, ou assumer explicitement de construire la porte d'abord.
6. **Périmètre de la porte** — chat seul, ou chat + voix dès la v1 expérimentale ?

---

## Evidence

- **Spike #555** (PR #558, `docs/Spike_—_Jev_routing_gain_on_onboarding.md`) : **0 % de tours routables** (0/10, transcripts réels, confiance faible) ; seuil de rentabilité ~20–24 % ; fixtures salées 9,4 %. Recommandation : ne pas construire la route Jev sur l'onboarding ; repenser l'onboarding (#505) ou repointer Jev sur le consentement MCP (#287).
- **ADR 0023** (`file:docs/adr/0023-jev-verdicts-only-embedded-agent.md`) : Jev = verdicts only, entrée par l'app, tranche 1 read-only. Correction datée du 28/09 (PR #557) : le credential `system_one` répond **200** (l'ADR notait 401) ; la décision de réparer le credential plutôt que changer de modèle est maintenue ; le consentement d'écriture MCP est réconcilié avec #287 (contrat de prompt vs enforcement serveur).
- **État du repo (vérifié)** : `EmbeddedAgentChatStep` monté uniquement dans `OnboardingPage.tsx` et `CreateProgramPage.tsx` ; pas de route chat globale ; `AppShell.tsx` enveloppe toutes les routes principales ; `src/lib/featureFlags.ts` = kill switch build-time, pas de flag runtime ; `@huggingface/inference` en dépendance ; aucun code de reconnaissance vocale.