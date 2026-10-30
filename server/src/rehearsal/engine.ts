import type { Lang } from '../config.js';

/**
 * Rehearsal Room, rule-based role-play. No keys needed, runs on the server and in the browser (offline build).
 * Sakhi plays the other person: it reads what she actually said (intent), answers it, and moves the scene
 * from resistance to understanding to agreement. It never repeats a line within a session, never gives medical advice,
 * and is never cruel. Pure functions, so they are unit-tested.
 */
export const SCENARIOS = ['family', 'hr', 'doctor'] as const;
export type Scenario = (typeof SCENARIOS)[number];
export type Intent = 'greeting' | 'shares' | 'request' | 'question' | 'blame' | 'giveup' | 'thanks' | 'other';

/** The scene ends after a clear request has been agreed, or after this many of her turns. */
export const MAX_TURNS = 8;

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

// Hindi, Marathi, Gujarati, English, and Hinglish written in Latin letters. Order of use is in detectIntent.
const BLAME = /\balways\b|\bnever\b|your fault|because of you|you don'?t care|hamesha|kabhi nahi|kabhi nahin|tumhari wajah|aapki wajah|तुम्हारी वजह|आपकी वजह|हमेशा|कभी नहीं|परवाह नहीं|तुम्हारी गलती|नेहमी|कधीच नाही|तुझ्यामुळे|तुमच्यामुळे|हमेशा|હંમેશા|ક્યારેય નહીં|તારા કારણે|તમારા કારણે/;
const GIVEUP = /\bsorry\b|forget it|never ?mind|leave it|it'?s nothing|rehne do|chhodo|chodo|koi baat nahi|maaf|माफ़?|रहने दो|छोड़ो|छोडो|कोई बात नहीं|राहू द्या|सोडा|जाऊ द्या|माफ करा|રહેવા દો|છોડો|માફ કરજો|કંઈ નહીં/;
const THANKS = /thank|thanks|shukriya|dhanyavad|dhanyawad|शुक्रिया|धन्यवाद|आभार|आभारी|आभार|આભાર|ધન્યવાદ/;
const REQUEST = /\bcan you\b|\bcould you\b|\bwould you\b|\bplease\b|i need|i would like|i want you|help me|\bask\b|chahiye|chahie|kar sakte|kar sakti|madad|kripya|krupya|कृपया|चाहिए|चाहिये|चाहती हूँ|चाहती हूं|सकते हैं|सकती हो|सकते हो|मदद|छुट्टी|बदलाव|हवे|हवी|कृपा करून|करू शकता|करू शकशील|मदत|सुट्टी|જોઈએ|કરી શકો|કરી શકશો|મદદ|કૃપા કરીને|રજા/;
const QUESTION = /\?|\bwhy\b|\bwhat\b|\bhow\b|\bwhen\b|\bwho\b|\bwhich\b|\bkya\b|\bkyun\b|\bkyon\b|\bkaise\b|क्या|क्यों|कैसे|कब|कौन|काय|कसे|कधी|કેમ|શું|કેવી રીતે|ક્યારે/;
const SHARES = /tired|exhaust|sleep|awake|night|hot|flash|sweat|mood|anxi|worr|stress|pain|ache|headache|dizz|forget|irritab|angry|sad|cry|low|weak|body|feel|\bi am\b|\bi'm\b|neend|nind|thak|thaka|garmi|pasina|pareshan|ghabra|dard|chidchid|mujhe|मुझे|मैं|नींद|थक|गर्मी|पसीना|परेशान|घबरा|दर्द|चिड़|चिडचिड|भूल|कमज़ोर|कमजोर|रात|उदास|तनाव|टेंशन|मला|मी |झोप|थकवा|थकल|उकाडा|घाम|त्रास|वेदना|चिडचिड|विसर|अशक्त|ताण|મને|હું|ઊંઘ|ઉંઘ|થાક|ગરમી|પરસેવો|તકલીફ|દુખાવો|ચિંતા|તણાવ|નબળાઈ/;
const GREET = /^(hello|hi|hey|namaste|namaskar|good (morning|afternoon|evening))\b|^(नमस्ते|नमस्कार|हेलो|हैलो|हाय|नमस्कार|નમસ્તે|નમસ્કાર|હેલો)/;

