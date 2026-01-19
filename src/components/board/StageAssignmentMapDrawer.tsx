// ============================================================
// STAGE ASSIGNMENT MAP DRAWER
// Carte interactive avec trajets pour suivi de stage
// ============================================================

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Navigation, Users, AlertTriangle, Loader, School, User, Briefcase } from 'lucide-react';
import { haversineDistance } from '../../infrastructure/geo/hash';
import { getRouteCache } from '../../infrastructure/geo/cacheRepo';
import type { Enseignant, Stage, Eleve } from '../../domain/models';
import type { GeoPoint } from '../../infrastructure/geo/types';
import './StageAssignmentMapDrawer.css';

// ============================================================
// TYPES
// ============================================================

interface StageWithEleve extends Stage {
  eleve?: Eleve;
}

interface StudentDistanceInfo {
  stage: StageWithEleve;
  distanceKm: number;
  durationMin?: number;
  isApprox: boolean; // true si Haversine (pas de route en cache)
}

interface StageAssignmentMapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Enseignant;
  assignedStages: StageWithEleve[];
  collegeGeo: GeoPoint;
}

// ============================================================
// CONSTANTS
// ============================================================

// Coordonnées du collège (1 rue Jean Laurain, 57140 Woippy)
// Source approximative centrée sur l'établissement (Woippy, Metz Nord)
export const COLLEGE_GEO: GeoPoint = {
  lat: 49.1452,
  lon: 6.1667,
};

export const COLLEGE_ADDRESS = '1 rue Jean Laurain, 57140 Woippy';

// ============================================================
// CUSTOM MARKER ICONS
// ============================================================

const createCustomIcon = (color: string, size: number = 24): L.DivIcon => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const collegeIcon = createCustomIcon('#10b981', 28);
const teacherIcon = createCustomIcon('#3b82f6', 26);
const stageIcon = createCustomIcon('#f59e0b', 22);

// ============================================================
// MAP FIT BOUNDS COMPONENT
// ============================================================

interface FitBoundsProps {
  points: GeoPoint[];
}

