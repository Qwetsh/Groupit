// ============================================================
// STAGES MAP CARD - Carte des lieux de stage pour le dashboard
// ============================================================

import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, School, Briefcase, AlertTriangle } from 'lucide-react';
import { HelpTooltip, HELP_TEXTS } from '../ui/Tooltip';
import { haversineDistance } from '../../infrastructure/geo/hash';
import type { Stage, Eleve } from '../../domain/models';
import type { GeoPoint } from '../../infrastructure/geo/types';
import './StagesMapCard.css';

// ============================================================
// TYPES
// ============================================================

interface StageWithDistance {
  stage: Stage;
  eleve?: Eleve;
  distanceKm: number;
}

interface StagesMapCardProps {
  stages: Stage[];
  eleves: Eleve[];
  collegeGeo: GeoPoint;
}

// ============================================================
// CONSTANTS
// ============================================================

// Seuils de distance pour le code couleur (en km)
const DISTANCE_THRESHOLDS = {
  close: 5,    // 0-5 km : vert
  medium: 10,  // 5-10 km : jaune
  far: 20,     // 10-20 km : orange
  // > 20 km : rouge
};

// Couleurs associées
const DISTANCE_COLORS = {
  close: '#22c55e',   // vert
  medium: '#eab308',  // jaune
  far: '#f97316',     // orange
  veryFar: '#ef4444', // rouge
};

// ============================================================
// CUSTOM MARKER ICONS
// ============================================================

const collegeIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 32px;
    height: 32px;
    background: #3b82f6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c0 1 2 2 6 2s6-1 6-2v-5"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDistanceColor(distanceKm: number): string {
  if (distanceKm <= DISTANCE_THRESHOLDS.close) return DISTANCE_COLORS.close;
  if (distanceKm <= DISTANCE_THRESHOLDS.medium) return DISTANCE_COLORS.medium;
  if (distanceKm <= DISTANCE_THRESHOLDS.far) return DISTANCE_COLORS.far;
  return DISTANCE_COLORS.veryFar;
}

function getDistanceLabel(distanceKm: number): string {
  if (distanceKm <= DISTANCE_THRESHOLDS.close) return 'Proche';
  if (distanceKm <= DISTANCE_THRESHOLDS.medium) return 'Moyen';
  if (distanceKm <= DISTANCE_THRESHOLDS.far) return 'Éloigné';
  return 'Très éloigné';
}

// ============================================================
// FIT BOUNDS COMPONENT
// ============================================================

