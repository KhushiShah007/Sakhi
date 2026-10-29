import type { Lang } from '../config.js';
import type { MrsBand, MrsItem, MrsSubscale } from '../safety/mrs.js';

type L4 = Record<Lang, string>;
const L = (hi: string, mr: string, gu: string, en: string): L4 => ({ hi, mr, gu, en });

/**
 * Doctor-Ready Brief wording. The doctor copy is always English; her copy uses her language.
 * EVERYTHING here is pending clinician review (see SAFETY.md). Do not mark it reviewed until a named clinician has.
 */
export const MRS_ITEM_NAME: Record<MrsItem, L4> = {
  hot_flushes: L('हॉट फ़्लैश, पसीना', 'हॉट फ्लॅश, घाम', 'હોટ ફ્લેશ, પરસેવો', 'Hot flushes, sweating'),
  heart_discomfort: L('दिल में बेचैनी', 'हृदयात अस्वस्थता', 'હૃદયમાં અસ્વસ્થતા', 'Heart discomfort'),
  sleep: L('नींद की समस्या', 'झोपेच्या समस्या', 'ઊંઘની સમસ્યા', 'Sleep problems'),
  joint_muscle: L('जोड़ों और मांसपेशियों की तकलीफ़', 'सांधे व स्नायूंचा त्रास', 'સાંધા અને સ્નાયુની તકલીફ', 'Joint and muscular discomfort'),
  depressive_mood: L('उदास मन', 'उदास मन', 'ઉદાસ મન', 'Depressive mood'),
  irritability: L('चिड़चिड़ापन', 'चिडचिड', 'ચીડિયાપણું', 'Irritability'),
  anxiety: L('घबराहट', 'अस्वस्थता', 'ગભરાટ', 'Anxiety'),
  exhaustion: L('शारीरिक व मानसिक थकान', 'शारीरिक व मानसिक थकवा', 'શારીરિક અને માનસિક થાક', 'Physical and mental exhaustion'),
  sexual: L('यौन समस्याएँ', 'लैंगिक समस्या', 'જાતીય સમસ્યાઓ', 'Sexual problems'),
  bladder: L('मूत्राशय की समस्या', 'मूत्राशयाच्या समस्या', 'મૂત્રાશયની સમસ્યા', 'Bladder problems'),
  vaginal_dryness: L('योनि में रूखापन', 'योनीमार्गात कोरडेपणा', 'યોનિમાં શુષ્કતા', 'Dryness of vagina'),
};
export const SUBSCALE_NAME: Record<MrsSubscale, L4> = {
  somatic: L('शारीरिक', 'शारीरिक', 'શારીરિક', 'Somatic'),
  psychological: L('मानसिक', 'मानसिक', 'માનસિક', 'Psychological'),
  urogenital: L('मूत्र-जनन', 'मूत्र-जनन', 'મૂત્ર-જનન', 'Urogenital'),
};
export const BAND_NAME: Record<MrsBand, L4> = {
  none: L('कोई नहीं या बहुत कम', 'नाही किंवा अत्यल्प', 'નથી કે ખૂબ ઓછું', 'None or little'),
  mild: L('हल्का', 'सौम्य', 'હળવું', 'Mild'),
  moderate: L('मध्यम', 'मध्यम', 'મધ્યમ', 'Moderate'),
  severe: L('गंभीर', 'तीव्र', 'તીવ્ર', 'Severe'),
};
export const STAGE_NAME: Record<string, L4> = {
  perimenopause: L('पेरिमेनोपॉज़ (स्वयं बताया)', 'पेरिमेनोपॉज (स्वतः सांगितले)', 'પેરિમેનોપોઝ (જાતે જણાવ્યું)', 'Perimenopause (self-reported)'),
  menopause: L('रजोनिवृत्ति (स्वयं बताया)', 'रजोनिवृत्ती (स्वतः सांगितले)', 'મેનોપોઝ (જાતે જણાવ્યું)', 'Menopause (self-reported)'),
  surgical_early: L('सर्जिकल / जल्दी रजोनिवृत्ति (स्वयं बताया)', 'शस्त्रक्रियेनंतर / लवकर रजोनिवृत्ती (स्वतः सांगितले)', 'સર્જિકલ / વહેલું મેનોપોઝ (જાતે જણાવ્યું)', 'Surgical / early menopause (self-reported)'),
  no_family: L('रजोनिवृत्ति का दौर (स्वयं बताया)', 'रजोनिवृत्तीचा टप्पा (स्वतः सांगितले)', 'મેનોપોઝનો તબક્કો (જાતે જણાવ્યું)', 'Menopause transition (self-reported)'),
};
export const TRIGGER_NAME: Record<string, L4> = {
  stress: L('तनाव', 'ताण', 'તણાવ', 'Stress'), heat: L('गर्मी', 'उष्णता', 'ગરમી', 'Heat'), food: L('खाना या चाय', 'खाणेपिणे', 'ખાવાપીવું', 'Food or drink'),
  sleep: L('नींद की कमी', 'झोपेची कमतरता', 'ઊંઘની ખોટ', 'Lack of sleep'), family: L('परिवार', 'कुटुंब', 'પરિવાર', 'Family'), work: L('काम', 'काम', 'કામ', 'Work'),
};
export const TIME_PHRASE: Record<string, L4> = {
  morning: L('सुबह', 'सकाळी', 'સવારે', 'in the morning'), afternoon: L('दोपहर', 'दुपारी', 'બપોરે', 'in the afternoon'),
  evening: L('शाम', 'संध्याकाळी', 'સાંજે', 'in the evening'), night: L('रात', 'रात्री', 'રાત્રે', 'at night'),
};

