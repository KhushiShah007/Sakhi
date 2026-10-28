import type { Lang } from '../i18n'

type L = Record<Lang, string>

// ---------------------------------------------------------------- Rehearsal Room
export type ScenarioId = 'family' | 'hr' | 'doctor'
export type Turn = { who: 'them' | 'me'; text: L }
export type Scenario = { id: ScenarioId; role: L; turns: Turn[]; feedback: L }

export const scenarios: Scenario[] = [
  {
    id: 'family',
    role: { en: 'Rajesh', hi: 'राजेश', mr: 'राजेश', gu: 'રાજેશ' },
    turns: [
      { who: 'them', text: { en: "What happened? You've been so quiet lately.", hi: 'क्या हुआ? आजकल तुम इतनी चुप क्यों रहती हो?', mr: 'काय झालं? हल्ली तू इतकी गप्प का असतेस?', gu: 'શું થયું? આજકાલ તું આટલી ચૂપ કેમ રહે છે?' } },
      { who: 'me', text: { en: "I haven't slept properly in weeks. I need your help — can you handle dinner on weeknights for now?", hi: 'कई हफ़्तों से मेरी नींद पूरी नहीं हुई। मुझे तुम्हारी मदद चाहिए — कुछ दिन रात का खाना तुम सँभाल लोगे?', mr: 'कित्येक आठवडे माझी झोप पूर्ण झाली नाही. मला तुझी मदत हवी आहे — काही दिवस रात्रीचं जेवण तू सांभाळशील का?', gu: 'ઘણાં અઠવાડિયાંથી મારી ઊંઘ પૂરી નથી થઈ. મને તમારી મદદ જોઈએ — થોડા દિવસ રાતનું જમવાનું તમે સંભાળી લેશો?' } },
      { who: 'them', text: { en: 'Of course… but how long will this go on?', hi: 'हाँ… पर ये कब तक चलेगा?', mr: 'हो… पण हे किती दिवस चालणार?', gu: 'હા… પણ આ ક્યાં સુધી ચાલશે?' } },
      { who: 'me', text: { en: "I don't know yet. I'm seeing a doctor. Right now I just need you with me.", hi: 'अभी पता नहीं। डॉक्टर से बात कर रही हूँ। अभी बस तुम्हारा साथ चाहिए।', mr: 'अजून माहीत नाही. डॉक्टरांशी बोलतेय. आत्ता फक्त तुझी साथ हवी.', gu: 'હજુ ખબર નથી. ડૉક્ટર સાથે વાત કરું છું. હમણાં બસ તમારો સાથ જોઈએ.' } },
      { who: 'them', text: { en: "Okay. I'll take care of it. Tell me what else helps.", hi: 'ठीक है। मैं सँभाल लूँगा। और क्या मदद करेगा, बताना।', mr: 'ठीक आहे. मी सांभाळतो. आणखी काय मदत करेल ते सांग.', gu: 'ઠીક છે. હું સંભાળી લઈશ. બીજું શું મદદ કરશે, કહેજે.' } },
    ],
    feedback: { en: 'Clear ask, no over-explaining. Beautifully done.', hi: 'साफ़ माँग, बिना ज़्यादा सफ़ाई दिए। बहुत बढ़िया।', mr: 'स्पष्ट मागणी, जास्त स्पष्टीकरण न देता. छान केलंत.', gu: 'સ્પષ્ટ માગણી, વધારે ખુલાસા વગર. સરસ કર્યું.' },
  },
  {
    id: 'hr',
    role: { en: 'HR manager', hi: 'HR मैनेजर', mr: 'HR मॅनेजर', gu: 'HR મેનેજર' },
    turns: [
      { who: 'them', text: { en: 'You wanted to talk to me about something?', hi: 'आप मुझसे किसी बात पर बात करना चाहती थीं?', mr: 'तुम्हाला माझ्याशी कशाबद्दल तरी बोलायचं होतं?', gu: 'તમે મારી સાથે કોઈ વાત કરવા માગતાં હતાં?' } },
      { who: 'me', text: { en: "Yes. I'm going through a health transition. Could I start at 10:30 twice a week for the next three months?", hi: 'जी। मैं एक हेल्थ ट्रांज़िशन से गुज़र रही हूँ। क्या अगले तीन महीने हफ़्ते में दो दिन मैं 10:30 से आ सकती हूँ?', mr: 'हो. मी एका आरोग्य बदलातून जातेय. पुढचे तीन महिने आठवड्यातून दोन दिवस मी 10:30 ला येऊ शकते का?', gu: 'હા. હું એક હેલ્થ ટ્રાન્ઝિશનમાંથી પસાર થઈ રહી છું. આવતા ત્રણ મહિના અઠવાડિયામાં બે દિવસ હું 10:30 વાગ્યે આવી શકું?' } },
      { who: 'them', text: { en: 'Is it a medical issue? Will you need a certificate?', hi: 'क्या यह कोई मेडिकल समस्या है? सर्टिफ़िकेट लगेगा?', mr: 'ही काही वैद्यकीय समस्या आहे का? प्रमाणपत्र लागेल का?', gu: 'આ કોઈ મેડિકલ સમસ્યા છે? સર્ટિફિકેટ જોઈશે?' } },
      { who: 'me', text: { en: "I'm under a doctor's care and can share a note. I'd rather keep the details private.", hi: 'मैं डॉक्टर की देखरेख में हूँ, नोट दे सकती हूँ। बाकी बातें निजी रखना चाहूँगी।', mr: 'मी डॉक्टरांच्या देखरेखीखाली आहे, चिठ्ठी देऊ शकते. बाकी तपशील खासगी ठेवायला आवडेल.', gu: 'હું ડૉક્ટરની દેખરેખ હેઠળ છું, નોંધ આપી શકું. બાકીની વિગતો ખાનગી રાખવા માગીશ.' } },
      { who: 'them', text: { en: "That's fair. Let's try it for a month and review together.", hi: 'ठीक है। एक महीना आज़माते हैं, फिर साथ में देखेंगे।', mr: 'बरोबर आहे. एक महिना करून पाहू, मग सोबत आढावा घेऊ.', gu: 'બરાબર. એક મહિનો અજમાવીએ, પછી સાથે જોઈશું.' } },
    ],
    feedback: { en: "Specific request + a clear boundary. That's exactly how it's done.", hi: 'ठोस माँग + साफ़ सीमा। बिल्कुल ऐसे ही।', mr: 'नेमकी मागणी + स्पष्ट मर्यादा. अगदी असंच.', gu: 'ચોક્કસ માગણી + સ્પષ્ટ મર્યાદા. બરાબર આમ જ.' },
  },
  {
    id: 'doctor',
    role: { en: 'Doctor', hi: 'डॉक्टर', mr: 'डॉक्टर', gu: 'ડૉક્ટર' },
    turns: [
      { who: 'them', text: { en: 'This is just age. Every woman goes through it.', hi: 'ये तो बस उम्र है। हर औरत के साथ होता है।', mr: 'हे फक्त वय आहे. प्रत्येक बाईला होतं.', gu: 'આ તો બસ ઉંમર છે. દરેક સ્ત્રીને થાય છે.' } },
      { who: 'me', text: { en: "I understand, but it's affecting my sleep and my work. Can we first check thyroid, haemoglobin and vitamin D?", hi: 'समझती हूँ, पर इससे मेरी नींद और काम पर असर पड़ रहा है। क्या पहले थायरॉइड, हीमोग्लोबिन और विटामिन D जाँच सकते हैं?', mr: 'समजतं, पण याचा माझ्या झोपेवर आणि कामावर परिणाम होतोय. आधी थायरॉइड, हिमोग्लोबिन आणि व्हिटॅमिन D तपासू शकतो का?', gu: 'સમજું છું, પણ આની મારી ઊંઘ અને કામ પર અસર થાય છે. પહેલાં થાઇરૉઇડ, હિમોગ્લોબિન અને વિટામિન D તપાસી શકીએ?' } },
      { who: 'them', text: { en: "You can… but it's probably nothing.", hi: 'करा सकती हैं… पर शायद कुछ नहीं निकलेगा।', mr: 'करू शकता… पण बहुतेक काही निघणार नाही.', gu: 'કરાવી શકો… પણ કદાચ કંઈ નહીં નીકળે.' } },
      { who: 'me', text: { en: "I'd still like to rule things out. And could we talk about treatment options for the hot flashes?", hi: 'फिर भी मैं जाँच करवाना चाहूँगी। और क्या हॉट फ़्लैश के इलाज के विकल्पों पर बात कर सकते हैं?', mr: 'तरीही मला तपासणी करायची आहे. आणि हॉट फ्लॅशच्या उपचार पर्यायांवर बोलू शकतो का?', gu: 'તોપણ હું તપાસ કરાવવા માગીશ. અને હોટ ફ્લેશના ઇલાજના વિકલ્પો વિશે વાત કરી શકીએ?' } },
      { who: 'them', text: { en: "Alright. I'll write the tests — come back with the reports and we'll discuss options.", hi: 'ठीक है। मैं टेस्ट लिख देता हूँ — रिपोर्ट लेकर आइए, फिर विकल्पों पर बात करेंगे।', mr: 'ठीक आहे. मी टेस्ट लिहून देतो — रिपोर्ट घेऊन या, मग पर्यायांवर बोलू.', gu: 'ઠીક છે. હું ટેસ્ટ લખી આપું છું — રિપોર્ટ લઈને આવો, પછી વિકલ્પો પર વાત કરીશું.' } },
    ],
    feedback: { en: 'You stayed polite and held your ground. Your Brief backs you up.', hi: 'आप विनम्र रहीं और अपनी बात पर टिकी रहीं। आपका ब्रीफ़ आपके साथ है।', mr: 'तुम्ही नम्र राहिलात आणि ठाम राहिलात. तुमचं ब्रीफ तुमच्या पाठीशी आहे.', gu: 'તમે વિનમ્ર રહ્યાં અને મક્કમ રહ્યાં. તમારું બ્રીફ તમારી સાથે છે.' },
  },
]

