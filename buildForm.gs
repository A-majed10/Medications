/**
 * LAU Medical Education Study – Google Form Builder (optimized)
 * Paste into Google Apps Script (script.google.com or Forms → Extensions →
 * Apps Script), then Run → buildForm(). Grant permissions when prompted.
 *
 * This version is data-driven: the whole questionnaire is described by the
 * SCHEMA array below and rendered by a single loop. Adding, reordering, or
 * editing a question means editing data, not code. Output is identical to the
 * hand-written version (same titles, choices, required flags, and order).
 */

// ── Reusable choice sets ────────────────────────────────────────────────────
var YES_NO       = ['Yes', 'No'];
var DAYS_0_7     = function (zeroLabel) {
  return [zeroLabel, '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days'];
};
var FREQ         = ['Not during the past month', 'Less than once a week', 'Once or twice a week', 'Three or more times a week'];
var FREQ_NA      = ['Not applicable'].concat(FREQ);
var K10          = ['1 – None of the time', '2 – A little of the time', '3 – Some of the time', '4 – Most of the time', '5 – All of the time'];

// ── Tiny builders that turn data into schema rows ───────────────────────────
function header(title, help)            { return { kind: 'header', title: title, help: help }; }
function page(title, help)              { return { kind: 'page',   title: title, help: help }; }
function text(title, required)          { return { kind: 'text',   title: title, required: required !== false }; }
function mc(title, choices, opt)        { opt = opt || {}; return { kind: 'mc',     title: title, choices: choices, help: opt.help, required: opt.required !== false }; }
function checkbox(title, choices, opt)  { opt = opt || {}; return { kind: 'check',  title: title, choices: choices, help: opt.help, required: opt.required !== false }; }

// Expand a list of "stem" strings into numbered/lettered MC rows sharing choices.
function mcList(stems, choices, opt) {
  return stems.map(function (s) { return mc(s, choices, opt); });
}

// MEDAS rows: data carries the question, an optional hint, and optional choices
// (defaults to Yes/No). Auto-numbered 1..N.
function medasRows(items) {
  return items.map(function (it, i) {
    return mc((i + 1) + '. ' + it.q, it.choices || YES_NO, { help: it.hint });
  });
}

