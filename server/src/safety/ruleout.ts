import type { MrsResult } from './mrs.js';

export interface RuleOutQuestion { id: string; question: string; because: string; reviewed: false }

export interface RuleOutInput { mrs: MrsResult; weeksOfLogs: number; ageYears?: number; bleedingReported?: boolean }

/**
 * Rules, not an LLM. Each question is phrased "Should we check ...?" and only opens a conversation.
 * `reviewed: false` = pending clinician review (see SAFETY.md). Never claim review that has not happened.
 */
export function ruleOutQuestions(i: RuleOutInput): RuleOutQuestion[] {
  const q: RuleOutQuestion[] = [];
  const it = i.mrs.items;
  const add = (id: string, question: string, because: string) => q.push({ id, question, because, reviewed: false });

  if (it.exhaustion >= 2 || it.depressive_mood >= 2 || it.hot_flushes >= 2 || it.heart_discomfort >= 2)
    add('thyroid', 'Should we check thyroid function (TSH)?', 'Tiredness, mood change, heat and palpitations overlap with thyroid conditions.');
  if (it.exhaustion >= 2 || it.heart_discomfort >= 1 || it.sleep >= 3)
    add('anaemia', 'Should we check haemoglobin and iron levels for anaemia?', 'Tiredness and palpitations can have more than one cause.');
  if (it.joint_muscle >= 2 || it.exhaustion >= 2)
    add('vitamin_d', 'Should we check vitamin D?', 'Joint or muscle aches and tiredness can be linked to low vitamin D.');
  if (it.depressive_mood >= 2 || it.anxiety >= 3 || i.mrs.psychological >= 8)
    add('depression_screen', 'Should we do a depression and anxiety screen (for example PHQ-9 / GAD-7)?', 'Low mood and anxiety are common in this phase and are worth checking properly.');
  if (it.sleep >= 3)
    add('sleep_review', 'Should we review what is disturbing sleep (night sweats, mood, other causes)?', 'Poor sleep was reported at a high level.');
  if (it.bladder >= 2)
    add('urine_check', 'Should we check for a urinary infection or other bladder causes?', 'Bladder symptoms have several possible causes.');
  if (i.bleedingReported)
    add('bleeding_review', 'Should we look into the bleeding with an examination?', 'Bleeding after menopause or very heavy bleeding needs a doctor to look.');
  return q;
}

export interface PreventiveItem { id: string; title: string; action: string }
/** "Next 20 Years": preventive care prompts. Generic and reminder-style, not individual advice. */
export function next20Years(ageYears?: number): PreventiveItem[] {
  const items: PreventiveItem[] = [
    { id: 'bone', title: 'Bone health', action: 'Ask whether a bone density (DEXA) scan makes sense for you, and about calcium and vitamin D.' },
    { id: 'heart', title: 'Heart health', action: 'Ask about checking blood pressure, cholesterol and blood sugar every year.' },
    { id: 'strength', title: 'Strength exercise', action: 'Walking plus 2 days a week of simple strength exercise helps bones and mood. Check with your doctor first if unsure.' },
    { id: 'screening', title: 'Screening reminders', action: 'Ask when your next cervical, breast and bone screening is due.' },
  ];
  return ageYears !== undefined && ageYears < 40 ? items.slice(0, 2) : items;
}
