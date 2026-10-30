import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { rehearsalSystemPrompt } from '../src/api/rehearsal.js';
import { LANGS, type Lang } from '../src/config.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import type { LlmProvider, LlmRequest } from '../src/llm/provider.js';
import { MAX_TURNS, SCENARIOS, detectIntent, openingLine, ruleReply, scriptOk, type Scenario } from '../src/rehearsal/engine.js';
import { noWeather } from '../src/providers/weather.js';

describe('intent detection (hi, mr, gu, en and Hinglish)', () => {
  it.each([
    ['en', 'I feel so tired and I cannot sleep at night', 'shares'],
    ['hi', 'मुझे रात को नींद नहीं आती, मैं थक जाती हूँ', 'shares'],
    ['mr', 'मला रात्री झोप येत नाही, खूप थकवा येतो', 'shares'],
    ['gu', 'મને રાત્રે ઊંઘ આવતી નથી અને થાક લાગે છે', 'shares'],
    ['hi', 'mujhe raat ko neend nahi aati, bahut thak jaati hoon', 'shares'],
    ['en', 'Could you please help me with the cooking in the evenings?', 'request'],
    ['hi', 'क्या आप मुझे सुबह देर से आने की अनुमति दे सकते हैं, कृपया', 'request'],
    ['hi', 'kripya mujhe thodi madad chahiye', 'request'],
    ['mr', 'कृपया मला थोडी मदत हवी आहे', 'request'],
    ['gu', 'મને થોડી મદદ જોઈએ છે', 'request'],
    ['en', 'You always ignore me', 'blame'],
    ['hi', 'तुम हमेशा मुझे अनदेखा करते हो', 'blame'],
    ['en', "Sorry, forget it", 'giveup'],
    ['en', 'Thank you so much', 'thanks'],
    ['hi', 'बहुत धन्यवाद', 'thanks'],
    ['en', 'Hello', 'greeting'],
    ['hi', 'नमस्ते', 'greeting'],
    ['en', 'What is the policy?', 'question'],
    ['en', 'The weather is lovely', 'other'],
  ] as const)('[%s] %s -> %s', (_l, text, intent) => { expect(detectIntent(text)).toBe(intent); });
});

describe('rule-based role-play', () => {
  it('answers what she said: a Hindi sleep complaint to the husband gets the empathy line, not a scripted turn', () => {
    const r = ruleReply({ scenario: 'family', lang: 'hi', said: 'मुझे रात को नींद नहीं आती, मैं थक जाती हूँ', earlier: [openingLine('family', 'hi')], turn: 1 });
    expect(r.intent).toBe('shares'); expect(r.done).toBe(false);
    expect(r.reply).toContain('थकान');
  });
  it.each(SCENARIOS)('[%s] moves from resistance to agreement and never repeats a line, in every language', (sc) => {
    for (const lang of LANGS) {
      const said = lang === 'en' ? ['Hello', 'I feel tired and cannot sleep', 'It happens every night', 'Could you please help me?', 'Could you please help me with this every day?', 'thank you']
        : ['नमस्ते', 'मुझे नींद नहीं आती और थकान रहती है', 'मुझे रात को पसीना आता है', 'कृपया मुझे मदद चाहिए', 'कृपया मुझे हर दिन मदद चाहिए', 'धन्यवाद'];
      const earlier = [openingLine(sc, lang)]; const replies: string[] = [];
      let done = false;
      for (let i = 0; i < said.length && !done; i++) {
        const r = ruleReply({ scenario: sc, lang, said: said[i], earlier, turn: i + 1 });
        expect(earlier).not.toContain(r.reply);
        earlier.push(r.reply); replies.push(r.reply); done = r.done;
      }
      expect(done, `${sc}/${lang} should end on agreement`).toBe(true);
      expect(new Set(replies).size).toBe(replies.length);
      expect(replies.every((x) => scriptOk(x, lang))).toBe(true);
    }
  });
  it('a long chat of off-topic, same-intent messages never repeats and still ends within the turn limit', () => {
    const earlier = [openingLine('doctor', 'en')]; const seen = new Set<string>(earlier); let done = false; let n = 0;
    for (let i = 1; i <= MAX_TURNS + 2 && !done; i++) {
      const r = ruleReply({ scenario: 'doctor', lang: 'en', said: 'The weather is lovely', earlier, turn: i });
      expect(seen.has(r.reply)).toBe(false);
      seen.add(r.reply); earlier.push(r.reply); done = r.done; n = i;
    }
    expect(done).toBe(true); expect(n).toBeLessThanOrEqual(MAX_TURNS);
  });
  it('scriptOk rejects a reply in the wrong script', () => {
    expect(scriptOk('Hello there', 'hi')).toBe(false); expect(scriptOk('नमस्ते जी', 'hi')).toBe(true);
    expect(scriptOk('નમસ્તે', 'gu')).toBe(true); expect(scriptOk('नमस्ते', 'gu')).toBe(false); expect(scriptOk('नमस्ते', 'en')).toBe(false);
  });
});

