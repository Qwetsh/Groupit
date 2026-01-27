// ============================================================
// PDF COMPONENTS - SUIVI DE STAGE
// ============================================================

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import type { 
  StageExportResultData, 
  StageExportEnseignantData,
  StageExportEleveData,
  StageExportUnassignedData,
  StagePdfExportOptions 
} from './stageTypes';

// Coordonnées du collège (Woippy)
const COLLEGE_COORDS = { lat: 49.1523, lon: 6.1522 };

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  // Page
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  
  // En-tête
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#555',
    marginBottom: 2,
  },
  headerInfo: {
    fontSize: 9,
    color: '#777',
  },
  
  // Section enseignant
  enseignantSection: {
    marginBottom: 15,
  },
  enseignantName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#2563eb',
  },
  enseignantInfo: {
    fontSize: 9,
    color: '#555',
    marginBottom: 8,
  },
  
  // Stats box
  statsBox: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    marginBottom: 12,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 9,
    color: '#64748b',
  },
  statsValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  
  // Texte introductif (lettre)
  letterIntro: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fefce8',
    borderLeftWidth: 3,
    borderLeftColor: '#eab308',
  },
  letterText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#422006',
  },
  
  // Table
  table: {
    width: '100%',
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 24,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    fontSize: 8,
    color: '#334155',
  },
  tableCell: {
    fontSize: 8,
    color: '#475569',
  },
  
  // Colonnes avec largeurs spécifiques
  colEleve: { width: '18%' },
  colClasse: { width: '8%' },
  colEntreprise: { width: '22%' },
  colVille: { width: '14%' },
  colDistance: { width: '10%', textAlign: 'right' },
  colDuree: { width: '8%', textAlign: 'right' },
  colTuteur: { width: '15%' },
  colTel: { width: '12%' },
  
  // Badge distance approximative
  approxBadge: {
    fontSize: 6,
    color: '#d97706',
    marginLeft: 2,
  },
  
  // Warning box
  warningBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
  },
  warningText: {
    fontSize: 8,
    color: '#92400e',
    fontStyle: 'italic',
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
  pageNumber: {
    fontSize: 8,
    color: '#94a3b8',
  },
  
  // Page récapitulative
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  summarySection: {
    marginBottom: 20,
  },
  summarySectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1e40af',
  },
  
  // Non-affectés
  unassignedTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#dc2626',
  },
  unassignedItem: {
    marginBottom: 6,
    paddingLeft: 10,
  },
  unassignedName: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  unassignedDetail: {
    fontSize: 8,
    color: '#6b7280',
  },
  unassignedReason: {
    fontSize: 8,
    color: '#dc2626',
    fontStyle: 'italic',
  },
  
  // Carte
  mapContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  mapImage: {
    width: 400,
    height: 200,
    borderRadius: 4,
    border: '1px solid #e2e8f0',
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
    gap: 15,
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapLegendText: {
    fontSize: 7,
    color: '#64748b',
  },
});

// ============================================================
// COMPOSANTS HELPERS
// ============================================================

/**
 * En-tête de page
 */
interface PageHeaderProps {
  scenarioName: string;
  collegeName?: string;
  anneeScolaire?: string;
  dateExport: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  scenarioName,
  collegeName,
  anneeScolaire,
  dateExport,
}) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Suivi de Stage</Text>
    <Text style={styles.headerSubtitle}>{scenarioName}</Text>
    {collegeName && <Text style={styles.headerInfo}>{collegeName}</Text>}
    {anneeScolaire && <Text style={styles.headerInfo}>Année scolaire : {anneeScolaire}</Text>}
    <Text style={styles.headerInfo}>
      Exporté le {new Date(dateExport).toLocaleDateString('fr-FR')}
    </Text>
  </View>
);

/**
 * Pied de page
 */
interface PageFooterProps {
  scenarioName: string;
}

const PageFooter: React.FC<PageFooterProps> = ({ scenarioName }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>{scenarioName}</Text>
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
      `Page ${pageNumber} / ${totalPages}`
    )} />
  </View>
);

