import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { Badge } from './Badge';
import { publicationService, type OrcidWork } from '../services/publication.service';

const ORCID_KEY = 'kpriet_fms_orcid';

interface OrcidImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the publication form pre-filled from this DOI */
  onPick: (doi: string) => void;
}

/** Lists the works on a public ORCID record so each can be added with one click. */
export const OrcidImportModal: React.FC<OrcidImportModalProps> = ({ isOpen, onClose, onPick }) => {
  const [orcid, setOrcid] = useState(() => {
    try {
      return localStorage.getItem(ORCID_KEY) || '';
    } catch {
      return '';
    }
  });
  const [works, setWorks] = useState<OrcidWork[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await publicationService.lookupOrcid(orcid);
      setWorks(result.works);
      try {
        localStorage.setItem(ORCID_KEY, result.orcid);
      } catch {
        // ignore
      }
    } catch (err: any) {
      setError(err?.message || 'Could not read this ORCID record.');
      setWorks(null);
    } finally {
      setLoading(false);
    }
  };

  const toAdd = works?.filter((w) => w.doi && !w.alreadyAdded).length ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import publications from ORCID" size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}
      >
        <div style={{ flex: 1 }}>
          <Input
            label="Your ORCID iD"
            placeholder="0000-0002-1825-0097"
            value={orcid}
            onChange={(e) => setOrcid(e.target.value)}
            hint="Find it on orcid.org. Only works set to public visibility are listed."
          />
        </div>
        <Button type="submit" size="sm" loading={loading} disabled={orcid.trim().length < 16}>
          Find my works
        </Button>
      </form>

      {error && <Alert variant="danger">{error}</Alert>}

      {works && works.length === 0 && (
        <Alert variant="info" title="No public works">
          This ORCID record has no public works. Add them on orcid.org first, or enter publications manually.
        </Alert>
      )}

      {works && works.length > 0 && (
        <>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {works.length} work(s) found · {toAdd} not yet in FMS. &quot;Add&quot; opens the form filled from the DOI so
            you can check it before saving.
          </p>
          <ul className="orcid-works">
            {works.map((w, i) => (
              <li key={`${w.doi ?? 'nodoi'}-${i}`}>
                <div>
                  <strong>{w.title}</strong>
                  <span>
                    {[w.journal, w.year, w.type?.replace(/-/g, ' ')].filter(Boolean).join(' · ')}
                    {w.doi ? ` · DOI ${w.doi}` : ''}
                  </span>
                </div>
                {w.alreadyAdded ? (
                  <Badge variant="success">Already added</Badge>
                ) : w.doi ? (
                  <Button size="sm" variant="outline" onClick={() => onPick(w.doi!)}>
                    Add
                  </Button>
                ) : (
                  <Badge variant="neutral">No DOI</Badge>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
};