/** What did she just do in the conversation? */
export function detectIntent(text: string): Intent {
  const t = norm(text);
  if (!t) return 'other';
  if (BLAME.test(t)) return 'blame';
  if (GIVEUP.test(t) && t.length < 60) return 'giveup';
  if (THANKS.test(t) && t.length < 70) return 'thanks';
  if (REQUEST.test(t)) return 'request';
  if (SHARES.test(t)) return 'shares';
  if (QUESTION.test(t)) return 'question';
  if (GREET.test(t) && t.length < 40) return 'greeting';
  return 'other';
}

interface Pack {
  open: string; shares: [string, string, string]; request: [string, string, string]; question: [string, string]; blame: [string, string];
  giveup: string; thanks: string; greet: string; other: [string, string]; close: string;
}

const P: Record<Scenario, Record<Lang, Pack>> = {
  family: {
    en: {
      open: "What's up? You seem a bit different today.",
      shares: ['Oh, everyone gets tired sometimes. Why think so much about it?', "Hmm... I didn't realise it was this much. Tell me more.", "Okay, I understand now. You don't have to carry this alone."],
      request: ['Let me understand first. What exactly is going on?', 'Okay. Tell me exactly what you need from me.', "Alright, I'll do it. Why didn't you tell me earlier? We'll sort it out together."],
      question: ["I don't know... you tell me, what are you thinking?", "Good question. I'm listening."],
      blame: ["Hey, what did I do? Let's talk calmly.", "Okay, that hurt, but I'm listening. Take your time."],
      giveup: "No, don't stop. I'm listening.", thanks: "You don't need to thank me. We're in this together.", greet: "Yes, go ahead. I'm listening.",
      other: ['Hmm... but what are you really trying to say?', 'That is fine, but tell me how you are feeling.'],
      close: "Okay. I'll remember this. Let's sit down again tomorrow.",
    },
    hi: {
      open: 'क्या हुआ? आज तुम कुछ अलग लग रही हो।',
      shares: ['अरे, थोड़ी थकान तो सबको होती है। इतना क्या सोचना?', 'अच्छा... मुझे पता नहीं था कि यह इतना ज़्यादा है। और बताओ।', 'ठीक है, अब समझ आ रहा है। तुम अकेले नहीं झेलोगी।'],
      request: ['अभी मुझे समझने दो। पहले बताओ, हुआ क्या है?', 'हम्म, ठीक है। तुम्हें ठीक-ठीक क्या चाहिए, बताओ।', 'ठीक है, मैं करूँगा। मुझे पहले क्यों नहीं बताया? हम साथ मिलकर देखेंगे।'],
      question: ['पता नहीं... तुम ही बताओ न, क्या सोच रही हो?', 'अच्छा सवाल है। मैं सुन रहा हूँ।'],
      blame: ['अरे, मैंने ऐसा क्या कर दिया? शांति से बात करें।', 'ठीक है, बुरा लगा, पर मैं सुन रहा हूँ। आराम से बताओ।'],
      giveup: 'नहीं-नहीं, रुको मत। मैं सुन रहा हूँ।', thanks: 'अरे, इसमें शुक्रिया कैसा। हम साथ हैं।', greet: 'हाँ, बोलो। मैं सुन रहा हूँ।',
      other: ['हम्म... पर तुम असल में क्या कहना चाह रही हो?', 'वो सब ठीक है, पर मुझे बताओ तुम्हें कैसा लग रहा है।'],
      close: 'ठीक है। आज की बात मुझे याद रहेगी। हम कल फिर बैठकर देखेंगे।',
    },
    mr: {
      open: 'काय झालं? आज तू वेगळी वाटतेस.',
      shares: ['अगं, थकवा तर सगळ्यांनाच येतो. एवढा विचार कशाला?', 'अच्छा... इतकं असेल असं वाटलं नव्हतं. अजून सांग.', 'ठीक आहे, आता कळतंय. तू एकटीने सहन करायचं नाही.'],
      request: ['आधी मला समजून घेऊ दे. नक्की काय झालंय सांग.', 'हं, ठीक आहे. तुला नेमकं काय हवंय ते सांग.', 'ठीक आहे, मी करतो. आधी का नाही सांगितलंस? आपण मिळून बघू.'],
      question: ['माहीत नाही... तूच सांग ना, काय वाटतंय?', 'चांगला प्रश्न आहे. मी ऐकतोय.'],
      blame: ['अगं, मी असं काय केलं? शांतपणे बोलूया.', 'ठीक आहे, वाईट वाटलं, पण मी ऐकतोय. सावकाश सांग.'],
      giveup: 'नाही-नाही, थांबू नकोस. मी ऐकतोय.', thanks: 'अगं, त्यात आभार कसले. आपण सोबत आहोत.', greet: 'हो, बोल. मी ऐकतोय.',
      other: ['हं... पण तुला नेमकं काय सांगायचंय?', 'ते ठीक आहे, पण तुला कसं वाटतंय ते सांग.'],
      close: 'ठीक आहे. आजची गोष्ट मी लक्षात ठेवीन. उद्या पुन्हा बसून बघू.',
    },
    gu: {
      open: 'શું થયું? આજે તું જુદી લાગે છે.',
      shares: ['અરે, થાક તો બધાને લાગે. આટલો વિચાર શાને?', 'અચ્છા... આટલું વધારે હશે એવું લાગ્યું નહોતું. બીજું કહે.', 'સારું, હવે સમજાય છે. તારે એકલીએ સહન નથી કરવાનું.'],
      request: ['પહેલાં મને સમજવા દે. બરાબર શું થયું છે એ કહે.', 'હમ્મ, સારું. તને ચોક્કસ શું જોઈએ છે તે કહે.', 'સારું, હું કરીશ. મને પહેલાં કેમ ન કહ્યું? આપણે સાથે મળીને જોઈશું.'],
      question: ['ખબર નથી... તું જ કહે ને, તને શું લાગે છે?', 'સારો પ્રશ્ન છે. હું સાંભળું છું.'],
      blame: ['અરે, મેં એવું શું કર્યું? શાંતિથી વાત કરીએ.', 'સારું, ખરાબ લાગ્યું, પણ હું સાંભળું છું. ધીમે ધીમે કહે.'],
      giveup: 'ના-ના, અટકીશ નહીં. હું સાંભળું છું.', thanks: 'અરે, એમાં આભાર શાનો. આપણે સાથે છીએ.', greet: 'હા, બોલ. હું સાંભળું છું.',
      other: ['હમ્મ... પણ તારે ખરેખર શું કહેવું છે?', 'એ બરાબર, પણ તને કેવું લાગે છે તે કહે.'],
      close: 'સારું. આજની વાત મને યાદ રહેશે. કાલે ફરી બેસીને જોઈશું.',
    },
  },
  hr: {
    en: {
      open: 'Hello. Please sit down. What would you like to talk about?',
      shares: ["Okay, I'm noting that down. How long has this been happening?", "That's helpful to know. How is it affecting your work?", 'Thank you for being open with me. We can help with this.'],
      request: ['By our process I need a few details first. What change are you asking for?', 'Alright. Could you tell me for how long, and what kind of change?', "Okay, I'll take this forward. We'll confirm it in writing this week."],
      question: ['Our policy allows flexible hours, but it needs approval.', "That's a fair question. Let me check the policy and come back to you."],
      blame: ["I hear you, but let's keep this calm so we can find a solution.", "Your frustration may be fair. Let's look at the facts together."],
      giveup: "No problem, there is no rush. Tell me whenever you are ready.", thanks: "You're welcome. I'll send whatever we agree in writing.", greet: 'Hello. Please, tell me what this is about.',
      other: ['Could you be a little clearer about what you would like?', 'I am not sure I follow. What is the main point?'],
      close: "Alright, I'll record this today and send you an email to confirm.",
    },
    hi: {
      open: 'नमस्ते। बैठिए। बताइए, किस बारे में बात करनी है?',
      shares: ['ठीक है, मैं नोट कर रही हूँ। यह कब से हो रहा है?', 'यह जानना मददगार है। इसका आपके काम पर क्या असर पड़ रहा है?', 'आपने खुलकर बताया, धन्यवाद। हम इसमें मदद कर सकते हैं।'],
      request: ['प्रक्रिया के अनुसार पहले मुझे थोड़ा विवरण चाहिए। आप क्या बदलाव चाहती हैं?', 'ठीक है। क्या आप बता सकती हैं कि कितने समय के लिए और किस तरह का बदलाव?', 'ठीक है, मैं इसे आगे बढ़ाती हूँ। हम इस हफ़्ते लिखित में पक्का कर लेंगे।'],
      question: ['सामान्य नीति में लचीले समय की सुविधा है, पर इसे मंज़ूरी चाहिए।', 'आपका सवाल सही है। मैं नीति देखकर बताती हूँ।'],
      blame: ['मैं आपकी बात समझती हूँ, पर कृपया शांत होकर बात करें, ताकि हम हल निकाल सकें।', 'आपकी नाराज़गी जायज़ हो सकती है। चलिए, तथ्यों पर बात करते हैं।'],
      giveup: 'कोई बात नहीं, जल्दबाज़ी नहीं है। आप जब चाहें बता सकती हैं।', thanks: 'आपका स्वागत है। जो भी तय होगा, मैं लिखित में भेज दूँगी।', greet: 'नमस्ते। बैठिए, बताइए क्या बात है।',
      other: ['क्या आप थोड़ा साफ़ बता सकती हैं कि आप क्या चाहती हैं?', 'मैं समझी नहीं। मुख्य बात क्या है?'],
      close: 'ठीक है, मैं आज ही इसे दर्ज करती हूँ और ईमेल से पुष्टि भेज दूँगी।',
    },
    mr: {
      open: 'नमस्कार. बसा. सांगा, कोणत्या विषयावर बोलायचं आहे?',
      shares: ['ठीक आहे, मी नोंद करते. हे कधीपासून होतंय?', 'हे जाणून घेणं उपयोगी आहे. याचा तुमच्या कामावर काय परिणाम होतोय?', 'तुम्ही मोकळेपणाने सांगितलंत, धन्यवाद. आपण यात मदत करू शकतो.'],
      request: ['प्रक्रियेनुसार आधी थोडी माहिती हवी. तुम्हाला काय बदल हवा आहे?', 'ठीक आहे. किती काळासाठी आणि कोणत्या प्रकारचा बदल, ते सांगाल का?', 'ठीक आहे, मी हे पुढे पाठवते. या आठवड्यात लेखी पक्कं करू.'],
      question: ['सर्वसाधारण धोरणात लवचिक वेळेची सोय आहे, पण त्याला मंजुरी लागते.', 'तुमचा प्रश्न योग्य आहे. मी धोरण पाहून सांगते.'],
      blame: ['मी तुमचं म्हणणं समजते, पण कृपया शांतपणे बोलूया, म्हणजे आपण मार्ग काढू शकू.', 'तुमची नाराजी योग्य असू शकते. चला, वस्तुस्थितीवर बोलूया.'],
      giveup: 'काही हरकत नाही, घाई नाही. तुम्हाला वाटेल तेव्हा सांगा.', thanks: 'आपले स्वागत. जे ठरेल ते मी लेखी पाठवते.', greet: 'नमस्कार. बसा, काय विषय आहे ते सांगा.',
      other: ['तुम्हाला काय हवं आहे ते थोडं स्पष्ट सांगाल का?', 'मला नीट समजलं नाही. मुख्य मुद्दा काय आहे?'],
      close: 'ठीक आहे, मी आजच नोंद करते आणि ईमेलने खात्री पाठवते.',
    },
    gu: {
      open: 'નમસ્તે. બેસો. કહો, કયા વિષય પર વાત કરવી છે?',
      shares: ['સારું, હું નોંધ કરું છું. આ ક્યારથી થાય છે?', 'આ જાણવું ઉપયોગી છે. એની તમારા કામ પર શી અસર થાય છે?', 'તમે ખુલ્લેથી કહ્યું તે બદલ આભાર. આપણે એમાં મદદ કરી શકીએ.'],
      request: ['પ્રક્રિયા મુજબ પહેલાં થોડી વિગત જોઈએ. તમને કયો ફેરફાર જોઈએ છે?', 'સારું. કેટલા સમય માટે અને કેવા પ્રકારનો ફેરફાર, તે કહેશો?', 'સારું, હું આને આગળ મોકલું છું. આ અઠવાડિયે લેખિતમાં પાકું કરીશું.'],
      question: ['સામાન્ય નીતિમાં લવચીક સમયની સુવિધા છે, પણ તેને મંજૂરી જોઈએ.', 'તમારો પ્રશ્ન યોગ્ય છે. હું નીતિ જોઈને કહું છું.'],
      blame: ['હું તમારી વાત સમજું છું, પણ કૃપા કરીને શાંતિથી વાત કરીએ, જેથી ઉકેલ નીકળે.', 'તમારી નારાજગી વાજબી હોઈ શકે. ચાલો, હકીકતો પર વાત કરીએ.'],
      giveup: 'કંઈ વાંધો નહીં, ઉતાવળ નથી. તમને યોગ્ય લાગે ત્યારે કહો.', thanks: 'આપનું સ્વાગત છે. જે નક્કી થશે તે હું લેખિતમાં મોકલીશ.', greet: 'નમસ્તે. બેસો, શું વાત છે તે કહો.',
      other: ['તમને શું જોઈએ છે તે થોડું સ્પષ્ટ કહેશો?', 'મને બરાબર સમજાયું નહીં. મુખ્ય વાત શું છે?'],
      close: 'સારું, હું આજે જ નોંધ કરું છું અને ઇમેઇલથી પુષ્ટિ મોકલીશ.',
    },
  },
  doctor: {
    en: {
      open: 'Hello, please sit. What brings you in today?',
      shares: ['Hmm, okay. How long has this been going on?', 'I see. Is it worse at night? Does it affect your sleep?', 'Thank you, the picture is clearer now. We can talk about tests and next steps.'],
      request: ['Tell me what you need. First let me understand your symptoms properly.', 'Okay. What kind of test or advice are you hoping for?', "Okay, I'll note down some tests and then we can talk through the options."],
      question: ['Good question. For that we would first need a few tests.', "It is different for everyone. Keep telling me about your symptoms."],
      blame: ["I understand you're upset. I want to hear all of it.", "You're right that time is short. Let me listen properly now."],
      giveup: 'No, please go on. I have time.', thanks: 'No problem. Ask me anything you like.', greet: 'Hello, go ahead.',
      other: ['Could you tell me about your symptoms?', 'Please tell me a bit more clearly what the trouble is.'],
      close: "Okay. I'll note everything down. Let's meet again next time.",
    },
    hi: {
      open: 'नमस्कार, बैठिए। बताइए, आज क्या तकलीफ़ है?',
      shares: ['हम्म, ठीक है। यह कब से हो रहा है?', 'समझा। क्या यह रात में ज़्यादा होता है? और नींद पर असर पड़ता है?', 'धन्यवाद, अब तस्वीर साफ़ है। हम जाँच और अगले कदम पर बात कर सकते हैं।'],
      request: ['बताइए आपको क्या चाहिए? पहले मुझे लक्षण ठीक से समझने दीजिए।', 'ठीक है। आप कौन-सी जाँच या सलाह चाहती हैं?', 'ठीक है, मैं जाँच लिख देता हूँ और फिर हम बात करेंगे कि क्या विकल्प हैं।'],
      question: ['अच्छा सवाल है। उसके लिए पहले कुछ जाँच देखनी होंगी।', 'यह हर किसी में अलग होता है। आप अपने लक्षण बताती रहिए।'],
      blame: ['मैं समझता हूँ कि आप परेशान हैं। मैं आपकी पूरी बात सुनना चाहता हूँ।', 'आपकी बात सही है कि समय कम मिलता है। चलिए, अभी ध्यान से सुनता हूँ।'],
      giveup: 'नहीं, आप बोलिए। मेरे पास समय है।', thanks: 'कोई बात नहीं। कोई सवाल हो तो पूछ लीजिए।', greet: 'नमस्कार, बताइए।',
      other: ['क्या आप अपने लक्षणों के बारे में बता सकती हैं?', 'थोड़ा और साफ़ बताइए कि तकलीफ़ क्या है।'],
      close: 'ठीक है। मैं सब नोट कर लेता हूँ। अगली बार फिर मिलते हैं।',
    },
    mr: {
      open: 'नमस्कार, बसा. सांगा, आज काय त्रास आहे?',
      shares: ['हं, ठीक आहे. हे कधीपासून होतंय?', 'समजलं. रात्री जास्त होतं का? झोपेवर परिणाम होतो का?', 'धन्यवाद, आता चित्र स्पष्ट झालं. आपण तपासणी आणि पुढच्या पावलांबद्दल बोलू शकतो.'],
      request: ['तुम्हाला काय हवं ते सांगा. आधी मला लक्षणं नीट समजू द्या.', 'ठीक आहे. तुम्हाला कोणती तपासणी किंवा सल्ला हवा आहे?', 'ठीक आहे, मी तपासणी लिहून देतो आणि मग पर्यायांवर बोलू.'],
      question: ['चांगला प्रश्न आहे. त्यासाठी आधी काही तपासण्या पाहाव्या लागतील.', 'हे प्रत्येकात वेगळं असतं. तुम्ही लक्षणं सांगत राहा.'],
      blame: ['तुम्ही त्रासलेल्या आहात हे मला समजतं. मला तुमचं पूर्ण ऐकायचं आहे.', 'वेळ कमी मिळतो हे खरं आहे. चला, आता लक्षपूर्वक ऐकतो.'],
      giveup: 'नाही, तुम्ही बोला. माझ्याकडे वेळ आहे.', thanks: 'हरकत नाही. काही प्रश्न असतील तर विचारा.', greet: 'नमस्कार, सांगा.',
      other: ['तुमच्या लक्षणांबद्दल सांगाल का?', 'त्रास नेमका काय आहे ते थोडं स्पष्ट सांगा.'],
      close: 'ठीक आहे. मी सगळं नोंदवून घेतो. पुढच्या वेळी पुन्हा भेटू.',
    },
    gu: {
      open: 'નમસ્તે, બેસો. કહો, આજે શું તકલીફ છે?',
      shares: ['હમ્મ, સારું. આ ક્યારથી થાય છે?', 'સમજ્યો. રાત્રે વધારે થાય છે? ઊંઘ પર અસર પડે છે?', 'આભાર, હવે ચિત્ર સ્પષ્ટ છે. આપણે તપાસ અને આગળનાં પગલાં વિશે વાત કરી શકીએ.'],
      request: ['કહો તમને શું જોઈએ છે? પહેલાં મને લક્ષણો બરાબર સમજવા દો.', 'સારું. તમને કઈ તપાસ કે સલાહ જોઈએ છે?', 'સારું, હું તપાસ લખી આપું છું અને પછી વિકલ્પો વિશે વાત કરીશું.'],
      question: ['સારો પ્રશ્ન છે. એ માટે પહેલાં કેટલીક તપાસ જોવી પડશે.', 'આ દરેકમાં અલગ હોય છે. તમે લક્ષણો કહેતા રહો.'],
      blame: ['હું સમજું છું કે તમે પરેશાન છો. મારે તમારી પૂરી વાત સાંભળવી છે.', 'સમય ઓછો મળે છે એ સાચું છે. ચાલો, હવે ધ્યાનથી સાંભળું છું.'],
      giveup: 'ના, તમે બોલો. મારી પાસે સમય છે.', thanks: 'કંઈ વાંધો નહીં. કોઈ પ્રશ્ન હોય તો પૂછો.', greet: 'નમસ્તે, કહો.',
      other: ['તમારાં લક્ષણો વિશે કહેશો?', 'તકલીફ બરાબર શું છે તે થોડું સ્પષ્ટ કહો.'],
      close: 'સારું. હું બધું નોંધી લઉં છું. આગલી વખતે ફરી મળીએ.',
    },
  },
};