export const RULE_OUT_TEXT: Record<string, { q: L4; because: L4 }> = {
  thyroid: { q: L('क्या हमें थायरॉइड (TSH) की जाँच करनी चाहिए?', 'थायरॉईड (TSH) तपासावे का?', 'શું આપણે થાઇરોઇડ (TSH) તપાસવું જોઈએ?', 'Should we check thyroid function (TSH)?'),
    because: L('थकान, मूड में बदलाव, गर्मी और धड़कन थायरॉइड की स्थितियों से मिलते-जुलते हैं।', 'थकवा, मूडमधील बदल, उष्णता आणि धडधड थायरॉईडच्या स्थितींशी मिळतेजुळते आहेत.', 'થાક, મૂડમાં ફેરફાર, ગરમી અને ધબકારા થાઇરોઇડની સ્થિતિ સાથે મળતા આવે છે.', 'Tiredness, mood change, heat and palpitations overlap with thyroid conditions.') },
  anaemia: { q: L('क्या हमें एनीमिया के लिए हीमोग्लोबिन और आयरन की जाँच करनी चाहिए?', 'ॲनिमियासाठी हिमोग्लोबिन आणि लोह तपासावे का?', 'શું એનિમિયા માટે હિમોગ્લોબિન અને આયર્ન તપાસવા જોઈએ?', 'Should we check haemoglobin and iron levels for anaemia?'),
    because: L('थकान और धड़कन के एक से ज़्यादा कारण हो सकते हैं।', 'थकवा आणि धडधडीची एकापेक्षा जास्त कारणे असू शकतात.', 'થાક અને ધબકારાનાં એક કરતાં વધુ કારણ હોઈ શકે.', 'Tiredness and palpitations can have more than one cause.') },
  vitamin_d: { q: L('क्या हमें विटामिन D की जाँच करनी चाहिए?', 'व्हिटॅमिन D तपासावे का?', 'શું વિટામિન D તપાસવું જોઈએ?', 'Should we check vitamin D?'),
    because: L('जोड़ों या मांसपेशियों का दर्द और थकान कम विटामिन D से जुड़ सकते हैं।', 'सांधे-स्नायूंचे दुखणे आणि थकवा कमी व्हिटॅमिन D शी संबंधित असू शकतात.', 'સાંધા કે સ્નાયુનો દુખાવો અને થાક ઓછા વિટામિન D સાથે જોડાયેલા હોઈ શકે.', 'Joint or muscle aches and tiredness can be linked to low vitamin D.') },
  depression_screen: { q: L('क्या हमें अवसाद और चिंता की जाँच (जैसे PHQ-9 / GAD-7) करनी चाहिए?', 'नैराश्य आणि चिंतेची तपासणी (उदा. PHQ-9 / GAD-7) करावी का?', 'શું ડિપ્રેશન અને ચિંતાની તપાસ (દા.ત. PHQ-9 / GAD-7) કરવી જોઈએ?', 'Should we do a depression and anxiety screen (for example PHQ-9 / GAD-7)?'),
    because: L('इस दौर में उदासी और चिंता आम हैं और इन्हें ठीक से जाँचना अच्छा है।', 'या टप्प्यात उदासी आणि चिंता सामान्य आहेत आणि त्या नीट तपासणे चांगले.', 'આ તબક્કામાં ઉદાસી અને ચિંતા સામાન્ય છે અને તેને બરાબર તપાસવી સારી.', 'Low mood and anxiety are common in this phase and are worth checking properly.') },
  sleep_review: { q: L('क्या हमें देखना चाहिए कि नींद में क्या बाधा डाल रहा है (रात का पसीना, मूड, अन्य कारण)?', 'झोपेत काय अडथळा आणत आहे (रात्रीचा घाम, मूड, इतर कारणे) ते तपासावे का?', 'શું ઊંઘમાં શું ખલેલ પાડે છે (રાત્રે પરસેવો, મૂડ, અન્ય કારણો) તે જોવું જોઈએ?', 'Should we review what is disturbing sleep (night sweats, mood, other causes)?'),
    because: L('नींद की गंभीर दिक्कत बताई गई है।', 'झोपेचा त्रास जास्त प्रमाणात नोंदवला गेला.', 'ઊંઘની તકલીફ વધુ પ્રમાણમાં નોંધાઈ છે.', 'Poor sleep was reported at a high level.') },
  urine_check: { q: L('क्या हमें मूत्र संक्रमण या मूत्राशय के अन्य कारणों की जाँच करनी चाहिए?', 'लघवीचा संसर्ग किंवा मूत्राशयाची इतर कारणे तपासावीत का?', 'શું પેશાબના ચેપ કે મૂત્રાશયના અન્ય કારણો તપાસવા જોઈએ?', 'Should we check for a urinary infection or other bladder causes?'),
    because: L('मूत्राशय के लक्षणों के कई संभावित कारण होते हैं।', 'मूत्राशयाच्या लक्षणांची अनेक संभाव्य कारणे असतात.', 'મૂત્રાશયના લક્ષણોનાં અનેક સંભવિત કારણો હોય છે.', 'Bladder symptoms have several possible causes.') },
  bleeding_review: { q: L('क्या हमें जाँच करके रक्तस्राव का कारण देखना चाहिए?', 'तपासणी करून रक्तस्रावाचे कारण पाहावे का?', 'શું તપાસ કરીને રક્તસ્રાવનું કારણ જોવું જોઈએ?', 'Should we look into the bleeding with an examination?'),
    because: L('मेनोपॉज़ के बाद या बहुत ज़्यादा खून आने पर डॉक्टर को देखना ज़रूरी है।', 'मेनोपॉजनंतर किंवा खूप जास्त रक्तस्राव झाल्यास डॉक्टरांनी पाहणे आवश्यक आहे.', 'મેનોપોઝ પછી કે ખૂબ વધારે લોહી નીકળે તો ડૉક્ટરે જોવું જરૂરી છે.', 'Bleeding after menopause or very heavy bleeding needs a doctor to look.') },
};

