---
title: 'Support des groupes oraux (binômes + trinômes)'
slug: 'support-groupes-oral'
created: '2026-03-31'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'Zustand', 'Supabase', 'Vitest', '@react-pdf/renderer', 'dnd-kit']
files_to_modify:
  - 'src/domain/models/eleve.ts'
  - 'src/stores/eleveStore.ts'
  - 'src/stores/uiStore.ts'
  - 'packages/shared/src/database.types.ts'
  - 'src/components/guided/GuidedMode.tsx'
  - 'src/components/guided/steps/StepBinomes.tsx'
  - 'src/components/guided/GuidedMode.css'
  - 'src/algorithms/solverDnb.ts'
  - 'src/algorithms/timeSlots.ts'
  - 'src/infrastructure/export/types.ts'
  - 'src/infrastructure/export/dataMapper.ts'
  - 'src/infrastructure/export/PdfComponents.tsx'
  - 'src/infrastructure/export/supabaseUpload.ts'
  - 'apps/jury/src/App.tsx'
  - 'apps/jury/src/screens/BinomeEvaluateScreen.tsx'
  - 'apps/jury/src/screens/StudentListScreen.tsx'
  - 'apps/dashboard/src/components/JuryTable.tsx'
code_patterns:
  - 'Bidirectional binomeId → shared groupeOralId (UUID, NOT a FK)'
  - 'Hardcoded tuple [Row, Row] → SessionEleveRow[]'
  - 'Two distinct concepts: jury capacity (= group members count) vs time slots consumed (= ceil(duration/20))'
  - 'getGroupDuration(size): 1→20, 2→25, 3→35, fallback→20'
  - 'Two-pass Supabase upload for referential integrity'
test_patterns:
  - 'Vitest avec describe/it, fichiers *.test.ts colocalisés'
  - 'Tests getGroupDuration dans timeSlots.test.ts (pas de fichier séparé)'
---

# Tech-Spec: Support des groupes oraux (binômes + trinômes)

**Created:** 2026-03-31

## Overview

### Problem Statement

Le système oral DNB ne supporte actuellement que les binômes (paires de 2 élèves). Les élèves peuvent aussi choisir de passer en trinôme (groupe de 3). Le modèle actuel repose sur un champ `binomeId` symétrique (A→B, B→A) qui ne peut pas représenter un groupe de 3.

### Solution

Remplacer le modèle `binomeId` par un `groupeOralId` partagé par tous les membres d'un groupe. Adapter l'ensemble de la chaîne (UI wizard, évaluation, algorithme, créneaux horaires, PDF, export) pour supporter des groupes de taille variable (1 à 3).

### Scope

**In Scope:**
- Nouveau modèle de données : `groupeOralId` remplace `binomeId`
- Durées de passage : solo 20min, binôme 25min, trinôme 35min
- StepBinomes → StepGroupes : interface de création de paires ET trinômes
- BinomeEvaluateScreen → GroupeEvaluateScreen : 2 ou 3 onglets dynamiques
- Algorithme jury (solverDnb) : affecter un groupe entier au même jury
- TimeSlots : calcul des créneaux selon la taille du groupe
- PDF + export Supabase : afficher les membres du groupe
- Dashboard (JuryTable) : badge groupe au lieu de badge binôme
- StudentListScreen (jury PWA) : détection et gestion des groupes
- Migration Supabase : colonne `binome_id` → `groupe_oral_id`

**Out of Scope:**
- Groupes de 4 élèves ou plus
- Migration de données existantes (sessions test seront détruites)
- Modification de l'import CSV élèves (groupes créés manuellement dans le wizard)

## Context for Development

### Codebase Patterns

