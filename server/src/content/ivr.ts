import type { Lang } from '../config.js';
type L4 = Record<Lang, string>;
const L = (hi: string, mr: string, gu: string, en: string): L4 => ({ hi, mr, gu, en });

/** What the missed-call line says. Fixed wording (pending clinician review). Short sentences: it is heard, not read. */
export const IVR = {
  intro: L('नमस्ते, मैं सखी हूँ। चलिए, साथ में साँस लेते हैं।', 'नमस्कार, मी सखी. चला, एकत्र श्वास घेऊया.', 'નમસ્તે, હું સખી છું. ચાલો, સાથે શ્વાસ લઈએ.', 'Hello, this is Sakhi. Let us breathe together.'),
  shoulders: L('कंधे ढीले छोड़ें।', 'खांदे सैल सोडा.', 'ખભા ઢીલા છોડો.', 'Let your shoulders drop.'),
  in: L('साँस अंदर।', 'श्वास घ्या.', 'શ્વાસ લો.', 'Breathe in.'),
  hold: L('हल्का रोकें।', 'हलकं थांबा.', 'હળવું રોકો.', 'Hold softly.'),
  out: L('साँस बाहर, धीरे-धीरे।', 'श्वास सोडा, हळूहळू.', 'શ્વાસ છોડો, ધીમે ધીમે.', 'Breathe out, slowly.'),
  prompt: L('अब बताइए, आप कैसा महसूस कर रही हैं? बीप के बाद बोलें।', 'आता सांगा, तुम्हाला कसे वाटते? बीपनंतर बोला.', 'હવે કહો, તમને કેવું લાગે છે? બીપ પછી બોલો.', 'Now tell me, how are you feeling? Speak after the beep.'),
  heard: L('मैंने सुना: {list}।', 'मी ऐकले: {list}.', 'મેં સાંભળ્યું: {list}.', 'I heard: {list}.'),
  nothing: L('मुझे कोई ख़ास लक्षण समझ नहीं आया, पर आपकी बात मायने रखती है।', 'मला विशेष लक्षण समजले नाही, पण तुमचे म्हणणे महत्त्वाचे आहे.', 'મને કોઈ ખાસ લક્ષણ સમજાયું નથી, પણ તમારી વાત મહત્વની છે.', 'I did not catch a particular symptom, but what you said matters.'),
  notSaved: L('अभी कुछ भी सहेजा नहीं गया है। सहेजने के लिए सखी ऐप खोलकर पक्का करें।', 'अजून काहीही साठवले नाही. साठवण्यासाठी सखी ॲप उघडून पक्के करा.', 'હજી કંઈ સાચવ્યું નથી. સાચવવા માટે સખી ઍપ ખોલીને પાક્કું કરો.', 'Nothing has been saved yet. Open the Sakhi app to confirm and save.'),
  bye: L('अपना ख़याल रखिए। अलविदा।', 'स्वतःची काळजी घ्या. नमस्कार.', 'પોતાનું ધ્યાન રાખજો. આવજો.', 'Take care of yourself. Goodbye.'),
  call: L('मदद के लिए कॉल करें: {numbers}।', 'मदतीसाठी कॉल करा: {numbers}.', 'મદદ માટે કૉલ કરો: {numbers}.', 'For help, call: {numbers}.'),
};