export const NEXT20_TEXT: Record<string, { title: L4; action: L4 }> = {
  bone: { title: L('हड्डियों की सेहत', 'हाडांचे आरोग्य', 'હાડકાંનું સ્વાસ્થ્ય', 'Bone health'),
    action: L('पूछें कि हड्डियों की जाँच (DEXA) आपके लिए ठीक रहेगी या नहीं, और कैल्शियम व विटामिन D के बारे में।', 'DEXA स्कॅन तुमच्यासाठी योग्य आहे का, आणि कॅल्शियम व व्हिटॅमिन D बद्दल विचारा.', 'DEXA સ્કેન તમારા માટે યોગ્ય છે કે નહીં, અને કેલ્શિયમ તથા વિટામિન D વિશે પૂછો.', 'Ask whether a bone density (DEXA) scan makes sense for you, and about calcium and vitamin D.') },
  heart: { title: L('दिल की सेहत', 'हृदयाचे आरोग्य', 'હૃદયનું સ્વાસ્થ્ય', 'Heart health'),
    action: L('हर साल ब्लड प्रेशर, कोलेस्ट्रॉल और शुगर की जाँच के बारे में पूछें।', 'दरवर्षी रक्तदाब, कोलेस्टेरॉल आणि साखर तपासण्याबद्दल विचारा.', 'દર વર્ષે બ્લડ પ્રેશર, કોલેસ્ટ્રોલ અને સુગર તપાસવા વિશે પૂછો.', 'Ask about checking blood pressure, cholesterol and blood sugar every year.') },
  strength: { title: L('ताकत की कसरत', 'ताकदीचा व्यायाम', 'તાકાતની કસરત', 'Strength exercise'),
    action: L('टहलने के साथ हफ़्ते में 2 दिन आसान ताकत की कसरत हड्डियों और मूड के लिए अच्छी है। असमंजस हो तो पहले डॉक्टर से पूछें।', 'चालण्यासोबत आठवड्यातून 2 दिवस सोपा ताकदीचा व्यायाम हाडांसाठी आणि मूडसाठी चांगला. शंका असल्यास आधी डॉक्टरांना विचारा.', 'ચાલવા સાથે અઠવાડિયે 2 દિવસ સરળ તાકાતની કસરત હાડકાં અને મૂડ માટે સારી. શંકા હોય તો પહેલા ડૉક્ટરને પૂછો.', 'Walking plus 2 days a week of simple strength exercise helps bones and mood. Check with your doctor first if unsure.') },
  screening: { title: L('जाँच की याद', 'तपासणी स्मरण', 'તપાસની યાદ', 'Screening reminders'),
    action: L('पूछें कि सर्विक्स, स्तन और हड्डी की अगली जाँच कब होनी है।', 'गर्भाशयमुख, स्तन आणि हाडांची पुढील तपासणी कधी आहे ते विचारा.', 'ગર્ભાશયમુખ, સ્તન અને હાડકાંની આગામી તપાસ ક્યારે છે તે પૂછો.', 'Ask when your next cervical, breast and bone screening is due.') },
};