- **Store pattern** : Zustand avec actions async, persistance localStorage + Dexie
- **Modèle élève** : `Eleve` dans `src/domain/models/eleve.ts`, champ `binomeId?: string` (ligne 64)
- **Store élève** : `setBinome(aId, bId)` crée un lien bidirectionnel, `removeBinome(id)` le supprime
- **Algo DNB** : `solverDnb.ts` — 3 phases d'affectation, binômes traités comme unité atomique
- **TimeSlots** : `assignTimeSlots()` — binômes = même créneau + skip 1 slot (durée doublée)
- **Évaluation** : Tuple hardcodé `[SessionEleveRow, SessionEleveRow]`, 2 onglets, timer partagé, scores indépendants
- **Export PDF** : `binomeNom` résolu dans `dataMapper.ts`, affiché avec ♦ dans les tableaux PDF
- **Upload Supabase** : Two-pass (create students → resolve `binome_id` links)
- **DB shared types** : `SessionEleveRow.binome_id`, `SessionEleveInsert.binome_id`

### Files to Reference

| File | Purpose | Impact |
| ---- | ------- | ------ |
| `src/domain/models/eleve.ts:64` | `binomeId?: string` | → `groupeOralId?: string` |
| `src/stores/eleveStore.ts:239-291` | `setBinome()`, `removeBinome()` | → `setGroupeOral()`, `removeFromGroupeOral()` |
| `src/stores/uiStore.ts:13` | GuidedStep type avec `'binomes'` | → `'groupes'` |
| `packages/shared/src/database.types.ts:115,129` | `binome_id` dans SessionEleveRow | → `groupe_oral_id` |
| `src/components/guided/GuidedMode.tsx:22,31,78` | Step `'binomes'` dans workflow | → `'groupes'` |
| `src/components/guided/steps/StepBinomes.tsx` | UI création binômes (231 lignes) | Refonte → StepGroupes.tsx |
| `src/algorithms/solverDnb.ts:440-491` | `affectEleve()` avec binôme | Capacité = membres, time slots = durée |
| `src/algorithms/timeSlots.ts:18,162-194` | `DUREE_PASSAGE_MIN=20`, slot skip | Durée variable via helper |
| `apps/jury/src/screens/BinomeEvaluateScreen.tsx` | Évaluation 2 étudiants (596 lignes) | → GroupeEvaluateScreen, N onglets |
| `apps/jury/src/screens/StudentListScreen.tsx:353-412` | Détection binômes, tuple cast | → Groupes dynamiques |
| `apps/jury/src/App.tsx:15,93-106,220-231` | Screen type `'evaluate-binome'` | → `'evaluate-groupe'` |
| `apps/dashboard/src/components/JuryTable.tsx:127-135` | Badge "Binôme" violet | → Badge dynamique |
| `src/infrastructure/export/types.ts:25-26` | `binomeNom`, `binomeEleveId` | → `groupeMembresNoms: string[]` |
| `src/infrastructure/export/dataMapper.ts:67-84` | Résolution nom partenaire | → Résolution N membres |
| `src/infrastructure/export/PdfComponents.tsx` | ♦ binôme dans tableaux | → Noms multiples |
| `src/infrastructure/export/supabaseUpload.ts:168-220` | Two-pass binome_id | → Two-pass groupe_oral_id (UUID) |

### Technical Decisions

- **Modèle `groupeOralId`** : UUID partagé par tous les membres (2 ou 3). Solos = pas de `groupeOralId`. Membres retrouvés par `eleves.filter(e => e.groupeOralId === id)`.
- **Pas de migration de données** : `binomeId` supprimé, remplacé par `groupeOralId`. Sessions test détruites. Mais la colonne Supabase doit être migrée (Task 4b).
- **Durées variables** : Helper `getGroupDuration(size)` : 1→20min, 2→25min, 3→35min. Fallback pour inputs invalides (0, 4+, NaN) → 20min.
- **IMPORTANT — Deux concepts distincts :**
  - **Capacité jury** = nombre de membres du groupe (binôme=2, trinôme=3). Chaque membre occupe 1 place de capacité.
  - **Time slots consommés** = `Math.ceil(getGroupDuration(groupSize) / 20)` → solo=1, binôme=2, trinôme=2. C'est le nombre de créneaux de 20min que le passage occupe dans le planning.
