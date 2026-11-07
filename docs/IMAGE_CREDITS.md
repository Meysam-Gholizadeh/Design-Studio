# Image credits

Photos used in catalog templates. All come from [Pexels](https://www.pexels.com) under the [Pexels licence](https://www.pexels.com/license/): free to use, including commercially, with no attribution required. They are credited here anyway. They were resized (longest side 720 px) and re-encoded as JPEG to keep the catalog small. Users can replace any of them in the editor (select the image → Upload).

The images in the reference design the user shared were **not** copied; these are separate, licensed photos chosen to fill the same roles.

## Physio Recovery Journey (`src/data/templates/healthcare/images/`)

| File | Used for | Photographer | Source |
|---|---|---|---|
| `exercise-side-stretch.jpg` | Exercises card | Katrin Bolovtsova | https://www.pexels.com/photo/photo-of-woman-stretching-4051574/ |
| `knee-joint-model.jpg` | Centre anatomy image | Magda Ehlers | https://www.pexels.com/photo/a-black-and-white-photo-of-a-knee-27376664/ |
| `knee-mobilisation.jpg` | Exercise program: Knee Mobilisation | Funkcinės Terapijos Centras | https://www.pexels.com/photo/physiotherapist-and-patient-stretching-leg-20860625/ |
| `leg-strengthening.jpg` | Exercise program: Leg Strengthening | Funkcinės Terapijos Centras | https://www.pexels.com/photo/physiotherapist-exercising-patient-leg-20860588/ |
| `hamstring-stretch.jpg` | Exercise program: Hamstring Stretch | Elina Fairytale | https://www.pexels.com/photo/woman-in-blue-sports-bra-and-white-leggings-stretching-3822227/ |
| `balance-training.jpg` | Exercise program: Balance Training | Cansu Hangül | https://www.pexels.com/photo/physiotherapy-balance-training-session-30483062/ |
| `legs-in-motion.jpg` | Motivational card | ROCKETMANN TEAM | https://www.pexels.com/photo/a-person-tiptoeing-9486646/ |

## Personal Finance Hub (`src/data/templates/finance/images/`)

| File | Used for | Source |
|---|---|---|
| `card-ember.jpg`, `card-graphite.jpg`, `card-ocean.jpg` | Payment-card artwork | Original artwork made for this project by `scripts/generate-card-art.ps1`. Fictional "Ember" brand, masked numbers, fictional holders, no real card-network logos. Re-run the script to change colours or text. |

## Fitness Overview (`src/data/templates/fitness/images/`)

Downloaded and prepared by `scripts/prepare-fitness-photos.mjs` (cover-cropped and resized; the hero photo gets a lime glow on its highlights, the banner is slightly darkened).

| File | Used for | Photographer | Source |
|---|---|---|---|
| `hero-athlete.jpg` | Hero card backdrop (lime-tinted) | Studio Voyager | https://www.pexels.com/photo/grayscale-photo-of-a-topless-man-with-black-background-5826542/ |
| `banner-hooded-athlete.jpg` | "Keep moving forward" banner | Alan Cordero | https://www.pexels.com/photo/a-man-wearing-a-black-hoodie-sitting-on-a-bench-11533935/ |
| `workout-upper-body.jpg` | Upcoming workout: Upper Body Strength | Mike Jones | https://www.pexels.com/photo/muscular-man-flexing-his-biceps-8875086/ |
| `workout-hiit.jpg` | Upcoming workout: HIIT Cardio Blast | Connor Scott McManus | https://www.pexels.com/photo/a-shirtless-man-using-battle-ropes-12890811/ |
| `workout-legs.jpg` | Upcoming workout: Leg Day Power | Tima Miroshnichenko | https://www.pexels.com/photo/a-man-doing-squats-5327530/ |
| `workout-core.jpg` | Upcoming workout: Core & Mobility | Li Sun | https://www.pexels.com/photo/man-doing-yoga-2294363/ |

## Learning Platform Overview and Storefront Overview

| File | Used for | Source |
|---|---|---|
| `src/data/templates/education/images/amber-orb.png` | Assistant panel illustration | Original artwork drawn as SVG and rendered to a transparent PNG by `scripts/generate-hero-art.mjs`. |
| `src/data/templates/sales/images/copper-ribbon.png` | Revenue card illustration | Original artwork drawn the same way. |

Both images were made for this project; nothing was copied from the reference screenshots.

## Adding images to templates
- Keep each file small (≤ ~60 KB). The schema limits an image to 700 KB as a data URL.
- Import with `?inline`, e.g. `import photo from './images/x.jpg?inline'`. Vite turns it into a `data:image/jpeg;base64,…` URL, the only image form the design schema accepts (no remote URLs, no SVG).
- Only use images whose licence allows redistribution, and list them here.
