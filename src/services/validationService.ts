// ============================================================
// VALIDATION SERVICE
// Crée un snapshot immuable des affectations pour l'historisation
// ============================================================

// ============================================================
// UTILITY: Format date for display
// ============================================================

export function formatArchiveDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getScenarioTypeLabel(type: string): string {
  switch (type) {
    case 'oral_dnb': return 'Oral du DNB';
    case 'suivi_stage': return 'Suivi de stage';
    case 'custom': return 'Personnalisé';
    default: return 'Standard';
  }
}