/** Neutral follow-ups that work for any of the three characters; used when the specific line for what she said was already used. */
const POOL: Record<Lang, string[]> = {
  en: ['How long has this been going on?', 'What difficulty does it cause in your day?', 'What would help the most?', 'Is there anything else you want to say?'],
  hi: ['कब से चल रहा है यह सब?', 'रोज़ के कामों में इससे क्या मुश्किल आती है?', 'सबसे ज़्यादा किस बात से राहत मिलेगी?', 'और कुछ है जो आप कहना चाहती हैं?'],
  mr: ['हे कधीपासून सुरू आहे?', 'रोजच्या कामात याचा काय त्रास होतो?', 'सर्वात जास्त कशाने आराम मिळेल?', 'आणखी काही सांगायचं आहे का?'],
  gu: ['આ ક્યારથી ચાલે છે?', 'રોજિંદા કામમાં એનાથી શું મુશ્કેલી પડે છે?', 'સૌથી વધુ શાથી રાહત મળશે?', 'બીજું કંઈ કહેવું છે?'],
};

export const openingLine = (scenario: Scenario, lang: Lang): string => P[scenario][lang].open;
export const closingLine = (scenario: Scenario, lang: Lang): string => P[scenario][lang].close;

export interface Reply { reply: string; done: boolean; intent: Intent }

