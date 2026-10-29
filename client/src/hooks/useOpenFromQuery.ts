import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Lets a link open a page's existing "add" form: `/portal/publications?new=publication`.
 * `openers` maps the `new` value to the page's own handler; the parameter is removed afterwards
 * so a reload or back navigation does not open the form again. Used by the dashboard's
 * Quick Actions, which never have their own forms.
 */
export function useOpenFromQuery(openers: Record<string, () => void>) {
  const [params, setParams] = useSearchParams();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const key = params.get('new');
    if (!key) return;
    done.current = true;
    const open = openers[key] ?? openers[key.toUpperCase()];
    if (open) open();
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    // Runs once per visit; openers are the page's stable state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
