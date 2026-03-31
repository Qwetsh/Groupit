---
title: 'Langue étrangère pour l''oral DNB'
slug: 'langue-etrangere-oral'
created: '2026-03-31'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'Zustand', 'Supabase', 'Vitest']
files_to_modify:
  - 'src/domain/models/eleve.ts'
  - 'src/algorithms/solverDnb.ts'
  - 'src/components/guided/steps/StepThemesEleves.tsx'
  - 'src/infrastructure/export/templateOralDNB.ts'
  - 'src/infrastructure/export/types.ts'
  - 'src/infrastructure/export/dataMapper.ts'
  - 'src/infrastructure/export/PdfComponents.tsx'
  - 'src/infrastructure/export/supabaseUpload.ts'
  - 'packages/shared/src/database.types.ts'
  - 'apps/jury/src/screens/EvaluateScreen.tsx'
  - 'apps/jury/src/screens/StudentListScreen.tsx'
  - 'apps/dashboard/src/components/JuryTable.tsx'
code_patterns:
  - 'matierePrincipale enseignant used for language matching (no new field on teacher)'
  - 'solverDnb scoring: weighted components combined in scoreEleveJury()'
  - 'Language is priority 1 soft constraint (prefer jury with lang teacher, fallback ok)'
  - 'StepThemesEleves has parcours/sujet/matiere dropdowns — add langue dropdown same pattern'
test_patterns:
  - 'Vitest avec describe/it, fichiers *.test.ts colocalisés'
  - 'solverDnb.test.ts à étendre pour langue matching'
---

# Tech-Spec: Langue étrangère pour l'oral DNB

**Created:** 2026-03-31

## Overview

### Problem Statement

Certains élèves choisissent de passer tout ou partie de leur oral du DNB en langue étrangère (anglais, espagnol, allemand ou chinois). Actuellement, le système ne permet pas de renseigner ce choix, et l'algorithme de composition des jurys ne prend pas en compte la nécessité d'avoir un enseignant de la langue dans le jury.

### Solution

Ajouter un champ optionnel `langueEtrangere` sur l'élève, saisie manuellement dans le wizard (étape Thèmes). L'algorithme de matching priorise en priorité 1 les jurys ayant un enseignant dont `matierePrincipale` correspond à la langue choisie, avec fallback vers un jury sans prof de la langue si plus de place. Affichage clair de la langue sur les écrans d'évaluation et les documents PDF.

### Scope

**In Scope:**
- Champ `langueEtrangere?: string` sur le modèle Eleve
- Constante `LANGUES_ETRANGERES = ['Anglais', 'Espagnol', 'Allemand', 'Chinois']`
- Saisie dans StepThemesEleves (dropdown, même pattern que matières)
- Template Excel : colonne "Langue Étrangère" avec dropdown
- Algorithme solverDnb : scoring prioritaire pour jury avec prof de la langue
- Supabase : champ `langue` dans session_eleves
- Jury PWA : affichage sur StudentListScreen + EvaluateScreen
- PDF : mention sur convocations et tableaux
- Dashboard : indication visuelle

**Out of Scope:**
- Import CSV dédié de la langue (mais supporté via template Excel)
- Multi-langues par élève (un seul choix)
- Champ langue dédié sur l'enseignant (on utilise `matierePrincipale`)

## Context for Development

### Codebase Patterns

- **solverDnb scoring** : `scoreEleveJury()` (lignes 164-326) combine des composantes pondérées : scoreMatiere, scoreEquilibrage, scoreMixite, scoreCapacite. Le score final = somme pondérée. On ajoute `scoreLangue` au même niveau.
- **StepThemesEleves** : Table éditable avec dropdowns pour parcours, sujet, matière 1, matière 2. La langue s'ajoute comme une colonne de plus avec le même pattern de dropdown.
- **Template Excel** : `templateOralDNB.ts` génère un fichier avec data validation (dropdowns). On ajoute une colonne H "Langue Étrangère" avec la même technique.
- **Supabase upload** : `uploadJuryEleves()` mappe `ExportEleveData` → row session_eleves. On ajoute `langue: eleve.langueEtrangere || null`.
- **Matching matière existant** : `getJuryMatieres()` extrait les `matierePrincipale` de chaque enseignant du jury. Pour la langue, on vérifie si la langue de l'élève est dans cette liste.