// ---------------------------------------------------------------- Letter to Myself
export const letter: Record<Lang, { greeting: string; paras: string[]; sign: string }> = {
  en: {
    greeting: 'Dear Sunita,',
    paras: [
      'This October you spoke to me 19 times. Mostly at night, mostly about sleep — and twice about feeling unheard at home.',
      'But look at what else you did: you walked on 12 evenings, you asked Rajesh for help twice, and he showed up both times.',
      'The hot flashes were heaviest in the humid week of the 14th. They eased on the nights you slept before 11.',
      "You were tired, not weak. There's a difference — and you lived it.",
    ],
    sign: 'With you, always — Sakhi',
  },
  hi: {
    greeting: 'प्यारी सुनीता,',
    paras: [
      'इस अक्टूबर आपने मुझसे 19 बार बात की। ज़्यादातर रात में, ज़्यादातर नींद के बारे में — और दो बार घर में अनसुना महसूस करने के बारे में।',
      'पर देखिए आपने और क्या किया: 12 शामें टहलीं, दो बार राजेश से मदद माँगी, और दोनों बार वो आगे आए।',
      '14 तारीख़ वाले उमस भरे हफ़्ते में हॉट फ़्लैश सबसे ज़्यादा थे। जिन रातों आप 11 बजे से पहले सोईं, तब राहत मिली।',
      'आप थकी थीं, कमज़ोर नहीं। इन दोनों में फ़र्क़ है — और आपने उसे जी के दिखाया।',
    ],
    sign: 'हमेशा आपके साथ — सखी',
  },
  mr: {
    greeting: 'प्रिय सुनीता,',
    paras: [
      'या ऑक्टोबरमध्ये तुम्ही माझ्याशी 19 वेळा बोललात. बहुतेक रात्री, बहुतेक झोपेबद्दल — आणि दोनदा घरी कुणी ऐकत नाही याबद्दल.',
      'पण बघा तुम्ही आणखी काय केलं: 12 संध्याकाळी चाललात, दोनदा राजेशकडे मदत मागितली, आणि दोन्ही वेळा तो धावून आला.',
      '14 तारखेच्या दमट आठवड्यात हॉट फ्लॅश सगळ्यात जास्त होते. ज्या रात्री तुम्ही 11 आधी झोपलात, तेव्हा आराम मिळाला.',
      'तुम्ही थकला होतात, कमकुवत नाही. या दोन्हींत फरक आहे — आणि तुम्ही तो जगून दाखवलात.',
    ],
    sign: 'नेहमी तुमच्यासोबत — सखी',
  },
  gu: {
    greeting: 'વહાલી સુનીતા,',
    paras: [
      'આ ઑક્ટોબરમાં તમે મારી સાથે 19 વાર વાત કરી. મોટે ભાગે રાત્રે, મોટે ભાગે ઊંઘ વિશે — અને બે વાર ઘરમાં કોઈ સાંભળતું નથી એ વિશે.',
      'પણ જુઓ તમે બીજું શું કર્યું: 12 સાંજે ચાલ્યાં, બે વાર રાજેશ પાસે મદદ માગી, અને બંને વાર એ આગળ આવ્યા.',
      '14 તારીખવાળા ભેજવાળા અઠવાડિયે હોટ ફ્લેશ સૌથી વધુ હતા. જે રાતે તમે 11 પહેલાં સૂઈ ગયાં, ત્યારે રાહત મળી.',
      'તમે થાકેલાં હતાં, નબળાં નહીં. બંનેમાં ફરક છે — અને તમે એ જીવીને બતાવ્યું.',
    ],
    sign: 'હંમેશાં તમારી સાથે — સખી',
  },
}

