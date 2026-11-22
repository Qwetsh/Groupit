// ============================================================
// HELP TEXTS - Textes d'aide centralisés
// ============================================================

export const HELP_TEXTS = {
  // Dashboard
  dashboard: {
    checklist: "Cette liste vous guide étape par étape pour préparer vos affectations. Complétez chaque étape pour débloquer la répartition.",
    alerts: "Les alertes signalent les problèmes potentiels qui pourraient affecter la qualité des affectations.",
    stagesMap: "Visualisez la répartition géographique des stages par rapport au collège. Les couleurs indiquent la distance.",
    history: "Retrouvez ici l'historique de vos affectations validées. Vous pouvez les consulter ou les exporter à tout moment.",
    launchMatching: "Lance l'algorithme d'affectation automatique selon les critères de la configuration active.",
  },

  // Board (Matching)
  board: {
    dragDrop: "Glissez-déposez les élèves vers les enseignants pour créer ou modifier une affectation manuellement.",
    autoMatch: "L'algorithme calcule la meilleure affectation possible en respectant les critères configurés.",
    score: "Le score reflète la qualité de l'affectation (100 = parfait). Il combine plusieurs critères pondérés.",
    validate: "Valider fige les affectations et les archive dans l'historique. Cette action est irréversible.",
    capacity: "Nombre d'élèves que cet enseignant peut encadrer. Basé sur sa capacité configurée.",
  },

  // Scénarios
  scenarios: {
    type: "Le type détermine les critères disponibles : Oral DNB (jurys, matières) ou Suivi Stage (distance, trajets).",
    criteria: "Les critères définissent comment l'algorithme évalue chaque affectation. Plus le poids est élevé, plus le critère est important.",
    hardConstraint: "Une contrainte dure doit être respectée à 100%. Si impossible, l'élève ne sera pas affecté.",
    capacity: "Capacité par défaut appliquée aux enseignants sans capacité personnalisée.",
    equilibrage: "L'équilibrage répartit les élèves équitablement entre les enseignants disponibles.",
  },

  // Import
  import: {
    csvFormat: "Format attendu : CSV avec séparateur point-virgule (;) ou virgule (,). Encodage UTF-8 recommandé.",
    mapping: "Associez chaque colonne de votre fichier au champ correspondant. Les colonnes non mappées seront ignorées.",
    duplicates: "Les doublons (même nom + prénom + classe) sont automatiquement détectés et ignorés.",
  },

  // Stages
  stages: {
    geocoding: "Le géocodage convertit les adresses en coordonnées GPS pour calculer les distances.",
    fallback: "Si l'adresse exacte n'est pas trouvée, le système utilise le centre-ville ou la mairie comme approximation.",
    distance: "Distance à vol d'oiseau multipliée par 1.3 pour estimer la distance routière réelle.",
  },

  // Jurys (Oral DNB)
  jurys: {
    composition: "Un jury est composé de 2 enseignants minimum. Les matières enseignées déterminent les élèves compatibles.",
    matiereMatch: "L'algorithme privilégie les jurys dont un enseignant enseigne la matière choisie par l'élève.",
  },
};
