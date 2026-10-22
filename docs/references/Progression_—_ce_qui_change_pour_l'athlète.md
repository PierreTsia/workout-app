# Ce qui a changé avec le moteur de progression

**Note de travail — source pour un futur article du blog.** Suite naturelle de
`add-a-rep-before-a-plate` (14/08/2026), qui se terminait sur deux choses que le moteur ne faisait
pas : « *There is no deload when you stall for a month* » et « *A jump is not a percentage* ». Les
deux sont traitées ici.

Aucun chiffre n'est inventé : tout vient de la prod ou du code. Les endroits où on **parie** sont
signalés comme tels, parce que c'est le genre de détail qui fait la différence entre un article et un
communiqué.

*Le corps de ce doc est en français (note interne). L'article publié serait en anglais, comme les
autres.*

---

## En une phrase

Avant, le moteur te proposait une charge, et quand ça n'avançait plus, il continuait de te proposer la
même chose. Maintenant, il sait quelle charge tu peux réellement monter dans ta salle, il sait te
sortir d'un blocage, et il retient la décision que tu as prise en cours de séance.

---

## 1. Ta décision en séance était effacée la fois d'après

**Avant.** Le moteur pouvait te proposer de **baisser la charge en cours de séance**, quand il voyait
que tu galérais. Tu suivais. Et à la séance suivante, il te reproposait la cible du début — comme si
rien ne s'était passé. Trois séances à décharger, et la quatrième repartait du point de départ.

Le moteur parlait, mais sa propre décision n'atteignait jamais la prescription suivante. Une boucle
ouverte.

**Maintenant.** Si tu décharges en séance sur sa suggestion, cette décision devient le **point de
départ de la prochaine séance**. Tu reprends là où tu t'es réellement arrêté.

**Ce que ça change pour toi :** ton ajustement en salle compte. Il n'est plus effacé.

---

## 2. Un blocage n'avait aucune issue — il en a une

**Avant.** Tu pouvais t'acharner sur la même prescription pendant des semaines : mêmes kilos, mêmes
répétitions, à chaque fois à l'échec ou presque. Le moteur te reproposait la même chose, indéfiniment.

Il existait bien un état « plateau » dans le code, mais il fallait réunir trois conditions, dont un
réglage que **tu** devais activer à la main. Sur toute l'histoire de l'app en production, **un seul
exercice** y est jamais arrivé. Pendant ce temps, **22 exercices** étaient réellement bloqués — cible
figée sur 4 séances ou plus. Le vrai problème n'était pas là où le code le cherchait.

**Maintenant.** Après **4 séances d'affilée** où la cible ne bouge pas **et** où ta dernière séance
était à RIR ≤ 1 (tu poussais vraiment), le moteur prescrit **une séance de décharge** : un cran de
charge en moins — ou −15 % de répétitions sur les exercices au poids du corps, à la poulie ou à
l'élastique. Séries inchangées. **Une seule séance**, puis il reprend la progression normale.

Tu la vois passer : une pastille **« Décharge »** apparaît avec la raison. Une charge qui baisse sans
explication ressemblerait à un bug.

**Les garde-fous — il y en a beaucoup, c'est voulu :**

- **Tu ne notes pas ton RIR ?** Aucune décharge. Le silence n'est pas un zéro.
- **Tu tiens la cible confortablement ?** Aucune décharge. Le moteur ne te punit pas de t'entraîner à
  une charge tenable.
- **Tu ignores la décharge et tu remontes quand même ?** La série de séances figées casse, et il arrête
  d'insister.
- **Tu as modifié ton programme entre-temps ?** Ta modification gagne. Ton intention reste souveraine.
- **Rien n'est enregistré.** Tout se déduit de ton historique : rien ne peut « dériver » d'une séance à
  l'autre.

**Ce que ça change pour toi :** au lieu de te battre contre le même chiffre pendant un mois, tu reçois
une séance plus légère — une fois — et tu remontes.

---

## 3. Le moteur te demandait des charges qui n'existent pas

**Avant.** Le moteur montait la charge d'un **pas fixe** : 2,5 kg à la barre, 2 kg aux haltères. Il ne
savait pas ce que ta salle propose.

Or les haltères passent de 2 en 2 jusqu'à 20 kg, puis de 5 en 5 : au-delà de 20 kg, le « pas » vaut
**+25 %**. Dans une salle pauvre (20 → 30 kg), **+50 %**. Le moteur pouvait donc te demander 22,5 kg sur
des haltères qui n'existent pas, ou un bond que tu allais rater.

