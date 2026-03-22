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
// STYLES PDF (compact — conçus pour tenir sur 1 page)
// ============================================================

const fontSizes = {
  small: { title: 13, subtitle: 9, body: 7, small: 6 },
  medium: { title: 14, subtitle: 10, body: 8, small: 7 },
  large: { title: 16, subtitle: 11, body: 9, small: 8 },
};

const createStyles = (options: PdfExportOptions) => {
  const sizes = fontSizes[options.fontSize];

  return StyleSheet.create({
    page: {
      paddingTop: 15,
      paddingBottom: 40,
      paddingHorizontal: 30,
      fontFamily: 'Helvetica',
      fontSize: sizes.body,
    },

    // En-tête de page
    pageHeader: {
      marginBottom: 8,
      paddingBottom: 4,
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
      width: 100,
      height: 100,
      objectFit: 'contain',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 10,
    },
    headerTitle: {
      fontSize: sizes.title,
      fontWeight: 'bold',
      color: '#1e293b',
      marginBottom: 2,
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
      marginTop: 4,
      fontSize: sizes.small,
      color: '#94a3b8',
    },

    // Bloc jury
    jurySection: {
      marginBottom: 0,
    },
    juryTitle: {
      fontSize: sizes.title,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 2,
      paddingBottom: 3,
      borderBottomWidth: 2,
      borderBottomColor: '#3b82f6',
      borderBottomStyle: 'solid',
    },
    jurySalle: {
      fontSize: sizes.subtitle,
      color: '#475569',
      marginBottom: 6,
      fontWeight: 'bold',
    },

    // Bloc enseignants
    enseignantsBlock: {
      backgroundColor: '#f1f5f9',
      padding: 8,
      marginBottom: 8,
      borderRadius: 4,
    },
    enseignantsTitle: {
      fontSize: sizes.subtitle,
      fontWeight: 'bold',
      color: '#475569',
      marginBottom: 3,
    },
    enseignantRow: {
      flexDirection: 'row',
      marginBottom: 1,
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
      marginBottom: 6,
      lineHeight: 1.3,
    },
    letterParagraph: {
      fontSize: sizes.body,
      color: '#374151',
      marginBottom: 4,
      textAlign: 'justify',
    },

    // Tableau des élèves
    table: {
      marginTop: 4,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#1e3a5f',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    tableHeaderCell: {
      fontSize: sizes.small,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 3,
      paddingHorizontal: 4,
      borderBottomWidth: 0.5,
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
      marginTop: 4,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      borderTopStyle: 'solid',
    },
    statItem: {
      marginLeft: 15,
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
      marginBottom: 8,
    },
    reasonText: {
      fontSize: sizes.small,
      color: '#ef4444',
      fontStyle: 'italic',
    },

    // Footer
    footer: {
      position: 'absolute',
      bottom: 15,
      left: 30,
      right: 30,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: '#94a3b8',
      borderTopWidth: 0.5,
      borderTopColor: '#e2e8f0',
      borderTopStyle: 'solid',
      paddingTop: 4,
    },
    pageNumber: {
      fontSize: 7,
    },

    // Empty state
    emptyJury: {
      padding: 10,
      textAlign: 'center',
      color: '#94a3b8',
      fontStyle: 'italic',
    },

    // ============================================================
    // LISTE DE PORTE (Door list) — compact
    // ============================================================
    doorHeader: {
      textAlign: 'center',
      marginBottom: 12,
      paddingBottom: 6,
      borderBottomWidth: 2,
      borderBottomColor: '#1e3a5f',
      borderBottomStyle: 'solid',
    },
    doorTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 2,
    },
    doorSalle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#3b82f6',
    },
    doorRow: {
      flexDirection: 'row',
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: '#cbd5e1',
      borderBottomStyle: 'solid',
      alignItems: 'center',
    },
    doorRowAlt: {
      backgroundColor: '#f0f4f8',
    },
    doorHeure: {
      width: '20%',
      fontSize: 14,
      fontWeight: 'bold',
      color: '#1e293b',
    },
    doorNom: {
      width: '80%',
      fontSize: 13,
      fontWeight: 'bold',
      color: '#1e293b',
    },

    // ============================================================
    // FEUILLE DE PRÉSENCE (Attendance sheet) — compact
    // ============================================================
    attendanceHeader: {
      textAlign: 'center',
      marginBottom: 8,
      paddingBottom: 4,
      borderBottomWidth: 2,
      borderBottomColor: '#1e3a5f',
      borderBottomStyle: 'solid',
    },
    attendanceTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 2,
    },
    attendanceSalle: {
      fontSize: 10,
      color: '#475569',
    },
    attendanceColNum: { width: '8%' },
    attendanceColHeure: { width: '12%' },
    attendanceColNom: { width: '22%' },
    attendanceColPrenom: { width: '18%' },
    attendanceColClasse: { width: '10%' },
    attendanceColSignature: { width: '30%' },
    signatureCell: {
      borderBottomWidth: 1,
      borderBottomColor: '#94a3b8',
      borderBottomStyle: 'dotted',
      minHeight: 18,
    },

    // ============================================================
    // CONVOCATION SUPPLÉANT
    // ============================================================
    reserveBanner: {
      backgroundColor: '#fef3c7',
      padding: 6,
      marginBottom: 8,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#f59e0b',
      borderStyle: 'solid',
    },
    reserveBannerText: {
      fontSize: sizes.subtitle,
      fontWeight: 'bold',
      color: '#92400e',
      textAlign: 'center',
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

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, date: _date, options, styles }) => {
  void _date;
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
        <Text>Année {options.headerYear || new Date().getFullYear()}</Text>
      </View>
    </View>
  );
};

