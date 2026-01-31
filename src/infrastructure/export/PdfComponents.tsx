// ============================================================
// COMPOSANTS PDF - Templates pour l'export PDF des jurys
// ============================================================

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type {
  ExportResultData,
  ExportJuryData,
  PdfExportOptions,
} from './types';
import { DEFAULT_PDF_OPTIONS } from './types';
import { LOGO_ACADEMIE_GRAND_EST, LOGO_EDUCATION_NATIONALE } from './logos';

// ============================================================
// STYLES PDF
// ============================================================

// Tailles de police selon l'option
const fontSizes = {
  small: { title: 14, subtitle: 10, body: 8, small: 7 },
  medium: { title: 16, subtitle: 11, body: 9, small: 8 },
  large: { title: 18, subtitle: 12, body: 10, small: 9 },
};

const createStyles = (options: PdfExportOptions) => {
  const sizes = fontSizes[options.fontSize];
  
  return StyleSheet.create({
    page: {
      paddingTop: 20,
      paddingBottom: 60,
      paddingHorizontal: 40,
      fontFamily: 'Helvetica',
      fontSize: sizes.body,
    },
    
    // En-tête de page
    pageHeader: {
      marginBottom: 15,
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: '#2563eb',
      borderBottomStyle: 'solid',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 0,
    },
    headerLogo: {
      width: 150,
      height: 150,
      objectFit: 'contain',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 15,
    },
    headerTitle: {
      fontSize: sizes.title,
      fontWeight: 'bold',
      color: '#1e293b',
      marginBottom: 4,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: sizes.subtitle,
      color: '#64748b',
      textAlign: 'center',
    },
    headerMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      fontSize: sizes.small,
      color: '#94a3b8',
    },
    
    // Bloc jury
    jurySection: {
      marginBottom: 30,
    },
    juryTitle: {
      fontSize: sizes.title,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 12,
      paddingBottom: 6,
      borderBottomWidth: 2,
      borderBottomColor: '#3b82f6',
      borderBottomStyle: 'solid',
    },
    
    // Bloc enseignants
    enseignantsBlock: {
      backgroundColor: '#f1f5f9',
      padding: 12,
      marginBottom: 15,
      borderRadius: 4,
    },
    enseignantsTitle: {
      fontSize: sizes.subtitle,
      fontWeight: 'bold',
      color: '#475569',
      marginBottom: 6,
    },
    enseignantRow: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    enseignantName: {
      fontSize: sizes.body,
      fontWeight: 'bold',
      color: '#1e293b',
      width: '50%',
    },
    enseignantMatiere: {
      fontSize: sizes.body,
      color: '#64748b',
      width: '50%',
    },
    
    // Texte de lettre
    letterText: {
      marginBottom: 15,
      lineHeight: 1.5,
    },
    letterParagraph: {
      fontSize: sizes.body,
      color: '#374151',
      marginBottom: 8,
      textAlign: 'justify',
    },
    
    // Tableau des élèves
    table: {
      marginTop: 10,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#1e3a5f',
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    tableHeaderCell: {
      fontSize: sizes.small,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      borderBottomStyle: 'solid',
    },
    tableRowAlt: {
      backgroundColor: '#f8fafc',
    },
    tableCell: {
      fontSize: sizes.body,
      color: '#1e293b',
    },
    tableCellMatch: {
      color: '#059669',
      fontWeight: 'bold',
    },
    
    // Colonnes du tableau (largeurs)
    colNom: { width: '25%' },
    colPrenom: { width: '20%' },
    colClasse: { width: '12%' },
    colMatiere: { width: '18%' },
    colDate: { width: '12%' },
    colHeure: { width: '10%' },
    colSujet: { width: '25%' },
    
    // Stats du jury
    juryStats: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      borderTopStyle: 'solid',
    },
    statItem: {
      marginLeft: 20,
      fontSize: sizes.small,
      color: '#64748b',
    },
    statValue: {
      fontWeight: 'bold',
      color: '#1e293b',
    },
    
    // Page des non-affectés
    unassignedTitle: {
      fontSize: sizes.title,
      fontWeight: 'bold',
      color: '#dc2626',
      marginBottom: 15,
    },
    reasonText: {
      fontSize: sizes.small,
      color: '#ef4444',
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
      fontSize: 8,
      color: '#94a3b8',
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      borderTopStyle: 'solid',
      paddingTop: 8,
    },
    pageNumber: {
      fontSize: 8,
    },
    
    // Empty state
    emptyJury: {
      padding: 20,
      textAlign: 'center',
      color: '#94a3b8',
      fontStyle: 'italic',
    },
  });
};

