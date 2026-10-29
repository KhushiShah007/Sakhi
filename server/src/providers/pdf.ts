import PDFDocument from 'pdfkit';
import type { BriefData } from '../api/brief.js';

const ROSE = '#D6336C', INK = '#3B1F2B', SOFT = '#6B4A57', PERI = '#6C7BD9', TINT = '#FBEBDD', TRACK = '#F6E6EA';
const M = 36, W = 595.28 - 2 * M;

/** Doctor copy: always English, always one page. Helvetica only (no script fonts), so the doctor's PDF is the English brief by design. */
export function renderBriefPdf(b: BriefData, opts: { compress?: boolean } = {}): Promise<Buffer> {
  const run = (s: number) => new Promise<{ buf: Buffer; pages: number }>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, compress: opts.compress ?? true, info: { Title: 'Sakhi Doctor-Ready Brief', Author: 'Sakhi', Subject: 'Supportive, not diagnostic' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve({ buf: Buffer.concat(chunks), pages: doc.bufferedPageRange().count }));

    let y = M;
    const f = (n: number) => n * s;
    const txt = (t: string, o: { size: number; bold?: boolean; color?: string; x?: number; width?: number; gap?: number; align?: 'left' | 'right' | 'center' }) => {
      doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(f(o.size)).fillColor(o.color ?? INK);
      const width = o.width ?? W, x = o.x ?? M;
      doc.text(t, x, y, { width, align: o.align ?? 'left', lineGap: f(1.2) });
      y += doc.heightOfString(t, { width, lineGap: f(1.2) }) + f(o.gap ?? 2);
    };
    const h = (t: string) => { y += f(5); doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.6).strokeColor('#F1E4E8').stroke(); y += f(5); txt(t.toUpperCase(), { size: 7.5, bold: true, color: ROSE, gap: 3 }); };

    // header
    txt('SAKHI  ·  ' + b.headings.title.toUpperCase(), { size: 8, bold: true, color: ROSE, gap: 2 });
    txt([b.patient.name, b.patient.age ? String(b.patient.age) : '', b.patient.city ?? ''].filter(Boolean).join('  ·  '), { size: 17, bold: true, gap: 1 });
    txt(`${b.patient.stageLabel}`, { size: 9.5, color: SOFT, gap: 0 });
    txt(`${b.headings.period}: ${b.periodFrom} to ${b.periodTo}  ·  ${b.checkInDays} days of check-ins`, { size: 9.5, color: SOFT, gap: 2 });

    // MRS
    h(b.headings.mrs);
    const top = y;
    doc.font('Helvetica-Bold').fontSize(f(30)).fillColor(INK).text(String(b.total.score), M, top, { continued: true });
    doc.font('Helvetica').fontSize(f(12)).fillColor(SOFT).text(' / 44', { continued: false });
    doc.roundedRect(M + 110, top + f(8), f(120), f(18), f(9)).fill('#FFDFC3');
    doc.font('Helvetica-Bold').fontSize(f(9)).fillColor('#B02458').text(b.total.bandLabel, M + 110, top + f(12), { width: f(120), align: 'center' });
    // subscale bars to the right
    let by = top;
    for (const sub of b.subscales) {
      doc.font('Helvetica-Bold').fontSize(f(8.5)).fillColor(INK).text(`${sub.name}  ${sub.score}/${sub.max}  ·  ${sub.bandLabel}`, M + 255, by, { width: W - 255 });
      doc.roundedRect(M + 255, by + f(11), W - 255, f(5), f(2.5)).fill(TRACK);
      if (sub.score > 0) doc.roundedRect(M + 255, by + f(11), Math.max(f(5), (W - 255) * (sub.score / sub.max)), f(5), f(2.5)).fill(ROSE);
      by += f(21);
    }
    y = Math.max(top + f(40), by) + f(2);

    // items, two columns, dots show 0-4
    const colW = W / 2 - 8, rowH = f(13);
    b.items.forEach((it, i) => {
      const col = i < 6 ? 0 : 1, row = i < 6 ? i : i - 6, x = M + col * (colW + 16), yy = y + row * rowH;
      doc.font('Helvetica').fontSize(f(8.5)).fillColor(INK).text(it.name, x, yy, { width: colW - 62, lineBreak: false, ellipsis: true });
      for (let d = 0; d < 4; d++) doc.circle(x + colW - 54 + d * f(12), yy + f(4.5), f(3.6)).fill(d < it.score ? ROSE : TRACK);
    });
    y += rowH * 6 + f(2);

    // timeline
    h(b.headings.timeline);
    const chartH = f(54), base = y + chartH, maxV = Math.max(1, ...b.timeline.flatMap((t) => [t.hotFlashDays, t.poorSleepDays]));
    b.timeline.forEach((t, i) => {
      const gx = M + 14 + i * (W / 4), bw = f(26);
      const hh = (v: number) => (v / maxV) * (chartH - f(12));
      doc.rect(gx, base - hh(t.hotFlashDays), bw, hh(t.hotFlashDays)).fill(ROSE);
      doc.rect(gx + bw + f(4), base - hh(t.poorSleepDays), bw, hh(t.poorSleepDays)).fill(PERI);
      doc.font('Helvetica').fontSize(f(7.5)).fillColor(SOFT).text(`${t.hotFlashDays}`, gx, base - hh(t.hotFlashDays) - f(9), { width: bw, align: 'center', lineBreak: false });
      doc.text(`${t.poorSleepDays}`, gx + bw + f(4), base - hh(t.poorSleepDays) - f(9), { width: bw, align: 'center', lineBreak: false });
      doc.text(`Wk ${t.week}`, gx, base + f(2), { width: bw * 2 + f(4), align: 'center', lineBreak: false });
    });
    doc.rect(M + W - 150, y, f(7), f(7)).fill(ROSE); doc.font('Helvetica').fontSize(f(7.5)).fillColor(SOFT).text('Hot-flush days', M + W - 140, y - f(0.5), { lineBreak: false });
    doc.rect(M + W - 150, y + f(11), f(7), f(7)).fill(PERI); doc.text('Poor-sleep days', M + W - 140, y + f(10.5), { lineBreak: false });
    y = base + f(14);
    for (const t of b.highlights) txt('•  ' + t, { size: 8.8, gap: 1 });

    // rule-out + questions
    h(b.headings.ruleOut);
    if (!b.ruleOut.length) txt('-', { size: 9, color: SOFT });
    for (const r of b.ruleOut) { txt('[ ]  ' + r.question, { size: 9, bold: true, gap: 0 }); txt(r.because, { size: 8, color: SOFT, x: M + 16, width: W - 16, gap: 2 }); }
    h(b.headings.questions);
    for (const q of b.questions) txt('?  ' + q, { size: 8.8, gap: 1 });

    // next 20 years
    h(b.headings.next20 + '  ·  ' + b.headings.next20Sub);
    const bw2 = W / 2 - 4; let cy = y; let rowMax = 0;
    b.next20.forEach((n, i) => {
      const x = M + (i % 2) * (bw2 + 8);
      if (i % 2 === 0 && i > 0) { cy += rowMax + f(5); rowMax = 0; }
      const hgt = doc.font('Helvetica').fontSize(f(8)).heightOfString(n.action, { width: bw2 - 12 }) + f(22);
      doc.roundedRect(x, cy, bw2, hgt, f(5)).fill(TINT);
      doc.font('Helvetica-Bold').fontSize(f(9)).fillColor(INK).text(n.title, x + 6, cy + f(4), { width: bw2 - 12, lineBreak: false });
      doc.font('Helvetica').fontSize(f(8)).fillColor(SOFT).text(n.action, x + 6, cy + f(16), { width: bw2 - 12 });
      rowMax = Math.max(rowMax, hgt);
    });
    y = cy + rowMax + f(8);

    // footer
    txt(b.headings.footer, { size: 8, bold: true, color: INK, gap: 0 });
    txt(`${b.headings.source}  Generated ${b.generatedAt.slice(0, 10)}. Wellness companion, not a medical device.`, { size: 7.2, color: SOFT, gap: 0 });
    doc.end();
  });

  return (async () => {
    for (const s of [1, 0.93, 0.86, 0.8, 0.74, 0.68]) { const r = await run(s); if (r.pages === 1) return r.buf; }
    return (await run(0.62)).buf;
  })();
}