/**
 * Box statistiques enseignant
 */
interface EnseignantStatsBoxProps {
  enseignant: StageExportEnseignantData;
}

const EnseignantStatsBox: React.FC<EnseignantStatsBoxProps> = ({ enseignant }) => (
  <View style={styles.statsBox}>
    <View style={styles.statsRow}>
      <Text style={styles.statsLabel}>Élèves suivis</Text>
      <Text style={styles.statsValue}>{enseignant.nbEleves}</Text>
    </View>
    <View style={styles.statsRow}>
      <Text style={styles.statsLabel}>Distance totale</Text>
      <Text style={styles.statsValue}>{enseignant.distanceTotaleKm} km</Text>
    </View>
    <View style={styles.statsRow}>
      <Text style={styles.statsLabel}>Distance moyenne</Text>
      <Text style={styles.statsValue}>{enseignant.distanceMoyenneKm} km</Text>
    </View>
    {enseignant.nbDistancesApprox > 0 && (
      <View style={styles.statsRow}>
        <Text style={styles.statsLabel}>Distances approximatives</Text>
        <Text style={styles.statsValue}>{enseignant.nbDistancesApprox}</Text>
      </View>
    )}
  </View>
);

/**
 * Introduction lettre personnalisée
 */
interface LetterIntroProps {
  enseignant: StageExportEnseignantData;
}

const LetterIntro: React.FC<LetterIntroProps> = ({ enseignant }) => (
  <View style={styles.letterIntro}>
    <Text style={styles.letterText}>
      Cher(e) {enseignant.prenom} {enseignant.nom},
    </Text>
    <Text style={styles.letterText}>
      {'\n'}Vous êtes désigné(e) tuteur/tutrice pour le suivi de stage de {enseignant.nbEleves} élève(s) 
      durant cette période. Ci-dessous, vous trouverez la liste des élèves dont vous avez la charge, 
      ainsi que les informations relatives à leur stage.
    </Text>
    <Text style={styles.letterText}>
      {'\n'}La distance totale de vos déplacements est estimée à {enseignant.distanceTotaleKm} km.
    </Text>
  </View>
);

/**
 * Génère l'URL de la carte statique OpenStreetMap
 */