- **`groupe_oral_id` Supabase** : C'est un UUID partagé (PAS un FK vers un autre élève). Changement sémantique par rapport à `binome_id` qui était le row ID du partenaire. Le UUID est généré côté client dans `supabaseUpload.ts` (un par groupe).
- **Évaluation** : Scores indépendants par élève. Timer partagé initialisé à `getGroupDuration(groupSize)`. N onglets dynamiques.
- **Absence partielle** : Si 1 membre d'un groupe est marqué absent pendant l'évaluation, la durée et les slots ne changent PAS (le jury a déjà le créneau réservé). Seuls les membres présents sont évalués et soumis. Le `duree_passage` reste celui du groupe original.
- **UI StepGroupes** : Interface click-based (comme StepBinomes). Pas de drag-and-drop — le DnD n'est utilisé que dans l'éditeur de jurys, pas dans la création de groupes.

## Implementation Plan

### Tasks

#### Phase 1 — Modèle de données & Store (fondations)

- [ ] Task 1: Remplacer `binomeId` par `groupeOralId` dans le modèle Eleve
  - File: `src/domain/models/eleve.ts`
  - Action: Ligne 64 — remplacer `binomeId?: string` par `groupeOralId?: string`. Mettre à jour le commentaire : "Groupe oral : UUID partagé par les membres du groupe (2 ou 3 élèves)".
  - Notes: Champ optionnel. Les solos n'ont pas de groupeOralId.

- [ ] Task 2: Ajouter helper `getGroupDuration(size)`
  - File: `src/algorithms/timeSlots.ts`
  - Action: Ajouter export function `getGroupDuration(size: number): number`. Retourne : `size === 2 → 25`, `size === 3 → 35`, tout autre input (1, 0, 4+, NaN) → `20`. Exporter depuis `src/algorithms/index.ts`.
  - Notes: Utilisé dans timeSlots, solverDnb, supabaseUpload. Le fallback à 20 est intentionnel pour robustesse.

- [ ] Task 3: Refondre les actions du store élève
  - File: `src/stores/eleveStore.ts`
  - Action:
    - Remplacer `setBinome(aId, bId)` par `setGroupeOral(eleveIds: string[])` (accepte 2 ou 3 IDs).
    - Étapes de `setGroupeOral` : (1) Pour chaque eleveId, si l'élève a déjà un `groupeOralId`, appeler `removeFromGroupeOral` d'abord. (2) Générer un UUID via `crypto.randomUUID()`. (3) Assigner ce UUID comme `groupeOralId` à tous les membres.
    - Remplacer `removeBinome(eleveId)` par `removeFromGroupeOral(eleveId)` : (1) Trouver tous les élèves avec le même `groupeOralId`. (2) Retirer `groupeOralId` de l'élève ciblé. (3) Si le groupe restant n'a plus qu'1 membre, retirer aussi son `groupeOralId`.
  - Notes: L'ordre est important — dissocier AVANT d'assigner pour éviter les groupes fantômes. Un élève ne peut être que dans un seul groupe à la fois.

- [ ] Task 4: Mettre à jour les types DB partagés + migration Supabase
  - File: `packages/shared/src/database.types.ts`
  - Action: Renommer `binome_id` en `groupe_oral_id` dans `SessionEleveRow` (ligne 115) et `SessionEleveInsert` (ligne 129).
  - File: `supabase/migrations/` (nouveau fichier SQL)
  - Action: Créer une migration : `ALTER TABLE session_eleves RENAME COLUMN binome_id TO groupe_oral_id;`. La sémantique change : ce n'est plus un FK vers un autre élève, c'est un UUID partagé par le groupe.
  - Notes: Impact en cascade sur tous les fichiers qui lisent `binome_id` → rechercher/remplacer `binome_id` par `groupe_oral_id` dans : `supabaseUpload.ts`, `StudentListScreen.tsx`, `JuryTable.tsx`, `App.tsx`.

