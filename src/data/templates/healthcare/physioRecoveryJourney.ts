import type { TemplateDefinition } from '@/domain/schemas/catalog';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { dashboard, page, visual, type GridBox } from '../../builders';
import { fmt, kpi } from '../helpers';
// Stock photos from Pexels (free licence, commercial use, no attribution required) — credits in docs/IMAGE_CREDITS.md.
// `?inline` turns each file into a data URL at build time, the only image form the design schema accepts.
import balanceTraining from './images/balance-training.jpg?inline';
import exerciseSideStretch from './images/exercise-side-stretch.jpg?inline';
import hamstringStretch from './images/hamstring-stretch.jpg?inline';
import kneeJointModel from './images/knee-joint-model.jpg?inline';
import kneeMobilisation from './images/knee-mobilisation.jpg?inline';
import legStrengthening from './images/leg-strengthening.jpg?inline';
import legsInMotion from './images/legs-in-motion.jpg?inline';

/*
 * Physio Recovery Journey — an app-style clinician home screen for a fictional
 * physiotherapy practice (Kinetica Physio). Built only from standard visuals on
 * a 24-column grid: left column (today's plan, exercises), centre (recovery
 * journey, illustration, headline stats, exercise program), right column
 * (appointments, patients, messages). Photos are licensed stock images that
 * users can replace with their own. All names and figures are fictional.
 */

interface Photo {
  src: string;
  /** Describes the picture for screen readers. */
  alt: string;
}

/** A photo card; users can replace the picture in the editor (Image → Upload). */
function photo(id: string, box: GridBox, title: string, subtitle: string, image: Photo, style: DashboardComponent['style'] = {}): DashboardComponent {
  return visual('image', id, box, {
    title,
    ...(subtitle ? { subtitle } : {}),
    data: { src: image.src, alt: image.alt },
    config: { fit: 'cover', placeholderLabel: 'Add your own image' },
    style,
  });
}

const PHOTOS = {
  sideStretch: { src: exerciseSideStretch, alt: 'Woman doing a seated side stretch on a mat at home' },
  kneeModel: { src: kneeJointModel, alt: 'Anatomical model of the knee joint' },
  kneeMobilisation: { src: kneeMobilisation, alt: 'Physiotherapist stretching a patient’s leg on a mat' },
  legStrengthening: { src: legStrengthening, alt: 'Physiotherapist guiding an assisted leg raise' },
  hamstringStretch: { src: hamstringStretch, alt: 'Woman doing a seated forward-fold hamstring stretch' },
  balanceTraining: { src: balanceTraining, alt: 'Patient standing on a balance board with a therapist' },
  legsInMotion: { src: legsInMotion, alt: 'Legs walking on tiptoe against a soft grey background' },
} satisfies Record<string, Photo>;

/** Warm tint shared by the motivational card's text and photo. */
const PROMO_TINT = '#E6DED6';

const DONE = '✓ Done';
const ACTIVE = '◐ In progress';
const TODO = '○ To do';