// ---------------------------------------------------------------- Family lessons
export type Slide = { title: L; body: L; art: 'wave' | 'body' | 'home' | 'speech' }

export const lessonAdult: Slide[] = [
  {
    art: 'wave',
    title: { en: 'A transition, not an illness', hi: 'बीमारी नहीं, एक बदलाव', mr: 'आजार नाही, एक बदल', gu: 'બીમારી નહીં, એક બદલાવ' },
    body: { en: 'For 4–10 years before periods stop, hormones rise and fall unpredictably. It usually begins in the 40s.', hi: 'पीरियड्स रुकने से 4–10 साल पहले से हॉर्मोन ऊपर-नीचे होते रहते हैं। यह अक्सर 40 की उम्र में शुरू होता है।', mr: 'पाळी थांबण्याआधी 4–10 वर्षं हार्मोन्स वर-खाली होत राहतात. हे बहुतेक चाळिशीत सुरू होतं.', gu: 'માસિક બંધ થવાનાં 4–10 વર્ષ પહેલાંથી હોર્મોન ઉપર-નીચે થતા રહે છે. આ મોટે ભાગે 40ની ઉંમરે શરૂ થાય છે.' },
  },
  {
    art: 'body',
    title: { en: 'What it can feel like', hi: 'कैसा महसूस हो सकता है', mr: 'कसं वाटू शकतं', gu: 'કેવું લાગી શકે' },
    body: { en: "Hot flashes, broken sleep, aching joints, low mood, forgetfulness. Every woman's mix is different.", hi: 'हॉट फ़्लैश, टूटी नींद, जोड़ों में दर्द, उदासी, भूलना। हर औरत का अनुभव अलग होता है।', mr: 'हॉट फ्लॅश, तुटक झोप, सांधेदुखी, उदासी, विसरभोळेपणा. प्रत्येकीचा अनुभव वेगळा असतो.', gu: 'હોટ ફ્લેશ, તૂટક ઊંઘ, સાંધાનો દુખાવો, ઉદાસી, ભૂલી જવું. દરેક સ્ત્રીનો અનુભવ અલગ હોય છે.' },
  },
  {
    art: 'home',
    title: { en: 'What helps at home', hi: 'घर पर क्या मदद करता है', mr: 'घरी काय मदत करतं', gu: 'ઘરે શું મદદ કરે' },
    body: { en: "Take tasks off her plate without being asked. Keep the room cool. Don't take irritability personally.", hi: 'बिना कहे काम अपने हाथ में लें। कमरा ठंडा रखें। चिड़चिड़ेपन को दिल पर न लें।', mr: 'न सांगता कामं हातात घ्या. खोली थंड ठेवा. चिडचिड मनाला लावून घेऊ नका.', gu: 'કહ્યા વગર કામ હાથમાં લો. રૂમ ઠંડો રાખો. ચીડિયાપણું દિલ પર ન લો.' },
  },
  {
    art: 'speech',
    title: { en: 'What not to say', hi: 'क्या न कहें', mr: 'काय बोलू नये', gu: 'શું ન કહેવું' },
    body: { en: "Skip “It's just hormones.” Try “What would help right now?”", hi: '“ये बस हॉर्मोन्स हैं” न कहें। पूछें: “अभी क्या मदद करेगा?”', mr: '“हे फक्त हार्मोन्स आहेत” असं म्हणू नका. विचारा: “आत्ता काय मदत करेल?”', gu: '“આ તો બસ હોર્મોન્સ છે” ન કહો. પૂછો: “હમણાં શું મદદ કરશે?”' },
  },
]