### Files to Reference

| File | Purpose | Impact |
| ---- | ------- | ------ |
| `src/domain/models/eleve.ts:61-64` | Champs oral DNB | Ajouter `langueEtrangere?: string` |
| `src/algorithms/solverDnb.ts:164-326` | `scoreEleveJury()` | Ajouter composante `scoreLangue` |
| `src/algorithms/solverDnb.ts:96-107` | `getJuryMatieres()` | Réutiliser pour check langue |
| `src/components/guided/steps/StepThemesEleves.tsx:484-565` | Table thèmes/sujets | Ajouter colonne langue |
| `src/infrastructure/export/templateOralDNB.ts:24-105` | Template Excel | Ajouter colonne + validation |
| `src/infrastructure/export/types.ts:14-33` | ExportEleveData | Ajouter `langueEtrangere` |
| `src/infrastructure/export/dataMapper.ts:57-92` | mapEleveAffecte | Mapper `langueEtrangere` |
| `src/infrastructure/export/PdfComponents.tsx` | PDFs | Afficher langue |
| `src/infrastructure/export/supabaseUpload.ts:243-255` | Upload session_eleves | Mapper `langue` |
| `packages/shared/src/database.types.ts:107-134` | SessionEleveRow | Ajouter `langue` |
| `apps/jury/src/screens/EvaluateScreen.tsx:280-313` | Header élève | Afficher langue |
| `apps/jury/src/screens/StudentListScreen.tsx:98-113` | Liste élèves | Afficher langue |
| `apps/dashboard/src/components/JuryTable.tsx:127-135` | Table jury | Badge langue |

### Technical Decisions

- **Matching via `matierePrincipale`** : Un prof d'anglais a `matierePrincipale = "Anglais"`. Pas besoin d'un champ séparé sur l'enseignant. La fonction `getJuryMatieres()` retourne déjà toutes les matières du jury — on vérifie si la langue de l'élève y figure.
- **Contrainte souple prioritaire** : Ce n'est PAS une contrainte dure. L'algo donne un gros bonus de score (poids élevé) quand le jury a un prof de la langue. Si aucun jury avec la langue n'a de place, l'élève est quand même affecté au meilleur jury disponible.
- **Langues = liste fixe** : `['Anglais', 'Espagnol', 'Allemand', 'Chinois']`. Définie comme constante exportée.
- **Saisie dans StepThemesEleves** : Pas de nouvelle étape dans le wizard. La langue est un dropdown optionnel ajouté à la table des thèmes (à côté des matières).

## Implementation Plan

### Tasks

#### Phase 1 — Modèle de données

- [ ] Task 1: Ajouter `langueEtrangere` au modèle Eleve et constante langues
  - File: `src/domain/models/eleve.ts`
  - Action: Ajouter `langueEtrangere?: string;` après `matieresOral` (ligne ~62). Commentaire : "Langue étrangère choisie pour l'oral (optionnel)".
  - File: `src/domain/models/index.ts` ou fichier dédié
  - Action: Exporter constante `LANGUES_ETRANGERES = ['Anglais', 'Espagnol', 'Allemand', 'Chinois'] as const;`

- [ ] Task 2: Ajouter `langue` aux types DB partagés
  - File: `packages/shared/src/database.types.ts`
  - Action: Ajouter `langue: string | null;` à `SessionEleveRow` (après ligne 115) et `langue?: string | null;` à `SessionEleveInsert` (après ligne 129).
  - Notes: Migration Supabase : `ALTER TABLE session_eleves ADD COLUMN langue TEXT;`

- [ ] Task 3: Ajouter `langueEtrangere` aux types d'export
  - File: `src/infrastructure/export/types.ts`
  - Action: Ajouter `langueEtrangere?: string;` à `ExportEleveData` (après ligne ~30).

#### Phase 2 — Algorithme