export const physioRecoveryJourney: TemplateDefinition = {
  id: 'physio-recovery-journey',
  name: 'Physio Recovery Journey',
  categoryId: 'healthcare',
  description:
    'An app-style clinician home screen: today’s plan, a patient’s recovery journey with headline stats, the exercise program, upcoming appointments, recent patients and messages — in a warm, modern style.',
  audience: 'Physiotherapists and rehabilitation clinicians',
  purpose: 'Start the day with everything in one place: what is planned, how the current patient is progressing, and who needs attention next.',
  kpis: ['Pain level', 'Mobility score', 'Exercise completion', 'Appointments today', 'Patient progress'],
  tags: ['physiotherapy', 'rehabilitation', 'recovery journey', 'patient', 'exercise program', 'appointments', 'clinician', 'healthcare'],
  themeId: 'warm-coral',
  layoutPresetId: 'sidebar-navigation',
  featured: true,
  document: dashboard({
    id: 'tpl-physio-recovery-journey',
    name: 'Physio Recovery Journey',
    description: 'Clinician home screen: plan, recovery journey, exercises, appointments and patients.',
    categoryId: 'healthcare',
    themeId: 'warm-coral',
    pages: [
      page(
        'prj-p1',
        'Clinician Home',
        [
          /* ---------------- Left column ---------------- */
          visual('table', 'prj-plan', [0, 0, 6, 7], {
            title: 'Today’s Plan',
            subtitle: '2 of 4 complete',
            data: {
              columns: [
                { key: 'task', label: 'Task' },
                { key: 'count', label: 'Count', align: 'right' },
                { key: 'status', label: 'Status' },
              ],
              rows: [
                { task: 'Appointments', count: '5 of 5', status: DONE },
                { task: 'Patients reviewed', count: '12 of 12', status: DONE },
                { task: 'Treatment plans', count: '4 of 6', status: ACTIVE },
                { task: 'Exercise check-ins', count: '2 of 4', status: ACTIVE },
              ],
            },
            config: { showHeader: false, striped: false, density: 'comfortable' },
          }),
          photo('prj-exercise-photo', [0, 7, 6, 6], 'Exercises', 'Today’s session', PHOTOS.sideStretch),
          visual('table', 'prj-steps', [0, 13, 6, 5], {
            title: 'Session Exercises',
            data: {
              columns: [
                { key: 'n', label: '#' },
                { key: 'exercise', label: 'Exercise' },
                { key: 'status', label: 'Status' },
              ],
              rows: [
                { n: '01', exercise: 'Knee mobilisation', status: DONE },
                { n: '02', exercise: 'Strengthening', status: DONE },
                { n: '03', exercise: 'Flexibility & stretching', status: ACTIVE },
                { n: '04', exercise: 'Balance & stability', status: TODO },
              ],
            },
            config: { showHeader: false, striped: false, density: 'compact' },
          }),
          visual('text', 'prj-motto', [0, 18, 3, 6], {
            data: { text: 'Small steps every day add up to a full recovery.' },
            config: { variant: 'subheading', verticalAlign: 'top' },
            // Text cards default to transparent; this one is a tinted card.
            style: { transparent: false, background: PROMO_TINT, showBorder: false, padding: 18 },
          }),
          photo('prj-motto-photo', [3, 18, 3, 6], '', '', PHOTOS.legsInMotion, { background: PROMO_TINT, showBorder: false, padding: 0 }),

          /* ---------------- Centre ---------------- */
          visual('text', 'prj-title', [6, 0, 8, 2], {
            data: { text: 'Patient Recovery Journey' },
            config: { variant: 'heading', verticalAlign: 'bottom' },
            style: { transparent: true, padding: 4 },
          }),
          visual('text', 'prj-caption', [6, 2, 8, 1], {
            data: { text: 'Track progress and help patients reach their goals · illustrative figures' },
            config: { variant: 'caption', verticalAlign: 'top', emphasis: 'muted' },
            style: { transparent: true, padding: 4 },
          }),
          visual('slicer', 'prj-period', [14, 0, 4, 3], {
            title: 'Period',
            data: { field: 'Period', options: ['Last 8 weeks', 'Last 4 weeks', 'Last 12 weeks', 'Since referral'] },
            config: { variant: 'dropdown', defaultSelection: ['Last 8 weeks'] },
          }),
          visual('text', 'prj-journey', [6, 3, 4, 13], {
            title: 'Treatment Stages',
            subtitle: 'Knee rehabilitation · week 4 of 8',
            data: {
              text: [
                '✓  Initial assessment',
                '     Sep 2, 2026',
                '',
                '✓  Treatment plan',
                '     Sep 4, 2026',
                '',
                '●  Active rehabilitation',
                '     In progress · week 4 of 8',
                '',
                '○  Strength & mobility',
                '     Pending',
                '',
                '○  Full recovery',
                '     Expected Dec 10, 2026',
              ].join('\n'),
            },
            config: { variant: 'body', verticalAlign: 'top' },
            style: { transparent: true },
          }),
          photo('prj-illustration', [10, 3, 4, 13], '', '', PHOTOS.kneeModel, { padding: 0 }),
          kpi('prj-k-pain', [14, 3, 4, 4], {
            label: 'Pain level',
            value: 2.4,
            format: { kind: 'number', decimals: 1, suffix: '/ 10' },
            comparison: -38,
            comparisonLabel: 'since intake',
            lowerIsBetter: true,
          }),
          kpi('prj-k-mobility', [14, 7, 4, 4], { label: 'Mobility score', value: 76, format: fmt.pct0, comparison: 16, comparisonLabel: 'since intake' }),
          kpi('prj-k-exercise', [14, 11, 4, 5], {
            label: 'Exercise completion',
            value: 84,
            format: fmt.pct0,
            comparison: 11,
            comparisonLabel: 'vs last week',
            sparkline: [61, 66, 70, 72, 75, 79, 82, 84],
          }),
          visual('text', 'prj-program-title', [6, 16, 12, 1], {
            data: { text: 'Exercise Program' },
            config: { variant: 'subheading', verticalAlign: 'bottom' },
            style: { transparent: true, padding: 4 },
          }),
          photo('prj-ex-1', [6, 17, 3, 7], 'Knee Mobilisation', '3 sets · 12 reps', PHOTOS.kneeMobilisation),
          photo('prj-ex-2', [9, 17, 3, 7], 'Leg Strengthening', '3 sets · 15 reps', PHOTOS.legStrengthening),
          photo('prj-ex-3', [12, 17, 3, 7], 'Hamstring Stretch', '3 sets · 30 sec', PHOTOS.hamstringStretch),
          photo('prj-ex-4', [15, 17, 3, 7], 'Balance Training', '3 sets · 45 sec', PHOTOS.balanceTraining),

          /* ---------------- Right column ---------------- */
          visual('table', 'prj-appointments', [18, 0, 6, 8], {
            title: 'Upcoming Appointments',
            subtitle: 'Friday, Nov 6, 2026',
            data: {
              columns: [
                { key: 'time', label: 'Time' },
                { key: 'patient', label: 'Patient' },
                { key: 'therapy', label: 'Therapy' },
              ],
              rows: [
                { time: '09:00', patient: 'Daniel Reyes', therapy: 'Knee rehab' },
                { time: '10:30', patient: 'Priya Nair', therapy: 'Back pain' },
                { time: '12:00', patient: 'Tomás Weber', therapy: 'Shoulder' },
                { time: '14:00', patient: 'Hana Sato', therapy: 'Post-surgery' },
                { time: '15:30', patient: 'Omar Khalil', therapy: 'ACL repair' },
              ],
            },
            config: { showHeader: false, striped: false, density: 'compact' },
          }),
          visual('table', 'prj-patients', [18, 8, 6, 8], {
            title: 'Recent Patients',
            subtitle: 'Progress against plan',
            data: {
              columns: [
                { key: 'patient', label: 'Patient' },
                { key: 'condition', label: 'Condition' },
                { key: 'progress', label: 'Progress', format: fmt.pct0, align: 'right' },
              ],
              rows: [
                { patient: 'Omar Khalil', condition: 'ACL repair', progress: 74 },
                { patient: 'Elena Rossi', condition: 'Lower back', progress: 58 },
                { patient: 'James Okoro', condition: 'Shoulder', progress: 41 },
                { patient: 'Grace Lindqvist', condition: 'Hip replacement', progress: 83 },
              ],
            },
            config: { showHeader: true, striped: false, density: 'compact' },
          }),
          visual('table', 'prj-messages', [18, 16, 6, 8], {
            title: 'Messages',
            subtitle: '3 unread',
            data: {
              columns: [
                { key: 'from', label: 'From' },
                { key: 'message', label: 'Message' },
              ],
              rows: [
                { from: 'Daniel Reyes · 10:12', message: 'Finished today’s exercises!' },
                { from: 'Elena Rossi · 09:48', message: 'Move tomorrow to 4 pm?' },
                { from: 'James Okoro · 09:15', message: 'Shoulder feels much better' },
              ],
            },
            config: { showHeader: false, striped: false, density: 'comfortable' },
          }),
        ],
        { columns: 24 },
      ),
    ],
  }),
};
