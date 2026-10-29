import type { Lang } from '../config.js';
import type { CardType } from './family.js';
import type { Symptom } from '../safety/mrs.js';

export type Tone = 'gentle' | 'direct' | 'light';
export const TONES: Tone[] = ['gentle', 'direct', 'light'];

type L4 = Record<Lang, string>;
const L = (hi: string, mr: string, gu: string, en: string): L4 => ({ hi, mr, gu, en });

/**
 * "Say it for me": one calm first-person sentence per signal and tone. Fixed library (pending clinician review).
 * It is for HER to play aloud or copy. The family channel only ever carries the enumerated Signal Card.
 */
export const SENTENCES: Record<CardType, Record<Tone, L4>> = {
  need_space: {
    gentle: L('मेरा मन थोड़ा भारी है और मुझे थोड़ी शांति चाहिए। यह आपके बारे में नहीं है, मैं जल्दी लौटूँगी।', 'माझे मन जड झालेय आणि मला थोडी शांतता हवी आहे. हे तुमच्याबद्दल नाही, मी लवकर परत येईन.', 'મારું મન થોડું ભારે છે અને મને થોડી શાંતિ જોઈએ છે. આ તમારા વિશે નથી, હું જલ્દી પાછી આવીશ.', "I'm having a hard moment and need a little quiet. It isn't about you, and I'll be back soon."),
    direct: L('मुझे अभी थोड़ी जगह चाहिए। कृपया सवाल न पूछें।', 'मला आत्ता थोडी मोकळीक हवी आहे. कृपया प्रश्न विचारू नका.', 'મને હમણાં થોડી જગ્યા જોઈએ છે. કૃપા કરીને પ્રશ્નો ન પૂછો.', "I need some space right now. Please don't ask questions."),
    light: L('मेरा छोटा-सा ब्रेक। थोड़ी देर में लौटती हूँ।', 'माझा छोटासा ब्रेक. थोड्याच वेळात येते.', 'મારો નાનો બ્રેક. થોડી વારમાં આવું છું.', 'Tiny timeout for me. Back soon, promise.'),
  },
  overwhelmed: {
    gentle: L('आज मुझे सब कुछ बहुत भारी लग रहा है। क्या आप मेरा एक काम ले सकते हैं?', 'आज मला सगळे खूप जड वाटतेय. तुम्ही माझे एखादे काम घेऊ शकाल का?', 'આજે મને બધું બહુ ભારે લાગે છે. શું તમે મારું એક કામ લઈ શકો?', "I'm feeling overwhelmed today. Could you take one thing off my plate?"),
    direct: L('मैं बहुत दबाव में हूँ। आज मेरा एक काम आप संभाल लीजिए।', 'मी खूप दडपणाखाली आहे. आज माझे एक काम तुम्ही सांभाळा.', 'હું બહુ દબાણમાં છું. આજે મારું એક કામ તમે સંભાળી લો.', "I'm overwhelmed. I need you to take over one task today."),
    light: L('आज मेरी टू-डू लिस्ट जीत गई। एक काम आप ले लेंगे?', 'आज माझ्या टू-डू लिस्टने बाजी मारली. एक काम तुम्ही घ्याल?', 'આજે મારી ટુ-ડૂ લિસ્ટ જીતી ગઈ. એક કામ તમે લેશો?', 'My to-do list won today. Can you take one thing for me?'),
  },
  rough_night: {
    gentle: L('कल रात मुश्किल रही और मैं थकी हूँ। सुबह शांत रहे तो मुझे बहुत मदद मिलेगी।', 'काल रात्र कठीण गेली आणि मी थकलेय. सकाळ शांत राहिली तर मला खूप मदत होईल.', 'ગઈ રાત મુશ્કેલ રહી અને હું થાકી છું. સવાર શાંત રહે તો મને બહુ મદદ મળશે.', "I had a rough night and I'm tired. A calm morning would help me a lot."),
    direct: L('मैं ठीक से सो नहीं पाई। कृपया सुबह शांत रखें।', 'मला नीट झोप लागली नाही. कृपया सकाळ शांत ठेवा.', 'હું બરાબર ઊંઘી નથી. કૃપા કરીને સવાર શાંત રાખો.', 'I slept badly. Please keep the morning calm.'),
    light: L('रात की शिफ़्ट अच्छी नहीं रही। सुबह आराम से, प्लीज़।', 'रात्रीची शिफ्ट काही जमली नाही. सकाळ निवांत, प्लीज.', 'રાતની શિફ્ટ સારી ન રહી. સવાર આરામથી, પ્લીઝ.', "Night shift didn't go well. Easy morning, please."),
  },
  take_over_dinner: {
    gentle: L('आज रात मुझसे खाना नहीं बन पाएगा। क्या आप संभाल लेंगे? मेरे लिए बहुत मायने रखेगा।', 'आज रात्री मला जेवण जमणार नाही. तुम्ही सांभाळाल का? माझ्यासाठी खूप महत्त्वाचे असेल.', 'આજે રાત્રે મારાથી રસોઈ નહીં થાય. તમે સંભાળી લેશો? મારા માટે બહુ મહત્વનું હશે.', "I'm not up to cooking tonight. Could you take care of dinner? It would mean a lot."),
    direct: L('कृपया आज रात का खाना आप संभाल लें। सवाल नहीं।', 'कृपया आज रात्रीचे जेवण तुम्ही सांभाळा. प्रश्न नको.', 'કૃપા કરીને આજે રાતનું જમવાનું તમે સંભાળી લો. પ્રશ્નો નહીં.', 'Please take over dinner tonight. No questions.'),
    light: L('आज मेरी रसोई की छुट्टी। खाना आपके ज़िम्मे!', 'आज माझ्या स्वयंपाकघराला सुट्टी. जेवण तुमच्याकडे!', 'આજે મારા રસોડાની રજા. જમવાનું તમારા હવાલે!', "Kitchen's closed for me tonight. Dinner's yours!"),
  },
  just_sit_with_me: {
    gentle: L('मुझे अच्छा लगेगा अगर आप कुछ मिनट मेरे पास बैठें। कुछ कहने की ज़रूरत नहीं।', 'तुम्ही काही मिनिटे माझ्याजवळ बसलात तर मला छान वाटेल. काही बोलायची गरज नाही.', 'તમે થોડી મિનિટ મારી પાસે બેસો તો મને ગમશે. કંઈ બોલવાની જરૂર નથી.', "I'd love it if you sat with me for a few minutes. You don't need to say anything."),
    direct: L('कृपया कुछ मिनट मेरे पास बैठें। सलाह नहीं चाहिए।', 'कृपया काही मिनिटे माझ्याजवळ बसा. सल्ला नको.', 'કૃપા કરીને થોડી મિનિટ મારી પાસે બેસો. સલાહ નહીં.', 'Please sit with me for a few minutes. No advice.'),
    light: L('मेरे पास आकर बैठेंगे? मुफ़्त साथ, बिना सलाह।', 'माझ्याजवळ येऊन बसाल? फुकट सोबत, सल्ल्याशिवाय.', 'મારી પાસે આવીને બેસશો? મફત સાથ, સલાહ વગર.', 'Come sit with me? Free company, no advice.'),
  },
};

