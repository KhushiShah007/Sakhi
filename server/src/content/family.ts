import type { Lang } from '../config.js';

/** All family-facing content. Pending clinician review: every item carries `reviewed: false`. */
export const CARD_TYPES = ['need_space', 'overwhelmed', 'rough_night', 'take_over_dinner', 'just_sit_with_me'] as const;
export type CardType = (typeof CARD_TYPES)[number];

type L4 = Record<Lang, string>;
const L = (hi: string, mr: string, gu: string, en: string): L4 => ({ hi, mr, gu, en });

/** The ONLY text a family member ever sees about a card. Fixed, enumerated, never her words. */
export const CARD_TEXT: Record<CardType, L4> = {
  need_space: L('उन्हें अभी थोड़ी जगह चाहिए। उन्हें शांत रहने दें और सवाल न पूछें।', 'त्यांना आत्ता थोडी मोकळीक हवी आहे. त्यांना शांत राहू द्या आणि प्रश्न विचारू नका.', 'તેમને હમણાં થોડી જગ્યા જોઈએ છે. તેમને શાંત રહેવા દો અને પ્રશ્નો ન પૂછો.', 'She needs some space right now. Let her have quiet time and don\'t ask questions.'),
  overwhelmed: L('उन्हें बहुत दबाव महसूस हो रहा है। आज बिना कहे उनका एक काम आप कर दें।', 'त्यांना खूप दडपण वाटत आहे. आज न सांगता त्यांचे एक काम तुम्ही करा.', 'તેમને ખૂબ દબાણ લાગે છે. આજે કહ્યા વગર તેમનું એક કામ તમે કરી દો.', 'She is feeling overwhelmed. Take one task off her plate today, without being asked.'),
  rough_night: L('उनकी रात मुश्किल रही। सुबह शांत रखें और हो सके तो उन्हें आराम करने दें।', 'त्यांची रात्र कठीण गेली. सकाळ शांत ठेवा आणि जमल्यास त्यांना आराम करू द्या.', 'તેમની રાત મુશ્કેલ રહી. સવાર શાંત રાખો અને થઈ શકે તો તેમને આરામ કરવા દો.', 'She had a rough night. Keep the morning calm and let her rest if she can.'),
  take_over_dinner: L('आज रात का खाना आप संभाल लें। सवाल न पूछें।', 'आज रात्रीचे जेवण तुम्ही सांभाळा. प्रश्न विचारू नका.', 'આજે રાતનું જમવાનું તમે સંભાળી લો. પ્રશ્નો ન પૂછો.', 'Take over dinner tonight. Don\'t ask questions.'),
  just_sit_with_me: L('वे चाहती हैं कि आप कुछ मिनट उनके पास बैठें। सलाह नहीं, बस साथ रहें।', 'त्यांना तुम्ही काही मिनिटे त्यांच्या जवळ बसावे असे वाटते. सल्ला नको, फक्त सोबत रहा.', 'તેઓ ઇચ્છે છે કે તમે થોડી મિનિટ તેમની પાસે બેસો. સલાહ નહીં, બસ સાથે રહો.', 'She would like you to sit with her for a few minutes. No advice, just be there.'),
};

export const ALERT_TEXT: Record<'low' | 'moderate' | 'high', L4> = {
  high: L('कल: गर्मी के झोंकों (हॉट फ्लैश) का ज़्यादा जोखिम। यह अनुमान है, भविष्यवाणी नहीं।', 'उद्या: उष्णतेच्या लाटांचा (हॉट फ्लॅश) जास्त धोका. हा अंदाज आहे, भाकीत नाही.', 'આવતીકાલે: ગરમીના ઝટકા (હોટ ફ્લેશ)નું વધુ જોખમ. આ અંદાજ છે, આગાહી નથી.', 'Tomorrow: high risk of hot flashes. An estimate, not a prediction.'),
  moderate: L('कल: गर्मी के झोंकों का मध्यम जोखिम। यह अनुमान है।', 'उद्या: उष्णतेच्या लाटांचा मध्यम धोका. हा अंदाज आहे.', 'આવતીકાલે: ગરમીના ઝટકાનું મધ્યમ જોખમ. આ અંદાજ છે.', 'Tomorrow: moderate risk of hot flashes. An estimate.'),
  low: L('कल: जोखिम कम। यह अनुमान है।', 'उद्या: धोका कमी. हा अंदाज आहे.', 'આવતીકાલે: જોખમ ઓછું. આ અંદાજ છે.', 'Tomorrow: low risk. An estimate.'),
};

export interface Lesson { id: string; kind: 'say_this' | 'repair' | 'module' | 'teen_module'; title: L4; points: L4[]; reviewed: false }