interface EnseignantsBlockProps {
  enseignants: ExportJuryData['enseignants'];
  suppleants?: ExportJuryData['suppleants'];
  styles: ReturnType<typeof createStyles>;
}

const EnseignantsBlock: React.FC<EnseignantsBlockProps> = ({ enseignants, suppleants, styles }) => (
  <View style={styles.enseignantsBlock}>
    <Text style={styles.enseignantsTitle}>Enseignants du jury</Text>
    {enseignants.map((ens, idx) => (
      <View key={idx} style={styles.enseignantRow}>
        <Text style={styles.enseignantName}>{ens.prenom} {ens.nom}</Text>
        <Text style={styles.enseignantMatiere}>{ens.matierePrincipale}</Text>
      </View>
    ))}
    {suppleants && suppleants.length > 0 && (
      <>
        <Text style={[styles.enseignantsTitle, { marginTop: 4 }]}>Suppléant(s)</Text>
        {suppleants.map((ens, idx) => (
          <View key={idx} style={styles.enseignantRow}>
            <Text style={styles.enseignantName}>{ens.prenom} {ens.nom}</Text>
            <Text style={styles.enseignantMatiere}>{ens.matierePrincipale}</Text>
          </View>
        ))}
      </>
    )}
  </View>
);

interface LetterTextProps {
  juryName: string;
  salle?: string;
  isOralBlanc?: boolean;
  styles: ReturnType<typeof createStyles>;
}

const LetterText: React.FC<LetterTextProps> = ({ juryName, salle, isOralBlanc, styles }) => {
  const epreuve = isOralBlanc
    ? "l'oral blanc de préparation au Diplôme National du Brevet"
    : "l'épreuve orale du Diplôme National du Brevet";

  return (
    <View style={styles.letterText}>
      <Text style={styles.letterParagraph}>
        Bonjour,
      </Text>
      <Text style={styles.letterParagraph}>
        Vous trouverez ci-dessous la liste des élèves qui vous sont affectés pour {epreuve} ({juryName}).{salle ? ` Vous êtes en salle ${salle}.` : ''} Chaque élève présentera un projet
        correspondant à la matière indiquée.
      </Text>
      <Text style={styles.letterParagraph}>
        Merci de bien vouloir prendre connaissance de cette liste et de préparer les conditions
        d'accueil des candidats.
      </Text>
    </View>
  );
};

interface StudentTableProps {
  eleves: ExportJuryData['eleves'];
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
}

