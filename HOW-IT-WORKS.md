# How Turnip Prices Work

This document explains the turnip pricing system in Animal Crossing: New Horizons, based on [Ninji's reverse engineering](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b) of the game's code. No math degree required.

## The basics

Every Sunday morning, Daisy Mae visits your island selling turnips at a random price between 90 and 110 bells. From Monday to Saturday, Timmy and Tommy will buy those turnips from you at Nook's Cranny — but the price changes twice a day:

- **AM price** — 8:00 am to 11:59 am
- **PM price** — 12:00 pm to 10:00 pm

That gives you **12 chances to sell** (6 days x 2 time slots). The goal is to sell at a higher price than what you paid Daisy Mae.

Here's the thing: the game doesn't pick prices randomly each slot. It picks a **pattern** for the entire week, and that pattern determines the shape of your prices from Monday through Saturday.

## The four patterns

Every week, the game secretly assigns your island one of four price patterns.

### Pattern 0: Fluctuating

Prices alternate between "okay" and "not great" phases. You'll see some slots around 90-140% of your buy price, then a few slots that dip down, then back up again. It looks choppy — no clear trend.

**Example** (bought at 91 bells):

| Mon AM | Mon PM | Tue AM | Tue PM | Wed AM | Wed PM | Thu AM | Thu PM | Fri AM | Fri PM | Sat AM | Sat PM |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| 96     | 121    | 82     | 73     | 105    | 88     | 112    | 127    | 68     | 62     | 98     | 108    |

Notice how prices bounce around — some above what you paid, some below, but nothing dramatic. The best price here (127) is only about 1.4x the buy price. You might make a small profit, or you might break even.

### Pattern 1: Large Spike

This is the jackpot pattern. Prices start by slowly decreasing, then suddenly spike to **2x to 6x** your buy price before crashing back down. The spike lasts for 5 slots, and the peak (the 3rd slot of the spike) is the big one.

**Example** (bought at 91 bells):

| Mon AM | Mon PM | Tue AM | Tue PM | Wed AM | Wed PM | Thu AM | Thu PM | Fri AM | Fri PM | Sat AM | Sat PM |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| 82     | 78     | 75     | 71     | 96     | 163    | **468**| 155    | 98     | 62     | 55     | 49     |

The prices drop Mon-Tue as the game starts with a decreasing phase. Then Wednesday AM starts climbing, and Wednesday PM explodes to 468 bells — over 5x what you paid! After the peak, prices crash and stay low for the rest of the week.

The spike can start as early as Wednesday AM or as late as Saturday AM. If you see prices steadily dropping early in the week, don't panic — it might be building up to a massive spike.

### Pattern 2: Decreasing

The worst pattern. Prices start around 85-90% of your buy price and steadily drop every slot. There's no recovery, no spike, nothing. Just a slow decline all week.

**Example** (bought at 91 bells):

| Mon AM | Mon PM | Tue AM | Tue PM | Wed AM | Wed PM | Thu AM | Thu PM | Fri AM | Fri PM | Sat AM | Sat PM |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| 79     | 75     | 71     | 66     | 61     | 56     | 51     | 47     | 43     | 39     | 35     | 32     |

Every single price is below what you paid. If you're on this pattern, cut your losses and sell to a friend's island or accept the loss.

### Pattern 3: Small Spike

Similar structure to the Large Spike, but the peak is smaller — around **1.4x to 2x** your buy price. The spike is also shaped differently: it has 5 slots total, with a 3-slot "peak" in the middle where the highest price appears.

**Example** (bought at 91 bells):

| Mon AM | Mon PM | Tue AM | Tue PM | Wed AM | Wed PM | Thu AM | Thu PM | Fri AM | Fri PM | Sat AM | Sat PM |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| 54     | 48     | 84     | 92     | 127    | **161**| 119    | 72     | 67     | 62     | 57     | 52     |

The decline before the spike is steeper than the Large Spike (prices can drop to 40% of buy price), but the spike itself is more modest. The best price here (161) is about 1.8x the buy price. Still a profit, but not the windfall you'd get from a Large Spike.

The tricky part: early in the week, a Small Spike can look a lot like a Large Spike or even a Decreasing pattern. The predictor helps you tell them apart.

## How the game picks your pattern

Your pattern this week depends on what pattern you had **last week**. The game uses a transition table to decide the odds:

| Last week was...  | Fluctuating | Large Spike | Decreasing | Small Spike |
|-------------------|-------------|-------------|------------|-------------|
| **Fluctuating**   | 20%         | 30%         | 15%        | 35%         |
| **Large Spike**   | 50%         | 5%          | 20%        | 25%         |
| **Decreasing**    | 25%         | 45%         | 5%         | 25%         |
| **Small Spike**   | 45%         | 25%         | 15%        | 15%         |

Read it like this: if last week was a **Large Spike**, there's a 50% chance this week is Fluctuating, a 5% chance of another Large Spike, 20% chance of Decreasing, and 25% chance of Small Spike.

Some takeaways:
- **After a Large Spike or Decreasing pattern, you're unlikely to get the same one again** (only 5% each). The game tends to mix things up.
- **After Fluctuating, you have the best odds of a Large Spike** (30%) or Small Spike (35%).
- **If you don't know last week's pattern**, the predictor uses long-run average probabilities (roughly 35% Fluctuating, 25% Large Spike, 15% Decreasing, 26% Small Spike).

## How the predictor narrows it down

When you first enter your buy price with no sell prices, all four patterns are possible. The predictor shows you every possible outcome across all patterns — which is a lot of rows.

As you enter prices throughout the week, the predictor does two things:

1. **Eliminates impossible patterns.** Each pattern can only produce prices within certain ranges for each time slot. If your Monday AM price is 85, the predictor checks: "Could the Decreasing pattern produce an 85 here? Could the Large Spike? Could Fluctuating?" Any pattern that can't produce your actual price gets thrown out.

2. **Updates probabilities.** Among the patterns that *can* still produce your prices, some are more likely than others. If your price falls right in the middle of a pattern's expected range, that pattern gets a higher probability. If your price is at the very edge of what a pattern could produce, it's technically possible but unlikely.

**Example of narrowing down:**

You bought at 91 bells. Here's what happens as the week goes on:

- **Sunday (buy price: 91):** All four patterns are possible. Too early to tell.
- **Monday AM (price: 81):** This is below your buy price. Could be any pattern — they all allow prices in this range on Monday AM.
- **Monday PM (price: 71):** Still dropping. Decreasing pattern is gaining probability. Fluctuating is still possible but less likely since both slots dropped.
- **Tuesday AM (price: 96):** Price jumped up! This rules out Decreasing (prices never go up in that pattern). You're now looking at Fluctuating, Large Spike, or Small Spike.
- **Tuesday PM (price: 161):** Big jump. This is too high for Fluctuating (max 1.4x = ~127 bells). You're on either a **Large Spike** or **Small Spike**. Given the magnitude, the predictor will tell you which is more likely and when the peak might hit.

## The rate system

Behind the scenes, the game doesn't pick prices directly. Instead, it picks a hidden **rate** (a multiplier) and applies it to your buy price:

```
sell price = roundUp(rate x buy price)
```

For example, if your buy price is 91 and the rate is 1.4, your sell price would be roundUp(1.4 x 91) = roundUp(127.4) = 128 bells.

Each pattern defines the rules for how the rate behaves:
- In **Fluctuating**, the rate bounces between 0.9-1.4 (high phases) and 0.6-0.8 (low phases, declining).
- In **Large Spike**, the rate starts at 0.85-0.9 and drops slowly, then jumps to 0.9, 1.4, 2.0-6.0, 1.4, 0.9 during the spike, then drops to 0.4-0.9 after.
- In **Decreasing**, the rate starts at 0.85-0.9 and drops by 0.03-0.05 every slot, all week.
- In **Small Spike**, the rate drops first (0.4-0.9, declining), then jumps to 0.9-1.4 for two slots, then peaks at 1.4-2.0 for three slots, then drops again.

When you enter a real price, the predictor works backwards: "Given this sell price and the buy price, what rate must the game have picked?" If that rate falls outside what a pattern allows, that pattern is eliminated.

## First-time buyers

If no one has ever bought turnips from Daisy Mae on your island before, the game **always gives you Small Spike (Pattern 3)**. This is a nice introductory pattern — you're guaranteed a modest profit on your first week.

After your first purchase, the normal transition table kicks in for the following weeks.

## When should you sell?

The app calculates an **expected value** for each remaining time slot. This is the probability-weighted average of all possible prices across all remaining patterns. Think of it as: "If I could replay this week 1,000 times with the same data so far, what would the average price be at each slot?"

The sell/buy advice works like this:

- **"You should sell now"** — your current price is higher than the expected maximum of all remaining slots. Holding out will likely result in a lower price.
- **"You should sell later"** — the expected maximum of a future slot is higher than your current price. The app tells you which slot and what price to aim for.
- **"You should buy"** — on Sunday, if the expected maximum sell price for the week is higher than the current buy price, it's worth buying turnips.

The key word is "expected" — this is about averages and probabilities, not guarantees. A Large Spike *could* still happen even if the predictor says it's only 10% likely. The advice helps you make the best decision given the information you have, but the game always has a random element.

---

*The prediction logic is based on [Ninji's reverse engineering](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b) of the game's source code. The original implementation is from [mikebryant/ac-nh-turnip-prices](https://github.com/mikebryant/ac-nh-turnip-prices).*