- [ ] Task 4b: Nettoyer le localStorage
  - File: `src/stores/eleveStore.ts` (ou init de l'app)
  - Action: Au démarrage, si un élève a un `binomeId` dans le state persisté, le supprimer (migration one-shot du localStorage). Ceci évite que des sessions en cours de wizard crashent après le renommage du step `'binomes'` → `'groupes'`.
  - Notes: Simple `if (eleve.binomeId) { delete eleve.binomeId; }` dans le init ou un migration helper.

#### Phase 2 — Algorithmes (timeSlots + solverDnb)

- [ ] Task 5: Adapter `assignTimeSlots()` et `distributeStudents()` pour groupes variables
  - File: `src/algorithms/timeSlots.ts`
  - Action:
    - Ligne 174 — remplacer `const isBinome = eleve?.binomeId != null` par détection du groupe via `groupeOralId`. Trouver tous les membres du groupe dans les affectations du jury.
    - Assigner le même créneau à tous les membres du groupe.
    - Calculer `slotsToSkip = Math.ceil(getGroupDuration(groupSize) / DUREE_PASSAGE_MIN) - 1` (binôme=1, trinôme=1).
    - **Adapter `distributeStudents()`** : Le paramètre `count` doit refléter le nombre de **time slots** nécessaires, pas le nombre d'élèves. Avant d'appeler `distributeStudents`, pré-calculer le total de slots : pour chaque jury, compter `sum(Math.ceil(getGroupDuration(groupSize) / 20))` pour chaque groupe/solo. Passer ce total à `distributeStudents` au lieu de `juryAffectations.length`.
  - Notes: Un trinôme de 35min consomme 2 time slots (comme un binôme de 25min). `DUREE_PASSAGE_MIN` reste à 20 comme quantum de base pour le planning.

- [ ] Task 6: Adapter `solverDnb.ts` pour groupes variables
  - File: `src/algorithms/solverDnb.ts`
  - Action:
    - Dans `affectEleve()` (lignes 440-491) — remplacer la logique `eleve.binomeId ? find partner` par : trouver tous les membres du groupe via `eleves.filter(e => e.groupeOralId && e.groupeOralId === eleve.groupeOralId)`.
    - **Capacité jury** : `slotsNeeded = groupMembers.length` (chaque membre = 1 place de capacité jury). Un trinôme consomme 3 places de capacité.
    - Affecter tous les membres du groupe au même jury avec scoring indépendant.
    - L'explication doit mentionner "Groupe avec X, Y" (binôme) ou "Groupe avec X, Y, Z" (trinôme) au lieu de "Binôme avec X".
    - Dans phases 1 et 2 : vérifier que AUCUN membre du groupe n'est déjà assigné avant de tenter l'affectation.
  - Notes: La distinction est claire : la **capacité** d'un jury est en nombre d'élèves (3 places pour un trinôme). Les **time slots** sont gérés séparément dans timeSlots.ts.

- [ ] Task 7: Écrire les tests
  - File: `src/algorithms/timeSlots.test.ts` (ajouter sections)
  - Action: Tests `getGroupDuration` : size 1→20, 2→25, 3→35, 0→20 (fallback), 4→20 (fallback), NaN→20. Tests `assignTimeSlots` : solo=1 slot, binôme=même créneau+2 slots consommés, trinôme=même créneau+2 slots consommés, mix solos+groupes.
  - File: `src/algorithms/solverDnb.test.ts` (ajouter ou étendre)
  - Action: Tests solver : groupe de 2 → même jury + 2 capacité, groupe de 3 → même jury + 3 capacité, groupe trop grand pour capacité restante → non affecté (tous les membres), mix solos+binômes+trinômes.

#### Phase 3 — UI Wizard (StepGroupes)

- [ ] Task 8: Renommer le step dans le workflow guidé
  - File: `src/stores/uiStore.ts`, `src/components/guided/GuidedMode.tsx`
  - Action: uiStore — renommer `'binomes'` en `'groupes'` dans le type `GuidedStep`. GuidedMode — mettre à jour `STEPS_ORAL_DNB` (ligne 22), le label (ligne 31 → `'Groupes'`), et le render (ligne 78 → `<StepGroupes />`).

- [ ] Task 9: Créer StepGroupes.tsx (refonte de StepBinomes)
  - File: `src/components/guided/steps/StepGroupes.tsx` (nouveau, remplace StepBinomes.tsx)
  - Action: Interface click-based (pas de DnD). Flow :
    - (1) L'utilisateur clique un 1er élève (sans groupe) → sélection active
    - (2) L'utilisateur clique un 2ème élève → binôme créé via `setGroupeOral([id1, id2])`
    - (3) Sur un groupe existant de 2, bouton "+" → sélection d'un 3ème → `setGroupeOral([id1, id2, id3])`
    - Afficher les groupes existants avec badge "Binôme"/"Trinôme"
    - Bouton "×" par membre : appelle `removeFromGroupeOral(eleveId)`
    - Le bouton "+" est masqué sur les trinômes (max 3)
    - Filter `!e.groupeOralId` pour la liste des élèves disponibles
  - Notes: Garder le filtre de recherche et le regroupement par classe de StepBinomes.

- [ ] Task 10: Mettre à jour les styles CSS
  - File: `src/components/guided/GuidedMode.css`
  - Action: Renommer les classes `.step-binomes`, `.binome-card`, `.binome-pair`, `.binome-name` en `.step-groupes`, `.groupe-card`, `.groupe-members`, `.groupe-member-name`. Ajouter styles pour affichage trinôme (3 noms, badge couleur différente — ex: orange pour trinôme, violet pour binôme).

- [ ] Task 11: Supprimer StepBinomes.tsx
  - File: `src/components/guided/steps/StepBinomes.tsx`
  - Action: Supprimer le fichier. Vérifier qu'aucun import ne le référence encore.

#### Phase 4 — Export & PDF

- [ ] Task 12: Mettre à jour les types d'export
  - File: `src/infrastructure/export/types.ts`
  - Action: Remplacer `binomeNom?: string` et `binomeEleveId?: string` (lignes 25-26) par `groupeMembresNoms?: string[]` (noms des AUTRES membres du groupe, format "Prénom Nom").
  - Notes: `undefined` ou `[]` pour les solos.

- [ ] Task 13: Mettre à jour le data mapper
  - File: `src/infrastructure/export/dataMapper.ts`
  - Action: Lignes 67-84 — remplacer la résolution du partenaire unique par : trouver tous les élèves avec le même `groupeOralId`, exclure l'élève courant, mapper vers `groupeMembresNoms: string[]`.

- [ ] Task 14: Mettre à jour les composants PDF
  - File: `src/infrastructure/export/PdfComponents.tsx`
  - Action: Remplacer `binomeNom` par `groupeMembresNoms`. StudentTable : badge ♦ pour binôme, ♦♦ pour trinôme. DoorListPage : "NOM Prénom & Nom2 & Nom3". AttendancePage : même logique. EleveConvocationPage : "Vous passerez en binôme avec X." ou "Vous passerez en trinôme avec X et Y."
  - Notes: Légende PDF à mettre à jour aussi.

- [ ] Task 15: Mettre à jour l'upload Supabase
  - File: `src/infrastructure/export/supabaseUpload.ts`
  - Action:
    - Pass 1 (lignes 168-197) — remplacer détection `binomeEleveId` par `groupeMembresNoms.length > 0`. Jury mode `'collectif'` si groupe.
    - Pass 2 (lignes 200-220) — Pour chaque groupe : générer un UUID côté client via `crypto.randomUUID()`. Assigner ce UUID comme `groupe_oral_id` à tous les membres du groupe dans Supabase. Ce n'est PAS un FK vers un autre élève (contrairement à l'ancien `binome_id`).
    - Utiliser `getGroupDuration(groupSize)` pour `duree_passage` dans la row session_eleves de chaque membre du groupe.
  - Notes: Le globalIdMap existant est toujours utile pour résoudre les IDs locaux → Supabase IDs, mais le `groupe_oral_id` est un UUID frais, pas un ID d'élève.