const StudentTable: React.FC<StudentTableProps> = ({ eleves, options, styles }) => {
  const showSchedule = options.includeScheduleColumns;
  const showTopic = options.includeTopicTitle;

  const colNom = showSchedule || showTopic ? { width: '25%' } : styles.colNom;
  const colPrenom = showSchedule || showTopic ? { width: '20%' } : styles.colPrenom;
  const colClasse = showSchedule || showTopic ? { width: '10%' } : styles.colClasse;
  const colMatiere = showSchedule || showTopic ? { width: '20%' } : { width: '25%' };
  const colHeure = { width: '10%' };

  return (
    <>
    <View style={styles.table} wrap={false}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, colNom]}>Nom</Text>
        <Text style={[styles.tableHeaderCell, colPrenom]}>Prénom</Text>
        <Text style={[styles.tableHeaderCell, colClasse]}>Classe</Text>
        <Text style={[styles.tableHeaderCell, colMatiere]}>Parcours / Sujet</Text>
        {showSchedule && (
          <Text style={[styles.tableHeaderCell, colHeure]}>Heure</Text>
        )}
        {showTopic && (
          <Text style={[styles.tableHeaderCell, styles.colSujet]}>Sujet</Text>
        )}
      </View>

      {eleves.map((eleve, idx) => {
        const isBinome = !!eleve.binomeNom;
        return (
          <View
            key={idx}
            style={[
              styles.tableRow,
              idx % 2 === 1 ? styles.tableRowAlt : {},
              isBinome ? { backgroundColor: '#f5f3ff', borderLeftWidth: 2, borderLeftColor: '#7c3aed', borderLeftStyle: 'solid' as const } : {},
            ]}
          >
            <Text style={[styles.tableCell, colNom]}>
              {eleve.nom}{isBinome ? '  ♦' : ''}
            </Text>
            <Text style={[styles.tableCell, colPrenom]}>{eleve.prenom}</Text>
            <Text style={[styles.tableCell, colClasse]}>{eleve.classe}</Text>
            <Text style={[styles.tableCell, colMatiere]}>
              {[eleve.parcoursOral, eleve.sujetOral].filter(Boolean).join(' — ') || '-'}
            </Text>
            {showSchedule && (
              <Text style={[styles.tableCell, colHeure]}>{eleve.heurePassage || '-'}</Text>
            )}
            {showTopic && (
              <Text style={[styles.tableCell, styles.colSujet]}>{eleve.sujetIntitule || '-'}</Text>
            )}
          </View>
        );
      })}
    </View>
    {eleves.some(e => e.binomeNom) && (
      <Text style={{ fontSize: 7, color: '#7c3aed', marginTop: 2 }}>
        ♦ Binôme — Les élèves marqués passent ensemble
      </Text>
    )}
    </>
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
// PAGE JURY — tout le contenu en wrap={false}
// ============================================================

interface JuryPageProps {
  jury: ExportJuryData;
  data: ExportResultData;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
  isFirstJury: boolean;
  isOralBlanc: boolean;
  qrDataUrl?: string;
}

