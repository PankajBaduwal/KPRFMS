/**
 * Some forms write the required marker into the label text ("Start Date *"). The form
 * components draw their own marker, so take it off the text and show one marker only.
 */
export function splitRequiredMark(label: string): { text: string; marked: boolean } {
  const m = /^(.*?)\s*\*\s*$/.exec(label);
  return m ? { text: m[1], marked: true } : { text: label, marked: false };
}