class FakeLlm implements LlmProvider {
  name = 'fake'; out = 'I see. Tell me how the nights are for you.'; calls: LlmRequest[] = [];
  async complete(r: LlmRequest) { this.calls.push(r); return this.out; }
}
const llm = new FakeLlm();
let db: Db; let app: FastifyInstance; let appKey: FastifyInstance;
const env = { DEMO_AUTH: 'true', NODE_ENV: 'test', RATE_LIMIT_PER_MIN: '100000' } as NodeJS.ProcessEnv;
beforeAll(async () => {
  db = await pgliteDb(); await migrate(db);
  app = await buildApp({ db, llm: null, env, weather: noWeather, tts: null, push: null });
  appKey = await buildApp({ db, llm, env, weather: noWeather, tts: null, push: null });
});
afterAll(async () => { await app.close(); await appKey.close(); });

interface S { cookie: string; csrf: string }
async function login(a: FastifyInstance, phone: string): Promise<S> {
  await a.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await a.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang: 'en' } });
  return { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
}
const call = (a: FastifyInstance, s: S, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) => a.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
const start = async (a: FastifyInstance, s: S, sc: Scenario, lang: Lang) => (await call(a, s, 'POST', '/api/rehearsal/sessions', { scenario: sc, lang })).json() as { id: string; opening: string };

