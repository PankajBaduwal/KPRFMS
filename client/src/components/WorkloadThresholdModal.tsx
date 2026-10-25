import '../styles/legacy-utilities.css';
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { workloadService } from '../services/workload.service';
import type { WorkloadConfig, CadreThreshold } from '../types/workload';

interface WorkloadThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WorkloadConfig | null;
  onSuccess: () => void;
}

export const WorkloadThresholdModal: React.FC<WorkloadThresholdModalProps> = ({
  isOpen,
  onClose,
  config,
  onSuccess,
}) => {
  const [name, setName] = useState('Institutional Workload Policy');
  const [underloadMax, setUnderloadMax] = useState<number>(12);
  const [normalMin, setNormalMin] = useState<number>(12);
  const [normalMax, setNormalMax] = useState<number>(16);
  const [highMin, setHighMin] = useState<number>(17);
  const [highMax, setHighMax] = useState<number>(20);
  const [overloadMin, setOverloadMin] = useState<number>(21);
  const [cadreOverrides, setCadreOverrides] = useState<CadreThreshold[]>([]);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setName(config.name || 'Institutional Workload Policy');
      setUnderloadMax(config.underloadMax ?? 12);
      setNormalMin(config.normalMin ?? 12);
      setNormalMax(config.normalMax ?? 16);
      setHighMin(config.highMin ?? 17);
      setHighMax(config.highMax ?? 20);
      setOverloadMin(config.overloadMin ?? 21);
      setCadreOverrides(config.cadreOverrides ? JSON.parse(JSON.stringify(config.cadreOverrides)) : []);
    }
  }, [config, isOpen]);

  const handleCadreChange = (
    index: number,
    field: keyof Omit<CadreThreshold, 'cadre'>,
    value: number
  ) => {
    const updated = [...cadreOverrides];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setCadreOverrides(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || resetting) return;
    setError(null);

    // Validation
    if (normalMin > normalMax) {
      setError('Normal minimum cannot exceed Normal maximum.');
      return;
    }
    if (normalMax > highMin) {
      setError('Normal maximum cannot exceed High minimum.');
      return;
    }
    if (highMin > highMax) {
      setError('High minimum cannot exceed High maximum.');
      return;
    }
    if (highMax > overloadMin) {
      setError('High maximum cannot exceed Overload minimum.');
      return;
    }

    try {
      setSaving(true);
      await workloadService.updateConfig({
        name,
        underloadMax: Number(underloadMax),
        normalMin: Number(normalMin),
        normalMax: Number(normalMax),
        highMin: Number(highMin),
        highMax: Number(highMax),
        overloadMin: Number(overloadMin),
        cadreOverrides,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to update workload policy');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (saving || resetting) return;
    if (!window.confirm('Reset all workload thresholds back to institutional AICTE defaults?')) {
      return;
    }
    try {
      setResetting(true);
      await workloadService.resetConfig();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to reset workload policy');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal
      className="tw-legacy"
      isOpen={isOpen}
      onClose={saving || resetting ? () => {} : onClose}
      title="Configurable Workload Policy & Thresholds"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        <div>
          <Input
            label="Policy Title *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* General Baseline Thresholds */}
        <div className="card p-4 bg-surface-muted/30 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Baseline Institutional Hours / Week Limits
            </h4>
            <span className="text-[11px] text-text-muted">Weekly Teaching Hours</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Underload (&lt;)
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={underloadMax}
                onChange={(e) => setUnderloadMax(Number(e.target.value))}
                className="w-full text-xs rounded border border-border bg-surface px-2 py-1 font-mono text-center"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Normal Min
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={normalMin}
                onChange={(e) => setNormalMin(Number(e.target.value))}
                className="w-full text-xs rounded border border-border bg-surface px-2 py-1 font-mono text-center"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Normal Max
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={normalMax}
                onChange={(e) => setNormalMax(Number(e.target.value))}
                className="w-full text-xs rounded border border-border bg-surface px-2 py-1 font-mono text-center"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                High Min
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={highMin}
                onChange={(e) => setHighMin(Number(e.target.value))}
                className="w-full text-xs rounded border border-border bg-surface px-2 py-1 font-mono text-center"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                High Max
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={highMax}
                onChange={(e) => setHighMax(Number(e.target.value))}
                className="w-full text-xs rounded border border-border bg-surface px-2 py-1 font-mono text-center"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block mb-1">
                Overload (&ge;)
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={overloadMin}
                onChange={(e) => setOverloadMin(Number(e.target.value))}
                className="w-full text-xs rounded border border-border bg-surface px-2 py-1 font-mono text-center"
                required
              />
            </div>
          </div>
        </div>

        {/* Cadre-Specific Threshold Overrides */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Cadre-Specific Threshold Policies
            </h4>
            <span className="text-[11px] text-text-muted">AICTE Academic Cadre Guidelines</span>
          </div>

          <div className="card overflow-hidden border border-border">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 font-semibold text-text-secondary">
                  <th className="py-2 px-3">Faculty Cadre</th>
                  <th className="py-2 px-2 text-center text-slate-600">Underload (&lt;)</th>
                  <th className="py-2 px-2 text-center text-emerald-600">Normal Range</th>
                  <th className="py-2 px-2 text-center text-amber-600">High Range</th>
                  <th className="py-2 px-2 text-center text-rose-600">Overload (&ge;)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cadreOverrides.map((co, idx) => (
                  <tr key={co.cadre} className="hover:bg-surface-muted/20">
                    <td className="py-2.5 px-3 font-semibold text-text-primary">
                      {co.cadre}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={co.underloadMax}
                        onChange={(e) => handleCadreChange(idx, 'underloadMax', Number(e.target.value))}
                        className="w-14 text-xs rounded border border-border bg-surface px-1 py-0.5 font-mono text-center"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="inline-flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={co.normalMin}
                          onChange={(e) => handleCadreChange(idx, 'normalMin', Number(e.target.value))}
                          className="w-12 text-xs rounded border border-border bg-surface px-1 py-0.5 text-center"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={co.normalMax}
                          onChange={(e) => handleCadreChange(idx, 'normalMax', Number(e.target.value))}
                          className="w-12 text-xs rounded border border-border bg-surface px-1 py-0.5 text-center"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="inline-flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={co.highMin}
                          onChange={(e) => handleCadreChange(idx, 'highMin', Number(e.target.value))}
                          className="w-12 text-xs rounded border border-border bg-surface px-1 py-0.5 text-center"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={co.highMax}
                          onChange={(e) => handleCadreChange(idx, 'highMax', Number(e.target.value))}
                          className="w-12 text-xs rounded border border-border bg-surface px-1 py-0.5 text-center"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={co.overloadMin}
                        onChange={(e) => handleCadreChange(idx, 'overloadMin', Number(e.target.value))}
                        className="w-14 text-xs rounded border border-border bg-surface px-1 py-0.5 font-mono text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            loading={resetting}
            disabled={saving}
            icon={<i className="bi bi-arrow-counterclockwise" />}
          >
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving || resetting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={resetting}
              icon={<i className="bi bi-check2" />}
            >
              {saving ? 'Saving...' : 'Apply Thresholds'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