export const lessonTeen: Slide[] = [
  {
    art: 'wave',
    title: { en: "Mom's body is changing", hi: 'मम्मी का शरीर बदल रहा है', mr: 'आईचं शरीर बदलतंय', gu: 'મમ્મીનું શરીર બદલાય છે' },
    body: { en: 'Like puberty, but in reverse. Hormones go up and down, so she can feel tired or hot out of nowhere.', hi: 'जैसे टीनएज में बदलाव होते हैं, वैसा ही — बस उल्टा। हॉर्मोन ऊपर-नीचे होते हैं, इसलिए अचानक थकान या गर्मी लगती है।', mr: 'जसं टीनएजमध्ये होतं, तसंच — फक्त उलटं. हार्मोन्स वर-खाली होतात, म्हणून अचानक थकवा किंवा गरमी जाणवते.', gu: 'જેમ ટીનેજમાં બદલાવ થાય, તેવું જ — બસ ઊલટું. હોર્મોન ઉપર-નીચે થાય, એટલે અચાનક થાક કે ગરમી લાગે.' },
  },
  {
    art: 'speech',
    title: { en: "It's not about you", hi: 'ये आपकी वजह से नहीं', mr: 'हे तुमच्यामुळे नाही', gu: 'આ તમારા કારણે નથી' },
    body: { en: "If she snaps, it's usually tiredness talking. A hug or a glass of water goes a long way.", hi: 'अगर वो झुँझला जाएँ, तो अक्सर थकान बोल रही होती है। एक झप्पी या पानी का गिलास बहुत काम आता है।', mr: 'ती चिडली तर बहुतेक थकवा बोलत असतो. एक मिठी किंवा पाण्याचा ग्लास खूप उपयोगी पडतो.', gu: 'જો એ ચિડાઈ જાય, તો મોટે ભાગે થાક બોલતો હોય. એક ભેટ કે પાણીનો ગ્લાસ ઘણું કામ આવે.' },
  },
  {
    art: 'home',
    title: { en: 'One small thing today', hi: 'आज एक छोटी-सी बात', mr: 'आज एक छोटीशी गोष्ट', gu: 'આજે એક નાની વાત' },
    body: { en: "Do one chore without being asked. She'll notice — promise.", hi: 'बिना कहे एक काम कर दीजिए। उन्हें ज़रूर पता चलेगा — पक्का।', mr: 'न सांगता एक काम करा. तिच्या नक्की लक्षात येईल — पक्कं.', gu: 'કહ્યા વગર એક કામ કરી દો. એમને ચોક્કસ ખબર પડશે — પાક્કું.' },
  },
]