function FitBoundsOnLoad({ points }: { points: GeoPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const bounds = L.latLngBounds(
      points.map(p => [p.lat, p.lon] as [number, number])
    );

    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }, [map, points]);

  return null;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StagesMapCard({ stages, eleves, collegeGeo }: StagesMapCardProps) {
  // Filtrer les stages avec coordonnées et calculer les distances
  const stagesWithDistance = useMemo(() => {
    const result: StageWithDistance[] = [];

    for (const stage of stages) {
      if (!stage.lat || !stage.lon) continue;

      const distanceKm = haversineDistance(
        collegeGeo.lat, collegeGeo.lon,
        stage.lat, stage.lon
      );

      const eleve = eleves.find(e => e.id === stage.eleveId);

      result.push({
        stage,
        eleve,
        distanceKm,
      });
    }

    return result.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [stages, eleves, collegeGeo]);

  // Stats
  const stats = useMemo(() => {
    const total = stagesWithDistance.length;
    const withoutGeo = stages.length - total;

    const byCategory = {
      close: stagesWithDistance.filter(s => s.distanceKm <= DISTANCE_THRESHOLDS.close).length,
      medium: stagesWithDistance.filter(s => s.distanceKm > DISTANCE_THRESHOLDS.close && s.distanceKm <= DISTANCE_THRESHOLDS.medium).length,
      far: stagesWithDistance.filter(s => s.distanceKm > DISTANCE_THRESHOLDS.medium && s.distanceKm <= DISTANCE_THRESHOLDS.far).length,
      veryFar: stagesWithDistance.filter(s => s.distanceKm > DISTANCE_THRESHOLDS.far).length,
    };

    const avgDistance = total > 0
      ? stagesWithDistance.reduce((sum, s) => sum + s.distanceKm, 0) / total
      : 0;

    const maxDistance = total > 0
      ? Math.max(...stagesWithDistance.map(s => s.distanceKm))
      : 0;

    return { total, withoutGeo, byCategory, avgDistance, maxDistance };
  }, [stagesWithDistance, stages.length]);

  // Points pour le fit bounds
  const allPoints = useMemo(() => {
    const points: GeoPoint[] = [collegeGeo];
    stagesWithDistance.forEach(s => {
      if (s.stage.lat && s.stage.lon) {
        points.push({ lat: s.stage.lat, lon: s.stage.lon });
      }
    });
    return points;
  }, [collegeGeo, stagesWithDistance]);

  // Format distance
  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  // Pas de stages géocodés
  if (stagesWithDistance.length === 0) {
    return (
      <div className="stages-map-card empty">
        <div className="card-header-with-icon">
          <MapPin size={20} />
          <h2>Carte des stages</h2>
          <HelpTooltip content={HELP_TEXTS.dashboard.stagesMap} />
        </div>
        <div className="map-empty-state">
          <AlertTriangle size={32} />
          <p>Aucun stage géocodé</p>
          <span>Importez des stages avec adresses pour voir la carte</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stages-map-card">
      <div className="card-header-with-icon">
        <MapPin size={20} />
        <h2>Carte des stages</h2>
        <HelpTooltip content={HELP_TEXTS.dashboard.stagesMap} />
        <span className="stages-count">{stats.total} stages</span>
      </div>

      {/* Map Container */}
      <div className="map-wrapper">
        <MapContainer
          center={[collegeGeo.lat, collegeGeo.lon]}
          zoom={11}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBoundsOnLoad points={allPoints} />

          {/* College marker */}
          <Marker position={[collegeGeo.lat, collegeGeo.lon]} icon={collegeIcon}>
            <Popup>
              <div className="map-popup">
                <strong><School size={14} /> Collège</strong>
                <p>Point de référence</p>
              </div>
            </Popup>
          </Marker>

          {/* Stage markers */}
          {stagesWithDistance.map(({ stage, eleve, distanceKm }) => (
            <CircleMarker
              key={stage.id}
              center={[stage.lat!, stage.lon!]}
              radius={8}
              fillColor={getDistanceColor(distanceKm)}
              color="white"
              weight={2}
              fillOpacity={0.9}
            >
              <Popup>
                <div className="map-popup">
                  <strong>
                    <Briefcase size={14} /> {eleve?.prenom || stage.elevePrenom} {eleve?.nom || stage.eleveNom}
                  </strong>
                  {stage.nomEntreprise && <p>{stage.nomEntreprise}</p>}
                  <p className="popup-address">{stage.adresse}</p>
                  {stage.ville && <p className="popup-city">{stage.codePostal} {stage.ville}</p>}
                  <p className="popup-distance" style={{ color: getDistanceColor(distanceKm) }}>
                    {formatDistance(distanceKm)} - {getDistanceLabel(distanceKm)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend & Stats */}
      <div className="map-footer">
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: DISTANCE_COLORS.close }}></span>
            <span>0-{DISTANCE_THRESHOLDS.close} km</span>
            <span className="legend-count">{stats.byCategory.close}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: DISTANCE_COLORS.medium }}></span>
            <span>{DISTANCE_THRESHOLDS.close}-{DISTANCE_THRESHOLDS.medium} km</span>
            <span className="legend-count">{stats.byCategory.medium}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: DISTANCE_COLORS.far }}></span>
            <span>{DISTANCE_THRESHOLDS.medium}-{DISTANCE_THRESHOLDS.far} km</span>
            <span className="legend-count">{stats.byCategory.far}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: DISTANCE_COLORS.veryFar }}></span>
            <span>&gt;{DISTANCE_THRESHOLDS.far} km</span>
            <span className="legend-count">{stats.byCategory.veryFar}</span>
          </div>
        </div>

        <div className="map-stats">
          <div className="stat">
            <span className="stat-value">{formatDistance(stats.avgDistance)}</span>
            <span className="stat-label">moyenne</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatDistance(stats.maxDistance)}</span>
            <span className="stat-label">max</span>
          </div>
        </div>
      </div>

      {/* Warning for stages without geo */}
      {stats.withoutGeo > 0 && (
        <div className="map-warning">
          <AlertTriangle size={14} />
          <span>{stats.withoutGeo} stage(s) sans coordonnées</span>
        </div>
      )}
    </div>
  );
}

export default StagesMapCard;