function generateStaticMapUrl(
  enseignant: StageExportEnseignantData,
  collegeLat: number = COLLEGE_COORDS.lat,
  collegeLon: number = COLLEGE_COORDS.lon
): string | null {
  // Collecter tous les points avec coordonnées
  const points: Array<{ lat: number; lon: number; color: string }> = [];
  
  // Ajouter le collège (bleu)
  points.push({ lat: collegeLat, lon: collegeLon, color: 'blue' });
  
  // Ajouter l'enseignant (vert) si coordonnées disponibles
  if (enseignant.lat && enseignant.lon) {
    points.push({ lat: enseignant.lat, lon: enseignant.lon, color: 'green' });
  }
  
  // Ajouter les stages (rouge)
  for (const eleve of enseignant.eleves) {
    if (eleve.lat && eleve.lon) {
      points.push({ lat: eleve.lat, lon: eleve.lon, color: 'red' });
    }
  }
  
  // Minimum 2 points pour une carte utile
  if (points.length < 2) {
    return null;
  }
  
  // Calculer le bounding box
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const minLat = Math.min(...lats) - 0.02;
  const maxLat = Math.max(...lats) + 0.02;
  const minLon = Math.min(...lons) - 0.02;
  const maxLon = Math.max(...lons) + 0.02;
  
  // Calculer le centre et le zoom
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  
  // Estimer le zoom basé sur l'étendue
  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;
  const maxDiff = Math.max(latDiff, lonDiff);
  let zoom = 12;
  if (maxDiff > 0.5) zoom = 9;
  else if (maxDiff > 0.2) zoom = 10;
  else if (maxDiff > 0.1) zoom = 11;
  else if (maxDiff > 0.05) zoom = 12;
  else zoom = 13;
  
  // Construire les marqueurs pour l'API staticmap.openstreetmap.de
  // Format: markers=lat,lon,color|lat,lon,color
  const markers = points.map(p => `${p.lat},${p.lon},${p.color}`).join('|');
  
  // URL API staticmap
  const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLon}&zoom=${zoom}&size=600x300&maptype=mapnik&markers=${encodeURIComponent(markers)}`;
  
  return url;
}

/**
 * Composant carte statique pour PDF
 */
interface StageMapProps {
  enseignant: StageExportEnseignantData;
}

const StageMap: React.FC<StageMapProps> = ({ enseignant }) => {
  const mapUrl = generateStaticMapUrl(enseignant);
  
  if (!mapUrl) {
    return null;
  }
  
  return (
    <View style={styles.mapContainer}>
      <Image src={mapUrl} style={styles.mapImage} />
      <View style={styles.mapLegend}>
        <View style={styles.mapLegendItem}>
          <View style={[styles.mapLegendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.mapLegendText}>Collège</Text>
        </View>
        <View style={styles.mapLegendItem}>
          <View style={[styles.mapLegendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.mapLegendText}>Domicile enseignant</Text>
        </View>
        <View style={styles.mapLegendItem}>
          <View style={[styles.mapLegendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.mapLegendText}>Lieux de stage</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Tableau des élèves pour un enseignant
 */
interface EleveTableProps {
  eleves: StageExportEleveData[];
  includeContact: boolean;
  includeDates: boolean;
}

const EleveTable: React.FC<EleveTableProps> = ({ eleves, includeContact }) => (
  <View style={styles.table}>
    {/* En-tête */}
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, styles.colEleve]}>Élève</Text>
      <Text style={[styles.tableHeaderCell, styles.colClasse]}>Classe</Text>
      <Text style={[styles.tableHeaderCell, styles.colEntreprise]}>Entreprise</Text>
      <Text style={[styles.tableHeaderCell, styles.colVille]}>Ville</Text>
      <Text style={[styles.tableHeaderCell, styles.colDistance]}>Distance</Text>
      <Text style={[styles.tableHeaderCell, styles.colDuree]}>Durée</Text>
      {includeContact && (
        <>
          <Text style={[styles.tableHeaderCell, styles.colTuteur]}>Tuteur</Text>
          <Text style={[styles.tableHeaderCell, styles.colTel]}>Tél</Text>
        </>
      )}
    </View>
    
    {/* Lignes */}
    {eleves.map((eleve, index) => (
      <View
        key={eleve.eleveId}
        style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
        wrap={false}
      >
        <Text style={[styles.tableCell, styles.colEleve]}>
          {eleve.nom} {eleve.prenom}
        </Text>
        <Text style={[styles.tableCell, styles.colClasse]}>{eleve.classe}</Text>
        <Text style={[styles.tableCell, styles.colEntreprise]}>
          {eleve.entreprise && eleve.entreprise !== 'Non renseigné' ? eleve.entreprise : '-'}
        </Text>
        <Text style={[styles.tableCell, styles.colVille]}>
          {eleve.ville || '-'}
        </Text>
        <View style={[styles.colDistance, { flexDirection: 'row', justifyContent: 'flex-end' }]}>
          <Text style={styles.tableCell}>
            {eleve.distanceKm !== undefined ? `${eleve.distanceKm} km` : '-'}
          </Text>
          {eleve.isDistanceApprox && <Text style={styles.approxBadge}>~</Text>}
        </View>
        <Text style={[styles.tableCell, styles.colDuree]}>
          {eleve.dureeEstimeeMin !== undefined ? `${eleve.dureeEstimeeMin} min` : '-'}
        </Text>
        {includeContact && (
          <>
            <Text style={[styles.tableCell, styles.colTuteur]}>{eleve.tuteur || '-'}</Text>
            <Text style={[styles.tableCell, styles.colTel]}>{eleve.tuteurTel || '-'}</Text>
          </>
        )}
      </View>
    ))}
  </View>
);

/**
 * Avertissement distances approximatives
 */
const DistanceWarning: React.FC<{ nbApprox: number }> = ({ nbApprox }) => {
  if (nbApprox === 0) return null;
  
  return (
    <View style={styles.warningBox}>
      <Text style={styles.warningText}>
        ⚠ {nbApprox} distance(s) marquée(s) avec "~" sont approximatives 
        (calculées à partir du centre-ville car l'adresse exacte n'a pas pu être géolocalisée).
      </Text>
    </View>
  );
};

// ============================================================
// PAGE ENSEIGNANT
// ============================================================

interface EnseignantPageProps {
  enseignant: StageExportEnseignantData;
  scenarioName: string;
  collegeName?: string;
  anneeScolaire?: string;
  dateExport: string;
  options: StagePdfExportOptions;
}

const EnseignantPage: React.FC<EnseignantPageProps> = ({
  enseignant,
  scenarioName,
  collegeName,
  anneeScolaire,
  dateExport,
  options,
}) => (
  <Page size={options.pageSize} style={styles.page}>
    <PageHeader
      scenarioName={scenarioName}
      collegeName={collegeName}
      anneeScolaire={anneeScolaire}
      dateExport={dateExport}
    />
    
    {/* Section enseignant */}
    <View style={styles.enseignantSection}>
      <Text style={styles.enseignantName}>
        {enseignant.prenom} {enseignant.nom}
      </Text>
      <Text style={styles.enseignantInfo}>
        {enseignant.matierePrincipale}
        {enseignant.commune && ` • ${enseignant.commune}`}
      </Text>
    </View>
    
    {/* Intro lettre personnalisée */}
    {options.includeLetterIntro && <LetterIntro enseignant={enseignant} />}
    
    {/* Carte des stages */}
    {options.includeMap && <StageMap enseignant={enseignant} />}
    
    {/* Stats */}
    <EnseignantStatsBox enseignant={enseignant} />
    
    {/* Table des élèves */}
    <EleveTable 
      eleves={enseignant.eleves}
      includeContact={options.includeContactInfo}
      includeDates={options.includeDates}
    />
    
    {/* Warning distances approximatives */}
    {options.includeDistanceWarning && (
      <DistanceWarning nbApprox={enseignant.nbDistancesApprox} />
    )}
    
    <PageFooter scenarioName={scenarioName} />
  </Page>
);

// ============================================================
// PAGE NON-AFFECTÉS
// ============================================================

interface UnassignedPageProps {
  unassigned: StageExportUnassignedData[];
  scenarioName: string;
  collegeName?: string;
  dateExport: string;
}

const UnassignedPage: React.FC<UnassignedPageProps> = ({
  unassigned,
  scenarioName,
  collegeName,
  dateExport,
}) => (
  <Page size="A4" style={styles.page}>
    <PageHeader
      scenarioName={scenarioName}
      collegeName={collegeName}
      dateExport={dateExport}
    />
    
    <Text style={styles.unassignedTitle}>
      Élèves non affectés ({unassigned.length})
    </Text>
    
    {unassigned.map((item) => (
      <View key={item.eleveId} style={styles.unassignedItem} wrap={false}>
        <Text style={styles.unassignedName}>
          {item.nom} {item.prenom} - {item.classe}
        </Text>
        {item.entreprise && (
          <Text style={styles.unassignedDetail}>
            Entreprise : {item.entreprise}
            {item.ville && ` (${item.ville})`}
          </Text>
        )}
        <Text style={styles.unassignedReason}>
          Raison : {item.raisons.join(', ')}
        </Text>
      </View>
    ))}
    
    <PageFooter scenarioName={scenarioName} />
  </Page>
);

// ============================================================
// PAGE RÉCAPITULATIF GLOBAL
// ============================================================

interface SummaryPageProps {
  data: StageExportResultData;
  options: StagePdfExportOptions;
}

const SummaryPage: React.FC<SummaryPageProps> = ({ data, options }) => (
  <Page size={options.pageSize} style={styles.page}>
    <PageHeader
      scenarioName={data.scenarioName}
      collegeName={options.collegeName}
      anneeScolaire={data.anneeScolaire}
      dateExport={data.dateExport}
    />
    
    <Text style={styles.summaryTitle}>Récapitulatif Global</Text>
    
    {/* Stats globales */}
    <View style={styles.summarySection}>
      <Text style={styles.summarySectionTitle}>Statistiques</Text>
      <View style={styles.statsBox}>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Total élèves avec stage</Text>
          <Text style={styles.statsValue}>{data.stats.totalStages}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Élèves affectés</Text>
          <Text style={styles.statsValue}>{data.stats.totalAffectes}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Élèves non affectés</Text>
          <Text style={styles.statsValue}>{data.stats.totalNonAffectes}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Taux d'affectation</Text>
          <Text style={styles.statsValue}>{data.stats.tauxAffectation}%</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Nombre d'enseignants</Text>
          <Text style={styles.statsValue}>{data.stats.nbEnseignants}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Distance totale</Text>
          <Text style={styles.statsValue}>{data.stats.distanceTotaleGlobaleKm} km</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Distance moyenne par élève</Text>
          <Text style={styles.statsValue}>{data.stats.distanceMoyenneGlobaleKm} km</Text>
        </View>
      </View>
    </View>
    
    {/* Liste des enseignants */}
    <View style={styles.summarySection}>
      <Text style={styles.summarySectionTitle}>Répartition par enseignant</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Enseignant</Text>
          <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Matière</Text>
          <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>Élèves</Text>
          <Text style={[styles.tableHeaderCell, { width: '17%', textAlign: 'right' }]}>Dist. totale</Text>
          <Text style={[styles.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Dist. moy.</Text>
        </View>
        {data.enseignants.map((ens, i) => (
          <View key={ens.enseignantId} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, { width: '30%' }]}>{ens.nom} {ens.prenom}</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>{ens.matierePrincipale}</Text>
            <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>{ens.nbEleves}</Text>
            <Text style={[styles.tableCell, { width: '17%', textAlign: 'right' }]}>{ens.distanceTotaleKm} km</Text>
            <Text style={[styles.tableCell, { width: '18%', textAlign: 'right' }]}>{ens.distanceMoyenneKm} km</Text>
          </View>
        ))}
      </View>
    </View>
    
    <PageFooter scenarioName={data.scenarioName} />
  </Page>
);

// ============================================================
// DOCUMENT PRINCIPAL
// ============================================================

interface StageExportDocumentProps {
  data: StageExportResultData;
  options: StagePdfExportOptions;
}

/**
 * Document PDF complet pour l'export Suivi de Stage
 */
export const StageExportDocument: React.FC<StageExportDocumentProps> = ({
  data,
  options,
}) => (
  <Document
    title={`Suivi de Stage - ${data.scenarioName}`}
    author="Groupit"
    subject="Export Suivi de Stage"
    creator="Groupit Application"
  >
    {/* Page récapitulative (optionnelle) */}
    {options.includeSummaryPage && (
      <SummaryPage data={data} options={options} />
    )}
    
    {/* Une page par enseignant */}
    {data.enseignants.map((enseignant) => (
      <EnseignantPage
        key={enseignant.enseignantId}
        enseignant={enseignant}
        scenarioName={data.scenarioName}
        collegeName={options.collegeName}
        anneeScolaire={data.anneeScolaire}
        dateExport={data.dateExport}
        options={options}
      />
    ))}
    
    {/* Page des non-affectés (optionnelle) */}
    {options.includeUnassignedPage && data.unassigned.length > 0 && (
      <UnassignedPage
        unassigned={data.unassigned}
        scenarioName={data.scenarioName}
        collegeName={options.collegeName}
        dateExport={data.dateExport}
      />
    )}
  </Document>
);

// Export des sous-composants pour usage externe si nécessaire
export {
  PageHeader,
  PageFooter,
  EnseignantStatsBox,
  LetterIntro,
  EleveTable,
  DistanceWarning,
  EnseignantPage,
  UnassignedPage,
  SummaryPage,
};
