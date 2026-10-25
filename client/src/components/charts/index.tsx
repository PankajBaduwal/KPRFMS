import React, { useEffect, useRef, useState } from 'react';

/**
 * Shared dashboard chart building blocks. Motion is short (0.6–0.9 s), plays once, and is
 * switched off for people who ask their system to reduce motion.
 */

/** Chart colours: brand navy first, then calm, distinguishable tones. */
export const CHART_COLORS = ['#1B345F', '#2E7D9A', '#2F8F5B', '#C28A2C', '#7A8AA6', '#B4535F', '#5B6BC0'];
export const QUARTILE_COLORS: Record<string, string> = { Q1: '#1B345F', Q2: '#2E7D9A', Q3: '#2F8F5B', Q4: '#C28A2C', NA: '#B8C2D3' };

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Props to spread on Recharts series so they animate once, gently, unless motion is reduced. */
export function useChartAnimation(delayMs = 0) {
  const reduced = usePrefersReducedMotion();
  return { isAnimationActive: !reduced, animationDuration: 800, animationBegin: delayMs, animationEasing: 'ease-out' as const };
}

/** Counts up from 0 to `value` the first time it is shown. */
export const AnimatedNumber: React.FC<{
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}> = ({ value, decimals = 0, prefix = '', suffix = '', duration = 700, className }) => {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  const text = shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
};

/** Card that frames one chart: title, optional subtitle/action, and an empty state. */
export const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
  height?: number;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, action, empty, emptyText = 'No data yet.', height = 240, className = '', children }) => (
  <section className={`chart-card ${className}`.trim()}>
    <header className="chart-card-head">
      <div>
        <h3 className="chart-card-title">{title}</h3>
        {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
    <div className="chart-card-body" style={{ height }}>
      {empty ? (
        <div className="chart-card-empty">
          <i className="bi bi-bar-chart" aria-hidden="true" />
          <span>{emptyText}</span>
        </div>
      ) : (
        children
      )}
    </div>
  </section>
);

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: { fill?: string };
}

/** Clean tooltip for Recharts (`<Tooltip content={<ChartTooltip />} />`). */
export const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit?: string;
  labelPrefix?: string;
}> = ({ active, payload, label, unit = '', labelPrefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && label !== '' && (
        <div className="chart-tooltip-label">
          {labelPrefix}
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color || p.payload?.fill }} />
          <span className="chart-tooltip-name">{p.name}</span>
          <strong>
            {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
            {unit}
          </strong>
        </div>
      ))}
    </div>
  );
};

/** Horizontal bar that fills to `value / max` when it first appears. */
export const ProgressBar: React.FC<{
  value: number;
  max: number;
  label: string;
  detail?: string;
  color?: string;
}> = ({ value, max, label, detail, color = '#1B345F' }) => {
  const reduced = usePrefersReducedMotion();
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const [width, setWidth] = useState(reduced ? pct : 0);
  useEffect(() => {
    if (reduced) {
      setWidth(pct);
      return;
    }
    const t = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(t);
  }, [pct, reduced]);

  return (
    <div className="progress-row">
      <div className="progress-row-head">
        <span>{label}</span>
        <span className="progress-row-detail">{detail ?? `${value} / ${max}`}</span>
      </div>
      <div className="progress-row-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="progress-row-fill" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
};

/** Pretty label for enum-like keys: "CASUAL_LEAVE" → "Casual leave". */
export const humanize = (key: string) => {
  const s = key.replace(/_/g, ' ').toLowerCase();
  return ['fdp', 'sttp', 'hod'].includes(s) ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Sizes a Recharts chart to its container. Used instead of Recharts' ResponsiveContainer,
 * which measured 0 px wide inside our grid cards and drew nothing.
 */
export const FitChart: React.FC<{ children: React.ReactElement<{ width?: number; height?: number }> }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSize((prev) => (prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width: Math.floor(width), height: Math.floor(height) }));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: '100%', height: '100%', minWidth: 0 }}>
      {size && React.cloneElement(children, { width: size.width, height: size.height })}
    </div>
  );
};

/** Drop-in replacement for Recharts' ResponsiveContainer (same width/height props). */
export const ResponsiveChart: React.FC<{
  width?: number | string;
  height?: number | string;
  minHeight?: number | string;
  children: React.ReactElement<{ width?: number; height?: number }>;
}> = ({ width = '100%', height = '100%', minHeight, children }) => (
  <div style={{ width, height, minHeight, minWidth: 0 }}>
    <FitChart>{children}</FitChart>
  </div>
);