export const QUESTIONS: L4[] = [
  L('क्या ये लक्षण रजोनिवृत्ति के दौर से मेल खाते हैं, या हमें दूसरे कारण भी देखने चाहिए?', 'ही लक्षणे रजोनिवृत्तीच्या टप्प्याशी जुळतात का, की इतर कारणे शोधावीत?', 'આ લક્ષણો મેનોપોઝના તબક્કા સાથે મેળ ખાય છે, કે બીજા કારણો શોધવા જોઈએ?', 'Are these symptoms consistent with the menopause transition, or should we look for other causes?'),
  L('जो लक्षण मुझे सबसे ज़्यादा परेशान करते हैं, उनके लिए क्या विकल्प हैं?', 'मला सर्वात जास्त त्रास देणाऱ्या लक्षणांसाठी कोणते पर्याय आहेत?', 'મને સૌથી વધુ પરેશાન કરતા લક્ષણો માટે કયા વિકલ્પો છે?', 'What options are there for the symptoms that bother me most?'),
  L('इस साल मुझे कौन-सी जाँचें और स्क्रीनिंग करानी चाहिए?', 'या वर्षी मी कोणत्या तपासण्या आणि स्क्रीनिंग करून घ्यावीत?', 'આ વર્ષે મારે કઈ તપાસ અને સ્ક્રીનિંગ કરાવવી જોઈએ?', 'Which health checks and screenings should I schedule this year?'),
];

export const HIGHLIGHT = {
  hot: L('{d} में से {n} दिन हॉट फ़्लैश या रात का पसीना{when}', '{d} पैकी {n} दिवस हॉट फ्लॅश किंवा रात्रीचा घाम{when}', '{d} માંથી {n} દિવસ હોટ ફ્લેશ કે રાત્રે પરસેવો{when}', 'Hot flushes or night sweats on {n} of {d} days{when}'),
  when: L(', ज़्यादातर {time}', ', बहुतेक वेळा {time}', ', મોટે ભાગે {time}', ', mostly {time}'),
  sleep: L('{n} दिन ख़राब नींद या रात को नींद खुलना', '{n} दिवस अपुरी झोप किंवा रात्री जाग येणे', '{n} દિવસ ખરાબ ઊંઘ કે રાત્રે ઊંઘ ઊડી જવી', 'Poor sleep or waking at night on {n} days'),
  pain: L('{n} दिन जोड़ों या मांसपेशियों में दर्द', '{n} दिवस सांधे किंवा स्नायूंचे दुखणे', '{n} દિવસ સાંધા કે સ્નાયુનો દુખાવો', 'Joint or muscle pain on {n} days'),
  mood: L('{n} दिन उदासी या घबराहट', '{n} दिवस उदासी किंवा अस्वस्थता', '{n} દિવસ ઉદાસી કે ગભરાટ', 'Low mood or anxiety on {n} days'),
  trigger: L('सबसे ज़्यादा बताया गया कारण: {t}', 'सर्वात जास्त नोंदवलेले कारण: {t}', 'સૌથી વધુ નોંધાયેલું કારણ: {t}', 'Most often noted trigger: {t}'),
  few: L('अभी सिर्फ़ {n} दिन के चेक-इन हैं, इसलिए तस्वीर अधूरी हो सकती है।', 'अजून फक्त {n} दिवसांचे चेक-इन आहेत, त्यामुळे चित्र अपूर्ण असू शकते.', 'હજી ફક્ત {n} દિવસના ચેક-ઇન છે, તેથી ચિત્ર અધૂરું હોઈ શકે.', 'Only {n} days of check-ins so far, so this picture may be incomplete.'),
};

