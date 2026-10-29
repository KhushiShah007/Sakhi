import type { Lang } from '../config.js';
import type { Symptom } from '../safety/mrs.js';

type L4 = Record<Lang, string>;
const L = (hi: string, mr: string, gu: string, en: string): L4 => ({ hi, mr, gu, en });

/** Letter to Myself wording. Strengths-based, never diagnostic, never quotes her words. Pending clinician review. */
export const SYMPTOM_NAME: Record<Symptom, L4> = {
  hot_flash: L('हॉट फ़्लैश', 'हॉट फ्लॅश', 'હોટ ફ્લેશ', 'hot flashes'), night_sweats: L('रात का पसीना', 'रात्रीचा घाम', 'રાત્રે પરસેવો', 'night sweats'),
  palpitations: L('दिल की तेज़ धड़कन', 'हृदयाची धडधड', 'ધબકારા વધવા', 'a racing heart'), poor_sleep: L('ख़राब नींद', 'अपुरी झोप', 'ખરાબ ઊંઘ', 'poor sleep'),
  night_waking: L('रात को नींद खुलना', 'रात्री जाग येणे', 'રાત્રે ઊંઘ ઊડી જવી', 'waking at night'), joint_pain: L('जोड़ों में दर्द', 'सांधेदुखी', 'સાંધાનો દુખાવો', 'joint pain'),
  muscle_ache: L('बदन दर्द', 'अंगदुखी', 'શરીરનો દુખાવો', 'muscle aches'), low_mood: L('उदासी', 'उदासी', 'ઉદાસી', 'low mood'),
  irritability: L('चिड़चिड़ापन', 'चिडचिड', 'ચીડિયાપણું', 'irritability'), anxiety: L('घबराहट', 'अस्वस्थता', 'ગભરાટ', 'anxiety'),
  fatigue: L('थकान', 'थकवा', 'થાક', 'tiredness'), brain_fog: L('दिमागी धुंध', 'विसरभोळेपणा', 'યાદશક્તિમાં ધુમ્મસ', 'brain fog'),
  low_desire: L('इच्छा में कमी', 'इच्छा कमी', 'ઇચ્છામાં ઘટાડો', 'low desire'), bladder_urgency: L('बार-बार पेशाब', 'वारंवार लघवी', 'વારંવાર પેશાબ', 'bladder urgency'),
  vaginal_dryness: L('योनि में रूखापन', 'योनीमार्गात कोरडेपणा', 'યોનિમાં શુષ્કતા', 'vaginal dryness'), headache: L('सिरदर्द', 'डोकेदुखी', 'માથાનો દુખાવો', 'headaches'),
};

export const LETTER = {
  greeting: L('प्रिय {name},', 'प्रिय {name},', 'પ્રિય {name},', 'Dear {name},'),
  checkins: L('इस महीने आपने {n} दिन अपना हाल बताया। इस तरह अपना ख़याल रखना मेहनत है, और यह मायने रखता है।', 'या महिन्यात तुम्ही {n} दिवस आपले हाल सांगितले. असे स्वतःची काळजी घेणे कष्टाचे आहे, आणि ते महत्त्वाचे आहे.', 'આ મહિને તમે {n} દિવસ તમારી વાત કહી. આ રીતે પોતાની સંભાળ રાખવી મહેનત માગે છે, અને તે મહત્વનું છે.', 'This month you checked in on {n}. Looking after yourself like this takes effort, and it counts.'),
  none: L('इस महीने आपने बात नहीं की, और यह ठीक है। जब भी आप तैयार हों, मैं यहाँ हूँ।', 'या महिन्यात तुम्ही बोलला नाहीत, आणि हे ठीक आहे. तुम्ही तयार असाल तेव्हा मी इथे आहे.', 'આ મહિને તમે વાત ન કરી, અને એ ઠીક છે. તમે તૈયાર હો ત્યારે હું અહીં છું.', 'You did not check in this month, and that is okay. Whenever you are ready, I am here.'),
  noticed: L('आपके शरीर ने सबसे ज़्यादा इनके बारे में कहा: {list}। इन्हें नाम देना समझे जाने की पहली सीढ़ी है।', 'तुमच्या शरीराने सर्वात जास्त याबद्दल सांगितले: {list}. याला नाव देणे समजून घेतले जाण्याची पहिली पायरी आहे.', 'તમારા શરીરે સૌથી વધુ આના વિશે કહ્યું: {list}. તેને નામ આપવું એ સમજાવાનું પહેલું પગલું છે.', 'Your body spoke most about {list}. Naming it is the first step to being understood.'),
  trigger: L('सबसे ज़्यादा {t} को मुश्किल बढ़ाने वाली बात के रूप में बताया गया।', 'सर्वात जास्त {t} हे त्रास वाढवणारे म्हणून नोंदवले गेले.', 'સૌથી વધુ {t} ને તકલીફ વધારનાર તરીકે નોંધવામાં આવ્યું.', '{t} came up most often as something that makes it harder.'),
  family: L('आपने अपने लोगों तक {k} बार हाथ बढ़ाया, और उन्होंने {d} बार जवाब दिया। आप यह अकेले नहीं उठा रहीं।', 'तुम्ही तुमच्या माणसांपर्यंत {k} वेळा हात पुढे केला, आणि त्यांनी {d} वेळा प्रतिसाद दिला. तुम्ही हे एकट्या उचलत नाही.', 'તમે તમારા લોકો સુધી {k} વાર હાથ લંબાવ્યો, અને તેમણે {d} વાર જવાબ આપ્યો. તમે આ એકલા નથી ઉપાડતા.', 'You reached out to your people {k} times, and they answered {d} of them. You are not carrying this alone.'),
  better: L('महीने का दूसरा हिस्सा पहले से हल्का रहा। यह ध्यान देने लायक है।', 'महिन्याचा दुसरा भाग पहिल्यापेक्षा हलका होता. हे लक्षात घेण्यासारखे आहे.', 'મહિનાનો બીજો ભાગ પહેલા કરતાં હળવો રહ્યો. આ નોંધવા જેવું છે.', 'The second half of the month was lighter than the first. That is worth noticing.'),
  steady: L('कुछ हफ़्ते दूसरों से भारी होते हैं। यह इस दौर का हिस्सा है, आपकी कमी नहीं।', 'काही आठवडे इतरांपेक्षा जड असतात. हा या टप्प्याचा भाग आहे, तुमची कमतरता नाही.', 'કેટલાક અઠવાડિયા બીજા કરતાં ભારે હોય છે. આ આ તબક્કાનો ભાગ છે, તમારી ખામી નથી.', 'Some weeks are heavier than others. That is part of this season, not a failing.'),
  close: L('अपने साथ उतनी ही नरमी रखिए जितनी किसी प्यारी सहेली के साथ रखतीं।', 'स्वतःशी तितकेच मृदू राहा जितके एखाद्या लाडक्या मैत्रिणीशी राहाल.', 'પોતાની સાથે એટલા જ નરમ રહો જેટલા કોઈ વહાલી સખી સાથે રહો.', 'Be as kind to yourself as you would be to a dear friend.'),
  sign: L('— सखी', '— सखी', '— સખી', '— Sakhi'),
};