C'est exactement le point que l'article précédent appelait *the bug report* : le prochain haltère d'une
élévation latérale, souvent une blague.

**Maintenant.** Chaque famille d'équipement a une **échelle de charges** : la liste des charges que tu
peux réellement composer.

| Famille | L'échelle |
|---|---|
| Haltères | 2 en 2 jusqu'à 20 kg, puis 5 en 5 |
| Barre | les totaux atteignables avec un jeu de disques standard |
| Machines, poulies | le pas de la pile |

Le moteur prend **le cran suivant de l'échelle**. Et si ce cran est **trop loin** — plus de 30 % de
plus — il ne te fait pas échouer : il **ajoute une série** à ta charge actuelle. Quand les séries sont
au maximum aussi, c'est la décharge du point 2 qui prend le relais.

Bonus : la décharge descend elle aussi d'un cran d'échelle. La charge de récupération est une charge
que tu peux charger.

**Ce que ça change pour toi :** plus de charge impossible. Et quand le palier suivant est un mur, tu
gagnes une série au lieu de rater une séance.

---

## Ce que ça ne fait toujours pas

Honnête, parce que l'article précédent avait cette section et qu'elle vieillit bien.

- **Pas de mésocycle.** Le moteur raisonne exercice par exercice, séance par séance. Il n'a aucune idée
  du volume déjà encaissé par un groupe musculaire dans la semaine.
- **La décharge ne juge pas ta fatigue.** Elle se déclenche sur un signal de stagnation, pas sur une
  lecture de ta récupération. Un sommeil pourri, un rhume, une semaine chargée au boulot : il ne les
  voit pas.
- **Aucun délai de temps.** « 4 séances » veut dire 4 séances — espacées de 4 jours ou de 4 semaines,
  c'est pareil pour lui.
- **Il n'estime pas encore ta force.** La conversion « 50 kg × 12 » contre « 55 kg × 9 » a été
  **abandonnée** : les deux cas qu'elle devait servir sont déjà couverts par la décharge. Si un besoin
  réapparaît, il reviendra par un autre chemin.

---

## Les chiffres

| | Valeur | Statut |
|---|---|---|
| Séances de stagnation avant décharge | 4 | valeur de départ |
| RIR moyen à la dernière séance | ≤ 1 | valeur de départ |
| Effet de la décharge | −1 cran d'échelle, ou −15 % de reps | |
| Saut refusé au-delà de | +30 % | valeur de départ |
| Pas des haltères | 2 kg jusqu'à 20, puis 5 kg | supposition (salle standard) |
| Pas d'une pile | 5 kg | changement assumé |
| Séries, plage de reps, durée | jamais touchées par la décharge | |

**« Valeur de départ » n'est pas une coquetterie.** Les seuils (4 séances, 30 %) et les échelles par
défaut sont des **points de départ documentés, pas des valeurs validées**. On les a posés sans
données : l'instrumentation qui devait les éclairer — l'enregistrement des règles réellement servies —
n'a été déployée qu'avec la version précédente et n'a encore rien collecté. On les ajustera quand elle
aura de la matière. Le dire vaut mieux que de faire semblant.

---

## Pour l'article (notes de production)

- **La suite est toute trouvée.** `add-a-rep-before-a-plate` se terminait sur « *There is no deload when
  you stall for a month* » et « *A jump is not a percentage* ». Les deux sont réglés ici. C'est
  littéralement la partie 2, et le titre peut s'y adosser.
- **Les captures existent déjà.** La passe QA a produit trois écrans réels : haltères 20 → 25 kg
  (le cran qui existe), machine 5 kg → +1 série (le saut refusé), stagnation 25 kg → décharge 20 kg.
  Conservées dans `/tmp/qa-705-p4/`. À refaire avec de vraies données si on publie.
- **Le gabarit de l'article précédent est le bon** : première personne, sources citées quand il y en a,
  un bloc `TechHeavy` pour le code, et une section « ce que ça ne fait pas ».
- **Détails techniques** si l'article doit descendre dans le code : `docs/Epic_Brief_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md`,
  `docs/Tech_Plan_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md`, et les ADR
  `docs/adr/0032-progression-anchor-reps.md`, `0033-plateau-exit-triggered-by-prescription-stall.md`,
  `0034-load-ladder-constrains-prescribed-load.md`.
- **À éviter dans l'article** : les noms de code (échelle = *load ladder*, décharge = *deload* côté
  anglais), et le mot « palier » tout court — il est déjà pris par un réglage du Builder, ce qui prête
  à confusion même en interne (cf. issue #720).