export const HEAD = {
  title: L('डॉक्टर-रेडी ब्रीफ़', 'डॉक्टर-रेडी ब्रीफ', 'ડૉક્ટર-રેડી બ્રીફ', 'Doctor-Ready Brief'),
  mrs: L('मेनोपॉज़ रेटिंग स्केल (MRS)', 'मेनोपॉज रेटिंग स्केल (MRS)', 'મેનોપોઝ રેટિંગ સ્કેલ (MRS)', 'Menopause Rating Scale (MRS)'),
  timeline: L('लक्षणों की समयरेखा (पिछले 4 हफ़्ते)', 'लक्षणांची कालरेषा (मागील 4 आठवडे)', 'લક્ષણોની સમયરેખા (છેલ્લા 4 અઠવાડિયા)', 'Symptom timeline (last 4 weeks)'),
  ruleOut: L('कृपया इनकी जाँच में मदद करें', 'कृपया यांची तपासणी करण्यास मदत करा', 'કૃપા કરીને આની તપાસમાં મદદ કરો', 'Please help rule out'),
  questions: L('मैं ये सवाल पूछना चाहूँगी', 'मला हे प्रश्न विचारायचे आहेत', 'હું આ પ્રશ્નો પૂછવા માગું છું', 'Questions I would like to ask'),
  next20: L('अगले 20 साल', 'पुढील 20 वर्षे', 'આગામી 20 વર્ષ', 'The next 20 years'),
  next20Sub: L('रोकथाम पर चर्चा के बिंदु', 'प्रतिबंधासाठी चर्चेचे मुद्दे', 'નિવારણ પર ચર્ચાના મુદ્દા', 'Prevention points to discuss'),
  source: L('स्रोत: उनके अपने पुष्टि किए हुए वॉइस चेक-इन (लक्षण, तीव्रता, समय, कारण)।', 'स्रोत: त्यांचे स्वतः पुष्टी केलेले व्हॉइस चेक-इन (लक्षण, तीव्रता, वेळ, कारण).', 'સ્રોત: તેમના પોતાના પુષ્ટિ કરેલા વૉઇસ ચેક-ઇન (લક્ષણ, તીવ્રતા, સમય, કારણ).', 'Source: her own confirmed voice check-ins (symptom, severity, time, trigger).'),
  footer: L('सहायक है, निदान नहीं। जाँच-सुझाव और रोकथाम के बिंदु चिकित्सक समीक्षा के लिए लंबित हैं।', 'सहाय्यक आहे, निदान नाही. तपासणी-सूचना आणि प्रतिबंधाचे मुद्दे वैद्यकीय तज्ज्ञांच्या समीक्षेसाठी प्रलंबित आहेत.', 'સહાયક છે, નિદાન નથી. તપાસ-સૂચનો અને નિવારણના મુદ્દા ચિકિત્સક સમીક્ષા માટે બાકી છે.', 'Supportive, not diagnostic. Rule-out questions and prevention points are pending clinician review.'),
  period: L('अवधि', 'कालावधी', 'સમયગાળો', 'Period'),
  checkins: L('{n} दिन के चेक-इन', '{n} दिवसांचे चेक-इन', '{n} દિવસના ચેક-ઇન', '{n} days of check-ins'),
  total: L('कुल', 'एकूण', 'કુલ', 'Total'),
};

export const L4t = (m: L4, lang: Lang) => m[lang];
export const fill = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, String(v)), s);