- [ ] Task 4: Ajouter le scoring langue dans solverDnb
  - File: `src/algorithms/solverDnb.ts`
  - Action: Dans `scoreEleveJury()` (lignes 164-326) :
    - Après le scoring matière (~ligne 207), ajouter :
      ```
      let scoreLangue = 0;
      if (eleve.langueEtrangere) {
        const juryMatieres = getJuryMatieres(jury, enseignantMap);
        const hasLangueTeacher = juryMatieres.includes(eleve.langueEtrangere);
        scoreLangue = hasLangueTeacher ? 100 : 0;
      }
      ```
    - Ajouter `scoreLangue` dans le calcul final pondéré (lignes 318-326). Poids élevé (ex: `wLangue = 50`) pour que ce soit la priorité n°1.
    - Dans l'explication de l'affectation, mentionner si la langue est satisfaite ou non.
  - Notes: Si l'élève n'a pas de `langueEtrangere`, `scoreLangue = 0` et le poids est ignoré (pas d'impact sur les solos). Le score reste en "lower is better" ou "higher is better" selon le pattern existant — vérifier et adapter.

- [ ] Task 5: Tests solverDnb pour la langue
  - File: `src/algorithms/solverDnb.test.ts` (étendre)
  - Action: Tests : (1) élève avec langue anglais → affecté au jury avec prof d'anglais, (2) élève avec langue anglais + aucun jury avec prof d'anglais → affecté quand même (fallback), (3) élève sans langue → scoring inchangé, (4) 2 élèves anglais + 1 seul jury avec prof anglais + capacité insuffisante → 1 affecté là, l'autre en fallback.

#### Phase 3 — UI Wizard

- [ ] Task 6: Ajouter le dropdown langue dans StepThemesEleves
  - File: `src/components/guided/steps/StepThemesEleves.tsx`
  - Action:
    - Ajouter handler `handleSetLangue(eleveId, langue)` (même pattern que `handleSetMatiere`, ~ligne 160).
    - Ajouter colonne "Langue" dans le header table (~ligne 489) après "Matière 2".
    - Ajouter dropdown `<select>` avec les options `LANGUES_ETRANGERES` + option vide "--" dans chaque row (~ligne 565).
    - Style : `oral-select oral-select-sm` existant, classe `has-value` si langue sélectionnée.
  - Notes: Le dropdown est optionnel (la plupart des élèves ne choisissent pas de langue). Valeur par défaut = vide.

- [ ] Task 7: Mettre à jour le template Excel
  - File: `src/infrastructure/export/templateOralDNB.ts`
  - Action:
    - Ajouter "Langue Étrangère" aux headers (ligne 24, colonne H).
    - Ajouter le mapping dans les rows de données (ligne ~48).
    - Ajouter la largeur de colonne (ligne ~69).
    - Ajouter data validation dropdown avec `LANGUES_ETRANGERES.join(',')` (lignes 76-105).
    - Ajouter détection de la colonne dans le parsing import (ligne ~158) : `getCol(['langue', 'langue étrangère', 'langue etrangere'])`.
    - Mettre à jour `OralDNBImportRow` (ligne ~127) : ajouter `langue: string`.
  - File: `src/components/guided/steps/StepThemesEleves.tsx`
  - Action: Dans `executeImport()` (~ligne 275), mapper `row.langue` vers `langueEtrangere` de l'élève.

#### Phase 4 — Export & PDF

- [ ] Task 8: Mettre à jour le data mapper
  - File: `src/infrastructure/export/dataMapper.ts`
  - Action: Dans `mapEleveAffecte()` (~ligne 57-92), ajouter `langueEtrangere: eleve.langueEtrangere` au retour.

- [ ] Task 9: Mettre à jour les composants PDF
  - File: `src/infrastructure/export/PdfComponents.tsx`
  - Action:
    - StudentTable : si `eleve.langueEtrangere`, afficher un badge (ex: "🌐 Anglais") à côté du nom ou dans une colonne dédiée.
    - EleveConvocationPage : ajouter "Vous présenterez tout ou partie de votre oral en {langue}." dans la convocation.
    - DoorListPage : ajouter indicateur langue à côté du nom si applicable.

- [ ] Task 10: Mettre à jour l'upload Supabase
  - File: `src/infrastructure/export/supabaseUpload.ts`
  - Action: Dans `uploadJuryEleves()` (~ligne 243-255), ajouter `langue: eleve.langueEtrangere || null` dans la row session_eleves.

#### Phase 5 — Jury PWA + Dashboard

- [ ] Task 11: Afficher la langue sur EvaluateScreen
  - File: `apps/jury/src/screens/EvaluateScreen.tsx`
  - Action: Après l'affichage du sujet (~ligne 311), ajouter un badge visible si `eleve.langue` est renseigné. Ex: `<span style={styles.langueBadge}>🌐 {eleve.langue}</span>`. Le badge doit être bien visible (couleur, taille) car le jury doit savoir dans quelle langue évaluer.

- [ ] Task 12: Afficher la langue sur StudentListScreen
  - File: `apps/jury/src/screens/StudentListScreen.tsx`
  - Action: Dans l'affichage de chaque élève (~lignes 98-113), ajouter un petit badge langue si `eleve.langue` est renseigné. Même style que le badge binôme/trinôme.

- [ ] Task 13: Afficher la langue sur JuryTable (dashboard)
  - File: `apps/dashboard/src/components/JuryTable.tsx`
  - Action: Si `eleve.langue`, afficher un badge à côté du nom (ex: badge bleu "EN" / "ES" / "DE" / "ZH"). Même pattern que le badge binôme.

### Acceptance Criteria

- [ ] AC 1: Given l'étape Thèmes du wizard, when un élève est affiché, then un dropdown "Langue Étrangère" optionnel est disponible avec les choix Anglais/Espagnol/Allemand/Chinois.
- [ ] AC 2: Given un élève avec `langueEtrangere = "Anglais"`, when l'algo solverDnb tourne, then l'élève est affecté en priorité à un jury contenant un enseignant avec `matierePrincipale = "Anglais"`.
- [ ] AC 3: Given un élève avec `langueEtrangere = "Anglais"` et aucun jury avec prof d'anglais ayant de la place, when l'algo tourne, then l'élève est quand même affecté à un autre jury (fallback, pas non-affecté).
- [ ] AC 4: Given un élève sans `langueEtrangere`, when l'algo tourne, then le scoring est inchangé (pas d'impact sur les élèves sans langue).
- [ ] AC 5: Given le template Excel téléchargé, when ouvert dans Excel, then une colonne "Langue Étrangère" est présente avec un dropdown de validation.
- [ ] AC 6: Given un élève avec langue renseignée, when le jury ouvre sa fiche sur la tablette (EvaluateScreen), then la langue est affichée de façon bien visible (badge).
- [ ] AC 7: Given la StudentListScreen, when un élève a une langue étrangère, then un badge langue est affiché à côté de son nom.
- [ ] AC 8: Given un PDF de convocations, when un élève a une langue étrangère, then la convocation mentionne "Vous présenterez tout ou partie de votre oral en {langue}."
- [ ] AC 9: Given le dashboard JuryTable, when un élève a une langue, then un badge compact (ex: "EN") est affiché.