#### Phase 5 — Jury PWA (évaluation en ligne)

- [ ] Task 16: Refondre BinomeEvaluateScreen → GroupeEvaluateScreen
  - File: `apps/jury/src/screens/BinomeEvaluateScreen.tsx` → renommer en `GroupeEvaluateScreen.tsx`
  - Action:
    - Props : `eleves: SessionEleveRow[]` (2 ou 3, plus de tuple hardcodé).
    - Tab dynamique : `eleves.map((e, i) => <Tab>)` — 2 ou 3 onglets selon la taille.
    - Scores : `Map<string, number[]>` indexé par `eleveId` au lieu de `scoresA/scoresB`.
    - Timer : `sharedTimerKey()` sur tous les IDs triés alphabétiquement (`eleves.map(e => e.id).sort().join('-')`). **Timer initialisé à `getGroupDuration(eleves.length)` minutes** (25 pour binôme, 35 pour trinôme). Importer `getGroupDuration` depuis `@shared` ou passer la durée en prop.
    - Soumission : boucle `for (const eleve of eleves)`. Chaque élève non-absent est soumis avec ses propres scores. `duree_passage` = `getGroupDuration(eleves.length)` pour tous les membres.
    - `canSubmit` : tous les élèves **non-absents** doivent être scorés. Si 1 membre est absent, les autres peuvent être soumis sans lui.
    - Badge header : "BINÔME" si 2, "TRINÔME" si 3.
    - **Absence partielle** : Marquer un membre absent ne change pas la durée du passage ni le nombre de slots. Le `duree_passage` reste celui du groupe original.
  - Notes: ~596 lignes à refactorer. Le plus gros morceau de la feature.

