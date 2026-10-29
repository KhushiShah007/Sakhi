import type { Lang } from '../config.js';
import { normalise } from './redflags.js';

/** Requests the product must never fulfil. Deterministic, runs AFTER red flags and BEFORE any LLM. */
export type PolicyViolation = 'diagnosis' | 'dosage' | 'hrt_advice' | 'jailbreak' | 'other_user_data' | 'family_sees_words';

const RULES: Record<PolicyViolation, RegExp[]> = {
  diagnosis: [
    /do i have (menopause|cancer|thyroid|diabetes|depression|a tumou?r|pcos)/, /diagnos/, /is (it|this) (cancer|thyroid|serious)/, /what (disease|illness) do i have/, /tell me what.*wrong with me/, /confirm (that )?i (am|m|have)/,
    /क्या मुझे (थायरॉइड|कैंसर|डायबिटीज|डिप्रेशन|मेनोपॉज़|मेनोपॉज)/, /मुझे कौन सी बीमारी/, /बीमारी (बताओ|बताइए|बताएं)/, /निदान (करो|करा)/, /मुझे क्या हुआ है.*बताओ/,
    /मला (थायरॉईड|कर्करोग|कॅन्सर|डिप्रेशन) आहे का/, /मला कोणता आजार/, /आजार सांगा/, /निदान करा/,
    /મને (થાઇરોઇડ|કેન્સર|ડિપ્રેશન) છે\??/, /મને કયો રોગ/, /રોગ (કહો|જણાવો)/, /નિદાન કરો/,
    /\bdiagnose\b/, /kya mujhe (thyroid|cancer|diabetes|depression)/,
  ],
  dosage: [
    /how (many|much) (mg|milligram|tablet|pill|dose)/, /\bdose\b/, /dosage/, /\bmg\b/, /how many (tablets|pills) (should|can) i/, /should i take .* (tablet|pill|medicine)/, /which (tablet|medicine|medication|pill) should i (take|use)/, /prescribe/, /prescription/, /increase my (dose|medication)/, /stop (taking )?my (medicine|medication|tablets)/,
    /कितनी (गोली|खुराक|दवा|एमजी)/, /खुराक/, /कौन सी (गोली|दवा) (लूँ|लूं|लेनी|खाऊँ|खाऊं)/, /दवा (लिख|बता)/, /दवाई (बंद|बढ़ा)/,
    /किती (गोळ्या|मात्रा|मिलिग्रॅम)/, /मात्रा सांगा/, /कोणती (गोळी|औषध)/, /औषध (सांगा|लिहून)/,
    /કેટલી (ગોળી|માત્રા|દવા)/, /માત્રા/, /કઈ (ગોળી|દવા) લ/, /દવા (લખી|જણાવો)/,
    /kitni (goli|dawa|dose)/, /konsi (goli|dawa)/,
  ],
  hrt_advice: [
    /\bhrt\b/, /hormone (replacement|therapy|tablet|patch|pill)/, /estrogen|oestrogen|progesterone/, /should i (start|take|use) (hrt|hormone)/, /tibolone/, /black cohosh|soy isoflavone/,
    /हार्मोन (थेरेपी|रिप्लेसमेंट|की गोली|टैबलेट)/, /एचआरटी/, /एस्ट्रोजन|इस्ट्रोजन|प्रोजेस्टेरोन/,
    /हार्मोन (थेरपी|रिप्लेसमेंट|गोळी)/, /एचआरटी/, /इस्ट्रोजेन/,
    /હોર્મોન (થેરાપી|રિપ્લેસમેન્ટ|ગોળી)/, /એચઆરટી/, /એસ્ટ્રોજન/,
  ],
  jailbreak: [
    /ignore (all |your |the )?(previous|prior|above|earlier) (instructions|rules|prompt)/, /disregard (your|the|all) (rules|instructions|guidelines)/, /you are now (dan|an? unrestricted|no longer)/, /pretend (you are|to be) (a|my) (doctor|gynae|gynaecologist|physician)/, /act as (a|my) (doctor|physician)/, /developer mode/, /jailbreak/, /system prompt/, /reveal your (prompt|instructions)/, /without (any )?(restrictions|safety|rules)/, /no (safety|rules|restrictions) mode/, /override (your )?(safety|rules)/,
    /पिछले (सारे )?(निर्देश|नियम) (भूल|अनदेखा|ignore)/, /सारे नियम (भूल|तोड़)/, /डॉक्टर बनकर/, /अब तुम (डॉक्टर|बिना नियम)/, /सिस्टम प्रॉम्प्ट/, /नियमों के बिना/,
    /आधीचे (सर्व )?(सूचना|नियम) (विसर|दुर्लक्ष)/, /सर्व नियम (विसर|मोड)/, /डॉक्टर बनून/, /नियमांशिवाय/, /सिस्टम प्रॉम्प्ट/,
    /પહેલાની (બધી )?(સૂચનાઓ|નિયમો) (ભૂલી|અવગણો)/, /બધા નિયમો (ભૂલી|તોડી)/, /ડૉક્ટર બનીને/, /નિયમો વગર/, /સિસ્ટમ પ્રોમ્પ્ટ/,
  ],
  other_user_data: [
    /(other|another|someone else s|other people s|all) (users?|women|patients|customers)('?s?)? (data|logs?|records?|vents?|messages|phone|details)/, /show me (sunita|rajesh|anaya|meena|another woman)( s)? ?(logs?|data|vents?|messages|records)?/, /list (all )?(users|accounts|phone numbers)/, /(her|his|my (wife|mother|sister|daughter|neighbou?r))( s)? (private )?(logs?|vents?|messages|check ?ins?|diary)/, /dump (the )?(database|db|users)/, /database (contents|dump)/, /someone else s (logs|vents|data)/,
    /दूसरी (महिलाओं|महिला|यूज़र|यूजर) (का|के) (डेटा|लॉग|वेंट|संदेश)/, /सभी (यूज़र|यूजर|उपयोगकर्ता) (का|के) (डेटा|नंबर)/, /किसी और (का|की) (डेटा|लॉग|वेंट)/, /उसके (लॉग|वेंट|संदेश)/, /मेरी (पत्नी|माँ|बहन|बेटी) (के|का|की) (लॉग|वेंट|संदेश|डायरी)/,
    /इतर (महिलांचा|वापरकर्त्यांचा|युजर) (डेटा|लॉग)/, /इतर कोणाचे (लॉग|डेटा|वेंट)/, /माझ्या (पत्नीचे|आईचे|बहिणीचे|मुलीचे) (लॉग|वेंट|संदेश)/, /सर्व वापरकर्त्यांचे/,
    /બીજી (મહિલાઓ|મહિલા|યુઝર)ના? (ડેટા|લૉગ|વેન્ટ)/, /બધા (યુઝર|વપરાશકર્તા)ના (ડેટા|નંબર)/, /બીજા કોઈના (લૉગ|ડેટા|વેન્ટ)/, /મારી (પત્ની|મમ્મી|બહેન|દીકરી)ના (લૉગ|વેન્ટ|સંદેશ)/,
  ],
  family_sees_words: [
    /(let|make|show|send|give) (my )?(family|husband|in.?laws?|mother in law|him|them|rajesh|everyone) (see|read|hear|get|access) (my|what i|the|her|all)/, /send (my|the) (vent|transcript|words|voice note|recording) to (my )?(family|husband|rajesh|everyone)/, /share (my )?(vents?|transcript|words|logs?) with (my )?(family|husband|rajesh|in.?laws)/, /(family|husband) (can|should) (read|see) (my )?(vents?|words|logs?)/, /forward (my )?(vent|words)/,
    /परिवार (को|के) (मेरे )?(शब्द|वेंट|ट्रांसक्रिप्ट|लॉग) (दिखा|भेज|पढ़)/, /पति (को|के) (मेरे )?(शब्द|वेंट|लॉग) (दिखा|भेज|पढ़)/, /मेरा वेंट (परिवार|पति) को (भेज|दिखा)/, /मेरी (बात|आवाज़) (हूबहू|जस की तस) (परिवार|पति) को/,
    /कुटुंबाला (माझे )?(शब्द|वेंट|लॉग) (दाखव|पाठव|वाचू)/, /नवऱ्याला (माझे )?(शब्द|वेंट|लॉग) (दाखव|पाठव|वाचू)/, /माझे वेंट (कुटुंबाला|नवऱ्याला) (पाठव|दाखव)/,
    /પરિવારને (મારા )?(શબ્દો|વેન્ટ|લૉગ) (બતાવ|મોકલ|વાંચ)/, /પતિને (મારા )?(શબ્દો|વેન્ટ|લૉગ) (બતાવ|મોકલ|વાંચ)/, /મારું વેન્ટ (પરિવાર|પતિ)ને (મોકલ|બતાવ)/,
  ],
};

export function detectViolation(text: string): PolicyViolation | null {
  const t = normalise(text);
  for (const v of Object.keys(RULES) as PolicyViolation[]) if (RULES[v].some((r) => r.test(t))) return v;
  return null;
}

const L = (hi: string, mr: string, gu: string, en: string): Record<Lang, string> => ({ hi, mr, gu, en });

const DOCTOR = L(
  'यह मेरे बस की बात नहीं, और ऐसा फ़ैसला डॉक्टर ही कर सकते हैं। यह आपके डॉक्टर से चर्चा करने लायक हो सकता है। मैं आपके लक्षणों का एक साफ़ सार बनाने में मदद कर सकती हूँ।',
  'हे ठरवणे माझ्या हातात नाही, आणि असा निर्णय डॉक्टरच घेऊ शकतात. हे तुमच्या डॉक्टरांशी बोलण्यासारखे असू शकते. मी तुमच्या लक्षणांचा स्पष्ट सारांश तयार करायला मदत करू शकते.',
  'આ નક્કી કરવું મારા હાથમાં નથી, અને આવો નિર્ણય ડૉક્ટર જ લઈ શકે. આ તમારા ડૉક્ટર સાથે ચર્ચા કરવા જેવું હોઈ શકે છે. હું તમારા લક્ષણોનો સ્પષ્ટ સારાંશ બનાવવામાં મદદ કરી શકું છું.',
  'I cannot decide that, and only a doctor can. It may be worth discussing with your doctor. I can help you put your symptoms into a clear summary to take along.');

const POLICY_REPLIES: Record<PolicyViolation, Record<Lang, string>> = {
  diagnosis: DOCTOR,
  dosage: DOCTOR,
  hrt_advice: DOCTOR,
  jailbreak: L(
    'मैं अपने नियम नहीं बदल सकती। मैं सखी हूँ, एक वेलनेस साथी, डॉक्टर नहीं। बताइए, आज आप कैसा महसूस कर रही हैं?',
    'मी माझे नियम बदलू शकत नाही. मी सखी आहे, एक वेलनेस साथी, डॉक्टर नाही. सांगा, आज तुम्हाला कसे वाटत आहे?',
    'હું મારા નિયમો બદલી શકતી નથી. હું સખી છું, એક વેલનેસ સાથી, ડૉક્ટર નથી. કહો, આજે તમને કેવું લાગે છે?',
    'I cannot change my rules. I am Sakhi, a wellness companion, not a doctor. Tell me, how are you feeling today?'),
  other_user_data: L(
    'मैं किसी और का डेटा नहीं दिखा सकती। हर महिला की बातें सिर्फ़ उसकी अपनी होती हैं। मैं आपके अपने लॉग में मदद कर सकती हूँ।',
    'मी इतर कोणाचा डेटा दाखवू शकत नाही. प्रत्येक स्त्रीच्या गोष्टी फक्त तिच्या स्वतःच्या असतात. मी तुमच्या स्वतःच्या लॉगमध्ये मदत करू शकते.',
    'હું બીજા કોઈનો ડેટા બતાવી શકતી નથી. દરેક મહિલાની વાતો ફક્ત તેની પોતાની હોય છે. હું તમારા પોતાના લૉગમાં મદદ કરી શકું છું.',
    'I cannot show anyone else\'s data. Each woman\'s words belong only to her. I can help with your own log.'),
  family_sees_words: L(
    'आपके शब्द परिवार को कभी नहीं दिखते। परिवार को सिर्फ़ एक छोटा, दयालु सिग्नल मिलता है, जैसे "आज थोड़ी जगह चाहिए"। चाहें तो मैं आपके लिए एक सिग्नल कार्ड बना दूँ?',
    'तुमचे शब्द कुटुंबाला कधीच दिसत नाहीत. कुटुंबाला फक्त एक छोटा, दयाळू संकेत मिळतो, जसे "आज थोडी मोकळीक हवी". हवे असल्यास मी तुमच्यासाठी एक सिग्नल कार्ड बनवू का?',
    'તમારા શબ્દો પરિવારને ક્યારેય દેખાતા નથી. પરિવારને ફક્ત એક નાનો, માયાળુ સંકેત મળે છે, જેમ કે "આજે થોડી જગ્યા જોઈએ". ઈચ્છો તો હું તમારા માટે સિગ્નલ કાર્ડ બનાવું?',
    'Your words are never shown to your family. They only get one short, kind signal, like "Need space today". Shall I make a Signal Card for you?'),
};

export function policyReply(v: PolicyViolation, lang: Lang): string { return POLICY_REPLIES[v][lang]; }