## Additional Context

### Dependencies

- Migration Supabase : `ALTER TABLE session_eleves ADD COLUMN langue TEXT;`
- Constante `LANGUES_ETRANGERES` partagée entre wizard, template Excel, et potentiellement le solver

### Testing Strategy

**Tests unitaires (Vitest) :**
- `solverDnb.test.ts` : élève avec langue → jury avec prof de la langue, fallback si pas de place, pas d'impact sans langue, mix solos+langue

**Tests manuels :**
- Wizard : sélectionner une langue, vérifier qu'elle persiste, télécharger template Excel → colonne présente, importer fichier avec langue
- Algo : lancer le matching avec quelques élèves "Anglais" et vérifier l'affectation
- PWA : ouvrir un élève avec langue → badge visible
- PDF : convocation avec mention langue

### Notes

**Risques :**
- Le scoring solverDnb utilise un système "higher is better" ou "lower is better" selon les composantes — bien vérifier le sens du score avant d'implémenter `scoreLangue`
- Les noms de langues dans `LANGUES_ETRANGERES` doivent correspondre exactement aux `matierePrincipale` des enseignants (ex: "Anglais" et pas "English")

**Ordre d'exécution recommandé :**
Phase 1 (Tasks 1-3) → Phase 2 (Tasks 4-5) → Phase 3 (Tasks 6-7) → Phase 4 (Tasks 8-10) → Phase 5 (Tasks 11-13)

**Futur (hors scope) :**
- Import CSV dédié avec colonne langue
- Multi-langues par élève
- Critères d'évaluation spécifiques par langue (grille adaptée)