/**
 * The next line from the other person. `said` is what she just said; `earlier` is every line the character has already
 * spoken in this session (including the opening), so nothing is ever repeated; `turn` is her turn number, starting at 1.
 */
export function ruleReply(a: { scenario: Scenario; lang: Lang; said: string; earlier: string[]; turn: number }): Reply {
  const pk = P[a.scenario][a.lang];
  const used = new Set(a.earlier);
  const intent = detectIntent(a.said);
  const unused = (...c: string[]) => c.find((x) => !used.has(x));
  const finish = (reply: string, done = false): Reply => ({ reply, done, intent });

  if (a.turn >= MAX_TURNS) return finish(pk.close, true);

  let line: string | undefined;
  switch (intent) {
    case 'request': {
      // resist, then negotiate, then agree: a clear request after the first exchange ends the scene on agreement
      if (used.has(pk.request[1]) || a.turn >= 3) { if (!used.has(pk.request[2])) return finish(pk.request[2], true); }
      line = unused(pk.request[0], pk.request[1]);
      break;
    }
    case 'shares': line = unused(...pk.shares); break;
    case 'question': line = unused(...pk.question); break;
    case 'blame': line = unused(...pk.blame); break;
    case 'giveup': line = unused(pk.giveup); break;
    case 'thanks': { line = unused(pk.thanks); if (line && a.turn >= 3) return finish(`${line} ${pk.close}`, true); break; }
    case 'greeting': line = unused(pk.greet); break;
    case 'other': line = unused(...pk.other); break;
  }
  line ??= unused(...POOL[a.lang]);
  if (!line) return finish(pk.close, true); // everything has been said: end the scene gracefully
  return finish(line);
}

/** True when `text` is written mostly in the script of `lang` (a Hindi reply that comes back in English is rejected). */
export function scriptOk(text: string, lang: Lang): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return false;
  const re = lang === 'en' ? /[A-Za-z]/ : lang === 'gu' ? /[઀-૿]/ : /[ऀ-ॿ]/;
  return letters.filter((c) => re.test(c)).length / letters.length >= 0.7;
}