export const LESSONS: Lesson[] = [
  { id: 'say-this-not-that', kind: 'say_this', reviewed: false,
    title: L('यह कहें / यह नहीं', 'हे म्हणा / हे नको', 'આ કહો / આ નહીં', 'Say this / Not that'),
    points: [
      L('कहें: "मैं देख रहा/रही हूँ कि मुश्किल है। मैं कैसे मदद करूँ?" नहीं: "बस उम्र का असर है।"', 'म्हणा: "मला दिसतंय की कठीण आहे. मी कशी मदत करू?" नको: "हा फक्त वयाचा परिणाम आहे."', 'કહો: "મને દેખાય છે કે મુશ્કેલ છે. હું કેવી રીતે મદદ કરું?" નહીં: "આ તો ફક્ત ઉંમરની અસર છે."', 'Say: "I can see this is hard. How can I help?" Not: "It\'s just your age."'),
      L('कहें: "आप चाहें तो मैं सुनूँ, या कुछ करूँ?" नहीं: "आप बढ़ा-चढ़ाकर बोल रही हैं।"', 'म्हणा: "तुम्हाला मी ऐकावे की काही करावे?" नको: "तुम्ही जास्तच करताय."', 'કહો: "તમે ઇચ્છો તો હું સાંભળું કે કંઈક કરું?" નહીં: "તમે વધારે પડતું કહો છો."', 'Say: "Would you like me to listen, or to do something?" Not: "You\'re overreacting."'),
    ] },
  { id: 'repair-flow', kind: 'repair', reviewed: false,
    title: L('बातचीत बिगड़ जाए तो', 'संवाद बिघडला तर', 'વાતચીત બગડે તો', 'After a tense moment'),
    points: [
      L('1. थोड़ा रुकें और गहरी साँस लें।', '१. थोडे थांबा आणि दीर्घ श्वास घ्या.', '1. થોડું રોકાઓ અને ઊંડો શ્વાસ લો.', '1. Pause and take a slow breath.'),
      L('2. कहें: "मुझे अफ़सोस है कि वह ऐसा लगा। मैं सुनना चाहता/चाहती हूँ।"', '२. म्हणा: "तसे वाटले याचे मला वाईट वाटते. मला ऐकायचे आहे."', '2. કહો: "એવું લાગ્યું તેનો મને અફસોસ છે. મારે સાંભળવું છે."', '2. Say: "I\'m sorry that landed badly. I want to listen."'),
      L('3. एक छोटा काम करें: चाय बनाएँ, या बस पास बैठें।', '३. एक छोटे काम करा: चहा करा, किंवा फक्त जवळ बसा.', '3. એક નાનું કામ કરો: ચા બનાવો, અથવા બસ પાસે બેસો.', '3. Do one small thing: make tea, or simply sit nearby.'),
    ] },
  { id: 'two-minute-module', kind: 'module', reviewed: false,
    title: L('2 मिनट: रजोनिवृत्ति क्या है', '२ मिनिटे: रजोनिवृत्ती म्हणजे काय', '2 મિનિટ: મેનોપોઝ શું છે', '2 minutes: what menopause is'),
    points: [
      L('रजोनिवृत्ति एक प्राकृतिक चरण है, बीमारी नहीं।', 'रजोनिवृत्ती हा नैसर्गिक टप्पा आहे, आजार नाही.', 'મેનોપોઝ એક કુદરતી તબક્કો છે, રોગ નથી.', 'Menopause is a natural stage of life, not an illness.'),
      L('गर्मी के झोंके, नींद की दिक्कत, चिड़चिड़ापन और थकान आम हैं।', 'उष्णतेच्या लाटा, झोपेचा त्रास, चिडचिड आणि थकवा हे सामान्य आहे.', 'ગરમીના ઝટકા, ઊંઘની તકલીફ, ચીડિયાપણું અને થાક સામાન્ય છે.', 'Hot flashes, poor sleep, irritability and tiredness are common.'),
      L('आपकी भूमिका: सुनें, एक काम हल्का करें, और डॉक्टर के पास जाने में साथ दें।', 'तुमची भूमिका: ऐका, एक काम हलके करा, आणि डॉक्टरांकडे जाण्यात साथ द्या.', 'તમારી ભૂમિકા: સાંભળો, એક કામ હળવું કરો, અને ડૉક્ટર પાસે જવામાં સાથ આપો.', 'Your role: listen, lighten one task, and support a doctor visit.'),
    ] },
  { id: 'teen-module', kind: 'teen_module', reviewed: false,
    title: L('माँ के लिए: किशोरों के लिए 2 मिनट', 'आईसाठी: किशोरांसाठी २ मिनिटे', 'મમ્મી માટે: કિશોરો માટે 2 મિનિટ', 'For Mum: 2 minutes for teens'),
    points: [
      L('माँ के शरीर में बदलाव हो रहे हैं। इसका मतलब यह नहीं कि वे आपसे नाराज़ हैं।', 'आईच्या शरीरात बदल होत आहेत. याचा अर्थ त्या तुमच्यावर रागावल्या आहेत असा नाही.', 'મમ્મીના શરીરમાં ફેરફારો થઈ રહ્યા છે. એનો અર્થ એ નથી કે તે તમારાથી નારાજ છે.', 'Your mum\'s body is changing. It does not mean she is upset with you.'),
      L('मदद के तरीके: अपना कमरा साफ़ करें, पानी लाएँ, उन्हें गले लगाएँ।', 'मदतीचे मार्ग: तुमची खोली आवरा, पाणी आणा, त्यांना मिठी मारा.', 'મદદના રસ્તા: તમારો રૂમ સાફ કરો, પાણી લાવો, તેમને ગળે લગાવો.', 'Ways to help: tidy your room, bring her water, give her a hug.'),
    ] },
];