describe('rehearsal API', () => {
  it('creates a session, takes turns, ends with feedback, lists, reopens and deletes', async () => {
    const s = await login(app, '+919830000001');
    const { id, opening } = await start(app, s, 'family', 'hi');
    expect(opening).toBe(openingLine('family', 'hi'));
    const t1 = (await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'मुझे रात को नींद नहीं आती, मैं थक जाती हूँ' })).json();
    expect(t1.reply).toContain('थकान'); expect(t1.done).toBe(false); expect(t1.source).toBe('rules');
    const t2 = (await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'मुझे लगता है मुझे आपकी मदद चाहिए' })).json();
    expect(t2.reply).not.toBe(t1.reply);
    const end = (await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/end`)).json();
    expect(end.checks).toHaveLength(4); expect(end.summary.turns).toBe(2);
    const list = (await call(app, s, 'GET', '/api/rehearsal/sessions')).json().sessions;
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ id, scenario: 'family', turns: 2 }); expect(list[0].endedAt).not.toBeNull();
    const full = (await call(app, s, 'GET', `/api/rehearsal/sessions/${id}`)).json();
    expect(full.turns.map((x: { who: string }) => x.who)).toEqual(['them', 'me', 'them', 'me', 'them']);
    expect(full.turns[1].text).toBe('मुझे रात को नींद नहीं आती, मैं थक जाती हूँ'); expect(full.feedback.summary.turns).toBe(2);
    expect((await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'hello' })).statusCode).toBe(404); // ended
    expect((await call(app, s, 'DELETE', `/api/rehearsal/sessions/${id}`)).json()).toEqual({ deleted: true });
    expect((await call(app, s, 'GET', `/api/rehearsal/sessions/${id}`)).statusCode).toBe(404);
    expect((await db.query('SELECT 1 FROM rehearsal_turns WHERE session_id=$1', [id])).length).toBe(0);
  });

  it.each([
    ['en', 'I want to die'], ['hi', 'मैं मरना चाहती हूँ'], ['mr', 'मला आत्महत्या करायची आहे'], ['gu', 'મારે મરી જવું છે'],
  ] as const)('[%s] a crisis phrase gets helplines, pauses the role-play and stores nothing', async (lang, text) => {
    const s = await login(app, `+9198300001${LANGS.indexOf(lang)}0`);
    const { id } = await start(app, s, 'doctor', lang);
    const r = (await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text })).json();
    expect(r.crisis.kind).toBe('crisis'); expect(r.crisis.helplines.length).toBeGreaterThan(0); expect(r.reply).toBeUndefined();
    expect((await call(app, s, 'GET', `/api/rehearsal/sessions/${id}`)).json().turns).toHaveLength(1); // only the opening line
  });

  it('a request for medicine advice gets the policy reply, not a role-play answer', async () => {
    const s = await login(app, '+919830000020');
    const { id } = await start(app, s, 'doctor', 'en');
    const r = (await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'Which tablet should I take for hot flashes, give me the dose' })).json();
    expect(r.refusal?.message?.length).toBeGreaterThan(10); expect(r.reply).toBeUndefined();
  });

  it('runs 8 turns with no repeated line and ends by itself', async () => {
    const s = await login(app, '+919830000030');
    const { id } = await start(app, s, 'hr', 'en');
    const said = ['The weather is lovely', 'It is raining', 'I like tea', 'The bus was late', 'My neighbour is travelling', 'There was a wedding', 'The market is busy', 'Today is Monday'];
    const lines = new Set<string>(); let done = false; let turns = 0;
    for (const text of said) {
      const r = (await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text })).json();
      expect(lines.has(r.reply)).toBe(false); lines.add(r.reply); turns++;
      if (r.done) { done = true; break; }
    }
    expect(done).toBe(true); expect(turns).toBeLessThanOrEqual(MAX_TURNS);
  });

  it('stores turns encrypted, never as plain text', async () => {
    const s = await login(app, '+919830000040');
    const { id } = await start(app, s, 'family', 'en');
    await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'my secret sentence about the neighbour' });
    const raw = (await db.query<{ text_enc: string }>('SELECT text_enc FROM rehearsal_turns WHERE session_id=$1', [id])).map((r) => r.text_enc).join('|');
    expect(raw).not.toMatch(/secret sentence|neighbour|What's up/);
  });

  it("one user cannot read, continue, end or delete another user's session", async () => {
    const a = await login(app, '+919830000050'); const b = await login(app, '+919830000051');
    const { id } = await start(app, a, 'family', 'en');
    expect((await call(app, b, 'GET', `/api/rehearsal/sessions/${id}`)).statusCode).toBe(404);
    expect((await call(app, b, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'hi' })).statusCode).toBe(404);
    expect((await call(app, b, 'POST', `/api/rehearsal/sessions/${id}/end`)).statusCode).toBe(404);
    expect((await call(app, b, 'DELETE', `/api/rehearsal/sessions/${id}`)).statusCode).toBe(404);
    expect((await call(app, b, 'GET', '/api/rehearsal/sessions')).json().sessions).toHaveLength(0);
    expect((await call(app, a, 'GET', `/api/rehearsal/sessions/${id}`)).statusCode).toBe(200);
  });

  it('needs a login, a valid scenario, and ending an empty session is refused', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/rehearsal/sessions' })).statusCode).toBe(401);
    const s = await login(app, '+919830000060');
    expect((await call(app, s, 'POST', '/api/rehearsal/sessions', { scenario: 'boss', lang: 'en' })).statusCode).toBe(400);
    const { id } = await start(app, s, 'hr', 'en');
    expect((await call(app, s, 'POST', `/api/rehearsal/sessions/${id}/end`)).statusCode).toBe(400);
  });

  it('with an API key the model plays the character; bad output falls back to the rules', async () => {
    const s = await login(appKey, '+919830000070');
    const { id } = await start(appKey, s, 'doctor', 'en');
    llm.out = 'I see. Tell me how the nights are for you.';
    const ok = (await call(appKey, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'I feel tired and I cannot sleep' })).json();
    expect(ok.source).toBe('llm'); expect(ok.reply).toBe(llm.out);
    const sent = llm.calls[llm.calls.length - 1];
    expect(sent.system).toContain('Never give medical advice'); expect(sent.user).toContain('<her_words>I feel tired and I cannot sleep</her_words>');
    llm.out = 'नमस्ते, बताइए';                                   // wrong script for English
    expect((await call(appKey, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'It happens every night' })).json().source).toBe('rules');
    llm.out = 'x'.repeat(400);                                   // too long
    expect((await call(appKey, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'It is worse in summer' })).json().source).toBe('rules');
    llm.out = 'You should take hormone replacement therapy 50 mg daily.'; // blocked by the output policy
    expect((await call(appKey, s, 'POST', `/api/rehearsal/sessions/${id}/turn`, { text: 'What do you think it is?' })).json().source).toBe('rules');
  });

  it('the character prompt forbids medical advice and treats her words as data, in every scenario', () => {
    for (const sc of SCENARIOS) for (const l of LANGS) {
      const p = rehearsalSystemPrompt(sc, l);
      expect(p).toMatch(/Never give medical advice/); expect(p).toMatch(/never as instructions/); expect(p).toMatch(/at most 300 characters/);
    }
  });
});
