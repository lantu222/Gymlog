import { AppLanguage } from '../types/models';
import { FALLBACK_READY_PROGRAM_CONTENT_FI, READY_PROGRAM_CONTENT_FI } from './readyProgramContentFi';

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

function buildFallbackReadyProgramContent(templateId: string): ReadyProgramContent | null {
  if (!templateId.startsWith('tpl_gainer_')) {
    return null;
  }

  return {
    summary: 'A structured Vinha program with clear sessions, exercise targets, and progression rules for the selected training profile.',
    audience: 'Best for users whose onboarding choices match this program style, weekly frequency, experience level, and training focus.',
    equipmentProfile: 'Equipment needs follow the exercises in the selected plan. Review the first week before starting if your gym setup is limited.',
    whyItWorks: 'The plan groups related training days into a repeatable weekly structure and keeps sets, reps, and rest targets explicit so progression stays easy to follow.',
    sessionFocusById: {
      [templateId]: 'Structured Vinha training block with focused weekly sessions.',
    },
  };
}

const READY_PROGRAM_CONTENT: Record<string, ReadyProgramContent> = {
  // ── Vinha programs, written against what each one actually contains ──
  tpl_gainer_dream_body_man_v1: {
    summary:
      'A five-day hypertrophy program designed to build a balanced, muscular physique through heavy compound lifts and targeted accessory work.',
    audience:
      'Designed for intermediate lifters who are comfortable with the main compound lifts and want to build muscle across the entire body.',
    equipmentProfile:
      'Requires access to a fully equipped gym with barbells, dumbbells, cable stations, and machines.',
    whyItWorks:
      'A combination of progressive overload, high-quality training volume, and balanced weekly frequency promotes consistent muscle growth and strength gains.',
    sessionFocusById: {
      day_1_chest_triceps: 'Anchored by Barbell Bench Press. 8 more exercises complete the day.',
      day_2_back_biceps: 'Anchored by Weighted Pull-Up. 8 more exercises complete the day.',
      day_3_legs: 'Anchored by Back Squat. 8 more exercises complete the day.',
      day_4_shoulders_abs: 'Anchored by Standing Overhead Press. 8 more exercises complete the day.',
      day_5_arms_weak_points: 'Anchored by Incline Dumbbell Curl. 8 more exercises complete the day.',
    },
  },
  tpl_gainer_beginner_bro_split_v1: {
    summary:
      'A classic four-day bodybuilding split where each major muscle group has its own training day, making workouts simple and easy to follow.',
    audience:
      'Built for beginners who want to learn the fundamentals of resistance training while building muscle with a structured routine.',
    equipmentProfile:
      'Requires standard gym equipment including barbells, dumbbells, cable stations, and resistance machines.',
    whyItWorks:
      'Training one muscle group at a time allows beginners to focus on technique while providing enough volume and recovery for steady progress.',
    sessionFocusById: {
      day_1_chest: 'Anchored by Barbell Bench Press. 6 more exercises complete the day.',
      day_2_back: 'Anchored by Lat Pulldown. 6 more exercises complete the day.',
      day_3_legs: 'Anchored by Back Squat. 6 more exercises complete the day.',
      day_4_shoulders_arms: 'Anchored by Seated Dumbbell Press. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_advanced_ppl_v1: {
    summary:
      'An advanced six-day Push Pull Legs program featuring two weekly rotations to maximize muscle growth and overall performance.',
    audience:
      'Designed for advanced lifters who can recover from high training volume and want to maximize hypertrophy.',
    equipmentProfile:
      'Requires a fully equipped gym with free weights, cable stations, machines, and space for heavy compound lifts.',
    whyItWorks:
      'High weekly frequency, substantial training volume, and varied movement emphasis create a powerful stimulus for whole-body muscle growth.',
    sessionFocusById: {
      push_a_chest_focus: 'Anchored by Barbell Bench Press. 8 more exercises complete the day.',
      pull_a_width_focus: 'Anchored by Deadlift. 8 more exercises complete the day.',
      legs_a_quad_focus: 'Anchored by Back Squat. 8 more exercises complete the day.',
      push_b_shoulder_focus: 'Anchored by Standing Overhead Press. 8 more exercises complete the day.',
      pull_b_thickness_focus: 'Anchored by Pendlay Row. 8 more exercises complete the day.',
      legs_b_posterior_focus: 'Anchored by Conventional Deadlift. 8 more exercises complete the day.',
    },
  },
  tpl_gainer_expert_powerbuilding_v1: {
    summary:
      'A powerbuilding program that combines competition-style powerlifting with bodybuilding-focused accessory training.',
    audience:
      'Built for experienced lifters who want to increase both maximal strength and muscular size.',
    equipmentProfile:
      'Requires a well-equipped gym with power racks, barbells, benches, and a full range of accessory equipment.',
    whyItWorks:
      'Heavy competition lifts build strength while targeted hypertrophy work increases muscle mass and supports long-term performance.',
    sessionFocusById: {
      bench_day: 'Anchored by Competition Bench Press. 7 more exercises complete the day.',
      squat_day: 'Anchored by Competition Back Squat. 7 more exercises complete the day.',
      pull_day: 'Anchored by Weighted Pull-Up. 7 more exercises complete the day.',
      deadlift_day: 'Anchored by Competition Deadlift. 7 more exercises complete the day.',
      press_hypertrophy_pump: 'Anchored by Standing Overhead Press. 8 more exercises complete the day.',
    },
  },
  tpl_gainer_lean_shred_v1: {
    summary:
      'A five-day program combining resistance training, HIIT, and full-body workouts to support fat loss while preserving muscle.',
    audience:
      'Designed for intermediate trainees looking to reduce body fat while maintaining strength and lean muscle mass.',
    equipmentProfile:
      'Requires access to a standard gym along with equipment suitable for high-intensity interval training.',
    whyItWorks:
      'Strength training helps preserve muscle while HIIT increases calorie expenditure and improves cardiovascular fitness.',
    sessionFocusById: {
      upper_push_hiit: 'Anchored by Barbell Bench Press. 7 more exercises complete the day.',
      lower_hiit: 'Anchored by Back Squat. 7 more exercises complete the day.',
      upper_pull_hiit: 'Anchored by Pull-Up. 7 more exercises complete the day.',
      full_body_circuit: 'Anchored by Goblet Squat. 7 more exercises complete the day.',
      hiit_cardio_core: 'Anchored by Hanging Leg Raise. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_dream_body_female_v1: {
    summary:
      'A five-day hypertrophy program focused on building strong glutes, sculpted legs, and a balanced upper body for a well-rounded physique.',
    audience:
      'Designed for intermediate lifters who want to prioritize glute and lower-body development while building upper-body strength and definition.',
    equipmentProfile:
      'Requires a fully equipped gym with barbells, dumbbells, cable stations, and resistance machines.',
    whyItWorks:
      'Frequent glute-focused training with varied loading stimulates muscle growth while maintaining balanced full-body development.',
    sessionFocusById: {
      glutes_hamstrings: 'Anchored by Hip Thrust. 7 more exercises complete the day.',
      upper_body_sculpt: 'Anchored by Dumbbell Shoulder Press. 8 more exercises complete the day.',
      quads_cardio: 'Anchored by Goblet Squat. 7 more exercises complete the day.',
      back_core: 'Anchored by Cable Row. 8 more exercises complete the day.',
      full_body_burn: 'Anchored by Hip Thrust. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_glute_foundations_v1: {
    summary:
      'A three-day beginner program that teaches proper glute activation and builds a strong foundation for long-term progress.',
    audience:
      'Ideal for beginners or those returning to training who want to improve glute strength, muscle growth, and exercise technique.',
    equipmentProfile:
      'Requires basic gym equipment along with resistance bands and light free weights.',
    whyItWorks:
      'The program progresses from activation to strength work, reinforcing proper movement patterns and effective glute engagement.',
    sessionFocusById: {
      glute_activation: 'Anchored by Banded Glute Bridge. 7 more exercises complete the day.',
      lower_body_strength: 'Anchored by Goblet Squat. 6 more exercises complete the day.',
      glute_hypertrophy: 'Anchored by Hip Thrust (Bodyweight or Light Bar). 7 more exercises complete the day.',
    },
  },
  tpl_gainer_advanced_glutes_v1: {
    summary:
      'An advanced five-day program using multiple training styles to maximize glute development and lower-body strength.',
    audience:
      'Designed for experienced lifters seeking maximum glute growth through higher training volume and varied exercise selection.',
    equipmentProfile:
      'Requires a fully equipped gym with free weights, cable stations, machines, and equipment for heavy hip thrusts.',
    whyItWorks:
      'Combining strength, volume, and pump-focused sessions creates a comprehensive stimulus for glute growth and performance.',
    sessionFocusById: {
      heavy_glutes_strength: 'Anchored by Barbell Hip Thrust. 6 more exercises complete the day.',
      upper_body_sculpt: 'Anchored by Lat Pulldown. 7 more exercises complete the day.',
      glute_volume_pump: 'Anchored by Banded Hip Thrust. 7 more exercises complete the day.',
      quads_hamstrings: 'Anchored by Front Squat. 6 more exercises complete the day.',
      glute_finisher: 'Anchored by Single-Leg Hip Thrust. 6 more exercises complete the day.',
    },
  },
  tpl_gainer_hourglass_shape_v1: {
    summary:
      'A four-day program emphasizing glutes, shoulders, and core to build a balanced and well-defined physique.',
    audience:
      'Designed for intermediate lifters looking to develop stronger glutes, broader shoulders, and improved core stability.',
    equipmentProfile:
      'Requires access to a standard gym with free weights, cable stations, and resistance machines.',
    whyItWorks:
      'Strategic training volume for the glutes and shoulders, combined with core work, supports balanced physique development.',
    sessionFocusById: {
      glutes_legs: 'Anchored by Barbell Hip Thrust. 6 more exercises complete the day.',
      shoulders_back_width: 'Anchored by Dumbbell Shoulder Press. 7 more exercises complete the day.',
      glutes_core: 'Anchored by Cable Pull-Through. 7 more exercises complete the day.',
      upper_body_toning: 'Anchored by Incline Dumbbell Press. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_fat_burn_hiit_v1: {
    summary:
      'A four-day HIIT program combining full-body interval training to improve fitness and support fat loss.',
    audience:
      'Built for beginners who want to improve cardiovascular fitness, increase calorie burn, and learn effective interval training.',
    equipmentProfile:
      'Requires dumbbells and a kettlebell. The remaining exercises are done with bodyweight.',
    whyItWorks:
      'Short, high-intensity work intervals elevate heart rate efficiently while improving both aerobic and anaerobic fitness.',
    sessionFocusById: {
      upper_body_hiit: 'Anchored by Push-Up. 6 more exercises complete the day.',
      lower_body_hiit: 'Anchored by Jump Squat. 6 more exercises complete the day.',
      total_body_hiit: 'Anchored by Burpee. 7 more exercises complete the day.',
      tabata_finisher: 'Anchored by Squat Jump (20s on / 10s off). 5 more exercises complete the day.',
    },
  },
  tpl_gainer_mobility_flow_v1: {
    summary:
      'A five-day mobility program designed to improve joint range of motion, reduce stiffness, and support recovery through daily movement.',
    audience:
      'Ideal for beginners and active individuals looking to improve mobility, reduce stiffness, and complement their regular training.',
    equipmentProfile:
      'No gym machines needed. A resistance band and an exercise mat are enough.',
    whyItWorks:
      'Consistent mobility work helps maintain joint function, improve movement quality, and reduce post-training stiffness.',
    sessionFocusById: {
      morning_mobility_full_body: 'Anchored by Cat-Cow. 7 more exercises complete the day.',
      hip_opening_flow: 'Anchored by Pigeon Pose (each side). 7 more exercises complete the day.',
      shoulder_mobility: 'Anchored by Wall Slide. 7 more exercises complete the day.',
      spinal_flexibility: 'Anchored by Cat-Cow. 7 more exercises complete the day.',
      deep_recovery_stretch: 'Anchored by Standing Forward Fold. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_at_home_beginner_v1: {
    summary:
      'A three-day full-body program that builds strength and muscular endurance using primarily bodyweight exercises at home.',
    audience:
      'Designed for beginners and home exercisers who want to start strength training without access to a gym.',
    equipmentProfile:
      'No equipment required. Every workout can be completed using bodyweight alone.',
    whyItWorks:
      'Fundamental movement patterns improve total-body strength, muscular endurance, and movement control without specialized equipment.',
    sessionFocusById: {
      upper_body_bodyweight: 'Anchored by Push-Up (or Knee Push-Up). 6 more exercises complete the day.',
      lower_body_bodyweight: 'Anchored by Bodyweight Squat. 6 more exercises complete the day.',
      full_body_circuit: 'Anchored by Burpee. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_calisthenics_mastery_v1: {
    summary:
      'An advanced calisthenics program focused on building strength, body control, and skills such as the muscle-up, handstand, and planche.',
    audience:
      'Designed for experienced athletes who have mastered the basics of bodyweight training and want to progress to advanced skills.',
    equipmentProfile:
      'Requires a pull-up bar, with gymnastics rings or similar equipment recommended for optimal progression.',
    whyItWorks:
      'Skill progressions combined with progressive bodyweight strength training develop strength, balance, and movement control simultaneously.',
    sessionFocusById: {
      push_handstand_planche_progressions: 'Anchored by Wall Handstand Hold. 7 more exercises complete the day.',
      pull_muscle_up_front_lever: 'Anchored by Weighted Pull-Up. 7 more exercises complete the day.',
      legs_pistol_squats_plyo: 'Anchored by Pistol Squat (each leg). 7 more exercises complete the day.',
      skills_core: 'Anchored by Handstand Wall Walk. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_strength_5x5_v1: {
    summary:
      'A three-day 5x5 strength program centered around the major compound lifts and consistent progressive overload.',
    audience:
      'Perfect for beginners who want to build a solid strength foundation through simple and measurable progression.',
    equipmentProfile:
      'Requires a gym equipped with a barbell, weight plates, a squat rack, and a bench press station.',
    whyItWorks:
      'A small selection of compound lifts combined with straightforward progression promotes rapid technique improvements and steady strength gains.',
    sessionFocusById: {
      workout_a: 'Anchored by Back Squat. 4 more exercises complete the day.',
      workout_b: 'Anchored by Back Squat. 4 more exercises complete the day.',
    },
  },
  tpl_gainer_athlete_conditioning_v1: {
    summary:
      'A five-day athletic performance program combining explosive power, speed, agility, and endurance training.',
    audience:
      'Designed for advanced trainees and athletes seeking to improve overall athletic performance rather than focusing solely on muscle growth.',
    equipmentProfile:
      'Requires a well-equipped gym along with space for sprinting, agility drills, and conditioning work.',
    whyItWorks:
      'Integrating strength, speed, and conditioning creates a well-rounded program that improves athletic performance across multiple physical qualities.',
    sessionFocusById: {
      explosive_lower: 'Anchored by Power Clean. 7 more exercises complete the day.',
      athletic_upper: 'Anchored by Push Press. 7 more exercises complete the day.',
      speed_agility: 'Anchored by Sprint 40m. 7 more exercises complete the day.',
      strength_circuit: 'Anchored by Front Squat. 7 more exercises complete the day.',
      endurance_conditioning: 'Anchored by Rowing Machine (500m intervals). 7 more exercises complete the day.',
    },
  },
  tpl_gainer_strong_lean_female_v1: {
    summary:
      'A four-day strength-focused program designed to build a strong, athletic physique through compound lifts and balanced hypertrophy training.',
    audience:
      'Designed for intermediate lifters who want to increase strength, build lean muscle, and improve full-body performance.',
    equipmentProfile:
      'Requires a standard gym with barbells, dumbbells, cable stations, and resistance machines.',
    whyItWorks:
      'Heavy compound lifts build strength while accessory exercises improve muscular balance and support long-term progress.',
    sessionFocusById: {
      upper_body_strength: 'Anchored by Barbell Bench Press. 7 more exercises complete the day.',
      lower_body_strength: 'Anchored by Back Squat. 6 more exercises complete the day.',
      push_core: 'Anchored by Incline Dumbbell Press. 7 more exercises complete the day.',
      pull_conditioning: 'Anchored by Barbell Row. 7 more exercises complete the day.',
    },
  },
  tpl_gainer_joint_friendly_v1: {
    summary:
      'A three-day joint-friendly strength program that emphasizes controlled movements and safe resistance training.',
    audience:
      'Ideal for beginners, returning exercisers, or anyone looking to reduce joint stress while building strength.',
    equipmentProfile:
      'Primarily uses resistance machines along with light free weights for stable and controlled movement patterns.',
    whyItWorks:
      'Supported exercises reduce joint stress while improving strength, balance, and overall functional fitness.',
    sessionFocusById: {
      lower_body_supported: 'Anchored by Leg Press. 7 more exercises complete the day.',
      upper_body_supported: 'Anchored by Machine Chest Press. 7 more exercises complete the day.',
      full_body_balance: 'Anchored by Sit-to-Stand (Chair Squat). 8 more exercises complete the day.',
    },
  },
  tpl_gainer_prenatal_fitness_v1: {
    summary:
      'A three-day prenatal fitness program designed to support strength, mobility, and body control through safe exercise.',
    audience:
      'Designed for expectant mothers who have been cleared for exercise by a qualified healthcare professional.',
    equipmentProfile:
      'Requires dumbbells, a resistance band, an exercise mat, and gym equipment such as a cable station and a stationary bike.',
    whyItWorks:
      'Gentle strength work, mobility training, and pelvic floor awareness help maintain function and comfort throughout pregnancy.',
    sessionFocusById: {
      gentle_strength: 'Anchored by Goblet Squat (Light). 7 more exercises complete the day.',
      mobility_pelvic_floor: 'Anchored by Cat-Cow. 7 more exercises complete the day.',
      low_impact_cardio_stability: 'Anchored by Stationary Bike (Easy Pace). 7 more exercises complete the day.',
    },
  },
  tpl_gainer_postpartum_recovery_v1: {
    summary:
      'A three-day postpartum recovery program focused on rebuilding core function and gradually restoring full-body strength.',
    audience:
      'Designed for individuals returning to exercise after childbirth with approval from a healthcare professional.',
    equipmentProfile:
      'Requires light dumbbells, a resistance band, and open space for controlled movement.',
    whyItWorks:
      'The program progresses from breathing and core reconnection toward gradually rebuilding total-body strength.',
    sessionFocusById: {
      core_reconnection: 'Anchored by Diaphragmatic Breathing. 7 more exercises complete the day.',
      gentle_full_body: 'Anchored by Bodyweight Squat. 7 more exercises complete the day.',
      strength_rebuild: 'Anchored by Goblet Squat (Light). 7 more exercises complete the day.',
    },
  },
  tpl_gainer_runners_strength_v1: {
    summary:
      'A three-day strength program for runners that develops lower-body power, stability, and core strength to support running performance.',
    audience:
      'Designed for intermediate runners who want to improve performance, reduce injury risk, and complement their running routine.',
    equipmentProfile:
      'Requires standard gym equipment including barbells, dumbbells, and space for mobility and stability exercises.',
    whyItWorks:
      'Single-leg strength, posterior chain development, and core training improve running efficiency while helping reduce injury risk.',
    sessionFocusById: {
      posterior_chain_power: 'Anchored by Romanian Deadlift. 7 more exercises complete the day.',
      single_leg_stability: 'Anchored by Bulgarian Split Squat. 7 more exercises complete the day.',
      core_mobility_for_runners: 'Anchored by Plank. 8 more exercises complete the day.',
    },
  },

  tpl_strong_elite_v1: {
    summary: 'A 12-week Pro strength block: five-set anchor lifts, heavy pressure days, and accessories that protect the next heavy session.',
    audience: 'Best for experienced lifters who recover well, know the main lifts cold, and want maximal strength as the clear priority.',
    equipmentProfile: 'Full gym required: barbell, rack, bench, trap bar or deadlift setup, machines and cables.',
    whyItWorks: 'Each pattern gets one heavy and one pressure exposure per week, so intensity climbs across the block without the week collapsing into fatigue.',
    sessionFocusById: {
      strong_elite_upper_heavy: 'Five-set bench anchor with heavy rows and press support.',
      strong_elite_lower_heavy: 'Squat and trap bar anchors — the heaviest day of the week.',
      strong_elite_upper_volume: 'Incline pressing and rows add pressure at manageable loads.',
      strong_elite_lower_volume: 'Front squat and RDL keep quality volume behind the anchors.',
    },
  },
  tpl_fit_elite_v1: {
    summary: 'A 12-week Pro block that keeps strength anchors moving while conditioning finishers build a real engine four days per week.',
    audience: 'Best for experienced all-rounders who want strength, conditioning and mobility in one honest weekly structure.',
    equipmentProfile: 'Full gym recommended: barbell, dumbbells, machines, kettlebell and a cardio machine for finishers.',
    whyItWorks: 'Power days push the main lifts while volume days add conditioning density, so both strength and engine progress without stealing from each other.',
    sessionFocusById: {
      fit_elite_upper_a: 'Bench and row anchors capped with a kettlebell finisher.',
      fit_elite_lower_a: 'Squat-first lower day with hinge volume and trunk work.',
      fit_elite_upper_b: 'Incline press and pulldown volume plus a burpee circuit.',
      fit_elite_lower_b: 'Leg press and hip thrust volume with an interval engine block.',
    },
  },
  tpl_shred_elite_v1: {
    summary: 'A 12-week Pro fat-loss block: five days that hold strength anchors while HIIT finishers drive the energy expenditure up.',
    audience: 'Best for experienced lifters cutting fat who refuse to lose their strength base while conditioning volume climbs.',
    equipmentProfile: 'Full gym recommended: barbell, machines, kettlebell, and treadmill or bike for the interval finishers.',
    whyItWorks: 'Every session pairs one honest strength slot with a conditioning finisher, so the deficit comes from work you can actually progress, not from junk volume.',
    sessionFocusById: {
      shred_elite_day1: 'Squat anchor plus swings and treadmill intervals.',
      shred_elite_day2: 'Bench anchor with lunges and a burpee circuit.',
      shred_elite_day3: 'Hinge and press day capped with bike sprints.',
      shred_elite_day4: 'Full-body machine circuit with climbers to finish.',
      shred_elite_day5: 'Swing-led engine day with a recovery flow to close the week.',
    },
  },
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
    audience: 'Best for beginners, mobility-focused weeks, or anyone who wants a calmer movement option inside Vinha.',
    equipmentProfile: 'Mat-friendly and bodyweight-only. No gym setup is required for the core flow of the program.',
    whyItWorks: 'The template uses short repeatable flows instead of complex sequencing, so you can build a steady yoga habit without needing a full studio class every time.',
    sessionFocusById: {
      yoga_recovery_a: 'Sun salutations, balance work, and breathing practice.',
      yoga_recovery_b: 'Stretch-led yoga day with lighter flow volume and reset work.',
    },
  },
  tpl_3_day_run_mobility_v1: {
    summary: 'A beginner-friendly run-and-reset template that pairs interval-based running blocks with mobility and recovery work.',
    audience: 'Best for people who want a simple running entry point inside the current Vinha model without jumping straight into high mileage.',
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

  tpl_shred_v1: {
    summary: 'Three full-body sessions that pair compound lifting with real conditioning finishers, built for dropping fat while keeping muscle.',
    audience: 'Best for anyone whose main goal is fat loss and who wants strength work and conditioning inside the same visit.',
    equipmentProfile: 'Full gym recommended: barbell, machines, kettlebell, and a treadmill or bike for the finishers.',
    whyItWorks: 'Heavy compounds protect muscle while you are in a calorie deficit, and every session ends with an interval finisher that adds real energy expenditure — the name only works because the conditioning is actually in the plan.',
    sessionFocusById: {
      shred_day1: 'Squat and press base with kettlebell swings and a treadmill HIIT finisher.',
      shred_day2: 'Hinge-led full body with a burpee circuit finisher.',
      shred_day3: 'Machine-led full body with loaded carries and a bike interval finisher.',
    },
  },

  tpl_huge_starter_v1: {
    summary: 'Two efficient full-body sessions that build muscle with the least possible weekly friction.',
    audience: 'Best for new lifters who want to grow muscle on two gym days per week without a complicated split.',
    equipmentProfile: 'Full gym recommended: bench, leg press, cable stations, and dumbbells.',
    whyItWorks: 'Every big muscle gets trained twice a week through compound patterns, and short sessions keep consistency high — the main driver of beginner growth.',
    sessionFocusById: {
      huge_starter_day1: 'Push-biased full body: bench, leg press, and pulldown with delt and triceps finishers.',
      huge_starter_day2: 'Pull-biased full body: hinge, row, and machine press with arm and core finishers.',
    },
  },

  tpl_focus_chest_program_v1: {
    summary: 'A three-day specialisation block that trains chest twice a week while the rest of the body stays on maintenance volume.',
    audience: 'Best for intermediate lifters whose chest lags behind and who can commit three days a week to a focused block.',
    equipmentProfile: 'Full gym required: flat and incline bench, machines, dumbbells, and cables.',
    whyItWorks: 'Doubling chest frequency with a heavy day and a volume day drives growth, while a single maintenance day keeps back and legs from detraining.',
    sessionFocusById: {
      focusp_chest_day1: 'Heavy chest day anchored by flat bench with incline and fly support.',
      focusp_chest_day2: 'Maintenance day for back and legs so the rest of the body holds its ground.',
      focusp_chest_day3: 'Volume chest day: incline first, then machine press and flys.',
    },
  },

  tpl_focus_back_program_v1: {
    summary: 'A three-day specialisation block that trains back twice a week while pressing and legs stay on maintenance volume.',
    audience: 'Best for intermediate lifters who want a wider, thicker back and can train three days per week.',
    equipmentProfile: 'Full gym required: barbell, pulldown and row stations, and cables.',
    whyItWorks: 'A heavy row day plus a pulldown-led volume day doubles weekly back stimulus, while one full-body maintenance day protects the rest of your progress.',
    sessionFocusById: {
      focusp_back_day1: 'Heavy back day anchored by barbell row with pulldown and row support.',
      focusp_back_day2: 'Maintenance day for pressing and legs.',
      focusp_back_day3: 'Volume back day: pulldown first, then cable and chest-supported rows.',
    },
  },

  tpl_focus_arms_program_v1: {
    summary: 'A three-day specialisation block with two direct arm days and one full-body maintenance day.',
    audience: 'Best for intermediate lifters whose arms lag behind chest and back development.',
    equipmentProfile: 'Full gym required: barbell, EZ-bar or dumbbells, and cable stations.',
    whyItWorks: 'Arms recover fast, so hitting biceps and triceps directly twice a week adds real volume without stealing recovery from the rest of the week.',
    sessionFocusById: {
      focusp_arms_day1: 'Heavy arm day: close-grip bench and barbell curl as anchors.',
      focusp_arms_day2: 'Full-body maintenance day for legs, back, and shoulders.',
      focusp_arms_day3: 'Volume arm day: pushdowns, preacher curls, and isolation finishers.',
    },
  },

  tpl_focus_legs_program_v1: {
    summary: 'A three-day specialisation block that trains legs twice a week — one heavy squat day, one volume day — with a single upper-body maintenance day.',
    audience: 'Best for intermediate lifters who want serious lower-body growth and can recover from two hard leg days.',
    equipmentProfile: 'Full gym required: squat rack, hack squat or leg press, leg curl machine, and calf station.',
    whyItWorks: 'Squat-led heavy work plus machine-led volume work doubles the weekly growth stimulus, and the upper-body day keeps pressing and pulling from sliding backwards.',
    sessionFocusById: {
      focusp_legs_day1: 'Heavy leg day anchored by back squat with hinge and press support.',
      focusp_legs_day2: 'Upper-body maintenance day.',
      focusp_legs_day3: 'Volume leg day: hack squat, split squats, and hip thrust.',
    },
  },

  tpl_focus_glutes_program_v1: {
    summary: 'A three-day specialisation block with two glute-led lower days and one upper-body maintenance day.',
    audience: 'Best for lifters who want glute growth as the clear top priority for the next training block.',
    equipmentProfile: 'Full gym required: hip thrust setup, squat rack or leg press, and leg curl machine.',
    whyItWorks: 'Hip thrust and hinge patterns load the glutes directly twice a week, with squat and lunge variations adding stimulus from a second angle.',
    sessionFocusById: {
      focusp_glutes_day1: 'Heavy glute day anchored by hip thrust with hinge and split squat support.',
      focusp_glutes_day2: 'Upper-body maintenance day.',
      focusp_glutes_day3: 'Volume glute day: squat, hip thrust, and lunge patterns back to back.',
    },
  },

};

/**
 * English is the source of truth. A Finnish entry replaces it when one exists;
 * a program the Finnish mirror has not caught up with still reads in English
 * rather than showing a hole.
 */
export function getReadyProgramContent(
  templateId: string,
  language: AppLanguage = 'en',
): ReadyProgramContent | null {
  if (language === 'fi') {
    const finnish = READY_PROGRAM_CONTENT_FI[templateId];
    if (finnish) {
      return finnish;
    }
    if (!READY_PROGRAM_CONTENT[templateId] && templateId.startsWith('tpl_gainer_')) {
      return {
        ...FALLBACK_READY_PROGRAM_CONTENT_FI,
        sessionFocusById: {
          [templateId]: 'Rakenteinen Vinha-treenijakso kohdennetuilla viikkotreeneillä.',
        },
      };
    }
  }

  return READY_PROGRAM_CONTENT[templateId] ?? buildFallbackReadyProgramContent(templateId);
}
