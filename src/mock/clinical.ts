// Doctor-Ready Brief + employer aggregates. All values are fictional.

export const brief = {
  patient: 'Sunita K. · 48 · Pune',
  period: '1–30 Oct 2026 · 19 voice check-ins',
  stage: 'Perimenopause (self-reported) · irregular cycles since mid-2025 · last period ~7 weeks ago',
  mrsTotal: 14,
  mrsBand: 'Moderate',
  domains: [
    { name: 'Somatic', score: 7, max: 16, band: 'Moderate', items: 'Hot flushes, sleep, joint pain' },
    { name: 'Psychological', score: 6, max: 16, band: 'Moderate', items: 'Exhaustion, irritability, low mood' },
    { name: 'Urogenital', score: 1, max: 12, band: 'Mild', items: 'Occasional bladder urgency' },
  ],
  timeline: [
    { week: 'Wk 1', flashes: 3, poorSleep: 3 },
    { week: 'Wk 2', flashes: 7, poorSleep: 5 },
    { week: 'Wk 3', flashes: 5, poorSleep: 6 },
    { week: 'Wk 4', flashes: 4, poorSleep: 4 },
  ],
  highlights: [
    'Hot flushes ~4.8/week, clustered 2–5 pm and 2–4 am; worse on humid days',
    'Woke 2+ times on 18 of 30 nights',
    'Knee pain on stairs, mornings',
    'Irritability tied to poor-sleep days',
  ],
  ruleOut: [
    { test: 'Thyroid (TSH)', why: 'Fatigue, heat intolerance, palpitations overlap' },
    { test: 'Haemoglobin / CBC', why: 'Exhaustion; history of heavy cycles' },
    { test: 'Vitamin D & B12', why: 'Joint pain, low energy' },
    { test: 'Depression screen (PHQ-9)', why: 'Low mood reported on 6 days' },
  ],
  questions: [
    'Are these symptoms consistent with perimenopause?',
    'Is hormone therapy or a non-hormonal option right for me?',
    'Which screenings should I schedule this year?',
  ],
  next20: [
    { key: 'bone', title: 'Bone', text: 'Baseline DEXA scan; calcium + vitamin D; weight-bearing walks' },
    { key: 'heart', title: 'Heart', text: 'BP, lipids and HbA1c every year' },
    { key: 'strength', title: 'Strength', text: 'Resistance training 2× a week to protect muscle' },
    { key: 'screen', title: 'Screening', text: 'Mammogram every 1–2 yrs; Pap/HPV; eye check' },
  ],
}

export const hr = {
  org: 'Navrang Textiles (fictional)',
  eligible: 1140,
  participating: 312,
  checkinsPerWeek: 3.8,
  flexSupported: 41,
  monthly: [
    { m: 'Jun', people: 120, wellbeing: 58 },
    { m: 'Jul', people: 168, wellbeing: 60 },
    { m: 'Aug', people: 214, wellbeing: 62 },
    { m: 'Sep', people: 271, wellbeing: 66 },
    { m: 'Oct', people: 312, wellbeing: 69 },
  ],
  themes: [
    { theme: 'Sleep', pct: 64 },
    { theme: 'Fatigue', pct: 58 },
    { theme: 'Hot flashes', pct: 51 },
    { theme: 'Focus', pct: 37 },
    { theme: 'Joint pain', pct: 33 },
    { theme: 'Low mood', pct: 29 },
  ],
  sites: [
    { site: 'Pune HQ', n: 142, trend: '+12%' },
    { site: 'Mumbai office', n: 96, trend: '+9%' },
    { site: 'Nashik plant', n: 58, trend: '+21%' },
    { site: 'Ahmedabad branch', n: null, trend: null },
    { site: 'Surat warehouse', n: null, trend: null },
  ],
  resources: [
    { title: 'Menopause-aware leave & flexi policy', status: 'Live' },
    { title: 'Cooling stations on plant floors', status: 'Rolling out' },
    { title: 'Manager training · 30-min module', status: '68% done' },
    { title: 'Confidential tele-consults (2 / year)', status: 'Live' },
  ],
}