- [ ] Task 17: Adapter StudentListScreen pour groupes
  - File: `apps/jury/src/screens/StudentListScreen.tsx`
  - Action: Ligne 11 — `onSelectGroupe: (eleves: SessionEleveRow[]) => void` remplace `onSelectBinome`. Lignes 353-412 — détecter les groupes via `groupe_oral_id` (au lieu de `binome_id`). Regrouper tous les membres partageant le même `groupe_oral_id` (2 ou 3). Badge "BINÔME"/"TRINÔME" selon taille. `SessionEleveRow[]` au lieu de tuple.
  - Notes: Le `rendered` Set empêche déjà les doublons, cette logique reste.

- [ ] Task 18: Adapter App.tsx (routing + state)
  - File: `apps/jury/src/App.tsx`
  - Action:
    - Screen type : `'evaluate-groupe'` avec `eleves: SessionEleveRow[]`.
    - Save nav (lignes 40-43) : `eleveIds: screen.eleves.map(e => e.id)`.
    - Restore nav (lignes 93-106) : vérifier `data.length >= 2` au lieu de `=== 2`, cast `SessionEleveRow[]` (pas de tuple).
    - Route handler : render `<GroupeEvaluateScreen>`.

- [ ] Task 19: Adapter JuryTable (dashboard)
  - File: `apps/dashboard/src/components/JuryTable.tsx`
  - Action: Ligne 127 — `const hasGroupe = eleve.groupe_oral_id != null`. Détecter la taille du groupe en comptant les élèves avec le même `groupe_oral_id` dans la liste du jury. Badge : "Binôme" si 2, "Trinôme" si 3. Garder le style violet.

### Acceptance Criteria