// ============================================================
// COMPOSANTS PDF MODULAIRES
// ============================================================

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  date: string;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, date, options, styles }) => {
  const showLeftLogo = options.showLogoAcademie;
  const showRightLogo = options.showLogoEducationNationale;
  const hasLogos = showLeftLogo || showRightLogo;

  return (
    <View style={styles.pageHeader}>
      {hasLogos ? (
        <View style={styles.headerRow}>
          {showLeftLogo ? (
            <Image src={LOGO_ACADEMIE_GRAND_EST} style={styles.headerLogo} />
          ) : (
            <View style={styles.headerLogo} />
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
          </View>
          {showRightLogo ? (
            <Image src={LOGO_EDUCATION_NATIONALE} style={styles.headerLogo} />
          ) : (
            <View style={styles.headerLogo} />
          )}
        </View>
      ) : (
        <>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </>
      )}
      <View style={styles.headerMeta}>
        <Text>{options.headerSchoolName || 'Établissement'}</Text>
        <Text>Année {options.headerYear || new Date().getFullYear()}</Text>
        <Text>Exporté le {new Date(date).toLocaleDateString('fr-FR')}</Text>
      </View>
    </View>
  );
};

interface EnseignantsBlockProps {
  enseignants: ExportJuryData['enseignants'];
  styles: ReturnType<typeof createStyles>;
}

const EnseignantsBlock: React.FC<EnseignantsBlockProps> = ({ enseignants, styles }) => (
  <View style={styles.enseignantsBlock}>
    <Text style={styles.enseignantsTitle}>Enseignants du jury</Text>
    {enseignants.map((ens, idx) => (
      <View key={idx} style={styles.enseignantRow}>
        <Text style={styles.enseignantName}>{ens.prenom} {ens.nom}</Text>
        <Text style={styles.enseignantMatiere}>{ens.matierePrincipale}</Text>
      </View>
    ))}
  </View>
);

interface LetterTextProps {
  juryName: string;
  styles: ReturnType<typeof createStyles>;
}

const LetterText: React.FC<LetterTextProps> = ({ juryName, styles }) => (
  <View style={styles.letterText}>
    <Text style={styles.letterParagraph}>
      Bonjour,
    </Text>
    <Text style={styles.letterParagraph}>
      Vous trouverez ci-dessous la liste des élèves qui vous sont affectés pour l'épreuve 
      orale du Diplôme National du Brevet ({juryName}). Chaque élève présentera un projet 
      correspondant à la matière indiquée.
    </Text>
    <Text style={styles.letterParagraph}>
      Merci de bien vouloir prendre connaissance de cette liste et de préparer les conditions 
      d'accueil des candidats. Les horaires et salles définitifs vous seront communiqués 
      ultérieurement.
    </Text>
  </View>
);

interface StudentTableProps {
  eleves: ExportJuryData['eleves'];
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
}

const StudentTable: React.FC<StudentTableProps> = ({ eleves, options, styles }) => {
  const showSchedule = options.includeScheduleColumns;
  const showTopic = options.includeTopicTitle;
  
  // Ajuster les largeurs si on affiche plus de colonnes
  const colNom = showSchedule || showTopic ? { width: '22%' } : styles.colNom;
  const colPrenom = showSchedule || showTopic ? { width: '18%' } : styles.colPrenom;
  const colClasse = showSchedule || showTopic ? { width: '10%' } : styles.colClasse;
  const colMatiere = showSchedule || showTopic ? { width: '15%' } : { width: '25%' };
  
  return (
    <View style={styles.table}>
      {/* En-tête du tableau */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, colNom]}>Nom</Text>
        <Text style={[styles.tableHeaderCell, colPrenom]}>Prénom</Text>
        <Text style={[styles.tableHeaderCell, colClasse]}>Classe</Text>
        <Text style={[styles.tableHeaderCell, colMatiere]}>Matière</Text>
        {showSchedule && (
          <>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.colHeure]}>Heure</Text>
          </>
        )}
        {showTopic && (
          <Text style={[styles.tableHeaderCell, styles.colSujet]}>Sujet</Text>
        )}
      </View>
      
      {/* Lignes du tableau */}
      {eleves.map((eleve, idx) => (
        <View 
          key={idx} 
          style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
          wrap={false}
        >
          <Text style={[styles.tableCell, colNom]}>{eleve.nom}</Text>
          <Text style={[styles.tableCell, colPrenom]}>{eleve.prenom}</Text>
          <Text style={[styles.tableCell, colClasse]}>{eleve.classe}</Text>
          <Text style={[styles.tableCell, colMatiere, eleve.matiereAffectee ? styles.tableCellMatch : {}]}>
            {eleve.matiereAffectee || eleve.matieresOral.join(', ') || '-'}
          </Text>
          {showSchedule && (
            <>
              <Text style={[styles.tableCell, styles.colDate]}>{eleve.datePassage || '-'}</Text>
              <Text style={[styles.tableCell, styles.colHeure]}>{eleve.heurePassage || '-'}</Text>
            </>
          )}
          {showTopic && (
            <Text style={[styles.tableCell, styles.colSujet]}>{eleve.sujetIntitule || '-'}</Text>
          )}
        </View>
      ))}
    </View>
  );
};

