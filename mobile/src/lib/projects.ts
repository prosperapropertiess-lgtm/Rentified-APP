// Big maintenance projects. Every project runs through the same SOP; the
// "work" phase is broken into custom steps the manager writes per job
// (e.g. a deck: posts out → footings → inspection → framing → …).

export type Phase = 'request' | 'assessment' | 'quotes' | 'approval' | 'scheduled' | 'work' | 'final_inspection' | 'completed';
export type StageStatus = 'pending' | 'current' | 'done' | 'skipped';

export interface Stage {
  id: string;
  project_id: string;
  position: number;
  phase: Phase;
  title: string;
  description: string | null;
  status: StageStatus;
  is_inspection: boolean;
  next_step: string | null;
  due_date: string | null;
  completed_at: string | null;
}

export interface Project {
  id: string;
  landlord_id: string;
  property_id: string | null;
  unit_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  budget: number | null;
  contractor: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  cover_photo: string | null;
  created_at: string;
  updated_at: string;
  properties?: { name: string | null; address: string | null } | null;
  landlords?: { first_name: string | null; last_name: string | null } | null;
}

export interface ProjectUpdate {
  id: string;
  stage_id: string | null;
  body: string | null;
  photos: string[];
  author_name: string | null;
  created_at: string;
}

export interface ProjectCost {
  id: string;
  stage_id: string | null;
  label: string;
  vendor: string | null;
  amount: number;
  kind: 'quote' | 'actual';
  incurred_on: string;
}

export interface ActionItem {
  id: string;
  stage_id: string | null;
  title: string;
  detail: string | null;
  kind: 'approval' | 'decision' | 'task' | 'payment';
  amount: number | null;
  status: 'open' | 'done' | 'declined';
  due_date: string | null;
  response: string | null;
  responded_at: string | null;
}

export const PHASES: { key: Phase; label: string; icon: string; blurb: string }[] = [
  { key: 'request', label: 'Request', icon: 'inbox', blurb: 'The issue is logged.' },
  { key: 'assessment', label: 'Assessment', icon: 'search', blurb: 'Someone looks at it on site.' },
  { key: 'quotes', label: 'Quotes', icon: 'file-text', blurb: 'Prices from contractors.' },
  { key: 'approval', label: 'Owner approval', icon: 'check-square', blurb: 'You approve the plan and price.' },
  { key: 'scheduled', label: 'Scheduled', icon: 'calendar', blurb: 'Dates are booked.' },
  { key: 'work', label: 'In progress', icon: 'tool', blurb: 'The work, step by step.' },
  { key: 'final_inspection', label: 'Final inspection', icon: 'shield', blurb: 'Checked before sign-off.' },
  { key: 'completed', label: 'Completed', icon: 'award', blurb: 'Done and closed out.' },
];

export const phaseLabel = (p: Phase) => PHASES.find((x) => x.key === p)?.label ?? p;

export interface TemplateStep { title: string; inspection?: boolean }
export const TEMPLATES: { key: string; label: string; category: string; steps: TemplateStep[] }[] = [
  {
    key: 'deck', label: 'Deck rebuild', category: 'Exterior',
    steps: [
      { title: 'Remove old deck and posts' },
      { title: 'Dig and pour concrete footings' },
      { title: 'Footing inspection', inspection: true },
      { title: 'Set posts and framing' },
      { title: 'Framing inspection', inspection: true },
      { title: 'Decking, stairs and railings' },
      { title: 'Finish and stain' },
    ],
  },
  {
    key: 'roof', label: 'Roof replacement', category: 'Exterior',
    steps: [
      { title: 'Order materials and bin' },
      { title: 'Tear off old shingles' },
      { title: 'Repair decking and install underlayment' },
      { title: 'Install shingles, flashing and vents' },
      { title: 'Clean up and magnet sweep' },
    ],
  },
  {
    key: 'basement', label: 'Basement renovation', category: 'Interior',
    steps: [
      { title: 'Demolition' },
      { title: 'Framing' },
      { title: 'Rough-in plumbing and electrical' },
      { title: 'Rough-in inspection', inspection: true },
      { title: 'Insulation and vapour barrier' },
      { title: 'Insulation inspection', inspection: true },
      { title: 'Drywall, tape and mud' },
      { title: 'Flooring, trim and paint' },
      { title: 'Fixtures and finishing' },
    ],
  },
  {
    key: 'bathroom', label: 'Bathroom renovation', category: 'Interior',
    steps: [
      { title: 'Demolition' },
      { title: 'Plumbing and electrical rough-in' },
      { title: 'Waterproofing' },
      { title: 'Tile' },
      { title: 'Vanity, toilet and fixtures' },
      { title: 'Paint and caulk' },
    ],
  },
  {
    key: 'turnover', label: 'Unit turnover', category: 'Interior',
    steps: [
      { title: 'Move-out inspection', inspection: true },
      { title: 'Repairs and patching' },
      { title: 'Paint' },
      { title: 'Deep clean' },
      { title: 'Move-in ready check', inspection: true },
    ],
  },
  {
    key: 'hvac', label: 'Furnace / AC replacement', category: 'Mechanical',
    steps: [
      { title: 'Remove old unit' },
      { title: 'Install new unit and venting' },
      { title: 'Gas and electrical hookup' },
      { title: 'Start-up and safety test', inspection: true },
    ],
  },
  { key: 'blank', label: 'Start from scratch', category: 'Other', steps: [{ title: 'Work' }] },
];

/** The full stage list for a new project: fixed SOP phases with the custom work steps in the middle. */
export function buildStages(workSteps: TemplateStep[]): Omit<Stage, 'id' | 'project_id'>[] {
  const out: Omit<Stage, 'id' | 'project_id'>[] = [];
  const push = (phase: Phase, title: string, inspection = false) =>
    out.push({ position: out.length, phase, title, description: null, status: 'pending', is_inspection: inspection, next_step: null, due_date: null, completed_at: null });
  for (const p of PHASES) {
    if (p.key === 'work') {
      for (const s of workSteps.filter((s) => s.title.trim())) push('work', s.title.trim(), !!s.inspection);
    } else {
      push(p.key, p.label, p.key === 'final_inspection');
    }
  }
  if (out[0]) out[0].status = 'current';
  return out;
}

/** Percent complete = finished (or skipped) stages over all stages. */
export function progress(stages: Stage[]) {
  const counted = stages.filter((s) => s.status !== 'skipped');
  if (!counted.length) return 0;
  return Math.round((counted.filter((s) => s.status === 'done').length / counted.length) * 100);
}

export function currentStage(stages: Stage[]): Stage | null {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  return sorted.find((s) => s.status === 'current') ?? sorted.find((s) => s.status === 'pending') ?? null;
}

export function currentPhase(stages: Stage[]): Phase {
  return currentStage(stages)?.phase ?? 'completed';
}

export function costTotals(costs: ProjectCost[], budget: number | null) {
  const spent = costs.filter((c) => c.kind === 'actual').reduce((s, c) => s + Number(c.amount), 0);
  const quoted = costs.filter((c) => c.kind === 'quote').reduce((s, c) => s + Number(c.amount), 0);
  const cap = budget ?? quoted ?? 0;
  return { spent, quoted, budget: cap, remaining: cap ? cap - spent : null, over: cap > 0 && spent > cap };
}

export const PRIORITY_COLOR: Record<Project['priority'], string> = {
  low: '#64748B', normal: '#1F2F3A', high: '#B45309', urgent: '#8B2030',
};

export const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Active', on_hold: 'On hold', completed: 'Completed', cancelled: 'Cancelled',
};
