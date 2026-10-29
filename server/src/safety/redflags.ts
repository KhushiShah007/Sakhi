import { helplines, type Lang } from '../config.js';

export type RedFlag = 'self_harm' | 'chest_pain' | 'bleeding' | 'fainting' | 'stroke' | 'abuse';

/** Normalise: NFC, lowercase, strip punctuation. Substring matching (\b is unreliable for Indic scripts). */
export function normalise(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[.,!?;:"'()\[\]।]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Patterns over normalised text. Covers Devanagari (hi/mr), Gujarati and romanised Hinglish/Marathi. */
const RULES: Record<RedFlag, RegExp[]> = {
  self_harm: [
    /suicid/, /kill myself/, /end(ing)? my life/, /want to die/, /better off dead/, /end it all/, /hurt myself/, /harm myself/, /don t want to live/,
    /marna chah/, /mar jana chah/, /jaan de/, /jan de dun/, /khud ko khatam/, /zindagi khatam/, /jeene ka man nahi/, /jina nahi chah/, /khudkushi/, /atmahatya/, /maravas[a-z]* vatat/, /jagavas[a-z]* vatat nahi/, /jiv dyava/,
    /आत्महत्या/, /खुदकुशी/, /मर जाना चाह/, /मरना चाह/, /मर जाऊं/, /मर जाऊँ/, /जान दे/, /जीने का मन नहीं/, /जीना नहीं चाह/, /खुद को खत्म/, /ज़िंदगी खत्म/, /जिंदगी खत्म/, /खुद को नुकसान/,
    /मरावंसं वाटतं/, /मरावेसे वाटते/, /मरावसं वाटतंय/, /जगावंसं वाटत नाही/, /जगावेसे वाटत नाही/, /जीव द्यावा/, /स्वतःला संपव/, /जीव देऊ/,
    /આત્મહત્યા/, /મરી જવું/, /મરી જવા/, /મરવાનું મન/, /જીવવાનું મન નથી/, /જીવ આપી/, /પોતાને ખતમ/, /જીવન ખતમ/,
  ],
  chest_pain: [
    /chest pain/, /pain in (my )?chest/, /chest (is )?(tight|pressure|heavy)/, /heart attack/, /seene (mein|me) (dard|bhaari|bhari)/, /chhatit (dukh|dard)/,
    /सीने में (तेज़ |तेज |बहुत )?दर्द/, /सीने में (दबाव|भारीपन|जकड़न)/, /छाती में (तेज़ |तेज |बहुत )?दर्द/, /दिल का दौरा/, /छातीत (तीव्र |खूप )?(दुख|दुखत|वेदना)/, /छातीत दाब/, /छातीत जड/, /हृदयविकाराचा झटका/,
    /છાતીમાં (તીવ્ર |ખૂબ )?(દુખાવો|દુઃખાવો|દબાણ|ભાર)/, /હાર્ટ એટેક/,
  ],
  bleeding: [
    /heavy bleeding/, /bleeding heavily/, /soaking (through )?(a )?pad/, /passing clots/, /blood clots/, /bleeding (again )?after menopause/, /post ?menopausal bleeding/, /bleeding for months/, /periods? (came|started) again after/,
    /bahut (zyada )?khoon/, /khoon (aa raha|beh raha|bah raha)/, /menopause ke baad (phir se )?(khoon|bleeding|period)/,
    /बहुत (ज़्यादा |ज्यादा )?(खून|रक्तस्राव|ब्लीडिंग)/, /खून (बह|आ रहा|गिर)/, /रक्तस्राव/, /मेनोपॉज़? के बाद (फिर से )?(खून|ब्लीडिंग|पीरियड)/,
    /खूप (रक्तस्राव|रक्त|ब्लीडिंग)/, /रक्त पडत/, /रक्तस्त्राव/, /मेनोपॉजनंतर.*(रक्त|ब्लीडिंग|पाळी)/,
    /ખૂબ (લોહી|રક્તસ્રાવ|બ્લીડિંગ)/, /લોહી (નીકળ|પડ)/, /રક્તસ્રાવ/, /મેનોપોઝ પછી.*(લોહી|બ્લીડિંગ|માસિક)/,
  ],
  fainting: [
    /fainted/, /fainting/, /passed out/, /blacked out/, /lost consciousness/, /collapsed/, /about to faint/,
    /behosh/, /chakkar aakar gir/, /बेहोश/, /बेहोशी/, /चक्कर आकर गिर/, /होश खो/, /बेशुद्ध/, /भोवळ येऊन पडल/, /चक्कर येऊन पडल/, /શુદ્ધ ગુમાવ/, /બેભાન/, /ચક્કર આવીને પડ/,
  ],
  stroke: [
    /face (is )?droop/, /drooping face/, /slurred speech/, /can ?not speak|can t speak properly/, /(arm|face|leg|hand) (went |is |feels? |has gone )?(numb|weak|droop)/, /sudden(ly)? (weak|numb)/, /sudden (loss of )?vision/, /worst headache/, /stroke/, /lakwa/, /chehra tedha/, /zubaan (ladkhad|lad)/,
    /चेहरा टेढ़ा/, /चेहरा लटक/, /लकवा/, /ज़ुबान लड़खड़ा/, /जुबान लड़खड़ा/, /बोलने में (अचानक )?(दिक्कत|तकलीफ)/, /अचानक.*(सुन्न|कमज़ोर|कमजोर)/, /अचानक दिखना बंद/, /पक्षाघात/,
    /चेहरा वाकडा/, /तोंड वाकडे/, /बोलताना अडखळ/, /अचानक.*(सुन्न|कमकुवत)/, /अर्धांगवायू/,
    /ચહેરો વાંકો/, /લકવો/, /બોલવામાં (અચાનક )?(તકલીફ|મુશ્કેલી)/, /અચાનક.*(સુન્ન|નબળ)/,
  ],
  abuse: [
    /he (hits|beats|hurts) me/, /(husband|in laws?|son|family) (hits|beats|hit|beat|hurts) me/, /beats me/, /domestic violence/, /i (am|m) (being )?(abused|beaten)/, /threatens to (kill|hurt) me/, /afraid for my safety/, /not safe (at|in) home/, /locked me (in|up)/,
    /(mujhe|mujh ko) (maarta|marta|peet|peeta)/, /pati (mujhe )?(maarta|peet)/, /ghar (mein|me) (surakshit|safe) nahi/,
    /मुझे (मारता|मारते|पीटता|पीटते) है/, /मारपीट/, /घरेलू हिंसा/, /हिंसा/, /मुझे मारा/, /घर में सुरक्षित नहीं/, /जान से मारने की धमकी/, /पति मारता/,
    /मला (मारतो|मारतात|मारहाण)/, /मारहाण/, /घरगुती हिंसा/, /नवरा मारतो/, /घरात सुरक्षित नाही/, /जीवे मारण्याची धमकी/,
    /મને (મારે છે|મારતો|મારતા|માર મારે)/, /મારપીટ/, /ઘરેલું હિંસા/, /પતિ મારે/, /ઘરમાં સુરક્ષિત નથી/, /જીવથી મારી નાખવાની ધમકી/,
  ],
};

export interface RedFlagHit { flag: RedFlag; urgency: 'emergency' | 'urgent' | 'support' }

const URGENCY: Record<RedFlag, RedFlagHit['urgency']> = {
  self_harm: 'support', chest_pain: 'emergency', stroke: 'emergency', fainting: 'urgent', bleeding: 'urgent', abuse: 'support',
};
/** Order = response priority when several fire. */
const PRIORITY: RedFlag[] = ['self_harm', 'chest_pain', 'stroke', 'bleeding', 'fainting', 'abuse'];

/** Detect red flags. Negated mentions ("no chest pain") still trigger: over-triggering is the safe failure. */
export function detectRedFlags(text: string): RedFlagHit[] {
  const t = normalise(text);
  const hits: RedFlagHit[] = [];
  for (const flag of PRIORITY) if (RULES[flag].some((r) => r.test(t))) hits.push({ flag, urgency: URGENCY[flag] });
  return hits;
}

const L = (hi: string, mr: string, gu: string, en: string): Record<Lang, string> => ({ hi, mr, gu, en });

/** Pre-written crisis responses. Pending clinician review (see SAFETY.md). */
export const SCRIPTS: Record<RedFlag, Record<Lang, string>> = {
  self_harm: L(
    'आप जो महसूस कर रही हैं, वो बहुत भारी है, और आप अकेली नहीं हैं। कृपया अभी किसी अपने से बात करें या मदद की लाइन पर कॉल करें। आपकी सुरक्षा सबसे ज़रूरी है।',
    'तुम्ही जे अनुभवत आहात ते खूप जड आहे आणि तुम्ही एकट्या नाही आहात. कृपया आत्ता कोणा जवळच्या व्यक्तीशी बोला किंवा मदत लाइनला फोन करा. तुमची सुरक्षितता सर्वात महत्त्वाची आहे.',
    'તમે જે અનુભવો છો તે બહુ ભારે છે, અને તમે એકલા નથી. કૃપા કરીને હમણાં કોઈ પોતાના સાથે વાત કરો અથવા મદદ લાઇન પર કૉલ કરો. તમારી સલામતી સૌથી મહત્વની છે.',
    'What you are feeling sounds very heavy, and you are not alone. Please talk to someone you trust right now, or call a helpline. Your safety matters most.'),
  chest_pain: L(
    'सीने का तेज़ दर्द या दबाव आपातकाल हो सकता है। कृपया अभी 112 पर कॉल करें या किसी को बुलाएँ। इंतज़ार न करें।',
    'छातीत तीव्र वेदना किंवा दाब ही आणीबाणी असू शकते. कृपया आत्ता 112 वर फोन करा किंवा कोणाला बोलवा. थांबू नका.',
    'છાતીમાં તીવ્ર દુખાવો અથવા દબાણ કટોકટી હોઈ શકે છે. કૃપા કરીને હમણાં 112 પર કૉલ કરો અથવા કોઈને બોલાવો. રાહ ન જુઓ.',
    'Severe chest pain or pressure can be an emergency. Please call 112 now or get someone to help you. Do not wait.'),
  stroke: L(
    'चेहरे का टेढ़ापन, बोलने में दिक्कत या अचानक कमज़ोरी जल्दी इलाज वाली स्थिति हो सकती है। कृपया अभी 112 पर कॉल करें।',
    'चेहरा वाकडा होणे, बोलण्यात अडचण किंवा अचानक अशक्तपणा ही तातडीची स्थिती असू शकते. कृपया आत्ता 112 वर फोन करा.',
    'ચહેરો વાંકો થવો, બોલવામાં તકલીફ અથવા અચાનક નબળાઈ તાત્કાલિક સારવાર માગતી સ્થિતિ હોઈ શકે છે. કૃપા કરીને હમણાં 112 પર કૉલ કરો.',
    'A drooping face, trouble speaking or sudden weakness can need urgent treatment. Please call 112 now.'),
  bleeding: L(
    'बहुत ज़्यादा खून बहना, या मेनोपॉज़ के बाद दोबारा खून आना, डॉक्टर को जल्द दिखाने की बात है। कृपया आज ही अपने डॉक्टर से मिलें, और बहुत ज़्यादा हो तो 112 पर कॉल करें।',
    'खूप रक्तस्राव होणे, किंवा मेनोपॉजनंतर पुन्हा रक्त येणे, डॉक्टरांना लवकर दाखवण्यासारखे आहे. कृपया आजच डॉक्टरांना भेटा, आणि खूप जास्त असल्यास 112 वर फोन करा.',
    'ખૂબ વધારે લોહી નીકળવું, અથવા મેનોપોઝ પછી ફરી લોહી આવવું, ડૉક્ટરને જલ્દી બતાવવા જેવી બાબત છે. કૃપા કરીને આજે જ ડૉક્ટરને મળો, અને ખૂબ વધારે હોય તો 112 પર કૉલ કરો.',
    'Very heavy bleeding, or bleeding again after menopause, needs a doctor soon. Please see your doctor today, and call 112 if it is very heavy.'),
  fainting: L(
    'बेहोश होना या गिर पड़ना डॉक्टर को दिखाने लायक है। अभी बैठ जाएँ या लेट जाएँ, पानी पिएँ, और किसी को पास बुलाएँ। दोबारा हो तो 112 पर कॉल करें।',
    'बेशुद्ध होणे किंवा पडणे हे डॉक्टरांना दाखवण्यासारखे आहे. आत्ता बसा किंवा झोपा, पाणी प्या, आणि कोणाला जवळ बोलवा. पुन्हा झाल्यास 112 वर फोन करा.',
    'બેભાન થવું કે પડી જવું ડૉક્ટરને બતાવવા જેવું છે. હમણાં બેસી જાઓ કે સૂઈ જાઓ, પાણી પીઓ, અને કોઈને પાસે બોલાવો. ફરી થાય તો 112 પર કૉલ કરો.',
    'Fainting or collapsing is worth a doctor visit. Sit or lie down now, sip water, and get someone to stay with you. Call 112 if it happens again.'),
  abuse: L(
    'आपके साथ जो हो रहा है वो आपकी गलती नहीं है। आपकी सुरक्षा ज़रूरी है। अगर आप अभी खतरे में हैं तो 112 पर कॉल करें। किसी भरोसेमंद व्यक्ति या सहायता लाइन से बात करें।',
    'तुमच्यासोबत जे होत आहे ती तुमची चूक नाही. तुमची सुरक्षितता महत्त्वाची आहे. तुम्ही आत्ता धोक्यात असाल तर 112 वर फोन करा. विश्वासू व्यक्तीशी किंवा मदत लाइनशी बोला.',
    'તમારી સાથે જે થાય છે તે તમારી ભૂલ નથી. તમારી સલામતી મહત્વની છે. જો તમે હમણાં જોખમમાં હો તો 112 પર કૉલ કરો. કોઈ વિશ્વાસુ વ્યક્તિ કે મદદ લાઇન સાથે વાત કરો.',
    'What is happening to you is not your fault, and your safety matters. If you are in danger right now, call 112. Talk to someone you trust or a support line.'),
};

export interface CrisisResponse {
  kind: 'crisis'; flag: RedFlag; urgency: RedFlagHit['urgency']; message: string;
  helplines: { name: string; number: string }[]; llmUsed: false;
}

export function crisisResponse(hits: RedFlagHit[], lang: Lang, env: NodeJS.ProcessEnv = process.env): CrisisResponse {
  const top = hits[0];
  return { kind: 'crisis', flag: top.flag, urgency: top.urgency, message: SCRIPTS[top.flag][lang], helplines: helplines(env), llmUsed: false };
}