interface JuryStatsProps {
  jury: ExportJuryData;
  styles: ReturnType<typeof createStyles>;
}

const JuryStats: React.FC<JuryStatsProps> = ({ jury, styles }) => (
  <View style={styles.juryStats}>
    <Text style={styles.statItem}>
      Élèves: <Text style={styles.statValue}>{jury.nbAffectes}</Text> / {jury.capaciteMax}
    </Text>
    <Text style={styles.statItem}>
      Remplissage: <Text style={styles.statValue}>{jury.tauxRemplissage}%</Text>
    </Text>
    <Text style={styles.statItem}>
      Correspondance matière: <Text style={styles.statValue}>{jury.nbMatchMatiere}</Text>
    </Text>
  </View>
);

interface PageFooterProps {
  scenarioName: string;
  styles: ReturnType<typeof createStyles>;
}

const PageFooter: React.FC<PageFooterProps> = ({ scenarioName, styles }) => (
  <View style={styles.footer} fixed>
    <Text>{scenarioName}</Text>
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
      `Page ${pageNumber} / ${totalPages}`
    )} />
  </View>
);

// ============================================================
// PAGE JURY
// ============================================================

interface JuryPageProps {
  jury: ExportJuryData;
  data: ExportResultData;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
  isFirstJury: boolean;
}

const JuryPage: React.FC<JuryPageProps> = ({ jury, data, options, styles, isFirstJury }) => (
  <Page size={options.pageSize} orientation={options.orientation} style={styles.page}>
    {isFirstJury && (
      <PageHeader
        title={`Oral DNB - ${data.scenarioName}`}
        subtitle={options.headerSchoolName}
        date={data.dateExport}
        options={options}
        styles={styles}
      />
    )}
    
    <View style={styles.jurySection}>
      <Text style={styles.juryTitle}>{jury.juryName}</Text>
      
      <EnseignantsBlock enseignants={jury.enseignants} styles={styles} />
      
      {options.includeLetterText && (
        <LetterText juryName={jury.juryName} styles={styles} />
      )}
      
      {jury.eleves.length > 0 ? (
        <>
          <StudentTable eleves={jury.eleves} options={options} styles={styles} />
          <JuryStats jury={jury} styles={styles} />
        </>
      ) : (
        <Text style={styles.emptyJury}>Aucun élève affecté à ce jury</Text>
      )}
    </View>
    
    <PageFooter scenarioName={data.scenarioName} styles={styles} />
  </Page>
);

// ============================================================
// PAGE NON-AFFECTÉS
// ============================================================

interface UnassignedPageProps {
  data: ExportResultData;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
}

const UnassignedPage: React.FC<UnassignedPageProps> = ({ data, options, styles }) => {
  if (data.unassigned.length === 0) return null;
  
  return (
    <Page size={options.pageSize} orientation={options.orientation} style={styles.page}>
      <Text style={styles.unassignedTitle}>
        Élèves non affectés ({data.unassigned.length})
      </Text>
      
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Nom</Text>
          <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Prénom</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Classe</Text>
          <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Matière(s)</Text>
          <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Raison(s)</Text>
        </View>
        
        {data.unassigned.map((eleve, idx) => (
          <View 
            key={idx} 
            style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            wrap={false}
          >
            <Text style={[styles.tableCell, { width: '25%' }]}>{eleve.nom}</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>{eleve.prenom}</Text>
            <Text style={[styles.tableCell, { width: '12%' }]}>{eleve.classe}</Text>
            <Text style={[styles.tableCell, { width: '18%' }]}>{eleve.matieresOral.join(', ') || '-'}</Text>
            <Text style={[styles.reasonText, { width: '25%' }]}>{eleve.raisons.join('; ')}</Text>
          </View>
        ))}
      </View>
      
      <PageFooter scenarioName={data.scenarioName} styles={styles} />
    </Page>
  );
};

// ============================================================
// DOCUMENT PRINCIPAL
// ============================================================

interface PdfJuryDocumentProps {
  data: ExportResultData;
  options?: Partial<PdfExportOptions>;
}

export const PdfJuryDocument: React.FC<PdfJuryDocumentProps> = ({ 
  data, 
  options: partialOptions = {} 
}) => {
  const options: PdfExportOptions = { ...DEFAULT_PDF_OPTIONS, ...partialOptions };
  const styles = createStyles(options);
  
  return (
    <Document>
      {data.jurys.map((jury, idx) => (
        <JuryPage
          key={jury.juryId}
          jury={jury}
          data={data}
          options={options}
          styles={styles}
          isFirstJury={idx === 0}
        />
      ))}
      
      {options.includeUnassignedPage && data.unassigned.length > 0 && (
        <UnassignedPage data={data} options={options} styles={styles} />
      )}
    </Document>
  );
};
