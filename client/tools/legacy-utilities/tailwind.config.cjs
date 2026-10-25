/**
 * One-off generator for src/styles/legacy-utilities.css.
 *
 * A few older components were written with Tailwind class names, but this project does not
 * use Tailwind. Instead of adding it as a dependency, this config compiles ONLY the classes
 * those components use, scoped under `.tw-legacy` (the wrapper class on each component), with
 * colours mapped to the project's design tokens. Regenerate after editing those components:
 *
 *   npx tailwindcss@3.4.17 -c tools/legacy-utilities/tailwind.config.cjs \
 *     -i tools/legacy-utilities/input.css -o src/styles/legacy-utilities.css --minify
 *
 * New code should use the project's own CSS classes rather than Tailwind utilities.
 */
const files = [
  'src/pages/TimetablePage.tsx',
  'src/pages/WorkloadPage.tsx',
  'src/components/FacultySubstitutionModal.tsx',
  'src/components/ReviewStudentProjectModal.tsx',
  'src/components/StudentProjectDetailModal.tsx',
  'src/components/TimetableSlotModal.tsx',
  'src/components/WorkloadThresholdModal.tsx',
  'src/components/WorkloadTraceabilityModal.tsx',
];

module.exports = {
  content: files,
  important: '.tw-legacy',
  // The app has no dark theme toggle; keep `dark:` variants inert
  darkMode: ['class', '.tw-legacy-dark-never'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EDF4FA',
          100: '#D4E4F2',
          200: '#B9D5ED',
          300: '#8DB6DE',
          400: '#4F82BE',
          500: '#2B5592',
          600: '#1B345F',
          700: '#152A4D',
          800: '#112547',
          900: '#0C1A33',
          950: '#081224',
        },
        surface: { DEFAULT: '#FFFFFF', muted: '#F4F6F9' },
        border: '#E2E8F0',
        text: { primary: '#1E293B', secondary: '#64748B', muted: '#64748B' },
      },
    },
  },
};
