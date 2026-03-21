import { useState, useEffect, useRef, useCallback } from 'react';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TimerProps {
  duration: number;
  /** Si fourni, affiche le temps écoulé sans contrôles */
  elapsedSeconds?: number;
  /** Appelé à chaque seconde avec le nombre de secondes écoulées */
  onTick?: (elapsed: number) => void;
  onEnd?: () => void;
}

export function Timer({ duration, elapsedSeconds, onTick, onEnd }: TimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    setRemaining(duration);
    setRunning(false);
    elapsedRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [duration]);

  const tick = useCallback(() => {
    setRemaining((r) => {
      elapsedRef.current++;
      onTickRef.current?.(elapsedRef.current);
      if (r <= 1) {
        clearInterval(intervalRef.current!);
        setRunning(false);
        onEnd?.();
        return 0;
      }
      return r - 1;
    });
  }, [onEnd]);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, remaining, tick]);

  // Mode lecture seule : afficher le temps passé
  if (elapsedSeconds !== undefined) {
    return (
      <div style={{
        background: '#f0fff4',
        borderRadius: 12,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: '1px solid #c6f6d5',
      }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <span style={{
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontSize: 18,
          fontWeight: 700,
          color: '#276749',
          letterSpacing: 1,
        }}>
          {formatTime(elapsedSeconds)}
        </span>
        <span style={{ fontSize: 13, color: '#4a5568' }}>
          écoulé{elapsedSeconds >= duration ? ' (temps dépassé)' : ''}
        </span>
      </div>
    );
  }

  const pct = ((duration - remaining) / duration) * 100;
  const isWarning = remaining <= 120 && remaining > 0 && running;
  const isDone = remaining === 0;

  const strokeColor = isDone ? '#e53e3e' : isWarning ? '#d69e2e' : '#2b6cb0';

  return (
    <div style={{
      background: isDone ? '#fed7d7' : isWarning ? '#fefcbf' : '#f0f4f8',
      borderRadius: 12,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      border: `1px solid ${isDone ? '#feb2b2' : isWarning ? '#f6e05e' : '#d2dce6'}`,
      transition: 'all 0.3s ease',
    }}>
      <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="19" fill="none" stroke="#d2dce6" strokeWidth="3" />
          <circle
            cx="22" cy="22" r="19"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 19}`}
            strokeDashoffset={`${2 * Math.PI * 19 * (1 - pct / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
        </svg>
      </div>
      <span style={{
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        fontSize: 22,
        fontWeight: 700,
        color: isDone ? '#e53e3e' : isWarning ? '#975a16' : '#1a365d',
        letterSpacing: 1,
        minWidth: 64,
      }}>
        {formatTime(remaining)}
      </span>
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        {!running && remaining > 0 && (
          <button onClick={() => setRunning(true)} style={btnStyle('#2b6cb0')}>▶</button>
        )}
        {running && (
          <button onClick={() => { setRunning(false); if (intervalRef.current) clearInterval(intervalRef.current); }} style={btnStyle('#d69e2e')}>⏸</button>
        )}
        <button onClick={() => { setRunning(false); if (intervalRef.current) clearInterval(intervalRef.current); setRemaining(duration); elapsedRef.current = 0; }} style={btnStyle('#718096')}>↺</button>
      </div>
    </div>
  );
}

const btnStyle = (color: string): React.CSSProperties => ({
  width: 36,
  height: 36,
  borderRadius: 8,
  border: 'none',
  background: color,
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});
