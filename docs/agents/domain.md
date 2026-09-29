# Domain docs — workout-app (GymLogic)

**Single-context** : un glossaire et un seul.

- Glossaire : [`docs/CONTEXT.md`](../CONTEXT.md) — le vocabulaire ubiquitaire, rien d'autre.
- Décisions : [`docs/adr/`](../adr/) — `NNNN-slug.md`, décisions structurantes uniquement.

## Comment les lire

- Charger le glossaire avant de nommer quoi que ce soit : un concept s'écrit avec le mot du
  glossaire, pas avec un synonyme dérivé. Les mots du domaine (Programme, Jour, Bloc,
  Session, Série, Score, Tag de muscle…) ont une définition ici et le code les emploie tels
  quels.
- Le glossaire n'est **pas** une spec ni un carnet d'implémentation : pas de détail technique,
  pas de description de comportement. Un comportement va dans le PRD ou le code, un choix
  technique dans un ADR.
- Un outil MCP est une interface publique : un changement de nom, de paramètre ou de forme
  de réponse est un choix structurant — ADR + test, jamais un renommage discret.
- `domain-modeling` fait autorité pour écrire : un terme tranché entre dans le glossaire dans
  la foulée ; un ADR ne s'écrit que s'il est dur à inverser, surprenant sans contexte et le
  résultat d'un vrai arbitrage.
- Une décision qui **contredit** un ADR existant se signale (« contredit ADR 0003, mais… »),
  jamais en silence.
- Un second contexte délimité s'introduit par un `CONTEXT-MAP.md`, jamais par un deuxième
  `CONTEXT.md` posé à côté.
