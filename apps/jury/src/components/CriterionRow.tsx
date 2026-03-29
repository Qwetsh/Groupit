import type { Criterion } from '@groupit/shared';

const LEVEL_COLORS = [
  { bg: '#fde8e8', border: '#e53e3e', text: '#9b2c2c' },
  { bg: '#fefcbf', border: '#d69e2e', text: '#975a16' },
  { bg: '#e2f0e8', border: '#38a169', text: '#276749' },
  { bg: '#c6f6d5', border: '#22763a', text: '#1a4731' },
];

interface CriterionRowProps {
  criterion: Criterion;
  selected: number | undefined;
  onSelect: (value: number) => void;
  disabled?: boolean;
}

export function CriterionRow({ criterion, selected, onSelect, disabled }: CriterionRowProps) {
  const selectedIdx = criterion.levels.findIndex(l => l.value === selected);
  const borderColor = selectedIdx >= 0 ? LEVEL_COLORS[selectedIdx % LEVEL_COLORS.length]!.border : '#d2dce6';

  return (
    <div style={{
      marginBottom: 10,
      background: '#fff',
      borderRadius: 10,
      padding: '10px 12px',
      border: selected !== undefined ? `1.5px solid ${borderColor}` : '1px solid #d2dce6',
      transition: 'border-color 0.2s',
      opacity: disabled ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a202c' }}>{criterion.label}</div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 1 }}>{criterion.desc}</div>
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: 800,
          color: selected !== undefined ? '#1a365d' : '#4a5568',
          minWidth: 36,
          textAlign: 'right' as const,
        }}>
          {selected !== undefined ? `${selected}` : '—'}/{criterion.max}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {criterion.levels.map((level, idx) => {
          const isSelected = selected === level.value;
          const col = LEVEL_COLORS[idx % LEVEL_COLORS.length]!;
          const shortLabel = (level as { shortLabel?: string }).shortLabel
            || ['TI', 'I', 'S', 'TS'][idx]
            || `N${idx + 1}`;
          return (
            <button
              key={idx}
              onClick={() => !disabled && onSelect(level.value)}
              disabled={disabled}
              style={{
                flex: 1,
                padding: '8px 2px',
                borderRadius: 8,
                border: isSelected ? `2.5px solid ${col.border}` : '1.5px solid #d2dce6',
                background: isSelected ? col.bg : '#f8fafc',
                color: isSelected ? col.text : '#4a5568',
                fontSize: 12,
                fontWeight: isSelected ? 800 : 500,
                cursor: disabled ? 'default' : 'pointer',
                textAlign: 'center' as const,
                transition: 'all 0.12s ease',
                lineHeight: 1.2,
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700 }}>{shortLabel}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>{level.value}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { LEVEL_COLORS };