- [ ] AC 1: Given un élève sans groupe, when il passe l'oral, then la durée est 20 minutes et il consomme 1 créneau et 1 place de capacité jury.
- [ ] AC 2: Given 2 élèves avec le même `groupeOralId`, when ils sont affectés à un jury, then ils sont dans le même jury, ont le même créneau horaire, la durée est 25 minutes, ils consomment 2 time slots et 2 places de capacité.
- [ ] AC 3: Given 3 élèves avec le même `groupeOralId`, when ils sont affectés à un jury, then ils sont dans le même jury, ont le même créneau horaire, la durée est 35 minutes, ils consomment 2 time slots et 3 places de capacité.
- [ ] AC 4: Given l'étape Groupes du wizard, when l'utilisateur sélectionne 2 élèves, then un binôme est créé avec un `groupeOralId` UUID partagé.
- [ ] AC 5: Given un binôme existant, when l'utilisateur clique "+", then il peut sélectionner un 3ème élève et le trinôme est créé (3 élèves partagent le même `groupeOralId`).
- [ ] AC 6: Given un trinôme existant, when l'utilisateur supprime un membre, then le groupe passe à binôme (2 membres gardent le `groupeOralId`).
- [ ] AC 7: Given un binôme existant, when l'utilisateur supprime un membre, then le groupe est dissout (le dernier membre perd son `groupeOralId`).
- [ ] AC 8: Given un groupe de 3, when le bouton "+" est affiché, then il est désactivé/masqué (max 3).
- [ ] AC 9: Given un groupe sur l'écran d'évaluation jury, when le jury ouvre le groupe, then il voit N onglets (1 par élève) avec des scores indépendants et un timer partagé initialisé à `getGroupDuration(N)` minutes.
- [ ] AC 10: Given un trinôme évalué, when le jury soumet les notes, then chaque élève non-absent a ses propres scores dans la base et un `duree_passage` de 35 minutes.
- [ ] AC 11: Given un trinôme où 1 membre est absent, when le jury soumet, then seuls les 2 présents sont évalués, mais `duree_passage` reste 35 minutes pour tous.
- [ ] AC 12: Given un PDF généré, when un élève est en trinôme, then son nom affiche "♦♦" et les noms des partenaires.
- [ ] AC 13: Given l'algo de matching solverDnb, when un groupe de 3 est à affecter, then les 3 sont dans le même jury et consomment 3 places de capacité.
- [ ] AC 14: Given la StudentListScreen, when un groupe est affiché, then il a un badge "Binôme" ou "Trinôme" selon la taille et tous les membres sont listés ensemble.
- [ ] AC 15: Given un élève déjà dans un binôme, when il est ajouté à un nouveau groupe, then il est d'abord retiré de son ancien groupe (dissociation automatique).
- [ ] AC 16: Given `getGroupDuration(0)` ou `getGroupDuration(5)`, when appelé, then retourne 20 (fallback sûr).

## Additional Context

### Dependencies

- Aucune dépendance externe supplémentaire
- Supabase schema : migration SQL `ALTER TABLE session_eleves RENAME COLUMN binome_id TO groupe_oral_id;` (Task 4)
- Le helper `getGroupDuration()` est une dépendance interne partagée entre timeSlots, solverDnb et supabaseUpload

### Testing Strategy

**Tests unitaires (Vitest) :**
- `timeSlots.test.ts` : tests `getGroupDuration` (size 1→20, 2→25, 3→35, 0→20, 4→20, NaN→20) + tests `assignTimeSlots` (solo 1 slot, binôme 2 slots même créneau, trinôme 2 slots même créneau, mix, overflow)
- `solverDnb.test.ts` : groupe de 2 → même jury + 2 capacité, groupe de 3 → même jury + 3 capacité, groupe > capacité → non affecté, mix solos+binômes+trinômes

**Tests manuels :**
- Wizard StepGroupes : créer binôme, étendre en trinôme, supprimer un membre, dissoudre, réassigner un élève d'un groupe à un autre
- Évaluation : ouvrir un trinôme, basculer entre 3 onglets, marquer 1 absent, soumettre
- PDF : vérifier le rendu binôme/trinôme dans les tableaux et convocations
- Dashboard : vérifier les badges dans JuryTable

### Notes

**Risques :**
- La refonte de BinomeEvaluateScreen (~596 lignes) est le morceau le plus complexe — timer partagé, scores indépendants, soumission atomique
- Le renommage `binome` → `groupe` est massif (19 fichiers) mais mécanique
- La migration Supabase doit être déployée AVANT le code (ou en même temps)

**Ordre d'exécution recommandé :**
Phase 1 (Tasks 1-4b) → Phase 2 (Tasks 5-7, avec tests) → Phase 3 (Tasks 8-11) → Phase 4 (Tasks 12-15) → Phase 5 (Tasks 16-19) → tests manuels

**Futur (hors scope) :**
- Import CSV avec colonne groupe
- Groupes de 4+ si demande ultérieure
- Durées de passage configurables par l'utilisateur