function FitBoundsOnLoad({ points }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const bounds = L.latLngBounds(
      points.map(p => [p.lat, p.lon] as [number, number])
    );
    
    // Add some padding
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [map, points]);

  return null;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StageAssignmentMapDrawer({
  isOpen,
  onClose,
  teacher,
  assignedStages,
  collegeGeo,
}: StageAssignmentMapDrawerProps) {
  const [distanceInfos, setDistanceInfos] = useState<StudentDistanceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Teacher geo point
  const teacherGeo: GeoPoint | null = useMemo(() => {
    if (teacher.lat && teacher.lon) {
      return { lat: teacher.lat, lon: teacher.lon };
    }
    return null;
  }, [teacher]);

  // Filter stages with valid geo coordinates
  const geoStages = useMemo(() => {
    return assignedStages.filter(s => s.lat && s.lon && s.geoStatus === 'ok');
  }, [assignedStages]);

  // Stages without geo (for warning)
  const stagesWithoutGeo = useMemo(() => {
    return assignedStages.filter(s => !s.lat || !s.lon || s.geoStatus !== 'ok');
  }, [assignedStages]);

  // All points for bounds calculation
  const allPoints = useMemo(() => {
    const points: GeoPoint[] = [collegeGeo];
    if (teacherGeo) points.push(teacherGeo);
    geoStages.forEach(s => {
      if (s.lat && s.lon) {
        points.push({ lat: s.lat, lon: s.lon });
      }
    });
    return points;
  }, [collegeGeo, teacherGeo, geoStages]);

  // Load distances (from cache or calculate Haversine)
  const loadDistances = useCallback(async () => {
    if (!teacherGeo || geoStages.length === 0) {
      setDistanceInfos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const infos: StudentDistanceInfo[] = [];

    for (const stage of geoStages) {
      if (!stage.lat || !stage.lon) continue;

      const stageGeo: GeoPoint = { lat: stage.lat, lon: stage.lon };
      
      // Try to get from route cache first
      let distanceKm: number;
      let durationMin: number | undefined;
      let isApprox = true;

      try {
        // Check cache for OSRM routes
        const cachedRoute = await getRouteCache(teacherGeo, stageGeo, 'osrm');
        
        if (cachedRoute) {
          distanceKm = cachedRoute.distanceKm;
          durationMin = cachedRoute.durationMin;
          isApprox = false;
        } else {
          // Fallback to Haversine with road factor
          const directDist = haversineDistance(
            teacherGeo.lat, teacherGeo.lon,
            stageGeo.lat, stageGeo.lon
          );
          // Apply road factor (~1.3 for typical roads)
          distanceKm = directDist * 1.3;
          // Estimate duration (~50 km/h average)
          durationMin = (distanceKm / 50) * 60;
        }
      } catch (error) {
        // Fallback to Haversine
        const directDist = haversineDistance(
          teacherGeo.lat, teacherGeo.lon,
          stageGeo.lat, stageGeo.lon
        );
        distanceKm = directDist * 1.3;
        durationMin = (distanceKm / 50) * 60;
      }

      infos.push({
        stage,
        distanceKm,
        durationMin,
        isApprox,
      });
    }

    // Sort by distance
    infos.sort((a, b) => a.distanceKm - b.distanceKm);
    setDistanceInfos(infos);
    setIsLoading(false);
  }, [teacherGeo, geoStages]);

  useEffect(() => {
    if (isOpen) {
      loadDistances();
    }
  }, [isOpen, loadDistances]);

  // Stats calculations
  const totalDistance = useMemo(() => {
    return distanceInfos.reduce((sum, info) => sum + info.distanceKm, 0);
  }, [distanceInfos]);

  const avgDistance = useMemo(() => {
    if (distanceInfos.length === 0) return 0;
    return totalDistance / distanceInfos.length;
  }, [totalDistance, distanceInfos]);

  const approxCount = useMemo(() => {
    return distanceInfos.filter(i => i.isApprox).length;
  }, [distanceInfos]);

  // Format distance
  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  // Format duration
  const formatDuration = (min: number): string => {
    if (min < 60) return `${Math.round(min)} min`;
    const hours = Math.floor(min / 60);
    const mins = Math.round(min % 60);
    return `${hours}h${mins > 0 ? mins : ''}`;
  };

  // Get distance class
  const getDistanceClass = (km: number): string => {
    if (km > 30) return 'very-far';
    if (km > 15) return 'far';
    return '';
  };

  // Handle click outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div 
        className={`stage-map-drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={handleOverlayClick}
      />
      
      {/* Drawer */}
      <div className={`stage-map-drawer ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="stage-map-drawer-header">
          <h3>
            <Navigation size={20} />
            Trajets de {teacher.prenom} {teacher.nom}
          </h3>
          <button className="drawer-close-btn" onClick={onClose} title="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="stage-map-drawer-content">
          {/* Alerts */}
          {!teacherGeo && (
            <div className="missing-data-alert error" style={{ margin: '1rem' }}>
              <AlertTriangle size={20} />
              <div className="alert-content">
                <div className="alert-title">Adresse enseignant non géocodée</div>
                <div className="alert-message">
                  L'adresse de {teacher.prenom} {teacher.nom} n'a pas pu être géolocalisée.
                  La carte ne peut pas afficher les trajets.
                </div>
              </div>
            </div>
          )}

          {/* Map */}
          {teacherGeo && (
            <div className="stage-map-container">
              <MapContainer
                center={[teacherGeo.lat, teacherGeo.lon]}
                zoom={11}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Fit bounds to all points */}
                <FitBoundsOnLoad points={allPoints} />

                {/* College marker */}
                <Marker position={[collegeGeo.lat, collegeGeo.lon]} icon={collegeIcon}>
                  <Popup>
                    <div className="popup-content">
                      <h4><School size={14} style={{ display: 'inline', marginRight: 4 }} /> Collège</h4>
                      <p>{COLLEGE_ADDRESS}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Teacher marker */}
                <Marker position={[teacherGeo.lat, teacherGeo.lon]} icon={teacherIcon}>
                  <Popup>
                    <div className="popup-content">
                      <h4><User size={14} style={{ display: 'inline', marginRight: 4 }} /> {teacher.prenom} {teacher.nom}</h4>
                      <p>{teacher.adresse}</p>
                      {teacher.commune && <p>{teacher.commune}</p>}
                    </div>
                  </Popup>
                </Marker>

                {/* Stage markers */}
                {geoStages.map((stage) => {
                  const info = distanceInfos.find(i => i.stage.id === stage.id);
                  return (
                    <Marker 
                      key={stage.id} 
                      position={[stage.lat!, stage.lon!]} 
                      icon={stageIcon}
                    >
                      <Popup>
                        <div className="popup-content">
                          <h4>
                            <Briefcase size={14} style={{ display: 'inline', marginRight: 4 }} />
                            {stage.elevePrenom} {stage.eleveNom}
                          </h4>
                          {stage.nomEntreprise && <p><strong>{stage.nomEntreprise}</strong></p>}
                          <p>{stage.adresse}</p>
                          {stage.ville && <p>{stage.codePostal} {stage.ville}</p>}
                          {info && (
                            <p className="distance-info">
                              {formatDistance(info.distanceKm)}
                              {info.durationMin && ` • ~${formatDuration(info.durationMin)}`}
                              {info.isApprox && ' (approx.)'}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Polylines from teacher to each stage */}
                {geoStages.map((stage) => (
                  <Polyline
                    key={`line-${stage.id}`}
                    positions={[
                      [teacherGeo.lat, teacherGeo.lon],
                      [stage.lat!, stage.lon!]
                    ]}
                    color="#3b82f6"
                    weight={2}
                    opacity={0.6}
                    dashArray="5, 10"
                  />
                ))}
              </MapContainer>
            </div>
          )}

          {/* Stats Panel */}
          <div className="stage-map-stats">
            {/* Missing stages warning */}
            {stagesWithoutGeo.length > 0 && (
              <div className="missing-data-alert">
                <AlertTriangle size={18} />
                <div className="alert-content">
                  <div className="alert-title">
                    {stagesWithoutGeo.length} stage{stagesWithoutGeo.length > 1 ? 's' : ''} sans coordonnées
                  </div>
                  <div className="missing-stages-list">
                    {stagesWithoutGeo.slice(0, 3).map(s => (
                      <span key={s.id}>{s.elevePrenom} {s.eleveNom}</span>
                    )).reduce((prev, curr, i) => (
                      <>{prev}{i > 0 ? ', ' : ''}{curr}</>
                    ), <></>)}
                    {stagesWithoutGeo.length > 3 && ` et ${stagesWithoutGeo.length - 3} autre(s)...`}
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading ? (
              <div className="map-loading">
                <Loader size={24} />
                <span>Calcul des distances...</span>
              </div>
            ) : (
              <>
                {/* Summary stats */}
                <div className="stats-summary">
                  <div className="stat-card">
                    <div className="stat-value">{geoStages.length}</div>
                    <div className="stat-label">Stages</div>
                  </div>
                  <div className="stat-card">
                    <div className={`stat-value ${totalDistance > 100 ? 'warning' : ''}`}>
                      {formatDistance(totalDistance)}
                    </div>
                    <div className="stat-label">Distance totale</div>
                  </div>
                  <div className="stat-card">
                    <div className={`stat-value ${avgDistance > 20 ? 'warning' : ''}`}>
                      {formatDistance(avgDistance)}
                    </div>
                    <div className="stat-label">Moy. par stage</div>
                  </div>
                </div>

                {/* Student list */}
                {distanceInfos.length > 0 && (
                  <>
                    <div className="student-list-header">
                      <h4>
                        <Users size={16} />
                        Détail par élève
                      </h4>
                      {approxCount > 0 && (
                        <span className="badge-approx">
                          <AlertTriangle size={10} />
                          {approxCount} approx.
                        </span>
                      )}
                    </div>
                    <div className="student-list">
                      {distanceInfos.map((info) => (
                        <div key={info.stage.id} className="student-item">
                          <div className="student-info">
                            <span className="student-name">
                              {info.stage.elevePrenom} {info.stage.eleveNom}
                            </span>
                            {info.stage.nomEntreprise && (
                              <span className="student-entreprise">
                                {info.stage.nomEntreprise}
                              </span>
                            )}
                          </div>
                          <div className="student-distance">
                            <span className={`distance-value ${getDistanceClass(info.distanceKm)}`}>
                              {formatDistance(info.distanceKm)}
                              {info.isApprox && (
                                <span className="badge-approx" title="Distance approximative (vol d'oiseau × 1.3)">
                                  ~
                                </span>
                              )}
                            </span>
                            {info.durationMin && (
                              <span className="duration-value">
                                ~{formatDuration(info.durationMin)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Legend */}
          <div className="map-legend">
            <div className="legend-item">
              <span className="legend-marker college"></span>
              Collège
            </div>
            <div className="legend-item">
              <span className="legend-marker teacher"></span>
              Enseignant
            </div>
            <div className="legend-item">
              <span className="legend-marker stage"></span>
              Stage
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default StageAssignmentMapDrawer;
