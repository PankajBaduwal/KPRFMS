import React, { useEffect, useState } from 'react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { adminService } from '../../services/admin.service';

type Person = { id: string; name: string; email: string; role: string; invitedAt: string | null };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'never');

/** People who were given an account but have not signed in yet, with invitation reminders. */
export const NotSignedInPanel: React.FC<{ showToast: (message: string) => void; refreshKey?: unknown }> = ({ showToast, refreshKey }) => {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Person | 'all' | null>(null);
  const [sending, setSending] = useState(false);

  const load = () =>
    adminService
      .notSignedIn()
      .then(setPeople)
      .catch(() => setPeople([]));

  useEffect(() => {
    void load();
  }, [refreshKey]);

  if (!people || people.length === 0) return null;

  const send = async () => {
    if (!target) return;
    setSending(true);
    try {
      const r = await adminService.sendInvitationReminders(target === 'all' ? undefined : [target.id]);
      const parts = [`${r.sent} reminder${r.sent === 1 ? '' : 's'} sent`];
      if (r.skippedRecentlyInvited) parts.push(`${r.skippedRecentlyInvited} skipped (invited in the last day)`);
      if (r.failed) parts.push(`${r.failed} could not be sent`);
      showToast(parts.join(', ') + '.');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Could not send reminders.');
    } finally {
      setSending(false);
      setTarget(null);
    }
  };

  return (
    <div role="status" style={{ padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1e3a8a', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <span>
          <i className="bi bi-envelope-exclamation" style={{ marginRight: 8 }} />
          <strong>{people.length}</strong> {people.length === 1 ? 'person has' : 'people have'} not signed in yet
        </span>
        <span style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-sm btn-outline-primary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide list' : 'Show list'}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setTarget('all')}>
            <i className="bi bi-send" /> Remind everyone
          </button>
        </span>
      </div>
      {open && (
        <div className="table-responsive" style={{ marginTop: '0.75rem', maxHeight: 320, overflowY: 'auto', background: '#fff', borderRadius: 8 }}>
          <table className="table table-sm mb-0" style={{ fontSize: '0.825rem' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Last invited</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <div className="text-muted small">{p.email}</div>
                  </td>
                  <td>{p.role.toLowerCase()}</td>
                  <td>{when(p.invitedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-sm btn-link" onClick={() => setTarget(p)}>
                      Remind
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmationDialog
        isOpen={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={send}
        loading={sending}
        variant="primary"
        confirmLabel="Send reminder"
        title={target === 'all' ? `Remind ${people.length} people?` : 'Send a reminder?'}
        message={
          <>
            {target === 'all' ? 'Everyone who has not signed in yet' : <strong>{target?.name ?? ''}</strong>} will get an email with a new
            one-time password and the sign-in link; any earlier one-time password stops working. People invited in the last day are skipped. You are never included.
          </>
        }
      />
    </div>
  );
};
