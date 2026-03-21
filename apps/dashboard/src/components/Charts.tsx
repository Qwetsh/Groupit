import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';
import type { DistributionBucket, CritereStats, JuryStats, ParcoursStats, DureeDistributionBucket, DureeNotePoint } from '../hooks/useStats';

interface DistributionChartProps {
  data: DistributionBucket[];
}

export function DistributionChart({ data }: DistributionChartProps) {
  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>Distribution des notes</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="range" fontSize={12} />
          <YAxis fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value: number) => [`${value} élève(s)`, 'Effectif']}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CritereRadarChartProps {
  data: CritereStats[];
}

export function CritereRadarChart({ data }: CritereRadarChartProps) {
  const radarData = data.map(d => ({
    critere: d.label.split(' ')[0],
    pourcentage: d.pourcentageMoyen,
    fullLabel: d.label,
  }));

  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>Performance par critère</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="critere" fontSize={11} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={10} />
          <Tooltip
            formatter={(value: number) => [`${value}%`, 'Performance']}
          />
          <Radar name="Moyenne" dataKey="pourcentage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface JuryBarChartProps {
  data: JuryStats[];
}

export function JuryBarChart({ data }: JuryBarChartProps) {
  const chartData = data.map(d => ({
    jury: d.juryName,
    moyenne: d.moyenne,
    evalues: d.evalues,
    total: d.totalEleves,
  }));

  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>Moyenne par jury</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="jury" fontSize={11} />
          <YAxis domain={[0, 20]} fontSize={12} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value: number, name: string) => [
              name === 'moyenne' ? `${value}/20` : value,
              name === 'moyenne' ? 'Moyenne' : 'Évalués',
            ]}
          />
          <Bar dataKey="moyenne" fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ParcoursBarChartProps {
  data: ParcoursStats[];
}

export function ParcoursBarChart({ data }: ParcoursBarChartProps) {
  const chartData = data.map(d => ({
    parcours: d.parcours.length > 15 ? d.parcours.slice(0, 15) + '…' : d.parcours,
    moyenne: d.moyenne,
    count: d.count,
  }));

  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>Moyenne par parcours</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="parcours" fontSize={11} />
          <YAxis domain={[0, 20]} fontSize={12} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value: number, name: string) => [
              name === 'moyenne' ? `${value}/20` : `${value} élève(s)`,
              name === 'moyenne' ? 'Moyenne' : 'Effectif',
            ]}
          />
          <Bar dataKey="moyenne" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DureeDistributionChartProps {
  data: DureeDistributionBucket[];
}

export function DureeDistributionChart({ data }: DureeDistributionChartProps) {
  if (data.length === 0) return null;
  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>Distribution des durées de passage</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="range" fontSize={11} />
          <YAxis fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value: number) => [`${value} élève(s)`, 'Effectif']}
          />
          <Bar dataKey="count" fill="#d97706" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function getScatterColor(note: number): string {
  if (note >= 16) return '#276749';
  if (note >= 14) return '#2c7a7b';
  if (note >= 10) return '#2b6cb0';
  return '#c53030';
}

interface DureeNoteScatterChartProps {
  data: DureeNotePoint[];
}

export function DureeNoteScatterChart({ data }: DureeNoteScatterChartProps) {
  if (data.length === 0) return null;
  const chartData = data.map(d => ({
    ...d,
    dureeMinutes: Math.round(d.duree / 6) / 10, // arrondi 0.1 min
  }));

  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>Durée de passage vs Note</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="dureeMinutes"
            name="Durée"
            unit=" min"
            fontSize={12}
            type="number"
          />
          <YAxis
            dataKey="note"
            name="Note"
            unit="/20"
            domain={[0, 20]}
            fontSize={12}
            type="number"
          />
          <ZAxis range={[50, 50]} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(value: number, name: string) => {
              if (name === 'Durée') return [`${value} min`, name];
              return [`${value}/20`, name];
            }}
            labelFormatter={(_: unknown, payload: Array<{ payload?: DureeNotePoint }>) => {
              const p = payload?.[0]?.payload;
              return p ? p.displayName : '';
            }}
          />
          <Scatter data={chartData}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getScatterColor(entry.note)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  chartCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 12,
  },
};
