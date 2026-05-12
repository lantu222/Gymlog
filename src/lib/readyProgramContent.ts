export interface ReadyProgramContentSection {
  kicker: string;
  body: string;
}

export interface ReadyProgramContent {
  summary: string;
  audience: string;
  equipmentProfile: string;
  whyItWorks: string;
  sessionFocusById: Record<string, string>;
}

const READY_PROGRAM_CONTENT: Record<string, ReadyProgramContent> = {
  tpl_3_day_full_body_v1: {
    summary: 'Three full-body sessions built to keep strength practice frequent while overall weekly fatigue stays manageable.',
    audience: 'Best for newer lifters or anyone who wants simple weekly structure with repeated practice on the main lifts.',
    equipmentProfile: 'Full gym recommended: barbell, bench, cable, leg press, and a basic pull station.',
    whyItWorks: 'The template repeats squat, press, pull, and hinge patterns across the week, so progression stays obvious without requiring a complicated split.',
    sessionFocusById: {
      full_body_a: 'Squat + bench anchor day with a clean full-body base.',
      full_body_b: 'Vertical press and pull emphasis with single-leg work.',
      full_body_c: 'Hinge-focused finish that keeps chest and row volume moving.',
    },
  },
  tpl_4_day_upper_lower_v1: {
    summary: 'A balanced upper/lower split with enough weekly volume for hypertrophy while anchor lifts still get clear progression targets.',
    audience: 'Best for intermediate lifters who can train four days per week and want more upper/lower volume than full body gives.',
    equipmentProfile: 'Full gym setup recommended, especially barbells, dumbbells, machines, pulldown, and cable stations.',
    whyItWorks: 'Each pattern gets two exposures per week, which makes recovery predictable and gives you more productive hard sets without turning every day into a marathon.',
    sessionFocusById: {
      upper_a: 'Horizontal press and row emphasis with delt and triceps support.',
      lower_a: 'Squat-first lower day with posterior chain and core work.',
      upper_b: 'Vertical press and pull day with machine chest and arm finishers.',
      lower_b: 'Hinge-led lower day with unilateral work and calves/core support.',
    },
  },
  tpl_5_day_hybrid_v1: {
    summary: 'A higher-frequency hybrid split that mixes upper/lower structure with dedicated push and pull days for more specialization.',
    audience: 'Best for intermediate lifters who recover well, want more gym time each week, and like a body-part feel without losing progression structure.',
    equipmentProfile: 'Full gym required. This template assumes broad equipment access across barbell, machines, dumbbells, and cables.',
    whyItWorks: 'The week opens with heavier compound structure, then adds separate push and pull days so extra volume can land where it actually matters without bloating every session.',
    sessionFocusById: {
      upper_a: 'Heavy upper base with bench and row as anchors.',
      lower_a: 'Squat-led lower day with hinge support and accessories.',
      push: 'Pressing volume and shoulder/triceps specialization.',
      pull: 'Back density, lat work, and biceps volume in one slot.',
      lower_b: 'Second lower exposure centered on hinge work and unilateral balance.',
    },
  },
  tpl_2_day_minimal_full_body_v1: {
    summary: 'A low-friction two-day bodyweight plan for weeks when you want full-body coverage without needing a gym.',
    audience: 'Best for beginners, busy weeks, home workouts, or anyone coming back into training who still wants structure and progression.',
    equipmentProfile: 'Home and bodyweight friendly. Floor space and a sturdy row setup are enough for the core plan.',
    whyItWorks: 'The template keeps squat, push, pull, hinge, and core patterns in the week while using bodyweight progression instead of gym-only equipment.',
    sessionFocusById: {
      minimal_full_body_a: 'Bodyweight squat, incline push-up, inverted row, and trunk work in one clean base session.',
      minimal_full_body_b: 'Lunge, push-up, glute bridge, and conditioning-core work with no machine dependency.',
    },
  },
  tpl_3_day_strength_base_v1: {
    summary: 'A simple strength-first week with three heavy exposures so squat, press, and hinge patterns all progress on repeatable rails.',
    audience: 'Best for newer lifters who want a real strength template without jumping straight into a high-fatigue powerlifting setup.',
    equipmentProfile: 'Full gym recommended, especially barbell stations, a row option, pulldown, and basic lower-body machines.',
    whyItWorks: 'Each session starts with one anchor lift in a low-rep range, then fills the rest of the day with enough secondary work to build support without blunting recovery.',
    sessionFocusById: {
      strength_base_a: 'Heavy squat and bench day with row support.',
      strength_base_b: 'Deadlift and overhead press emphasis with single-leg assistance.',
      strength_base_c: 'Front squat and incline press day to keep progression moving without repeating the same stress twice.',
    },
  },
  tpl_4_day_powerbuilding_v1: {
    summary: 'A four-day powerbuilding plan that lets the week open with strength work and finish with volume that actually builds muscle.',
    audience: 'Best for intermediate lifters who care about the numbers on the bar but still want upper and lower days to look like bodybuilding sessions.',
    equipmentProfile: 'Full gym required, including barbells, dumbbells, pulldown, row stations, and lower-body machines.',
    whyItWorks: 'The split separates performance days from volume days, so the main lifts stay fresh while chest, back, shoulders, and legs still accumulate enough hypertrophy work across the week.',
    sessionFocusById: {
      power_upper_strength: 'Bench and row anchors with overhead strength support.',
      power_lower_strength: 'Squat and hinge day built for lower-body performance.',
      power_upper_volume: 'Upper hypertrophy slot with more chest, back, and arm work.',
      power_lower_volume: 'Second lower day aimed at quad, hinge, and unilateral volume.',
    },
  },
  tpl_2_day_beginner_strength_v1: {
    summary: 'A two-day strength entry point that keeps the lift menu simple while still giving squat, press, hinge, and pull patterns room to progress.',
    audience: 'Best for new lifters who want obvious barbell progress without committing to three or four weekly sessions immediately.',
    equipmentProfile: 'Full gym recommended, but the exercise count stays low enough that each day remains easy to learn and repeat.',
    whyItWorks: 'The plan strips strength work down to the core compounds, so effort goes into repeatable lifts instead of chasing variety too early.',
    sessionFocusById: {
      beginner_strength_a: 'Heavy squat and bench base with a simple row + trunk finish.',
      beginner_strength_b: 'Trap bar and overhead press day with pulling and single-leg support.',
    },
  },

  tpl_3_day_upper_lower_lite_v1: {
    summary: 'A softer three-day upper/lower split that keeps the week balanced without demanding long or overly dense sessions.',
    audience: 'Best for beginners who want something more varied than full body but are not ready for a classic four-day split.',
    equipmentProfile: 'Standard full gym works best, but the session length and exercise count stay modest across the week.',
    whyItWorks: 'The split gives upper body two exposures and lower body one bigger day, which keeps skill practice and recovery both easy to manage.',
    sessionFocusById: {
      upper_lower_lite_upper_a: 'Intro upper day with straightforward pressing, rowing, and vertical work.',
      upper_lower_lite_lower: 'Lower-body anchor day with leg press, hinge work, and simple accessories.',
      upper_lower_lite_upper_b: 'Second upper exposure with machine pressing, rows, and arm/delt finishers.',
    },
  },

  tpl_3_day_push_pull_legs_v1: {
    summary: 'A classic three-day PPL that keeps the split familiar while using simple progression rails instead of random gym-day volume.',
    audience: 'Best for intermediate hypertrophy blocks when you want a recognizable body-part split without drifting into junk volume.',
    equipmentProfile: 'Full gym recommended, especially pressing machines, pulldown/row stations, and a solid lower-body setup.',
    whyItWorks: 'Each day only has one big job to do, so you can push chest/shoulders, back/arms, and legs separately without dragging fatigue through the whole week.',
    sessionFocusById: {
      push_pull_legs_push: 'Chest, shoulders, and triceps pressing day.',
      push_pull_legs_pull: 'Lat, upper-back, rear-delt, and arm volume in one pull slot.',
      push_pull_legs_legs: 'Simple quad, hinge, hamstring, calf, and core lower day.',
    },
  },

  tpl_4_day_muscle_builder_v1: {
    summary: 'A four-day hypertrophy template that stays accessible for newer lifters while still giving enough total volume to grow.',
    audience: 'Best for beginners who want to move past full-body structure into a real upper/lower muscle-building split.',
    equipmentProfile: 'Full gym recommended, especially machines, dumbbells, and basic lower-body stations.',
    whyItWorks: 'The split repeats upper and lower twice each week, but the exercise choices stay beginner-friendly so the training load grows before the complexity does.',
    sessionFocusById: {
      muscle_builder_upper_a: 'Simple machine/dumbbell upper session with chest, lats, and delt/triceps support.',
      muscle_builder_lower_a: 'Back squat and hinge lower day with classic machine assistance.',
      muscle_builder_upper_b: 'Second upper day with bench, row, shoulder work, and arm volume.',
      muscle_builder_lower_b: 'Hack squat and hip thrust day that rounds out glutes, quads, hamstrings, and calves.',
    },
  },

  tpl_4_day_strength_size_v1: {
    summary: 'A four-day block that gives the week clear performance days while still leaving room for enough hypertrophy work to matter.',
    audience: 'Best for intermediate lifters who want more heavy lifting than a pure bodybuilding split, but more growth work than a barebones strength plan.',
    equipmentProfile: 'Full gym required, especially barbells, pulldown/row options, and enough lower-body equipment to support heavy and lighter days.',
    whyItWorks: 'The first half of the week handles the heaviest work, while the second half adds the extra volume that keeps size and exercise tolerance moving forward.',
    sessionFocusById: {
      strength_size_upper_performance: 'Heavy bench + row upper day with vertical support work.',
      strength_size_lower_performance: 'Heavy squat and hinge session with focused lower-body support.',
      strength_size_upper_growth: 'Upper hypertrophy follow-up with more chest, back, delt, and arm work.',
      strength_size_lower_growth: 'Second lower day built around quad, hinge, and unilateral growth volume.',
    },
  },
  tpl_2_day_mobility_reset_v1: {
    summary: 'A low-friction two-day recovery template built around mobility flows, breathing resets, and easy movement quality work.',
    audience: 'Best for recovery weeks, onboarding phases, or anyone who wants a lighter entry point than a full lifting split.',
    equipmentProfile: 'No heavy equipment needed. This program works as a floor-space and bodyweight reset block.',
    whyItWorks: 'The sessions repeat simple mobility patterns and breath work so you build consistency first and only add extra rounds once the whole flow feels natural.',
    sessionFocusById: {
      mobility_reset_a: 'General mobility opener with hips, stretch flow, and a breathing finish.',
      mobility_reset_b: 'Hip and yoga-biased recovery session that keeps the overall load very low.',
    },
  },
  tpl_2_day_yoga_recovery_v1: {
    summary: 'A two-day yoga-oriented recovery block for mobility, balance, breathing, and slower full-body movement practice.',
    audience: 'Best for beginners, mobility-focused weeks, or anyone who wants a calmer movement option inside GAINER.',
    equipmentProfile: 'Mat-friendly and bodyweight-only. No gym setup is required for the core flow of the program.',
    whyItWorks: 'The template uses short repeatable flows instead of complex sequencing, so you can build a steady yoga habit without needing a full studio class every time.',
    sessionFocusById: {
      yoga_recovery_a: 'Sun salutations, balance work, and breathing practice.',
      yoga_recovery_b: 'Stretch-led yoga day with lighter flow volume and reset work.',
    },
  },
  tpl_3_day_run_mobility_v1: {
    summary: 'A beginner-friendly run-and-reset template that pairs interval-based running blocks with mobility and recovery work.',
    audience: 'Best for people who want a simple running entry point inside the current GAINER model without jumping straight into high mileage.',
    equipmentProfile: 'Minimal setup. The running days are structured as simple blocks, and the reset day only needs floor space.',
    whyItWorks: 'Instead of chasing long runs immediately, the plan alternates easy and tempo-style run blocks with a dedicated reset day so your legs and hips can keep up.',
    sessionFocusById: {
      run_mobility_easy: 'Easy run blocks plus lower-leg and mobility support.',
      run_mobility_tempo: 'Tempo-oriented intervals with stride work and breathing reset.',
      run_mobility_reset: 'Mobility and yoga recovery day between the run sessions.',
    },
  },

  tpl_4_day_ppl_plus_v1: {
    summary: 'A four-day PPL+1 split that adds a dedicated upper session to the classic push/pull/legs pattern for more weekly volume without training six days.',
    audience: 'Best for intermediate lifters who have outgrown three-day PPL but are not ready for a full six-day commitment.',
    equipmentProfile: 'Full gym required. The template assumes barbell, dumbbell, cable, pulldown, and machine access throughout.',
    whyItWorks: 'By splitting the fourth day into an upper catch-up rather than a fourth lower day, the template keeps legs from being over-trained while giving chest, back, and arms a meaningful second exposure.',
    sessionFocusById: {
      ppl_plus_push: 'Chest, shoulder, and triceps pressing day with cable fly finisher.',
      ppl_plus_pull: 'Lat, upper-back, rear-delt, and arm volume in one pull session.',
      ppl_plus_legs: 'Quad-led lower day with hinge, hamstring, calf, and core work.',
      ppl_plus_upper: 'Second upper exposure with incline press, rows, shoulder, and arm accessories.',
    },
  },

  tpl_5_day_ppl_v1: {
    summary: 'A five-day PPL block that runs push and pull twice each week and fits a single leg session in the middle so lower-body recovery stays clean.',
    audience: 'Best for intermediate-to-advanced lifters who train five days per week and want a high-volume push/pull structure.',
    equipmentProfile: 'Full gym required across all five days. Cable and machine access is especially important for the second push and pull sessions.',
    whyItWorks: 'Running push and pull patterns twice gives upper body double the exposure without stacking a second heavy leg day that would compromise recovery.',
    sessionFocusById: {
      ppl5_push_a: 'Primary push day with flat bench, overhead press, and triceps work.',
      ppl5_pull_a: 'Primary pull day with deadlift, barbell row, and lat/arm volume.',
      ppl5_legs: 'Full lower-body session with squat, hinge, unilateral, and calf work.',
      ppl5_push_b: 'Second push day focused on incline, cable fly, lateral delt, and triceps accessories.',
      ppl5_pull_b: 'Second pull day with more lat and arm specialization using cables and dumbbells.',
    },
  },

  tpl_5_day_upper_lower_full_v1: {
    summary: 'A five-day plan that runs upper and lower twice each week and caps the week with a full-body session for extra practice and volume.',
    audience: 'Best for intermediate lifters who want to add a fifth day without doubling a single muscle group too aggressively.',
    equipmentProfile: 'Full gym required. The full-body day is deliberately lighter so it works in a gym with standard barbell and machine access.',
    whyItWorks: 'The full-body day acts as a skill and volume buffer — it keeps each pattern in the week three times without loading any of them to the point of impairing recovery.',
    sessionFocusById: {
      ulf5_upper_a: 'Strength-biased upper day with bench, row, and overhead pressing.',
      ulf5_lower_a: 'Squat-led lower day with hinge, unilateral, and core support.',
      ulf5_full: 'Moderate full-body session for practice and volume without heavy loading.',
      ulf5_upper_b: 'Volume-biased upper day with machine pressing, cables, and arm work.',
      ulf5_lower_b: 'Hinge-led lower day with hip thrust, unilateral, and calf finishers.',
    },
  },

  tpl_6_day_ppl_v1: {
    summary: 'The classic six-day PPL double, running push, pull, and legs twice per week for maximum weekly volume and frequency.',
    audience: 'Best for advanced lifters who recover well from high weekly volume and want the most specialization time available in a training week.',
    equipmentProfile: 'Full gym required on all six days. Machine variety is especially helpful on the B sessions where volume peaks.',
    whyItWorks: 'Running the full PPL cycle twice gives every major muscle group two distinct stimuli per week while still keeping individual session length manageable.',
    sessionFocusById: {
      ppl6_push_a: 'Heavy push day anchored by flat bench and overhead press.',
      ppl6_pull_a: 'Heavy pull day anchored by barbell row and weighted pull-ups.',
      ppl6_legs_a: 'Squat-led leg day with Romanian deadlift and single-leg accessories.',
      ppl6_push_b: 'Volume push day with incline, cable fly, lateral delt, and triceps isolation.',
      ppl6_pull_b: 'Volume pull day with cable rows, pulldowns, face pulls, and arm specialization.',
      ppl6_legs_b: 'Hinge-led second leg day with hip thrust, leg curl, calf, and core volume.',
    },
  },

  tpl_6_day_arnold_v1: {
    summary: 'Six days of chest/back, shoulders/arms, and legs — the structure made famous by Arnold Schwarzenegger, updated with modern double-progression rails.',
    audience: 'Best for advanced lifters who enjoy pairing antagonist muscles and want a high-frequency bodybuilding split with strong structural logic.',
    equipmentProfile: 'Full gym required on all six days, especially pressing machines, cables, and a complete lower-body setup.',
    whyItWorks: 'Pairing chest with back and shoulders with arms allows one muscle to recover while its opposite is working, which keeps overall session density high without local fatigue killing effort.',
    sessionFocusById: {
      arnold_chest_back_a: 'Primary chest/back day with bench, barbell row, and cable fly/pulldown support.',
      arnold_shoulders_arms_a: 'Shoulder, biceps, and triceps day with pressing, curls, and extension volume.',
      arnold_legs_a: 'Squat-led leg day with hinge, accessories, and core work.',
      arnold_chest_back_b: 'Second chest/back day with incline press, machine row, and rear-delt accessories.',
      arnold_shoulders_arms_b: 'Second shoulder and arm day with lateral raises, cable curls, and overhead triceps work.',
      arnold_legs_b: 'Hinge-led second leg day with hip thrust, leg curl, and calf finishers.',
    },
  },

  tpl_focus_chest_v1: {
    summary: 'A dedicated chest session with multi-angle pressing and fly work to maximise pec volume in a single visit.',
    audience: 'Best used as an add-on day, a specialization block, or a standalone chest session inside a custom weekly plan.',
    equipmentProfile: 'Requires a flat and incline bench, dumbbells, and ideally a cable or pec-deck machine.',
    whyItWorks: 'The session hits the chest from three angles — flat, incline, and fly — so both the clavicular and sternal heads receive direct work in one efficient block.',
    sessionFocusById: {
      focus_chest: 'Flat bench, incline press, dumbbell fly, and cable fly for full pec coverage.',
    },
  },

  tpl_focus_back_v1: {
    summary: 'A full back session covering lats, upper back, and rear delts with pull, row, and shrug patterns.',
    audience: 'Best as a standalone back day, a supplementary pull session, or part of a custom higher-frequency week.',
    equipmentProfile: 'Requires a pull-up or pulldown station, a barbell or cable row setup, and access to face pull or rear-delt machine.',
    whyItWorks: 'Combining vertical and horizontal pulling patterns with a rear-delt finisher ensures all three primary back regions — lats, mid-back, and posterior delt — are trained in one session.',
    sessionFocusById: {
      focus_back: 'Pull-ups, barbell row, cable row, face pull, and shrug for complete back coverage.',
    },
  },

  tpl_focus_shoulders_v1: {
    summary: 'A shoulder-focused session built around pressing and lateral/rear delt isolation to add weekly delt volume without overloading push days.',
    audience: 'Best for lifters who want more delt development on top of their existing program or as a targeted shoulder day in a custom split.',
    equipmentProfile: 'Requires dumbbells, a barbell or machine press option, and cable or machine access for rear-delt work.',
    whyItWorks: 'Separating pressing from isolation lets the lateral and posterior delts receive direct work rather than relying on carry-over from chest days.',
    sessionFocusById: {
      focus_shoulders: 'Overhead press, lateral raises, face pulls, and rear-delt fly for complete delt coverage.',
    },
  },

  tpl_focus_arms_v1: {
    summary: 'A standalone arm session with biceps curls and triceps extensions across multiple angles for direct arm development.',
    audience: 'Best for lifters who want extra arm volume beyond what push and pull days provide, or anyone running a dedicated arm day.',
    equipmentProfile: 'Requires dumbbells, a barbell or EZ-bar, and cable access for curls and pushdowns.',
    whyItWorks: 'Direct biceps and triceps work in the same session keeps the session short while ensuring both muscle groups get enough stimulus to grow beyond indirect carry-over alone.',
    sessionFocusById: {
      focus_arms: 'Barbell curl, dumbbell curl, triceps pushdown, and skull crusher for full arm volume.',
    },
  },

  tpl_focus_legs_v1: {
    summary: 'A complete leg session with quad, hamstring, glute, and calf work to build lower-body volume in a single dedicated visit.',
    audience: 'Best as a standalone leg day, an add-on session, or the lower-body anchor in a custom split.',
    equipmentProfile: 'Requires a squat rack, leg press, leg curl machine, and calf raise station.',
    whyItWorks: 'The session runs squat, hinge, and unilateral patterns before finishing with isolation, which mirrors the best-practice fatigue order for lower-body compound work.',
    sessionFocusById: {
      focus_legs: 'Back squat, Romanian deadlift, leg press, leg curl, and calf raises for full lower-body coverage.',
    },
  },

  tpl_focus_glutes_v1: {
    summary: 'A glute-focused session built around hip thrust, cable kickback, and Romanian deadlift patterns for targeted posterior chain development.',
    audience: 'Best for lifters who want more glute volume than standard leg days provide, or anyone running a glute specialization phase.',
    equipmentProfile: 'Requires a hip thrust bench or stable surface, a cable machine, and Romanian deadlift access.',
    whyItWorks: 'The session prioritises hip extension patterns that load the glutes at long length, which research consistently shows produces greater hypertrophy than compound carry-over alone.',
    sessionFocusById: {
      focus_glutes: 'Hip thrust, Romanian deadlift, cable kickback, and sumo squat for complete glute work.',
    },
  },

};

export function getReadyProgramContent(templateId: string): ReadyProgramContent | null {
  return READY_PROGRAM_CONTENT[templateId] ?? null;
}