// ── Questionnaire definition ────────────────────────────────────────────────
function buildSchema() {
  return [].concat(
    // SECTION 1 — DEMOGRAPHICS ------------------------------------------------
    header('SECTION 1: Demographic Information', 'Please fill in or select the appropriate response.'),
    text('Age (years)'),
    mc('Sex', ['Male', 'Female', 'Prefer not to say']),
    mc('Current year of medical school', ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']),
    mc('Primary mode of education during the last academic year', ['Entirely in-person', 'Entirely online', 'Hybrid (both in-person and online)']),
    mc('Residential status during the last academic year', ['Living with family', 'Living alone', 'Living with roommates/peers']),
    mc('Governorate of current residence', ['Beirut', 'Mount Lebanon', 'North Lebanon', 'South Lebanon', 'Bekaa', 'Nabatieh', 'Akkar', 'Baalbek-Hermel']),
    text('Height (cm)'),
    text('Weight (kg)'),

    // SECTION 2 — MEDAS -------------------------------------------------------
    page('SECTION 2: Mediterranean Diet Adherence Screener (MEDAS)',
      'The following 14 questions relate to your usual eating habits over the past month. Please answer each question honestly.\n\nNote: A score of 1 is given for each response that meets the stated criterion. Total score ranges from 0–14; a score ≥ 7 indicates high Mediterranean diet adherence.'),
    medasRows([
      { q: 'Do you use olive oil as the main culinary fat?', hint: 'Criterion for 1 point: Yes' },
      { q: 'How much olive oil do you consume per day (including oil used for frying, salads, or out-of-house meals)?', hint: 'Criterion for 1 point: ≥ 4 tablespoons per day', choices: ['Less than 4 tablespoons', '4 tablespoons or more'] },
      { q: 'How many servings of vegetables do you consume per day? (1 serving ≈ 200 g; count side dishes as half a serving)', hint: 'Criterion for 1 point: ≥ 2 servings, with at least 1 raw or as a salad', choices: ['Fewer than 2 servings', '2 or more servings (at least 1 raw or as a salad)'] },
      { q: 'How many fruit units (including natural fruit juices) do you consume per day?', hint: 'Criterion for 1 point: ≥ 3 units per day', choices: ['Fewer than 3 units', '3 or more units'] },
      { q: 'How many servings of red meat, hamburger, or processed meat products (ham, sausage, etc.) do you consume per day? (1 serving ≈ 100–150 g)', hint: 'Criterion for 1 point: Less than 1 serving per day', choices: ['Less than 1 serving per day', '1 or more servings per day'] },
      { q: 'How many servings of butter, margarine, or cream do you consume per day? (1 serving ≈ 12 g)', hint: 'Criterion for 1 point: Less than 1 serving per day', choices: ['Less than 1 serving per day', '1 or more servings per day'] },
      { q: 'How many sweet or carbonated beverages do you drink per day?', hint: 'Criterion for 1 point: Less than 1 drink per day', choices: ['Less than 1 drink per day', '1 or more drinks per day'] },
      { q: 'How much wine do you drink per week?', hint: 'Criterion for 1 point: ≥ 7 glasses per week', choices: ['Fewer than 7 glasses per week', '7 or more glasses per week', 'I do not drink alcohol'] },
      { q: 'How many servings of legumes do you consume per week? (1 serving ≈ 150 g)', hint: 'Criterion for 1 point: ≥ 3 servings per week', choices: ['Fewer than 3 servings', '3 or more servings'] },
      { q: 'How many servings of fish or shellfish do you consume per week? (1 serving ≈ 100–150 g fish or 4–5 units / 200 g shellfish)', hint: 'Criterion for 1 point: ≥ 3 servings per week', choices: ['Fewer than 3 servings', '3 or more servings'] },
      { q: 'How many times per week do you consume commercial sweets or pastries (not homemade), such as cakes, cookies, biscuits, or custard?', hint: 'Criterion for 1 point: Fewer than 3 times per week', choices: ['Fewer than 3 times per week', '3 or more times per week'] },
      { q: 'How many servings of nuts (including peanuts) do you consume per week? (1 serving ≈ 30 g)', hint: 'Criterion for 1 point: ≥ 3 servings per week', choices: ['Fewer than 3 servings', '3 or more servings'] },
      { q: 'Do you preferentially consume chicken, turkey, or rabbit instead of veal, pork, hamburger, or sausage?', hint: 'Criterion for 1 point: Yes' },
      { q: 'How many times per week do you consume vegetables, pasta, rice, or other dishes seasoned with sofrito (a sauce made with tomato, onion, leek, or garlic simmered in olive oil)?', hint: 'Criterion for 1 point: ≥ 2 times per week', choices: ['Fewer than 2 times per week', '2 or more times per week'] }
    ]),

    // SECTION 3 — IPAQ-SF -----------------------------------------------------
    page('SECTION 3: International Physical Activity Questionnaire – Short Form (IPAQ-SF)',
      'The following questions ask about your physical activity during the last 7 days. Please answer each question even if you do not consider yourself an active person. Think only about physical activities performed for at least 10 minutes at a time.'),
    header('Vigorous Physical Activity', 'Vigorous activities take hard physical effort and make you breathe much harder than normal (e.g., heavy lifting, digging, aerobics, fast bicycling).'),
    mc('1. During the last 7 days, on how many days did you do vigorous physical activities?', DAYS_0_7('0 days (no vigorous physical activity)')),
    text('2. On days when you did vigorous physical activity, how much time did you usually spend? (Enter hours and/or minutes, e.g., "1 hour 30 minutes". Write N/A if no vigorous activity.)'),
    header('Moderate Physical Activity', 'Moderate activities take moderate physical effort and make you breathe somewhat harder than normal (e.g., carrying light loads, bicycling at a regular pace, doubles tennis). Do NOT include walking.'),
    mc('3. During the last 7 days, on how many days did you do moderate physical activities?', DAYS_0_7('0 days (no moderate physical activity)')),
    text('4. On days when you did moderate physical activity, how much time did you usually spend? (Enter hours and/or minutes, e.g., "45 minutes". Write N/A if no moderate activity.)'),
    header('Walking', 'Include walking at work, at home, to travel from place to place, or for recreation, sport, exercise, or leisure.'),
    mc('5. During the last 7 days, on how many days did you walk for at least 10 minutes at a time?', DAYS_0_7('0 days (no walking)')),
    text('6. On days when you walked, how much time did you usually spend walking? (Enter hours and/or minutes. Write N/A if no walking.)'),
    header('Sitting Time', 'Include time at work, at home, during coursework, and during leisure (e.g., sitting at a desk, visiting friends, reading, watching television).'),
    text('7. During the last 7 days, how much time did you spend sitting on a typical weekday? (Enter hours and/or minutes, e.g., "8 hours")'),

    // SECTION 4 — PSQI --------------------------------------------------------
    page('SECTION 4: Pittsburgh Sleep Quality Index (PSQI)',
      'The following questions relate to your usual sleep habits during the past month only. Please answer all questions based on the majority of days and nights in the past month.'),
    text('1. During the past month, what time have you usually gone to bed at night? (e.g., 11:30 PM)'),
    text('2. During the past month, how long (in minutes) has it usually taken you to fall asleep each night?'),
    text('3. During the past month, what time have you usually gotten up in the morning? (e.g., 7:00 AM)'),
    text('4. During the past month, how many hours of actual sleep did you get at night? (This may differ from time spent in bed.)'),
    header('5. During the past month, how often have you had trouble sleeping because you...', 'Please answer all sub-items below.'),
    mcList([
      '5a. Cannot get to sleep within 30 minutes',
      '5b. Wake up in the middle of the night or early morning',
      '5c. Have to get up to use the bathroom',
      '5d. Cannot breathe comfortably',
      '5e. Cough or snore loudly',
      '5f. Feel too cold',
      '5g. Feel too hot',
      '5h. Had bad dreams',
      '5i. Have pain'
    ], FREQ),
    text('5j. Other reason(s) causing sleep trouble – please describe (write "None" if not applicable)'),
    mc('5j (frequency). If you listed another reason above, how often did it cause sleep trouble?', FREQ_NA),
    mc('6. During the past month, how would you rate your sleep quality overall?', ['Very good', 'Fairly good', 'Fairly bad', 'Very bad']),
    mc('7. During the past month, how often have you taken medicine to help you sleep (prescribed or over-the-counter)?', FREQ),
    mc('8. During the past month, how often have you had trouble staying awake while driving, eating meals, or engaging in social activity?', FREQ),
    mc('9. During the past month, how much of a problem has it been for you to keep up enough enthusiasm to get things done?', ['No problem at all', 'Only a very slight problem', 'Somewhat of a problem', 'A very big problem']),
    mc('10. Do you have a bed partner or roommate?', ['No bed partner or roommate', 'Partner/roommate in other room', 'Partner in same room, but not same bed', 'Partner in same bed']),
    header('Partner/Roommate Observations (Items 10a–10e)', 'If you have a bed partner or roommate, ask them how often in the past month you have had the following. If you do not have a partner or roommate, select "Not applicable".'),
    mcList([
      '10a. Loud snoring',
      '10b. Long pauses between breaths while you sleep',
      '10c. Legs twitching or jerking while you sleep',
      '10d. Episodes of disorientation or confusion during sleep'
    ], FREQ_NA),
    text('10e. Other restlessness while you sleep – please describe (write "None" or "Not applicable")'),

    // SECTION 5 — K10 ---------------------------------------------------------
    page('SECTION 5: Kessler Psychological Distress Scale (K10)',
      'The following questions ask about how you have been feeling over the past 30 days. Select the response that best represents how you have been.\n\nScoring: 1 = None of the time → 5 = All of the time. Total score ranges from 10–50.'),
    mcList([
      'feel tired out for no good reason?',
      'feel nervous?',
      'feel so nervous that nothing could calm you down?',
      'feel hopeless?',
      'feel restless or fidgety?',
      'feel so restless you could not sit still?',
      'feel depressed?',
      'feel that everything was an effort?',
      'feel so sad that nothing could cheer you up?',
      'feel worthless?'
    ].map(function (q, i) { return (i + 1) + '. During the last 30 days, About how often did you ' + q; }), K10),

    // SECTION 6 — SCREEN TIME -------------------------------------------------
    page('SECTION 6: Screen Time', 'The following questions ask about your average daily screen time over the past week.'),
    text('1. On a typical day, how many hours do you spend on screens for EDUCATIONAL purposes? (e.g., online lectures, studying, reading academic material)'),
    text('2. On a typical day, how many hours do you spend on screens for RECREATIONAL purposes? (e.g., social media, streaming, gaming, browsing)'),
    text('3. What is your estimated total average daily screen time (educational + recreational combined)?'),
    checkbox('4. Which device(s) do you primarily use for educational screen time? (Select all that apply)', ['Laptop/computer', 'Tablet', 'Smartphone', 'Television', 'Other']),
    mc('5. Which time of day do you most frequently use screens for recreational purposes?', ['Morning (6am–12pm)', 'Afternoon (12pm–6pm)', 'Evening (6pm–10pm)', 'Late night (after 10pm)']),
    mc('6. During the period of online learning, did your recreational screen time increase compared to in-person learning?', ['Yes, significantly', 'Yes, slightly', 'No change', 'No, it decreased']),

    // SECTION 7 — LEBANON STRESSORS -------------------------------------------
    page('SECTION 7: Lebanon-Specific Stressor Inventory',
      'The following questions assess your exposure to stressors specific to the Lebanese context. These items are adapted from validated psychosocial scales and modified for the Lebanese setting. Please answer based on your experience over the past 12 months.'),
    header('A. Economic Stress'),
    mc('1. How would you describe your household\'s financial situation over the past year?', ['Comfortable / No financial stress', 'Mild financial strain', 'Moderate financial difficulty', 'Severe financial hardship']),
    mc('2. Has the Lebanese economic crisis directly affected your ability to access educational resources (e.g., internet, textbooks, tuition)?', ['Not at all', 'Slightly', 'Moderately', 'Severely']),
    mc('3. How frequently have you experienced difficulty affording basic necessities (food, transportation, housing) in the past year?', ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']),
    mc('4. Has currency devaluation or banking restrictions affected your daily life?', ['Not at all', 'Slightly', 'Moderately', 'Severely']),
    header('B. Food Insecurity'),
    mc('5. In the past 12 months, how often did you worry that you would not have enough food to eat?', ['Never', 'Rarely (1–2 times)', 'Sometimes (monthly)', 'Often (weekly)', 'Almost always']),
    mc('6. In the past 12 months, did you skip meals or reduce portion sizes due to financial constraints?', ['Never', 'Rarely', 'Sometimes', 'Often']),
    mc('7. How has the availability of diverse food products in Lebanon affected your diet over the past year?', ['Not at all – my diet has not changed', 'Slightly – minor substitutions', 'Moderately – I eat less variety than before', 'Severely – my diet quality has significantly declined']),
    header('C. Beirut Port Explosion Exposure (August 4, 2020)'),
    mc('8. Were you present in Beirut at the time of the August 4, 2020 port explosion?', YES_NO),
    checkbox('9. Did you personally experience any of the following as a result of the explosion? (Select all that apply)', ['Physical injury (self or family member)', 'Property damage or loss of home', 'Loss of a family member, friend, or colleague', 'Displacement from residence', 'None of the above']),
    mc('10. If exposed to the blast, how much has it continued to affect your psychological wellbeing?', ['Not applicable – I was not present', 'Not at all', 'Slightly', 'Moderately', 'Severely – I still experience significant distress related to this event']),
    header('D. General Perceived Stress'),
    mc('11. Overall, how would you rate the level of stress you have experienced as a medical student in Lebanon over the past academic year?', ['Low', 'Moderate', 'High', 'Extremely high']),
    checkbox('12. Which of the following do you consider to be the most significant source of stress in your life? (Select up to 2)', ['Academic workload', 'Financial insecurity', 'Political instability', 'Family concerns', 'Social isolation / limited social interaction', 'Health concerns (self or family)', 'Other']),
    text('12b. If you selected "Other" above, please specify:', false)
  );
}

// ── Single renderer: schema → Form ──────────────────────────────────────────
function buildForm() {
  var form = FormApp.create('Impact of Online Versus In-Person Medical Education on Dietary Patterns and Lifestyle Behaviors Among Lebanese Medical Students');
  form.setDescription(
    'This questionnaire is part of a study investigating the effects of online versus in-person medical education on dietary patterns and lifestyle behaviors among Lebanese medical students.\n\n' +
    'Participation is entirely voluntary and anonymous. Completing and submitting this questionnaire implies your informed consent to participate.\n\n' +
    'All data collected will be kept strictly confidential and used for research purposes only. The questionnaire takes approximately 15–20 minutes to complete.'
  );
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);

  buildSchema().forEach(function (it) {
    switch (it.kind) {
      case 'header':
        var h = form.addSectionHeaderItem().setTitle(it.title);
        if (it.help) h.setHelpText(it.help);
        break;
      case 'page':
        var p = form.addPageBreakItem().setTitle(it.title);
        if (it.help) p.setHelpText(it.help);
        break;
      case 'text':
        form.addTextItem().setTitle(it.title).setRequired(it.required);
        break;
      case 'mc':
        var m = form.addMultipleChoiceItem().setTitle(it.title).setChoiceValues(it.choices).setRequired(it.required);
        if (it.help) m.setHelpText(it.help);
        break;
      case 'check':
        var c = form.addCheckboxItem().setTitle(it.title).setChoiceValues(it.choices).setRequired(it.required);
        if (it.help) c.setHelpText(it.help);
        break;
    }
  });

  form.setConfirmationMessage(
    'Thank you for completing this questionnaire. Your responses have been recorded and will be kept strictly confidential. We appreciate your participation in this research.'
  );

  Logger.log('✅ Form created successfully!');
  Logger.log('Edit URL: ' + form.getEditUrl());
  Logger.log('Published URL: ' + form.getPublishedUrl());
}
