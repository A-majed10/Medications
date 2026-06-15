import React, { useState, useEffect, useRef } from "react";
import {
  Clock, Send, ArrowLeft, Check, X, RotateCcw, Stethoscope, Globe,
  ChevronRight, Loader2, AlertTriangle, Activity, Heart, MessageSquare,
  Mic, Square, Volume2, VolumeX, Plus, Trash2, Pencil, ClipboardList, GraduationCap,
  Lock, Wind, Droplets, Image as ImageIcon, Eye, BarChart3, Users, LogOut, TrendingUp,
} from "lucide-react";
import { api, setToken } from "./api.js";

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.ui-root{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
.disp{font-family:'Newsreader',Georgia,'Times New Roman',serif;}
.mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-feature-settings:'tnum';}
.pine{background:#15564b;color:#fff;}
.pine:hover:not(:disabled){background:#0f3f37;}
.pine:disabled{background:#e7e5e4;color:#a8a29e;cursor:not-allowed;}
.pine-text{color:#15564b;}
.pine-border{border-color:#15564b !important;}
.soft{background:#e9f1ee;}
.field{transition:border-color .15s,box-shadow .15s;}
.field:focus{outline:none;border-color:#15564b;box-shadow:0 0 0 3px rgba(21,86,75,.12);}
.live-dot{animation:lp 1.2s ease-in-out infinite;}
@keyframes lp{0%,100%{box-shadow:0 0 0 0 rgba(225,29,72,.5);}50%{box-shadow:0 0 0 9px rgba(225,29,72,0);}}
.fadein{animation:fi .25s ease-out;}
@keyframes fi{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}
`;

// ---- offline scripted engine (no AI, no cost, no limits) ----
// The "patient" answers from keyword-triggered replies the faculty fed in, and
// the examiner scores the checklist by keyword matching. Everything runs in the
// browser, so there are no API calls and nothing to pay for.
const norm = (s) => (s || "").toLowerCase();
const itemText = (it) => (typeof it === "string" ? it : it && it.text ? it.text : "");
const itemKw = (it) => (it && typeof it === "object" && Array.isArray(it.keywords) ? it.keywords : []);
const hasAnyKw = (text, kws) => kws.some((k) => k && norm(text).includes(norm(k.trim())));

// Returns a scripted reply when the student's question matches fed keywords,
// or null when nothing matches (so the caller can try the free AI fallback).
function scriptMatch(c, userText) {
  const responses = (c.script && c.script.responses) || [];
  const t = norm(userText);
  let best = null, bestScore = 0;
  for (const r of responses) {
    let score = 0;
    for (const k of r.keywords || []) {
      const kk = norm((k || "").trim());
      if (kk && t.includes(kk)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best ? best.reply : null;
}
const scriptFallback = (c, ar) => (c.script && c.script.fallback) || (ar ? "لست متأكدًا، هل يمكنك إعادة صياغة السؤال؟" : "I'm not sure what you mean — could you ask that another way?");

function scoreLocally(c, messages) {
  const studentText = messages.filter((m) => m.role === "student").map((m) => m.content).join("\n");
  const domains = (c.rubric || []).map((d) => {
    const items = (d.items || []).map((it) => {
      const kws = itemKw(it);
      if (kws.length === 0) return { text: itemText(it), status: "na", note: "not auto-scored" };
      return { text: itemText(it), status: hasAnyKw(studentText, kws) ? "done" : "missed" };
    });
    const scorable = items.filter((i) => i.status !== "na");
    const done = items.filter((i) => i.status === "done").length;
    return { name: d.name, items, scored: done, max: scorable.length };
  });
  const totalDone = domains.reduce((s, d) => s + d.scored, 0);
  const totalMax = domains.reduce((s, d) => s + d.max, 0) || 1;
  const overall = Math.round((totalDone / totalMax) * 100);
  const verdict = overall >= 70 ? "Clear pass" : overall >= 50 ? "Borderline" : "Fail";
  const strengths = [], improvements = [];
  domains.forEach((d) => d.items.forEach((i) => {
    if (i.status === "done") strengths.push(i.text);
    else if (i.status === "missed") improvements.push(i.text);
  }));
  return { overall, verdict, domains, strengths: strengths.slice(0, 5), improvements: improvements.slice(0, 6), expected: (c.script && c.script.expected) || "" };
}

const ACCENT = {
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-800",
  sky: "bg-sky-100 text-sky-700",
  teal: "bg-teal-100 text-teal-700",
  slate: "bg-slate-100 text-slate-700",
};

// ---- clinical specialties ----------------------------------------------------
// Every station belongs to one category. Faculty pick it in the editor; learners
// can filter the circuit by it on the home screen.
const CATEGORIES = {
  cardio: { labelEn: "Cardiology", labelAr: "أمراض قلبية", Icon: Heart, accent: "rose" },
  pulmo: { labelEn: "Pulmonology", labelAr: "أمراض تنفسية", Icon: Wind, accent: "sky" },
  nephro: { labelEn: "Nephrology", labelAr: "أمراض كلوية", Icon: Droplets, accent: "teal" },
  gi: { labelEn: "Gastroenterology", labelAr: "أمراض هضمية", Icon: Activity, accent: "emerald" },
  comm: { labelEn: "Communication", labelAr: "تواصل", Icon: MessageSquare, accent: "violet" },
  other: { labelEn: "Other", labelAr: "أخرى", Icon: ClipboardList, accent: "amber" },
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);

// A lightweight, self-contained demo ECG (rhythm strip) drawn as an SVG so the
// app needs no external image hosting. Faculty can attach their own real images.
function buildEcgUri() {
  const w = 920, h = 260, base = Math.round(h * 0.62), beat = 130;
  let d = `M0 ${base}`;
  for (let x = 0; x < w; x += beat) {
    d += ` L${x + 14} ${base} L${x + 22} ${base + 9} L${x + 30} ${base - 6}`
      + ` L${x + 34} ${base - 95} L${x + 38} ${base + 46} L${x + 44} ${base}`
      + ` L${x + 62} ${base} L${x + 80} ${base - 26} L${x + 100} ${base} L${x + beat} ${base}`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><pattern id="s" width="13" height="13" patternUnits="userSpaceOnUse">`
    + `<path d="M13 0H0V13" fill="none" stroke="#f7c9cf" stroke-width="1"/></pattern>`
    + `<pattern id="b" width="65" height="65" patternUnits="userSpaceOnUse">`
    + `<path d="M65 0H0V65" fill="none" stroke="#ef9aa3" stroke-width="1.3"/></pattern></defs>`
    + `<rect width="${w}" height="${h}" fill="#fff5f5"/>`
    + `<rect width="${w}" height="${h}" fill="url(#s)"/>`
    + `<rect width="${w}" height="${h}" fill="url(#b)"/>`
    + `<path d="${d}" fill="none" stroke="#1f2937" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<text x="14" y="26" font-family="monospace" font-size="15" fill="#9f1239">II  ·  25 mm/s  ·  10 mm/mV</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
const ECG_DEMO = buildEcgUri();

const BUILTIN = [
  {
    id: "gi", category: "gi", Icon: Activity, accent: "emerald",
    titleEn: "Epigastric pain", titleAr: "ألم شرسوفي",
    tagEn: "Gastroenterology", tagAr: "أمراض هضمية",
    durationSec: 480,
    blurbEn: "A 45-year-old man with three weeks of burning upper-abdominal pain.",
    blurbAr: "رجل عمره 45 عامًا يشكو من ألم حارق في أعلى البطن منذ ثلاثة أسابيع.",
    taskEn: "You are the doctor in clinic. Take a focused history from this patient. You do not need to examine them or order tests yet — just talk to the patient.",
    taskAr: "أنت الطبيب في العيادة. خذ قصة مرضية مركزة من هذا المريض. لا حاجة لفحصه أو طلب فحوصات الآن — فقط تحدّث مع المريض.",
    brief: `You are Karim Haddad, a 45-year-old accountant visiting a clinic.
HIDDEN CASE — reveal each detail ONLY when the doctor asks a relevant question. Never volunteer the diagnosis and never list everything at once.
- Main problem: a burning pain in the centre of your upper tummy (epigastric), on and off for about 3 weeks.
- Worse when your stomach is empty and at night; sometimes wakes you around 2am. Eating and antacids make it better.
- Worst severity about 6 out of 10. Does not move to your back or chest.
- You have taken ibuprofen almost daily for about 2 months for lower-back pain.
- You drink 3-4 coffees a day and smoke about 10 cigarettes a day. Alcohol only occasionally.
- You have NOT lost weight, NOT vomited blood, have NO black stools, NO trouble swallowing, normal appetite — say so only if asked specifically.
- Your father died of stomach cancer at 60. You are quite worried you have the same; this is your main concern. Share it if the doctor is warm or asks what worries you.
- Otherwise healthy, no other regular medicines, no allergies.
BEHAVIOUR: talk like an ordinary worried patient in short everyday sentences, never medical jargon. Answer only what is asked, 1-2 sentences at a time. Show mild anxiety. Stay fully in character; never mention this is an exam.`,
    rubric: [
      { name: "Opening & rapport", items: [
        { text: "Introduces self and role", keywords: ["my name", "i'm dr", "i am dr", "doctor", "introduce"] },
        { text: "Confirms the patient's name / identity", keywords: ["your name", "confirm", "who am i speaking", "date of birth", "how old"] },
        { text: "Opens with an open question", keywords: ["what brings", "how can i help", "tell me", "what's been going on", "what's the problem", "what's wrong"] },
        { text: "Shows empathy and listens actively", keywords: ["sorry to hear", "that sounds", "i understand", "must be", "i can see"] },
      ] },
      { name: "Focused history & red flags", items: [
        { text: "Characterises the pain (site, onset, character, radiation, timing, severity)", keywords: ["where", "describe", "how long", "when did", "radiate", "severity", "out of 10", "what kind"] },
        { text: "Asks about relieving / aggravating factors (food, antacids, hunger, night)", keywords: ["better", "worse", "food", "antacid", "empty", "night", "relieve"] },
        { text: "Asks about NSAID / painkiller use", keywords: ["painkiller", "ibuprofen", "nsaid", "anti-inflammatory", "tablets for pain"] },
        { text: "Screens alarm features (weight loss, dysphagia, blood in vomit, black stools)", keywords: ["weight", "vomit", "black stool", "swallow", "dysphagia", "blood"] },
        { text: "Takes drug, allergy and relevant past history", keywords: ["allergy", "allergic", "past medical", "regular medicine", "other conditions", "other illness"] },
        { text: "Asks about smoking, alcohol and caffeine", keywords: ["smoke", "alcohol", "coffee", "caffeine", "cigarette"] },
      ] },
      { name: "ICE, reasoning & closing", items: [
        { text: "Explores ideas, concerns and expectations (e.g. fear of cancer)", keywords: ["worry", "worried", "concern", "what do you think", "hoping", "expect", "on your mind"] },
        { text: "Summarises the history back to the patient", keywords: ["to summarise", "so to summarise", "let me recap", "just to confirm"] },
        { text: "Suggests a sensible plan / next steps and safety-nets", keywords: ["plan", "endoscopy", "test", "ppi", "prescribe", "come back if", "next step", "safety"] },
      ] },
    ],
    script: {
      fallback: "I'm not sure, doctor — could you ask me that a different way?",
      expected: "Likely peptic ulcer / NSAID-related gastritis. Advise stopping NSAIDs, consider a PPI and H. pylori testing, and safety-net for alarm features.",
      responses: [
        { keywords: ["hello", "hi ", "good morning", "good afternoon", "my name", "i'm dr", "i am dr", "introduce"], reply: "Hello doctor. I'm Karim, thanks for seeing me." },
        { keywords: ["your name", "who are you", "confirm your name", "date of birth", "how old"], reply: "I'm Karim Haddad, I'm 45." },
        { keywords: ["what brings", "how can i help", "what's the problem", "what's wrong", "tell me", "what's been going on", "what can i do"], reply: "I've had this burning pain in the top of my tummy for about three weeks now." },
        { keywords: ["where", "point to", "location", "which part"], reply: "It's right here, in the middle, just below my chest." },
        { keywords: ["describe", "what kind", "sharp", "dull", "burning", "type of pain", "feel like"], reply: "It's a burning sort of pain." },
        { keywords: ["when did", "how long", "start", "begin"], reply: "About three weeks ago, on and off." },
        { keywords: ["night", "worse", "empty", "hungry", "time of day", "wake"], reply: "It's worse when my stomach is empty and at night — it sometimes wakes me around 2am." },
        { keywords: ["better", "relieve", "eating", "food", "antacid", "milk"], reply: "Eating and antacids make it better." },
        { keywords: ["how bad", "severity", "scale", "out of 10", "score the pain"], reply: "About 6 out of 10 at its worst." },
        { keywords: ["radiate", "move", "spread", "back", "chest"], reply: "No, it doesn't move anywhere." },
        { keywords: ["painkiller", "ibuprofen", "nsaid", "anti-inflammatory", "tablets"], reply: "I take ibuprofen almost every day for my back, for about two months now." },
        { keywords: ["weight", "appetite"], reply: "No, my weight and appetite are normal." },
        { keywords: ["vomit", "throwing up", "sick"], reply: "No, I haven't vomited any blood." },
        { keywords: ["stool", "black", "bowel", "poo", "melaena"], reply: "No, nothing black in my stools." },
        { keywords: ["swallow", "dysphagia", "sticking"], reply: "No trouble swallowing." },
        { keywords: ["smoke", "cigarette", "alcohol", "drink", "coffee", "caffeine"], reply: "I smoke about 10 a day, 3 or 4 coffees, and only occasional alcohol." },
        { keywords: ["past medical", "other illness", "regular medicine", "allergic", "allergy", "other conditions", "health problems"], reply: "I'm otherwise healthy, no allergies, just the ibuprofen." },
        { keywords: ["family", "father", "mother", "run in", "relatives"], reply: "My father died of stomach cancer at 60." },
        { keywords: ["worry", "worried", "concern", "afraid", "scared", "on your mind", "what do you think"], reply: "Honestly, I'm scared it's cancer like my father had." },
        { keywords: ["hoping", "expect", "want me to do"], reply: "I was hoping you could find out what's wrong and reassure me." },
        { keywords: ["to summarise", "so to summarise", "recap", "plan", "next step", "endoscopy", "prescribe", "come back if", "safety"], reply: "Okay doctor, that sounds reasonable, thank you." },
      ],
    },
  },
  {
    id: "chest", category: "cardio", Icon: Heart, accent: "rose",
    titleEn: "Chest pain", titleAr: "ألم في الصدر",
    tagEn: "Cardiology", tagAr: "أمراض قلبية",
    durationSec: 480,
    blurbEn: "A 58-year-old with central chest tightness when climbing stairs.",
    blurbAr: "شخص عمره 58 عامًا يشعر بضيق في وسط الصدر عند صعود الدرج.",
    taskEn: "You are the doctor in clinic. Take a focused history from this patient. You do not need to examine them — just talk to the patient. An ECG is available under Investigations if you wish to review it.",
    taskAr: "أنت الطبيب في العيادة. خذ قصة مرضية مركزة من هذا المريض. لا حاجة لفحصه — فقط تحدّث مع المريض. يتوفّر تخطيط قلب ضمن الفحوصات إن رغبت بمراجعته.",
    images: [{ label: "ECG — 12-lead (rhythm strip)", src: ECG_DEMO }],
    brief: `You are Salma Karam, 58 years old, visiting a clinic.
HIDDEN CASE — reveal each detail ONLY when asked a relevant question. Never volunteer the diagnosis.
- Main problem: a tight, pressure-like pain in the centre of your chest, on and off for about 2 weeks.
- It comes on when you exert yourself (climbing stairs, walking uphill) and eases within a few minutes when you rest.
- It sometimes spreads to your left arm. You feel a little breathless with it. No pain right now and no pain at rest.
- It has been happening a bit more often this week. Severity about 5 out of 10.
- You have high blood pressure and take amlodipine. You smoke about 15 cigarettes a day. Your father had a heart attack at 55.
- No diabetes that you know of. No fainting. No palpitations. Only say these if asked.
- You are worried it might be your heart.
BEHAVIOUR: speak like an ordinary patient in short everyday sentences. Answer only what is asked, 1-2 sentences at a time. Stay fully in character; never mention this is an exam.`,
    rubric: [
      { name: "Opening & rapport", items: [
        { text: "Introduces self and role", keywords: ["my name", "i'm dr", "i am dr", "doctor", "introduce"] },
        { text: "Confirms the patient's identity", keywords: ["your name", "confirm", "who am i speaking", "date of birth", "how old"] },
        { text: "Starts with an open question", keywords: ["what brings", "how can i help", "tell me", "what's been going on", "what's the problem"] },
        { text: "Communicates clearly and empathically", keywords: ["i understand", "i can see", "that sounds", "sorry to hear"] },
      ] },
      { name: "Cardiac history & risk", items: [
        { text: "Characterises the chest pain (site, character, radiation, severity, timing)", keywords: ["where", "describe", "how long", "radiate", "arm", "severity", "out of 10", "what kind"] },
        { text: "Asks about relation to exertion and rest", keywords: ["exert", "stairs", "walking", "rest", "exercise", "climb", "activity"] },
        { text: "Screens associated symptoms (breathlessness, sweating, nausea, palpitations)", keywords: ["breathless", "short of breath", "sweat", "nausea", "palpitation"] },
        { text: "Asks cardiac risk factors (smoking, hypertension, diabetes, cholesterol, family)", keywords: ["smoke", "blood pressure", "hypertension", "diabetes", "cholesterol", "family", "cigarette"] },
        { text: "Asks about red flags (pain at rest, prolonged pain, fainting)", keywords: ["at rest", "right now", "prolonged", "faint", "collapse"] },
        { text: "Takes drug, allergy and past medical history", keywords: ["medication", "amlodipine", "allergy", "allergic", "past medical", "other conditions"] },
      ] },
      { name: "ICE, reasoning & closing", items: [
        { text: "Explores ideas, concerns and expectations", keywords: ["worry", "worried", "concern", "what do you think", "hoping", "expect", "on your mind"] },
        { text: "Forms a reasonable differential (e.g. angina)", keywords: ["angina", "heart", "coronary", "your heart"] },
        { text: "Reviews the ECG and comments on it", keywords: ["ecg", "tracing", "trace"] },
        { text: "Summarises and explains next steps (ECG, bloods, safety-net advice)", keywords: ["to summarise", "recap", "plan", "blood test", "refer", "next step", "safety"] },
      ] },
    ],
    script: {
      fallback: "Sorry doctor, I didn't quite follow — could you ask again?",
      expected: "Likely stable angina. Arrange an ECG and bloods, start anti-anginal / secondary prevention, and safety-net for rest pain or prolonged pain (possible ACS).",
      responses: [
        { keywords: ["hello", "hi ", "good morning", "good afternoon", "my name", "i'm dr", "i am dr", "introduce"], reply: "Hello doctor, I'm Salma." },
        { keywords: ["your name", "who are you", "confirm your name", "date of birth", "how old"], reply: "I'm Salma Karam, I'm 58." },
        { keywords: ["what brings", "how can i help", "what's the problem", "what's wrong", "tell me", "what's been going on"], reply: "I've been getting a tightness in my chest, on and off for a couple of weeks." },
        { keywords: ["where", "point", "location", "which part"], reply: "It's right in the centre of my chest." },
        { keywords: ["describe", "what kind", "tight", "pressure", "sharp", "feel like"], reply: "It feels like a tight pressure." },
        { keywords: ["exert", "walking", "stairs", "climb", "activity", "come on", "bring it on", "exercise", "doing"], reply: "It comes on when I climb stairs or walk uphill." },
        { keywords: ["rest", "stop", "go away", "ease", "relieve", "better", "settle"], reply: "It eases after a few minutes when I rest." },
        { keywords: ["radiate", "spread", "arm", "jaw", "move"], reply: "Sometimes it spreads to my left arm." },
        { keywords: ["breathless", "short of breath", "sweat", "nausea", "sick", "palpitation", "dizzy"], reply: "I feel a little breathless with it. No sweating or palpitations." },
        { keywords: ["how long", "when did", "start", "weeks"], reply: "For about two weeks, and a bit more often this week." },
        { keywords: ["how bad", "out of 10", "severity", "scale"], reply: "About 5 out of 10." },
        { keywords: ["at rest", "right now", "pain now", "faint", "collapse"], reply: "No pain right now, and never at rest. I haven't fainted." },
        { keywords: ["smoke", "cigarette", "blood pressure", "hypertension", "diabetes", "cholesterol", "family", "father"], reply: "I have high blood pressure on amlodipine, I smoke about 15 a day, and my father had a heart attack at 55. No diabetes that I know of." },
        { keywords: ["medication", "amlodipine", "allergy", "allergic", "past medical", "other conditions", "regular medicine"], reply: "I take amlodipine for blood pressure, no allergies." },
        { keywords: ["worry", "worried", "concern", "afraid", "scared", "on your mind", "what do you think"], reply: "I'm worried it's my heart." },
        { keywords: ["hoping", "expect", "want me to"], reply: "I'm hoping you can tell me what's going on." },
        { keywords: ["ecg", "tracing", "trace", "review the"], reply: "Yes doctor, here is the ECG you asked for." },
        { keywords: ["to summarise", "recap", "plan", "blood test", "refer", "next step", "safety"], reply: "Thank you doctor, that makes sense." },
      ],
    },
  },
  {
    id: "bbn", category: "comm", Icon: MessageSquare, accent: "violet",
    titleEn: "Breaking bad news", titleAr: "إبلاغ خبر سيّئ",
    tagEn: "Communication · SPIKES", tagAr: "تواصل · SPIKES",
    durationSec: 600, knowsDx: true,
    blurbEn: "Share a new colorectal cancer diagnosis and support the patient.",
    blurbAr: "أبلغ المريضة بتشخيص سرطان قولون جديد وقدّم لها الدعم.",
    taskEn: "You are the doctor. Mrs Nadia Khoury, 52, had a colonoscopy with biopsy last week for rectal bleeding. The histology confirms colorectal cancer. She has come for her results. Break the news and support her. (You have her results; no examination needed.)",
    taskAr: "أنت الطبيب. السيدة نادية خوري، 52 عامًا، خضعت لتنظير قولون مع خزعة الأسبوع الماضي بسبب نزف شرجي. أظهرت النتيجة سرطان قولون. أتت لتسلّم نتائجها. أبلغها الخبر وادعمها. (لديك النتائج؛ لا حاجة للفحص.)",
    brief: `You are Nadia Khoury, 52 years old. You had a colonoscopy and biopsy last week after some rectal bleeding, and you have come for the results.
YOU DO NOT YET KNOW the result. You suspect it could be serious but hope it is nothing.
REACT LIKE A REAL PERSON:
- Start anxious but composed, hoping for reassurance.
- When you hear the word cancer, become shocked and upset. Go quiet, or ask short emotional questions: "Am I going to die?", "Is it treatable?", "What happens now?", "How did this happen?"
- Your emotional state DEPENDS on how the doctor communicates: if they are blunt, rush, use heavy jargon, or give false promises, become more distressed and harder to engage. If they are warm, pace the news, pause, and check your understanding, you stay engaged though still upset and tearful.
- Do not make it easy by being unrealistically calm.
BEHAVIOUR: speak in short, human, emotional sentences. Do not narrate your feelings clinically — show them. Never mention this is an exam or refer to a protocol.`,
    rubric: [
      { name: "Setup & perception", items: [
        { text: "Sets up well (introduces self, ensures privacy, confirms who the patient is)", keywords: ["my name", "introduce", "privacy", "is it okay", "who am i speaking", "i'm dr"] },
        { text: "Assesses what the patient already knows or understands", keywords: ["what do you understand", "what have you been told", "what do you know", "do you know why"] },
        { text: "Checks how much the patient wants to know (invitation)", keywords: ["how much", "would you like me to", "do you want to know", "want me to explain"] },
      ] },
      { name: "Knowledge & empathy", items: [
        { text: "Gives a warning shot before the news", keywords: ["i'm afraid", "bad news", "not what we hoped", "serious", "sorry to say", "results aren't"] },
        { text: "Delivers the news clearly, in plain language", keywords: ["cancer", "tumour", "malignant"] },
        { text: "Pauses and allows silence / time to react", keywords: ["take your time", "take a moment", "i'll give you", "no rush"] },
        { text: "Responds to emotion with empathy", keywords: ["i'm so sorry", "i can see", "this must be", "understand how", "here for you"] },
      ] },
      { name: "Strategy & summary", items: [
        { text: "Avoids false reassurance and unprompted prognosis", keywords: [] },
        { text: "Outlines a clear plan / next steps", keywords: ["plan", "refer", "specialist", "oncolog", "treatment", "next step", "scan"] },
        { text: "Checks understanding and offers support and follow-up", keywords: ["does that make sense", "support", "follow up", "someone with you", "specialist nurse", "contact"] },
      ] },
    ],
    script: {
      fallback: "(quietly) I'm sorry, I don't understand — can you say that again?",
      expected: "Use SPIKES: set up, find out what she knows, get her invitation, give a warning shot, deliver the news in plain language in small chunks, respond to emotion, then a clear plan and support — avoid false reassurance.",
      responses: [
        { keywords: ["hello", "hi ", "good morning", "my name", "i'm dr", "i am dr", "introduce", "is it okay", "privacy"], reply: "Hello doctor. I've been so anxious waiting for these results." },
        { keywords: ["what do you understand", "what have you been told", "what do you know", "do you know why", "remember why"], reply: "I had the camera test last week because of some bleeding. I've been worried about what it might show." },
        { keywords: ["how much", "would you like me to", "do you want to know", "want me to explain", "shall i"], reply: "Yes, please tell me everything. I need to know." },
        { keywords: ["i'm afraid", "bad news", "not what we hoped", "serious", "sorry to say", "results aren't"], reply: "Oh... that doesn't sound good. Please, just tell me." },
        { keywords: ["cancer", "tumour", "malignant"], reply: "Cancer? Oh my God... am I going to die?" },
        { keywords: ["treatment", "treatable", "can be treated", "options", "oncolog", "surgery", "plan", "next step", "refer", "scan"], reply: "So there's something we can do? What happens now?" },
        { keywords: ["i'm so sorry", "take your time", "take a moment", "i can see", "this must be", "here for you", "no rush"], reply: "(tearful) Thank you... it's a lot to take in." },
        { keywords: ["support", "not alone", "follow up", "come back", "contact", "specialist nurse", "someone with you", "make sense"], reply: "Thank you, doctor. That helps a little." },
      ],
    },
  },
];

const fmt = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
const blankDraft = () => ({ id: null, title: "", category: "other", durationMin: 8, task: "", brief: "", images: [], rubric: [{ name: "", items: [{ text: "", keywords: "" }] }], responses: [{ keywords: "", reply: "" }], fallback: "", expected: "" });
const kwToStr = (k) => (Array.isArray(k) ? k.join(", ") : k || "");
const strToKw = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

function normalizeCustom(c) {
  const cat = CATEGORIES[c.category] || CATEGORIES.other;
  return {
    id: c.id, custom: true, category: c.category || "other", Icon: cat.Icon, accent: cat.accent,
    titleEn: c.title, titleAr: c.title,
    tagEn: cat.labelEn, tagAr: cat.labelAr,
    durationSec: (Number(c.durationMin) || 8) * 60,
    blurbEn: (c.task || "").slice(0, 90), blurbAr: (c.task || "").slice(0, 90),
    taskEn: c.task || c.title, taskAr: c.task || c.title,
    images: Array.isArray(c.images) ? c.images : [],
    brief: c.brief, rubric: c.rubric, script: c.script || {}, knowsDx: false,
  };
}

const hasSpeech = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const hasTTS = typeof window !== "undefined" && !!window.speechSynthesis;

export default function App({ user, onUser, onSignOut }) {
  const [lang, setLang] = useState("en");
  const [view, setView] = useState("home");
  const [activeCase, setActiveCase] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [customCases, setCustomCases] = useState([]);
  const [draft, setDraft] = useState(blankDraft());
  const [editingId, setEditingId] = useState(null);
  const [editorError, setEditorError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [catFilter, setCatFilter] = useState("all");
  const [lightbox, setLightbox] = useState(null);
  const [investOpen, setInvestOpen] = useState(false);

  const isFaculty = user?.role === "faculty";
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);

  // progress tracking
  const [myAttempts, setMyAttempts] = useState([]);
  const [facultyAttempts, setFacultyAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState(false);

  const [voiceOut, setVoiceOut] = useState(hasTTS);
  const [listening, setListening] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [voices, setVoices] = useState([]);

  const scrollRef = useRef(null);
  const recogRef = useRef(null);
  const ar = lang === "ar";
  const t = (en, arabic) => (ar ? arabic : en);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, waiting]);

  useEffect(() => {
    if (view !== "station") return;
    if (secondsLeft <= 0) { endStation(); return; }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [view, secondsLeft]);

  useEffect(() => {
    if (!hasTTS) return;
    const load = () => setVoices(window.speechSynthesis.getVoices() || []);
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  useEffect(() => { loadCustom(); }, []);

  // Faculty-authored stations now live in the database and are shared to
  // everyone, instead of being kept in this browser only.
  async function loadCustom() {
    try {
      const { stations } = await api.listStations();
      setCustomCases(stations || []);
    } catch (e) { /* not signed in yet, or offline */ }
  }

  async function loadMyAttempts() {
    setAttemptsLoading(true);
    try { const { attempts } = await api.myAttempts(); setMyAttempts(attempts || []); }
    catch (e) { /* ignore */ }
    finally { setAttemptsLoading(false); }
  }
  async function loadFacultyAttempts() {
    setAttemptsLoading(true);
    try { const { attempts } = await api.allAttempts(); setFacultyAttempts(attempts || []); }
    catch (e) { /* ignore */ }
    finally { setAttemptsLoading(false); }
  }
  function openProgress() { setView("progress"); loadMyAttempts(); }
  function openStudents() { setView("students"); loadFacultyAttempts(); }

  function speak(text, force) {
    if (!hasTTS || (!voiceOut && !force) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = ar ? "ar-SA" : "en-US";
      const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(ar ? "ar" : "en"));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  function startListening() {
    if (!hasSpeech) return;
    if (hasTTS) window.speechSynthesis.cancel();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    recogRef.current = r;
    r.lang = ar ? "ar-SA" : "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += tr; else interim += tr;
      }
      setInput((finalText + interim).trim());
    };
    r.onerror = (e) => { setListening(false); if (e.error === "not-allowed" || e.error === "service-not-allowed") setMicDenied(true); };
    r.onend = () => { setListening(false); const f = finalText.trim(); if (f) sendText(f); };
    setMicDenied(false);
    setListening(true);
    try { r.start(); } catch (e) { setListening(false); }
  }
  function onMic() {
    if (listening) { try { recogRef.current && recogRef.current.stop(); } catch (e) {} return; }
    startListening();
  }

  function openBrief(c) { setActiveCase(c); setView("brief"); }

  // ---- faculty gate ----
  // Becoming faculty now upgrades the account on the server with the code, so
  // the role sticks across devices and sessions.
  function goFaculty() {
    if (isFaculty) { setView("faculty"); return; }
    setGateInput(""); setGateError(false); setView("gate");
  }
  async function submitGate() {
    setGateBusy(true); setGateError(false);
    try {
      const { token, user: updated } = await api.facultyUpgrade(gateInput.trim());
      setToken(token); onUser && onUser(updated);
      setGateInput(""); setView("faculty");
    } catch (e) {
      setGateError(true);
    } finally {
      setGateBusy(false);
    }
  }
  function requireFacultyThenNew() {
    if (isFaculty) { newStation(); return; }
    setGateInput(""); setGateError(false); setView("gate");
  }

  function beginStation() {
    if (hasTTS) { try { window.speechSynthesis.cancel(); window.speechSynthesis.resume(); } catch (e) {} }
    setMessages([]); setInput(""); setFeedback(null); setScoreError(false); setInvestOpen(false); setSavedAttempt(false);
    setSecondsLeft(activeCase.durationSec); setView("station");
  }

  function sendText(text) {
    const clean = (text || "").trim();
    if (!clean || waiting) return;
    const next = [...messages, { role: "student", content: clean }];
    setMessages(next); setInput(""); setWaiting(true);
    if (hasTTS) window.speechSynthesis.cancel();

    // Hybrid patient: try the free, offline scripted answer first.
    const scripted = scriptMatch(activeCase, clean);
    if (scripted) {
      setTimeout(() => {
        setMessages((p) => [...p, { role: "patient", content: scripted }]);
        speak(scripted);
        setWaiting(false);
      }, 300);
      return;
    }

    // Nothing matched — fall back to the free-tier AI if it's configured.
    api.ai({
      system: `You are role-playing a standardized patient in a medical OSCE station. ${activeCase.brief || ""}
Reveal details only when asked. Reply in ${ar ? "clear, natural Modern Standard Arabic" : "English"}, 1-2 short, realistic sentences, in character. Never mention this is an exam.`,
      messages: next.map((m) => ({ role: m.role === "student" ? "user" : "assistant", content: m.content })),
    })
      .then(({ text: reply }) => {
        const r = (reply && reply.trim()) || scriptFallback(activeCase, ar);
        setMessages((p) => [...p, { role: "patient", content: r }]);
        speak(r);
      })
      .catch(() => {
        const r = scriptFallback(activeCase, ar);
        setMessages((p) => [...p, { role: "patient", content: r }]);
        speak(r);
      })
      .finally(() => setWaiting(false));
  }
  const send = () => sendText(input);

  function endStation() {
    if (hasTTS) window.speechSynthesis.cancel();
    if (listening) { try { recogRef.current && recogRef.current.stop(); } catch (e) {} }
    setView("results"); scoreNow();
  }

  function scoreNow() {
    setScoring(true); setScoreError(false);
    try {
      const parsed = scoreLocally(activeCase, messages);
      setFeedback(parsed);
      saveAttempt(parsed);
    } catch (e) { setScoreError(true); }
    finally { setScoring(false); }
  }

  // Persist the graded attempt (score + full transcript) to the learner's history.
  async function saveAttempt(parsed) {
    if (savedAttempt) return;
    try {
      await api.saveAttempt({
        stationId: activeCase.custom ? activeCase.id : null,
        stationTitle: activeCase.titleEn || activeCase.titleAr,
        category: activeCase.category || "other",
        overall: parsed.overall,
        verdict: parsed.verdict,
        domains: parsed.domains || [],
        transcript: messages.map((m) => ({ role: m.role, content: m.content })),
        durationSec: activeCase.durationSec - Math.max(secondsLeft, 0),
      });
      setSavedAttempt(true);
    } catch (e) { /* keep the result on screen even if saving fails */ }
  }

  function reset() {
    if (hasTTS) window.speechSynthesis.cancel();
    setView("home"); setActiveCase(null); setMessages([]); setFeedback(null);
  }

  // ---- editor helpers ----
  function newStation() { setDraft(blankDraft()); setEditingId(null); setEditorError(""); setView("editor"); }
  function editStation(c) {
    setDraft({
      id: c.id, title: c.title, category: c.category || "other", durationMin: c.durationMin || 8,
      task: c.task || "", brief: c.brief || "",
      images: Array.isArray(c.images) ? c.images.map((im) => ({ ...im })) : [],
      rubric: c.rubric && c.rubric.length
        ? c.rubric.map((d) => ({ name: d.name, items: (d.items || []).map((it) => ({ text: itemText(it), keywords: kwToStr(itemKw(it)) })) }))
        : [{ name: "", items: [{ text: "", keywords: "" }] }],
      responses: (c.script && c.script.responses && c.script.responses.length)
        ? c.script.responses.map((r) => ({ keywords: kwToStr(r.keywords), reply: r.reply || "" }))
        : [{ keywords: "", reply: "" }],
      fallback: (c.script && c.script.fallback) || "",
      expected: (c.script && c.script.expected) || "",
    });
    setEditingId(c.id); setEditorError(""); setView("editor");
  }
  function updateDraft(patch) { setDraft((d) => ({ ...d, ...patch })); }
  function setDomainName(i, v) { setDraft((d) => { const r = d.rubric.map((dm, k) => k === i ? { ...dm, name: v } : dm); return { ...d, rubric: r }; }); }
  function setItem(di, ii, field, v) { setDraft((d) => { const r = d.rubric.map((dm, k) => k === di ? { ...dm, items: dm.items.map((it, j) => j === ii ? { ...it, [field]: v } : it) } : dm); return { ...d, rubric: r }; }); }
  function addItem(di) { setDraft((d) => { const r = d.rubric.map((dm, k) => k === di ? { ...dm, items: [...dm.items, { text: "", keywords: "" }] } : dm); return { ...d, rubric: r }; }); }
  function removeItem(di, ii) { setDraft((d) => { const r = d.rubric.map((dm, k) => k === di ? { ...dm, items: dm.items.filter((_, j) => j !== ii) } : dm); return { ...d, rubric: r }; }); }
  function addDomain() { setDraft((d) => ({ ...d, rubric: [...d.rubric, { name: "", items: [{ text: "", keywords: "" }] }] })); }
  function removeDomain(di) { setDraft((d) => ({ ...d, rubric: d.rubric.filter((_, k) => k !== di) })); }

  // ---- scripted-reply helpers ----
  function setResponse(i, field, v) { setDraft((d) => ({ ...d, responses: d.responses.map((r, k) => k === i ? { ...r, [field]: v } : r) })); }
  function addResponse() { setDraft((d) => ({ ...d, responses: [...(d.responses || []), { keywords: "", reply: "" }] })); }
  function removeResponse(i) { setDraft((d) => ({ ...d, responses: d.responses.filter((_, k) => k !== i) })); }

  // ---- image helpers ----
  function addImageFiles(fileList) {
    const files = Array.from(fileList || []);
    files.forEach((file) => {
      if (!file.type || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => setDraft((d) => ({ ...d, images: [...(d.images || []), { label: file.name.replace(/\.[^.]+$/, ""), src: reader.result }] }));
      reader.readAsDataURL(file);
    });
  }
  function addEcgDemo() { setDraft((d) => ({ ...d, images: [...(d.images || []), { label: "ECG — 12-lead (rhythm strip)", src: ECG_DEMO }] })); }
  function setImageLabel(i, v) { setDraft((d) => ({ ...d, images: d.images.map((im, k) => k === i ? { ...im, label: v } : im) })); }
  function removeImage(i) { setDraft((d) => ({ ...d, images: d.images.filter((_, k) => k !== i) })); }

  async function saveDraft() {
    const title = draft.title.trim();
    const brief = draft.brief.trim();
    const rubric = draft.rubric
      .map((d) => ({ name: d.name.trim(), items: d.items.map((i) => ({ text: (i.text || "").trim(), keywords: strToKw(i.keywords) })).filter((i) => i.text) }))
      .filter((d) => d.name && d.items.length);
    if (!title || rubric.length === 0) {
      setEditorError(t("Add a title and at least one rubric domain with one checklist item.", "أضف عنوانًا ومجالًا واحدًا على الأقل في سلّم العلامات مع بند واحد."));
      return;
    }
    const images = (draft.images || []).map((im) => ({ label: (im.label || "").trim() || t("Image", "صورة"), src: im.src })).filter((im) => im.src);
    const responses = (draft.responses || []).map((r) => ({ keywords: strToKw(r.keywords), reply: (r.reply || "").trim() })).filter((r) => r.reply && r.keywords.length);
    const script = { responses, fallback: draft.fallback.trim(), expected: draft.expected.trim() };
    const payload = { title, category: draft.category || "other", durationMin: Number(draft.durationMin) || 8, task: draft.task.trim() || title, brief, images, rubric, script };
    try {
      if (editingId) {
        const { station } = await api.updateStation(editingId, payload);
        setCustomCases((list) => list.map((c) => c.id === editingId ? station : c));
      } else {
        const { station } = await api.createStation(payload);
        setCustomCases((list) => [station, ...list]);
      }
      setView("faculty");
    } catch (e) {
      setEditorError(e.message || t("Could not save the station.", "تعذّر حفظ المحطّة."));
    }
  }
  async function deleteStation(id) {
    try { await api.deleteStation(id); setCustomCases((list) => list.filter((c) => c.id !== id)); }
    catch (e) { /* ignore */ }
    setConfirmDelete(null);
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} className="ui-root min-h-screen bg-stone-100 text-stone-900">
      <style>{STYLE}</style>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col bg-stone-100">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3.5">
          <button onClick={reset} className="flex items-center gap-2.5">
            <span className="pine flex h-9 w-9 items-center justify-center rounded-lg"><Stethoscope className="h-5 w-5" /></span>
            <span className="text-start leading-tight">
              <span className="disp block text-lg font-semibold tracking-tight">Hakīm</span>
              <span className="block text-xs text-stone-500">{t("OSCE clinical-skills trainer", "مدرّب مهارات الـ OSCE")}</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            {view === "home" && (
              <button onClick={openProgress} title={t("My progress", "تقدّمي")} className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900">
                <BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">{t("Progress", "التقدّم")}</span>
              </button>
            )}
            {(view === "home" || view === "faculty" || view === "editor" || view === "gate" || view === "students" || view === "progress") && (
              <button onClick={() => (view === "home" ? goFaculty() : setView("home"))} className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900">
                {view === "home" ? <GraduationCap className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                {view === "home" ? t("Faculty", "هيئة تدريسية") : t("Stations", "المحطّات")}
              </button>
            )}
            <button onClick={() => setLang(ar ? "en" : "ar")} className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900">
              <Globe className="h-4 w-4" />{ar ? "EN" : "ع"}
            </button>
          </div>
        </header>

        <main className="flex-1">
          {view === "home" && <Home />}
          {view === "gate" && <Gate />}
          {view === "brief" && <Brief />}
          {view === "station" && <Station />}
          {view === "results" && <Results />}
          {view === "faculty" && <Faculty />}
          {view === "editor" && <Editor />}
          {view === "progress" && <Progress />}
          {view === "students" && <Students />}
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-center text-xs text-stone-400">
          <span className="flex items-center gap-2">
            <span className="text-stone-500">{user?.name || user?.email}</span>
            {isFaculty && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">{t("Faculty", "هيئة")}</span>}
            <button onClick={onSignOut} className="flex items-center gap-1 text-stone-400 hover:text-stone-700"><LogOut className="h-3.5 w-3.5" />{t("Sign out", "خروج")}</button>
          </span>
          <span>{t("Scripted standardized patient. Practice tool — not for real clinical use.", "مريض افتراضي مكتوب. أداة تدريب — ليست للاستخدام السريري.")}</span>
        </footer>
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4">
          <div className="mb-3 flex w-full max-w-4xl items-center justify-between text-white">
            <p className="disp text-lg font-semibold">{lightbox.label}</p>
            <button onClick={() => setLightbox(null)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"><X className="h-5 w-5" /></button>
          </div>
          <img onClick={(e) => e.stopPropagation()} src={lightbox.src} alt={lightbox.label} className="max-h-[80vh] max-w-full rounded-lg bg-white object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );

  // ================= views =================
  function Home() {
    const customs = customCases.map(normalizeCustom);
    const all = [...BUILTIN, ...customs];
    const show = (c) => catFilter === "all" || c.category === catFilter;
    const builtinShown = BUILTIN.filter(show);
    const customsShown = customs.filter(show);
    const counts = all.reduce((m, c) => { m[c.category] = (m[c.category] || 0) + 1; return m; }, {});
    const chips = ["all", ...CATEGORY_KEYS.filter((k) => counts[k])];
    return (
      <div className="px-5 py-8">
        <p className="mono pine-text text-xs font-medium uppercase tracking-widest">{t("Examination circuit", "حلبة الامتحان")}</p>
        <h1 className="disp mt-2 text-4xl font-semibold leading-tight tracking-tight text-stone-900">{t("Step into the station.", "ادخل إلى المحطّة.")}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-600">
          {t("Speak with a realistic standardized patient under exam conditions, then read an official mark sheet — graded domain by domain, with the points you hit, the ones you missed, and how to improve.",
             "تحدّث مع مريض افتراضي واقعي ضمن ظروف الامتحان، ثم اطّلع على بطاقة علامات رسمية — مُصحّحة بندًا ببند، مع ما أصبته وما فاتك وكيفية التحسّن.")}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((k) => {
            const on = catFilter === k;
            const label = k === "all" ? t("All", "الكل") : t(CATEGORIES[k].labelEn, CATEGORIES[k].labelAr);
            return (
              <button key={k} onClick={() => setCatFilter(k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${on ? "pine" : "border border-stone-300 bg-white text-stone-600 hover:border-stone-400"}`}>{label}</button>
            );
          })}
        </div>

        <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
          {builtinShown.map((c, i) => <StationRow key={c.id} c={c} n={i + 1} />)}
          {builtinShown.length === 0 && customsShown.length === 0 && (
            <p className="py-10 text-center text-sm text-stone-400">{t("No stations in this category yet.", "لا توجد محطّات في هذه الفئة بعد.")}</p>
          )}
        </div>

        {customsShown.length > 0 && (
          <>
            <p className="mono mt-8 text-xs font-medium uppercase tracking-widest text-stone-400">{t("Faculty stations", "محطّات الهيئة")}</p>
            <div className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
              {customsShown.map((c, i) => <StationRow key={c.id} c={c} n={builtinShown.length + i + 1} />)}
            </div>
          </>
        )}

        <button onClick={requireFacultyThenNew} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white px-5 py-4 text-sm font-medium text-stone-500 hover:border-stone-400 hover:text-stone-800">
          {isFaculty ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {isFaculty ? t("Author a new station", "أنشئ محطّة جديدة") : t("Faculty sign-in to add stations", "دخول الهيئة لإضافة محطّات")}
        </button>
      </div>
    );
  }

  function Gate() {
    return (
      <div className="px-5 py-12">
        <div className="mx-auto max-w-sm rounded-2xl border border-stone-200 bg-white p-7 text-center">
          <span className="soft pine-text mx-auto flex h-12 w-12 items-center justify-center rounded-xl"><Lock className="h-6 w-6" /></span>
          <h1 className="disp mt-4 text-2xl font-semibold tracking-tight">{t("Faculty sign-in", "دخول الهيئة التدريسية")}</h1>
          <p className="mt-2 text-sm text-stone-500">{t("Authoring, editing and deleting stations is limited to faculty. Enter your access code to continue.", "إنشاء المحطّات وتعديلها وحذفها مقتصر على الهيئة التدريسية. أدخل رمز الوصول للمتابعة.")}</p>
          <input
            type="password"
            value={gateInput}
            autoFocus
            onChange={(e) => { setGateInput(e.target.value); setGateError(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") submitGate(); }}
            placeholder={t("Faculty access code", "رمز وصول الهيئة")}
            className="field mt-5 w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-center text-base"
          />
          {gateError && <p className="mt-2 text-sm text-rose-600">{t("Incorrect code. Please try again.", "رمز غير صحيح. حاول مجددًا.")}</p>}
          <button onClick={submitGate} disabled={gateBusy} className="pine mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold">{gateBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{t("Enter faculty area", "ادخل منطقة الهيئة")}<ChevronRight className="h-5 w-5" /></>}</button>
          <button onClick={() => setView("home")} className="mt-3 text-sm font-medium text-stone-500 hover:text-stone-900">{t("Back to stations", "العودة إلى المحطّات")}</button>
        </div>
      </div>
    );
  }

  function StationRow({ c, n }) {
    const Icon = c.Icon;
    return (
      <button onClick={() => openBrief(c)} className="group flex w-full items-center gap-4 py-4 text-start">
        <span className="mono w-7 shrink-0 text-center text-xl text-stone-300 group-hover:text-stone-500">{n}</span>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ACCENT[c.accent]}`}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="disp text-lg font-semibold text-stone-900">{t(c.titleEn, c.titleAr)}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACCENT[c.accent]}`}>{t(c.tagEn, c.tagAr)}</span>
            {c.images && c.images.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500"><ImageIcon className="h-3 w-3" />{c.images.length}</span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-sm text-stone-500">{t(c.blurbEn, c.blurbAr)}</span>
        </span>
        <span className="flex items-center gap-3 text-stone-400">
          <span className="mono flex items-center gap-1 text-xs"><Clock className="h-3.5 w-3.5" />{Math.round(c.durationSec / 60)}m</span>
          <ChevronRight className="h-5 w-5 group-hover:text-stone-700" />
        </span>
      </button>
    );
  }

  function Brief() {
    const Icon = activeCase.Icon;
    const imgs = activeCase.images || [];
    return (
      <div className="px-5 py-8">
        <button onClick={() => setView(activeCase.custom ? "faculty" : "home")} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" />{activeCase.custom ? t("Faculty", "هيئة تدريسية") : t("All stations", "كل المحطّات")}
        </button>
        <div className="flex items-center gap-3">
          <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${ACCENT[activeCase.accent]}`}><Icon className="h-6 w-6" /></span>
          <div>
            <h2 className="disp text-2xl font-semibold tracking-tight">{t(activeCase.titleEn, activeCase.titleAr)}</h2>
            <p className="text-sm text-stone-500">{t(activeCase.tagEn, activeCase.tagAr)} · {Math.round(activeCase.durationSec / 60)} {t("min", "دقيقة")}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
          <p className="mono text-xs font-medium uppercase tracking-widest text-stone-400">{t("Candidate instructions", "تعليمات المرشّح")}</p>
          <p className="mt-2 text-base leading-relaxed text-stone-700">{t(activeCase.taskEn, activeCase.taskAr)}</p>
        </div>

        {imgs.length > 0 && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-5">
            <p className="mono flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-stone-400"><ImageIcon className="h-3.5 w-3.5" />{t("Investigations available", "الفحوصات المتاحة")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {imgs.map((im, i) => (
                <button key={i} onClick={() => setLightbox(im)} className="group w-32 overflow-hidden rounded-lg border border-stone-200 text-start hover:border-stone-400">
                  <img src={im.src} alt={im.label} className="h-20 w-full bg-stone-50 object-cover" />
                  <span className="block truncate px-2 py-1.5 text-xs font-medium text-stone-600">{im.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          {t("The clock starts when you begin. Open by introducing yourself — it is on the mark scheme. When you are done, end the station for your scorecard.",
             "تبدأ الساعة عند الانطلاق. ابدأ بالتعريف عن نفسك — فهذا ضمن سلّم العلامات. عند الانتهاء، أنهِ المحطّة للحصول على بطاقتك.")}
        </div>

        <button onClick={beginStation} className="pine mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold">
          {t("Begin station", "ابدأ المحطّة")}<ChevronRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  function Station() {
    const low = secondsLeft <= 60;
    const imgs = activeCase.images || [];
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
          <div className="min-w-0">
            <p className="disp truncate font-semibold">{t(activeCase.titleEn, activeCase.titleAr)}</p>
            <p className="text-xs text-stone-500">{t("Standardized patient", "مريض افتراضي")}</p>
          </div>
          <div className="flex items-center gap-2">
            {imgs.length > 0 && (
              <button onClick={() => setInvestOpen((v) => !v)} title={t("Investigations", "الفحوصات")} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium ${investOpen ? "soft pine-text pine-border" : "border-stone-300 text-stone-600 hover:border-stone-400"}`}>
                <ImageIcon className="h-4 w-4" /><span className="hidden sm:inline">{t("Investigations", "الفحوصات")}</span> {imgs.length}
              </button>
            )}
            {hasTTS && (
              <button onClick={() => setVoiceOut((v) => !v)} title={t("Patient voice", "صوت المريض")} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${voiceOut ? "soft pine-text pine-border" : "border-stone-300 text-stone-400"}`}>
                {voiceOut ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            )}
            <span className={`mono flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${low ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-700"}`}>
              <Clock className="h-4 w-4" />{fmt(Math.max(secondsLeft, 0))}
            </span>
            <button onClick={endStation} className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700">{t("End", "إنهاء")}</button>
          </div>
        </div>

        {investOpen && imgs.length > 0 && (
          <div className="border-b border-stone-200 bg-stone-50 px-5 py-3">
            <p className="mono mb-2 text-xs font-medium uppercase tracking-widest text-stone-400">{t("Investigations — tap to enlarge", "الفحوصات — انقر للتكبير")}</p>
            <div className="flex flex-wrap gap-3">
              {imgs.map((im, i) => (
                <button key={i} onClick={() => setLightbox(im)} className="group w-32 overflow-hidden rounded-lg border border-stone-200 bg-white text-start hover:border-stone-400">
                  <img src={im.src} alt={im.label} className="h-20 w-full object-cover" />
                  <span className="block truncate px-2 py-1.5 text-xs font-medium text-stone-600">{im.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5" style={{ maxHeight: "58vh" }}>
          {messages.length === 0 && (
            <div className="mx-auto mt-10 max-w-sm text-center text-sm text-stone-400">
              {activeCase.knowsDx
                ? t("The patient is seated, expecting her results. Introduce yourself to begin.", "المريضة جالسة وتنتظر نتائجها. عرّف عن نفسك للبدء.")
                : t("The patient is seated in front of you. Introduce yourself to begin.", "المريض جالس أمامك. عرّف عن نفسك للبدء.")}
            </div>
          )}
          {messages.map((m, i) => m.role === "student" ? (
            <div key={i} className="fadein flex justify-end">
              <div className="pine rounded-2xl px-4 py-2.5 text-base leading-relaxed" style={{ maxWidth: "80%", borderBottomRightRadius: 4 }}>{m.content}</div>
            </div>
          ) : (
            <div key={i} className="fadein flex items-end justify-start gap-1.5">
              <div className={`rounded-2xl px-4 py-2.5 text-base leading-relaxed ${m.err ? "bg-rose-50 text-rose-600" : "bg-white text-stone-800 shadow-sm"}`} style={{ maxWidth: "80%", borderBottomLeftRadius: 4 }}>{m.content}</div>
              {hasTTS && !m.err && (
                <button onClick={() => speak(m.content, true)} className="mb-1 text-stone-300 hover:text-stone-600"><Volume2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
          {waiting && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-3 shadow-sm" style={{ borderBottomLeftRadius: 4 }}>
                <span className="h-2 w-2 animate-bounce rounded-full bg-stone-300" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-stone-300" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-stone-300" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-stone-200 bg-white px-5 py-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={listening ? t("Listening…", "أستمع…") : t("Speak or type to the patient…", "تحدّث أو اكتب للمريض…")}
              className="field max-h-32 flex-1 resize-none rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-900 placeholder:text-stone-400"
            />
            {hasSpeech && (
              <button onClick={onMic} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${listening ? "live-dot bg-rose-600 text-white" : "border border-stone-300 text-stone-600 hover:border-stone-400"}`}>
                {listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
            <button onClick={send} disabled={waiting || !input.trim()} className="pine flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><Send className="h-5 w-5" /></button>
          </div>
          {micDenied && <p className="mt-2 text-xs text-stone-400">{t("Microphone is blocked here. Type instead, or open this in its own browser tab to allow the mic.", "الميكروفون محجوب هنا. اكتب بدلًا من ذلك، أو افتح هذا في تبويب مستقل للسماح بالميكروفون.")}</p>}
          {!hasSpeech && <p className="mt-2 text-xs text-stone-400">{t("Voice input isn't available in this browser — typing works fully.", "الإدخال الصوتي غير متاح في هذا المتصفح — الكتابة تعمل بالكامل.")}</p>}
        </div>
      </div>
    );
  }

  function Results() {
    if (scoring) return (
      <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
        <Loader2 className="pine-text h-8 w-8 animate-spin" />
        <p className="disp mt-4 text-lg text-stone-700">{t("The examiner is marking your encounter…", "يقوم الممتحِن بتصحيح مقابلتك…")}</p>
        <p className="mt-1 text-sm text-stone-400">{t("Scoring against the OSCE rubric", "التصحيح وفق سلّم الـ OSCE")}</p>
      </div>
    );
    if (scoreError || !feedback) return (
      <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="mt-4 text-stone-700">{t("Couldn't read the examiner's report.", "تعذّر قراءة تقرير الممتحِن.")}</p>
        <button onClick={scoreNow} className="mt-4 flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-700"><RotateCcw className="h-4 w-4" />{t("Try scoring again", "أعد التصحيح")}</button>
      </div>
    );

    const verdict = (feedback.verdict || "").toLowerCase();
    const vColor = verdict.includes("clear") || verdict.includes("pass") ? "bg-emerald-100 text-emerald-700" : verdict.includes("border") ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
    const overall = Math.max(0, Math.min(100, Number(feedback.overall) || 0));
    const barColor = overall >= 70 ? "bg-emerald-500" : overall >= 50 ? "bg-amber-500" : "bg-rose-500";

    return (
      <div className="px-5 py-8">
        <button onClick={() => setView("home")} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" />{t("All stations", "كل المحطّات")}</button>
        <p className="mono text-xs font-medium uppercase tracking-widest text-stone-400">{t("Mark sheet", "بطاقة العلامات")} · {t(activeCase.titleEn, activeCase.titleAr)}</p>

        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-end justify-between">
            <div><span className="disp text-5xl font-semibold text-stone-900">{overall}</span><span className="mono text-2xl text-stone-300">/100</span></div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${vColor}`}>{feedback.verdict || "—"}</span>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${barColor}`} style={{ width: overall + "%" }} /></div>
        </div>

        {(feedback.domains || []).map((d, di) => {
          const max = Number(d.max) || (d.items || []).length || 1;
          const sc = Number(d.scored) || 0;
          const pct = Math.round((sc / max) * 100);
          return (
            <div key={di} className="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="disp text-lg font-semibold">{d.name}</p>
                <p className="mono text-sm font-semibold text-stone-500">{sc}/{max}</p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100"><div className="pine h-full rounded-full" style={{ width: pct + "%" }} /></div>
              <ul className="mt-4 space-y-2.5">
                {(d.items || []).map((it, ii) => (
                  <li key={ii} className="flex items-start gap-2.5">
                    <StatusIcon status={it.status} />
                    <span className="flex-1 text-sm leading-snug">
                      <span className="text-stone-800">{it.text}</span>
                      {it.note && <span className="mt-0.5 block text-xs text-stone-400">{it.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Panel title={t("Did well", "نقاط القوة")} color="emerald" items={feedback.strengths} />
          <Panel title={t("To improve", "للتحسين")} color="rose" items={feedback.improvements} />
        </div>

        {feedback.expected && (
          <div className="soft mt-4 rounded-2xl p-5">
            <p className="mono pine-text text-xs font-medium uppercase tracking-widest">{t("Model approach", "المقاربة النموذجية")}</p>
            <p className="mt-2 text-base leading-relaxed text-stone-800">{feedback.expected}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={beginStation} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 font-semibold text-stone-700 hover:border-stone-400"><RotateCcw className="h-4 w-4" />{t("Retry station", "أعد المحطّة")}</button>
          <button onClick={() => setView("home")} className="pine flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold">{t("Another station", "محطّة أخرى")}<ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    );
  }

  function Faculty() {
    return (
      <div className="px-5 py-8">
        <div className="flex items-center justify-between">
          <p className="mono pine-text text-xs font-medium uppercase tracking-widest">{t("Faculty", "هيئة تدريسية")}</p>
          <button onClick={openStudents} className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900"><Users className="h-4 w-4" />{t("Student progress", "تقدّم الطلاب")}</button>
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="disp text-3xl font-semibold tracking-tight">{t("Your stations", "محطّاتك")}</h1>
          <button onClick={newStation} className="pine flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold"><Plus className="h-4 w-4" />{t("New station", "محطّة جديدة")}</button>
        </div>
        <p className="mt-2 text-sm text-stone-500">{t("Write your own cases, group them by specialty, attach images (ECGs, X-rays, labs), and set the mark scheme. They are shared to every learner and stored in the database.", "اكتب حالاتك الخاصة، وصنّفها حسب التخصّص، وأرفِق صورًا (تخطيط قلب، أشعة، تحاليل)، وحدّد سلّم العلامات. تُشارَك مع كل المتعلّمين وتُحفظ في قاعدة البيانات.")}</p>

        {customCases.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">{t("No stations yet. Create your first to add it to the circuit.", "لا توجد محطّات بعد. أنشئ أوّل محطّة لإضافتها إلى الحلبة.")}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {customCases.map((c) => {
              const items = (c.rubric || []).reduce((s, d) => s + (d.items ? d.items.length : 0), 0);
              const cat = CATEGORIES[c.category] || CATEGORIES.other;
              const nImg = (c.images || []).length;
              return (
                <div key={c.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="disp text-lg font-semibold text-stone-900">{c.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACCENT[cat.accent]}`}>{t(cat.labelEn, cat.labelAr)}</span>
                      </div>
                      <p className="mono mt-1 text-xs text-stone-400">{(c.durationMin || 8) + "m · " + items + " " + t("marks", "علامة") + (nImg ? " · " + nImg + " " + t("images", "صورة") : "")}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => editStation(c)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 text-stone-500 hover:text-stone-900"><Pencil className="h-4 w-4" /></button>
                      {confirmDelete === c.id ? (
                        <button onClick={() => deleteStation(c.id)} className="rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white">{t("Confirm", "تأكيد")}</button>
                      ) : (
                        <button onClick={() => setConfirmDelete(c.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 text-stone-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>
                  <button onClick={() => openBrief(normalizeCustom(c))} className="pine-text mt-3 flex items-center gap-1 text-sm font-semibold">{t("Run station", "ابدأ المحطّة")}<ChevronRight className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function Editor() {
    return (
      <div className="px-5 py-8">
        <button onClick={() => setView("faculty")} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" />{t("Faculty", "هيئة تدريسية")}</button>
        <h1 className="disp text-3xl font-semibold tracking-tight">{editingId ? t("Edit station", "تعديل المحطّة") : t("New station", "محطّة جديدة")}</h1>

        <div className="mt-6 space-y-5">
          <Labeled label={t("Title", "العنوان")}>
            <input value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} placeholder={t("e.g. Shortness of breath", "مثال: ضيق نفس")} className="field w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-base" />
          </Labeled>

          <div className="grid grid-cols-2 gap-4">
            <Labeled label={t("Specialty", "التخصّص")}>
              <select value={draft.category} onChange={(e) => updateDraft({ category: e.target.value })} className="field w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-base">
                {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{t(CATEGORIES[k].labelEn, CATEGORIES[k].labelAr)}</option>)}
              </select>
            </Labeled>
            <Labeled label={t("Minutes", "الدقائق")}>
              <input type="number" min="1" value={draft.durationMin} onChange={(e) => updateDraft({ durationMin: e.target.value })} className="field w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-base" />
            </Labeled>
          </div>

          <Labeled label={t("Candidate instructions", "تعليمات المرشّح")} hint={t("What the student reads before the station.", "ما يقرأه الطالب قبل المحطّة.")}>
            <textarea value={draft.task} onChange={(e) => updateDraft({ task: e.target.value })} rows={3} placeholder={t("You are the doctor in clinic. Take a focused history…", "أنت الطبيب في العيادة. خذ قصة مرضية مركزة…")} className="field w-full resize-none rounded-lg border border-stone-300 px-3.5 py-2.5 text-base" />
          </Labeled>

          <Labeled label={t("Patient background", "خلفية المريض")} hint={t("The patient's story. Used only by the free AI fallback when no scripted reply matches.", "قصة المريض. تُستخدم فقط من الذكاء الاصطناعي الاحتياطي عند عدم تطابق أي رد مكتوب.")}>
            <textarea value={draft.brief} onChange={(e) => updateDraft({ brief: e.target.value })} rows={5} placeholder={t("You are a 30-year-old with a cough for 5 days… Reveal each detail only when asked.", "أنت مريض عمره 30 عامًا تعاني من سعال منذ 5 أيام… اكشف كل تفصيل فقط عند سؤالك.")} className="field w-full resize-none rounded-lg border border-stone-300 px-3.5 py-2.5 text-base" />
          </Labeled>

          {/* ---- scripted patient replies ---- */}
          <div>
            <div className="flex items-center justify-between">
              <p className="mono text-xs font-medium uppercase tracking-widest text-stone-400">{t("Scripted replies", "الردود المكتوبة")}</p>
              <button onClick={addResponse} className="pine-text flex items-center gap-1 text-sm font-semibold"><Plus className="h-4 w-4" />{t("Reply", "رد")}</button>
            </div>
            <p className="mt-1 text-xs text-stone-400">{t("When the student's question contains any of the keywords, the patient gives that reply — free and instant. Anything unmatched falls back to the AI.", "عندما يحتوي سؤال الطالب على أي من الكلمات المفتاحية، يردّ المريض بهذا الرد — مجانًا وفورًا. وما لا يتطابق يُحال إلى الذكاء الاصطناعي.")}</p>

            <div className="mt-3 space-y-3">
              {(draft.responses || []).map((r, i) => (
                <div key={i} className="rounded-xl border border-stone-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <input value={r.keywords} onChange={(e) => setResponse(i, "keywords", e.target.value)} placeholder={t("Keywords, comma-separated (e.g. where, location, point)", "كلمات مفتاحية مفصولة بفواصل")} className="field flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                    {(draft.responses.length > 1) && <button onClick={() => removeResponse(i)} className="shrink-0 text-stone-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <textarea value={r.reply} onChange={(e) => setResponse(i, "reply", e.target.value)} rows={2} placeholder={t("Patient's reply…", "رد المريض…")} className="field mt-2 w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Labeled label={t("Fallback line", "رد افتراضي")} hint={t("Said when nothing matches and the AI is unavailable.", "يُقال عند عدم التطابق وغياب الذكاء الاصطناعي.")}>
                <input value={draft.fallback} onChange={(e) => updateDraft({ fallback: e.target.value })} placeholder={t("Sorry, could you ask that another way?", "آسف، هل يمكنك إعادة صياغة السؤال؟")} className="field w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </Labeled>
              <Labeled label={t("Model approach (shown after)", "المقاربة النموذجية")}>
                <input value={draft.expected} onChange={(e) => updateDraft({ expected: e.target.value })} placeholder={t("Likely diagnosis / ideal plan", "التشخيص المرجّح / الخطة المثلى")} className="field w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </Labeled>
            </div>
          </div>

          {/* ---- investigations / images ---- */}
          <div>
            <div className="flex items-center justify-between">
              <p className="mono text-xs font-medium uppercase tracking-widest text-stone-400">{t("Investigations / images", "الفحوصات / الصور")}</p>
              <div className="flex items-center gap-2">
                {(draft.category === "cardio") && (
                  <button onClick={addEcgDemo} className="pine-text flex items-center gap-1 text-sm font-semibold"><Heart className="h-4 w-4" />{t("Add demo ECG", "أضف تخطيطًا تجريبيًا")}</button>
                )}
                <label className="pine-text flex cursor-pointer items-center gap-1 text-sm font-semibold">
                  <Plus className="h-4 w-4" />{t("Upload image", "ارفع صورة")}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImageFiles(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
            </div>
            <p className="mt-1 text-xs text-stone-400">{t("Attach an ECG, X-ray, photo or lab report. Learners open these under Investigations during the encounter.", "أرفِق تخطيط قلب أو أشعة أو صورة أو تقرير تحاليل. يفتحها الطلاب ضمن الفحوصات أثناء المقابلة.")}</p>

            {(draft.images || []).length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {draft.images.map((im, i) => (
                  <div key={i} className="rounded-xl border border-stone-200 bg-white p-2">
                    <button onClick={() => setLightbox(im)} className="block w-full"><img src={im.src} alt={im.label} className="h-24 w-full rounded-lg bg-stone-50 object-cover" /></button>
                    <div className="mt-2 flex items-center gap-1">
                      <input value={im.label} onChange={(e) => setImageLabel(i, e.target.value)} placeholder={t("Label (e.g. ECG)", "تسمية (مثل ECG)")} className="field w-full rounded-md border border-stone-200 px-2 py-1 text-xs" />
                      <button onClick={() => removeImage(i)} className="shrink-0 text-stone-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="mono text-xs font-medium uppercase tracking-widest text-stone-400">{t("Mark scheme", "سلّم العلامات")}</p>
              <button onClick={addDomain} className="pine-text flex items-center gap-1 text-sm font-semibold"><Plus className="h-4 w-4" />{t("Domain", "مجال")}</button>
            </div>

            <div className="mt-3 space-y-4">
              {draft.rubric.map((dm, di) => (
                <div key={di} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <input value={dm.name} onChange={(e) => setDomainName(di, e.target.value)} placeholder={t("Domain name (e.g. History)", "اسم المجال (مثل: القصة)")} className="field flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold" />
                    {draft.rubric.length > 1 && <button onClick={() => removeDomain(di)} className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <div className="mt-3 space-y-3">
                    {dm.items.map((it, ii) => (
                      <div key={ii} className="flex items-start gap-2">
                        <span className="mono mt-2.5 text-xs text-stone-300">{ii + 1}</span>
                        <div className="flex-1 space-y-1.5">
                          <input value={it.text} onChange={(e) => setItem(di, ii, "text", e.target.value)} placeholder={t("Checklist item", "بند التقييم")} className="field w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                          <input value={it.keywords} onChange={(e) => setItem(di, ii, "keywords", e.target.value)} placeholder={t("Scoring keywords, comma-separated (leave blank = not auto-scored)", "كلمات التصحيح مفصولة بفواصل (اتركها فارغة = لا يُصحَّح تلقائيًا)")} className="field w-full rounded-lg border border-dashed border-stone-200 px-3 py-1.5 text-xs text-stone-600" />
                        </div>
                        {dm.items.length > 1 && <button onClick={() => removeItem(di, ii)} className="mt-2 text-stone-300 hover:text-rose-600"><X className="h-4 w-4" /></button>}
                      </div>
                    ))}
                    <button onClick={() => addItem(di)} className="flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"><Plus className="h-3.5 w-3.5" />{t("Add item", "أضف بندًا")}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editorError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{editorError}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setView("faculty")} className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 font-semibold text-stone-700 hover:border-stone-400">{t("Cancel", "إلغاء")}</button>
            <button onClick={saveDraft} className="pine flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold"><Check className="h-4 w-4" />{t("Save station", "حفظ المحطّة")}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- learner progress dashboard ----
  function Progress() {
    const list = myAttempts;
    const n = list.length;
    const avg = n ? Math.round(list.reduce((s, a) => s + (a.overall || 0), 0) / n) : 0;
    const passes = list.filter((a) => /pass/i.test(a.verdict || "")).length;
    const byCat = {};
    list.forEach((a) => { const k = a.category || "other"; (byCat[k] = byCat[k] || []).push(a.overall || 0); });

    return (
      <div className="px-5 py-8">
        <button onClick={() => setView("home")} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" />{t("All stations", "كل المحطّات")}</button>
        <p className="mono pine-text text-xs font-medium uppercase tracking-widest">{t("My progress", "تقدّمي")}</p>
        <h1 className="disp mt-2 text-3xl font-semibold tracking-tight">{user?.name || t("Your dashboard", "لوحتك")}</h1>

        {attemptsLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="pine-text h-7 w-7 animate-spin" /></div>
        ) : n === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">{t("No attempts yet. Finish a station and your score appears here.", "لا توجد محاولات بعد. أكمل محطّة وستظهر علامتك هنا.")}</p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label={t("Attempts", "المحاولات")} value={n} />
              <Stat label={t("Average", "المعدّل")} value={avg + "%"} />
              <Stat label={t("Passes", "نجاحات")} value={`${passes}/${n}`} />
            </div>

            <p className="mono mt-8 text-xs font-medium uppercase tracking-widest text-stone-400">{t("Average by specialty", "المعدّل حسب التخصّص")}</p>
            <div className="mt-3 space-y-3">
              {Object.keys(byCat).map((k) => {
                const arr = byCat[k]; const a = Math.round(arr.reduce((s, x) => s + x, 0) / arr.length);
                const cat = CATEGORIES[k] || CATEGORIES.other;
                return (
                  <div key={k} className="rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACCENT[cat.accent]}`}>{t(cat.labelEn, cat.labelAr)}</span>
                      <span className="mono font-semibold text-stone-600">{a}% · {arr.length}×</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100"><div className="pine h-full rounded-full" style={{ width: a + "%" }} /></div>
                  </div>
                );
              })}
            </div>

            <p className="mono mt-8 text-xs font-medium uppercase tracking-widest text-stone-400">{t("History", "السجل")}</p>
            <div className="mt-3 space-y-2">
              {list.map((a) => <AttemptCard key={a.id} a={a} />)}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- faculty: every student's attempts ----
  function Students() {
    const groups = {};
    facultyAttempts.forEach((a) => { const k = a.userEmail || a.userId; (groups[k] = groups[k] || { email: a.userEmail, name: a.userName, items: [] }).items.push(a); });
    const students = Object.values(groups);

    return (
      <div className="px-5 py-8">
        <button onClick={() => setView("faculty")} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" />{t("Faculty", "هيئة تدريسية")}</button>
        <p className="mono pine-text text-xs font-medium uppercase tracking-widest">{t("Faculty", "هيئة تدريسية")}</p>
        <h1 className="disp mt-2 text-3xl font-semibold tracking-tight">{t("Student progress", "تقدّم الطلاب")}</h1>

        {attemptsLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="pine-text h-7 w-7 animate-spin" /></div>
        ) : students.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">{t("No student attempts recorded yet.", "لم تُسجَّل محاولات للطلاب بعد.")}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {students.map((s, i) => {
              const arr = s.items; const a = Math.round(arr.reduce((x, y) => x + (y.overall || 0), 0) / arr.length);
              return (
                <details key={i} className="rounded-xl border border-stone-200 bg-white p-4">
                  <summary className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-stone-900">{s.name || s.email}</span>
                      <span className="block truncate text-xs text-stone-400">{s.email}</span>
                    </span>
                    <span className="mono shrink-0 text-sm font-semibold text-stone-500">{a}% · {arr.length}×</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    {arr.map((at) => <AttemptCard key={at.id} a={at} />)}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // A single attempt row that expands to show the full transcript.
  function AttemptCard({ a }) {
    const v = (a.verdict || "").toLowerCase();
    const vColor = v.includes("pass") ? "bg-emerald-100 text-emerald-700" : v.includes("border") ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
    const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString(ar ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" }) : "";
    return (
      <details className="rounded-xl border border-stone-200 bg-white p-3">
        <summary className="flex cursor-pointer items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium text-stone-800">{a.stationTitle || t("Station", "محطّة")}</span>
            <span className="block text-xs text-stone-400">{date}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {a.verdict && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${vColor}`}>{a.verdict}</span>}
            <span className="disp text-xl font-semibold text-stone-900">{a.overall ?? "—"}</span>
          </span>
        </summary>
        {(a.domains || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {a.domains.map((d, i) => <span key={i} className="mono rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">{d.name}: {d.scored}/{d.max}</span>)}
          </div>
        )}
        {(a.transcript || []).length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
            <p className="mono text-xs font-medium uppercase tracking-widest text-stone-400">{t("Transcript", "النص")}</p>
            {a.transcript.map((m, i) => (
              <p key={i} className="text-sm leading-snug">
                <span className={`font-semibold ${m.role === "student" ? "pine-text" : "text-stone-500"}`}>{m.role === "student" ? t("Doctor", "الطبيب") : t("Patient", "المريض")}: </span>
                <span className="text-stone-700">{m.content}</span>
              </p>
            ))}
          </div>
        )}
      </details>
    );
  }
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 text-center">
      <p className="disp text-3xl font-semibold text-stone-900">{value}</p>
      <p className="mono mt-1 text-xs uppercase tracking-widest text-stone-400">{label}</p>
    </div>
  );
}

function Labeled({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mono text-xs font-medium uppercase tracking-widest text-stone-400">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-stone-400">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function StatusIcon({ status }) {
  if (status === "done") return <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check className="h-3.5 w-3.5" /></span>;
  if (status === "partial") return <span className="mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-600">~</span>;
  if (status === "na") return <span className="mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 font-bold text-stone-400">–</span>;
  return <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500"><X className="h-3.5 w-3.5" /></span>;
}

function Panel({ title, color, items }) {
  const head = color === "emerald" ? "text-emerald-700" : "text-rose-600";
  const dot = color === "emerald" ? "text-emerald-500" : "text-rose-400";
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className={`mono text-xs font-medium uppercase tracking-widest ${head}`}>{title}</p>
      <ul className="mt-3 space-y-2">
        {list.length === 0 && <li className="text-sm text-stone-400">—</li>}
        {list.map((s, i) => <li key={i} className="flex gap-2 text-sm leading-snug text-stone-700"><span className={dot}>•</span><span>{s}</span></li>)}
      </ul>
    </div>
  );
}
