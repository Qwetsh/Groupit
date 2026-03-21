import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import type { DistributionBucket, CritereStats, JuryStats, ParcoursStats } from '../hooks/useStats';

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