const JuryPage: React.FC<JuryPageProps> = ({ jury, data, options, styles, isFirstJury, isOralBlanc, qrDataUrl }) => {
  const titleLabel = isOralBlanc ? 'Oral blanc' : 'Oral DNB';
  const dateOralFormatted = options.dateOral
    ? new Date(options.dateOral).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const fullTitle = dateOralFormatted
    ? `${titleLabel} - ${data.scenarioName} — ${dateOralFormatted}`
    : `${titleLabel} - ${data.scenarioName}`;

  return (
    <Page size={options.pageSize} orientation={options.orientation} style={styles.page}>
      {isFirstJury && (
        <PageHeader
          title={fullTitle}
          subtitle={options.headerSchoolName}
          date={data.dateExport}
          options={options}
          styles={styles}
        />
      )}

      <View style={styles.jurySection} wrap={false}>
        <Text style={styles.juryTitle}>{jury.juryName}</Text>
        {jury.salle && (
          <Text style={styles.jurySalle}>Salle {jury.salle}</Text>
        )}

        <EnseignantsBlock enseignants={jury.enseignants} suppleants={jury.suppleants} styles={styles} />

        {qrDataUrl && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 8, backgroundColor: '#f8fafc', borderRadius: 4 }}>
            <Image src={qrDataUrl} style={{ width: 80, height: 80 }} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 }}>Notation en ligne</Text>
              <Text style={{ fontSize: 7, color: '#64748b', lineHeight: 1.3 }}>
                Scannez ce QR code avec votre téléphone pour accéder à l'interface de notation. Saisissez ensuite votre numéro de jury pour commencer.
              </Text>
            </View>
          </View>
        )}

        {options.includeLetterText && (
          <LetterText juryName={jury.juryName} salle={jury.salle} isOralBlanc={isOralBlanc} styles={styles} />
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
};

// ============================================================
// PAGE CONVOCATION SUPPLÉANT — wrap={false} par section
// ============================================================

interface SuppleantPageProps {
  suppleant: ExportJuryData['enseignants'][0];
  jurys: ExportJuryData[];
  data: ExportResultData;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
  isOralBlanc: boolean;
}

const SuppleantPage: React.FC<SuppleantPageProps> = ({ suppleant, jurys, data, options, styles, isOralBlanc }) => {
  const titleLabel = isOralBlanc ? 'Oral blanc' : 'Oral DNB';
  const epreuve = isOralBlanc
    ? "l'oral blanc de préparation au Diplôme National du Brevet"
    : "l'épreuve orale du Diplôme National du Brevet";

  return (
  <Page size={options.pageSize} orientation={options.orientation} style={styles.page}>
    <PageHeader
      title={`${titleLabel} - ${data.scenarioName}`}
      subtitle={options.headerSchoolName}
      date={data.dateExport}
      options={options}
      styles={styles}
    />

    <View style={styles.reserveBanner} wrap={false}>
      <Text style={styles.reserveBannerText}>
        CONVOCATION — ENSEIGNANT DE RÉSERVE
      </Text>
    </View>

    <View wrap={false}>
      <Text style={styles.juryTitle}>
        {suppleant.prenom} {suppleant.nom} — {suppleant.matierePrincipale}
      </Text>

      <View style={styles.letterText}>
        <Text style={styles.letterParagraph}>
          Bonjour,
        </Text>
        <Text style={styles.letterParagraph}>
          Vous êtes désigné(e) en tant que suppléant(e) pour {epreuve}. Vous serez amené(e) à remplacer un membre de jury en cas d'absence.
        </Text>
        <Text style={styles.letterParagraph}>
          Vous trouverez ci-dessous la liste des jurys que vous couvrez. Merci de bien vouloir
          vous tenir disponible et de prendre connaissance des informations ci-dessous.
        </Text>
      </View>

      <View style={styles.enseignantsBlock}>
        <Text style={styles.enseignantsTitle}>Jurys couverts</Text>
        {jurys.map((jury, idx) => (
          <View key={idx} style={[styles.enseignantRow, { marginBottom: 3 }]}>
            <Text style={[styles.enseignantName, { width: '40%' }]}>{jury.juryName}</Text>
            <Text style={[styles.enseignantMatiere, { width: '30%' }]}>
              {jury.salle ? `Salle ${jury.salle}` : '—'}
            </Text>
            <Text style={[styles.enseignantMatiere, { width: '30%' }]}>
              {jury.nbAffectes} élève{jury.nbAffectes > 1 ? 's' : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>

    {/* Each jury detail as its own wrap={false} block */}
    {jurys.map((jury, jIdx) => (
      <View key={jIdx} style={{ marginTop: 8 }} wrap={false}>
        <Text style={[styles.juryTitle, { fontSize: 11 }]}>
          {jury.juryName}{jury.salle ? ` — Salle ${jury.salle}` : ''}
        </Text>
        <Text style={[styles.enseignantsTitle, { marginBottom: 2 }]}>
          Enseignants : {jury.enseignants.map(e => `${e.prenom} ${e.nom}`).join(', ')}
        </Text>
        <StudentTable eleves={jury.eleves} options={options} styles={styles} />
      </View>
    ))}

    <PageFooter scenarioName={data.scenarioName} styles={styles} />
  </Page>
  );
};

// ============================================================
// PAGE LISTE DE PORTE — wrap={false} sur tout le contenu
// ============================================================

interface DoorListPageProps {
  jury: ExportJuryData;
  data: ExportResultData;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
}

const DoorListPage: React.FC<DoorListPageProps> = ({ jury, data, options, styles }) => (
  <Page size={options.pageSize} orientation={options.orientation} style={styles.page}>
    <View wrap={false}>
      <View style={styles.doorHeader}>
        <Text style={styles.doorTitle}>{jury.juryName}</Text>
        {jury.salle && <Text style={styles.doorSalle}>Salle {jury.salle}</Text>}
      </View>

      {jury.eleves.map((eleve, idx) => (
        <View
          key={idx}
          style={[styles.doorRow, idx % 2 === 1 ? styles.doorRowAlt : {}]}
        >
          <Text style={styles.doorHeure}>{eleve.heurePassage || '—'}</Text>
          <Text style={styles.doorNom}>
            {eleve.nom.toUpperCase()} {eleve.prenom}{eleve.binomeNom ? ` & ${eleve.binomeNom}` : ''}
          </Text>
        </View>
      ))}
    </View>

    <PageFooter scenarioName={data.scenarioName} styles={styles} />
  </Page>
);

// ============================================================
// PAGE FEUILLE DE PRÉSENCE — wrap={false} sur tout le contenu
// ============================================================

interface AttendancePageProps {
  jury: ExportJuryData;
  data: ExportResultData;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
}

const AttendancePage: React.FC<AttendancePageProps> = ({ jury, data, options, styles }) => (
  <Page size={options.pageSize} orientation={options.orientation} style={styles.page}>
    <View wrap={false}>
      <View style={styles.attendanceHeader}>
        <Text style={styles.attendanceTitle}>Feuille de présence — {jury.juryName}</Text>
        {jury.salle && <Text style={styles.attendanceSalle}>Salle {jury.salle}</Text>}
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.attendanceColNum]}>N°</Text>
          <Text style={[styles.tableHeaderCell, styles.attendanceColHeure]}>Heure</Text>
          <Text style={[styles.tableHeaderCell, styles.attendanceColNom]}>Nom</Text>
          <Text style={[styles.tableHeaderCell, styles.attendanceColPrenom]}>Prénom</Text>
          <Text style={[styles.tableHeaderCell, styles.attendanceColClasse]}>Classe</Text>
          <Text style={[styles.tableHeaderCell, styles.attendanceColSignature]}>Signature</Text>
        </View>

        {jury.eleves.map((eleve, idx) => {
          const isBinome = !!eleve.binomeNom;
          return (
            <View
              key={idx}
              style={[
                styles.tableRow,
                idx % 2 === 1 ? styles.tableRowAlt : {},
                { minHeight: 22 },
                isBinome ? { backgroundColor: '#f5f3ff', borderLeftWidth: 2, borderLeftColor: '#7c3aed', borderLeftStyle: 'solid' as const } : {},
              ]}
            >
              <Text style={[styles.tableCell, styles.attendanceColNum]}>{idx + 1}</Text>
              <Text style={[styles.tableCell, styles.attendanceColHeure]}>{eleve.heurePassage || '—'}</Text>
              <Text style={[styles.tableCell, styles.attendanceColNom]}>
                {eleve.nom}{isBinome ? '  ♦' : ''}
              </Text>
              <Text style={[styles.tableCell, styles.attendanceColPrenom]}>{eleve.prenom}</Text>
              <Text style={[styles.tableCell, styles.attendanceColClasse]}>{eleve.classe}</Text>
              <View style={[styles.attendanceColSignature, styles.signatureCell]} />
            </View>
          );
        })}
      </View>
    </View>

    <PageFooter scenarioName={data.scenarioName} styles={styles} />
  </Page>
);

// ============================================================
// PAGE CONVOCATION ÉLÈVE — une page par élève
// ============================================================

interface EleveConvocationPageProps {
  eleve: ExportJuryData['eleves'][0];
  jury: ExportJuryData;
  data: ExportResultData;
  options: PdfExportOptions;
  styles: ReturnType<typeof createStyles>;
  isOralBlanc: boolean;
}

const EleveConvocationPage: React.FC<EleveConvocationPageProps> = ({ eleve, jury, data, options, styles, isOralBlanc }) => {
  const titleLabel = isOralBlanc ? 'Oral blanc' : 'Oral DNB';
  const epreuve = isOralBlanc
    ? "l'oral blanc de préparation au Diplôme National du Brevet"
    : "l'épreuve orale du Diplôme National du Brevet";
  const dateOralFormatted = options.dateOral
    ? new Date(options.dateOral).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <Page size={options.pageSize} orientation={options.orientation} style={styles.page}>
      <PageHeader
        title={`${titleLabel} — Convocation élève`}
        subtitle={options.headerSchoolName}
        date={data.dateExport}
        options={options}
        styles={styles}
      />

      <View wrap={false}>
        <Text style={[styles.juryTitle, { marginBottom: 8 }]}>
          {eleve.prenom} {eleve.nom}
        </Text>
        <Text style={[styles.jurySalle, { marginBottom: 4 }]}>
          Classe : {eleve.classe}
        </Text>

        <View style={styles.letterText}>
          <Text style={styles.letterParagraph}>
            Vous êtes convoqué(e) pour {epreuve}.{dateOralFormatted ? ` L'épreuve aura lieu le ${dateOralFormatted}.` : ''}
          </Text>
          <Text style={styles.letterParagraph}>
            Vous passerez devant le {jury.juryName}{jury.salle ? `, en salle ${jury.salle}` : ''}.
            {eleve.heurePassage ? ` Votre heure de passage est prévue à ${eleve.heurePassage}.` : ''}
            {eleve.binomeNom ? ` Vous passerez en binôme avec ${eleve.binomeNom}.` : ''}
          </Text>
          {(eleve.parcoursOral || eleve.sujetOral) && (
            <Text style={styles.letterParagraph}>
              {eleve.parcoursOral ? `Parcours : ${eleve.parcoursOral}.` : ''}{eleve.sujetOral ? ` Sujet : ${eleve.sujetOral}.` : ''}
            </Text>
          )}
        </View>

        <View style={[styles.letterText, { marginTop: 8 }]}>
          <Text style={styles.letterParagraph}>
            Vous êtes prié(e) de vous présenter 10 minutes avant l'heure prévue, muni(e) de la présente convocation et d'une pièce d'identité.
          </Text>
          <Text style={styles.letterParagraph}>
            Nous vous prions d'agréer l'expression de nos salutations distinguées.
          </Text>
        </View>
      </View>

      <PageFooter scenarioName={data.scenarioName} styles={styles} />
    </Page>
  );
};

// ============================================================
// PAGE NON-AFFECTÉS — wrap={false} sur le tableau
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

      <View style={styles.table} wrap={false}>
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
  qrCodes?: Map<string, string>;  // juryName → data URL du QR code
}

export const PdfJuryDocument: React.FC<PdfJuryDocumentProps> = ({
  data,
  options: partialOptions = {},
  qrCodes,
}) => {
  const options: PdfExportOptions = { ...DEFAULT_PDF_OPTIONS, ...partialOptions };
  const styles = createStyles(options);
  const isOralBlanc = options.typeOral === 'oral_blanc';

  // Collect unique suppléants across all jurys
  const suppleantMap = new Map<string, { suppleant: ExportJuryData['enseignants'][0]; jurys: ExportJuryData[] }>();
  for (const jury of data.jurys) {
    if (jury.suppleants) {
      for (const sup of jury.suppleants) {
        const existing = suppleantMap.get(sup.enseignantId);
        if (existing) {
          existing.jurys.push(jury);
        } else {
          suppleantMap.set(sup.enseignantId, { suppleant: sup, jurys: [jury] });
        }
      }
    }
  }

  return (
    <Document>
      {/* Pages de convocation enseignants par jury */}
      {options.includeSectionConvocProf && data.jurys.map((jury, idx) => (
        <JuryPage
          key={jury.juryId}
          jury={jury}
          data={data}
          options={options}
          styles={styles}
          isFirstJury={idx === 0}
          isOralBlanc={isOralBlanc}
          qrDataUrl={qrCodes?.get(jury.juryName)}
        />
      ))}

      {/* Pages de convocation suppléants (rattachées aux convoc profs) */}
      {options.includeSectionConvocProf && [...suppleantMap.values()].map(({ suppleant, jurys }) => (
        <SuppleantPage
          key={suppleant.enseignantId}
          suppleant={suppleant}
          jurys={jurys}
          data={data}
          options={options}
          styles={styles}
          isOralBlanc={isOralBlanc}
        />
      ))}

      {/* Pages de convocation élèves (une par élève) */}
      {options.includeSectionConvocEleve && data.jurys.flatMap(jury =>
        jury.eleves.map(eleve => (
          <EleveConvocationPage
            key={`convoc-eleve-${eleve.eleveId}`}
            eleve={eleve}
            jury={jury}
            data={data}
            options={options}
            styles={styles}
            isOralBlanc={isOralBlanc}
          />
        ))
      )}

      {/* Pages non-affectés */}
      {options.includeUnassignedPage && data.unassigned.length > 0 && (
        <UnassignedPage data={data} options={options} styles={styles} />
      )}

      {/* Listes de porte (une par jury) */}
      {options.includeSectionFeuillesPorte && data.jurys.map(jury => (
        <DoorListPage
          key={`door-${jury.juryId}`}
          jury={jury}
          data={data}
          options={options}
          styles={styles}
        />
      ))}

      {/* Feuilles de présence / émargement (une par jury) */}
      {options.includeSectionEmargement && data.jurys.map(jury => (
        <AttendancePage
          key={`attend-${jury.juryId}`}
          jury={jury}
          data={data}
          options={options}
          styles={styles}
        />
      ))}
    </Document>
  );
};
