import React, { useState } from 'react';
import { Alert, Badge, Button, Modal } from '../../components';
import { adminService } from '../../services/admin.service';
import type { IImportRow } from '../../types/admin';

interface FacultyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (created: number) => void;
}

/**
 * Bulk-create faculty accounts from the Excel template: upload → preview with per-row
 * errors → import the valid rows. Each new account gets a "set your password" email.
 */
export const FacultyImportModal: React.FC<FacultyImportModalProps> = ({ isOpen, onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<IImportRow[] | null>(null);
  const [result, setResult] = useState<{ created: number; emailed: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState<'template' | 'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setRows(null);
    setResult(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      const blob = await adminService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'faculty-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Could not download the template.');
    } finally {
      setBusy(null);
    }
  };

  const preview = async (chosen: File) => {
    setFile(chosen);
    setRows(null);
    setResult(null);
    setError(null);
    setBusy('preview');
    try {
      setRows((await adminService.importUsers(chosen, true)).rows);
    } catch (err: any) {
      setError(err?.message || 'The file could not be read.');
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setBusy('import');
    setError(null);
    try {
      const res = await adminService.importUsers(file, false);
      setRows(res.rows);
      setResult({ created: res.created ?? 0, emailed: res.emailed ?? 0, skipped: res.skipped ?? 0 });
      onImported(res.created ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setBusy(null);
    }
  };

  const valid = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const invalid = (rows?.length ?? 0) - valid;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy === 'import' ? () => {} : close}
      title="Import faculty from Excel"
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" icon={<i className="bi bi-file-earmark-spreadsheet" />} loading={busy === 'template'} onClick={downloadTemplate}>
            Download template
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={close} disabled={busy === 'import'}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button size="sm" disabled={!rows || valid === 0} loading={busy === 'import'} onClick={runImport}>
                {rows ? `Import ${valid} account${valid === 1 ? '' : 's'}` : 'Import'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!rows && (
          <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.875rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Download the template and fill one faculty member per row (employee ID, name, college email, department code).</li>
            <li>Upload it here. Nothing is saved until you review the preview and press Import.</li>
            <li>Each new account gets an email with a link to set their own password (valid 7 days).</li>
          </ol>
        )}

        <label
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: 10,
            padding: '18px',
            textAlign: 'center',
            cursor: 'pointer',
            background: '#f8fafc',
            fontSize: '0.875rem',
            color: '#475569',
          }}
        >
          <input
            type="file"
            accept=".xlsx,.csv"
            hidden
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void preview(chosen);
              e.target.value = '';
            }}
          />
          <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.4rem', display: 'block', marginBottom: 4 }} />
          {busy === 'preview' ? 'Checking the file…' : file ? `${file.name} — choose another file` : 'Choose the filled .xlsx (or .csv) file'}
        </label>

        {error && <Alert variant="danger">{error}</Alert>}

        {result && (
          <Alert variant="success" title={`${result.created} account(s) created`}>
            {result.emailed} set-password email(s) sent.{result.skipped ? ` ${result.skipped} row(s) skipped — see the reasons below.` : ''}
          </Alert>
        )}

        {rows && !result && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem' }}>
            <Badge variant="success">{valid} ready</Badge>
            {invalid > 0 && <Badge variant="danger">{invalid} with problems</Badge>}
            <span style={{ color: '#64748b' }}>Rows with problems are skipped. Fix them in the file and upload again, or import the rest now.</span>
          </div>
        )}

        {rows && (
          <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  <th>Row</th>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Dept</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} style={{ background: r.errors.length ? '#fef2f2' : undefined }}>
                    <td>{r.row}</td>
                    <td>{r.employeeId}</td>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td title={r.departmentName}>{r.department}</td>
                    <td>{r.role}</td>
                    <td>
                      {r.created ? (
                        <Badge variant="success">Created</Badge>
                      ) : r.errors.length ? (
                        <span style={{ color: '#b91c1c' }}>{r.errors.join('; ')}</span>
                      ) : (
                        <Badge variant="neutral">Ready</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
