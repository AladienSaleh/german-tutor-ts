# Scenarios Guide

Scenarios are YAML files in the `scenarios/` directory. Each defines a structured lesson
that Lina works through step by step, driving the conversation proactively.

---

## Built-in Scenarios

### `alltag` — Daily Life (A1)

Practicing basic daily routines and personal information.

| Step | Topic |
|------|-------|
| 1 | Greet and ask the student's name |
| 2 | Ask where they live |
| 3 | Ask what time they wake up |
| 4 | Ask what they eat for breakfast |
| 5 | Ask about their job or studies |
| 6 | Ask what they do in their free time |
| 7 | Ask about their family |
| 8 | Introduce simple past: what did they do yesterday? |
| 9 | Warm wrap-up and encouragement |

---

### `restaurant` — At the Restaurant (A1–A2)

Ordering food and drink, asking for the bill.

| Step | Topic |
|------|-------|
| 1 | Welcome and ask about reservation |
| 2 | Ask what they want to drink |
| 3 | Ask if they are ready to order food |
| 4 | Suggest a daily special |
| 5 | Ask how the meal is |
| 6 | Offer dessert or coffee |
| 7 | Handle the student asking for the bill |
| 8 | Ask how they want to pay (cash or card) |
| 9 | Wish them a nice day |

---

### `arzt` — At the Doctor (A2)

Describing symptoms and navigating a medical appointment.

| Step | Topic |
|------|-------|
| 1 | Reception: ask for insurance card |
| 2 | Ask about symptoms |
| 3 | Ask how long they have felt this way |
| 4 | Ask about fever or specific pains |
| 5 | Tell them to wait for the doctor |
| 6 | (As doctor) Ask to describe the pain |
| 7 | Prescribe medicine and explain dosage |
| 8 | Say when to return if not better |
| 9 | Goodbye and speedy recovery |

---

### `reisen` — Traveling (A2)

Buying train tickets and asking for directions.

| Step | Topic |
|------|-------|
| 1 | Ask where they want to travel |
| 2 | One-way or return ticket? |
| 3 | Tell the price, ask about BahnCard |
| 4 | Tell them the platform |
| 5 | Offer help finding a hotel |
| 6 | Roleplay asking for directions |
| 7 | What do they plan to visit? |
| 8 | How do they like the city? |
| 9 | Wrap up the travel scenario |

---

## YAML Format

Each scenario file follows this structure:

```yaml
id: my_scenario
title: My Scenario Title (German subtitle)
description: One sentence describing what the student practises.
points:
  - First thing Lina introduces or asks.
  - Second question or situation.
  - Continue for 7–12 steps.
  - Final step should be a warm wrap-up.
```

### Rules for good scenarios

1. **Each point is one task for Lina**, not a script line. Lina improvises the exact words.
2. **Keep points concrete** — "Ask what they drink for breakfast" not "Talk about breakfast".
3. **Progress logically** — easy vocabulary first, complexity increases.
4. **7–12 points** — too few and the lesson is short; too many and it becomes exhausting.
5. **End warmly** — the final step should always celebrate the student's effort.

---

## Creating a New Scenario

### Step 1: Create the YAML file

```bash
cat > scenarios/supermarkt.yaml << 'EOF'
id: supermarkt
title: At the Supermarket (Im Supermarkt)
description: Shopping for food, asking about prices and locations.
points:
  - Greet the student at the supermarket entrance.
  - Ask what they need to buy today (vegetables, fruit, etc.).
  - Ask where they can find the bread aisle (roleplay asking a staff member).
  - Discuss prices — ask if something is expensive or cheap.
  - Practice numbers at the checkout: how much does everything cost?
  - The student doesn't have enough money — what do they put back?
  - Practice saying goodbye to the cashier.
  - Ask what they will cook with their shopping.
  - Wrap up and tell them they did a great job.
EOF
```

### Step 2: Restart the server

```bash
# Stop current server (Ctrl+C) then:
npm run dev
```

The scenario appears automatically in the picker. No other changes needed.

### Step 3: Test it

Open `http://localhost:3000`, click your new scenario card, and start practising.

---

## Scenario Design Tips

### Good sentence structure progression (A1 → A2)

| Concept | Example point |
|---------|---------------|
| Present simple | "Ask what the student eats for breakfast" |
| Modal verbs | "Ask what they would like to drink (möchten)" |
| Questions | "Ask how long they have been waiting" |
| Simple past | "Ask what they did yesterday" |
| Imperative | "Roleplay a waiter taking an order" |

### Making corrections work well

Lina's correction system works best when:
- The student has to produce free speech (not just yes/no answers)
- There's vocabulary pressure (food names, numbers, directions)
- Multiple ways to say something exist (so wrong choices get corrected)

### Difficulty calibration

| Level | Vocabulary | Grammar | Scenario examples |
|-------|------------|---------|-------------------|
| A1 | 500 most common | Present only | alltag, restaurant |
| A2 | 1000 common | Past, modals | arzt, reisen |
| B1 | Broader range | Subjunctive, passive | Add your own |

---

## Translating Scenarios

The YAML `points` are written in English so Lina receives clear instructions.
Lina then speaks in German automatically (per the system prompt).

If you want Lina to roleplay a specific character (e.g. a pharmacist), state it in the point:
```yaml
  - (As pharmacist) Ask what medication the student is looking for.
```