/** Picks the enumerated card that best fits what she described. Pure and explainable. */
const WEIGHTS: Partial<Record<Symptom, Partial<Record<CardType, number>>>> = {
  poor_sleep: { rough_night: 2 }, night_waking: { rough_night: 2 }, night_sweats: { rough_night: 2 },
  irritability: { need_space: 2 }, anxiety: { need_space: 2, overwhelmed: 1 }, palpitations: { need_space: 1 },
  brain_fog: { overwhelmed: 2 }, low_mood: { overwhelmed: 1, just_sit_with_me: 2 }, low_desire: { just_sit_with_me: 1 },
  fatigue: { take_over_dinner: 2 }, hot_flash: { take_over_dinner: 1 }, joint_pain: { take_over_dinner: 1 }, muscle_ache: { take_over_dinner: 1 },
};
const ORDER: CardType[] = ['rough_night', 'need_space', 'overwhelmed', 'take_over_dinner', 'just_sit_with_me'];
export function suggestCard(symptoms: Symptom[]): CardType {
  const score = new Map<CardType, number>();
  for (const s of symptoms) for (const [c, w] of Object.entries(WEIGHTS[s] ?? {})) score.set(c as CardType, (score.get(c as CardType) ?? 0) + (w as number));
  const best = [...score.entries()].sort((a, b) => b[1] - a[1] || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))[0];
  return best?.[0] ?? 'need_space';
}
